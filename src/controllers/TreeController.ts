import { Request, Response } from 'express';
import { TreeService } from '../services/TreeService';

export class TreeController {
  private treeService: TreeService;

  constructor() {
    this.treeService = new TreeService();
  }

  async getMember(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const memberId = parseInt(id);
      
      if (isNaN(memberId)) {
        return res.status(400).json({ error: 'Invalid member ID' });
      }

      const member = await this.treeService.getMemberById(memberId);
      
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      res.json(member);
    } catch (error) {
      console.error('Error getting member:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getMemberByWallet(req: Request, res: Response) {
    try {
      const { wallet } = req.params;
      
      const member = await this.treeService.getMemberByWallet(wallet);
      
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      res.json(member);
    } catch (error) {
      console.error('Error getting member by wallet:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getTree(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const maxDepth = parseInt(req.query.maxDepth as string) || 3;
      
      const memberId = parseInt(id);
      
      if (isNaN(memberId)) {
        return res.status(400).json({ error: 'Invalid member ID' });
      }

      const tree = await this.treeService.getTreeStructure(memberId, maxDepth);
      
      if (!tree) {
        return res.status(404).json({ error: 'Member not found' });
      }

      res.json(tree);
    } catch (error) {
      console.error('Error getting tree:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getTreeByWallet(req: Request, res: Response) {
    try {
      const { wallet } = req.params;
      const maxDepth = parseInt(req.query.maxDepth as string) || 3;
      
      const member = await this.treeService.getMemberByWallet(wallet);
      
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      const tree = await this.treeService.getTreeStructure(member.id, maxDepth);
      
      if (!tree) {
        return res.status(404).json({ error: 'Tree not found' });
      }

      res.json(tree);
    } catch (error) {
      console.error('Error getting tree by wallet:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getDirectSponsorTree(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const memberId = parseInt(id);
      
      if (isNaN(memberId)) {
        return res.status(400).json({ error: 'Invalid member ID' });
      }

      const tree = await this.treeService.getDirectSponsorTree(memberId);
      
      if (!tree) {
        return res.status(404).json({ error: 'Member not found' });
      }

      res.json(tree);
    } catch (error) {
      console.error('Error getting direct sponsor tree:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getDirectSponsorTreeByWallet(req: Request, res: Response) {
    try {
      const { wallet } = req.params;
      
      const member = await this.treeService.getMemberByWallet(wallet);
      
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      const tree = await this.treeService.getDirectSponsorTree(member.id);
      
      if (!tree) {
        return res.status(404).json({ error: 'Tree not found' });
      }

      res.json(tree);
    } catch (error) {
      console.error('Error getting direct sponsor tree by wallet:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async searchMembers(req: Request, res: Response) {
    try {
      const { term } = req.query;
      
      if (!term || typeof term !== 'string') {
        return res.status(400).json({ error: 'Search term is required' });
      }

      const members = await this.treeService.searchMembers(term);
      res.json(members);
    } catch (error) {
      console.error('Error searching members:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getSubtreeStats(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const memberId = parseInt(id);
      
      if (isNaN(memberId)) {
        return res.status(400).json({ error: 'Invalid member ID' });
      }

      const stats = await this.treeService.getSubtreeStats(memberId);
      res.json(stats);
    } catch (error) {
      console.error('Error getting subtree stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getDirectSponsorStats(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const memberId = parseInt(id);
      
      if (isNaN(memberId)) {
        return res.status(400).json({ error: 'Invalid member ID' });
      }

      const stats = await this.treeService.getDirectSponsorStats(memberId);
      res.json(stats);
    } catch (error) {
      console.error('Error getting direct sponsor stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getMembersByLevel(req: Request, res: Response) {
    try {
      const { id, level } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const memberId = parseInt(id);
      const levelNum = parseInt(level);
      
      if (isNaN(memberId) || isNaN(levelNum)) {
        return res.status(400).json({ error: 'Invalid member ID or level' });
      }

      const members = await this.treeService.getMembersByLevel(memberId, levelNum, limit, offset);
      res.json(members);
    } catch (error) {
      console.error('Error getting members by level:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async clearCache(req: Request, res: Response) {
    try {
      // This endpoint just signals the frontend to clear its cache
      // The actual cache clearing happens on the frontend side
      res.json({ message: 'Cache clear signal sent' });
    } catch (error) {
      console.error('Error in clearCache:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
