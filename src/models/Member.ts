export interface Member {
  id: number;
  wallet_address: string;
  username?: string;
  joined_at: Date;
  root_id?: number;
  sponsor_id?: number;
  activation_sequence?: number;
  current_level?: number;
  total_nft_claimed?: number;
}

export interface MemberWithChildren extends Member {
  children: MemberWithChildren[];
  position?: number;
  depth?: number;
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

export interface PlacementCandidate {
  parent_id: number;
  position: number;
  depth: number;
  parent_joined_at: string;
}
