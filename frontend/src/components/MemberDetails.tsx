import React from 'react';
import { Member, SubtreeStats } from '../types/api';

interface MemberDetailsProps {
  member: Member | null;
  stats: SubtreeStats | null;
  isLoading: boolean;
}

const MemberDetails: React.FC<MemberDetailsProps> = ({ member, stats, isLoading }) => {
  if (isLoading) {
    return (
      <div className="member-card">
        <div className="loading">Loading member details...</div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="member-card">
        <h3>No Member Selected</h3>
        <p>Select a member from the tree to view details</p>
      </div>
    );
  }

  return (
    <div>
      <div className="member-card">
        <h3>Member Details</h3>
        <div className="wallet">{member.wallet_address}</div>
        
        {member.activation_sequence && (
          <p><strong>Activation Sequence:</strong> {member.activation_sequence}</p>
        )}
        
        {member.current_level && (
          <p><strong>Current Level:</strong> {member.current_level}</p>
        )}
        
        {member.total_nft_claimed && (
          <p><strong>NFTs Claimed:</strong> {member.total_nft_claimed}</p>
        )}
        
        <p><strong>Joined:</strong> {new Date(member.joined_at).toLocaleDateString()}</p>
        
        {member.sponsor_id && (
          <p><strong>Sponsor ID:</strong> {member.sponsor_id}</p>
        )}
      </div>

      {stats && (
        <div className="member-card">
          <h3>Subtree Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="number">{stats.totalMembers}</div>
              <div className="label">Total Members</div>
            </div>
            <div className="stat-card">
              <div className="number">{stats.directChildren}</div>
              <div className="label">Direct Children</div>
            </div>
            <div className="stat-card">
              <div className="number">{stats.maxDepth}</div>
              <div className="label">Max Depth</div>
            </div>
            <div className="stat-card">
              <div className="number">{Object.keys(stats.levels).length}</div>
              <div className="label">Levels</div>
            </div>
          </div>
          
          <h4>Members by Level</h4>
          {Object.entries(stats.levels).map(([depth, count]) => (
            <div key={depth} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Level {depth}:</span>
              <span><strong>{count}</strong></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MemberDetails;
