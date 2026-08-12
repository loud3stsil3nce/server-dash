import React, { useState } from 'react';
import { X, Sparkles, Bot, RefreshCw, HelpCircle } from 'lucide-react';

export default function OllamaAssistantModal({ onClose, initialLogs = '', initialContext = '' }) {
  const [prompt, setPrompt] = useState(initialContext ? `Analyze these logs and provide solutions:\n${initialContext}` : '');
  const [logs, setLogs] = useState(initialLogs);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const samplePrompts = [
    'Why did my container crash or restart?',
    'How do I optimize Java heap memory limits?',
    'Diagnose performance bottlenecks in logs',
    'Write a bash script to auto-prune logs',
  ];

  const handleAnalyze = async (customPrompt) => {
    const activePrompt = customPrompt || prompt;
    setLoading(true);
    try {
      const res = await fetch('/api/ollama/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logText: logs,
          promptContext: activePrompt || 'Homelab diagnostic query',
        }),
      });
      const data = await res.json();
      if (data.analysis) {
        setResponse(data.analysis);
      }
    } catch (err) {
      setResponse(`Error connecting to Ollama AI service: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ai-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-box">
            <div className="modal-icon-badge ai-badge">
              <Bot size={22} color="#818cf8" />
            </div>
            <div>
              <h2 style={{ display: 'flex', items: 'center', gap: '0.4rem' }}>
                Ollama AI Server Assistant <Sparkles size={16} color="#fbbf24" />
              </h2>
              <p className="modal-subtitle">Local LLM Log Diagnoser & DevOps Assistant (Port 11434)</p>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-sm">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="modal-body ai-modal-body">
          {/* Quick Prompts */}
          <div className="quick-prompts-bar">
            <span className="quick-prompts-label">
              <HelpCircle size={13} color="#818cf8" /> Quick AI Questions:
            </span>
            <div className="quick-prompts-chips">
              {samplePrompts.map((sp) => (
                <button
                  key={sp}
                  onClick={() => {
                    setPrompt(sp);
                    handleAnalyze(sp);
                  }}
                  className="btn-pill prompt-chip"
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>

          {/* Logs Snippet */}
          <div className="form-group-custom">
            <label className="form-label-custom">Container / System Logs Snippet</label>
            <textarea
              rows={4}
              placeholder="Paste log output or stack traces here for automated AI error diagnosis..."
              value={logs}
              onChange={(e) => setLogs(e.target.value)}
              className="form-textarea-custom font-mono"
            />
            <span className="form-helper-text">
              Log entries will be scanned locally by your Ollama model to pinpoint the exact failure point.
            </span>
          </div>

          {/* User Question / Context */}
          <div className="form-group-custom">
            <label className="form-label-custom">Question or Diagnostic Prompt</label>
            <input
              type="text"
              placeholder="e.g. Why did this container crash? How do I optimize memory limit?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="form-input-custom"
            />
            <span className="form-helper-text">
              Ask any question about your Linux host, Docker containers, or homelab setup.
            </span>
          </div>

          <button
            onClick={() => handleAnalyze()}
            disabled={loading || (!logs.trim() && !prompt.trim())}
            className="btn btn-primary ai-submit-btn"
          >
            {loading ? <RefreshCw className="spin" size={18} /> : <Bot size={18} />}
            <span>{loading ? 'Analyzing with Local Ollama Model...' : 'Diagnose with Ollama AI'}</span>
          </button>

          {/* AI Response Output */}
          {response && (
            <div className="ai-response-card">
              <div className="ai-response-header">
                <Sparkles size={16} color="#818cf8" />
                <span>Ollama Diagnostic Breakdown</span>
              </div>
              <pre className="ai-response-text">{response}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
