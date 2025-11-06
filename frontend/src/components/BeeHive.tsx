import React, { useState, useEffect, useRef } from 'react';
import { beeHiveApi, BeeHiveLevel, BeeHiveMemberStats, BeeHiveSystemStats } from '../services/beeHiveApi';
import './BeeHive.css';

interface LogEntry {
  status: string;
  message: string;
}

export const BeeHive: React.FC = () => {
  const [levels, setLevels] = useState<BeeHiveLevel[]>([]);
  const [csvFiles, setCsvFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [systemStats, setSystemStats] = useState<BeeHiveSystemStats | null>(null);
  const [memberStats, setMemberStats] = useState<BeeHiveMemberStats[]>([]);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const logsRef = useRef<HTMLDivElement | null>(null);

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
      const response = await fetch('http://localhost:3000/api/database/csv-files');
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
                  loadResults();
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

  const loadResults = async () => {
    try {
      const [stats, members] = await Promise.all([
        beeHiveApi.getSystemStats(),
        beeHiveApi.getAllMemberStats()
      ]);
      
      setSystemStats(stats);
      setMemberStats(members);
    } catch (error) {
      console.error('Error loading results:', error);
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

  const filteredMembers = memberStats.filter(m => 
    m.wallet_address.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              
              <input
                type="text"
                placeholder="Search by wallet address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />

              <div className="member-table-container">
                <table className="member-table">
                  <thead>
                    <tr>
                      <th>Wallet</th>
                      <th>Level</th>
                      <th>Inflow</th>
                      <th>Earned (USDT)</th>
                      <th>Earned (BCC)</th>
                      <th>Pending (USDT)</th>
                      <th>Pending (BCC)</th>
                      <th>Direct Sponsors</th>
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
                        <td className="center-cell">{member.direct_sponsor_claimed_count}</td>
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

