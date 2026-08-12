import React, { useState, useEffect } from 'react';
import { Gamepad2, Plus, Settings, Play, Square, RotateCw, Terminal, Check, X, Shield, Cpu, HardDrive, FileText, ExternalLink, Copy, Trash2, Package, Link, AlertCircle } from 'lucide-react';

const MC_VERSIONS = [
  '26.2', '26.1', '26.0',
  '1.21.4', '1.21.3', '1.21.1', '1.21',
  '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.20',
  '1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19',
  '1.18.2', '1.18.1', '1.18',
  '1.17.1', '1.17',
  '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1', '1.16',
  '1.15.2', '1.15.1', '1.15',
  '1.14.4', '1.14.3', '1.14.2', '1.14',
  '1.13.2', '1.13.1', '1.13',
  '1.12.2', '1.12.1', '1.12',
  '1.11.2', '1.11',
  '1.10.2',
  '1.9.4',
  '1.8.9', '1.8.8', '1.8',
  '1.7.10',
  'LATEST',
];

function getRecommendedJavaVersion(mcVersion) {
  if (!mcVersion) return 'java21';
  const v = mcVersion.trim();

  if (v.startsWith('26.') || v.toUpperCase() === 'LATEST') {
    return 'java25'; // Java 25 for 26.x snapshots & latest
  }

  const match = v.match(/^1\.(\d+)(?:\.(\d+))?/);
  if (match) {
    const minor = parseInt(match[1], 10);
    const patch = parseInt(match[2] || '0', 10);

    if (minor >= 21) return 'java21';
    if (minor === 20 && patch >= 5) return 'java21';
    if (minor >= 18) return 'java17';
    if (minor === 17) return 'java17';
    if (minor >= 13) return 'java11';
    return 'java8';
  }

  return 'java21';
}

