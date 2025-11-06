import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api/beehive';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

export interface BeeHiveLevel {
  level: number;
  level_name_cn: string;
  level_name_en: string;
  fee_usdt: number;
  bcc_reward: number;
  layer_depth: number;
  usdt_payout: number;
}

export interface BeeHiveMemberStats {
  wallet_address: string;
  current_level: number;
  total_inflow: number;
  total_outflow_usdt: number;
  total_outflow_bcc: number;
  direct_sponsor_claimed_count: number;
  pending_usdt: number;
  pending_bcc: number;
  earned_usdt: number;
  earned_bcc: number;
}

export interface BeeHiveReward {
  reward_type: string;
  amount: number;
  currency: string;
  status: string;
  layer_number: number | null;
  layer_upgrade_sequence: number | null;
  source_wallet: string;
  pending_expires_at: string | null;
  notes: string;
  created_at: string;
}

export interface BeeHiveSystemStats {
  totalMembers: number;
  totalTransactions: number;
  totalInflow: number;
  totalOutflowUsdt: number;
  totalOutflowBcc: number;
  totalPendingUsdt: number;
  totalPendingBcc: number;
}

export class BeeHiveApiService {
  async getLevels(): Promise<BeeHiveLevel[]> {
    const response = await apiClient.get('/levels');
    return response.data;
  }

  async setupDatabase(): Promise<any> {
    // This returns a stream, handle in component
    return fetch('http://localhost:3000/api/beehive/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async processCSV(csvFile: string): Promise<any> {
    // This returns a stream, handle in component
    return fetch('http://localhost:3000/api/beehive/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvFile })
    });
  }

  async getSystemStats(): Promise<BeeHiveSystemStats> {
    const response = await apiClient.get('/stats');
    return response.data;
  }

  async getAllMemberStats(): Promise<BeeHiveMemberStats[]> {
    const response = await apiClient.get('/members');
    return response.data;
  }

  async getMemberStats(wallet: string): Promise<BeeHiveMemberStats> {
    const response = await apiClient.get(`/members/${wallet}`);
    return response.data;
  }

  async getMemberRewards(wallet: string): Promise<BeeHiveReward[]> {
    const response = await apiClient.get(`/members/${wallet}/rewards`);
    return response.data;
  }
}

export const beeHiveApi = new BeeHiveApiService();

