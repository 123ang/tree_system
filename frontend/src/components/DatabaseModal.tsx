import React, { useState, useEffect, useRef } from 'react';
import './DatabaseModal.css';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

interface LogEntry {
  status: string;
  message: string;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({ isOpen, onClose, onImportSuccess }) => {
  const [csvFiles, setCsvFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('sponsor tree.csv');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCSVFiles();
    }
  }, [isOpen]);

  const loadCSVFiles = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/database/csv-files');
      const data = await response.json();
      setCsvFiles(data.files.map((f: any) => f.name));
    } catch (error) {
      console.error('Error loading CSV files:', error);
      setCsvFiles(['sponsor tree.csv', 'members.csv']);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setUploadMessage('❌ Please select a CSV file');
      return;
    }

    setIsUploading(true);
    setUploadMessage('📤 Uploading file...');

    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      const response = await fetch('http://localhost:3000/api/database/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUploadMessage(`✅ File "${data.fileName}" uploaded successfully!`);
        // Reload CSV files list
        await loadCSVFiles();
        // Select the newly uploaded file
        setSelectedFile(data.fileName);
        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setUploadMessage(`❌ Upload failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      setUploadMessage(`❌ Upload error: ${error.message}`);
    } finally {
      setIsUploading(false);
      // Clear message after 5 seconds
      setTimeout(() => setUploadMessage(''), 5000);
    }
  };

  const handleOperation = async (type: 'setup' | 'import') => {
    setIsLoading(true);
    setLogs([]);

    // Safety timeout to prevent infinite loading (2 minutes max)
    const timeout = setTimeout(() => {
      console.warn('Operation timeout - stopping loading');
      setIsLoading(false);
      setLogs(prev => [...prev, {
        status: 'error',
        message: '\n⚠️ Operation took too long. Please check if it completed successfully.'
      }]);
    }, 120000); // 2 minutes

    try {
      const controller = new AbortController();
      const { signal } = controller;
      const endpoint = type === 'setup' 
        ? 'http://localhost:3000/api/database/setup'
        : 'http://localhost:3000/api/database/import';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ csvFile: selectedFile }),
        signal
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let operationComplete = false;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream ended');
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const logEntry = JSON.parse(line);
            // Normalize status based on message content when backend prints final messages as progress
            let normalizedStatus = logEntry.status;
            const msg: string = String(logEntry.message || '');
            if (normalizedStatus === 'progress') {
              const isCompletedMsg = /CSV import completed successfully|Database setup completed successfully/i.test(msg);
              const isFailedMsg = /failed with code|error/i.test(msg) && /❌|failed/i.test(msg);
              if (isCompletedMsg) normalizedStatus = 'completed';
              if (isFailedMsg) normalizedStatus = 'failed';
            }
            setLogs(prev => [...prev, { ...logEntry, status: normalizedStatus }]);
            
            // Check if operation is complete
            if (normalizedStatus === 'completed' || normalizedStatus === 'failed') {
              operationComplete = true;
              // Append a friendly final log line visible in the UI
              setLogs(prev => [...prev, { status: 'completed', message: '\n✓ Operation finished. You can close this window.' }]);
              
              // If operation was successful, trigger cache clear and tree reload
              if (normalizedStatus === 'completed' && onImportSuccess) {
                setTimeout(() => {
                  onImportSuccess();
                }, 500); // Small delay to ensure UI updates first
              }
              
              // Stop loading immediately and cancel the stream so UI updates right away
              setIsLoading(false);
              try {
                await reader.cancel();
              } catch {}
              try {
                controller.abort();
              } catch {}
              break;
            }
          } catch (e) {
            // Ignore JSON parse errors for incomplete chunks
            console.warn('Failed to parse log entry:', line);
          }
        }
        
        if (operationComplete) {
          break;
        }
      }

      // Ensure loading stops after stream ends (fallback)
      if (!operationComplete) {
        setIsLoading(false);
      }
      
    } catch (error: any) {
      // If aborted intentionally, don't mark as failed
      if (error?.name === 'AbortError') {
        setLogs(prev => [...prev, { status: 'completed', message: '\n✓ Operation finished.' }]);
      } else {
        setLogs(prev => [...prev, {
          status: 'failed',
          message: `Error: ${error.message}`
        }]);
      }
    } finally {
      // Clear timeout
      clearTimeout(timeout);
      
      // Always stop loading when done
      setIsLoading(false);
      console.log('Loading stopped - operation finished');
    }
  };

  const handleClose = () => {
    if (!showLoading) {
      setLogs([]);
      onClose();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'started':
        return '🚀';
      case 'progress':
        return '⚙️';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'error':
        return '⚠️';
      default:
        return '📝';
    }
  };

  // Auto-scroll logs container to bottom when new logs arrive
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  // Safety: stop loading if the latest status is not a progress state
  useEffect(() => {
    const latest = logs.length ? logs[logs.length - 1].status : null;
    if (latest && latest !== 'started' && latest !== 'progress') {
      if (isLoading) setIsLoading(false);
    }
  }, [logs, isLoading]);

  const lastStatus = logs.length ? logs[logs.length - 1].status : null;
  const isProgressing = lastStatus === 'started' || lastStatus === 'progress';
  const showLoading = isLoading && isProgressing;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Database Operations</h2>
          <button className="close-btn" onClick={handleClose} disabled={showLoading}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="file-upload-section" style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
            <label htmlFor="csv-upload" style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
              📤 Upload CSV File:
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                id="csv-upload"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isUploading || showLoading}
                style={{ flex: 1, padding: '8px' }}
              />
              {isUploading && <span style={{ color: '#007bff' }}>Uploading...</span>}
            </div>
            {uploadMessage && (
              <div style={{ 
                marginTop: '10px', 
                padding: '8px', 
                borderRadius: '4px',
                backgroundColor: uploadMessage.includes('✅') ? '#d4edda' : '#f8d7da',
                color: uploadMessage.includes('✅') ? '#155724' : '#721c24'
              }}>
                {uploadMessage}
              </div>
            )}
          </div>

          <div className="file-selection">
            <label htmlFor="csv-file">Select CSV File:</label>
            <select
              id="csv-file"
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              disabled={showLoading}
            >
              {csvFiles.map(file => (
                <option key={file} value={file}>{file}</option>
              ))}
            </select>
          </div>

          <div className="operation-buttons">
            <button
              className="btn btn-danger"
              onClick={() => handleOperation('setup')}
              disabled={showLoading}
            >
              🔄 Full Setup
              <span className="btn-description">
                Drop database, recreate tables, and import CSV
              </span>
            </button>

            <button
              className="btn btn-success"
              onClick={() => handleOperation('import')}
              disabled={isLoading}
            >
              📥 Import Only
              <span className="btn-description">
                Import CSV without destroying existing data
              </span>
            </button>
          </div>

          {logs.length > 0 && (
            <div className="logs-container">
              <h3>Operation Log:</h3>
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

          {showLoading && (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Processing... Please wait</p>
              <button
                onClick={() => {
                  console.log('Force stopping loading');
                  setIsLoading(false);
                }}
                style={{
                  marginTop: '10px',
                  padding: '5px 10px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Force Stop (if stuck)
              </button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={showLoading}
          >
            {showLoading ? 'Processing...' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};


