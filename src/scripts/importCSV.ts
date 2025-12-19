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
  total_nft_claimed: number | null;
}

interface PlacementCandidate {
  parent_id: number;
  position: number;
  depth: number;
  parent_joined_at: string;
}

export class TreeImporter {
  private members: MemberData[] = [];
  private memberIdMap: Map<string, number> = new Map(); // wallet -> id
  private sponsorIdMap: Map<string, number> = new Map(); // wallet -> id

  async importCSV(filePath: string) {
    console.log('Starting CSV import (full setup mode)...');
    
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

  private removeBOM(str: string): string {
    // Remove BOM (Byte Order Mark) character if present
    return str.replace(/^\uFEFF/, '');
  }

  private getColumnValue(row: any, ...possibleKeys: string[]): string {
    // Try each possible key, handling BOM variations
    for (const key of possibleKeys) {
      // Try exact key
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return String(row[key]);
      }
      // Try with BOM
      const bomKey = '\uFEFF' + key;
      if (row[bomKey] !== undefined && row[bomKey] !== null && row[bomKey] !== '') {
        return String(row[bomKey]);
      }
      // Try keys with BOM removed from row keys
      for (const rowKey of Object.keys(row)) {
        if (this.removeBOM(rowKey) === key && row[rowKey] !== undefined && row[rowKey] !== null && row[rowKey] !== '') {
          return String(row[rowKey]);
        }
      }
    }
    return '';
  }

  private async readCSV(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          // Support both formats: original (wallet_address) and sponsor tree CSV (User Name)
          // Handle BOM character that might be in column names
          const wallet_address = this.getColumnValue(row, 'wallet_address', 'User Name', 'user_name').trim();
          const referrer_wallet = this.getColumnValue(row, 'referrer_wallet', 'Referrer_User Name', 'referrer_user_name', 'Referrer User Name').trim();
          
          if (!wallet_address) {
            console.warn('Skipping row with empty wallet address:', row);
            return;
          }

          const activation_sequence = parseInt(this.getColumnValue(row, 'Activation sequence', 'activation_sequence') || '0');
          const current_level = parseInt(this.getColumnValue(row, 'Current Level', 'current_level') || '1');
          const activation_time = this.getColumnValue(row, 'Activation_time', 'activation_time');
          const total_nft_claimed_str = this.getColumnValue(row, 'Total NFT claim', 'total_nft_claimed');
          const total_nft_claimed = total_nft_claimed_str && total_nft_claimed_str.trim() !== '' 
            ? parseInt(total_nft_claimed_str) 
            : null;

          this.members.push({
            wallet_address,
            referrer_wallet,
            current_level,
            activation_sequence,
            activation_time,
            total_nft_claimed
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });
  }

