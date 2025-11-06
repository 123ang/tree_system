import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

// Load environment variables
dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'direct_sales_tree',
};

// Helper to execute query without database specified (for creating database)
async function executeQueryWithoutDB(query: string, params: any[] = []) {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
  });
  
  try {
    const [rows] = await connection.execute(query, params);
    return rows;
  } finally {
    await connection.end();
  }
}

// Helper to execute query with database specified
async function executeQueryWithDB(query: string, params: any[] = []) {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
  });
  
  try {
    const [rows] = await connection.execute(query, params);
    return rows;
  } finally {
    await connection.end();
  }
}

/**
 * Setup BeeHive database tables
 * This can be run independently or as part of the main setup
 */
async function setupBeeHive() {
  console.log('Setting up BeeHive database and tables...');
  console.log(`Connecting to MySQL server: ${dbConfig.host}:${dbConfig.port}`);
  console.log(`Target database: ${dbConfig.database}`);
  
  try {
    // Step 1: Test MySQL server connection (without database)
    console.log('\n1️⃣  Testing MySQL server connection...');
    try {
      await executeQueryWithoutDB('SELECT 1');
      console.log('✓ MySQL server connection successful');
    } catch (error: any) {
      throw new Error(
        `Cannot connect to MySQL server. Please check:\n` +
        `1. MySQL server is running\n` +
        `2. Host: ${dbConfig.host}, Port: ${dbConfig.port}\n` +
        `3. User: ${dbConfig.user}, Password: ${dbConfig.password ? '***' : '(empty)'}\n` +
        `Original error: ${error.message}`
      );
    }
    
    // Step 2: Drop and recreate database (fresh start)
    console.log(`\n2️⃣  Dropping database "${dbConfig.database}" if it exists...`);
    try {
      await executeQueryWithoutDB(`DROP DATABASE IF EXISTS \`${dbConfig.database}\``);
      console.log(`✓ Database "${dbConfig.database}" dropped (if it existed)`);
    } catch (error: any) {
      // Ignore errors if database doesn't exist
      if (!error.message.includes("Unknown database")) {
        console.warn(`⚠️  Warning dropping database: ${error.message}`);
      }
    }
    
    console.log(`\n3️⃣  Creating database "${dbConfig.database}"...`);
    try {
      await executeQueryWithoutDB(`CREATE DATABASE \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`✓ Database "${dbConfig.database}" created successfully`);
    } catch (error: any) {
      throw new Error(`Error creating database: ${error.message}`);
    }
    
    // Step 4: Test connection to the database
    console.log(`\n4️⃣  Testing connection to database "${dbConfig.database}"...`);
    try {
      await executeQueryWithDB('SELECT 1');
      console.log('✓ Database connection successful');
    } catch (error: any) {
      throw new Error(`Cannot connect to database "${dbConfig.database}": ${error.message}`);
    }
    
    // Step 5: Create tree structure tables first (required for BeeHive)
    console.log('\n5️⃣  Creating tree structure tables (members, placements, member_closure)...');
    const treeSchemaPath = path.join(__dirname, '../database/schema.sql');
    let membersTableExists = false;
    
    if (fs.existsSync(treeSchemaPath)) {
      const treeSchema = fs.readFileSync(treeSchemaPath, 'utf-8');
      
      // Remove comments
      const schemaWithoutComments = treeSchema
        .split('\n')
        .map(line => {
          const commentIndex = line.indexOf('--');
          if (commentIndex >= 0) {
            return line.substring(0, commentIndex);
          }
          return line;
        })
        .join('\n');
      
      // Split by semicolon and clean up
      const allStatements = schemaWithoutComments
        .split(';')
        .map(s => s.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' '))
        .filter(s => s.length > 10 && !s.startsWith('--'));
      
      // Separate CREATE TABLE and CREATE INDEX statements
      const createTableStatements: string[] = [];
      const createIndexStatements: string[] = [];
      const dropTableStatements: string[] = [];
      
      for (const statement of allStatements) {
        if (statement.match(/^DROP TABLE/i)) {
          dropTableStatements.push(statement);
        } else if (statement.match(/^CREATE TABLE/i)) {
          createTableStatements.push(statement);
        } else if (statement.match(/^CREATE INDEX/i)) {
          createIndexStatements.push(statement);
        }
      }
      
      // Step 5a: Execute DROP TABLE statements first
      for (const statement of dropTableStatements) {
        try {
          await executeQueryWithDB(statement);
          console.log(`✓ Executed: ${statement.substring(0, 50)}...`);
        } catch (error: any) {
          // Ignore errors for DROP TABLE IF EXISTS
          if (!error.message.includes("Unknown table")) {
            console.log(`  (${error.message})`);
          }
        }
      }
      
      // Step 5b: Execute CREATE TABLE statements
      for (const statement of createTableStatements) {
        try {
          await executeQueryWithDB(statement);
          const createTableMatch = statement.match(/CREATE TABLE (\w+)/i);
          if (createTableMatch) {
            const tableName = createTableMatch[1];
            console.log(`✓ Created tree table: ${tableName}`);
            if (tableName === 'members') {
              membersTableExists = true;
            }
          }
        } catch (error: any) {
          if (error.code === 'ER_DUP_ENTRY' || error.message.includes('already exists')) {
            console.log(`  (Table already exists, skipping)`);
            if (statement.includes('CREATE TABLE members')) {
              membersTableExists = true;
            }
            continue;
          }
          console.error(`❌ Error creating tree table: ${error.message}`);
          console.error(`   Statement: ${statement.substring(0, 200)}...`);
          throw error;
        }
      }
      
      // Step 5c: Execute CREATE INDEX statements AFTER all tables are created
      for (const statement of createIndexStatements) {
        try {
          await executeQueryWithDB(statement);
          const createIndexMatch = statement.match(/CREATE INDEX (\w+) ON (\w+)/i);
          if (createIndexMatch) {
            const indexName = createIndexMatch[1];
            const tableName = createIndexMatch[2];
            console.log(`✓ Created index: ${indexName} on ${tableName}`);
          }
        } catch (error: any) {
          if (error.code === 'ER_DUP_KEY_NAME' || error.message.includes('Duplicate key name')) {
            console.log(`  (Index already exists, skipping)`);
            continue;
          }
          console.error(`❌ Error creating index: ${error.message}`);
          console.error(`   Statement: ${statement.substring(0, 200)}...`);
          throw error;
        }
      }
      
      console.log('✅ Tree structure tables created\n');
    } else {
      console.log('⚠️  Tree schema file not found, skipping tree structure creation\n');
      // Check if members table exists anyway
      try {
        const [tables] = await executeQueryWithDB(
          `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'members'`,
          [dbConfig.database]
        ) as any[];
        membersTableExists = Array.isArray(tables) && tables.length > 0;
      } catch (error) {
        // Ignore
      }
    }
    
    // Step 6: Read and execute schema to create BeeHive tables
    console.log('\n6️⃣  Creating BeeHive tables...');
    const schemaPath = path.join(__dirname, '../database/beehive-schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // Members table should exist now (created in step 5), so we can use FK constraints
    if (!membersTableExists) {
      console.log('   ⚠️  Members table not found, removing foreign key constraints...');
      // Remove FK constraints that reference members table
      schema = schema.replace(/,\s*FOREIGN KEY\s*\([^)]+\)\s*REFERENCES\s+members\s*\([^)]+\)[^,)]*/gi, '');
      // Also handle CONSTRAINT named FK constraints
      schema = schema.replace(/,\s*CONSTRAINT\s+\w+\s+FOREIGN KEY\s*\([^)]+\)\s*REFERENCES\s+members\s*\([^)]+\)[^,)]*/gi, '');
    } else {
      console.log('   ✓ Members table exists, using foreign key constraints');
    }
    
    // Remove comments
    const schemaWithoutComments = schema
      .split('\n')
      .map(line => {
        const commentIndex = line.indexOf('--');
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex);
        }
        return line;
      })
      .join('\n');
    
    // Split by semicolon and clean up
    const allBeeHiveStatements = schemaWithoutComments
      .split(';')
      .map(s => s.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' '))
      .filter(s => s.length > 10 && !s.startsWith('--'));
    
    // Separate statements by type
    const beehiveDropStatements: string[] = [];
    const beehiveCreateTableStatements: string[] = [];
    const beehiveCreateIndexStatements: string[] = [];
    const beehiveInsertStatements: string[] = [];
    
    for (const statement of allBeeHiveStatements) {
      if (statement.match(/^DROP TABLE/i)) {
        beehiveDropStatements.push(statement);
      } else if (statement.match(/^CREATE TABLE/i)) {
        beehiveCreateTableStatements.push(statement);
      } else if (statement.match(/^CREATE INDEX/i)) {
        beehiveCreateIndexStatements.push(statement);
      } else if (statement.match(/^INSERT INTO/i)) {
        beehiveInsertStatements.push(statement);
      }
    }
    
    // Step 6a: Execute DROP TABLE statements
    for (const statement of beehiveDropStatements) {
      try {
        await executeQueryWithDB(statement);
        console.log(`✓ Executed: ${statement.substring(0, 50)}...`);
      } catch (error: any) {
        if (!error.message.includes("Unknown table")) {
          console.log(`  (${error.message})`);
        }
      }
    }
    
    // Step 6b: Execute CREATE TABLE statements
    for (const statement of beehiveCreateTableStatements) {
      try {
        await executeQueryWithDB(statement);
        const createTableMatch = statement.match(/CREATE TABLE (\w+)/i);
        if (createTableMatch) {
          const tableName = createTableMatch[1];
          console.log(`✓ Created BeeHive table: ${tableName}`);
        }
      } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY' || error.message.includes('already exists')) {
          console.log(`  (Table already exists, skipping)`);
          continue;
        }
        console.error(`❌ Error creating BeeHive table: ${error.message}`);
        console.error(`   Statement: ${statement.substring(0, 200)}...`);
        throw error;
      }
    }
    
    // Step 6c: Execute CREATE INDEX statements AFTER all tables are created
    for (const statement of beehiveCreateIndexStatements) {
      try {
        await executeQueryWithDB(statement);
        const createIndexMatch = statement.match(/CREATE INDEX (\w+) ON (\w+)/i);
        if (createIndexMatch) {
          const indexName = createIndexMatch[1];
          const tableName = createIndexMatch[2];
          console.log(`✓ Created index: ${indexName} on ${tableName}`);
        }
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEY_NAME' || error.message.includes('Duplicate key name')) {
          console.log(`  (Index already exists, skipping)`);
          continue;
        }
        console.error(`❌ Error creating index: ${error.message}`);
        console.error(`   Statement: ${statement.substring(0, 200)}...`);
        throw error;
      }
    }
    
    // Step 6d: Execute INSERT statements
    for (const statement of beehiveInsertStatements) {
      try {
        await executeQueryWithDB(statement);
        const insertMatch = statement.match(/INSERT INTO (\w+)/i);
        if (insertMatch) {
          const tableName = insertMatch[1];
          console.log(`✓ Inserted data into: ${tableName}`);
        }
      } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`  (Skipping duplicate entry)`);
          continue;
        }
        console.error(`❌ Error inserting data: ${error.message}`);
        console.error(`   Statement: ${statement.substring(0, 200)}...`);
        throw error;
      }
    }
    
    console.log(`\n✅ BeeHive database setup completed successfully!`);
    console.log(`   Database: ${dbConfig.database} (dropped and recreated)`);
    console.log(`   Tree structure tables: members, placements, member_closure`);
    console.log(`   BeeHive tables: ${beehiveCreateTableStatements.length} tables created`);
    console.log(`   BeeHive indexes: ${beehiveCreateIndexStatements.length} indexes created`);
    console.log(`   Inserted data into ${beehiveInsertStatements.length} tables`);
  } catch (error: any) {
    console.error('\n❌ Error setting up BeeHive database:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    await setupBeeHive();
    process.exit(0);
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { setupBeeHive };

