import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiClient';
import { Member } from '../types/api';

interface SearchBarProps {
  onMemberSelect: (member: Member) => void;
  onTreeLoad: (wallet: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onMemberSelect, onTreeLoad }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (searchTerm.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const searchMembers = async () => {
      setIsLoading(true);
      try {
        const members = await apiService.searchMembers(searchTerm);
        setResults(members);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(searchMembers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleMemberClick = (member: Member) => {
    onMemberSelect(member);
    setSearchTerm(member.wallet_address);
    setShowResults(false);
  };

  const handleLoadTree = () => {
    if (searchTerm.trim()) {
      onTreeLoad(searchTerm.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLoadTree();
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          className="search-input"
          placeholder="Search by wallet address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={handleKeyPress}
          style={{ flex: 1 }}
        />
        <button 
          className="btn btn-primary" 
          onClick={handleLoadTree}
          disabled={!searchTerm.trim()}
        >
          Load Tree
        </button>
      </div>

      {showResults && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'white',
          border: '1px solid #ddd',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 1000
        }}>
          {isLoading ? (
            <div style={{ padding: '10px', textAlign: 'center' }}>Searching...</div>
          ) : results.length > 0 ? (
            results.map((member) => (
              <div
                key={member.id}
                onClick={() => handleMemberClick(member)}
                style={{
                  padding: '10px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #eee'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                  {member.wallet_address.slice(0, 6)}...{member.wallet_address.slice(-4)}
                </div>
                {member.activation_sequence && (
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Sequence: {member.activation_sequence}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div style={{ padding: '10px', color: '#666' }}>No members found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
