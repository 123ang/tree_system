import { executeQuery } from '../database/connection';

async function checkTree() {
  console.log('Checking tree structure...\n');
  
  // Check root member
  const rootQuery = 'SELECT id, wallet_address, activation_sequence FROM members WHERE activation_sequence = 0 OR root_id = id LIMIT 1';
  const rootResult = await executeQuery(rootQuery);
  const root = (rootResult as any)[0];
  
  if (!root) {
    console.log('No root member found!');
    return;
  }
  
  console.log(`Root Member: ID ${root.id}, Wallet: ${root.wallet_address}, Activation Sequence: ${root.activation_sequence}`);
  
  // Check direct children of root
  const childrenQuery = `
    SELECT p.child_id, p.position, m.wallet_address, m.activation_sequence
    FROM placements p
    JOIN members m ON p.child_id = m.id
    WHERE p.parent_id = ?
    ORDER BY p.position
  `;
  const children = await executeQuery(childrenQuery, [root.id]) as any[];
  
  console.log(`\nDirect children of root (should be up to 3 for a 3-wide tree):`);
  console.log(`Found ${children.length} direct children:\n`);
  
  children.forEach((child, index) => {
    console.log(`  Position ${child.position}: ID ${child.child_id}, Wallet: ${child.wallet_address}, Activation: ${child.activation_sequence}`);
  });
  
  // Check members that have root as referrer
  const referrerQuery = `
    SELECT id, wallet_address, activation_sequence
    FROM members
    WHERE sponsor_id = ? OR wallet_address IN (
      SELECT User_Name FROM (SELECT 'BHKKPG3' as User_Name) as t
    )
    ORDER BY activation_sequence
  `;
  
  // Check closure table
  const closureQuery = `
    SELECT COUNT(*) as count, MAX(depth) as max_depth
    FROM member_closure
    WHERE ancestor_id = ?
  `;
  const closureResult = await executeQuery(closureQuery, [root.id]) as any[];
  const closureInfo = closureResult[0];
  
  console.log(`\nClosure table info:`);
  console.log(`  Total descendants: ${closureInfo.count}`);
  console.log(`  Max depth: ${closureInfo.max_depth}`);
  
  // Check all placements count
  const totalPlacements = await executeQuery('SELECT COUNT(*) as count FROM placements') as any[];
  console.log(`\nTotal placements in database: ${totalPlacements[0].count}`);
}

checkTree().then(() => {
  console.log('\nCheck complete!');
  process.exit(0);
}).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});


