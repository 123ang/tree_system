import { executeQuery } from '../database/connection';

interface BeeHiveTransaction {
  wallet_address: string;
  referrer_wallet: string;
  payment_datetime: string;
  total_payment: number;
  target_level?: number; // Optional - will be auto-detected from payment amount
}

interface BeeHiveLevel {
  level: number;
  level_name_cn: string;
  level_name_en: string;
  fee_usdt: number;
  bcc_reward: number;
  layer_depth: number;
  usdt_payout: number;
}

interface BeeHiveMemberStats {
  wallet_address: string;
  current_level: number;
  total_inflow: number;
  total_outflow_usdt: number;
  total_outflow_bcc: number;
  pending_usdt: number;
  pending_bcc: number;
  direct_sponsor_claimed_count: number;
}

interface RewardRecord {
  recipient_wallet: string;
  source_wallet: string;
  reward_type: string;
  amount: number;
  currency: string;
  status: string;
  layer_number: number | null;
  notes: string;
}

export class BeeHiveService {
  
  /**
   * Get all BeeHive levels
   */
  async getLevels(): Promise<BeeHiveLevel[]> {
    const query = 'SELECT * FROM beehive_levels ORDER BY level';
    const results = await executeQuery(query, []);
    return results as BeeHiveLevel[];
  }
  
  /**
   * Clear all BeeHive data (for fresh calculation)
   */
  async clearBeeHiveData(): Promise<void> {
    console.log('Clearing BeeHive data...');
    await executeQuery('DELETE FROM beehive_layer_counters', []);
    await executeQuery('DELETE FROM beehive_rewards', []);
    await executeQuery('DELETE FROM beehive_transactions', []);
    // Reset BeeHive fields in members table
    await executeQuery(`
      UPDATE members SET 
        beehive_current_level = 0,
        beehive_total_inflow = 0.00,
        beehive_total_outflow_usdt = 0.00,
        beehive_total_outflow_bcc = 0,
        beehive_direct_sponsor_claimed_count = 0
    `, []);
    console.log('BeeHive data cleared');
  }
  
  /**
   * Build tree structure from transactions (create members and placements)
   */
  private async buildTreeStructure(transactions: BeeHiveTransaction[]): Promise<void> {
    console.log('Building tree structure from transactions...');
    
    // Get unique wallets with their first appearance (chronologically)
    const walletMap = new Map<string, { wallet: string; referrer: string; firstSeen: Date }>();
    
    for (const txn of transactions) {
      if (!walletMap.has(txn.wallet_address)) {
        walletMap.set(txn.wallet_address, {
          wallet: txn.wallet_address,
          referrer: txn.referrer_wallet || txn.wallet_address,
          firstSeen: new Date(txn.payment_datetime)
        });
      }
    }
    
    // Convert to array and sort by first appearance
    const uniqueMembers = Array.from(walletMap.values())
      .sort((a, b) => a.firstSeen.getTime() - b.firstSeen.getTime());
    
    console.log(`Found ${uniqueMembers.length} unique members to add to tree`);
    
    const memberIdMap = new Map<string, number>(); // wallet -> id
    const sponsorIdMap = new Map<string, number>(); // wallet -> id
    
    // Step 1: Create all members in tree structure
    for (const member of uniqueMembers) {
      // Check if member already exists
      const existingQuery = 'SELECT id FROM members WHERE wallet_address = ?';
      const existingResults = await executeQuery(existingQuery, [member.wallet]);
      
      let memberId: number;
      
      if ((existingResults as any[]).length > 0) {
        memberId = (existingResults as any[])[0].id;
        console.log(`Member ${member.wallet} already exists (ID: ${memberId})`);
      } else {
        // Create new member
        const insertQuery = `
          INSERT INTO members (wallet_address, joined_at, activation_sequence)
          VALUES (?, ?, ?)
        `;
        const result = await executeQuery(insertQuery, [
          member.wallet,
          member.firstSeen.toISOString().slice(0, 19).replace('T', ' '),
          uniqueMembers.indexOf(member)
        ]);
        memberId = (result as any).insertId;
        console.log(`Created member ${member.wallet} (ID: ${memberId})`);
      }
      
      memberIdMap.set(member.wallet, memberId);
      
      // Set root_id and sponsor_id for root members (self-referring)
      if (member.wallet === member.referrer || !member.referrer) {
        await executeQuery(
          'UPDATE members SET root_id = ? WHERE id = ?',
          [memberId, memberId]
        );
        sponsorIdMap.set(member.wallet, memberId);
        
        // Create self-link in closure table
        await executeQuery(
          'INSERT IGNORE INTO member_closure (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)',
          [memberId, memberId, 0]
        );
      }
    }
    
    // Step 2: Set sponsor relationships
    for (const member of uniqueMembers) {
      if (member.wallet === member.referrer || !member.referrer) {
        continue; // Skip root members
      }
      
      const memberId = memberIdMap.get(member.wallet);
      const referrerId = memberIdMap.get(member.referrer);
      
      if (!memberId || !referrerId) {
        console.warn(`Cannot set sponsor for ${member.wallet}: referrer ${member.referrer} not found`);
        continue;
      }
      
      await executeQuery(
        'UPDATE members SET sponsor_id = ? WHERE id = ?',
        [referrerId, memberId]
      );
      sponsorIdMap.set(member.wallet, referrerId);
    }
    
    // Step 3: Apply placement algorithm
    console.log('Applying placement algorithm...');
    for (const member of uniqueMembers) {
      if (member.wallet === member.referrer || !member.referrer) {
        continue; // Skip root members
      }
      
      const memberId = memberIdMap.get(member.wallet);
      const sponsorId = sponsorIdMap.get(member.referrer);
      
      if (!memberId || !sponsorId) {
        continue;
      }
      
      // Check if already placed
      const placementCheck = await executeQuery(
        'SELECT parent_id FROM placements WHERE child_id = ?',
        [memberId]
      );
      
      if ((placementCheck as any[]).length > 0) {
        continue; // Already placed
      }
      
      // Find placement
      const placement = await this.findPlacement(sponsorId, uniqueMembers.indexOf(member));
      
      if (placement) {
        await this.placeMember(memberId, placement.parent_id, placement.position, sponsorId);
      }
    }
    
    console.log('Tree structure built successfully');
  }
  
