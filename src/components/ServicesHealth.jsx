import React, { useState } from 'react';
import {
  ShieldCheck,
  Gamepad2,
  Cpu,
  Compass,
  Wifi,
  ExternalLink,
  RotateCw,
  Terminal,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Server,
  Copy,
} from 'lucide-react';

const ICON_MAP = {
  ShieldCheck: ShieldCheck,
  Gamepad2: Gamepad2,
  Cpu: Cpu,
  Compass: Compass,
  Wifi: Wifi,
  Server: Server,
};

// Helper SVG Sparkline Component
function LatencySparkline({ data = [], status }) {
  if (!data || data.length === 0) {
    data = [20, 22, 18, 25, 21, 19, 24];
  }
  const max = Math.max(...data, 50);
  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1 || 1)) * 280;
      const y = 30 - (val / max) * 26;
      return `${x},${y}`;
    })
    .join(' ');

  const strokeColor = status === 'ONLINE' ? '#10b981' : status === 'DEGRADED' ? '#f59e0b' : '#ef4444';

  return (
    <svg className="latency-sparkline" viewBox="0 0 280 32" preserveAspectRatio="none">
      <polyline fill="none" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" points={points} />
    </svg>
  );
}

export default function ServicesHealth({
  services,
  tailscaleIp,
  sshHost,
  onRestartContainer,
  onOpenLogs,
  onOpenMinecraftManager,
  actionStateMap = {},
}) {
  const hostName = sshHost || tailscaleIp || 'zenbook-server';
  const [copiedSvcId, setCopiedSvcId] = useState(null);

  return (
    <div className="services-section">
      <div className="section-title-bar">
        <div className="section-title">
          <Activity size={20} color="#06b6d4" />
          <span>Homelab Services Health Matrix</span>
        </div>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
          Endpoints checked directly via MagicDNS & local socket ping
        </span>
      </div>

      <div className="services-grid">
        {services.map((svc) => {
          const IconComponent = ICON_MAP[svc.icon] || Server;
          const health = svc.health || { status: 'UNKNOWN', latency: null, code: 0, message: 'Checking...' };
          const isOnline = health.status === 'ONLINE';
          const isDegraded = health.status === 'DEGRADED';
          const activeAction = actionStateMap[svc.containerName];
          const isProcessing = Boolean(activeAction);

          const webUrl = svc.uiUrl
            ? svc.uiUrl
            : svc.protocol === 'http' || svc.protocol === 'https'
            ? `${svc.protocol}://${hostName}:${svc.uiPort || svc.port}${svc.uiPath !== undefined ? svc.uiPath : (svc.healthPath || '')}`
            : null;

          return (
            <div key={svc.id} className="glass-card service-card">
              <div>
                <div className="service-top">
                  <div className="service-info">
                    <div className="service-icon-box" style={{ color: isOnline ? '#06b6d4' : '#94a3b8' }}>
                      <IconComponent size={22} />
                    </div>
                    <div className="service-title">
                      <h3>{svc.name}</h3>
                      <span className="service-category">{svc.category}</span>
                    </div>
                  </div>

                  <div className={`health-badge ${health.status}`}>
                    {isOnline ? (
                      <CheckCircle2 size={12} />
                    ) : health.status === 'STARTING' ? (
                      <RotateCw size={12} className="spin" />
                    ) : isDegraded ? (
                      <AlertCircle size={12} />
                    ) : (
                      <XCircle size={12} />
                    )}
                    <span>{health.status === 'STARTING' ? 'INITIALIZING' : health.status}</span>
                  </div>
                </div>

                <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                  {svc.description}
                </p>

                <div className="service-meta">
                  <span>
                    Port <strong className="mono-text">{svc.port}</strong> ({svc.protocol.toUpperCase()})
                  </span>
                  <span>
                    Latency:{' '}
                    <strong className="mono-text" style={{ color: isOnline ? '#10b981' : '#ef4444' }}>
                      {health.latency !== null ? `${health.latency}ms` : 'Offline'}
                    </strong>
                  </span>
                </div>

                {/* Sparkline chart */}
                <div style={{ position: 'relative' }}>
                  <LatencySparkline data={svc.latencyHistory} status={health.status} />
                </div>
              </div>

              {/* Minecraft App Join Address Box */}
              {(svc.category === 'Gaming' || svc.id.toLowerCase().includes('minecraft') || svc.id.toLowerCase().includes('mc') || (svc.description && svc.description.toLowerCase().includes('minecraft'))) && (
                <div
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(15, 23, 42, 0.75)',
                    borderRadius: '8px',
                    border: '1px solid rgba(6, 182, 212, 0.25)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#38bdf8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <Gamepad2 size={13} /> Join in Minecraft App:
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Multiplayer Server IP</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <code
                      style={{
                        flex: 1,
                        fontSize: '0.82rem',
                        background: '#050811',
                        padding: '0.3rem 0.5rem',
                        borderRadius: '5px',
                        color: '#34d399',
                        fontFamily: 'var(--font-mono)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {hostName}:{svc.port}
                    </code>
                    <button
                      className="btn btn-sm btn-pill"
                      onClick={() => {
                        navigator.clipboard.writeText(`${hostName}:${svc.port}`);
                        setCopiedSvcId(svc.id);
                        setTimeout(() => setCopiedSvcId(null), 2000);
                      }}
                      title="Copy Server Address for Minecraft Client"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}
                    >
                      <Copy size={12} />
                      <span>{copiedSvcId === svc.id ? 'Copied!' : 'Copy IP'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="service-actions" style={{ marginTop: '0.75rem' }}>
                {webUrl && (
                  <a
                    href={webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm"
                    style={{ flex: 1, textDecoration: 'none' }}
                  >
                    <ExternalLink size={13} />
                    <span>{svc.btnLabel || (svc.id === 'verizon-wifi' ? 'Open Router Settings' : svc.id === 'ollama' ? 'Launch Open WebUI' : svc.id === 'pihole' ? 'Open Pi-hole Admin' : svc.id === 'odysseus' ? 'Open Odysseus Portal' : 'Open Web UI')}</span>
                  </a>
                )}

                {(svc.category === 'Gaming' || svc.id.toLowerCase().includes('minecraft') || svc.id.toLowerCase().includes('mc') || (svc.description && svc.description.toLowerCase().includes('minecraft'))) && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => onOpenMinecraftManager && onOpenMinecraftManager(svc.containerName)}
                    title="Manage Minecraft Servers & Config"
                  >
                    <Gamepad2 size={13} />
                    <span>Manage / Provision</span>
                  </button>
                )}

                <button
                  className="btn btn-sm"
                  onClick={() => onOpenLogs(svc.containerName)}
                  title="View Live Container Logs"
                >
                  <Terminal size={13} />
                  <span>Logs</span>
                </button>

                <button
                  className="btn btn-sm"
                  onClick={() => onRestartContainer(svc.containerName)}
                  disabled={isProcessing}
                  title="Restart Container via SSH"
                  style={{
                    background: isProcessing ? 'rgba(245, 158, 11, 0.2)' : undefined,
                    color: isProcessing ? '#fbbf24' : undefined,
                  }}
                >
                  <RotateCw size={13} className={activeAction === 'restart' ? 'spin' : ''} />
                  <span>{activeAction === 'restart' ? 'Restarting...' : 'Restart'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
