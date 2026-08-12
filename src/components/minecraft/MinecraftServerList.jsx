import React from 'react';
import { Gamepad2, Settings, Terminal, Package, RotateCw, Play, Square, Trash2, Copy } from 'lucide-react';

export default function MinecraftServerList({
  servers,
  isLoading,
  onOpenConfig,
  onOpenLogs,
  onOpenMods,
  onOpenBackups,
  onToggleVoicePort,
  voicePortStatus,
  voicePortMsg,
  onDeleteServer,
}) {
  if (isLoading) {
    return (
      <div className="chart-empty-state">
        <RotateCw className="spin" size={24} color="#06b6d4" />
        <span>Scanning remote host for Minecraft container instances...</span>
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="chart-empty-state">
        <Gamepad2 size={36} color="#64748b" />
        <p style={{ marginTop: '0.5rem', color: '#94a3b8' }}>No active Minecraft server containers detected.</p>
        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Switch to "Deploy New Instance" tab to spin up a Paper or Forge server!</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {servers.map((srv) => {
        const isRunning = srv.state === 'running' || srv.status.toLowerCase().includes('up');

        return (
          <div key={srv.name} className="glass-card" style={{ background: 'rgba(15, 23, 42, 0.7)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: isRunning ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${isRunning ? 'rgba(52, 211, 153, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Gamepad2 size={22} color={isRunning ? '#34d399' : '#f87171'} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>{srv.name}</h3>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{srv.motd || 'Minecraft Server'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span className={`health-badge ${isRunning ? 'ONLINE' : 'OFFLINE'}`}>
                  {isRunning ? 'RUNNING' : 'STOPPED'}
                </span>
                <button
                  className="btn btn-sm"
                  onClick={() => onDeleteServer(srv.name)}
                  style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}
                  title="Delete Server & Volumes"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Quick Badges */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <span className="btn-pill">Type: <code>{srv.type}</code></span>
              <span className="btn-pill">Port: <code>{srv.port}</code></span>
              <span className="btn-pill">RAM: <code>{srv.memory}</code></span>
              <span className="btn-pill">Version: <code>{srv.version}</code></span>
            </div>

            {/* Server IP Copy */}
            <div
              style={{
                padding: '0.65rem 0.85rem',
                marginBottom: '1rem',
                background: 'rgba(5, 8, 17, 0.8)',
                borderRadius: '8px',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <code style={{ fontSize: '0.82rem', color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                zenbook-server:{srv.port}
              </code>
              <button
                className="btn btn-sm btn-pill"
                onClick={() => {
                  navigator.clipboard.writeText(`zenbook-server:${srv.port}`);
                  alert(`Copied 'zenbook-server:${srv.port}' to clipboard!`);
                }}
              >
                <Copy size={12} /> Copy IP
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-sm" onClick={() => onOpenConfig(srv.name)}>
                <Settings size={13} /> Edit Config
              </button>

              <button className="btn btn-sm" onClick={() => onOpenLogs(srv.name)}>
                <Terminal size={13} /> Logs
              </button>

              <button className="btn btn-sm" onClick={() => onOpenMods(srv.name)}>
                <Package size={13} /> Mods
              </button>

              <button className="btn btn-sm" onClick={() => onOpenBackups(srv.name)}>
                Backups & Restore
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