  /**
   * Find placement for a member (similar to TreeImporter logic)
   */
  private async findPlacement(sponsorId: number, activationSequence: number): Promise<{ parent_id: number; position: number } | null> {
    const directChildren = await executeQuery(
      'SELECT COUNT(*) as count FROM placements WHERE parent_id = ?',
      [sponsorId]
    );
    
    const directCount = (directChildren as any)[0].count;
    
    if (directCount < 3) {
      return {
        parent_id: sponsorId,
        position: directCount + 1
      };
    }
    
    // Find available slot in sponsor's subtree
    const candidates = await this.getAvailableSlots(sponsorId);
    
    if (candidates.length === 0) {
      return null;
    }
    
    return {
      parent_id: candidates[0].parent_id,
      position: candidates[0].position
    };
  }
  
  /**
   * Get available slots in a subtree
   */
  private async getAvailableSlots(sponsorId: number): Promise<{ parent_id: number; position: number }[]> {
    const query = `
      SELECT DISTINCT m.id, m.joined_at, 
             (SELECT COUNT(*) FROM placements p WHERE p.parent_id = m.id) as child_count,
             mc.depth
      FROM members m
      JOIN member_closure mc ON m.id = mc.descendant_id
      WHERE mc.ancestor_id = ? 
        AND (SELECT COUNT(*) FROM placements p WHERE p.parent_id = m.id) < 3
      ORDER BY mc.depth ASC, child_count ASC, m.joined_at ASC, m.id ASC
    `;
    
    const results = await executeQuery(query, [sponsorId]);
    const slots: { parent_id: number; position: number }[] = [];
    
    for (const row of results as any[]) {
      const childCount = row.child_count;
      const positions = [1, 2, 3];
      const usedPositions = await executeQuery(
        'SELECT position FROM placements WHERE parent_id = ?',
        [row.id]
      ) as any[];
      const usedPos = new Set(usedPositions.map((p: any) => p.position));
      const availablePos = positions.find(p => !usedPos.has(p));
      
      if (availablePos) {
        slots.push({ parent_id: row.id, position: availablePos });
      }
    }
    
    return slots;
  }
  
