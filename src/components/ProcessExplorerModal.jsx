import React, { useState, useEffect } from 'react';
import { X, Search, RefreshCw, Cpu } from 'lucide-react';

export default function ProcessExplorerModal({ onClose, onToast }) {
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [killingPid, setKillingPid] = useState(null);

  const fetchProcesses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/processes');
      const data = await res.json();
      if (data.processes) {
        setProcesses(data.processes);
      }
    } catch (err) {
      console.error('Error fetching processes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
    const interval = setInterval(fetchProcesses, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleKillProcess = async (pid) => {
    if (!window.confirm(`Are you sure you want to send SIGTERM to process PID ${pid}?`)) return;
    setKillingPid(pid);
    try {
      const res = await fetch('/api/processes/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, signal: 'TERM' }),
      });
      const data = await res.json();
      if (data.success) {
        if (onToast) onToast({ type: 'success', message: data.message });
        fetchProcesses();
      } else {
        if (onToast) onToast({ type: 'error', message: data.error || 'Failed to kill process' });
      }
    } catch (err) {
      if (onToast) onToast({ type: 'error', message: err.message });
    } finally {
      setKillingPid(null);
    }
  };

  const filtered = processes.filter(
    (p) => p.command.toLowerCase().includes(search.toLowerCase()) || p.user.toLowerCase().includes(search.toLowerCase()) || p.pid.includes(search)
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content process-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-box">
            <div className="modal-icon-badge">
              <Cpu size={20} color="#06b6d4" />
            </div>
            <div>
              <h2>System Process Explorer</h2>
              <p className="modal-subtitle">Live system process tree sorted by CPU utilization (`ps aux` view)</p>
            </div>
          </div>

          <div className="modal-header-actions">
            <button onClick={fetchProcesses} disabled={loading} className="btn btn-sm" title="Refresh processes">
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </button>
            <button onClick={onClose} className="btn btn-sm">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="process-search-bar">
          <div className="search-box" style={{ width: '100%' }}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search by PID, user, or command..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Process Table */}
        <div className="modal-body process-table-body">
          <table className="custom-table process-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>User</th>
                <th>CPU %</th>
                <th>RAM %</th>
                <th>Command</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((proc) => {
                const isCpuHigh = parseFloat(proc.cpu) > 15;
                const isMemHigh = parseFloat(proc.mem) > 15;
                return (
                  <tr key={proc.pid}>
                    <td className="mono-text" style={{ color: '#38bdf8', fontWeight: 600 }}>{proc.pid}</td>
                    <td style={{ color: '#cbd5e1' }}>{proc.user}</td>
                    <td>
                      <span className={`stat-pill ${isCpuHigh ? 'pill-high-cpu' : ''}`}>
                        {proc.cpu}%
                      </span>
                    </td>
                    <td>
                      <span className={`stat-pill ${isMemHigh ? 'pill-high-mem' : ''}`}>
                        {proc.mem}%
                      </span>
                    </td>
                    <td className="mono-text command-cell" title={proc.command}>
                      {proc.command}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleKillProcess(proc.pid)}
                        disabled={killingPid === proc.pid}
                        className="btn btn-sm btn-terminate"
                      >
                        {killingPid === proc.pid ? 'Killing...' : 'Terminate'}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-row">
                    No matching processes found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
