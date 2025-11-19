import React, { useState, useEffect } from 'react';
import { apiService, CreateMemberData, UpdateMemberData, MemberLayerInfo } from '../services/apiClient';
import { Member } from '../types/api';

interface MemberManagementProps {
  onMemberSelect?: (member: Member) => void;
  onRefresh?: () => void;
}

const MemberManagement: React.FC<MemberManagementProps> = ({ onMemberSelect, onRefresh }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [layerInfo, setLayerInfo] = useState<MemberLayerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  
  const membersPerPage = 20;

  // Form states
  const [formData, setFormData] = useState<CreateMemberData>({
    wallet_address: '',
    username: '',
    sponsor_id: undefined,
    activation_sequence: undefined,
    current_level: undefined,
    total_nft_claimed: undefined
  });

  useEffect(() => {
    loadMembers();
  }, [currentPage, searchTerm]);

  const loadMembers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const offset = currentPage * membersPerPage;
      const allMembers = await apiService.getAllMembers(1000, 0); // Load all for search
      
      let filteredMembers = allMembers;
      if (searchTerm) {
        filteredMembers = allMembers.filter(member => 
          member.wallet_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (member.username && member.username.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }
      
      setMembers(filteredMembers.slice(offset, offset + membersPerPage));
      setTotalMembers(filteredMembers.length);
    } catch (err) {
      console.error('Error loading members:', err);
      setError('Failed to load members');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMemberLayerInfo = async (memberId: number) => {
    try {
      const layerInfo = await apiService.getMemberLayerInfo(memberId);
      setLayerInfo(layerInfo);
    } catch (err) {
      console.error('Error loading layer info:', err);
    }
  };

  const handleMemberSelect = async (member: Member) => {
    setSelectedMember(member);
    await loadMemberLayerInfo(member.id);
    onMemberSelect?.(member);
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);
      
      await apiService.createMember(formData);
      
      setShowCreateForm(false);
      setFormData({
        wallet_address: '',
        username: '',
        sponsor_id: undefined,
        activation_sequence: undefined,
        current_level: undefined,
        total_nft_claimed: undefined
      });
      
      await loadMembers();
      onRefresh?.();
    } catch (err: any) {
      console.error('Error creating member:', err);
      setError(err.response?.data?.error || 'Failed to create member');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const updateData: UpdateMemberData = {
        username: formData.username || undefined,
        sponsor_id: formData.sponsor_id || undefined,
        activation_sequence: formData.activation_sequence || undefined,
        current_level: formData.current_level || undefined,
        total_nft_claimed: formData.total_nft_claimed || undefined
      };
      
      await apiService.updateMember(editingMember.id, updateData);
      
      setShowEditForm(false);
      setEditingMember(null);
      setFormData({
        wallet_address: '',
        username: '',
        sponsor_id: undefined,
        activation_sequence: undefined,
        current_level: undefined,
        total_nft_claimed: undefined
      });
      
      await loadMembers();
      onRefresh?.();
    } catch (err: any) {
      console.error('Error updating member:', err);
      setError(err.response?.data?.error || 'Failed to update member');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMember = async (member: Member) => {
    if (!window.confirm(`Are you sure you want to delete member ${member.wallet_address}?`)) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      await apiService.deleteMember(member.id);
      
      await loadMembers();
      onRefresh?.();
      
      if (selectedMember?.id === member.id) {
        setSelectedMember(null);
        setLayerInfo(null);
      }
    } catch (err: any) {
      console.error('Error deleting member:', err);
      setError(err.response?.data?.error || 'Failed to delete member');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (member: Member) => {
    setEditingMember(member);
    setFormData({
      wallet_address: member.wallet_address,
      username: member.username || '',
      sponsor_id: member.sponsor_id || undefined,
      activation_sequence: member.activation_sequence || undefined,
      current_level: member.current_level || undefined,
      total_nft_claimed: member.total_nft_claimed || undefined
    });
    setShowEditForm(true);
  };

  const totalPages = Math.ceil(totalMembers / membersPerPage);

  return (
    <div className="member-management">
      <div className="member-management-header">
        <h3>Member Management</h3>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Search members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary"
          >
            Add Member
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="member-management-content">
        <div className="members-list">
          <div className="members-header">
            <div>Wallet Address</div>
            <div>Username</div>
            <div>Layer</div>
            <div>Children</div>
            <div>Actions</div>
          </div>
          
          {isLoading ? (
            <div className="loading">Loading members...</div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className={`member-row ${selectedMember?.id === member.id ? 'selected' : ''}`}
                onClick={() => handleMemberSelect(member)}
              >
                <div className="wallet-address" title={member.wallet_address}>
                  {member.wallet_address.slice(0, 10)}...{member.wallet_address.slice(-6)}
                </div>
                <div className="username">
                  {member.username || '-'}
                </div>
                <div className="layer">
                  {layerInfo?.layer || '-'}
                </div>
                <div className="children-count">
                  {(member as any).children_count || 0}
                </div>
                <div className="actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClick(member);
                    }}
                    className="btn btn-sm btn-secondary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMember(member);
                    }}
                    className="btn btn-sm btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
          
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="btn btn-sm"
              >
                Previous
              </button>
              <span>
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
                className="btn btn-sm"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {selectedMember && (
          <div className="member-details">
            <h4>Member Details</h4>
            <div className="member-info">
              <div><strong>ID:</strong> {selectedMember.id}</div>
              <div><strong>Wallet:</strong> {selectedMember.wallet_address}</div>
              <div><strong>Username:</strong> {selectedMember.username || 'N/A'}</div>
              <div><strong>Joined:</strong> {new Date(selectedMember.joined_at).toLocaleDateString()}</div>
              <div><strong>Sponsor ID:</strong> {selectedMember.sponsor_id || 'Root'}</div>
              <div><strong>Activation Sequence:</strong> {selectedMember.activation_sequence || 'N/A'}</div>
              <div><strong>Current Level:</strong> {selectedMember.current_level || 'N/A'}</div>
              <div><strong>NFTs Claimed:</strong> {selectedMember.total_nft_claimed || 0}</div>
            </div>
            
            {layerInfo && (
              <div className="layer-info">
                <h5>Layer Information</h5>
                <div><strong>Layer from Root:</strong> {layerInfo.layer}</div>
                <div><strong>Root Distance:</strong> {layerInfo.rootDistance}</div>
                <div><strong>Is Root:</strong> {layerInfo.isRoot ? 'Yes' : 'No'}</div>
                
                {layerInfo.sponsorChain.length > 1 && (
                  <div className="sponsor-chain">
                    <h6>Sponsor Chain:</h6>
                    <ol>
                      {layerInfo.sponsorChain.map((sponsor) => (
                        <li key={sponsor.id}>
                          {sponsor.wallet_address} {sponsor.username && `(${sponsor.username})`}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Member Modal */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create New Member</h3>
            <form onSubmit={handleCreateMember}>
              <div className="form-group">
                <label>Wallet Address *</label>
                <input
                  type="text"
                  value={formData.wallet_address}
                  onChange={(e) => setFormData({ ...formData, wallet_address: e.target.value })}
                  required
                  placeholder="0x..."
                />
              </div>
              
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={formData.username || ''}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Optional username"
                />
              </div>
              
              <div className="form-group">
                <label>Sponsor ID</label>
                <input
                  type="number"
                  value={formData.sponsor_id || ''}
                  onChange={(e) => setFormData({ ...formData, sponsor_id: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Sponsor member ID"
                />
              </div>
              
              <div className="form-group">
                <label>Activation Sequence</label>
                <input
                  type="number"
                  value={formData.activation_sequence || ''}
                  onChange={(e) => setFormData({ ...formData, activation_sequence: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Activation order"
                />
              </div>
              
              <div className="form-group">
                <label>Current Level</label>
                <input
                  type="number"
                  value={formData.current_level || ''}
                  onChange={(e) => setFormData({ ...formData, current_level: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Current level"
                />
              </div>
              
              <div className="form-group">
                <label>Total NFTs Claimed</label>
                <input
                  type="number"
                  value={formData.total_nft_claimed || ''}
                  onChange={(e) => setFormData({ ...formData, total_nft_claimed: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="NFT count"
                />
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowCreateForm(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {showEditForm && editingMember && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Edit Member</h3>
            <form onSubmit={handleUpdateMember}>
              <div className="form-group">
                <label>Wallet Address</label>
                <input
                  type="text"
                  value={formData.wallet_address}
                  disabled
                  className="disabled-input"
                />
                <small>Wallet address cannot be changed</small>
              </div>
              
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={formData.username || ''}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Optional username"
                />
              </div>
              
              <div className="form-group">
                <label>Sponsor ID</label>
                <input
                  type="number"
                  value={formData.sponsor_id || ''}
                  onChange={(e) => setFormData({ ...formData, sponsor_id: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Sponsor member ID"
                />
              </div>
              
              <div className="form-group">
                <label>Activation Sequence</label>
                <input
                  type="number"
                  value={formData.activation_sequence || ''}
                  onChange={(e) => setFormData({ ...formData, activation_sequence: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Activation order"
                />
              </div>
              
              <div className="form-group">
                <label>Current Level</label>
                <input
                  type="number"
                  value={formData.current_level || ''}
                  onChange={(e) => setFormData({ ...formData, current_level: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Current level"
                />
              </div>
              
              <div className="form-group">
                <label>Total NFTs Claimed</label>
                <input
                  type="number"
                  value={formData.total_nft_claimed || ''}
                  onChange={(e) => setFormData({ ...formData, total_nft_claimed: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="NFT count"
                />
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowEditForm(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? 'Updating...' : 'Update Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberManagement;