  /**
   * Place a member in the tree
   */
  private async placeMember(memberId: number, parentId: number, position: number, sponsorId: number): Promise<void> {
    // Ensure parent has a self-link in closure table
    const parentSelfLinkCheck = await executeQuery(
      'SELECT COUNT(*) as count FROM member_closure WHERE ancestor_id = ? AND descendant_id = ? AND depth = 0',
      [parentId, parentId]
    );
    if ((parentSelfLinkCheck as any[])[0]?.count === 0) {
      await executeQuery(
        'INSERT IGNORE INTO member_closure (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)',
        [parentId, parentId, 0]
      );
    }
    
    const queries = [
      {
        query: 'INSERT INTO placements (parent_id, child_id, position) VALUES (?, ?, ?)',
        params: [parentId, memberId, position]
      },
      {
        query: 'INSERT INTO member_closure (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)',
        params: [memberId, memberId, 0]
      },
      {
        query: `
          INSERT IGNORE INTO member_closure (ancestor_id, descendant_id, depth)
          SELECT ancestor_id, ?, depth + 1
          FROM member_closure
          WHERE descendant_id = ?
        `,
        params: [memberId, parentId]
      },
      {
        query: 'UPDATE members SET root_id = COALESCE(root_id, (SELECT root_id FROM members WHERE id = ?)) WHERE id = ?',
        params: [parentId, memberId]
      }
    ];
    
    await executeQuery(queries[0].query, queries[0].params);
    await executeQuery(queries[1].query, queries[1].params);
    await executeQuery(queries[2].query, queries[2].params);
    await executeQuery(queries[3].query, queries[3].params);
  }

  /**
   * Process BeeHive transactions from CSV
   */
  async processTransactions(transactions: BeeHiveTransaction[]): Promise<{
    success: boolean;
    message: string;
    stats: any;
  }> {
    console.log(`Processing ${transactions.length} BeeHive transactions...`);
    
    try {
      // Clear existing BeeHive data (but keep tree structure)
      await this.clearBeeHiveData();
      
      // Sort by payment_datetime
      transactions.sort((a, b) => 
        new Date(a.payment_datetime).getTime() - new Date(b.payment_datetime).getTime()
      );
      
      // Step 1: Build tree structure from transactions
      await this.buildTreeStructure(transactions);
      
      // Step 2: Process transactions for rewards
      let processedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      
      for (const txn of transactions) {
        try {
          await this.processTransaction(txn);
          processedCount++;
        } catch (error: any) {
          errorCount++;
          errors.push(`${txn.wallet_address}: ${error.message}`);
          console.error(`Error processing transaction for ${txn.wallet_address}:`, error);
        }
      }
      
      // Get final stats
      const stats = await this.getSystemStats();
      
      return {
        success: errorCount === 0,
        message: `Processed ${processedCount} transactions, ${errorCount} errors`,
        stats: {
          ...stats,
          errors: errors.slice(0, 10) // Only return first 10 errors
        }
      };
    } catch (error: any) {
      console.error('Error processing transactions:', error);
      return {
        success: false,
        message: error.message,
        stats: null
      };
    }
  }
  
  /**
   * Detect target level from payment amount
   */
  private async detectLevelFromPayment(paymentAmount: number): Promise<BeeHiveLevel | null> {
    const levels = await this.getLevels();
    
    // Find level that matches the payment amount (with small tolerance for floating point)
    const targetLevel = levels.find(l => Math.abs(l.fee_usdt - paymentAmount) < 0.01);
    
    return targetLevel || null;
  }

