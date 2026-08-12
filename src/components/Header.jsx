import React from 'react';
import {
  Server,
  RefreshCw,
  Settings,
  ShieldCheck,
  Wifi,
  Clock,
  Terminal,
  Activity,
  AlertTriangle,
} from 'lucide-react';

export default function Header({
  systemStats,
  onRefresh,
  isRefreshing,
  refreshInterval,
  onIntervalChange,
  onOpenSettings,
}) {
  const isLive = systemStats?.isLive;
  const mode = systemStats?.mode || 'CONNECTING...';
  const tailscaleIp = systemStats?.tailscaleIp || '100.115.220.54';
  const uptime = systemStats?.uptime || 'N/A';

  return (
    <header className="glass-card header-bar">
      <div className="brand-section">
        <div className="brand-icon">
          <Server size={24} />
        </div>
        <div className="brand-title">
          <h1>Zenbook Homelab</h1>
          <p>Tailscale Mesh • Live Docker & SSH Monitor</p>
        </div>
      </div>

      <div className="header-controls">
        {/* Connection Status Pill */}
        <div className={`status-badge ${isLive ? 'live' : 'demo'}`}>
          <span className={`pulse-dot ${isLive ? 'green' : 'blue'}`}></span>
          <span>{isLive ? 'SSH LIVE CONNECTED' : mode}</span>
        </div>

        {/* Tailscale IP Tag */}
        <div className="status-badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8' }}>
          <Wifi size={14} color="#06b6d4" />
          <span>{tailscaleIp}</span>
        </div>

        {/* Uptime Tag */}
        <div className="status-badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8' }}>
          <Clock size={14} color="#10b981" />
          <span>{uptime}</span>
        </div>

        {/* Refresh Interval Selector */}
        <select
          className="select-input"
          value={refreshInterval}
          onChange={(e) => onIntervalChange(Number(e.target.value))}
          title="Auto-refresh Polling Rate / Real-Time Stream"
        >
          <option value={1000}>⚡ Real-Time Stream (1s)</option>
          <option value={2000}>Refresh: 2s</option>
          <option value={5000}>Refresh: 5s</option>
          <option value={10000}>Refresh: 10s</option>
          <option value={30000}>Refresh: 30s</option>
          <option value={0}>Pause Refresh</option>
        </select>

        {/* Refresh Now Button */}
        <button className="btn" onClick={onRefresh} disabled={isRefreshing} title="Trigger Instant Sync">
          <RefreshCw size={15} className={isRefreshing ? 'spin' : ''} />
          <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
        </button>

        {/* Settings Button */}
        <button className="btn btn-primary" onClick={onOpenSettings} title="Configure SSH & Services">
          <Settings size={15} />
          <span>Config</span>
        </button>
      </div>

      {/* Connection Warning Banner if SSH failed */}
      {systemStats?.connectionError && (
        <div
          style={{
            width: '100%',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '10px',
            padding: '0.6rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: '#fbbf24',
            marginTop: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} />
            <span>
              <strong>SSH Connection Alert:</strong> {systemStats.connectionError}. Showing simulated telemetry.
            </span>
          </div>
          <button
            className="btn btn-sm"
            onClick={onOpenSettings}
            style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fff', border: 'none' }}
          >
            Configure SSH Keys
          </button>
        </div>
      )}
    </header>
  );
}
