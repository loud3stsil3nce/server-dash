import React, { useState, useEffect } from 'react';
import { X, Gamepad2, Plus, RefreshCw } from 'lucide-react';
import MinecraftServerList from './minecraft/MinecraftServerList.jsx';
import MinecraftCreateForm from './minecraft/MinecraftCreateForm.jsx';
import MinecraftBackups from './minecraft/MinecraftBackups.jsx';

export default function MinecraftManagerModal({ onClose, onToast, onOpenLogs }) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create' | 'backups'
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedServerForBackup, setSelectedServerForBackup] = useState('');

  const fetchServers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/minecraft/servers');
      const data = await res.json();
      if (Array.isArray(data)) {
        setServers(data);
      }
    } catch (err) {
      console.error('Error fetching minecraft servers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleDeploy = async (formData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/minecraft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        if (onToast) onToast({ type: 'success', message: `Server '${formData.name}' deployed successfully!` });
        setActiveTab('list');
        fetchServers();
      } else {
        if (onToast) onToast({ type: 'error', message: data.error || 'Deployment failed' });
      }
    } catch (err) {
      if (onToast) onToast({ type: 'error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteServer = async (serverName) => {
    if (!window.confirm(`Are you sure you want to delete server '${serverName}'? Volume data will be removed.`)) return;
    try {
      const res = await fetch(`/api/minecraft/${serverName}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (onToast) onToast({ type: 'success', message: data.message });
        fetchServers();
      } else {
        if (onToast) onToast({ type: 'error', message: data.error || 'Deletion failed' });
      }
    } catch (err) {
      if (onToast) onToast({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content process-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-box">
            <div className="modal-icon-badge" style={{ background: 'rgba(52, 211, 153, 0.15)', borderColor: 'rgba(52, 211, 153, 0.3)' }}>
              <Gamepad2 size={20} color="#34d399" />
            </div>
            <div>
              <h2>Minecraft Server Suite</h2>
              <p className="modal-subtitle">Multi-instance container deployment, backups & server properties manager</p>
            </div>
          </div>

          <div className="modal-header-actions">
            <button onClick={fetchServers} disabled={loading} className="btn btn-sm" title="Refresh servers">
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </button>
            <button onClick={onClose} className="btn btn-sm">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="process-search-bar" style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('list')}
            className={`chart-tab-btn ${activeTab === 'list' ? 'active-cpu' : ''}`}
          >
            <Gamepad2 size={14} /> Active Servers ({servers.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`chart-tab-btn ${activeTab === 'create' ? 'active-mem' : ''}`}
          >
            <Plus size={14} /> Deploy New Instance
          </button>
          {selectedServerForBackup && (
            <button
              onClick={() => setActiveTab('backups')}
              className={`chart-tab-btn ${activeTab === 'backups' ? 'active-disk' : ''}`}
            >
              Backups (`{selectedServerForBackup}`)
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="modal-body process-table-body" style={{ padding: '1.25rem' }}>
          {activeTab === 'list' && (
            <MinecraftServerList
              servers={servers}
              isLoading={loading}
              onOpenConfig={(name) => alert(`Config editor for ${name}`)}
              onOpenLogs={(name) => onOpenLogs(name)}
              onOpenMods={(name) => alert(`Mod manager for ${name}`)}
              onOpenBackups={(name) => {
                setSelectedServerForBackup(name);
                setActiveTab('backups');
              }}
              onDeleteServer={handleDeleteServer}
            />
          )}

          {activeTab === 'create' && (
            <MinecraftCreateForm onDeploy={handleDeploy} isSubmitting={isSubmitting} />
          )}

          {activeTab === 'backups' && selectedServerForBackup && (
            <MinecraftBackups serverName={selectedServerForBackup} onToast={onToast} />
          )}
        </div>
      </div>
    </div>
  );
}
