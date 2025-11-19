import React, { useState, useEffect, useRef, useMemo } from 'react';
import { beeHiveApi, BeeHiveLevel, BeeHiveMemberStats, BeeHiveSystemStats } from '../services/beeHiveApi';
import './BeeHive.css';

type ScopeMode = 'all' | 'root' | 'wallet';

interface ScopeState {
  mode: ScopeMode;
  value?: string;
}

interface LogEntry {
  status: string;
  message: string;
}

export const BeeHive: React.FC = () => {
  const CACHE_PREFIX = 'beehive_results_cache_v1';
  const CACHE_DURATION = 1000 * 60 * 60 * 12; // 12 hours

  const [levels, setLevels] = useState<BeeHiveLevel[]>([]);
  const [csvFiles, setCsvFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResultsLoading, setIsResultsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [systemStats, setSystemStats] = useState<BeeHiveSystemStats | null>(null);
  const [memberStats, setMemberStats] = useState<BeeHiveMemberStats[]>([]);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [walletFilter, setWalletFilter] = useState('');
  const [referrerFilter, setReferrerFilter] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [scopeMode, setScopeMode] = useState<ScopeMode>('all');
  const [scopeInput, setScopeInput] = useState('');
  const [activeScope, setActiveScope] = useState<ScopeState>({ mode: 'all' });
  const [scopeError, setScopeError] = useState<string | null>(null);
  const logsRef = useRef<HTMLDivElement | null>(null);

  const normalizeScope = (scope: ScopeState): ScopeState => {
    if (scope.mode === 'all') {
      return { mode: 'all' };
    }
    const value = scope.value?.trim();
    return value ? { mode: scope.mode, value } : { mode: scope.mode };
  };

  const getScopeCacheKey = (scope: ScopeState) => {
    const normalized = normalizeScope(scope);
    if (normalized.mode === 'all') {
      return `${CACHE_PREFIX}_all`;
    }
    const suffix = normalized.value ? `${normalized.mode}_${normalized.value.toLowerCase()}` : normalized.mode;
    return `${CACHE_PREFIX}_${suffix}`;
  };

  const saveResultsToCache = (scope: ScopeState, stats: BeeHiveSystemStats | null, members: BeeHiveMemberStats[]) => {
    if (typeof window === 'undefined') return;
    try {
      const payload = {
        systemStats: stats,
        memberStats: members,
        timestamp: Date.now()
      };
      window.localStorage.setItem(getScopeCacheKey(scope), JSON.stringify(payload));
      setLastUpdated(new Date(payload.timestamp).toISOString());
    } catch (error) {
      console.warn('Failed to cache BeeHive results:', error);
    }
  };

  const clearCachedResults = () => {
    if (typeof window === 'undefined') return;
    try {
      const keys = Object.keys(window.localStorage);
      keys.forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
          window.localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear BeeHive cache:', error);
    }
    setLastUpdated(null);
  };

  const loadCachedResults = (scope: ScopeState) => {
    if (typeof window === 'undefined') return null;
    try {
      const cachedRaw = window.localStorage.getItem(getScopeCacheKey(scope));
      if (!cachedRaw) return;

      const cached = JSON.parse(cachedRaw) as {
        systemStats: BeeHiveSystemStats | null;
        memberStats: BeeHiveMemberStats[];
        timestamp: number;
      };

      if (Date.now() - cached.timestamp > CACHE_DURATION) {
        window.localStorage.removeItem(getScopeCacheKey(scope));
        return null;
      }

      if (cached.systemStats) {
        setSystemStats(cached.systemStats);
      }
      if (cached.memberStats) {
        setMemberStats(cached.memberStats);
      }
      setLastUpdated(new Date(cached.timestamp).toISOString());
      setActiveScope(normalizeScope(scope));
      setScopeError(null);
      return cached;
    } catch (error) {
      console.warn('Failed to load BeeHive cache:', error);
    }
    return null;
  };

  const fetchResultsForScope = async (scope: ScopeState) => {
    const normalized = normalizeScope(scope);
    const params =
      normalized.mode === 'root'
        ? { rootWallet: normalized.value }
        : normalized.mode === 'wallet'
        ? { wallet: normalized.value }
        : undefined;

    setIsResultsLoading(true);
    setScopeError(null);

    try {
      const [stats, members] = await Promise.all([
        beeHiveApi.getSystemStats(params),
        beeHiveApi.getAllMemberStats(params)
      ]);

      setSystemStats(stats);
      setMemberStats(members);
      setSelectedMember(null);
      saveResultsToCache(normalized, stats, members);
      setLastUpdated(new Date().toISOString());
      setActiveScope(normalized);
      setScopeError(null);
      return { stats, members };
    } catch (error: any) {
      console.error('Error loading BeeHive results:', error);
      if (!loadCachedResults(normalized)) {
        setSystemStats(null);
        setMemberStats([]);
      }
      if (error?.response?.status === 404) {
        setScopeError('No BeeHive data found for the requested scope.');
      } else {
        setScopeError(error?.response?.data?.error || error?.message || 'Failed to load BeeHive results.');
      }
      throw error;
    } finally {
      setIsResultsLoading(false);
    }
  };

  const loadResults = async (scope: ScopeState, options: { skipNetwork?: boolean } = {}) => {
    const normalized = normalizeScope(scope);
    const isNewScope = normalized.mode !== activeScope.mode || normalized.value !== activeScope.value;

    if (isNewScope) {
      setWalletFilter('');
      setReferrerFilter('');
      setActiveScope(normalized);
    }

    const cached = loadCachedResults(normalized);

    if (cached) {
      setSelectedMember(null);
    }

    if (isNewScope && !cached) {
      setSystemStats(null);
      setMemberStats([]);
      setLastUpdated(null);
    }

    if (options.skipNetwork) {
      return cached;
    }

    return fetchResultsForScope(normalized);
  };

  const handleScopeModeChange = (mode: ScopeMode) => {
    setScopeMode(mode);
    setScopeError(null);
    if (mode === 'all') {
      setScopeInput('');
      loadResults({ mode: 'all' }).catch(err => {
        console.log('Failed to load BeeHive results for all scope:', err);
      });
    }
  };

  const handleApplyScope = () => {
    if (scopeMode === 'all') {
      loadResults({ mode: 'all' }).catch(err => {
        console.log('Failed to load BeeHive results for all scope:', err);
      });
      return;
    }

    const value = scopeInput.trim();
    if (!value) {
      setScopeError(scopeMode === 'root' ? 'Enter a root wallet address.' : 'Enter a wallet address.');
      return;
    }

    const targetScope: ScopeState = { mode: scopeMode, value };
    setScopeInput(value);
    loadResults(targetScope).catch(err => {
      console.log('Failed to load BeeHive results for scope:', err);
    });
  };

  const handleResetScope = () => {
    setScopeMode('all');
    setScopeInput('');
    setScopeError(null);
    loadResults({ mode: 'all' }).catch(err => {
      console.log('Failed to load BeeHive results for all scope:', err);
    });
  };

  useEffect(() => {
    // Load levels and CSV files, but don't fail if tables don't exist yet
    loadLevels().catch(err => {
      console.log('Levels not loaded yet (database may not be set up):', err);
      // This is fine - user can set up database first
    });
    loadCSVFiles().catch(err => {
      console.log('CSV files not loaded yet:', err);
      // This is fine - user can set up database first
    });

    loadResults({ mode: 'all' }).catch(err => {
      console.log('BeeHive results not available yet:', err);
    });
  }, []);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  const loadLevels = async () => {
    try {
      const data = await beeHiveApi.getLevels();
      setLevels(data);
    } catch (error: any) {
      console.error('Error loading levels:', error);
      // Don't show error to user - they just need to set up database first
      // The UI will still show the setup button
    }
  };

  const loadCSVFiles = async () => {
    try {
      const apiBaseUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3000/api'
        : '/api';
      const response = await fetch(`${apiBaseUrl}/database/csv-files`);
      if (!response.ok) {
        // If endpoint doesn't exist or fails, that's okay - we'll just show empty file list
        return;
      }
      const data = await response.json();
      setCsvFiles(data.files.map((f: any) => f.name));
      if (data.files.length > 0) {
        setSelectedFile(data.files[0].name);
      }
    } catch (error) {
      console.error('Error loading CSV files:', error);
      // Don't show error - this is fine if database isn't set up yet
    }
  };

  const handleSetupDatabase = async () => {
    setIsLoading(true);
    setLogs([]);
    clearCachedResults();
    setSystemStats(null);
    setMemberStats([]);
    setSelectedMember(null);
    setWalletFilter('');
    setReferrerFilter('');
    setScopeMode('all');
    setScopeInput('');
    setActiveScope({ mode: 'all' });
    setScopeError(null);

    try {
      const response = await beeHiveApi.setupDatabase();
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const logEntry = JSON.parse(line);
            setLogs(prev => [...prev, logEntry]);
            
            if (logEntry.status === 'completed' || logEntry.status === 'failed') {
              setIsLoading(false);
            }
          } catch (e) {
            console.warn('Failed to parse log entry:', line);
          }
        }
      }
    } catch (error: any) {
      setLogs(prev => [...prev, {
        status: 'failed',
        message: `Error: ${error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessCSV = async () => {
    if (!selectedFile) {
      alert('Please select a CSV file');
      return;
    }

    setIsLoading(true);
    setLogs([]);
    setMemberStats([]);
    setSystemStats(null);
    clearCachedResults();
    setWalletFilter('');
    setReferrerFilter('');
    setScopeError(null);

    try {
      const response = await beeHiveApi.processCSV(selectedFile);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const logEntry = JSON.parse(line);
            setLogs(prev => [...prev, logEntry]);
            
            if (logEntry.status === 'completed' || logEntry.status === 'failed') {
              setIsLoading(false);
              
              // Load results
              if (logEntry.status === 'completed') {
                setTimeout(() => {
                  loadResults(activeScope).catch(err => {
                    console.log('Failed to refresh BeeHive results after processing:', err);
                  });
                }, 500);
              }
            }
          } catch (e) {
            console.warn('Failed to parse log entry:', line);
          }
        }
      }
    } catch (error: any) {
      setLogs(prev => [...prev, {
        status: 'failed',
        message: `Error: ${error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'started': return '🚀';
      case 'progress': return '⚙️';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'error': return '⚠️';
      default: return '📝';
    }
  };

  const toNumber = (value: number | string | null | undefined): number => {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(numValue) ? 0 : numValue;
  };

  const formatCurrency = (value: number | string | null | undefined, currency: string = 'USDT') => {
    // Handle null, undefined, or non-numeric values
    if (value === null || value === undefined || value === '') {
      return currency === 'USDT' ? '$0.00' : `0 ${currency}`;
    }
    
    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Check if it's a valid number
    if (isNaN(numValue)) {
      return currency === 'USDT' ? '$0.00' : `0 ${currency}`;
    }
    
    if (currency === 'USDT') {
      return `$${numValue.toFixed(2)}`;
    }
    return `${numValue.toLocaleString()} ${currency}`;
  };

  const referralGraph = useMemo(() => {
    const map = new Map<string, string[]>();
    memberStats.forEach(member => {
      const ref = member.referrer_wallet?.toLowerCase();
      const walletLower = member.wallet_address.toLowerCase();
      if (!ref) return;
      const existing = map.get(ref);
      if (existing) {
        existing.push(walletLower);
      } else {
        map.set(ref, [walletLower]);
      }
    });
    return map;
  }, [memberStats]);

  const descendantWallets = useMemo(() => {
    const term = walletFilter.trim().toLowerCase();
    if (!term) {
      return new Set<string>();
    }

    const exactMatches = memberStats
      .filter(member => member.wallet_address.toLowerCase() === term)
      .map(member => member.wallet_address.toLowerCase());

    if (exactMatches.length === 0) {
      return new Set<string>();
    }

    const visited = new Set<string>();
    const queue = [...exactMatches];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = referralGraph.get(current);
      if (!children) continue;
      children.forEach(child => {
        if (!visited.has(child)) {
          visited.add(child);
          queue.push(child);
        }
      });
    }

    return visited;
  }, [memberStats, walletFilter, referralGraph]);

  const filteredMembers = useMemo(() => {
    const walletTerm = walletFilter.trim().toLowerCase();
    const referrerTerm = referrerFilter.trim().toLowerCase();

    return memberStats.filter(member => {
      const walletLower = member.wallet_address.toLowerCase();
      const walletMatches = !walletTerm || walletLower.includes(walletTerm);
      const refWallet = (member.referrer_wallet || '').toLowerCase();
      const refMatches = !referrerTerm || refWallet.includes(referrerTerm);
      const descendantMatch = walletTerm && descendantWallets.has(walletLower);
      return walletMatches || refMatches || descendantMatch;
    });
  }, [memberStats, walletFilter, referrerFilter, descendantWallets]);

  const summaryTotals = useMemo(() => {
    const referrers = new Set<string>();
    let totalInflow = 0;
    let earnedUsdt = 0;
    let earnedBcc = 0;
    let pendingUsdt = 0;
    let pendingBcc = 0;

    filteredMembers.forEach(member => {
      const refWallet = (member.referrer_wallet || '').toLowerCase();
      if (refWallet) {
        referrers.add(refWallet);
      }
      totalInflow += toNumber(member.total_inflow);
      earnedUsdt += toNumber(member.earned_usdt);
      earnedBcc += toNumber(member.earned_bcc);
      pendingUsdt += toNumber(member.pending_usdt);
      pendingBcc += toNumber(member.pending_bcc);
    });

    return {
      count: filteredMembers.length,
      referrerCount: referrers.size,
      totalInflow,
      earnedUsdt,
      earnedBcc,
      pendingUsdt,
      pendingBcc
    };
  }, [filteredMembers]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return '';
    const date = new Date(lastUpdated);
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleString();
  }, [lastUpdated]);

  const scopeBadgeLabel = useMemo(() => {
    const scope = systemStats?.scope
      ? { mode: systemStats.scope.type as ScopeMode, value: systemStats.scope.value }
      : activeScope;

    if (scope.mode === 'root' && scope.value) {
      return `Root scope: ${scope.value}`;
    }

    if (scope.mode === 'wallet' && scope.value) {
      return `Wallet scope: ${scope.value}`;
    }

    return 'Entire BeeHive dataset';
  }, [systemStats, activeScope]);

  return (
    <div className="beehive-container">
      <h1>🐝 BeeHive Reward Calculator</h1>
      
      <div className="beehive-content">
        {/* Left Panel - Setup & Processing */}
        <div className="beehive-panel">
          <h2>Setup & Process</h2>
          
          <div className="setup-section">
            <button
              className="btn btn-primary"
              onClick={handleSetupDatabase}
              disabled={isLoading}
            >
              🔧 Setup BeeHive Database
            </button>
            <p className="help-text">Create BeeHive tables (only needed once)</p>
          </div>

          <div className="process-section">
            <h3>Process CSV</h3>
            <select
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              disabled={isLoading}
              className="csv-select"
            >
              <option value="">Select CSV file...</option>
              {csvFiles.map(file => (
                <option key={file} value={file}>{file}</option>
              ))}
            </select>
            
            <button
              className="btn btn-success"
              onClick={handleProcessCSV}
              disabled={isLoading || !selectedFile}
            >
              📊 Process Transactions
            </button>
            <p className="help-text">
              CSV must have: wallet_address, referrer_wallet, payment_datetime, total_payment<br/>
              Level is auto-detected from payment amount (optional: target_level column)
            </p>
          </div>

          {logs.length > 0 && (
            <div className="logs-container">
              <h3>Processing Log</h3>
              <div className="logs" ref={logsRef}>
                {logs.map((log, index) => (
                  <div key={index} className={`log-entry log-${log.status}`}>
                    <span className="log-icon">{getStatusIcon(log.status)}</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Processing...</p>
            </div>
          )}
        </div>

        {/* Right Panel - Results */}
        <div className="beehive-panel results-panel">
          <h2>Results</h2>

          <div className="scope-controls">
            <div className="scope-field">
              <label htmlFor="scope-mode">Calculation Scope</label>
              <select
                id="scope-mode"
                value={scopeMode}
                onChange={(e) => handleScopeModeChange(e.target.value as ScopeMode)}
              >
                <option value="all">Entire BeeHive</option>
                <option value="root">By Root Wallet</option>
                <option value="wallet">By Wallet Address</option>
              </select>
            </div>
            {scopeMode !== 'all' && (
              <div className="scope-field">
                <label htmlFor="scope-value">
                  {scopeMode === 'root' ? 'Root Wallet' : 'Wallet Address'}
                </label>
                <input
                  id="scope-value"
                  type="text"
                  value={scopeInput}
                  onChange={(e) => setScopeInput(e.target.value)}
                  placeholder={scopeMode === 'root' ? 'Enter root wallet address' : 'Enter wallet address'}
                />
              </div>
            )}
            <div className="scope-actions">
              <button
                className="scope-btn scope-apply"
                onClick={handleApplyScope}
                disabled={isResultsLoading || (scopeMode !== 'all' && !scopeInput.trim())}
              >
                Apply Scope
              </button>
              {activeScope.mode !== 'all' && (
                <button
                  className="scope-btn scope-reset"
                  onClick={handleResetScope}
                  disabled={isResultsLoading}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {scopeError && (
            <div className="scope-error">
              {scopeError}
            </div>
          )}

          <div className="scope-summary">
            <span className={`scope-badge scope-${(systemStats?.scope?.type || activeScope.mode)}`}>
              {scopeBadgeLabel}
            </span>
            {lastUpdatedLabel && (
              <span className="scope-meta">Last updated: {lastUpdatedLabel}</span>
            )}
            {isResultsLoading && (
              <span className="scope-refresh">Refreshing...</span>
            )}
          </div>
          
          {systemStats && (
            <div className="system-stats">
              <h3>System Statistics</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Members</div>
                  <div className="stat-value">{systemStats.totalMembers}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Transactions</div>
                  <div className="stat-value">{systemStats.totalTransactions}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Inflow</div>
                  <div className="stat-value">{formatCurrency(systemStats.totalInflow)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Paid (USDT)</div>
                  <div className="stat-value">{formatCurrency(systemStats.totalOutflowUsdt)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Paid (BCC)</div>
                  <div className="stat-value">{formatCurrency(systemStats.totalOutflowBcc, 'BCC')}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Pending (USDT)</div>
                  <div className="stat-value pending">{formatCurrency(systemStats.totalPendingUsdt)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Pending (BCC)</div>
                  <div className="stat-value pending">{formatCurrency(systemStats.totalPendingBcc, 'BCC')}</div>
                </div>
              </div>
            </div>
          )}

          {memberStats.length > 0 && (
            <div className="member-stats">
              <h3>Member Statistics</h3>

              <div className="filters-grid">
                <div className="filter-input-group">
                  <label htmlFor="wallet-filter">Wallet Filter</label>
                  <input
                    id="wallet-filter"
                    type="text"
                    placeholder="Search by wallet address..."
                    value={walletFilter}
                    onChange={(e) => setWalletFilter(e.target.value)}
                    className="filter-input"
                  />
                </div>
                <div className="filter-input-group">
                  <label htmlFor="referrer-filter">Referrer Filter</label>
                  <input
                    id="referrer-filter"
                    type="text"
                    placeholder="Search by referrer wallet..."
                    value={referrerFilter}
                    onChange={(e) => setReferrerFilter(e.target.value)}
                    className="filter-input"
                  />
                </div>
                {lastUpdatedLabel && (
                  <div className="filter-meta">
                    <span className="filter-meta-label">Last Updated</span>
                    <span className="filter-meta-value">{lastUpdatedLabel}</span>
                  </div>
                )}
              </div>

              <div className="summary-grid">
                <div className="summary-card">
                  <div className="summary-label">Members</div>
                  <div className="summary-value">{summaryTotals.count}</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Unique Referrers</div>
                  <div className="summary-value">{summaryTotals.referrerCount}</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Total Inflow</div>
                  <div className="summary-value">{formatCurrency(summaryTotals.totalInflow)}</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Earned (USDT)</div>
                  <div className="summary-value">{formatCurrency(summaryTotals.earnedUsdt)}</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Earned (BCC)</div>
                  <div className="summary-value">{formatCurrency(summaryTotals.earnedBcc, 'BCC')}</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Pending (USDT)</div>
                  <div className="summary-value pending">{formatCurrency(summaryTotals.pendingUsdt)}</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Pending (BCC)</div>
                  <div className="summary-value pending">{formatCurrency(summaryTotals.pendingBcc, 'BCC')}</div>
                </div>
              </div>

              <div className="member-table-container">
                <table className="member-table">
                  <thead>
                    <tr>
                      <th>Wallet</th>
                      <th>Referrer Wallet</th>
                      <th>Level</th>
                      <th>Inflow</th>
                      <th>Earned (USDT)</th>
                      <th>Earned (BCC)</th>
                      <th>Pending (USDT)</th>
                      <th>Pending (BCC)</th>
                      <th>Direct Sponsors (claimed/total)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member, index) => (
                      <tr 
                        key={index}
                        onClick={() => setSelectedMember(member.wallet_address)}
                        className={selectedMember === member.wallet_address ? 'selected' : ''}
                      >
                        <td className="wallet-cell">{member.wallet_address}</td>
                        <td className="wallet-cell referrer-cell">{member.referrer_wallet || '—'}</td>
                        <td className="level-cell">
                          {member.current_level > 0 ? (
                            <span className={`level-badge level-${member.current_level}`}>
                              L{member.current_level}
                            </span>
                          ) : (
                            <span className="level-badge level-0">N/A</span>
                          )}
                        </td>
                        <td className="currency-cell">{formatCurrency(member.total_inflow)}</td>
                        <td className="currency-cell earned">{formatCurrency(member.earned_usdt || 0)}</td>
                        <td className="currency-cell earned">{formatCurrency(member.earned_bcc || 0, 'BCC')}</td>
                        <td className="currency-cell pending">{formatCurrency(member.pending_usdt || 0)}</td>
                        <td className="currency-cell pending">{formatCurrency(member.pending_bcc || 0, 'BCC')}</td>
                        <td className="center-cell">
                          {member.direct_sponsor_claimed_count || 0}
                          {typeof member.direct_sponsor_total_count === 'number'
                            ? ` / ${member.direct_sponsor_total_count}`
                            : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!systemStats && !isLoading && (
            <div className="empty-state">
              <p>👈 Process a CSV file to see results</p>
            </div>
          )}
        </div>
      </div>

      {/* Level Reference Table */}
      {levels.length > 0 && (
        <div className="levels-reference">
          <h2>Level Reference</h2>
          <div className="levels-table-container">
            <table className="levels-table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Name (EN)</th>
                  <th>Name (CN)</th>
                  <th>Fee (USDT)</th>
                  <th>BCC Reward</th>
                  <th>Layer Depth</th>
                  <th>USDT Payout</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((level) => (
                  <tr key={level.level}>
                    <td className="level-cell">
                      <span className={`level-badge level-${level.level}`}>
                        {level.level}
                      </span>
                    </td>
                    <td>{level.level_name_en}</td>
                    <td>{level.level_name_cn}</td>
                    <td className="currency-cell">{formatCurrency(level.fee_usdt)}</td>
                    <td className="currency-cell">{formatCurrency(level.bcc_reward, 'BCC')}</td>
                    <td className="center-cell">{level.layer_depth}</td>
                    <td className="currency-cell">{formatCurrency(level.usdt_payout)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

