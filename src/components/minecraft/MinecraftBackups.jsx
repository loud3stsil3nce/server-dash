import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, RotateCcw, Plus } from 'lucide-react';

export default function MinecraftBackups({ serverName, onToast }) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/minecraft/${serverName}/backups`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setBackups(data);
      }
    } catch (err) {
      console.error('Error fetching backups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [serverName]);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/minecraft/${serverName}/backup`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (onToast) onToast({ type: 'success', message: data.message });
        fetchBackups();
      } else {
        if (onToast) onToast({ type: 'error', message: data.error || 'Backup creation failed' });
      }
    } catch (err) {
      if (onToast) onToast({ type: 'error', message: err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (filename) => {
    if (!window.confirm(`Are you sure you want to restore world from ${filename}? Current world state will be replaced.`)) return;
    setRestoring(filename);
    try {
      const res = await fetch(`/api/minecraft/${serverName}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (data.success) {
        if (onToast) onToast({ type: 'success', message: data.message });
      } else {
        if (onToast) onToast({ type: 'error', message: data.error || 'Restore failed' });
      }
    } catch (err) {
      if (onToast) onToast({ type: 'error', message: err.message });
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>World Backups for `{serverName}`</h3>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Automated tar.gz archives stored on host filesystem</p>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={creating}
          className="btn btn-primary btn-sm"
        >
          {creating ? <RefreshCw className="spin" size={14} /> : <Plus size={14} />}
          <span>{creating ? 'Creating Snapshot...' : 'Create World Snapshot'}</span>
        </button>
      </div>

      {loading ? (
        <div className="chart-empty-state">
          <RefreshCw className="spin" size={20} color="#06b6d4" />
          <span>Loading backups...</span>
        </div>
      ) : backups.length === 0 ? (
        <div className="chart-empty-state">
          <Download size={28} color="#64748b" />
          <span>No backups found for {serverName}. Click "Create World Snapshot" to save current state!</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {backups.map((b) => (
            <div
              key={b.id || b.filename}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                background: 'rgba(5, 8, 17, 0.7)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div>
                <span className="mono-text" style={{ fontSize: '0.83rem', color: '#38bdf8', fontWeight: 600 }}>{b.filename}</span>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  Size: {b.size} | Date: {b.date}
                </div>
              </div>

              <button
                onClick={() => handleRestore(b.filename)}
                disabled={restoring === b.filename}
                className="btn btn-sm"
                style={{ color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)' }}
              >
                <RotateCcw size={13} className={restoring === b.filename ? 'spin' : ''} />
                <span>{restoring === b.filename ? 'Restoring...' : 'Restore'}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
