import { Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import multer from 'multer';
import fs from 'fs';

// Configure multer for CSV file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectRoot = path.join(__dirname, '..', '..');
    const csvFolder = path.join(projectRoot, 'csv');
    
    // Create csv folder if it doesn't exist
    if (!fs.existsSync(csvFolder)) {
      fs.mkdirSync(csvFolder, { recursive: true });
    }
    
    cb(null, csvFolder);
  },
  filename: (req, file, cb) => {
    // Keep original filename, sanitize it
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, sanitized);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept CSV files
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

export const uploadCSV = upload.single('csvFile');

export class DatabaseController {
  /**
   * Run full database setup (drop, create, schema, import CSV)
   */
  async setupDatabase(req: Request, res: Response) {
    try {
      const { csvFile } = req.body;
      
      if (!csvFile) {
        return res.status(400).json({ error: 'CSV file name is required' });
      }

      // Set headers for streaming response
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');

      // Send initial response
      res.write(JSON.stringify({ status: 'started', message: 'Starting database setup...\n' }) + '\n');

      const scriptPath = path.join(__dirname, '..', 'scripts', 'setupDatabase.ts');
      // Use full path to CSV file to avoid issues with spaces in filename
      const projectRoot = path.join(__dirname, '..', '..');
      const csvFolder = path.join(projectRoot, 'csv');
      const fs = require('fs');
      
      // Check if file exists in csv folder first, then project root
      let csvPath = path.join(csvFolder, csvFile);
      if (!fs.existsSync(csvPath)) {
        csvPath = path.join(projectRoot, csvFile);
      }
      
      // Build command string with proper quoting for Windows
      const command = `npx ts-node "${scriptPath}" "${csvPath}"`;
      
      const tsNode = spawn(command, [], {
        cwd: projectRoot,
        shell: true
      });

      let output = '';
      let hasError = false;

      tsNode.stdout.on('data', (data) => {
        const message = data.toString();
        output += message;
        res.write(JSON.stringify({ status: 'progress', message }) + '\n');
      });

      tsNode.stderr.on('data', (data) => {
        const message = data.toString();
        output += message;
        res.write(JSON.stringify({ status: 'error', message }) + '\n');
        hasError = true;
      });

      tsNode.on('close', (code) => {
        if (code === 0 && !hasError) {
          res.write(JSON.stringify({ 
            status: 'completed', 
            message: '\n✅ Database setup completed successfully!',
            output 
          }) + '\n');
        } else {
          res.write(JSON.stringify({ 
            status: 'failed', 
            message: `\n❌ Database setup failed with code ${code}`,
            output 
          }) + '\n');
        }
        
        // Ensure response is properly ended
        setTimeout(() => {
          res.end();
        }, 100); // Small delay to ensure final message is sent
      });

      tsNode.on('error', (error) => {
        res.write(JSON.stringify({ 
          status: 'failed', 
          message: `Error: ${error.message}`,
          output 
        }) + '\n');
        res.end();
      });

    } catch (error: any) {
      console.error('Error in setupDatabase:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Import CSV only (without destroying database)
   */
  async importCSV(req: Request, res: Response) {
    try {
      const { csvFile } = req.body;
      
      if (!csvFile) {
        return res.status(400).json({ error: 'CSV file name is required' });
      }

      // Set headers for streaming response
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');

      // Send initial response
      res.write(JSON.stringify({ status: 'started', message: 'Starting CSV import...\n' }) + '\n');

      const scriptPath = path.join(__dirname, '..', 'scripts', 'importCSVOnly.ts');
      // Use full path to CSV file to avoid issues with spaces in filename
      const projectRoot = path.join(__dirname, '..', '..');
      const csvFolder = path.join(projectRoot, 'csv');
      const fs = require('fs');
      
      // Check if file exists in csv folder first, then project root
      let csvPath = path.join(csvFolder, csvFile);
      if (!fs.existsSync(csvPath)) {
        csvPath = path.join(projectRoot, csvFile);
      }
      
      // Build command string with proper quoting for Windows
      const command = `npx ts-node "${scriptPath}" "${csvPath}"`;
      
      const tsNode = spawn(command, [], {
        cwd: projectRoot,
        shell: true
      });

      let output = '';
      let hasError = false;

      tsNode.stdout.on('data', (data) => {
        const message = data.toString();
        output += message;
        res.write(JSON.stringify({ status: 'progress', message }) + '\n');
      });

      tsNode.stderr.on('data', (data) => {
        const message = data.toString();
        output += message;
        res.write(JSON.stringify({ status: 'error', message }) + '\n');
        hasError = true;
      });

      tsNode.on('close', (code) => {
        if (code === 0 && !hasError) {
          res.write(JSON.stringify({ 
            status: 'completed', 
            message: '\n✅ CSV import completed successfully!',
            output 
          }) + '\n');
        } else {
          res.write(JSON.stringify({ 
            status: 'failed', 
            message: `\n❌ CSV import failed with code ${code}`,
            output 
          }) + '\n');
        }
        
        // Ensure response is properly ended
        setTimeout(() => {
          res.end();
        }, 100); // Small delay to ensure final message is sent
      });

      tsNode.on('error', (error) => {
        res.write(JSON.stringify({ 
          status: 'failed', 
          message: `Error: ${error.message}`,
          output 
        }) + '\n');
        
        // Ensure response is properly ended
        setTimeout(() => {
          res.end();
        }, 100);
      });

    } catch (error: any) {
      console.error('Error in importCSV:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Upload CSV file
   */
  async uploadCSV(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileName = req.file.filename;
      const filePath = req.file.path;

      res.json({
        success: true,
        message: 'File uploaded successfully',
        fileName: fileName,
        path: filePath
      });
    } catch (error: any) {
      console.error('Error uploading CSV file:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * List available CSV files
   */
  async listCSVFiles(req: Request, res: Response) {
    try {
      const fs = require('fs');
      const projectRoot = path.join(__dirname, '..', '..');
      const csvFolder = path.join(projectRoot, 'csv');
      
      // Check if csv folder exists, if not fall back to project root
      let searchDir = projectRoot;
      if (fs.existsSync(csvFolder)) {
        searchDir = csvFolder;
      }
      
      const files = fs.readdirSync(searchDir)
        .filter((file: string) => file.endsWith('.csv'))
        .map((file: string) => ({
          name: file,
          path: path.join(searchDir, file)
        }));

      res.json({ files });
    } catch (error: any) {
      console.error('Error listing CSV files:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

