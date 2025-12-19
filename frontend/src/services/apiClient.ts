import axios from 'axios';
import { Member, TreeStructure, SubtreeStats } from '../types/api';

export interface CreateMemberData {
  wallet_address: string;
  username?: string;
  sponsor_id?: number;
  activation_sequence?: number;
  current_level?: number;
  total_nft_claimed?: number;
}

export interface UpdateMemberData {
  username?: string;
  sponsor_id?: number;
  activation_sequence?: number;
  current_level?: number;
  total_nft_claimed?: number;
}

export interface MemberLayerInfo {
  layer: number;
  sponsorChain: Member[];
  rootDistance: number;
  isRoot: boolean;
}

import { getApiBaseUrl } from '../utils/apiConfig';

const API_BASE_URL = getApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export class ApiService {
  // Member CRUD operations
  async getAllMembers(limit: number = 100, offset: number = 0): Promise<Member[]> {
    const response = await apiClient.get(`/members?limit=${limit}&offset=${offset}`);
    return response.data;
  }

  async getMember(id: number): Promise<Member> {
    const response = await apiClient.get(`/members/${id}`);
    return response.data;
  }

  async getMemberByWallet(wallet: string): Promise<Member> {
    const response = await apiClient.get(`/members/wallet/${wallet}`);
    return response.data;
  }

  async getRootMember(): Promise<Member> {
    const response = await apiClient.get(`/members/root`);
    return response.data;
  }

  async getMemberLayerInfo(id: number): Promise<MemberLayerInfo> {
    const response = await apiClient.get(`/members/${id}/layer`);
    return response.data;
  }

  async createMember(memberData: CreateMemberData): Promise<Member> {
    const response = await apiClient.post('/members', memberData);
    return response.data;
  }

  async updateMember(id: number, updateData: UpdateMemberData): Promise<Member> {
    const response = await apiClient.put(`/members/${id}`, updateData);
    return response.data;
  }

  async deleteMember(id: number): Promise<{ message: string }> {
    const response = await apiClient.delete(`/members/${id}`);
    return response.data;
  }

  async getTree(id: number, maxDepth: number = 3): Promise<TreeStructure> {
    const response = await apiClient.get(`/tree/${id}?maxDepth=${maxDepth}`);
    return response.data;
  }

  async getTreeByWallet(wallet: string, maxDepth: number = 3): Promise<TreeStructure> {
    const response = await apiClient.get(`/tree/wallet/${wallet}?maxDepth=${maxDepth}`);
    return response.data;
  }

  async getDirectSponsorTree(id: number): Promise<TreeStructure> {
    const response = await apiClient.get(`/tree/direct/${id}`);
    return response.data;
  }

  async getDirectSponsorTreeByWallet(wallet: string): Promise<TreeStructure> {
    const response = await apiClient.get(`/tree/direct/wallet/${wallet}`);
    return response.data;
  }

  async searchMembers(term: string): Promise<Member[]> {
    const response = await apiClient.get(`/search?term=${encodeURIComponent(term)}`);
    return response.data;
  }

  async getSubtreeStats(id: number): Promise<SubtreeStats> {
    const response = await apiClient.get(`/stats/${id}`);
    return response.data;
  }

  async getDirectSponsorStats(id: number): Promise<{ directSponsors: number }> {
    const response = await apiClient.get(`/stats/direct/${id}`);
    return response.data;
  }

  async getMembersByLevel(id: number, level: number, limit: number = 100, offset: number = 0): Promise<Member[]> {
    const response = await apiClient.get(`/level/${id}/${level}?limit=${limit}&offset=${offset}`);
    return response.data;
  }

  async clearCache(): Promise<{ message: string }> {
    const response = await apiClient.post('/cache/clear');
    return response.data;
  }
}

export const apiService = new ApiService();
