import { Request, Response } from 'express';
import { BeeHiveService } from '../services/BeeHiveService';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import csv from 'csv-parser';

export class BeeHiveController {
  private beeHiveService: BeeHiveService;

  constructor() {
    this.beeHiveService = new BeeHiveService();
  }

  /**
   * Get all BeeHive levels
   */
  async getLevels(req: Request, res: Response) {
    try {
      const levels = await this.beeHiveService.getLevels();
      res.json(levels);
    } catch (error: any) {
      console.error('Error getting BeeHive levels:', error);
      // If table doesn't exist, return empty array instead of error
      // This allows the UI to be accessible so user can set up database
      if (error?.code === 'ER_NO_SUCH_TABLE' || error?.message?.includes("doesn't exist")) {
        return res.json([]);
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Setup BeeHive database tables
   */
  async setupDatabase(req: Request, res: Response) {
    try {
      // Set headers for streaming response
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');

      res.write(JSON.stringify({ status: 'started', message: 'Starting BeeHive database setup...\n' }) + '\n');

      const scriptPath = path.join(__dirname, '..', 'scripts', 'setupBeeHive.ts');
      const projectRoot = path.join(__dirname, '..', '..');
      
      const command = `npx ts-node "${scriptPath}"`;
      
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
            message: '\n✅ BeeHive database setup completed!',
            output 
          }) + '\n');
        } else {
          res.write(JSON.stringify({ 
            status: 'failed', 
            message: `\n❌ BeeHive setup failed with code ${code}`,
            output 
          }) + '\n');
        }
        
        setTimeout(() => res.end(), 100);
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
   * Process BeeHive CSV
   */
  async processCSV(req: Request, res: Response) {
    try {
      const { csvFile } = req.body;
      
      if (!csvFile) {
        return res.status(400).json({ error: 'CSV file name is required' });
      }

      // Set headers for streaming response
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');

      res.write(JSON.stringify({ status: 'started', message: 'Starting BeeHive CSV processing...\n' }) + '\n');

      const projectRoot = path.join(__dirname, '..', '..');
      const csvFolder = path.join(projectRoot, 'csv');
      
      let csvPath = path.join(csvFolder, csvFile);
      if (!fs.existsSync(csvPath)) {
        csvPath = path.join(projectRoot, csvFile);
      }

      if (!fs.existsSync(csvPath)) {
        res.write(JSON.stringify({ 
          status: 'failed', 
          message: `CSV file not found: ${csvFile}` 
        }) + '\n');
        res.end();
        return;
      }

      res.write(JSON.stringify({ status: 'progress', message: `Reading CSV file: ${csvFile}\n` }) + '\n');

      // Parse CSV
      const transactions: any[] = [];
      
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          const wallet_address = this.getColumnValue(row, 'wallet_address', 'User Name', 'user_name').trim();
          const referrer_wallet = this.getColumnValue(row, 'referrer_wallet', 'Referrer_User Name', 'referrer_user_name').trim();
          const payment_datetime = this.getColumnValue(row, 'payment_datetime', 'Payment Date', 'payment_date');
          const total_payment_str = this.getColumnValue(row, 'total_payment', 'Total Payment', 'total_payment');
          const total_payment = parseFloat(total_payment_str || '0');
          
          // target_level is optional - will be auto-detected from payment amount
          const target_level_str = this.getColumnValue(row, 'target_level', 'Target Level', 'target_level');
          const target_level = target_level_str ? parseInt(target_level_str) : undefined;

          if (wallet_address && payment_datetime && total_payment > 0) {
            transactions.push({
              wallet_address,
              referrer_wallet,
              payment_datetime,
              total_payment,
              target_level // Optional - will be auto-detected if not provided
            });
          }
        })
        .on('end', async () => {
          res.write(JSON.stringify({ 
            status: 'progress', 
            message: `Found ${transactions.length} transactions\n` 
          }) + '\n');

          try {
            res.write(JSON.stringify({ status: 'progress', message: 'Processing transactions...\n' }) + '\n');
            
            const result = await this.beeHiveService.processTransactions(transactions);
            
            if (result.success) {
              res.write(JSON.stringify({ 
                status: 'completed', 
                message: `\n✅ ${result.message}`,
                stats: result.stats
              }) + '\n');
            } else {
              res.write(JSON.stringify({ 
                status: 'failed', 
                message: `\n⚠️ ${result.message}`,
                stats: result.stats
              }) + '\n');
            }
          } catch (error: any) {
            res.write(JSON.stringify({ 
              status: 'failed', 
              message: `\n❌ Error: ${error.message}` 
            }) + '\n');
          }
          
          setTimeout(() => res.end(), 100);
        })
        .on('error', (error) => {
          res.write(JSON.stringify({ 
            status: 'failed', 
            message: `Error reading CSV: ${error.message}` 
          }) + '\n');
          res.end();
        });

    } catch (error: any) {
      console.error('Error in processCSV:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Get all member stats
   */
  async getAllMemberStats(req: Request, res: Response) {
    try {
      const { rootWallet, wallet } = req.query;

      if (typeof wallet === 'string' && wallet.trim()) {
        const stats = await this.beeHiveService.getMemberStatsForWalletTree(wallet.trim());
        return res.json(stats);
      }

      if (typeof rootWallet === 'string' && rootWallet.trim()) {
        const stats = await this.beeHiveService.getMemberStatsForRoot(rootWallet.trim());
        return res.json(stats);
      }

      const stats = await this.beeHiveService.getAllMemberStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting member stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get member stats by wallet
   */
  async getMemberStats(req: Request, res: Response) {
    try {
      const { wallet } = req.params;
      const stats = await this.beeHiveService.getMemberStats(wallet);
      
      if (!stats) {
        return res.status(404).json({ error: 'Member not found in BeeHive system' });
      }
      
      res.json(stats);
    } catch (error) {
      console.error('Error getting member stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get member rewards by wallet
   */
  async getMemberRewards(req: Request, res: Response) {
    try {
      const { wallet } = req.params;
      const rewards = await this.beeHiveService.getMemberRewards(wallet);
      res.json(rewards);
    } catch (error) {
      console.error('Error getting member rewards:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get system stats
   */
  async getSystemStats(req: Request, res: Response) {
    try {
      const { rootWallet, wallet } = req.query;
      const options: { rootWallet?: string; wallet?: string } = {};

      if (typeof wallet === 'string' && wallet.trim()) {
        options.wallet = wallet.trim();
      }

      if (typeof rootWallet === 'string' && rootWallet.trim()) {
        options.rootWallet = rootWallet.trim();
      }

      const stats = await this.beeHiveService.getSystemStats(options);

      if (!stats) {
        return res.status(404).json({ error: 'No statistics found for requested scope' });
      }

      res.json(stats);
    } catch (error) {
      console.error('Error getting system stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Helper to get column value from CSV row (handles BOM)
   */
  private getColumnValue(row: any, ...possibleKeys: string[]): string {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return String(row[key]);
      }
      const bomKey = '\uFEFF' + key;
      if (row[bomKey] !== undefined && row[bomKey] !== null && row[bomKey] !== '') {
        return String(row[bomKey]);
      }
      for (const rowKey of Object.keys(row)) {
        if (rowKey.replace(/^\uFEFF/, '') === key && row[rowKey] !== undefined && row[rowKey] !== null && row[rowKey] !== '') {
          return String(row[rowKey]);
        }
      }
    }
    return '';
  }
}

