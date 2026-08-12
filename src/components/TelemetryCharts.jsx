import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Database, Activity, BarChart2 } from 'lucide-react';

export default function TelemetryCharts({ systemStats }) {
  const [activeMetric, setActiveMetric] = useState('cpu'); // 'cpu' | 'memory' | 'disk'
  const [history, setHistory] = useState([]);

  // Store rolling 20 data points history
  useEffect(() => {
    if (!systemStats) return;

    const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const cpuVal = typeof systemStats.cpuPercent === 'number' ? systemStats.cpuPercent : parseFloat(systemStats.cpuPercent || 0);
    const ramVal = systemStats.memory?.percent || 0;
    const diskVal = systemStats.disk?.percent || 0;

    setHistory((prev) => {
      const next = [...prev, { time: timeLabel, cpu: cpuVal, memory: ramVal, disk: diskVal }];
      if (next.length > 20) next.shift();
      return next;
    });
  }, [systemStats]);

  // Generate smooth SVG polyline / path coordinates
  const renderSvgChart = (metricKey, strokeColor, fillColor) => {
    if (history.length < 2) {
      return (
        <div className="chart-empty-state">
          <Activity className="spin" size={24} color="#06b6d4" />
          <span>Collecting live telemetry data points...</span>
        </div>
      );
    }

    const width = 600;
    const height = 180;
    const padding = 20;

    const points = history.map((item, index) => {
      const x = padding + (index / (history.length - 1)) * (width - 2 * padding);
      const val = item[metricKey] || 0;
      const y = height - padding - (val / 100) * (height - 2 * padding);
      return { x, y, val };
    });

    const pathD = points.reduce((acc, point, i) => {
      return i === 0 ? `M ${point.x} ${point.y}` : `${acc} L ${point.x} ${point.y}`;
    }, '');

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    const currentVal = points[points.length - 1].val.toFixed(1);
    const maxVal = Math.max(...points.map((p) => p.val)).toFixed(1);
    const minVal = Math.min(...points.map((p) => p.val)).toFixed(1);

    return (
      <div className="chart-wrapper">
        <div className="chart-meta">
          <div className="chart-stat-badge">
            <span className="stat-label">Current</span>
            <span className="stat-val current">{currentVal}%</span>
          </div>
          <div className="chart-stat-badge">
            <span className="stat-label">Session Peak</span>
            <span className="stat-val peak">{maxVal}%</span>
          </div>
          <div className="chart-stat-badge">
            <span className="stat-label">Session Low</span>
            <span className="stat-val low">{minVal}%</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
          <defs>
            <linearGradient id={`grad-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity="0.45" />
              <stop offset="100%" stopColor={fillColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.12)" />

          {/* Fill Area */}
          <path d={areaD} fill={`url(#grad-${metricKey})`} />

          {/* Stroke Line */}
          <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points */}
          {points.map((p, idx) => (
            <circle key={idx} cx={p.x} cy={p.y} r={idx === points.length - 1 ? 5 : 3} fill={strokeColor}>
              <title>{`${history[idx]?.time}: ${p.val}%`}</title>
            </circle>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="glass-card telemetry-charts-card">
      <div className="charts-header">
        <div className="charts-title">
          <BarChart2 color="#06b6d4" size={20} />
          <h2>Live Telemetry Performance Timeline</h2>
        </div>

        <div className="chart-tabs">
          <button
            onClick={() => setActiveMetric('cpu')}
            className={`chart-tab-btn ${activeMetric === 'cpu' ? 'active-cpu' : ''}`}
          >
            <Cpu size={14} /> CPU
          </button>
          <button
            onClick={() => setActiveMetric('memory')}
            className={`chart-tab-btn ${activeMetric === 'memory' ? 'active-mem' : ''}`}
          >
            <Database size={14} /> RAM
          </button>
          <button
            onClick={() => setActiveMetric('disk')}
            className={`chart-tab-btn ${activeMetric === 'disk' ? 'active-disk' : ''}`}
          >
            <HardDrive size={14} /> Disk
          </button>
        </div>
      </div>

      {activeMetric === 'cpu' && renderSvgChart('cpu', '#38bdf8', '#0284c7')}
      {activeMetric === 'memory' && renderSvgChart('memory', '#c084fc', '#9333ea')}
      {activeMetric === 'disk' && renderSvgChart('disk', '#fbbf24', '#d97706')}
    </div>
  );
}
