import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { TreeController } from './controllers/TreeController';
import { MemberController } from './controllers/MemberController';
import { DatabaseController, uploadCSV } from './controllers/DatabaseController';
import { BeeHiveController } from './controllers/BeeHiveController';

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
// Flexible CORS: allow common localhost ports and your domains; in dev allow any origin
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests
    if (!origin) return callback(null, true);

    const devMode = process.env.NODE_ENV === 'development';
    if (devMode) return callback(null, true);

    const allowedOrigins = [
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      /^https:\/\/infi-tools\.com$/,
      /^https:\/\/www\.infi-tools\.com$/,
      /^http:\/\/infi-tools\.com$/,
      /^http:\/\/www\.infi-tools\.com$/
    ];
    const isAllowed = allowedOrigins.some((re) => re.test(origin));
    return isAllowed ? callback(null, true) : callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204
}));
// Increase body size limit for file uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from public directory
app.use(express.static('public'));

// Initialize controllers
const treeController = new TreeController();
const memberController = new MemberController();
const databaseController = new DatabaseController();
const beeHiveController = new BeeHiveController();

// Routes
// Tree routes
app.get('/api/tree/:id', (req, res) => treeController.getTree(req, res));
app.get('/api/tree/wallet/:wallet', (req, res) => treeController.getTreeByWallet(req, res));
app.get('/api/search', (req, res) => treeController.searchMembers(req, res));
app.get('/api/stats/:id', (req, res) => treeController.getSubtreeStats(req, res));
app.get('/api/level/:id/:level', (req, res) => treeController.getMembersByLevel(req, res));
app.post('/api/cache/clear', (req, res) => treeController.clearCache(req, res));

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
app.post('/api/database/upload', uploadCSV, (req, res) => databaseController.uploadCSV(req, res));
app.get('/api/database/csv-files', (req, res) => databaseController.listCSVFiles(req, res));

// BeeHive routes
app.get('/api/beehive/levels', (req, res) => beeHiveController.getLevels(req, res));
app.post('/api/beehive/setup', (req, res) => beeHiveController.setupDatabase(req, res));
app.post('/api/beehive/process', (req, res) => beeHiveController.processCSV(req, res));
app.get('/api/beehive/stats', (req, res) => beeHiveController.getSystemStats(req, res));
app.get('/api/beehive/members', (req, res) => beeHiveController.getAllMemberStats(req, res));
app.get('/api/beehive/members/:wallet', (req, res) => beeHiveController.getMemberStats(req, res));
app.get('/api/beehive/members/:wallet/rewards', (req, res) => beeHiveController.getMemberRewards(req, res));

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
