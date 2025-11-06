import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function setupDatabase() {
  console.log('🚀 Starting database setup...\n');

  // Database configuration (without database name for initial connection)
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true // Allow multiple SQL statements
  };

  const databaseName = process.env.DB_NAME || 'direct_sales_tree';

  let connection: mysql.Connection | null = null;

  try {
    // Step 1: Connect to MySQL server (without database)
    console.log('📡 Connecting to MySQL server...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL server\n');

    // Step 2: Drop database if exists
    console.log(`🗑️  Dropping database '${databaseName}' if it exists...`);
    await connection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    console.log('✅ Database dropped (if it existed)\n');

    // Step 3: Create database
    console.log(`📦 Creating database '${databaseName}'...`);
    await connection.query(`CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log('✅ Database created\n');

    // Step 4: Switch to the new database
    await connection.query(`USE \`${databaseName}\``);
    console.log(`📂 Switched to database '${databaseName}'\n`);

    // Step 5: Read and execute schema file
    console.log('📄 Reading schema file...');
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');
    console.log('✅ Schema file loaded\n');

    // Execute the entire schema SQL (it has multiple statements)
    console.log('🔨 Creating tables...');
    try {
      // Execute all statements at once (multipleStatements is enabled)
      await connection.query(schemaSQL);
      console.log('✅ Tables created\n');
    } catch (error: any) {
      // Some errors are expected (like DROP TABLE IF EXISTS when table doesn't exist)
      if (error.message.includes('Unknown table')) {
        console.log('✅ Tables created (some warnings expected)\n');
      } else {
        throw error;
      }
    }

    // Step 6: Close initial connection
    await connection.end();

    // Step 7: Import CSV data
    console.log('📥 Starting CSV import...\n');
    
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
            throw new Error(`CSV file not found: ${userPath}\nTip: Place CSV files in the 'csv/' folder`);
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
      throw new Error('CSV file not found. Please specify a file:\n  npm run setup-db members.csv\n  npm run setup-db "sponsor tree.csv"');
    }

    console.log(`📄 Importing from: ${csvPath}\n`);
    
    // Import CSV using TreeImporter class
    console.log('🔄 Running CSV import...\n');
    
    // Dynamic import of TreeImporter
    const importCSVModule = await import('./importCSV');
    const TreeImporter = importCSVModule.TreeImporter;
    
    if (!TreeImporter) {
      throw new Error('TreeImporter class not found in importCSV module');
    }
    
    // Create instance and import
    const importer = new TreeImporter();
    await importer.importCSV(csvPath);

    // Step 8: Setup BeeHive tables
    console.log('\n🐝 Setting up BeeHive tables...\n');
    try {
      const { setupBeeHive } = await import('./setupBeeHive');
      
      // Create a new connection for BeeHive setup
      const beehiveConnection = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: databaseName,
      });
      
      // Read BeeHive schema
      const beehiveSchemaPath = path.join(__dirname, '../database/beehive-schema.sql');
      if (fs.existsSync(beehiveSchemaPath)) {
        const beehiveSchema = fs.readFileSync(beehiveSchemaPath, 'utf-8');
        
        // Remove FK constraints to members table since members table now exists
        // (We'll keep them since members table exists after tree import)
        
        // Execute BeeHive schema (members table exists now, so FK constraints are OK)
        const beehiveStatements = beehiveSchema
          .split(';')
          .map(s => s.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' '))
          .filter(s => s.length > 10 && !s.startsWith('--'));
        
        for (const statement of beehiveStatements) {
          try {
            await beehiveConnection.query(statement);
            const createMatch = statement.match(/CREATE TABLE (\w+)/i);
            const insertMatch = statement.match(/INSERT INTO (\w+)/i);
            if (createMatch) {
              console.log(`✓ Created BeeHive table: ${createMatch[1]}`);
            } else if (insertMatch) {
              console.log(`✓ Inserted data into: ${insertMatch[1]}`);
            }
          } catch (error: any) {
            if (error.code === 'ER_DUP_ENTRY') {
              continue; // Skip duplicate entries
            }
            throw error;
          }
        }
        
        await beehiveConnection.end();
        console.log('✅ BeeHive tables created\n');
      } else {
        console.log('⚠️  BeeHive schema file not found, skipping BeeHive setup\n');
      }
    } catch (error: any) {
      console.error('⚠️  Warning: Could not setup BeeHive tables:', error.message);
      console.log('   You can run BeeHive setup separately later\n');
    }

    console.log('\n🎉 Database setup completed successfully!');
    console.log(`\n✅ Database: ${databaseName}`);
    console.log('✅ Tree structure tables: members, placements, member_closure');
    console.log('✅ BeeHive tables: beehive_levels, beehive_transactions, beehive_rewards, beehive_layer_counters');
    console.log('   (BeeHive fields are now in members table: beehive_current_level, beehive_total_inflow, etc.)');
    console.log(`✅ CSV imported: ${path.basename(csvPath)}`);

  } catch (error) {
    console.error('\n❌ Error during database setup:', error);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupDatabase().catch(console.error);
}

export { setupDatabase };

