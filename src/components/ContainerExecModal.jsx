import React, { useState } from 'react';
import { X, Terminal, Send, Sparkles } from 'lucide-react';

export default function ContainerExecModal({ containerName, onClose, onToast }) {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState('');
  const [executing, setExecuting] = useState(false);

  const presets = [
    { label: 'Directory List', cmd: 'ls -la' },
    { label: 'Environment Vars', cmd: 'env' },
    { label: 'OS Info', cmd: 'cat /etc/os-release' },
    { label: 'Disk Space', cmd: 'df -h' },
    { label: 'Running Processes', cmd: 'ps aux' },
  ];

  const handleExec = async (cmdToRun) => {
    const targetCmd = cmdToRun || command;
    if (!targetCmd.trim()) return;

    setExecuting(true);
    setOutput((prev) => `${prev}\n$ ${targetCmd}\nExecuting inside container '${containerName}'...`);

    try {
      const res = await fetch(`/api/container/${containerName}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: targetCmd }),
      });
      const data = await res.json();
      if (data.success) {
        setOutput((prev) => `${prev}\n${data.output}\n`);
      } else {
        setOutput((prev) => `${prev}\nError: ${data.error || 'Execution failed'}\n`);
      }
    } catch (err) {
      setOutput((prev) => `${prev}\nNetwork Error: ${err.message}\n`);
    } finally {
      setExecuting(false);
      if (!cmdToRun) setCommand('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content exec-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-box">
            <div className="modal-icon-badge exec-badge">
              <Terminal size={20} color="#34d399" />
            </div>
            <div>
              <h2>Container Shell Exec (`docker exec`)</h2>
              <p className="modal-subtitle">
                Running active shell instance inside container <code className="container-tag">{containerName}</code>
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-sm">
            <X size={18} />
          </button>
        </div>

        {/* Presets Shortcuts Bar */}
        <div className="exec-presets-bar">
          <span className="presets-label">
            <Sparkles size={13} color="#fbbf24" /> Quick Commands:
          </span>
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => handleExec(p.cmd)}
              disabled={executing}
              className="btn-pill"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Terminal Output */}
        <div className="modal-body exec-terminal-body">
          <div className="term-banner"># Interactive container exec shell ready for container: {containerName}</div>
          <pre className="exec-log-pre">{output || '$ TYPE COMMAND BELOW OR CLICK A QUICK COMMAND ABOVE'}</pre>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleExec();
          }}
          className="exec-input-form flex-col"
        >
          <div className="exec-input-wrapper w-full">
            <span className="exec-prompt-symbol">$</span>
            <input
              type="text"
              placeholder="Enter container command (e.g. ls /app, cat server.properties, env)..."
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="exec-input"
            />
            <button
              type="submit"
              disabled={executing || !command.trim()}
              className="btn btn-primary"
            >
              <Send size={14} /> Execute
            </button>
          </div>
          <span className="form-helper-text" style={{ alignSelf: 'flex-start', marginTop: '0.35rem' }}>
            Commands are executed inside the isolated container environment using `sh -c` or `bash -c`.
          </span>
        </form>
      </div>
    </div>
  );
}
