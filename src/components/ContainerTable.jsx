import React, { useState } from 'react';
import {
  Layers,
  Search,
  RotateCw,
  Play,
  Square,
  Terminal,
  Cpu,
  HardDrive,
  Network,
} from 'lucide-react';

export default function ContainerTable({
  containers,
  onRestartContainer,
  onContainerAction,
  onOpenLogs,
  actionStateMap = {},
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState('ALL');

  const filteredContainers = containers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.image.toLowerCase().includes(searchQuery.toLowerCase());
    const isUp = c.status.toLowerCase().includes('up') || c.state === 'running';
    if (filterState === 'RUNNING') return matchesSearch && isUp;
    if (filterState === 'STOPPED') return matchesSearch && !isUp;
    return matchesSearch;
  });

  return (
    <div className="glass-card container-section">
      <div className="table-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Layers size={20} color="#3b82f6" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Docker Containers Telemetry</h2>
          <span
            style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: '700',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {containers.length} Total
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div className="search-box">
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Filter by container name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              className={`btn btn-sm ${filterState === 'ALL' ? 'btn-primary' : ''}`}
              onClick={() => setFilterState('ALL')}
            >
              All
            </button>
            <button
              className={`btn btn-sm ${filterState === 'RUNNING' ? 'btn-primary' : ''}`}
              onClick={() => setFilterState('RUNNING')}
            >
              Running
            </button>
            <button
              className={`btn btn-sm ${filterState === 'STOPPED' ? 'btn-primary' : ''}`}
              onClick={() => setFilterState('STOPPED')}
            >
              Stopped
            </button>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Container</th>
              <th>Status</th>
              <th>CPU %</th>
              <th>Memory (Used / Limit)</th>
              <th>Network I/O</th>
              <th>PIDs</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContainers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No docker containers matching filter criteria.
                </td>
              </tr>
            ) : (
              filteredContainers.map((c) => {
                const isUp = c.status.toLowerCase().includes('up') || c.state === 'running';
                const activeAction = actionStateMap[c.name];
                const isProcessing = Boolean(activeAction);

                return (
                  <tr key={c.id || c.name}>
                    <td>
                      <div className="container-name-cell">
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: isUp ? '#10b981' : '#ef4444',
                            boxShadow: isUp ? '0 0 8px #10b981' : '0 0 8px #ef4444',
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: '600' }}>{c.name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }} className="mono-text">
                            {c.id ? c.id.slice(0, 12) : ''} • {c.image}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className="mono-text"
                        style={{
                          fontSize: '0.78rem',
                          color: activeAction
                            ? '#fbbf24'
                            : isUp
                            ? '#34d399'
                            : '#f87171',
                          fontWeight: '600',
                        }}
                      >
                        {activeAction
                          ? `${activeAction.toUpperCase()}...`
                          : c.status}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Cpu size={13} color="#06b6d4" />
                        <span className="mono-text" style={{ fontWeight: '600' }}>
                          {c.cpu || '0.0%'}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <HardDrive size={13} color="#3b82f6" />
                        <div>
                          <span className="mono-text" style={{ fontWeight: '600' }}>
                            {c.mem || '0B'}
                          </span>
                          <span
                            className="mono-text"
                            style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '0.35rem' }}
                          >
                            ({c.memPerc || '0%'})
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Network size={13} color="#a78bfa" />
                        <span className="mono-text" style={{ fontSize: '0.78rem' }}>
                          {c.netIO || '0B / 0B'}
                        </span>
                      </div>
                    </td>

                    <td className="mono-text" style={{ color: '#94a3b8' }}>
                      {c.pids || '0'}
                    </td>

                    <td>
                      <div
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}
                      >
                        <button
                          className="btn btn-sm"
                          onClick={() => onOpenLogs(c.name)}
                          title="View Live Docker Logs"
                        >
                          <Terminal size={13} />
                          <span>Logs</span>
                        </button>

                        <button
                          className="btn btn-sm"
                          onClick={() => onRestartContainer(c.name)}
                          disabled={isProcessing}
                          title="Restart Container"
                        >
                          <RotateCw size={13} className={activeAction === 'restart' ? 'spin' : ''} />
                          <span>{activeAction === 'restart' ? 'Restarting...' : 'Restart'}</span>
                        </button>

                        {isUp ? (
                          <button
                            className="btn btn-sm"
                            onClick={() => onContainerAction(c.name, 'stop')}
                            disabled={isProcessing}
                            title="Stop Container"
                            style={{ color: '#f87171' }}
                          >
                            {activeAction === 'stop' ? (
                              <RotateCw size={13} className="spin" />
                            ) : (
                              <Square size={13} />
                            )}
                            {activeAction === 'stop' && <span style={{ marginLeft: 4 }}>Stopping...</span>}
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm"
                            onClick={() => onContainerAction(c.name, 'start')}
                            disabled={isProcessing}
                            title="Start Container"
                            style={{ color: '#34d399' }}
                          >
                            {activeAction === 'start' ? (
                              <RotateCw size={13} className="spin" />
                            ) : (
                              <Play size={13} />
                            )}
                            {activeAction === 'start' && <span style={{ marginLeft: 4 }}>Starting...</span>}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
