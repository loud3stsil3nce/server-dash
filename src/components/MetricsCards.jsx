import React from 'react';
import { Cpu, HardDrive, Database, Layers, Thermometer, Zap } from 'lucide-react';

export default function MetricsCards({ systemStats, containersCount, onOpenProcesses, onOpenAiAssistant }) {
  const cpuPercent = systemStats?.cpuPercent || 0;
  const cpuCores = systemStats?.cpuCores || 20;
  const topProcess = systemStats?.topProcess || 'N/A';
  const memory = systemStats?.memory || { usedGb: 0, totalGb: 16, percent: 0 };
  const disk = systemStats?.disk || { usedGb: 0, totalGb: 512, percent: 0 };
  const tempC = systemStats?.tempC || '42.0';
  const loadAvg = systemStats?.loadAvg || ['0.00', '0.00', '0.00'];

  // Color dynamics based on usage thresholds
  const getCpuColor = (val) => (val > 80 ? '#ef4444' : val > 50 ? '#f59e0b' : '#06b6d4');
  const getMemColor = (val) => (val > 85 ? '#ef4444' : val > 65 ? '#f59e0b' : '#3b82f6');
  const getDiskColor = (val) => (val > 90 ? '#ef4444' : val > 75 ? '#f59e0b' : '#10b981');

  return (
    <div className="metrics-grid">
      {/* 1. CPU Usage */}
      <div className="glass-card metric-card cursor-pointer group hover:border-cyan-500/50 transition-all" onClick={onOpenProcesses} style={{ '--card-accent': getCpuColor(cpuPercent) }}>
        <div className="metric-header">
          <span className="metric-title flex items-center justify-between w-full">
            <span>Zenbook CPU Load ({cpuCores} Threads)</span>
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              Click for Processes ↗
            </span>
          </span>
          <div className="metric-icon-wrapper" style={{ color: getCpuColor(cpuPercent) }}>
            <Cpu size={20} />
          </div>
        </div>
        <div className="metric-value-row">
          <span className="metric-value">{cpuPercent}%</span>
          <span className="metric-subtext" title={`Load Avg: ${loadAvg.join(', ')}`}>
            {topProcess !== 'N/A' ? `Top: ${topProcess}` : `Load: ${loadAvg[0]}`}
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(100, cpuPercent)}%`,
              background: getCpuColor(cpuPercent),
            }}
          />
        </div>
      </div>

      {/* 2. Memory RAM */}
      <div className="glass-card metric-card cursor-pointer group hover:border-purple-500/50 transition-all" onClick={onOpenProcesses} style={{ '--card-accent': getMemColor(memory.percent) }}>
        <div className="metric-header">
          <span className="metric-title">System RAM Memory</span>
          <div className="metric-icon-wrapper" style={{ color: getMemColor(memory.percent) }}>
            <HardDrive size={20} />
          </div>
        </div>
        <div className="metric-value-row">
          <span className="metric-value">{memory.percent}%</span>
          <span className="metric-subtext">
            {memory.usedGb} / {memory.totalGb} GB
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(100, memory.percent)}%`,
              background: getMemColor(memory.percent),
            }}
          />
        </div>
      </div>

      {/* 3. Disk Storage */}
      <div className="glass-card metric-card" style={{ '--card-accent': getDiskColor(disk.percent) }}>
        <div className="metric-header">
          <span className="metric-title">Root Storage (SSD)</span>
          <div className="metric-icon-wrapper" style={{ color: getDiskColor(disk.percent) }}>
            <Database size={20} />
          </div>
        </div>
        <div className="metric-value-row">
          <span className="metric-value">{disk.percent}%</span>
          <span className="metric-subtext">
            {disk.usedGb} / {disk.totalGb} GB
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(100, disk.percent)}%`,
              background: getDiskColor(disk.percent),
            }}
          />
        </div>
      </div>

      {/* 4. Thermal & Docker Status */}
      <div className="glass-card metric-card cursor-pointer group hover:border-indigo-500/50 transition-all" onClick={onOpenAiAssistant} style={{ '--card-accent': '#8b5cf6' }}>
        <div className="metric-header">
          <span className="metric-title flex items-center justify-between w-full">
            <span>Host Thermal & AI</span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              Ask Ollama AI 🤖
            </span>
          </span>
          <div className="metric-icon-wrapper" style={{ color: '#8b5cf6' }}>
            <Thermometer size={20} />
          </div>
        </div>
        <div className="metric-value-row">
          <span className="metric-value">{tempC}°C</span>
          <span className="metric-subtext" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Layers size={14} color="#a78bfa" />
            <strong style={{ color: '#f8fafc' }}>{containersCount}</strong> Containers Active
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(100, (parseFloat(tempC) / 90) * 100)}%`,
              background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
