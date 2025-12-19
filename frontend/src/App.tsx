import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import TreeViewer from './components/TreeViewer';
import SearchBar from './components/SearchBar';
import MemberDetails from './components/MemberDetails';
import MemberManagement from './components/MemberManagement';
import { DatabaseModal } from './components/DatabaseModal';
import { BeeHive } from './components/BeeHive';
import { apiService } from './services/apiClient';
import { Member, TreeStructure, SubtreeStats } from './types/api';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Initialize activeTab based on current route (before any data loading)
  const [activeTab, setActiveTab] = useState<'tree' | 'members' | 'beehive'>(() => {
    const path = location.pathname;
    if (path === '/payout') return 'beehive';
    if (path === '/members') return 'members';
    return 'tree';
  });
  
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [tree, setTree] = useState<TreeStructure | null>(null);
  const [stats, setStats] = useState<SubtreeStats | null>(null);
  const [directSponsorStats, setDirectSponsorStats] = useState<{ directSponsors: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTreeLoading, setIsTreeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxDepth, setMaxDepth] = useState(3);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [viewMode, setViewMode] = useState<'3x3' | 'direct'>('3x3');
  
  // Cache for tree data
  const [treeCache, setTreeCache] = useState<Map<string, { tree: TreeStructure; stats: SubtreeStats; timestamp: number }>>(new Map());

  // Fetch direct sponsor stats when viewMode changes or when member is selected
  useEffect(() => {
    if (selectedMember && selectedMember.id) {
      console.log('Fetching direct sponsor stats for member:', selectedMember.id, 'viewMode:', viewMode);
      apiService.getDirectSponsorStats(selectedMember.id)
        .then((data) => {
          console.log('Direct sponsor stats received:', data);
          setDirectSponsorStats(data);
        })
        .catch((error) => {
          console.error('Error fetching direct sponsor stats:', error);
          setDirectSponsorStats(null);
        });
    } else {
      setDirectSponsorStats(null);
    }
  }, [viewMode, selectedMember]);

  // Cache utility functions
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  const getCacheKey = (wallet: string, depth: number) => `${wallet}_${depth}`;
  
  const getCachedData = (wallet: string, depth: number) => {
    const key = getCacheKey(wallet, depth);
    const cached = treeCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Cache hit for ${key}`);
      return cached;
    }
    
    // Try localStorage as fallback
    try {
      const stored = localStorage.getItem(`tree_cache_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          console.log(`LocalStorage cache hit for ${key}`);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading from localStorage cache:', e);
    }
    
    return null;
  };
  
  const setCachedData = (wallet: string, depth: number, tree: TreeStructure, stats: SubtreeStats) => {
    const key = getCacheKey(wallet, depth);
    const data = { tree, stats, timestamp: Date.now() };
    
    // Update memory cache
    setTreeCache(prev => new Map(prev.set(key, data)));
    
    // Update localStorage cache
    try {
      localStorage.setItem(`tree_cache_${key}`, JSON.stringify(data));
      console.log(`Cached data for ${key}`);
    } catch (e) {
      console.warn('Error saving to localStorage cache:', e);
    }
  };

  const clearCache = () => {
    console.log('Clearing tree cache...');
    
    // Clear in-memory cache
    setTreeCache(new Map());
    
    // Clear localStorage cache
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('tree_cache_')) {
          localStorage.removeItem(key);
        }
      });
      console.log('Cache cleared successfully');
    } catch (e) {
      console.warn('Error clearing localStorage cache:', e);
    }
  };

  // Sync activeTab with route changes
  useEffect(() => {
    const path = location.pathname;
    if (path === '/payout') {
      setActiveTab('beehive');
    } else if (path === '/members') {
      setActiveTab('members');
    } else if (path === '/') {
      setActiveTab('tree');
    }
  }, [location.pathname]);

  // Load root tree on startup only if tree tab is active AND we're on the root path
  // Don't load if we're on beehive or members routes
  useEffect(() => {
    // Only load tree if we're on the tree tab and root path
    const path = location.pathname;
    if (activeTab === 'tree' && path === '/') {
      loadRootTree().catch(err => {
        // Silently handle errors - tables might not exist yet
        console.log('Could not load root tree (database may not be set up):', err);
      });
    }
  }, [activeTab, location.pathname]);

  const loadRootTree = async () => {
    // Don't load if we're not on the tree route
    if (location.pathname !== '/' || activeTab !== 'tree') {
      return;
    }
    
    try {
      setIsLoading(true);
      setIsTreeLoading(true);
      setError(null);
      setLoadingProgress(0);
      
      // Get the root member from the API
      setLoadingProgress(20);
      const member = await apiService.getRootMember();
      
      if (!member) {
        throw new Error('Root member not found in database');
      }
      
      const rootWallet = member.wallet_address;
      
      // Check cache first
      const cached = getCachedData(rootWallet, maxDepth);
      if (cached) {
        console.log('Loading root tree from cache');
        setLoadingProgress(50);
        setSelectedMember(member);
        setTree(cached.tree);
        setStats(cached.stats);
        // Fetch direct sponsor stats
        apiService.getDirectSponsorStats(member.id).then(setDirectSponsorStats).catch(() => {});
        setLoadingProgress(100);
        setIsLoading(false);
        setIsTreeLoading(false);
        setTimeout(() => setLoadingProgress(0), 500);
        return;
      }
      
      setLoadingProgress(40);
      const treeData = await apiService.getTreeByWallet(rootWallet, maxDepth);
      
      setLoadingProgress(60);
      const statsData = await apiService.getSubtreeStats(member.id);
      const directStatsData = await apiService.getDirectSponsorStats(member.id);
      
      setLoadingProgress(80);
      setSelectedMember(member);
      setTree(treeData);
      setStats(statsData);
      setDirectSponsorStats(directStatsData);
      
      // Cache the data
      setCachedData(rootWallet, maxDepth, treeData, statsData);
      
      setLoadingProgress(100);
    } catch (err: any) {
      // Only show error if we're actually on the tree route
      if (location.pathname === '/' && activeTab === 'tree') {
        console.error('Error loading root tree:', err);
        // Check if it's a "table doesn't exist" error - don't show error for this
        if (err?.response?.data?.code === 'ER_NO_SUCH_TABLE' ||
            err?.response?.data?.message?.includes("doesn't exist") || 
            err?.message?.includes("doesn't exist") ||
            err?.response?.data?.error?.includes("ER_NO_SUCH_TABLE")) {
          // Don't show error - user might be setting up database
          console.log('Tree tables not set up yet');
          setError(null);
        } else {
          setError(err.response?.data?.error || err.message || 'Failed to load tree data.');
        }
      }
      setTree(null);
      setStats(null);
      setDirectSponsorStats(null);
    } finally {
      setIsLoading(false);
      setIsTreeLoading(false);
      setTimeout(() => setLoadingProgress(0), 500);
    }
  };

  const handleMemberSelect = (member: Member) => {
    setSelectedMember(member);
  };

  const handleTreeLoad = async (wallet: string) => {
    try {
      setIsLoading(true);
      setIsTreeLoading(true);
      setError(null);
      setLoadingProgress(0);
      
      // Check cache first
      const cached = getCachedData(wallet, maxDepth);
      if (cached) {
        console.log('Loading tree from cache');
        setLoadingProgress(50);
        setSelectedMember({ 
          id: cached.tree.id, 
          wallet_address: cached.tree.wallet_address,
          joined_at: new Date().toISOString(),
          activation_sequence: cached.tree.activation_sequence,
          total_nft_claimed: cached.tree.total_nft_claimed
        } as Member);
        setTree(cached.tree);
        setStats(cached.stats);
        // Fetch direct sponsor stats
        const member = await apiService.getMemberByWallet(wallet);
        if (member) {
          apiService.getDirectSponsorStats(member.id).then(setDirectSponsorStats).catch(() => {});
        }
        setLoadingProgress(100);
        setIsLoading(false);
        setIsTreeLoading(false);
        setTimeout(() => setLoadingProgress(0), 500);
        return;
      }
      
      setLoadingProgress(25);
      const member = await apiService.getMemberByWallet(wallet);
      
      setLoadingProgress(50);
      const treeData = await apiService.getTreeByWallet(wallet, maxDepth);
      
      setLoadingProgress(75);
      const statsData = await apiService.getSubtreeStats(member.id);
      const directStatsData = await apiService.getDirectSponsorStats(member.id);
      
      setLoadingProgress(90);
      setSelectedMember(member);
      setTree(treeData);
      setStats(statsData);
      setDirectSponsorStats(directStatsData);
      
      // Cache the data
      setCachedData(wallet, maxDepth, treeData, statsData);
      
      setLoadingProgress(100);
    } catch (err) {
      console.error('Error loading tree:', err);
      setError('Failed to load tree data. Member may not exist.');
    } finally {
      setIsLoading(false);
      setIsTreeLoading(false);
      setTimeout(() => setLoadingProgress(0), 500);
    }
  };

  const handleNodeClick = async (nodeId: number) => {
    try {
      const member = await apiService.getMember(nodeId);
      const statsData = await apiService.getSubtreeStats(nodeId);
      const directStatsData = await apiService.getDirectSponsorStats(nodeId);
      
      setSelectedMember(member);
      setStats(statsData);
      setDirectSponsorStats(directStatsData);
      
      // Optionally expand the tree to show more levels for this node
      if (member) {
        const newTree = await apiService.getTreeByWallet(member.wallet_address, Math.min(maxDepth + 2, 10));
        setTree(newTree);
        setMaxDepth(Math.min(maxDepth + 2, 10));
      }
    } catch (err) {
      console.error('Error loading member details:', err);
    }
  };

  const handleDepthChange = async (newDepth: number) => {
    if (!selectedMember) return;
    
    try {
      setIsLoading(true);
      setIsTreeLoading(true);
      setError(null);
      setLoadingProgress(0);
      
      // Check cache first
      const cached = getCachedData(selectedMember.wallet_address, newDepth);
      if (cached) {
        console.log('Loading tree from cache for depth change');
        setLoadingProgress(50);
        setTree(cached.tree);
        setStats(cached.stats);
        // Fetch direct sponsor stats
        apiService.getDirectSponsorStats(selectedMember.id).then(setDirectSponsorStats).catch(() => {});
        setMaxDepth(newDepth);
        setLoadingProgress(100);
        setIsLoading(false);
        setIsTreeLoading(false);
        setTimeout(() => setLoadingProgress(0), 500);
        return;
      }
      
      setLoadingProgress(30);
      const treeData = await apiService.getTreeByWallet(selectedMember.wallet_address, newDepth);
      
      setLoadingProgress(60);
      const statsData = await apiService.getSubtreeStats(selectedMember.id);
      const directStatsData = await apiService.getDirectSponsorStats(selectedMember.id);
      
      setLoadingProgress(80);
      setTree(treeData);
      setStats(statsData);
      setDirectSponsorStats(directStatsData);
      setMaxDepth(newDepth);
      
      // Cache the data
      setCachedData(selectedMember.wallet_address, newDepth, treeData, statsData);
      
      setLoadingProgress(100);
    } catch (err) {
      console.error('Error loading tree with new depth:', err);
      setError('Failed to load tree with new depth');
    } finally {
      setIsLoading(false);
      setIsTreeLoading(false);
      setTimeout(() => setLoadingProgress(0), 500);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      // Reset input if no file selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setUploadMessage('❌ Please select a CSV file');
      setTimeout(() => setUploadMessage(''), 3000);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setIsUploading(true);
    setUploadMessage('📤 Uploading file...');

    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      // Get API base URL (works in both dev and production)
      const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000/api'
        : '/api';
      
      const response = await fetch(`${apiBaseUrl}/database/upload`, {
        method: 'POST',
        body: formData
        // Don't set Content-Type header - browser will set it with boundary for FormData
      });

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Upload failed';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
        setUploadMessage(`✅ File "${data.fileName}" uploaded successfully!`);
      } else {
        setUploadMessage(`❌ Upload failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadMessage(`❌ Upload error: ${error.message || 'Failed to upload file'}`);
    } finally {
      setIsUploading(false);
      // Clear file input after upload completes
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Clear message after 5 seconds
      setTimeout(() => setUploadMessage(''), 5000);
    }
  };

  const handleLoadAllLevels = async () => {
    if (!selectedMember) return;
    
    try {
      setIsLoading(true);
      setIsTreeLoading(true);
      setError(null);
      setLoadingProgress(0);
      
      // Check cache first for all levels (depth 999)
      const cached = getCachedData(selectedMember.wallet_address, 999);
      if (cached) {
        console.log('Loading all levels from cache');
        setLoadingProgress(50);
        setTree(cached.tree);
        setStats(cached.stats);
        // Fetch direct sponsor stats
        apiService.getDirectSponsorStats(selectedMember.id).then(setDirectSponsorStats).catch(() => {});
        setMaxDepth(999);
        setLoadingProgress(100);
        setIsLoading(false);
        setIsTreeLoading(false);
        setTimeout(() => setLoadingProgress(0), 500);
        return;
      }
      
      setLoadingProgress(10);
      // Load with a very high depth to get all levels
      const treeData = await apiService.getTreeByWallet(selectedMember.wallet_address, 999);
      
      setLoadingProgress(50);
      const statsData = await apiService.getSubtreeStats(selectedMember.id);
      const directStatsData = await apiService.getDirectSponsorStats(selectedMember.id);
      
      setLoadingProgress(70);
      setTree(treeData);
      setStats(statsData);
      setDirectSponsorStats(directStatsData);
      setMaxDepth(999);
      
      // Cache the data
      setCachedData(selectedMember.wallet_address, 999, treeData, statsData);
      
      setLoadingProgress(100);
    } catch (err) {
      console.error('Error loading all levels:', err);
      setError('Failed to load all levels');
    } finally {
      setIsLoading(false);
      setIsTreeLoading(false);
      setTimeout(() => setLoadingProgress(0), 500);
    }
  };

  return (
    <div className="container">
      <div className="sidebar">
        <h2>Direct Sales Tree</h2>
        
        <div className="tab-buttons">
          <button
            className={`tab-button ${activeTab === 'tree' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('tree');
              navigate('/');
            }}
          >
            🌳 Tree View
          </button>
          <button
            className={`tab-button ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('members');
              navigate('/members');
            }}
          >
            👥 Members
          </button>
          <button
            className={`tab-button ${activeTab === 'beehive' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('beehive');
              navigate('/payout');
            }}
          >
            🐝 BeeHive
          </button>
        </div>
        
        {activeTab === 'tree' && (
          <>
            <SearchBar 
              onMemberSelect={handleMemberSelect}
              onTreeLoad={handleTreeLoad}
            />
            
            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>View Mode:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
                <button
                  onClick={() => setViewMode('3x3')}
                  style={{
                    padding: '8px 12px',
                    background: viewMode === '3x3' ? '#007bff' : '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: viewMode === '3x3' ? 'bold' : 'normal',
                    transition: 'all 0.2s'
                  }}
                >
                  3x3 Matrix
                </button>
                <button
                  onClick={() => setViewMode('direct')}
                  style={{
                    padding: '8px 12px',
                    background: viewMode === 'direct' ? '#007bff' : '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: viewMode === 'direct' ? 'bold' : 'normal',
                    transition: 'all 0.2s'
                  }}
                >
                  Direct Sponsor
                </button>
              </div>
            </div>
            
            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Tree Depth:</label>
              <select 
                value={maxDepth === 999 ? 'all' : maxDepth} 
                onChange={(e) => {
                  if (e.target.value === 'all') {
                    handleLoadAllLevels();
                  } else {
                    handleDepthChange(parseInt(e.target.value));
                  }
                }}
                style={{ width: '100%', padding: '5px' }}
                disabled={isTreeLoading}
              >
                <option value={1}>1 Level</option>
                <option value={2}>2 Levels</option>
                <option value={3}>3 Levels</option>
                <option value={4}>4 Levels</option>
                <option value={5}>5 Levels</option>
                <option value={10}>10 Levels</option>
                <option value={15}>15 Levels</option>
                <option value={20}>20 Levels</option>
                <option value="all">All Levels (Complete Tree)</option>
              </select>
            </div>
          </>
        )}

        {/* Loading Progress Bar */}
        {isTreeLoading && (
          <div style={{ marginTop: '15px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '5px',
              fontSize: '12px',
              color: '#666'
            }}>
              <span>Loading tree...</span>
              <span>{loadingProgress}%</span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e0e0e0',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${loadingProgress}%`,
                height: '100%',
                backgroundColor: '#007bff',
                borderRadius: '4px',
                transition: 'width 0.3s ease',
                background: 'linear-gradient(90deg, #007bff, #0056b3)'
              }} />
            </div>
          </div>
        )}

        {/* Cache Controls */}
        <div style={{ marginTop: '15px' }}>
          <button 
            onClick={clearCache} 
            className="clear-cache-btn"
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Clear cached tree data to force fresh load"
          >
            Clear Cache
          </button>
        </div>

        {activeTab === 'tree' && (
          <MemberDetails 
            member={selectedMember}
            stats={stats}
            directSponsorStats={directSponsorStats}
            viewMode={viewMode}
            isLoading={isLoading}
          />
        )}
      </div>

      <div className="main-content">
        <Routes>
          <Route path="/payout" element={<BeeHive />} />
          <Route path="/members" element={
            <MemberManagement 
              onMemberSelect={handleMemberSelect}
              onRefresh={() => {
                // Clear cache when members are updated
                clearCache();
              }}
            />
          } />
          <Route path="/" element={
            <>
              <div className="toolbar" style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={loadRootTree}
                  disabled={isLoading}
                  style={{ flex: '1' }}
                >
                  Load Root Tree
                </button>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: '1' }}>
                  <label
                    htmlFor="csv-upload-input"
                    style={{
                      display: 'inline-block',
                      background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      opacity: isUploading ? 0.7 : 1,
                      pointerEvents: isUploading ? 'none' : 'auto',
                      width: '100%',
                      textAlign: 'center'
                    }}
                  >
                    {isUploading ? '📤 Uploading...' : '📤 Upload CSV'}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="csv-upload-input"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    style={{ display: 'none' }}
                  />
                </div>
                
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setIsDatabaseModalOpen(true)}
                  style={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    flex: '1'
                  }}
                >
                  🔧 Database Operations
                </button>
                
                {uploadMessage && (
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    backgroundColor: uploadMessage.includes('✅') ? '#d4edda' : '#f8d7da',
                    color: uploadMessage.includes('✅') ? '#155724' : '#721c24',
                    position: 'absolute',
                    top: '50px',
                    right: '10px',
                    zIndex: 1000
                  }}>
                    {uploadMessage}
                  </span>
                )}
                
                {tree && (
                  <div style={{ marginLeft: 'auto', color: '#666', flex: '0 0 auto' }}>
                    Showing {maxDepth} level{maxDepth !== 1 ? 's' : ''} of tree
                  </div>
                )}
              </div>

              <div className="tree-container">
                {error && (
                  <div className="error">
                    {error}
                  </div>
                )}
                
                {isLoading && !tree && (
                  <div className="loading">
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                      <div style={{ 
                        width: '40px', 
                        height: '40px', 
                        border: '4px solid #e0e0e0',
                        borderTop: '4px solid #007bff',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 20px'
                      }} />
                      <div>Loading tree data...</div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                        {loadingProgress}% complete
                      </div>
                    </div>
                  </div>
                )}
                
                {isTreeLoading && tree && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(255, 255, 255, 0.9)',
                    padding: '20px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    textAlign: 'center'
                  }}>
                    <div style={{ 
                      width: '30px', 
                      height: '30px', 
                      border: '3px solid #e0e0e0',
                      borderTop: '3px solid #007bff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 15px'
                    }} />
                    <div>Updating tree...</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                      {loadingProgress}% complete
                    </div>
                  </div>
                )}
                
                <TreeViewer 
                  tree={tree}
                  onNodeClick={handleNodeClick}
                  viewMode={viewMode}
                />
              </div>
            </>
          } />
        </Routes>
      </div>

      {/* Database Operations Modal */}
      <DatabaseModal 
        isOpen={isDatabaseModalOpen}
        onClose={() => {
          setIsDatabaseModalOpen(false);
          // Reload CSV files when modal closes (in case new file was uploaded)
          // This is handled by the modal's useEffect when it opens
        }}
        onImportSuccess={() => {
          // Clear cache and reload tree after successful import (only if on tree route)
          clearCache();
          if (location.pathname === '/' && activeTab === 'tree') {
            loadRootTree();
          }
        }}
      />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
