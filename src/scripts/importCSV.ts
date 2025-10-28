import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
import { executeQuery, executeTransaction } from '../database/connection';

interface MemberData {
  wallet_address: string;
  referrer_wallet: string;
  current_level: number;
  activation_sequence: number;
  activation_time: string;
  total_nft_claimed: number;
}

interface PlacementCandidate {
  parent_id: number;
  position: number;
  depth: number;
  parent_joined_at: string;
}

class TreeImporter {
  private members: MemberData[] = [];
  private memberIdMap: Map<string, number> = new Map(); // wallet -> id
  private sponsorIdMap: Map<string, number> = new Map(); // wallet -> id

  async importCSV(filePath: string) {
    console.log('Starting CSV import...');
    
    // Read and parse CSV
    await this.readCSV(filePath);
    
    // Sort by activation_sequence
    this.members.sort((a, b) => a.activation_sequence - b.activation_sequence);
    
    console.log(`Found ${this.members.length} members to import`);
    
    // Import members first
    await this.importMembers();
    
    // Apply placement algorithm
    await this.applyPlacementAlgorithm();
    
    console.log('CSV import completed successfully!');
  }

  private async readCSV(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          this.members.push({
            wallet_address: row.wallet_address,
            referrer_wallet: row.referrer_wallet,
            current_level: parseInt(row.current_level),
            activation_sequence: parseInt(row.activation_sequence),
            activation_time: row.activation_time,
            total_nft_claimed: parseInt(row.total_nft_claimed)
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });
  }

  private async importMembers(): Promise<void> {
    console.log('Importing members...');
    
    for (const member of this.members) {
      const result = await executeQuery(
        'INSERT INTO members (wallet_address, activation_sequence, current_level, total_nft_claimed, joined_at) VALUES (?, ?, ?, ?, ?)',
        [
          member.wallet_address,
          member.activation_sequence,
          member.current_level,
          member.total_nft_claimed,
          new Date(member.activation_time)
        ]
      );
      
      const memberId = (result as any).insertId;
      this.memberIdMap.set(member.wallet_address, memberId);
      
      // Set root_id for the first member (self-referring)
      if (member.wallet_address === member.referrer_wallet) {
        await executeQuery(
          'UPDATE members SET root_id = ? WHERE id = ?',
          [memberId, memberId]
        );
        this.sponsorIdMap.set(member.wallet_address, memberId);
      }
    }
    
    console.log('Members imported successfully');
  }

  private async applyPlacementAlgorithm(): Promise<void> {
    console.log('Applying placement algorithm...');
    
    for (const member of this.members) {
      if (member.wallet_address === member.referrer_wallet) {
        // Root member - skip placement
        continue;
      }
      
      const sponsorId = this.sponsorIdMap.get(member.referrer_wallet);
      if (!sponsorId) {
        console.error(`Sponsor not found for member ${member.wallet_address}`);
        continue;
      }
      
      const memberId = this.memberIdMap.get(member.wallet_address);
      if (!memberId) {
        console.error(`Member ID not found for ${member.wallet_address}`);
        continue;
      }
      
      // Apply placement algorithm
      const placement = await this.findPlacement(sponsorId, member.activation_sequence);
      
      if (placement) {
        await this.placeMember(memberId, placement.parent_id, placement.position, sponsorId);
        this.sponsorIdMap.set(member.wallet_address, memberId);
      }
    }
    
    console.log('Placement algorithm completed');
  }

  private async findPlacement(sponsorId: number, activationSequence: number): Promise<PlacementCandidate | null> {
    // Phase A: Check if sponsor has < 3 children
    const directChildren = await executeQuery(
      'SELECT COUNT(*) as count FROM placements WHERE parent_id = ?',
      [sponsorId]
    );
    
    const directCount = (directChildren as any)[0].count;
    
    if (directCount < 3) {
      // Place directly under sponsor
      return {
        parent_id: sponsorId,
        position: directCount + 1,
        depth: 0,
        parent_joined_at: new Date().toISOString()
      };
    }
    
    // Phase B: Even spillover (round-robin)
    const referralsBefore = activationSequence - 1; // 0-based
    const k = referralsBefore - 3 + 1; // 1-based position in spillover
    
    // Get all available slots in sponsor's subtree
    const candidates = await this.getAvailableSlots(sponsorId);
    
    if (candidates.length === 0) {
      console.error(`No available slots for member with activation sequence ${activationSequence}`);
      return null;
    }
    
    // Round-robin selection
    const selectedIndex = (k - 1) % candidates.length;
    return candidates[selectedIndex];
  }

