import { executeQuery } from '../database/connection';
import { Member } from '../models/Member';

export class MemberService {
  
  async createMember(memberData: {
    wallet_address: string;
    username?: string;
    sponsor_id?: number;
    activation_sequence?: number;
    current_level?: number;
    total_nft_claimed?: number;
  }): Promise<Member> {
    try {
      // Insert member
      const insertQuery = `
        INSERT INTO members (wallet_address, username, sponsor_id, activation_sequence, current_level, total_nft_claimed)
        VALUES ('${memberData.wallet_address}', ${memberData.username ? `'${memberData.username}'` : 'NULL'}, ${memberData.sponsor_id || 'NULL'}, ${memberData.activation_sequence || 'NULL'}, ${memberData.current_level || 'NULL'}, ${memberData.total_nft_claimed || 'NULL'})
      `;
      
      const result = await executeQuery(insertQuery);
      const memberId = (result as any).insertId;
      
      // Set root_id to self if no sponsor (root member)
      const rootId = memberData.sponsor_id || memberId;
      
      // Update root_id
      await executeQuery(
        `UPDATE members SET root_id = ${rootId} WHERE id = ${memberId}`
      );
      
      // If there's a sponsor, place the member in the tree
      if (memberData.sponsor_id) {
        await this.placeMemberInTree(memberId, memberData.sponsor_id);
      }
      
      // Update closure table
      await this.updateClosureTable(memberId, rootId);
      
      // Return the created member
      const createdMember = await this.getMemberById(memberId);
      return createdMember!;
      
    } catch (error) {
      console.error('Error creating member:', error);
      throw error;
    }
  }
  
  async updateMember(id: number, updateData: {
    username?: string;
    sponsor_id?: number;
    activation_sequence?: number;
    current_level?: number;
    total_nft_claimed?: number;
  }): Promise<Member> {
    try {
      // Get current member data
      const currentMember = await this.getMemberById(id);
      if (!currentMember) {
        throw new Error('Member not found');
      }
      
      // Build update query dynamically
      const updateFields = [];
      if (updateData.username !== undefined) {
        updateFields.push(`username = '${updateData.username}'`);
      }
      if (updateData.sponsor_id !== undefined) {
        updateFields.push(`sponsor_id = ${updateData.sponsor_id || 'NULL'}`);
      }
      if (updateData.activation_sequence !== undefined) {
        updateFields.push(`activation_sequence = ${updateData.activation_sequence || 'NULL'}`);
      }
      if (updateData.current_level !== undefined) {
        updateFields.push(`current_level = ${updateData.current_level || 'NULL'}`);
      }
      if (updateData.total_nft_claimed !== undefined) {
        updateFields.push(`total_nft_claimed = ${updateData.total_nft_claimed || 'NULL'}`);
      }
      
      if (updateFields.length > 0) {
        const updateQuery = `UPDATE members SET ${updateFields.join(', ')} WHERE id = ${id}`;
        await executeQuery(updateQuery);
      }
      
      // If sponsor changed, update tree placement
      if (updateData.sponsor_id !== undefined && updateData.sponsor_id !== currentMember.sponsor_id) {
        // Remove from old placement
        await executeQuery(`DELETE FROM placements WHERE child_id = ${id}`);
        
        // Add to new placement if sponsor exists
        if (updateData.sponsor_id) {
          await this.placeMemberInTree(id, updateData.sponsor_id);
        }
        
        // Update closure table
        const rootId = updateData.sponsor_id || id;
        await this.updateClosureTable(id, rootId);
      }
      
      // Return updated member
      const updatedMember = await this.getMemberById(id);
      return updatedMember!;
      
    } catch (error) {
      console.error('Error updating member:', error);
      throw error;
    }
  }
  
  async deleteMember(id: number): Promise<boolean> {
    try {
      // Check if member has children
      const childrenQuery = `SELECT COUNT(*) as count FROM placements WHERE parent_id = ${id}`;
      const childrenResult = await executeQuery(childrenQuery);
      const hasChildren = (childrenResult as any)[0].count > 0;
      
      if (hasChildren) {
        throw new Error('Cannot delete member with children. Please reassign or delete children first.');
      }
      
      // Remove from placements
      await executeQuery(`DELETE FROM placements WHERE child_id = ${id}`);
      
      // Remove from closure table
      await executeQuery(`DELETE FROM member_closure WHERE ancestor_id = ${id} OR descendant_id = ${id}`);
      
      // Delete member
      await executeQuery(`DELETE FROM members WHERE id = ${id}`);
      
      return true;
      
    } catch (error) {
      console.error('Error deleting member:', error);
      throw error;
    }
  }
  
  async getAllMembers(limit: number = 100, offset: number = 0): Promise<Member[]> {
    const query = `
      SELECT m.*, 
             s.wallet_address as sponsor_wallet,
             p.position,
             (SELECT COUNT(*) FROM placements WHERE parent_id = m.id) as children_count
      FROM members m
      LEFT JOIN members s ON m.sponsor_id = s.id
      LEFT JOIN placements p ON m.id = p.child_id
      ORDER BY m.activation_sequence ASC, m.id ASC
      LIMIT ? OFFSET ?
    `;
    
    const results = await executeQuery(query, [limit, offset]);
    return results as Member[];
  }
  
