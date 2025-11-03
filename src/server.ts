import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { TreeController } from './controllers/TreeController';
import { MemberController } from './controllers/MemberController';
import { DatabaseController } from './controllers/DatabaseController';

dotenv.config();

const app = express();

// Function to find an available port
function findAvailablePort(startPort: number, maxAttempts: number = 10): Promise<number> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const tryPort = (port: number) => {
      if (attempts >= maxAttempts) {
        reject(new Error(`Could not find an available port after ${maxAttempts} attempts`));
        return;
      }
      
      attempts++;
      const server = createServer();
      
      server.listen(port, () => {
        server.once('close', () => resolve(port));
        server.close();
      });
      
      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          // Port is in use, try next port
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
    };
    
    tryPort(startPort);
  });
}

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://127.0.0.1:5173',
    // Add your production domains here
    'https://yourdomain.com',
    'https://www.yourdomain.com',
    // Allow all origins for widget embedding (be careful in production)
    ...(process.env.NODE_ENV === 'development' ? ['*'] : [])
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// Initialize controllers
const treeController = new TreeController();
const memberController = new MemberController();
const databaseController = new DatabaseController();

// Routes
// Tree routes
app.get('/api/tree/:id', (req, res) => treeController.getTree(req, res));
app.get('/api/tree/wallet/:wallet', (req, res) => treeController.getTreeByWallet(req, res));
app.get('/api/search', (req, res) => treeController.searchMembers(req, res));
app.get('/api/stats/:id', (req, res) => treeController.getSubtreeStats(req, res));
app.get('/api/level/:id/:level', (req, res) => treeController.getMembersByLevel(req, res));

// Member CRUD routes
app.get('/api/members', (req, res) => memberController.getAllMembers(req, res));
app.get('/api/members/root', (req, res) => memberController.getRootMember(req, res)); // Must be before /:id routes
app.get('/api/members/wallet/:wallet', (req, res) => memberController.getMemberByWallet(req, res));
app.get('/api/members/:id/layer', (req, res) => memberController.getMemberLayerInfo(req, res));
app.get('/api/members/:id', (req, res) => memberController.getMemberById(req, res)); // Must be last to not catch /root
app.post('/api/members', (req, res) => memberController.createMember(req, res));
app.put('/api/members/:id', (req, res) => memberController.updateMember(req, res));
app.delete('/api/members/:id', (req, res) => memberController.deleteMember(req, res));

// Database operation routes
app.post('/api/database/setup', (req, res) => databaseController.setupDatabase(req, res));
app.post('/api/database/import', (req, res) => databaseController.importCSV(req, res));
app.get('/api/database/csv-files', (req, res) => databaseController.listCSVFiles(req, res));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server with auto port detection
const startPort = parseInt(process.env.PORT || '3000');

findAvailablePort(startPort)
  .then((port) => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      if (port !== startPort) {
        console.log(`⚠️  Port ${startPort} was in use, using port ${port} instead`);
      }
      console.log(`Health check: http://localhost:${port}/api/health`);
      console.log(`API documentation:`);
      console.log(`Tree Routes:`);
      console.log(`  GET /api/tree/:id?maxDepth=3 - Get tree structure by member ID`);
      console.log(`  GET /api/tree/wallet/:wallet?maxDepth=3 - Get tree structure by wallet address`);
      console.log(`  GET /api/search?term=searchTerm - Search members`);
      console.log(`  GET /api/stats/:id - Get subtree statistics`);
      console.log(`  GET /api/level/:id/:level?limit=100&offset=0 - Get members by level`);
      console.log(`Member CRUD Routes:`);
      console.log(`  GET /api/members - Get all members`);
      console.log(`  GET /api/members/:id - Get member by ID`);
      console.log(`  GET /api/members/wallet/:wallet - Get member by wallet address`);
      console.log(`  GET /api/members/:id/layer - Get member layer information`);
      console.log(`  POST /api/members - Create new member`);
      console.log(`  PUT /api/members/:id - Update member`);
      console.log(`  DELETE /api/members/:id - Delete member`);
    });
  })
  .catch((error) => {
    console.error('Error starting server:', error);
    process.exit(1);
  });