export default function MinecraftManagerModal({ onClose, onOpenLogs, onTriggerRefresh }) {
  const [activeTab, setActiveTab] = useState('servers'); // 'servers' | 'create' | 'mods' | 'config'
  const [servers, setServers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Server Form State
  const [newServer, setNewServer] = useState({
    name: 'minecraft-creative',
    port: 25566,
    type: 'PAPER',
    version: '1.20.4',
    javaVersion: getRecommendedJavaVersion('1.20.4'),
    memory: '4G',
    mode: 'creative',
    difficulty: 'normal',
    motd: 'My Second Minecraft World',
    maxPlayers: 20,
    modpackUrl: '',
    mods: '',
  });
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState(null);

  // Mods Manager State
  const [selectedServerForMods, setSelectedServerForMods] = useState('');
  const [modsList, setModsList] = useState([]);

  // Voice Port State (per server name)
  const [voicePortStatus, setVoicePortStatus] = useState({}); // 'loading' | 'done' | 'error'
  const [voicePortMsg, setVoicePortMsg] = useState({});
  const [newModUrl, setNewModUrl] = useState('');
  const [isLoadingMods, setIsLoadingMods] = useState(false);
  const [isSavingMods, setIsSavingMods] = useState(false);
  const [modsResult, setModsResult] = useState(null);

  // Config Editor State
  const [selectedServerForConfig, setSelectedServerForConfig] = useState('');
  const [configContent, setConfigContent] = useState('');
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Fetch servers list
  const fetchServers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/minecraft/servers');
      const data = await res.json();
      setServers(data);
      if (data.length > 0 && !selectedServerForConfig) {
        setSelectedServerForConfig(data[0].name);
      }
      if (data.length > 0 && !selectedServerForMods) {
        setSelectedServerForMods(data[0].name);
      }
    } catch (err) {
      console.error('Error fetching Minecraft servers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  // Fetch server.properties for selected server
  const fetchProperties = async (serverName) => {
    if (!serverName) return;
    setIsLoadingConfig(true);
    try {
      const res = await fetch(`/api/minecraft/${serverName}/properties`);
      const text = await res.text();
      setConfigContent(text);
    } catch (err) {
      setConfigContent(`# Error loading properties: ${err.message}`);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'config' && selectedServerForConfig) {
      fetchProperties(selectedServerForConfig);
    }
    if (activeTab === 'mods' && selectedServerForMods) {
      fetchMods(selectedServerForMods);
    }
  }, [activeTab, selectedServerForConfig, selectedServerForMods]);

  // Handle Deploy New Server
  const handleDeployServer = async (e) => {
    e.preventDefault();
    setIsDeploying(true);
    setDeployResult(null);

    try {
      const res = await fetch('/api/minecraft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newServer),
      });
      const data = await res.json();

      if (data.success) {
        setDeployResult({ type: 'success', message: data.message });
        fetchServers();
        if (onTriggerRefresh) onTriggerRefresh();
        setTimeout(() => setActiveTab('servers'), 1500);
      } else {
        setDeployResult({ type: 'error', message: data.error || 'Failed to deploy server.' });
      }
    } catch (err) {
      setDeployResult({ type: 'error', message: `Deploy error: ${err.message}` });
    } finally {
      setIsDeploying(false);
    }
  };

  // Fetch mods for selected server
  const fetchMods = async (serverName) => {
    if (!serverName) return;
    setIsLoadingMods(true);
    setModsResult(null);
    try {
      const res = await fetch(`/api/minecraft/${serverName}/mods`);
      const data = await res.json();
      setModsList(data.mods || []);
    } catch (err) {
      setModsList([]);
    } finally {
      setIsLoadingMods(false);
    }
  };

  // Save updated mods list to container
  const handleSaveMods = async () => {
    if (!selectedServerForMods) return;
    setIsSavingMods(true);
    setModsResult(null);
    try {
      const res = await fetch(`/api/minecraft/${selectedServerForMods}/mods`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mods: modsList }),
      });
      const data = await res.json();
      setModsResult({ type: data.success ? 'success' : 'error', message: data.message || data.error });
      if (data.success && onTriggerRefresh) onTriggerRefresh();
    } catch (err) {
      setModsResult({ type: 'error', message: `Error: ${err.message}` });
    } finally {
      setIsSavingMods(false);
    }
  };

  // Install a mod from URL via wget + docker cp + restart
  const [installModUrl, setInstallModUrl] = useState('');
  const [isInstallingMod, setIsInstallingMod] = useState(false);
  const [installResult, setInstallResult] = useState(null);

  const handleInstallMod = async () => {
    if (!installModUrl.trim() || !selectedServerForMods) return;
    setIsInstallingMod(true);
    setInstallResult(null);
    try {
      const res = await fetch(`/api/minecraft/${selectedServerForMods}/install-mod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: installModUrl.trim() }),
      });
      const data = await res.json();
      setInstallResult({ type: data.success ? 'success' : 'error', message: data.message || data.error });
      if (data.success) {
        setInstallModUrl('');
        fetchMods(selectedServerForMods);
        if (onTriggerRefresh) onTriggerRefresh();
      }
    } catch (err) {
      setInstallResult({ type: 'error', message: `Error: ${err.message}` });
    } finally {
      setIsInstallingMod(false);
    }
  };

  // Drag & drop upload state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleDropUpload = async (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (!selectedServerForMods) return;

    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.jar'));
    if (files.length === 0) {
      setUploadResult({ type: 'error', message: 'Only .jar mod files are supported.' });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);
    const results = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('mod', file);
      try {
        const res = await fetch(`/api/minecraft/${selectedServerForMods}/upload-mod`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        results.push({ name: file.name, success: data.success, message: data.message || data.error });
      } catch (err) {
        results.push({ name: file.name, success: false, message: err.message });
      }
    }

    const allOk = results.every(r => r.success);
    setUploadResult({
      type: allOk ? 'success' : 'error',
      message: results.map(r => `${r.success ? '✅' : '❌'} ${r.name}: ${r.message}`).join(' | '),
    });
    setIsUploading(false);
    fetchMods(selectedServerForMods);
    if (allOk && onTriggerRefresh) onTriggerRefresh();
  };

  // Remove a single mod file from container and restart
  const handleRemoveMod = async (filename) => {
    if (!window.confirm(`Remove '${filename}' from ${selectedServerForMods}? Server will restart.`)) return;
    setModsResult(null);
    try {
      const res = await fetch(`/api/minecraft/${selectedServerForMods}/install-mod`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      setModsResult({ type: data.success ? 'success' : 'error', message: data.message || data.error });
      if (data.success) fetchMods(selectedServerForMods);
    } catch (err) {
      setModsResult({ type: 'error', message: `Error: ${err.message}` });
    }
  };

  // Handle Save Properties
  const handleSaveProperties = async () => {
    if (!selectedServerForConfig) return;
    setIsSavingConfig(true);
    try {
      const res = await fetch(`/api/minecraft/${selectedServerForConfig}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertiesContent: configContent }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Configuration saved and ${selectedServerForConfig} restarted!`);
        fetchServers();
      } else {
        alert(`Error: ${data.error || 'Failed to save configuration.'}`);
      }
    } catch (err) {
      alert(`Error saving configuration: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Handle Delete Server
  const handleDeleteServer = async (serverName) => {
    if (!window.confirm(`Are you sure you want to delete Minecraft server '${serverName}'?\nThis will stop the container and delete its data.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/minecraft/${serverName}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchServers();
        if (onTriggerRefresh) onTriggerRefresh();
      } else {
        alert(`Failed to delete server: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error deleting server: ${err.message}`);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card" style={{ maxWidth: '850px', width: '90%' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Gamepad2 size={22} style={{ color: '#06b6d4' }} />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                Minecraft Multi-Server Provisioning Manager
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                Deploy, configure, and manage multiple independent Minecraft servers on your Zenbook host.
              </p>
            </div>
          </div>
          <button className="btn btn-icon btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="tab-nav" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem', margin: '1rem 1.5rem 0.5rem 1.5rem' }}>
          <button
            className={`btn btn-sm ${activeTab === 'servers' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('servers')}
          >
            <Gamepad2 size={14} />
            <span>Active Servers ({servers.length})</span>
          </button>

          <button
            className={`btn btn-sm ${activeTab === 'create' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            <Plus size={14} />
            <span>+ Deploy New Server</span>
          </button>

          <button
            className={`btn btn-sm ${activeTab === 'mods' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('mods')}
          >
            <Package size={14} />
            <span>🧩 Mods Manager</span>
          </button>

          <button
            className={`btn btn-sm ${activeTab === 'config' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            <Settings size={14} />
            <span>Config & server.properties Editor</span>
          </button>
        </div>

        {/* Scrollable Modal Content Body */}
        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '1.25rem 1.5rem' }}>

        {/* Tab 1: Active Servers List */}
        {activeTab === 'servers' && (
          <div>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                <RotateCw size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
                <p>Scanning Docker containers for Minecraft server instances...</p>
              </div>
            ) : servers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', background: 'rgba(15,23,42,0.4)', borderRadius: '12px' }}>
                <Gamepad2 size={40} style={{ color: '#64748b', marginBottom: '0.75rem' }} />
                <h3>No Active Minecraft Servers Found</h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
                  Deploy your first Minecraft server using the + Deploy New Server wizard.
                </p>
                <button className="btn btn-primary" onClick={() => setActiveTab('create')}>
                  <Plus size={15} />
                  <span>Deploy First Server</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {servers.map((srv) => (
                  <div key={srv.name} className="glass-card" style={{ padding: '1rem', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', background: 'rgba(6,182,212,0.15)', borderRadius: '8px', color: '#06b6d4' }}>
                          <Gamepad2 size={20} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                            {srv.name}
                          </h3>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            Port: <code style={{ color: '#38bdf8' }}>:{srv.port}</code> &bull; MOTD: "{srv.motd}"
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={`health-badge ${srv.state === 'running' ? 'ONLINE' : 'OFFLINE'}`}>
                          {srv.state === 'running' ? '🟢 ONLINE' : '🔴 STOPPED'}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Specs Tags */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.75rem' }}>
                      <span className="btn-pill">Engine: <code>{srv.type}</code></span>
                      <span className="btn-pill">RAM: <code>{srv.memory}</code></span>
                      <span className="btn-pill">Mode: <code>{srv.mode}</code></span>
                      <span className="btn-pill">Diff: <code>{srv.difficulty}</code></span>
                      <span className="btn-pill">Version: <code>{srv.version}</code></span>
                    </div>

                    {/* Join in Minecraft App Box */}
                    <div
                      style={{
                        padding: '0.65rem 0.85rem',
                        marginBottom: '1rem',
                        background: 'rgba(5, 8, 17, 0.8)',
                        borderRadius: '8px',
                        border: '1px solid rgba(6, 182, 212, 0.25)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Gamepad2 size={13} /> Join in Minecraft App (Multiplayer):
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <code style={{ flex: 1, fontSize: '0.8rem', background: '#090d16', padding: '0.3rem 0.5rem', borderRadius: '5px', color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                          zenbook-server:{srv.port}
                        </code>
                        <button
                          className="btn btn-sm btn-pill"
                          onClick={() => {
                            navigator.clipboard.writeText(`zenbook-server:${srv.port}`);
                            alert(`Copied 'zenbook-server:${srv.port}' to clipboard! Paste into Minecraft App -> Multiplayer.`);
                          }}
                          style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem' }}
                        >
                          <Copy size={12} />
                          <span>Copy Server IP</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Instance Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          setSelectedServerForConfig(srv.name);
                          setActiveTab('config');
                        }}
                      >
                        <Settings size={13} />
                        <span>Edit Config</span>
                      </button>

                      <button
                        className="btn btn-sm"
                        onClick={() => onOpenLogs(srv.name)}
                      >
                        <Terminal size={13} />
                        <span>View Logs</span>
                      </button>

                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          setSelectedServerForMods(srv.name);
                          setActiveTab('mods');
                        }}
                        style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}
                      >
                        <Package size={13} />
                        <span>Mods</span>
                      </button>

                      <button
                        className="btn btn-sm"
                        disabled={voicePortStatus[srv.name] === 'loading'}
                        onClick={async () => {
                          setVoicePortStatus(prev => ({ ...prev, [srv.name]: 'loading' }));
                          try {
                            const res = await fetch(`/api/minecraft/${srv.name}/add-udp-port`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ udpPort: 24454 }),
                            });
                            const data = await res.json();
                            setVoicePortStatus(prev => ({ ...prev, [srv.name]: data.success ? 'done' : 'error' }));
                            setVoicePortMsg(prev => ({ ...prev, [srv.name]: data.message || data.error }));
                            if (data.success && onTriggerRefresh) onTriggerRefresh();
                          } catch (err) {
                            setVoicePortStatus(prev => ({ ...prev, [srv.name]: 'error' }));
                            setVoicePortMsg(prev => ({ ...prev, [srv.name]: err.message }));
                          }
                        }}
                        style={{
                          background: voicePortStatus[srv.name] === 'done' ? 'rgba(16,185,129,0.15)' : 'rgba(6,182,212,0.12)',
                          color: voicePortStatus[srv.name] === 'done' ? '#34d399' : '#22d3ee',
                          border: `1px solid ${voicePortStatus[srv.name] === 'done' ? 'rgba(16,185,129,0.4)' : 'rgba(6,182,212,0.3)'}`,
                        }}
                        title="Add UDP 24454 for Simple Voice Chat (recreates container, world preserved)"
                      >
                        {voicePortStatus[srv.name] === 'loading'
                          ? <RotateCw size={13} className="spin" />
                          : voicePortStatus[srv.name] === 'done'
                          ? <Check size={13} />
                          : <span>🔊</span>}
                        <span>{voicePortStatus[srv.name] === 'loading' ? 'Applying...' : voicePortStatus[srv.name] === 'done' ? 'Voice Port Active' : 'Add Voice Port'}</span>
                      </button>

                      <button
                        className="btn btn-sm"
                        onClick={() => handleDeleteServer(srv.name)}
                        title="Delete Minecraft Server Container"
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Delete Server</span>
                      </button>
                    </div>

                    {/* Voice port result message */}
                    {voicePortMsg[srv.name] && (
                      <div style={{
                        marginTop: '0.5rem',
                        fontSize: '0.75rem',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '6px',
                        background: voicePortStatus[srv.name] === 'done' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: voicePortStatus[srv.name] === 'done' ? '#34d399' : '#f87171',
                        border: `1px solid ${voicePortStatus[srv.name] === 'done' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      }}>
                        {voicePortMsg[srv.name]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Deploy New Minecraft Server Wizard */}
        {activeTab === 'create' && (
          <form onSubmit={handleDeployServer} style={{ display: 'grid', gap: '1rem' }}>
            {deployResult && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  background: deployResult.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: deployResult.type === 'success' ? '#34d399' : '#f87171',
                  border: `1px solid ${deployResult.type === 'success' ? '#10b981' : '#ef4444'}`,
                }}
              >
                {deployResult.message}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
              <div className="form-group">
                <label>Container / Instance Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newServer.name}
                  onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                  placeholder="e.g. minecraft-creative or minecraft-modded"
                  required
                />
              </div>

              <div className="form-group">
                <label>Host Port (TCP Port)</label>
                <input
                  type="number"
                  className="form-input"
                  value={newServer.port}
                  onChange={(e) => setNewServer({ ...newServer, port: parseInt(e.target.value, 10) })}
                  placeholder="25566"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
              <div className="form-group">
                <label>Server Engine / Type</label>
                <select
                  className="select-input"
                  value={newServer.type}
                  onChange={(e) => setNewServer({ ...newServer, type: e.target.value })}
                >
                  <option value="PAPER">Paper (Optimized Vanilla/Plugins)</option>
                  <option value="MODRINTH">Modrinth (.mrpack / Modpack Auto-Install)</option>
                  <option value="FABRIC">Fabric (Lightweight Modding Engine)</option>
                  <option value="FORGE">Forge (Full Heavy Modpacks)</option>
                  <option value="CURSEFORGE">CurseForge (CurseForge Pack URL)</option>
                  <option value="SPIGOT">Spigot (Standard Plugin Engine)</option>
                  <option value="PURPUR">Purpur (High-Performance Paper Fork)</option>
                  <option value="VANILLA">Vanilla (Official Mojang)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Minecraft Version</label>
                <select
                  className="select-input"
                  value={newServer.version}
                  onChange={(e) => {
                    const selectedVer = e.target.value;
                    const autoJava = getRecommendedJavaVersion(selectedVer);
                    setNewServer({
                      ...newServer,
                      version: selectedVer,
                      javaVersion: autoJava,
                    });
                  }}
                >
                  {MC_VERSIONS.map((v) => (
                    <option key={v} value={v}>
                      {v === 'LATEST' ? 'LATEST (Auto Download Latest)' : `Minecraft ${v}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Java Runtime Version</label>
                <select
                  className="select-input"
                  value={newServer.javaVersion}
                  onChange={(e) => setNewServer({ ...newServer, javaVersion: e.target.value })}
                >
                  <option value="java25">Java 25 (MC 26.x & Latest)</option>
                  <option value="java21">Java 21 (MC 1.20.5 - 1.21.x)</option>
                  <option value="java17">Java 17 (MC 1.18 - 1.20.4)</option>
                  <option value="java11">Java 11 (MC 1.13 - 1.16.5)</option>
                  <option value="java8">Java 8 (MC 1.7 - 1.12.2 Legacy)</option>
                </select>
                <span style={{ fontSize: '0.7rem', color: '#10b981', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Check size={11} /> Auto-matched for MC {newServer.version}
                </span>
              </div>

              <div className="form-group">
                <label>RAM Memory Limit</label>
                <select
                  className="select-input"
                  value={newServer.memory}
                  onChange={(e) => setNewServer({ ...newServer, memory: e.target.value })}
                >
                  <option value="2G">2 GB RAM</option>
                  <option value="4G">4 GB RAM</option>
                  <option value="6G">6 GB RAM</option>
                  <option value="8G">8 GB RAM (Recommended for Mods)</option>
                  <option value="12G">12 GB RAM</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ background: 'rgba(15,23,42,0.5)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(6,182,212,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontWeight: 600, margin: 0 }}>
                  <ExternalLink size={14} /> Server Modpack / Direct Download Link (Optional)
                </label>

                <a
                  href="https://modrinth.com/modpacks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-pill"
                  style={{ textDecoration: 'none', fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}
                >
                  <ExternalLink size={11} />
                  <span>Browse Modpacks on Modrinth</span>
                </a>
              </div>

              <input
                type="text"
                className="form-input"
                value={newServer.modpackUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  const isModrinth = val.toLowerCase().includes('modrinth') || val.toLowerCase().endsWith('.mrpack');
                  setNewServer((prev) => ({
                    ...prev,
                    modpackUrl: val,
                    type: isModrinth && prev.type !== 'MODRINTH' ? 'MODRINTH' : prev.type,
                  }));
                }}
                placeholder="Paste Modrinth .mrpack URL, Modrinth project link, or direct .zip link"
              />

              <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '0.4rem', lineHeight: '1.4' }}>
                <p style={{ margin: '0 0 0.25rem 0', color: '#38bdf8', fontWeight: 600 }}>
                  💡 Modpack Quick Guide & Fixes:
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  <li><strong>Modrinth Packs (.mrpack):</strong> Auto-detected! Dashboard now uses native <code>TYPE=MODRINTH</code> which fixes <em>Permission denied</em> and timeout errors.</li>
                  <li><strong>How to get Modrinth link:</strong> Go to Modrinth &rarr; select Modpack &rarr; click <em>Versions</em> &rarr; right-click <em>Download</em> &rarr; <em>Copy Link Address</em>.</li>
                  <li><strong>Vanilla/Paper Server:</strong> Leave this field <strong>completely blank</strong>.</li>
                </ul>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
              <div className="form-group">
                <label>Game Mode</label>
                <select
                  className="select-input"
                  value={newServer.mode}
                  onChange={(e) => setNewServer({ ...newServer, mode: e.target.value })}
                >
                  <option value="survival">Survival</option>
                  <option value="creative">Creative</option>
                  <option value="adventure">Adventure</option>
                  <option value="spectator">Spectator</option>
                </select>
              </div>

              <div className="form-group">
                <label>Difficulty</label>
                <select
                  className="select-input"
                  value={newServer.difficulty}
                  onChange={(e) => setNewServer({ ...newServer, difficulty: e.target.value })}
                >
                  <option value="peaceful">Peaceful</option>
                  <option value="easy">Easy</option>
                  <option value="normal">Normal</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div className="form-group">
                <label>Max Players</label>
                <input
                  type="number"
                  className="form-input"
                  value={newServer.maxPlayers}
                  onChange={(e) => setNewServer({ ...newServer, maxPlayers: parseInt(e.target.value, 10) })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>MOTD Server Description Tagline</label>
              <input
                type="text"
                className="form-input"
                value={newServer.motd}
                onChange={(e) => setNewServer({ ...newServer, motd: e.target.value })}
                placeholder="My Custom Minecraft Server!"
              />
            </div>

            <div className="form-group" style={{ background: 'rgba(15,23,42,0.5)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <Package size={14} style={{ color: '#a78bfa' }} />
                <label style={{ color: '#a78bfa', fontWeight: 600, margin: 0, fontSize: '0.85rem' }}>Server-Wide Mods (Optional)</label>
              </div>
              <textarea
                className="form-input"
                rows={3}
                value={newServer.mods}
                onChange={(e) => setNewServer({ ...newServer, mods: e.target.value })}
                placeholder="Paste mod download URLs or Modrinth mod IDs, comma-separated&#10;e.g. https://cdn.modrinth.com/.../lithium.jar, https://cdn.modrinth.com/.../starlight.jar"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', resize: 'vertical' }}
              />
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                💡 These will be auto-downloaded into <code>/data/mods</code> on first boot via <code>MODS=</code> env var. Use the <strong>Mods Manager tab</strong> to add/remove mods from existing servers.
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isDeploying}
              style={{ marginTop: '0.5rem', justifySelf: 'flex-start' }}
            >
              {isDeploying ? <RotateCw size={15} className="spin" /> : <Plus size={15} />}
              <span>{isDeploying ? 'Deploying Server Container via SSH...' : 'Deploy Minecraft Server'}</span>
            </button>
          </form>
        )}

        {/* Tab 3: Mods Manager */}
        {activeTab === 'mods' && (
          <div>
            {/* Server Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap' }}>Target Server:</label>
              <select
                className="select-input"
                style={{ maxWidth: '280px' }}
                value={selectedServerForMods}
                onChange={(e) => {
                  setSelectedServerForMods(e.target.value);
                  fetchMods(e.target.value);
                  setInstallResult(null);
                  setModsResult(null);
                }}
              >
                {servers.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} (:{s.port})
                  </option>
                ))}
              </select>
            </div>

            {/* Drag & Drop Zone + URL Installer */}

            {/* Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDropUpload}
              style={{
                border: `2px dashed ${isDraggingOver ? '#a78bfa' : 'rgba(167,139,250,0.35)'}`,
                borderRadius: '12px',
                padding: '1.5rem 1rem',
                marginBottom: '0.85rem',
                textAlign: 'center',
                background: isDraggingOver ? 'rgba(167,139,250,0.12)' : 'rgba(15,23,42,0.3)',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onClick={() => {
                // Allow clicking to open file picker too
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.jar';
                input.multiple = true;
                input.onchange = (e) => handleDropUpload({ preventDefault: () => {}, dataTransfer: { files: e.target.files } });
                input.click();
              }}
            >
              {isUploading ? (
                <>
                  <RotateCw size={28} className="spin" style={{ color: '#a78bfa', marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#c4b5fd', fontWeight: 600 }}>Uploading via SCP...</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>Mac → Zenbook → {selectedServerForMods}/data/mods/</p>
                </>
              ) : (
                <>
                  <Package size={28} style={{ color: isDraggingOver ? '#a78bfa' : '#475569', marginBottom: '0.5rem', transition: 'color 0.2s' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem', color: isDraggingOver ? '#c4b5fd' : '#94a3b8', fontWeight: 600 }}>
                    {isDraggingOver ? '📦 Drop to install!' : 'Drag & drop .jar mod files here'}
                  </p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.73rem', color: '#475569' }}>or click to browse — uploaded via SCP over SSH</p>
                </>
              )}
            </div>

            {/* Upload Result */}
            {uploadResult && (
              <div style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                marginBottom: '0.85rem',
                display: 'flex', alignItems: 'flex-start', gap: '0.4rem',
                background: uploadResult.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: uploadResult.type === 'success' ? '#34d399' : '#f87171',
                border: `1px solid ${uploadResult.type === 'success' ? '#10b981' : '#ef4444'}`,
                wordBreak: 'break-word',
              }}>
                {uploadResult.type === 'success' ? <Check size={13} style={{ flexShrink: 0, marginTop: '0.1rem' }} /> : <AlertCircle size={13} style={{ flexShrink: 0, marginTop: '0.1rem' }} />}
                {uploadResult.message}
              </div>
            )}

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: '0.72rem', color: '#475569', whiteSpace: 'nowrap' }}>or install from URL</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* URL Installer */}
            <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#c4b5fd', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Plus size={14} /> Install Mod from URL
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.65rem', lineHeight: 1.5 }}>
                Paste the <strong>direct CDN .jar link</strong> from Modrinth (Versions tab → right-click Download → Copy Link Address). The dashboard will wget it and copy it into <code>/data/mods/</code> automatically.
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
                  value={installModUrl}
                  onChange={(e) => setInstallModUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleInstallMod(); }}
                  placeholder="https://cdn.modrinth.com/.../modname-forge-1.20.1-x.x.x.jar"
                  disabled={isInstallingMod}
                />
                <button
                  className="btn btn-primary"
                  style={{ flexShrink: 0 }}
                  onClick={handleInstallMod}
                  disabled={isInstallingMod || !installModUrl.trim() || !selectedServerForMods}
                >
                  {isInstallingMod ? <RotateCw size={14} className="spin" /> : <Plus size={14} />}
                  <span>{isInstallingMod ? 'Installing...' : 'Install'}</span>
                </button>
              </div>
              {installResult && (
                <div style={{
                  marginTop: '0.65rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: installResult.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                  color: installResult.type === 'success' ? '#34d399' : '#f87171',
                  border: `1px solid ${installResult.type === 'success' ? '#10b981' : '#ef4444'}`,
                }}>
                  {installResult.type === 'success' ? <Check size={13} /> : <AlertCircle size={13} />}
                  {installResult.message}
                </div>
              )}
            </div>

            {/* Result Banner for remove actions */}
            {modsResult && (
              <div style={{
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                marginBottom: '0.85rem',
                background: modsResult.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: modsResult.type === 'success' ? '#34d399' : '#f87171',
                border: `1px solid ${modsResult.type === 'success' ? '#10b981' : '#ef4444'}`,
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                {modsResult.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                {modsResult.message}
              </div>
            )}

            {/* Installed Mods List */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Installed Mods ({modsList.length})</span>
                <button className="btn btn-sm btn-pill" onClick={() => fetchMods(selectedServerForMods)} disabled={isLoadingMods} style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                  <RotateCw size={11} className={isLoadingMods ? 'spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>

              {isLoadingMods ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                  <RotateCw size={20} className="spin" />
                  <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Reading /data/mods/ from container...</p>
                </div>
              ) : modsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.25rem', background: 'rgba(15,23,42,0.4)', borderRadius: '10px', color: '#64748b', fontSize: '0.85rem' }}>
                  <Package size={26} style={{ marginBottom: '0.4rem', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>No mods found in <code>/data/mods/</code></p>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem' }}>Use the installer above to add your first mod.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {modsList.map((mod, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.55rem 0.85rem',
                        background: 'rgba(15,23,42,0.6)',
                        borderRadius: '8px',
                        border: '1px solid rgba(167,139,250,0.18)',
                      }}
                    >
                      <Package size={13} style={{ color: '#a78bfa', flexShrink: 0 }} />
                      <code style={{ flex: 1, fontSize: '0.75rem', color: '#c4b5fd', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                        {mod}
                      </code>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleRemoveMod(mod)}
                        style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', flexShrink: 0, padding: '0.2rem 0.45rem', fontSize: '0.7rem' }}
                        title="Remove mod & restart server"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Config & server.properties Editor */}
        {activeTab === 'config' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>Target Server Instance:</label>
              <select
                className="select-input"
                style={{ maxWidth: '250px' }}
                value={selectedServerForConfig}
                onChange={(e) => setSelectedServerForConfig(e.target.value)}
              >
                {servers.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} (:{s.port})
                  </option>
                ))}
              </select>
            </div>

            {isLoadingConfig ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                <RotateCw size={24} className="spin" />
                <p>Loading server.properties file from container...</p>
              </div>
            ) : (
              <div>
                <textarea
                  className="form-input"
                  style={{
                    width: '100%',
                    height: '280px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    background: '#050811',
                    color: '#38bdf8',
                    padding: '0.85rem',
                    lineHeight: '1.5',
                  }}
                  value={configContent}
                  onChange={(e) => setConfigContent(e.target.value)}
                />

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveProperties}
                    disabled={isSavingConfig}
                  >
                    {isSavingConfig ? <RotateCw size={15} className="spin" /> : <FileText size={15} />}
                    <span>{isSavingConfig ? 'Saving & Restarting Server...' : 'Save & Restart Server'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ margin: 0 }}>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