  /**
   * Process a single transaction
   */
  private async processTransaction(txn: BeeHiveTransaction): Promise<void> {
    // Auto-detect target level from payment amount if not provided
    let targetLevel: BeeHiveLevel | null;
    let targetLevelNumber: number;
    
    if (txn.target_level) {
      // If target_level is provided, use it
      const levels = await this.getLevels();
      targetLevel = levels.find(l => l.level === txn.target_level) || null;
      
      if (!targetLevel) {
        throw new Error(`Invalid target level: ${txn.target_level}`);
      }
      
      if (Math.abs(txn.total_payment - targetLevel.fee_usdt) > 0.01) {
        throw new Error(`Payment ${txn.total_payment} doesn't match level ${txn.target_level} fee ${targetLevel.fee_usdt}`);
      }
      
      targetLevelNumber = txn.target_level;
    } else {
      // Auto-detect level from payment amount
      targetLevel = await this.detectLevelFromPayment(txn.total_payment);
      
      if (!targetLevel) {
        throw new Error(`Payment amount ${txn.total_payment} doesn't match any level fee. Available levels: ${(await this.getLevels()).map(l => `${l.level}(${l.fee_usdt})`).join(', ')}`);
      }
      
      targetLevelNumber = targetLevel.level;
    }
    
    // Get member from tree (should exist from buildTreeStructure)
    const memberQuery = 'SELECT id FROM members WHERE wallet_address = ?';
    const memberResults = await executeQuery(memberQuery, [txn.wallet_address]);
    
    if ((memberResults as any[]).length === 0) {
      throw new Error(`Member ${txn.wallet_address} not found in tree structure.`);
    }
    
    const memberId = (memberResults as any[])[0].id;
    
    // Calculate expiry (payment_datetime + 72h)
    const paymentDate = new Date(txn.payment_datetime);
    const expiresAt = new Date(paymentDate.getTime() + 72 * 60 * 60 * 1000);
    
    // Create transaction record
    const txnQuery = `
      INSERT INTO beehive_transactions 
      (member_id, wallet_address, referrer_wallet, payment_datetime, total_payment, target_level, expires_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'qualified')
    `;
    const txnResult = await executeQuery(txnQuery, [
      memberId,
      txn.wallet_address,
      txn.referrer_wallet,
      txn.payment_datetime,
      txn.total_payment,
      targetLevelNumber,
      expiresAt
    ]);
    
    const transactionId = (txnResult as any).insertId;
    
    // Update member inflow and level (only upgrade if new level is higher)
    await executeQuery(
      `UPDATE members 
       SET beehive_total_inflow = beehive_total_inflow + ?, 
           beehive_current_level = GREATEST(beehive_current_level, ?) 
       WHERE id = ?`,
      [txn.total_payment, targetLevelNumber, memberId]
    );
    
    // Award BCC token reward (instant)
    await this.createReward({
      recipient_member_id: memberId,
      recipient_wallet: txn.wallet_address,
      source_transaction_id: transactionId,
      source_wallet: txn.wallet_address,
      reward_type: 'bcc_token',
      amount: targetLevel.bcc_reward,
      currency: 'BCC',
      status: 'instant',
      notes: `BCC reward for reaching level ${targetLevelNumber}`
    });
    
    // Process direct sponsor reward
    if (txn.referrer_wallet && txn.referrer_wallet !== txn.wallet_address) {
      await this.processDirectSponsorReward(
        txn.referrer_wallet,
        txn.wallet_address,
        transactionId,
        targetLevelNumber
      );
    }
    
    // Process layer payout (if level >= 2)
    if (targetLevelNumber >= 2) {
      await this.processLayerPayout(
        txn.wallet_address,
        memberId,
        targetLevelNumber,
        targetLevel.usdt_payout,
        transactionId,
        txn.payment_datetime
      );
    }
  }
  
  /**
   * Process direct sponsor reward
   */
  private async processDirectSponsorReward(
    sponsorWallet: string,
    newMemberWallet: string,
    transactionId: number,
    newMemberLevel: number
  ): Promise<void> {
    // Get sponsor's BeeHive status (from members table directly)
    const sponsorQuery = `
      SELECT id, wallet_address, beehive_current_level as current_level, 
             beehive_direct_sponsor_claimed_count as direct_sponsor_claimed_count
      FROM members
      WHERE wallet_address = ?
    `;
    const sponsorResults = await executeQuery(sponsorQuery, [sponsorWallet]);
    
    if ((sponsorResults as any[]).length === 0) {
      throw new Error(`Sponsor ${sponsorWallet} not found in members table`);
    }
    
    const sponsor = (sponsorResults as any[])[0];
    
    // Check sponsor's level and direct sponsor count
    if (sponsor.current_level === 0) {
      // Sponsor hasn't joined BeeHive yet
      await this.createReward({
        recipient_member_id: sponsor.id,
        recipient_wallet: sponsorWallet,
        source_transaction_id: transactionId,
        source_wallet: newMemberWallet,
        reward_type: 'direct_sponsor',
        amount: 100,
        currency: 'USDT',
        status: 'pending',
        notes: 'Direct sponsor reward pending - sponsor must join BeeHive first'
      });
    } else if (sponsor.current_level === 1 && sponsor.direct_sponsor_claimed_count >= 2) {
      // Level 1 can only claim 2 direct sponsors
      await this.createReward({
        recipient_member_id: sponsor.id,
        recipient_wallet: sponsorWallet,
        source_transaction_id: transactionId,
        source_wallet: newMemberWallet,
        reward_type: 'direct_sponsor',
        amount: 100,
        currency: 'USDT',
        status: 'pending',
        notes: 'Direct sponsor reward #3+ pending - must upgrade to Level 2'
      });
    } else {
      // Instant payout
      await this.createReward({
        recipient_member_id: sponsor.id,
        recipient_wallet: sponsorWallet,
        source_transaction_id: transactionId,
        source_wallet: newMemberWallet,
        reward_type: 'direct_sponsor',
        amount: 100,
        currency: 'USDT',
        status: 'instant',
        notes: `Direct sponsor reward #${sponsor.direct_sponsor_claimed_count + 1}`
      });
      
      // Update sponsor's claimed count
      await executeQuery(
        'UPDATE members SET beehive_direct_sponsor_claimed_count = beehive_direct_sponsor_claimed_count + 1, beehive_total_outflow_usdt = beehive_total_outflow_usdt + 100 WHERE id = ?',
        [sponsor.id]
      );
    }
  }
  
