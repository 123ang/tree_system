import { executeQuery } from '../database/connection';
import { Member, MemberWithChildren, TreeStructure } from '../models/Member';

export class TreeService {
  
  async getMemberByWallet(walletAddress: string): Promise<Member | null> {
    const query = `
      SELECT * FROM members 
      WHERE wallet_address = ?
    `;
    
    const results = await executeQuery(query, [walletAddress]);
    const members = results as Member[];
    
    return members.length > 0 ? members[0] : null;
  }

  async getMemberById(id: number): Promise<Member | null> {
    const query = `
      SELECT * FROM members 
      WHERE id = ?
    `;
    
    const results = await executeQuery(query, [id]);
    const members = results as Member[];
    
    return members.length > 0 ? members[0] : null;
  }

  async searchMembers(searchTerm: string): Promise<Member[]> {
    const query = `
      SELECT * FROM members 
      WHERE wallet_address LIKE ? OR username LIKE ?
      ORDER BY activation_sequence ASC
      LIMIT 50
    `;
    
    const searchPattern = `%${searchTerm}%`;
    const results = await executeQuery(query, [searchPattern, searchPattern]);
    
    return results as Member[];
  }

  async getTreeStructure(memberId: number, maxDepth: number = 3): Promise<TreeStructure | null> {
    console.log(`Getting tree structure for member ${memberId} with maxDepth ${maxDepth}`);
    
    // Get the member
    const member = await this.getMemberById(memberId);
    if (!member) {
      console.log(`Member ${memberId} not found`);
      return null;
    }

    console.log(`Found member: ${member.wallet_address}`);

    // For very large depths, use a more efficient approach
    const actualMaxDepth = maxDepth >= 999 ? 100 : maxDepth; // Cap at 100 for performance

    // Get tree structure using closure table - simplified approach
    // First, check if closure table has entries for this member
    const closureCheckQuery = `
      SELECT COUNT(*) as count FROM member_closure WHERE ancestor_id = ?
    `;
    const closureCheck = await executeQuery(closureCheckQuery, [memberId]);
    const hasClosureEntries = (closureCheck as any)[0]?.count > 0;

    console.log(`Closure entries for member ${memberId}: ${hasClosureEntries}`);

    let query: string;
    let queryParams: any[];

    if (hasClosureEntries) {
      // Use closure table if available
      query = `
        SELECT 
          m.id,
          m.wallet_address,
          m.sponsor_id,
          m.activation_sequence,
          m.total_nft_claimed,
          p.position,
          mc.depth
        FROM members m
        JOIN member_closure mc ON m.id = mc.descendant_id
        LEFT JOIN placements p ON m.id = p.child_id
        WHERE mc.ancestor_id = ? 
          AND mc.depth <= ?
        ORDER BY mc.depth, p.position, m.activation_sequence
        LIMIT 10000
      `;
      queryParams = [memberId, actualMaxDepth];
    } else {
      // Fallback: Get root member and its direct children using placements
      query = `
        SELECT 
          m.id,
          m.wallet_address,
          m.sponsor_id,
          m.activation_sequence,
          m.total_nft_claimed,
          p.position,
          CASE 
            WHEN m.id = ? THEN 0
            ELSE 1
          END as depth
        FROM members m
        LEFT JOIN placements p ON m.id = p.child_id
        WHERE m.id = ? OR p.parent_id = ?
        ORDER BY depth, p.position, m.activation_sequence
        LIMIT 10000
      `;
      queryParams = [memberId, memberId, memberId];
    }

    console.log(`Executing query with memberId: ${memberId}, maxDepth: ${actualMaxDepth}`);
    const results = await executeQuery(query, queryParams);
    const nodes = results as any[];

    console.log(`Query returned ${nodes.length} nodes`);

    if (nodes.length === 0) {
      console.log('No nodes found in tree structure');
      // Return at least the root member even if no children
      return {
        id: member.id,
        wallet_address: member.wallet_address,
        children: [],
        depth: 0,
        sponsor_id: member.sponsor_id || undefined,
        activation_sequence: member.activation_sequence || undefined,
        total_nft_claimed: member.total_nft_claimed || undefined
      };
    }

    // Build tree structure
    const nodeMap = new Map<number, TreeStructure>();
    
    // Create all nodes first
    for (const node of nodes) {
      const treeNode: TreeStructure = {
        id: node.id,
        wallet_address: node.wallet_address,
        children: [],
        position: node.position,
        depth: node.depth,
        sponsor_id: node.sponsor_id,
        activation_sequence: node.activation_sequence,
        total_nft_claimed: node.total_nft_claimed
      };
      
      nodeMap.set(node.id, treeNode);
    }

    console.log(`Created ${nodeMap.size} nodes in nodeMap`);

    // Build parent-child relationships
    for (const node of nodes) {
      if (node.depth === 0) continue; // Skip root node
      
      // Find parent
      const parentQuery = `
        SELECT parent_id FROM placements WHERE child_id = ?
      `;
      const parentResults = await executeQuery(parentQuery, [node.id]);
      const parentId = (parentResults as any)[0]?.parent_id;
      
      if (parentId && nodeMap.has(parentId)) {
        nodeMap.get(parentId)!.children.push(nodeMap.get(node.id)!);
      }
    }

    // Find and return root node
    const rootNode = Array.from(nodeMap.values()).find(node => node.depth === 0);
    console.log(`Root node found: ${rootNode ? 'Yes' : 'No'}`);
    
    if (rootNode) {
      console.log(`Root node has ${rootNode.children.length} children`);
    }
    
    return rootNode || null;
  }

  async getSubtreeStats(memberId: number): Promise<{
    totalMembers: number;
    directChildren: number;
    maxDepth: number;
    levels: { [depth: number]: number };
  }> {
    // Get total members in subtree
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM member_closure
      WHERE ancestor_id = ?
    `;
    const totalResults = await executeQuery(totalQuery, [memberId]);
    const totalMembers = (totalResults as any)[0].total;

    // Get direct children count
    const directQuery = `
      SELECT COUNT(*) as direct
      FROM placements
      WHERE parent_id = ?
    `;
    const directResults = await executeQuery(directQuery, [memberId]);
    const directChildren = (directResults as any)[0].direct;

    // Get depth distribution
    const depthQuery = `
      SELECT depth, COUNT(*) as count
      FROM member_closure
      WHERE ancestor_id = ?
      GROUP BY depth
      ORDER BY depth
    `;
    const depthResults = await executeQuery(depthQuery, [memberId]);
    const levels: { [depth: number]: number } = {};
    let maxDepth = 0;

    for (const row of depthResults as any[]) {
      levels[row.depth] = row.count;
      maxDepth = Math.max(maxDepth, row.depth);
    }

    return {
      totalMembers,
      directChildren,
      maxDepth,
      levels
    };
  }

  async getMembersByLevel(rootId: number, level: number, limit: number = 100, offset: number = 0): Promise<Member[]> {
    const query = `
      SELECT m.*, p.position
      FROM members m
      JOIN member_closure mc ON m.id = mc.descendant_id
      LEFT JOIN placements p ON m.id = p.child_id
      WHERE mc.ancestor_id = ? AND mc.depth = ?
      ORDER BY p.position ASC, m.activation_sequence ASC
      LIMIT ? OFFSET ?
    `;

    const results = await executeQuery(query, [rootId, level, limit, offset]);
    return results as Member[];
  }
}
