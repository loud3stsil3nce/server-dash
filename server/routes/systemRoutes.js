import express from 'express';
import { loadConfig, saveConfig, runSshCommand } from '../sshManager.js';
import { getSystemStatusData, getProcessesList, killProcess } from '../services/systemService.js';
import { getContainersData } from '../services/containerService.js';
import { getHealthData } from '../services/serviceService.js';

const router = express.Router();

// GET /api/config
router.get('/config', (req, res) => {
  res.json(loadConfig());
});

// POST /api/config
router.post('/config', (req, res) => {
  try {
    const updated = saveConfig(req.body);
    res.json({ success: true, config: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/test-ssh
router.post('/test-ssh', async (req, res) => {
  const { host, user, port, keyPath } = req.body;
  const testOptions = {
    host: host || undefined,
    user: user || undefined,
    port: port ? parseInt(port, 10) : undefined,
  };

  const result = await runSshCommand('uname -a && docker --version 2>/dev/null || echo "Docker not found"', testOptions);

  res.json({
    success: result.success,
    hostTried: result.host || host,
    output: result.stdout || result.stderr,
    error: result.error,
  });
});

// GET /api/status
router.get('/status', async (req, res) => {
  const config = loadConfig();
  const data = await getSystemStatusData(config);
  res.json(data);
});

// GET /api/stream (SSE Stream)
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const sendSnapshot = async () => {
    try {
      const config = loadConfig();
      const [systemStats, containers, services] = await Promise.all([
        getSystemStatusData(config),
        getContainersData(config),
        getHealthData(config),
      ]);
      const payload = JSON.stringify({ systemStats, containers, services });
      res.write(`data: ${payload}\n\n`);
    } catch (err) {
      console.error('SSE Stream error:', err);
    }
  };

  sendSnapshot();
  const intervalId = setInterval(sendSnapshot, 1000);

  req.on('close', () => {
    clearInterval(intervalId);
  });
});

// GET /api/processes
router.get('/processes', async (req, res) => {
  const processes = await getProcessesList();
  res.json({ success: true, processes });
});

// POST /api/processes/kill
router.post('/processes/kill', async (req, res) => {
  const { pid, signal } = req.body;
  if (!pid) return res.status(400).json({ success: false, error: 'PID required' });
  const result = await killProcess(pid, signal);
  res.json(result);
});

// Terminal execution
router.post('/terminal/exec', async (req, res) => {
  const { command, cwd } = req.body;
  const config = loadConfig();

  if (!command || !command.trim()) return res.json({ success: true, output: '' });
  const rawCmd = command.trim();

  if (rawCmd === 'clear') return res.json({ success: true, clear: true, output: '' });

  const remoteUser = config.sshUser || 'rafiurrahman';
  const remoteHome = `/home/${remoteUser}`;

  let cleanCwd = cwd && cwd.trim() ? cwd.trim() : '~';
  if (cleanCwd.startsWith('/Users/')) cleanCwd = '~';

  let shellCwd = cleanCwd === '~' ? remoteHome : cleanCwd.startsWith('~/') ? `${remoteHome}/${cleanCwd.slice(2)}` : cleanCwd;

  if (config.demoMode) {
    return res.json({ success: true, output: `[DEMO MODE] Executed: ${rawCmd}\nSimulated output for '${rawCmd}'\n` });
  }

  // Smart command normalization for common typos & shell syntax
  let normalizedCmd = rawCmd;
  if (normalizedCmd === 'cd..' || normalizedCmd.startsWith('cd..')) {
    normalizedCmd = 'cd ..' + normalizedCmd.slice(4);
  } else if (normalizedCmd === 'cd/ls' || normalizedCmd === 'cd/ls/' || normalizedCmd === 'cd /ls') {
    normalizedCmd = 'cd / && ls';
  } else if (normalizedCmd.startsWith('cd/') && normalizedCmd !== 'cd/') {
    normalizedCmd = 'cd /' + normalizedCmd.slice(3);
  }

  const marker = '___CWD_MARKER___';
  const fullCmd = `cd "${shellCwd}" 2>/dev/null || cd ${remoteHome}; ${normalizedCmd}; echo ""; echo "${marker}:$(pwd)"`;

  const result = await runSshCommand(fullCmd, { timeout: 25000 });

  let rawOutput = (result.stdout || '').trim();
  let stderr = (result.stderr || '').trim();
  let newCwd = shellCwd;

  if (rawOutput.includes(marker)) {
    const parts = rawOutput.split(new RegExp(`\\n?${marker}:`));
    rawOutput = (parts[0] || '').trim();
    if (parts[1]) {
      newCwd = parts[1].trim().split('\n')[0].trim();
    }
  }

  const displayPath = newCwd.startsWith(remoteHome) ? '~' + newCwd.slice(remoteHome.length) : newCwd;

  let finalOutput = rawOutput;
  if (!finalOutput && stderr) {
    finalOutput = stderr;
  } else if (!finalOutput && result.success) {
    if (normalizedCmd.startsWith('cd ') || normalizedCmd === 'cd') {
      finalOutput = `Directory changed to ${displayPath || '~'}`;
    } else {
      finalOutput = 'Command completed with no output.';
    }
  }

  res.json({
    success: result.success,
    newCwd,
    displayPath: displayPath || '~',
    output: finalOutput,
    error: result.error,
  });
});

// Terminal Tab Auto-Completion
router.post('/terminal/complete', async (req, res) => {
  const { command, cwd } = req.body;
  if (!command) return res.json({ matches: [] });

  const config = loadConfig();
  const remoteUser = config.sshUser || 'rafiurrahman';
  const remoteHome = `/home/${remoteUser}`;

  let cleanCwd = cwd && cwd.trim() ? cwd.trim() : '~';
  let shellCwd = cleanCwd === '~' ? remoteHome : cleanCwd.startsWith('~/') ? `${remoteHome}/${cleanCwd.slice(2)}` : cleanCwd;

  const parts = command.trim().split(/\s+/);
  const lastArg = parts[parts.length - 1] || '';
  const prefix = parts.slice(0, -1).join(' ');

  const compCmd = `cd "${shellCwd}" 2>/dev/null || cd ${remoteHome}; compgen -f "${lastArg}" 2>/dev/null || ls -a 2>/dev/null | grep "^${lastArg}"`;
  const result = await runSshCommand(compCmd, { timeout: 5000 });

  if (result.success && result.stdout) {
    const matches = result.stdout.split('\n').map((m) => m.trim()).filter(Boolean);
    return res.json({ matches, prefix, lastArg });
  }

  res.json({ matches: [], prefix, lastArg });
});

export default router;