  /**
   * Process layer payout
   */
  private async processLayerPayout(
    memberWallet: string,
    memberId: number,
    level: number,
    payout: number,
    transactionId: number,
    paymentDatetime: string
  ): Promise<void> {
    // Find upline at the corresponding layer (layer N = N levels up in placement tree)
    const layerDepth = level;
    const upline = await this.findUplineAtLayer(memberId, layerDepth);
    
    if (!upline) {
      console.log(`No upline found at layer ${layerDepth} for ${memberWallet}`);
      return;
    }
    
    // Get or increment layer counter
    const counter = await this.getOrCreateLayerCounter(upline.member_id, upline.wallet_address, level);
    const upgradeSequence = counter.upgrade_count + 1; // 1st, 2nd, or 3rd
    
    // Update counter
    await executeQuery(
      'UPDATE beehive_layer_counters SET upgrade_count = upgrade_count + 1, last_upgrade_at = ? WHERE id = ?',
      [paymentDatetime, counter.id]
    );
    
    // Check upline qualification
    const uplineLevel = upline.current_level;
    
    if (upgradeSequence <= 2) {
      // 1st and 2nd: instant if qualified
      if (uplineLevel >= level) {
        await this.createReward({
          recipient_member_id: upline.member_id,
          recipient_wallet: upline.wallet_address,
          source_transaction_id: transactionId,
          source_wallet: memberWallet,
          reward_type: 'layer_payout',
          amount: payout,
          currency: 'USDT',
          status: 'instant',
          layer_number: level,
          layer_upgrade_sequence: upgradeSequence,
          notes: `Layer ${level} payout #${upgradeSequence} - instant`
        });
        
        await executeQuery(
          'UPDATE members SET beehive_total_outflow_usdt = beehive_total_outflow_usdt + ? WHERE id = ?',
          [payout, upline.member_id]
        );
      } else {
        // Not qualified yet
        const expiresAt = new Date(new Date(paymentDatetime).getTime() + 72 * 60 * 60 * 1000);
        await this.createReward({
          recipient_member_id: upline.member_id,
          recipient_wallet: upline.wallet_address,
          source_transaction_id: transactionId,
          source_wallet: memberWallet,
          reward_type: 'layer_payout',
          amount: payout,
          currency: 'USDT',
          status: 'pending',
          layer_number: level,
          layer_upgrade_sequence: upgradeSequence,
          pending_expires_at: expiresAt,
          notes: `Layer ${level} payout #${upgradeSequence} - pending (need level ${level}, current: ${uplineLevel})`
        });
      }
    } else {
      // 3rd: must upgrade to next level
      const requiredLevel = level + 1;
      if (uplineLevel >= requiredLevel) {
        await this.createReward({
          recipient_member_id: upline.member_id,
          recipient_wallet: upline.wallet_address,
          source_transaction_id: transactionId,
          source_wallet: memberWallet,
          reward_type: 'layer_payout',
          amount: payout,
          currency: 'USDT',
          status: 'instant',
          layer_number: level,
          layer_upgrade_sequence: upgradeSequence,
          notes: `Layer ${level} payout #${upgradeSequence} - instant (qualified for level ${requiredLevel})`
        });
        
        await executeQuery(
          'UPDATE members SET beehive_total_outflow_usdt = beehive_total_outflow_usdt + ? WHERE id = ?',
          [payout, upline.member_id]
        );
      } else {
        // Pending - will pass up after 72h
        const expiresAt = new Date(new Date(paymentDatetime).getTime() + 72 * 60 * 60 * 1000);
        await this.createReward({
          recipient_member_id: upline.member_id,
          recipient_wallet: upline.wallet_address,
          source_transaction_id: transactionId,
          source_wallet: memberWallet,
          reward_type: 'layer_payout',
          amount: payout,
          currency: 'USDT',
          status: 'pending',
          layer_number: level,
          layer_upgrade_sequence: upgradeSequence,
          pending_expires_at: expiresAt,
          notes: `Layer ${level} payout #${upgradeSequence} - pending (need level ${requiredLevel}, current: ${uplineLevel}) - will pass up if not qualified`
        });
      }
    }
  }
  
