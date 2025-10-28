export interface Member {
  id: number;
  wallet_address: string;
  username?: string;
  joined_at: string;
  root_id?: number;
  sponsor_id?: number;
  activation_sequence?: number;
  current_level?: number;
  total_nft_claimed?: number;
  sponsor_wallet?: string;
  position?: number;
  children_count?: number;
}

export interface TreeStructure {
  id: number;
  wallet_address: string;
  children: TreeStructure[];
  position?: number;
  depth?: number;
  sponsor_id?: number;
  activation_sequence?: number;
  total_nft_claimed?: number;
}

export interface SubtreeStats {
  totalMembers: number;
  directChildren: number;
  maxDepth: number;
  levels: { [depth: number]: number };
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
