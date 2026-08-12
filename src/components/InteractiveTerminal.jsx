import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Trash2, Maximize2, Minimize2, Sparkles, ChevronRight, Play } from 'lucide-react';

export default function InteractiveTerminal({ isLive, hostName }) {
  const [history, setHistory] = useState([
    { type: 'system', content: 'Zenbook Interactive SSH Terminal connected.' },
    { type: 'system', content: 'Type any Linux / Docker command & press Enter (e.g. cd homelab, ls, docker ps, free -h).' },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [currentCwd, setCurrentCwdState] = useState('~');
  const cwdRef = useRef('~');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const inputRef = useRef(null);
  const outputEndRef = useRef(null);

  const updateCwd = (newPath) => {
    cwdRef.current = newPath;
    setCurrentCwdState(newPath);
  };

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleExecute = async (commandToRun) => {
    const cmd = commandToRun !== undefined ? commandToRun : inputVal;
    if (!cmd.trim() || isExecuting) return;

    const activeCwd = cwdRef.current;
    const userLine = { type: 'input', content: cmd, path: activeCwd };
    setHistory((prev) => [...prev, userLine]);
    setCmdHistory((prev) => [...prev, cmd]);
    setHistoryIdx(-1);
    setInputVal('');
    setIsExecuting(true);

    if (cmd.trim() === 'clear') {
      setHistory([]);
      setIsExecuting(false);
      return;
    }

    try {
      const res = await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, cwd: activeCwd }),
      });
      const data = await res.json();

      if (data.clear) {
        setHistory([]);
      } else {
        if (data.displayPath || data.newCwd) {
          updateCwd(data.displayPath || data.newCwd);
        }
        if (data.output) {
          setHistory((prev) => [
            ...prev,
            {
              type: data.success ? 'output' : 'error',
              content: data.output,
            },
          ]);
        }
      }
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        { type: 'error', content: `Network Error: ${err.message}` },
      ]);
    } finally {
      setIsExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleTabComplete = async () => {
    if (!inputVal.trim() || isExecuting) return;
    try {
      const res = await fetch('/api/terminal/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: inputVal, cwd: cwdRef.current }),
      });
      const data = await res.json();

      if (data.matches && data.matches.length > 0) {
        if (data.matches.length === 1) {
          const completed = data.prefix ? `${data.prefix} ${data.matches[0]}` : data.matches[0];
          setInputVal(completed);
        } else {
          setHistory((prev) => [
            ...prev,
            { type: 'output', content: data.matches.join('   ') },
          ]);
          let common = data.matches[0];
          for (let i = 1; i < data.matches.length; i++) {
            while (!data.matches[i].startsWith(common)) {
              common = common.slice(0, -1);
            }
          }
          if (common && common.length > data.lastArg.length) {
            const completed = data.prefix ? `${data.prefix} ${common}` : common;
            setInputVal(completed);
          }
        }
      }
    } catch (err) {}
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleTabComplete();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx < cmdHistory.length) {
        setHistoryIdx(nextIdx);
        setInputVal(cmdHistory[cmdHistory.length - 1 - nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setInputVal(cmdHistory[cmdHistory.length - 1 - nextIdx]);
      } else if (historyIdx === 0) {
        setHistoryIdx(-1);
        setInputVal('');
      }
    }
  };

  const handleBodyClick = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      return; // Do not clear user text selection
    }
    inputRef.current?.focus();
  };

  const quickCmds = [
    { label: 'docker ps', cmd: 'docker ps' },
    { label: 'free -h', cmd: 'free -h' },
    { label: 'df -h', cmd: 'df -h' },
    { label: 'uptime', cmd: 'uptime' },
    { label: 'uname -a', cmd: 'uname -a' },
    { label: 'clear', cmd: 'clear' },
  ];

  return (
    <div className={`glass-card terminal-card ${isMaximized ? 'terminal-maximized' : ''}`}>
      {/* Terminal Title Bar with macOS Traffic Lights */}
      <div className="terminal-header">
        <div className="terminal-window-dots">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <div className="terminal-header-title">
            <TerminalIcon size={15} className="terminal-icon" />
            <span>rafiurrahman@{hostName || 'zenbook-server'} &mdash; bash</span>
            <span className={`status-badge-inline ${isLive ? 'live' : 'simulated'}`}>
              {isLive ? 'LIVE SSH' : 'DEMO'}
            </span>
          </div>
        </div>

        <div className="terminal-header-actions">
          <button
            className="btn btn-icon btn-sm"
            onClick={() => setHistory([])}
            title="Clear terminal screen (clear)"
          >
            <Trash2 size={13} />
          </button>
          <button
            className="btn btn-icon btn-sm"
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Minimize terminal height' : 'Expand terminal height'}
          >
            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Quick Command Pills Toolbar */}
      <div className="terminal-quick-bar">
        <span className="quick-bar-label">
          <Sparkles size={12} style={{ color: '#06b6d4' }} /> Quick Actions:
        </span>
        <div className="quick-pills-row">
          {quickCmds.map((q) => (
            <button
              key={q.cmd}
              className="btn-pill"
              onClick={() => handleExecute(q.cmd)}
              disabled={isExecuting}
            >
              <code>{q.label}</code>
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Output Screen */}
      <div className="terminal-body" onClick={handleBodyClick}>
        {history.map((item, idx) => (
          <div key={idx} className={`terminal-line ${item.type}`}>
            {item.type === 'input' && (
              <span className="prompt-label">
                <span className="prompt-user">rafiurrahman</span>
                <span className="prompt-at">@</span>
                <span className="prompt-host">{hostName || 'zenbook-server'}</span>
                <span className="prompt-path">:{item.path || '~'}$</span>&nbsp;
              </span>
            )}
            {item.type === 'system' && <span className="system-prefix">ℹ [SYSTEM] </span>}
            {item.type === 'error' && <span className="error-prefix">❌ [ERROR] </span>}
            <pre className="terminal-text">{item.content}</pre>
          </div>
        ))}

        {/* Input Line Prompt */}
        <div className="terminal-input-row">
          <span className="prompt-label">
            <span className="prompt-user">rafiurrahman</span>
            <span className="prompt-at">@</span>
            <span className="prompt-host">{hostName || 'zenbook-server'}</span>
            <span className="prompt-path">:{currentCwd}$</span>&nbsp;
          </span>
          <input
            ref={inputRef}
            type="text"
            className="terminal-input"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            placeholder={isExecuting ? 'Executing SSH command...' : 'Type command and press Enter...'}
            autoFocus
          />
          {isExecuting && <span className="terminal-spinner" />}
        </div>
        <div ref={outputEndRef} />
      </div>
    </div>
  );
}
