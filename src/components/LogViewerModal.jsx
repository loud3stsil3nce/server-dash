import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, Copy, RefreshCw, Check, Search, Download } from 'lucide-react';

export default function LogViewerModal({ containerName, onClose }) {
  const [logs, setLogs] = useState('Loading container logs via SSH...');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filterText, setFilterText] = useState('');
  const logRef = useRef(null);

  const fetchLogs = async () => {
    if (!containerName) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/container/${containerName}/logs`);
      const text = await res.text();
      setLogs(text);
    } catch (err) {
      setLogs(`Error fetching logs: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [containerName]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = filterText
    ? logs
        .split('\n')
        .filter((line) => line.toLowerCase().includes(filterText.toLowerCase()))
        .join('\n')
    : logs;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '850px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Terminal size={20} color="#06b6d4" />
            <h2>Container Logs: {containerName}</h2>
          </div>
          <button className="btn btn-sm" onClick={onClose} style={{ border: 'none', padding: '0.4rem' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ paddingBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            {/* Search in logs */}
            <div className="search-box" style={{ width: '100%', maxWidth: '340px' }}>
              <Search size={14} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search log output..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-sm" onClick={handleCopy}>
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button className="btn btn-sm" onClick={fetchLogs} disabled={isLoading}>
                <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
                <span>{isLoading ? 'Fetching...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          <div className="log-terminal" ref={logRef}>
            {filteredLogs || 'No matching log entries found.'}
          </div>
        </div>

        <div className="modal-footer">
          <span style={{ fontSize: '0.78rem', color: '#64748b', marginRight: 'auto' }}>
            Showing last 100 log entries from Docker stdout/stderr
          </span>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
