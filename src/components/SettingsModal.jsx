import React, { useState } from 'react';
import {
  Settings,
  X,
  Server,
  Key,
  Wifi,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Terminal,
  Activity,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

export default function SettingsModal({ config, onSaveConfig, onClose }) {
  const [activeTab, setActiveTab] = useState('ssh'); // 'ssh' | 'services'
  const [formConfig, setFormConfig] = useState({ ...config });
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // New service form state
  const [newSvc, setNewSvc] = useState({
    id: '',
    name: '',
    category: 'Custom Service',
    containerName: '',
    port: 80,
    protocol: 'http',
    healthPath: '/',
    icon: 'Server',
    description: '',
  });

  const handleConfigChange = (field, val) => {
    setFormConfig((prev) => ({ ...prev, [field]: val }));
  };

  const handleTestSsh = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/test-ssh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formConfig),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSaveConfig(formConfig);
    onClose();
  };

  const handleAddService = (e) => {
    e.preventDefault();
    if (!newSvc.name || !newSvc.containerName || !newSvc.port) return;

    const svcId = newSvc.id || newSvc.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const serviceToAdd = { ...newSvc, id: svcId };

    const updatedServices = [...(formConfig.services || []), serviceToAdd];
    handleConfigChange('services', updatedServices);

    setNewSvc({
      id: '',
      name: '',
      category: 'Custom Service',
      containerName: '',
      port: 80,
      protocol: 'http',
      healthPath: '/',
      icon: 'Server',
      description: '',
    });
  };

  const handleDeleteService = (svcId) => {
    const updated = (formConfig.services || []).filter((s) => s.id !== svcId);
    handleConfigChange('services', updated);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Settings size={20} color="#06b6d4" />
            <h2>Zenbook Homelab Dashboard Configuration</h2>
          </div>
          <button className="btn btn-sm" onClick={onClose} style={{ border: 'none', padding: '0.4rem' }}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(15, 23, 42, 0.5)',
            padding: '0 1.5rem',
          }}
        >
          <button
            style={{
              padding: '0.75rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'ssh' ? '2px solid #06b6d4' : '2px solid transparent',
              color: activeTab === 'ssh' ? '#06b6d4' : '#94a3b8',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            onClick={() => setActiveTab('ssh')}
          >
            <Server size={15} />
            SSH & Tailscale Connection
          </button>

          <button
            style={{
              padding: '0.75rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'services' ? '2px solid #06b6d4' : '2px solid transparent',
              color: activeTab === 'services' ? '#06b6d4' : '#94a3b8',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            onClick={() => setActiveTab('services')}
          >
            <Activity size={15} />
            Manage Homelab Services ({formConfig.services?.length || 0})
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'ssh' ? (
            <>
              {/* Demo Mode Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(30, 41, 59, 0.5)',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.88rem' }}>Simulation / Demo Mode</strong>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Use mock telemetry stream without establishing live SSH connection
                  </p>
                </div>
                <button
                  className="btn btn-sm"
                  onClick={() => handleConfigChange('demoMode', !formConfig.demoMode)}
                  style={{
                    background: formConfig.demoMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: formConfig.demoMode ? '#60a5fa' : '#94a3b8',
                  }}
                >
                  {formConfig.demoMode ? <ToggleRight size={22} color="#3b82f6" /> : <ToggleLeft size={22} />}
                  <span>{formConfig.demoMode ? 'ENABLED' : 'OFF (Live SSH)'}</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>SSH Host / Domain</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formConfig.sshHost || ''}
                    onChange={(e) => handleConfigChange('sshHost', e.target.value)}
                    placeholder="zenbook-server or IP"
                  />
                </div>

                <div className="form-group">
                  <label>Tailscale IP</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formConfig.tailscaleIp || ''}
                    onChange={(e) => handleConfigChange('tailscaleIp', e.target.value)}
                    placeholder="100.115.220.54"
                  />
                </div>

                <div className="form-group">
                  <label>SSH User</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formConfig.sshUser || ''}
                    onChange={(e) => handleConfigChange('sshUser', e.target.value)}
                    placeholder="rafiurrahman"
                  />
                </div>

                <div className="form-group">
                  <label>SSH Port</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formConfig.sshPort || 22}
                    onChange={(e) => handleConfigChange('sshPort', Number(e.target.value))}
                    placeholder="22"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>SSH Private Key File Path</label>
                <input
                  type="text"
                  className="form-input"
                  value={formConfig.sshKeyPath || ''}
                  onChange={(e) => handleConfigChange('sshKeyPath', e.target.value)}
                  placeholder="~/.ssh/id_ed25519 or ~/.ssh/id_rsa"
                />
              </div>

              {/* Test SSH Button & Result */}
              <div>
                <button
                  type="button"
                  className="btn"
                  onClick={handleTestSsh}
                  disabled={isTesting}
                  style={{ width: '100%' }}
                >
                  <Terminal size={15} />
                  <span>{isTesting ? 'Testing SSH Handshake...' : 'Test SSH Connection to Zenbook'}</span>
                </button>

                {testResult && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: testResult.success
                        ? '1px solid rgba(16, 185, 129, 0.3)'
                        : '1px solid rgba(239, 68, 68, 0.3)',
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>
                      {testResult.success ? (
                        <>
                          <CheckCircle2 size={15} color="#10b981" />
                          <span style={{ color: '#10b981' }}>SSH Diagnostic Passed!</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={15} color="#ef4444" />
                          <span style={{ color: '#ef4444' }}>SSH Connection Refused / Failed</span>
                        </>
                      )}
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', color: '#94a3b8' }}>
                      {testResult.stdout || testResult.error}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Tracked Services List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: '#94a3b8' }}>Current Tracked Services</h3>

                {formConfig.services?.map((svc) => (
                  <div
                    key={svc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(30, 41, 59, 0.5)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.88rem' }}>{svc.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Container: <span className="mono-text">{svc.containerName}</span> • Port:{' '}
                        <span className="mono-text">{svc.port}</span> ({svc.protocol})
                      </div>
                    </div>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleDeleteService(svc.id)}
                      style={{ color: '#f87171', border: 'none', background: 'none' }}
                      title="Remove service"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Service Form */}
              <form
                onSubmit={handleAddService}
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: '#06b6d4' }}>Add Custom Service</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Service Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newSvc.name}
                      onChange={(e) => setNewSvc({ ...newSvc, name: e.target.value })}
                      placeholder="e.g. Home Assistant"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Container Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newSvc.containerName}
                      onChange={(e) => setNewSvc({ ...newSvc, containerName: e.target.value })}
                      placeholder="e.g. homeassistant"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Port</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newSvc.port}
                      onChange={(e) => setNewSvc({ ...newSvc, port: Number(e.target.value) })}
                      placeholder="8123"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Protocol</label>
                    <select
                      className="select-input"
                      value={newSvc.protocol}
                      onChange={(e) => setNewSvc({ ...newSvc, protocol: e.target.value })}
                    >
                      <option value="http">HTTP</option>
                      <option value="https">HTTPS</option>
                      <option value="tcp">TCP Socket</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Health Check Endpoint Path</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newSvc.healthPath}
                      onChange={(e) => setNewSvc({ ...newSvc, healthPath: e.target.value })}
                      placeholder="/api/version or /"
                    />
                  </div>

                  <div className="form-group">
                    <label>Open UI Link Path</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newSvc.uiPath || ''}
                      onChange={(e) => setNewSvc({ ...newSvc, uiPath: e.target.value })}
                      placeholder="/ or /admin"
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-sm" style={{ alignSelf: 'flex-start' }}>
                  <Plus size={15} />
                  <span>Add Service</span>
                </button>
              </form>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
