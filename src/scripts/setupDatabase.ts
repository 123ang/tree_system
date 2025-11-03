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

    console.log('\n🎉 Database setup completed successfully!');
    console.log(`\n✅ Database: ${databaseName}`);
    console.log('✅ Tables: members, placements, member_closure');
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

