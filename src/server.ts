import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { TreeController } from './controllers/TreeController';
import { MemberController } from './controllers/MemberController';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Routes
// Tree routes
app.get('/api/tree/:id', (req, res) => treeController.getTree(req, res));
app.get('/api/tree/wallet/:wallet', (req, res) => treeController.getTreeByWallet(req, res));
app.get('/api/search', (req, res) => treeController.searchMembers(req, res));
app.get('/api/stats/:id', (req, res) => treeController.getSubtreeStats(req, res));
app.get('/api/level/:id/:level', (req, res) => treeController.getMembersByLevel(req, res));

// Member CRUD routes
app.get('/api/members', (req, res) => memberController.getAllMembers(req, res));
app.get('/api/members/:id', (req, res) => memberController.getMemberById(req, res));
app.get('/api/members/wallet/:wallet', (req, res) => memberController.getMemberByWallet(req, res));
app.get('/api/members/:id/layer', (req, res) => memberController.getMemberLayerInfo(req, res));
app.post('/api/members', (req, res) => memberController.createMember(req, res));
app.put('/api/members/:id', (req, res) => memberController.updateMember(req, res));
app.delete('/api/members/:id', (req, res) => memberController.deleteMember(req, res));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
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