  /**
   * Find upline at specific layer depth
   */
  private async findUplineAtLayer(memberId: number, layerDepth: number): Promise<any> {
    // Use member_closure table to find ancestor at exact depth
    const query = `
      SELECT 
        mc.ancestor_id as member_id,
        m.wallet_address,
        COALESCE(m.beehive_current_level, 0) as current_level
      FROM member_closure mc
      JOIN members m ON mc.ancestor_id = m.id
      WHERE mc.descendant_id = ? AND mc.depth = ?
      LIMIT 1
    `;
    
    const results = await executeQuery(query, [memberId, layerDepth]);
    
    if ((results as any[]).length === 0) {
      return null;
    }
    
    return (results as any[])[0];
  }
  
  /**
   * Get or create layer counter (uplineMemberId is now members.id directly)
   */
  private async getOrCreateLayerCounter(uplineMemberId: number, uplineWallet: string, layerNumber: number): Promise<any> {
    let query = `
      SELECT * FROM beehive_layer_counters
      WHERE upline_member_id = ? AND layer_number = ?
    `;
    let results = await executeQuery(query, [uplineMemberId, layerNumber]);
    
    if ((results as any[]).length > 0) {
      return (results as any[])[0];
    }
    
    // Create counter
    query = `
      INSERT INTO beehive_layer_counters (upline_member_id, upline_wallet, layer_number, upgrade_count)
      VALUES (?, ?, ?, 0)
    `;
    const insertResult = await executeQuery(query, [uplineMemberId, uplineWallet, layerNumber]);
    
    query = 'SELECT * FROM beehive_layer_counters WHERE id = ?';
    results = await executeQuery(query, [(insertResult as any).insertId]);
    
    return (results as any[])[0];
  }
  
