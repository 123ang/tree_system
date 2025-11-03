import { Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';

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
      const tsNode = spawn('npx', ['ts-node', scriptPath, csvFile], {
        cwd: path.join(__dirname, '..', '..'),
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
        res.end();
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

      const scriptPath = path.join(__dirname, '..', 'scripts', 'importCSV.ts');
      const tsNode = spawn('npx', ['ts-node', scriptPath, csvFile], {
        cwd: path.join(__dirname, '..', '..'),
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
        res.end();
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
      console.error('Error in importCSV:', error);
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
      
      const files = fs.readdirSync(projectRoot)
        .filter((file: string) => file.endsWith('.csv'))
        .map((file: string) => ({
          name: file,
          path: path.join(projectRoot, file)
        }));

      res.json({ files });
    } catch (error: any) {
      console.error('Error listing CSV files:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