  private async getAvailableSlots(sponsorId: number): Promise<PlacementCandidate[]> {
    // Get all nodes in sponsor's subtree that have < 3 children
    const query = `
      SELECT DISTINCT m.id, m.joined_at, 
             (SELECT COUNT(*) FROM placements p WHERE p.parent_id = m.id) as child_count,
             mc.depth
      FROM members m
      JOIN member_closure mc ON m.id = mc.descendant_id
      WHERE mc.ancestor_id = ? 
        AND (SELECT COUNT(*) FROM placements p WHERE p.parent_id = m.id) < 3
      ORDER BY mc.depth ASC, m.joined_at ASC, m.id ASC
    `;
    
    const results = await executeQuery(query, [sponsorId]);
    const slots: PlacementCandidate[] = [];
    
    for (const row of results as any[]) {
      const childCount = row.child_count;
      const parentId = row.id;
      const depth = row.depth;
      const parentJoinedAt = row.joined_at;
      
      // Get existing positions for this parent to avoid duplicates
      const existingPositions = await executeQuery(
        'SELECT position FROM placements WHERE parent_id = ?',
        [parentId]
      );
      const usedPositions = new Set((existingPositions as any[]).map(p => p.position));
      
      // Create slots for each available position
      for (let position = 1; position <= 3; position++) {
        if (!usedPositions.has(position)) {
          slots.push({
            parent_id: parentId,
            position,
            depth,
            parent_joined_at: parentJoinedAt
          });
        }
      }
    }
    
    return slots;
  }

  private async placeMember(memberId: number, parentId: number, position: number, sponsorId: number): Promise<void> {
    // Check if position is already taken and find next available
    const existingPlacement = await executeQuery(
      'SELECT child_id FROM placements WHERE parent_id = ? AND position = ?',
      [parentId, position]
    );
    
    if ((existingPlacement as any[]).length > 0) {
      // Find next available position
      for (let pos = 1; pos <= 3; pos++) {
        const checkPos = await executeQuery(
          'SELECT child_id FROM placements WHERE parent_id = ? AND position = ?',
          [parentId, pos]
        );
        if ((checkPos as any[]).length === 0) {
          position = pos;
          break;
        }
      }
    }

    const queries = [
      // Insert placement
      {
        query: 'INSERT INTO placements (parent_id, child_id, position) VALUES (?, ?, ?)',
        params: [parentId, memberId, position]
      },
      // Add self-link to closure table
      {
        query: 'INSERT INTO member_closure (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)',
        params: [memberId, memberId, 0]
      },
      // Add ancestors to closure table
      {
        query: `
          INSERT INTO member_closure (ancestor_id, descendant_id, depth)
          SELECT ancestor_id, ?, depth + 1
          FROM member_closure
          WHERE descendant_id = ?
        `,
        params: [memberId, parentId]
      },
      // Update member's root_id and sponsor_id
      {
        query: `
          UPDATE members 
          SET root_id = (SELECT root_id FROM members WHERE id = ?),
              sponsor_id = ?
          WHERE id = ?
        `,
        params: [parentId, sponsorId, memberId]
      }
    ];
    
    try {
      await executeTransaction(queries);
      console.log(`Successfully placed member ${memberId} under parent ${parentId} at position ${position}`);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.warn(`Duplicate entry detected for member ${memberId}, retrying with different position...`);
        // Try with position 1, 2, or 3 in order
        for (let pos = 1; pos <= 3; pos++) {
          try {
            queries[0].params[2] = pos; // Update position
            await executeTransaction(queries);
            console.log(`Successfully placed member ${memberId} at position ${pos}`);
            return;
          } catch (retryError: any) {
            if (retryError.code !== 'ER_DUP_ENTRY') {
              throw retryError;
            }
          }
        }
        throw new Error(`Could not place member ${memberId} - all positions taken`);
      }
      throw error;
    }
  }
}

// Main execution
async function main() {
  const csvPath = path.join(__dirname, '../../members.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('members.csv file not found in project root');
    process.exit(1);
  }
  
  const importer = new TreeImporter();
  await importer.importCSV(csvPath);
}

if (require.main === module) {
  main().catch(console.error);
}
