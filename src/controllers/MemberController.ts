import { Request, Response } from 'express';
import { MemberService } from '../services/MemberService';

export class MemberController {
  private memberService: MemberService;

  constructor() {
    this.memberService = new MemberService();
  }

  async createMember(req: Request, res: Response) {
    try {
      const memberData = req.body;
      
      // Validate required fields
      if (!memberData.wallet_address) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
      
      // Validate wallet address format (basic Ethereum address validation)
      if (!/^0x[a-fA-F0-9]{40}$/.test(memberData.wallet_address)) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
      }
      
      // Check if wallet already exists
      const existingMember = await this.memberService.getMemberByWallet(memberData.wallet_address);
      if (existingMember) {
        return res.status(409).json({ error: 'Member with this wallet address already exists' });
      }
      
      // Validate sponsor exists if provided
      if (memberData.sponsor_id) {
        const sponsor = await this.memberService.getMemberById(memberData.sponsor_id);
        if (!sponsor) {
          return res.status(400).json({ error: 'Sponsor not found' });
        }
      }
      
      const member = await this.memberService.createMember(memberData);
      res.status(201).json(member);
    } catch (error) {
      console.error('Error creating member:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  async updateMember(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const memberId = parseInt(id);
      
      if (isNaN(memberId)) {
        return res.status(400).json({ error: 'Invalid member ID' });
      }
      
      const updateData = req.body;
      
      // Validate sponsor exists if provided
      if (updateData.sponsor_id) {
        const sponsor = await this.memberService.getMemberById(updateData.sponsor_id);
        if (!sponsor) {
          return res.status(400).json({ error: 'Sponsor not found' });
        }
      }
      
      const member = await this.memberService.updateMember(memberId, updateData);
      res.json(member);
    } catch (error) {
      console.error('Error updating member:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  async deleteMember(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const memberId = parseInt(id);
      
      if (isNaN(memberId)) {
        return res.status(400).json({ error: 'Invalid member ID' });
      }
      
      const success = await this.memberService.deleteMember(memberId);
      
      if (success) {
        res.json({ message: 'Member deleted successfully' });
      } else {
        res.status(404).json({ error: 'Member not found' });
      }
    } catch (error) {
      console.error('Error deleting member:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  async getAllMembers(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const members = await this.memberService.getAllMembers(limit, offset);
      res.json(members);
    } catch (error) {
      console.error('Error getting all members:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getMemberById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const memberId = parseInt(id);
      
      if (isNaN(memberId)) {
        return res.status(400).json({ error: 'Invalid member ID' });
      }
      
      const member = await this.memberService.getMemberById(memberId);
      
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
      
      const member = await this.memberService.getMemberByWallet(wallet);
      
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      res.json(member);
    } catch (error) {
      console.error('Error getting member by wallet:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getMemberLayerInfo(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const memberId = parseInt(id);
      
      if (isNaN(memberId)) {
        return res.status(400).json({ error: 'Invalid member ID' });
      }
      
      const layerInfo = await this.memberService.getMemberLayerInfo(memberId);
      res.json(layerInfo);
    } catch (error) {
      console.error('Error getting member layer info:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getRootMember(req: Request, res: Response) {
    try {
      const rootMember = await this.memberService.getRootMember();
      
      if (!rootMember) {
        return res.status(404).json({ error: 'Root member not found' });
      }
      
      res.json(rootMember);
    } catch (error: any) {
      console.error('Error getting root member:', error);
      // Check if it's a "table doesn't exist" error
      if (error?.code === 'ER_NO_SUCH_TABLE' || error?.message?.includes("doesn't exist")) {
        return res.status(404).json({ 
          error: 'Table does not exist', 
          message: 'Tree structure tables not found. Please set up the database first.' 
        });
      }
      res.status(500).json({ error: 'Internal server error', message: error?.message || 'Unknown error' });
    }
  }
}

