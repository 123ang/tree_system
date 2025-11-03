import { executeQuery } from '../database/connection';

async function checkMembers() {
  console.log('Checking members in database...\n');
  
  // Get total members count
  const totalQuery = 'SELECT COUNT(*) as total FROM members';
  const totalResult = await executeQuery(totalQuery) as any[];
  const totalMembers = totalResult[0].total;
  
  console.log(`📊 Total members in database: ${totalMembers}`);
  
  // Get members in closure table (those actually placed in tree)
  const closureQuery = `
    SELECT COUNT(DISTINCT descendant_id) as total 
    FROM member_closure 
    WHERE ancestor_id = (SELECT id FROM members WHERE activation_sequence = 0 LIMIT 1)
  `;
  const closureResult = await executeQuery(closureQuery) as any[];
  const closureMembers = closureResult[0]?.total || 0;
  
  console.log(`📊 Members in closure table (placed in tree): ${closureMembers}`);
  
  // Get members NOT in closure table
  const missingQuery = `
    SELECT m.id, m.wallet_address, m.activation_sequence, m.sponsor_id
    FROM members m
    LEFT JOIN member_closure mc ON m.id = mc.descendant_id 
      AND mc.ancestor_id = (SELECT id FROM members WHERE activation_sequence = 0 LIMIT 1)
    WHERE mc.descendant_id IS NULL
    ORDER BY m.activation_sequence
  `;
  const missingResult = await executeQuery(missingQuery) as any[];
  
  console.log(`\n❌ Members NOT in tree (${missingResult.length}):`);
  missingResult.forEach((member: any) => {
    console.log(`  - ${member.wallet_address} (ID: ${member.id}, Sequence: ${member.activation_sequence}, Sponsor ID: ${member.sponsor_id})`);
  });
  
  // Get members with missing placements
  const noPlacementQuery = `
    SELECT m.id, m.wallet_address, m.activation_sequence, m.sponsor_id
    FROM members m
    LEFT JOIN placements p ON m.id = p.child_id
    WHERE p.child_id IS NULL AND m.activation_sequence != 0
    ORDER BY m.activation_sequence
  `;
  const noPlacementResult = await executeQuery(noPlacementQuery) as any[];
  
  console.log(`\n⚠️  Members without placements (${noPlacementResult.length}):`);
  noPlacementResult.forEach((member: any) => {
    console.log(`  - ${member.wallet_address} (ID: ${member.id}, Sequence: ${member.activation_sequence}, Sponsor ID: ${member.sponsor_id})`);
  });
  
  // Check for members with invalid referrers
  console.log(`\n🔍 Checking for invalid referrers...`);
  const invalidReferrerQuery = `
    SELECT m.id, m.wallet_address, m.activation_sequence, 
           (SELECT wallet_address FROM members WHERE id = m.sponsor_id) as sponsor_wallet,
           m.sponsor_id
    FROM members m
    WHERE m.sponsor_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM members s WHERE s.id = m.sponsor_id
      )
    ORDER BY m.activation_sequence
  `;
  const invalidReferrerResult = await executeQuery(invalidReferrerQuery) as any[];
  
  if (invalidReferrerResult.length > 0) {
    console.log(`\n❌ Members with invalid sponsor_id (${invalidReferrerResult.length}):`);
    invalidReferrerResult.forEach((member: any) => {
      console.log(`  - ${member.wallet_address} (Sponsor ID ${member.sponsor_id} doesn't exist)`);
    });
  } else {
    console.log('✅ All members have valid sponsor references');
  }
}

if (require.main === module) {
  checkMembers().catch(console.error);
}

export { checkMembers };

