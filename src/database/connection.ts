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
  // Note: acquireTimeout and timeout are not valid options for mysql2 pool
  // They are removed to prevent warnings
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

export default pool;

// Helper function to execute queries
export const executeQuery = async (query: string, params: any[] = []) => {
  try {
    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
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