  async getMemberById(id: number): Promise<Member | null> {
    const query = `
      SELECT m.*, 
             s.wallet_address as sponsor_wallet,
             p.position,
             (SELECT COUNT(*) FROM placements WHERE parent_id = m.id) as children_count
      FROM members m
      LEFT JOIN members s ON m.sponsor_id = s.id
      LEFT JOIN placements p ON m.id = p.child_id
      WHERE m.id = ?
    `;
    
    const results = await executeQuery(query, [id]);
    const members = results as Member[];
    
    return members.length > 0 ? members[0] : null;
  }
  
  async getMemberByWallet(walletAddress: string): Promise<Member | null> {
    const query = `
      SELECT m.*, 
             s.wallet_address as sponsor_wallet,
             p.position,
             (SELECT COUNT(*) FROM placements WHERE parent_id = m.id) as children_count
      FROM members m
      LEFT JOIN members s ON m.sponsor_id = s.id
      LEFT JOIN placements p ON m.id = p.child_id
      WHERE m.wallet_address = ?
    `;
    
    const results = await executeQuery(query, [walletAddress]);
    const members = results as Member[];
    
    return members.length > 0 ? members[0] : null;
  }

  async getRootMember(): Promise<Member | null> {
    // Get the member with activation_sequence = 0, or where root_id = id (self-referring root)
    const query = `
      SELECT m.*, 
             s.wallet_address as sponsor_wallet,
             p.position,
             (SELECT COUNT(*) FROM placements WHERE parent_id = m.id) as children_count
      FROM members m
      LEFT JOIN members s ON m.sponsor_id = s.id
      LEFT JOIN placements p ON m.id = p.child_id
      WHERE (m.activation_sequence = 0 OR (m.root_id = m.id))
      ORDER BY m.activation_sequence ASC, m.id ASC
      LIMIT 1
    `;
    
    const results = await executeQuery(query);
    const members = results as Member[];
    
    return members.length > 0 ? members[0] : null;
  }
  
  async getMemberLayerInfo(memberId: number): Promise<{
    layer: number;
    sponsorChain: Member[];
    rootDistance: number;
    isRoot: boolean;
  }> {
    // Get member's layer from root
    const layerQuery = `
      SELECT mc.depth as layer
      FROM member_closure mc
      WHERE mc.descendant_id = ? AND mc.ancestor_id = mc.descendant_id
    `;
    
    const layerResult = await executeQuery(layerQuery, [memberId]);
    const layer = (layerResult as any)[0]?.layer || 0;
    
    // Get sponsor chain
    const sponsorChainQuery = `
      WITH RECURSIVE sponsor_chain AS (
        SELECT m.id, m.wallet_address, m.username, m.sponsor_id, 0 as level
        FROM members m
        WHERE m.id = ?
        
        UNION ALL
        
        SELECT m.id, m.wallet_address, m.username, m.sponsor_id, sc.level + 1
        FROM members m
        JOIN sponsor_chain sc ON m.id = sc.sponsor_id
        WHERE sc.level < 10
      )
      SELECT * FROM sponsor_chain ORDER BY level DESC
    `;
    
    const sponsorChainResult = await executeQuery(sponsorChainQuery, [memberId]);
    const sponsorChain = sponsorChainResult as Member[];
    
    // Check if member is root
    const isRoot = sponsorChain.length === 1 && sponsorChain[0].id === memberId;
    
    return {
      layer,
      sponsorChain,
      rootDistance: sponsorChain.length - 1,
      isRoot
    };
  }
  
  private async placeMemberInTree(childId: number, parentId: number): Promise<void> {
    // Find available position (1, 2, or 3)
    const positionQuery = `
      SELECT COALESCE(MAX(position), 0) + 1 as next_position
      FROM placements 
      WHERE parent_id = ${parentId}
    `;
    
    const positionResult = await executeQuery(positionQuery);
    const position = Math.min((positionResult as any)[0].next_position, 3);
    
    if (position > 3) {
      throw new Error('Parent already has 3 children. Cannot add more.');
    }
    
    // Insert placement
    await executeQuery(
      `INSERT INTO placements (parent_id, child_id, position) VALUES (${parentId}, ${childId}, ${position})`
    );
  }
  
  private async updateClosureTable(memberId: number, rootId: number): Promise<void> {
    try {
      // Remove old closure entries
      await executeQuery(`DELETE FROM member_closure WHERE descendant_id = ${memberId}`);
      
      // Add self-reference
      await executeQuery(
        `INSERT INTO member_closure (ancestor_id, descendant_id, depth) VALUES (${memberId}, ${memberId}, 0)`
      );
      
      // For now, just add basic relationships
      // This can be enhanced later with more complex tree traversal
      console.log(`Updated closure table for member ${memberId}`);
    } catch (error) {
      console.error('Error updating closure table:', error);
      // Don't throw error to avoid breaking member creation
    }
  }
  
}