  private async importMembers(): Promise<void> {
    console.log('Importing members...');
    
    for (const member of this.members) {
      // Parse activation time - handle format like "2025/10/15 0.00" or "2025/10/15 1.03"
      // Format: "YYYY/MM/DD H.MM" where H is hours (0-23) and MM is minutes (00-59)
      let joinedAt: Date;
      try {
        let timeStr = member.activation_time.trim();
        
        if (timeStr.includes('/')) {
          // Parse format: "2025/10/15 0.00" -> "2025-10-15 00:00:00"
          const parts = timeStr.split(/\s+/);
          if (parts.length < 2) {
            throw new Error('Invalid date format');
          }
          
          // Parse date part: "2025/10/15"
          const datePart = parts[0].split('/');
          if (datePart.length !== 3) {
            throw new Error('Invalid date format');
          }
          const [year, month, day] = datePart.map(n => parseInt(n.trim()));
          
          // Parse time part: "0.00" -> hours: 0, minutes: 0
          // "1.03" -> hours: 1, minutes: 3
          // "1.30" -> hours: 1, minutes: 30
          // "0:01" -> hours: 0, minutes: 1
          // "50:37.6" -> minutes: 50, seconds: 37.6
          const timePart = parts[1] || '0.00';
          let hours = 0;
          let minutes = 0;
          let seconds = 0;
          
          if (timePart.includes(':')) {
            // Handle HH:MM or MM:SS format
            const timeComponents = timePart.split(':');
            const firstValue = parseInt(timeComponents[0]) || 0;
            const secondValue = parseFloat(timeComponents[1]) || 0;
            
            // If first value > 23, treat as MM:SS (minutes:seconds)
            if (firstValue > 23) {
              minutes = firstValue;
              seconds = secondValue;
            } else {
              // Treat as HH:MM (hours:minutes)
              hours = firstValue;
              minutes = Math.floor(secondValue);
              seconds = Math.floor((secondValue - minutes) * 60);
            }
          } else if (timePart.includes('.')) {
            // Handle H.MM format (hours.minutes)
            const timeParts = timePart.split('.');
            hours = parseInt(timeParts[0] || '0') || 0;
            minutes = parseInt(timeParts[1] || '0') || 0;
          } else {
            hours = parseInt(timePart) || 0;
          }
          
          // Normalize time values (handle overflow)
          minutes += Math.floor(seconds / 60);
          seconds = seconds % 60;
          hours += Math.floor(minutes / 60);
          minutes = minutes % 60;
          
          // Ensure valid ranges
          const validYear = year || new Date().getFullYear();
          const validMonth = (month >= 1 && month <= 12) ? month : 1;
          const validDay = (day >= 1 && day <= 31) ? day : 1;
          const validHours = Math.floor(hours >= 0 && hours <= 23 ? hours : 0);
          const validMinutes = Math.floor(minutes >= 0 && minutes <= 59 ? minutes : 0);
          const validSeconds = Math.floor(seconds >= 0 && seconds < 60 ? seconds : 0);
          
          // Create date in ISO format: "2025-10-15T00:00:00"
          // MySQL datetime format: "2025-10-15 00:00:00"
          joinedAt = new Date(validYear, validMonth - 1, validDay, validHours, validMinutes, validSeconds);
          
          // Validate the created date
          if (isNaN(joinedAt.getTime())) {
            throw new Error('Invalid date value');
          }
        } else if (timeStr.includes(':')) {
          // Handle time-only format: "50:37.6" (MM:SS.S)
          // Use a base date (today at midnight) and add the time offset
          const baseDate = new Date();
          baseDate.setHours(0, 0, 0, 0);
          
          const timeComponents = timeStr.split(':');
          const firstValue = parseInt(timeComponents[0]) || 0;
          const secondValue = parseFloat(timeComponents[1]) || 0;
          
          // Assume MM:SS format for time-only values
          let minutes = firstValue;
          let seconds = secondValue;
          
          // Normalize (convert overflow to hours)
          const hours = Math.floor(minutes / 60);
          minutes = minutes % 60;
          
          joinedAt = new Date(baseDate);
          joinedAt.setHours(hours, minutes, Math.floor(seconds), Math.floor((seconds % 1) * 1000));
          
          if (isNaN(joinedAt.getTime())) {
            throw new Error('Invalid time-only format');
          }
        } else {
          // Try to parse as standard date string
          joinedAt = new Date(timeStr);
          if (isNaN(joinedAt.getTime())) {
            throw new Error('Invalid date format');
          }
        }
      } catch (error) {
        console.warn(`Error parsing date for ${member.wallet_address}: "${member.activation_time}", using current date. Error: ${error}`);
        joinedAt = new Date();
      }
      
      // Insert new member (full setup mode - always insert)
      const result = await executeQuery(
        'INSERT INTO members (wallet_address, activation_sequence, current_level, total_nft_claimed, joined_at) VALUES (?, ?, ?, ?, ?)',
        [
          member.wallet_address,
          member.activation_sequence,
          member.current_level,
          member.total_nft_claimed,
          joinedAt
        ]
      );
      
      const memberId = (result as any).insertId;
      if (!memberId) {
        console.error(`Failed to get insertId for member ${member.wallet_address}`);
        continue;
      }
      this.memberIdMap.set(member.wallet_address, memberId);
      console.log(`Inserted new member ${member.wallet_address} (ID: ${memberId})`);
      
      // Set root_id and sponsor_id for root member (activation_sequence = 0 or self-referring)
      if (member.activation_sequence === 0 || member.wallet_address === member.referrer_wallet || !member.referrer_wallet) {
        await executeQuery(
          'UPDATE members SET root_id = ? WHERE id = ?',
          [memberId, memberId]
        );
        this.sponsorIdMap.set(member.wallet_address, memberId);
        
        // Create self-reference in closure table for root member
        await executeQuery(
          'INSERT INTO member_closure (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)',
          [memberId, memberId, 0]
        );
      }
    }
    
    console.log('Members imported successfully');
  }