  /**
   * Create reward record
   */
  private async createReward(reward: {
    recipient_member_id: number;
    recipient_wallet: string;
    source_transaction_id: number;
    source_wallet: string;
    reward_type: string;
    amount: number;
    currency: string;
    status: string;
    layer_number?: number;
    layer_upgrade_sequence?: number;
    pending_expires_at?: Date;
    notes: string;
  }): Promise<void> {
    const query = `
      INSERT INTO beehive_rewards 
      (recipient_member_id, recipient_wallet, source_transaction_id, source_wallet, 
       reward_type, amount, currency, status, layer_number, layer_upgrade_sequence, 
       pending_expires_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await executeQuery(query, [
      reward.recipient_member_id,
      reward.recipient_wallet,
      reward.source_transaction_id,
      reward.source_wallet,
      reward.reward_type,
      reward.amount,
      reward.currency,
      reward.status,
      reward.layer_number || null,
      reward.layer_upgrade_sequence || null,
      reward.pending_expires_at || null,
      reward.notes
    ]);
    
    // Update BCC count if BCC reward
    if (reward.currency === 'BCC' && reward.status === 'instant') {
      await executeQuery(
        'UPDATE members SET beehive_total_outflow_bcc = beehive_total_outflow_bcc + ? WHERE id = ?',
        [reward.amount, reward.recipient_member_id]
      );
    }
  }
  
  /**
   * Get member stats
   */
  async getMemberStats(walletAddress: string): Promise<any> {
    const query = `
      SELECT 
        m.wallet_address,
        m.beehive_current_level as current_level,
        m.beehive_total_inflow as total_inflow,
        m.beehive_total_outflow_usdt as total_outflow_usdt,
        m.beehive_total_outflow_bcc as total_outflow_bcc,
        m.beehive_direct_sponsor_claimed_count as direct_sponsor_claimed_count,
        (SELECT SUM(amount) FROM beehive_rewards WHERE recipient_wallet = ? AND currency = 'USDT' AND status = 'pending') as pending_usdt,
        (SELECT SUM(amount) FROM beehive_rewards WHERE recipient_wallet = ? AND currency = 'BCC' AND status = 'pending') as pending_bcc
      FROM members m
      WHERE m.wallet_address = ?
    `;
    
    const results = await executeQuery(query, [walletAddress, walletAddress, walletAddress]);
    
    if ((results as any[]).length === 0) {
      return null;
    }
    
    const row = (results as any[])[0];
    return {
      wallet_address: row.wallet_address,
      current_level: row.current_level || 0,
      total_inflow: row.total_inflow || 0,
      total_outflow_usdt: row.total_outflow_usdt || 0,
      total_outflow_bcc: row.total_outflow_bcc || 0,
      pending_usdt: row.pending_usdt || 0,
      pending_bcc: row.pending_bcc || 0,
      direct_sponsor_claimed_count: row.direct_sponsor_claimed_count || 0
    };
  }
  
  /**
   * Get all member stats
   */
  async getAllMemberStats(): Promise<any[]> {
    const query = `
      SELECT 
        m.wallet_address,
        m.beehive_current_level as current_level,
        m.beehive_total_inflow as total_inflow,
        m.beehive_total_outflow_usdt as total_outflow_usdt,
        m.beehive_total_outflow_bcc as total_outflow_bcc,
        m.beehive_direct_sponsor_claimed_count as direct_sponsor_claimed_count,
        (SELECT SUM(amount) FROM beehive_rewards WHERE recipient_wallet = m.wallet_address AND currency = 'USDT' AND status = 'pending') as pending_usdt,
        (SELECT SUM(amount) FROM beehive_rewards WHERE recipient_wallet = m.wallet_address AND currency = 'BCC' AND status = 'pending') as pending_bcc,
        (SELECT SUM(amount) FROM beehive_rewards WHERE recipient_wallet = m.wallet_address AND currency = 'USDT' AND status = 'instant') as earned_usdt,
        (SELECT SUM(amount) FROM beehive_rewards WHERE recipient_wallet = m.wallet_address AND currency = 'BCC' AND status = 'instant') as earned_bcc
      FROM members m
      WHERE m.beehive_current_level > 0 OR m.beehive_total_inflow > 0
      ORDER BY m.beehive_total_outflow_usdt DESC
    `;
    
    const results = await executeQuery(query, []);
    return results as any[];
  }
  
  /**
   * Get rewards for a member
   */
  async getMemberRewards(walletAddress: string): Promise<any[]> {
    const query = `
      SELECT 
        reward_type,
        amount,
        currency,
        status,
        layer_number,
        layer_upgrade_sequence,
        source_wallet,
        pending_expires_at,
        notes,
        created_at
      FROM beehive_rewards
      WHERE recipient_wallet = ?
      ORDER BY created_at DESC
    `;
    
    const results = await executeQuery(query, [walletAddress]);
    return results as any[];
  }
  
  /**
   * Get system stats
   */
  async getSystemStats(): Promise<any> {
    const queries = {
      totalMembers: 'SELECT COUNT(*) as count FROM members WHERE beehive_current_level > 0 OR beehive_total_inflow > 0',
      totalTransactions: 'SELECT COUNT(*) as count FROM beehive_transactions',
      totalInflow: 'SELECT SUM(beehive_total_inflow) as total FROM members',
      totalOutflowUsdt: 'SELECT SUM(beehive_total_outflow_usdt) as total FROM members',
      totalOutflowBcc: 'SELECT SUM(beehive_total_outflow_bcc) as total FROM members',
      totalPendingUsdt: 'SELECT SUM(amount) as total FROM beehive_rewards WHERE currency = "USDT" AND status = "pending"',
      totalPendingBcc: 'SELECT SUM(amount) as total FROM beehive_rewards WHERE currency = "BCC" AND status = "pending"'
    };
    
    const stats: any = {};
    
    for (const [key, query] of Object.entries(queries)) {
      const results = await executeQuery(query, []);
      const value = (results as any[])[0];
      stats[key] = value.count || value.total || 0;
    }
    
    return stats;
  }
}

