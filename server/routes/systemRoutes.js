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
  const trimmedCmd = command.trim();

  if (trimmedCmd === 'clear') return res.json({ success: true, clear: true, output: '' });

  const remoteUser = config.sshUser || 'rafiurrahman';
  const remoteHome = `/home/${remoteUser}`;

  let cleanCwd = cwd && cwd.trim() ? cwd.trim() : '~';
  if (cleanCwd.startsWith('/Users/')) cleanCwd = '~';

  let shellCwd = cleanCwd === '~' ? remoteHome : cleanCwd.startsWith('~/') ? `${remoteHome}/${cleanCwd.slice(2)}` : cleanCwd;

  if (config.demoMode) {
    return res.json({ success: true, output: `[DEMO MODE] Executed: ${trimmedCmd}\nSimulated output for '${trimmedCmd}'\n` });
  }

  if (trimmedCmd.startsWith('cd ') || trimmedCmd === 'cd') {
    const cdTarget = trimmedCmd === 'cd' ? '~' : trimmedCmd.slice(3).trim();
    let targetPath = cdTarget === '~' ? remoteHome : cdTarget.startsWith('~/') ? `${remoteHome}/${cdTarget.slice(2)}` : cdTarget;

    const cdCmd = `cd "${shellCwd}" 2>/dev/null || cd ${remoteHome}; cd "${targetPath}" 2>/dev/null && pwd`;
    const cdResult = await runSshCommand(cdCmd, { timeout: 10000 });

    if (cdResult.success && cdResult.stdout) {
      const fullPath = cdResult.stdout.trim();
      const displayPath = fullPath.startsWith(remoteHome) ? '~' + fullPath.slice(remoteHome.length) : fullPath;
      return res.json({ success: true, newCwd: fullPath, displayPath: displayPath || '~', output: '' });
    } else {
      return res.json({ success: false, output: cdResult.stderr || `bash: cd: ${cdTarget}: No such file or directory`, error: cdResult.error });
    }
  }

  const fullCmd = `cd "${shellCwd}" 2>/dev/null || cd ${remoteHome}; ${trimmedCmd}`;
  const result = await runSshCommand(fullCmd, { timeout: 25000 });

  res.json({
    success: result.success,
    output: result.stdout || result.stderr || (result.success ? 'Command completed with no output.' : result.error || 'Command failed.'),
    error: result.error,
  });
});

export default router;