  private async applyPlacementAlgorithm(): Promise<void> {
    console.log('Applying placement algorithm...');
    
    for (const member of this.members) {
      // Skip root member (activation_sequence = 0 or self-referring)
      if (member.activation_sequence === 0 || member.wallet_address === member.referrer_wallet || !member.referrer_wallet) {
        continue;
      }
      
      // Find sponsor ID from maps (full setup mode - sponsor should be in CSV already)
      let sponsorId = this.sponsorIdMap.get(member.referrer_wallet);
      if (!sponsorId) {
        // Try memberIdMap if not in sponsorIdMap yet
        const sponsorIdFromMap = this.memberIdMap.get(member.referrer_wallet);
        if (sponsorIdFromMap) {
          this.sponsorIdMap.set(member.referrer_wallet, sponsorIdFromMap);
          sponsorId = sponsorIdFromMap;
        } else {
          console.error(`Sponsor not found for member ${member.wallet_address}, referrer: ${member.referrer_wallet}`);
          continue;
        }
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
    
    // Phase B: Even spillover (strict breadth-first)
    // Always pick the earliest node in the sponsor's subtree (by depth ASC, joined_at ASC) that has < 3 children.
    // This ensures fill order: A1, A2, A3, then back to A1, A2, A3, ... before going deeper.
    // Get all available slots in sponsor's subtree
    const candidates = await this.getAvailableSlots(sponsorId);
    
    if (candidates.length === 0) {
      console.error(`No available slots for member with activation sequence ${activationSequence}`);
      return null;
    }
    
    // Select the first candidate to enforce BFS fill order
    return candidates[0];
  }

  private async getAvailableSlots(sponsorId: number): Promise<PlacementCandidate[]> {
    // First, ensure sponsor has self-reference in closure table
    await executeQuery(
      'INSERT IGNORE INTO member_closure (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)',
      [sponsorId, sponsorId, 0]
    );
    
    // Get all nodes in sponsor's subtree that have < 3 children
    // Use recursive CTE to find all descendants via placements table as fallback
    // This ensures we find all nodes even if closure table is incomplete
    const query = `
      WITH RECURSIVE sponsor_subtree AS (
        -- Start with sponsor itself
        SELECT id, joined_at, 0 as depth
        FROM members
        WHERE id = ?
        
        UNION ALL
        
        -- Recursively find all children via placements
        SELECT m.id, m.joined_at, st.depth + 1
        FROM members m
        JOIN placements p ON m.id = p.child_id
        JOIN sponsor_subtree st ON p.parent_id = st.id
      )
      SELECT DISTINCT 
        st.id as id,
        st.joined_at as joined_at,
        st.depth as depth,
        (SELECT COUNT(*) FROM placements p WHERE p.parent_id = st.id) as child_count
      FROM sponsor_subtree st
      WHERE (SELECT COUNT(*) FROM placements p WHERE p.parent_id = st.id) < 3
      -- Prioritize shallower nodes first to fully distribute among A1/A2/A3 before deeper levels
      ORDER BY st.depth ASC, child_count ASC, st.joined_at ASC, st.id ASC
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
      // Use JOIN to avoid MySQL error: can't update table while selecting from it
      {
        query: `
          UPDATE members m
          JOIN (SELECT root_id FROM members WHERE id = ?) AS p
          SET m.root_id = p.root_id,
              m.sponsor_id = ?
          WHERE m.id = ?
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
  // Check if a specific file is provided as command line argument
  const args = process.argv.slice(2);
  let csvPath: string | null = null;
  
  if (args.length > 0) {
    // User specified a file
    const userPath = args[0];
    if (fs.existsSync(userPath)) {
      csvPath = userPath;
    } else {
      // Try in csv folder first
      const csvFolderPath = path.join(__dirname, '../../csv/', userPath);
      if (fs.existsSync(csvFolderPath)) {
        csvPath = csvFolderPath;
      } else {
        // Try as relative path from project root
        const relativePath = path.join(__dirname, '../../', userPath);
        if (fs.existsSync(relativePath)) {
          csvPath = relativePath;
        } else {
          console.error(`File not found: ${userPath}\nTip: Place CSV files in the 'csv/' folder`);
          process.exit(1);
        }
      }
    }
  } else {
      // Try multiple possible CSV file names in order (check csv/ folder first, then root)
      const possiblePaths = [
        path.join(__dirname, '../../csv/members.csv'),
        path.join(__dirname, '../../csv/sponsor tree1.0.1.csv'),
        path.join(__dirname, '../../csv/sponsor tree.csv'),
        path.join(__dirname, '../../csv/sponsor_tree.csv'),
        path.join(__dirname, '../../members.csv'),  // Fallback to root
        path.join(__dirname, '../../sponsor tree1.0.1.csv'),
        path.join(__dirname, '../../sponsor tree.csv'),
        path.join(__dirname, '../../sponsor_tree.csv'),
      ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        csvPath = p;
        break;
      }
    }
  }
  
  if (!csvPath) {
    console.error('CSV file not found. Please specify a file:');
    console.error('  npm run import-csv members.csv');
    console.error('  npm run import-csv "sponsor tree.csv"');
    process.exit(1);
  }
  
  console.log(`Importing from: ${csvPath}`);
  const importer = new TreeImporter();
  await importer.importCSV(csvPath);
}

if (require.main === module) {
  main().catch(console.error);
}
