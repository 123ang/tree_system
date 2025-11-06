import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'direct_sales_tree',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000, // 10 seconds
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

export default pool;

// Helper function to execute queries
export const executeQuery = async (query: string, params: any[] = []) => {
  try {
    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error: any) {
    console.error('Database query error:', error);
    
    // Provide helpful error messages for common issues
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      throw new Error(
        `Cannot connect to MySQL database. Please check:\n` +
        `1. MySQL server is running\n` +
        `2. Database credentials in .env file are correct\n` +
        `3. Host: ${dbConfig.host}, Port: ${dbConfig.port}, Database: ${dbConfig.database}\n` +
        `4. Database "${dbConfig.database}" exists\n` +
        `Original error: ${error.message}`
      );
    }
    
    if (error.code === 'ER_BAD_DB_ERROR') {
      throw new Error(
        `Database "${dbConfig.database}" does not exist. Please create it first or check DB_NAME in .env file.`
      );
    }
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      throw new Error(
        `Access denied. Please check database credentials (DB_USER, DB_PASSWORD) in .env file.`
      );
    }
    
    throw error;
  }
};

// Helper function to execute transactions
export const executeTransaction = async (queries: Array<{ query: string; params: any[] }>) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    for (const { query, params } of queries) {
      await connection.execute(query, params);
    }
    
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
