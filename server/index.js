import express from 'express';
import cors from 'cors';
import http from 'http';
import net from 'net';
import multer from 'multer';
import os from 'os';
import path from 'path';
import fs from 'fs';
import {
  loadConfig,
  saveConfig,
  runSshCommand,
  scpFileToServer,
  getMockSystemStats,
  getMockContainers,
} from './sshManager.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve built React frontend in production/container mode
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// In-memory latency history cache for sparklines
const latencyHistory = {};

// Helper: Measure TCP connection latency
function pingTcpPort(host, port, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ status: 'ONLINE', latency, code: 200, message: 'TCP Port Open' });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ status: 'OFFLINE', latency: null, code: 408, message: 'Connection Timeout' });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ status: 'OFFLINE', latency: null, code: 503, message: err.message });
    });

    socket.connect(port, host);
  });
}

// Helper: Measure HTTP endpoint health
async function pingHttpEndpoint(url, timeoutMs = 2500) {
  const start = Date.now();
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'Zenbook-Dashboard-HealthCheck/1.0' },
    });
    clearTimeout(id);
    const latency = Date.now() - start;
    const isOk = res.status >= 200 && res.status < 400;
    return {
      status: isOk ? 'ONLINE' : 'DEGRADED',
      latency,
      code: res.status,
      message: `${res.status} ${res.statusText}`,
    };
  } catch (err) {
    clearTimeout(id);
    return {
      status: 'OFFLINE',
      latency: null,
      code: 500,
      message: err.name === 'AbortError' ? 'Timeout (2.5s)' : err.message,
    };
  }
}

// 1. GET /api/config
app.get('/api/config', (req, res) => {
  res.json(loadConfig());
});

// 2. POST /api/config
app.post('/api/config', (req, res) => {
  try {
    const updated = saveConfig(req.body);
    res.json({ success: true, config: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST /api/test-ssh
app.post('/api/test-ssh', async (req, res) => {
  const testOpts = req.body;
  const result = await runSshCommand('uname -a && uptime && (docker --version 2>/dev/null || echo "No Docker")', { ...testOpts, forceSsh: true });
  res.json(result);
});

// Helper: Gather system status
async function getSystemStatusData(config) {
  if (config.demoMode) {
    return getMockSystemStats();
  }

  const script = `
echo "===UPTIME==="
uptime -p 2>/dev/null || uptime
echo "===CPU==="
s1=$(head -n 1 /proc/stat); sleep 0.25; s2=$(head -n 1 /proc/stat)
awk -v s1="$s1" -v s2="$s2" 'BEGIN { split(s1, a1); split(s2, a2); idle1 = a1[5] + a1[6]; idle2 = a2[5] + a2[6]; tot1 = 0; tot2 = 0; for (i=2; i<=9; i++) { tot1 += a1[i]; tot2 += a2[i]; } dt = tot2 - tot1; di = idle2 - idle1; if (dt > 0) { pct = ((dt - di) / dt) * 100; if (pct < 0.5) pct = 0.5; printf "%.1f", pct; } else print "0.8"; }'
echo ""
cat /proc/loadavg
nproc 2>/dev/null || echo "1"
ps -eo comm,%cpu --sort=-%cpu 2>/dev/null | sed -n "2p" || echo "none 0"
echo "===MEM==="
free -m | grep -i "mem:"
echo "===DISK==="
df -m / | tail -n 1
echo "===TEMP==="
for f in /sys/class/thermal/thermal_zone*; do if [ -f "$f/type" ] && [ -f "$f/temp" ]; then echo "$(cat "$f/type"):$(cat "$f/temp")"; fi; done
  `.trim();

  const sshRes = await runSshCommand(script);

  if (!sshRes.success) {
    const fallback = getMockSystemStats();
    fallback.isLive = false;
    fallback.connectionError = sshRes.error;
    fallback.mode = 'DEMO FALLBACK (SSH Unavailable)';
    return fallback;
  }

  const out = sshRes.stdout;
  let uptimeStr = 'Up 0 hours';
  let cpuVal = 2.0;
  let cpuCores = 20;
  let topProcessStr = 'N/A';
  let memoryObj = { usedGb: 4.2, totalGb: 16.0, percent: 26 };
  let diskObj = { usedGb: 120.0, totalGb: 512.0, percent: 23 };
  let loadAvg = ['0.10', '0.25', '0.30'];
  let tempC = '45.0';

  try {
    if (out.includes('===UPTIME===')) {
      const parts = out.split(/===[A-Z]+===/);
      const uptimeRaw = parts[1] ? parts[1].trim() : '';
      const cpuRaw = parts[2] ? parts[2].trim() : '';
      const memRaw = parts[3] ? parts[3].trim() : '';
      const diskRaw = parts[4] ? parts[4].trim() : '';
      const tempRaw = parts[5] ? parts[5].trim() : '';

      uptimeStr = uptimeRaw;

      const cpuLines = cpuRaw.split('\n');
      if (cpuLines.length >= 1 && !isNaN(cpuLines[0])) {
        cpuVal = parseFloat(parseFloat(cpuLines[0]).toFixed(1));
      }
      if (cpuLines.length >= 2) {
        const lTokens = cpuLines[1].trim().split(/\s+/);
        if (lTokens.length >= 3) {
          loadAvg = [lTokens[0], lTokens[1], lTokens[2]];
        }
      }
      if (cpuLines.length >= 3 && !isNaN(cpuLines[2])) {
        cpuCores = parseInt(cpuLines[2], 10) || 20;
      }
      if (cpuLines.length >= 4) {
        const [procName, procCpu] = cpuLines[3].trim().split(/\s+/);
        if (procName && procCpu) {
          topProcessStr = `${procName} (${procCpu}% 1-Core)`;
        }
      }

      const memLines = memRaw.split('\n');
      if (memLines.length >= 1) {
        const memTokens = memLines[0].trim().split(/\s+/);
        if (memTokens.length >= 3) {
          const totalMb = parseInt(memTokens[1], 10) || 16384;
          const usedMb = parseInt(memTokens[2], 10) || 4096;
          memoryObj = {
            usedGb: parseFloat((usedMb / 1024).toFixed(1)),
            totalGb: parseFloat((totalMb / 1024).toFixed(1)),
            percent: Math.round((usedMb / totalMb) * 100),
          };
        }
      }

      const diskTokens = diskRaw.trim().split(/\s+/);
      if (diskTokens.length >= 4) {
        const totalMb = parseInt(diskTokens[1], 10) || 100000;
        const usedMb = parseInt(diskTokens[2], 10) || 50000;
        diskObj = {
          usedGb: parseFloat((usedMb / 1024).toFixed(1)),
          totalGb: parseFloat((totalMb / 1024).toFixed(1)),
          percent: Math.round((usedMb / totalMb) * 100),
        };
      }

      const tempLines = tempRaw.split('\n').filter((l) => l.includes(':'));
      let pkgTemp = null;
      let maxTemp = 0;

      for (const line of tempLines) {
        const [tType, tValStr] = line.split(':');
        const tVal = parseInt(tValStr, 10);
        if (!isNaN(tVal) && tVal > 0) {
          const celcius = tVal / 1000;
          if (tType.includes('x86_pkg_temp') || tType.includes('TCPU')) {
            pkgTemp = celcius;
          }
          if (celcius > maxTemp && celcius < 115) {
            maxTemp = celcius;
          }
        }
      }

      const finalTemp = pkgTemp !== null ? pkgTemp : maxTemp || 45.0;
      tempC = finalTemp.toFixed(1);
    }
  } catch (parseErr) {
    console.error('Error parsing live SSH output:', parseErr);
  }

  return {
    isLive: true,
    mode: 'LIVE SSH',
    host: config.sshHost,
    tailscaleIp: config.tailscaleIp || '100.115.220.54',
    uptime: uptimeStr,
    cpuPercent: cpuVal,
    cpuCores,
    topProcess: topProcessStr,
    memory: memoryObj,
    disk: diskObj,
    tempC,
    loadAvg,
    lastUpdated: new Date().toISOString(),
  };
}

// In-memory telemetry cache for instant 0ms real-time streaming
let latestTelemetryCache = {
  systemStats: getMockSystemStats(),
  containers: getMockContainers(),
  services: [],
  lastUpdated: new Date().toISOString(),
};

let isCollecting = false;

async function updateTelemetryCache() {
  if (isCollecting) return;
  isCollecting = true;

  try {
    const config = loadConfig();
    const [statusRes, containersRes, healthRes] = await Promise.all([
      getSystemStatusData(config),
      getContainersData(config),
      getHealthData(config),
    ]);

    latestTelemetryCache = {
      systemStats: statusRes,
      containers: containersRes,
      services: healthRes,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Error updating background telemetry cache:', err);
  } finally {
    isCollecting = false;
  }
}

// Start continuous background telemetry loop every 3.5 seconds
setInterval(() => {
  updateTelemetryCache();
}, 3500);

// Kick off initial collection immediately
updateTelemetryCache();

// 4. GET /api/status (System Metrics)
app.get('/api/status', async (req, res) => {
  if (latestTelemetryCache.systemStats) {
    return res.json(latestTelemetryCache.systemStats);
  }
  const config = loadConfig();
  const data = await getSystemStatusData(config);
  res.json(data);
});

// 4b. GET /api/stream (Server-Sent Events Real-Time Streaming)
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let isAlive = true;
  req.on('close', () => {
    isAlive = false;
  });

  const sendSnapshot = () => {
    if (!isAlive) return;
    res.write(`data: ${JSON.stringify(latestTelemetryCache)}\n\n`);
  };

  // Immediate push from cache (0ms delay!)
  sendSnapshot();

  // Push updated snapshot every 1.0 second continuously
  const streamInterval = setInterval(() => {
    if (!isAlive) {
      clearInterval(streamInterval);
      return;
    }
    sendSnapshot();
  }, 1000);
});

// Helper: Gather Docker Containers
async function getContainersData(config) {
  if (config.demoMode) {
    return getMockContainers();
  }

  const sshRes = await runSshCommand(
    `docker stats --no-stream --format 'id={{.ID}}|name={{.Name}}|cpu={{.CPUPerc}}|mem={{.MemUsage}}|memPerc={{.MemPerc}}|net={{.NetIO}}|block={{.BlockIO}}|pids={{.PIDs}}' 2>/dev/null`
  );

  if (!sshRes.success || !sshRes.stdout) {
    return getMockContainers();
  }

  const lines = sshRes.stdout.split('\n').filter((l) => l.trim().length > 0);
  const containers = lines.map((line) => {
    const parts = line.split('|').reduce((acc, curr) => {
      const [k, ...v] = curr.split('=');
      acc[k] = v.join('=');
      return acc;
    }, {});

    return {
      id: parts.id || 'unk',
      name: parts.name || 'container',
      image: 'docker.io/library/container',
      status: 'Up',
      state: 'running',
      cpu: parts.cpu || '0.0%',
      mem: parts.mem || '0B / 0B',
      memPerc: parts.memPerc || '0.0%',
      netIO: parts.net || '0B / 0B',
      blockIO: parts.block || '0B / 0B',
      pids: parts.pids || '0',
    };
  });

  return containers.length > 0 ? containers : getMockContainers();
}

// Helper: Gather Services Health
async function getHealthData(config) {
  const host = config.sshHost || config.tailscaleIp || 'zenbook-server';
  const results = [];

  for (const svc of config.services) {
    let healthResult;

    if (config.demoMode) {
      const mockLatency = Math.floor(8 + Math.random() * 28);
      healthResult = {
        status: 'ONLINE',
        latency: mockLatency,
        code: 200,
        message: '200 OK (Simulated)',
      };
    } else {
      if (svc.protocol === 'tcp') {
        healthResult = await pingTcpPort(host, svc.port);
      } else {
        const url = `http://${host}:${svc.port}${svc.healthPath || ''}`;
        healthResult = await pingHttpEndpoint(url);

        if (healthResult.status === 'OFFLINE') {
          const sshCurl = await runSshCommand(
            `curl -s -o /dev/null -w "%{http_code}:%{time_total}" http://localhost:${svc.port}${svc.healthPath || ''} 2>/dev/null || echo "000:0"`
          );

          if (sshCurl.success && sshCurl.stdout) {
            const [codeStr, timeStr] = sshCurl.stdout.split(':');
            const code = parseInt(codeStr, 10);
            if (code >= 200 && code < 400) {
              const latencyMs = Math.round(parseFloat(timeStr) * 1000);
              healthResult = {
                status: 'ONLINE',
                latency: latencyMs || 12,
                code,
                message: `${code} OK (via SSH)`,
              };
            }
          }
        }
      }
    }

    // If health check returned OFFLINE, verify if container is running (booting/initializing phase)
    if (healthResult.status === 'OFFLINE' && svc.containerName) {
      const containerCheck = await runSshCommand(
        `docker inspect -f '{{.State.Status}}' ${svc.containerName} 2>/dev/null || echo "stopped"`
      );
      if (containerCheck.success && containerCheck.stdout.trim() === 'running') {
        healthResult = {
          status: 'STARTING',
          latency: null,
          code: 202,
          message: 'Container Running • Service Initializing...',
        };
      }
    }

    if (!latencyHistory[svc.id]) {
      latencyHistory[svc.id] = [];
    }
    const val = healthResult.latency !== null ? healthResult.latency : 0;
    latencyHistory[svc.id].push(val);
    if (latencyHistory[svc.id].length > 15) {
      latencyHistory[svc.id].shift();
    }

    results.push({
      ...svc,
      health: healthResult,
      latencyHistory: [...latencyHistory[svc.id]],
    });
  }

  return results;
}

// 5. GET /api/containers
app.get('/api/containers', async (req, res) => {
  const config = loadConfig();
  const data = await getContainersData(config);
  res.json(data);
});

// 6. GET /api/services/health
app.get('/api/services/health', async (req, res) => {
  const config = loadConfig();
  const data = await getHealthData(config);
  res.json(data);
});

// 7. GET /api/container/:name/logs
app.get('/api/container/:name/logs', async (req, res) => {
  const { name } = req.params;
  const config = loadConfig();

  if (config.demoMode) {
    const timestamp = new Date().toISOString();
    return res.send(
      `[${timestamp}] [INFO] [${name}] Container running in demo mode.\n` +
      `[${timestamp}] [INFO] [${name}] Listening on port, 0 memory errors detected.\n` +
      `[${timestamp}] [HEALTH] [${name}] Health check passed (200 OK).\n` +
      `[${timestamp}] [DEBUG] [${name}] Tailscale connection active. Ready for SSH requests.\n`
    );
  }

  const result = await runSshCommand(`docker logs --tail 100 ${name} 2>&1`);
  if (!result.success && !result.stdout) {
    return res.status(500).send(`Failed to fetch logs for ${name}:\n${result.error}`);
  }

  res.send(result.stdout || result.stderr || 'No logs returned.');
});

// 8. POST /api/container/:name/action
app.post('/api/container/:name/action', async (req, res) => {
  const { name } = req.params;
  const { action } = req.body; // 'restart', 'stop', 'start'
  const config = loadConfig();

  if (!['restart', 'stop', 'start'].includes(action)) {
    return res.status(400).json({ success: false, error: 'Invalid action' });
  }

  if (config.demoMode) {
    return res.json({
      success: true,
      newState: action === 'stop' ? 'exited' : 'running',
      message: `[DEMO] Container ${name} ${action} command simulated successfully.`,
    });
  }

  const timeoutFlag = action === 'stop' || action === 'restart' ? ' -t 5' : '';
  const cmd = `docker ${action}${timeoutFlag} ${name} && docker inspect -f '{{.State.Status}}' ${name} 2>/dev/null || echo "unknown"`;

  const result = await runSshCommand(cmd);

  const lines = (result.stdout || '').split('\n');
  const newState = lines[lines.length - 1].trim();

  res.json({
    success: result.success,
    newState: newState || (action === 'stop' ? 'exited' : 'running'),
    output: result.stdout || result.stderr,
    error: result.error,
  });
});

// 9. POST /api/terminal/exec (Interactive Web Terminal)
app.post('/api/terminal/exec', async (req, res) => {
  const { command, cwd } = req.body;
  const config = loadConfig();

  if (!command || !command.trim()) {
    return res.json({ success: true, output: '' });
  }

  const trimmedCmd = command.trim();

  if (trimmedCmd === 'clear') {
    return res.json({ success: true, clear: true, output: '' });
  }

  const remoteUser = config.sshUser || 'rafiurrahman';
  const remoteHome = `/home/${remoteUser}`;

  let cleanCwd = cwd && cwd.trim() ? cwd.trim() : '~';
  if (cleanCwd.startsWith('/Users/')) {
    cleanCwd = '~';
  }

  let shellCwd = cleanCwd;
  if (cleanCwd === '~') {
    shellCwd = remoteHome;
  } else if (cleanCwd.startsWith('~/')) {
    shellCwd = `${remoteHome}/${cleanCwd.slice(2)}`;
  }

  if (config.demoMode) {
    let mockOutput = `[DEMO MODE] Executed: ${trimmedCmd}\n`;
    if (trimmedCmd === 'uname -a') mockOutput += 'Linux zenbook-server 6.8.0-45-generic x86_64\n';
    else if (trimmedCmd.startsWith('docker ps')) mockOutput += 'CONTAINER ID   IMAGE                  STATUS        NAMES\n0eaa95991334   itzg/minecraft-server  Up 2 hours    minecraft\n40379d2e6ee3   pihole/pihole:latest   Up 2 hours    pihole\n';
    else if (trimmedCmd === 'uptime') mockOutput += 'up 2 days, 15 minutes, 1 user, load average: 0.12, 0.25, 0.30\n';
    else mockOutput += `Simulated output for '${trimmedCmd}'\n`;

    return res.json({ success: true, output: mockOutput });
  }

  // Handle cd commands to maintain stateful working directory across terminal executions
  if (trimmedCmd.startsWith('cd ') || trimmedCmd === 'cd') {
    const cdTarget = trimmedCmd === 'cd' ? '~' : trimmedCmd.slice(3).trim();
    let targetPath = cdTarget;
    if (cdTarget === '~') targetPath = remoteHome;
    else if (cdTarget.startsWith('~/')) targetPath = `${remoteHome}/${cdTarget.slice(2)}`;

    const cdCmd = `cd "${shellCwd}" 2>/dev/null || cd ${remoteHome}; cd "${targetPath}" 2>/dev/null && pwd`;
    const cdResult = await runSshCommand(cdCmd, { timeout: 10000 });

    if (cdResult.success && cdResult.stdout) {
      const fullPath = cdResult.stdout.trim();
      const displayPath = fullPath.startsWith(remoteHome) ? '~' + fullPath.slice(remoteHome.length) : fullPath;

      return res.json({
        success: true,
        newCwd: fullPath,
        displayPath: displayPath || '~',
        output: '',
      });
    } else {
      return res.json({
        success: false,
        output: cdResult.stderr || `bash: cd: ${cdTarget}: No such file or directory`,
        error: cdResult.error,
      });
    }
  }

  // Prefix regular commands with cd into active working directory
  const fullCmd = `cd "${shellCwd}" 2>/dev/null || cd ${remoteHome}; ${trimmedCmd}`;
  const result = await runSshCommand(fullCmd, { timeout: 25000 });

  res.json({
    success: result.success,
    output: result.stdout || result.stderr || (result.success ? 'Command completed with no output.' : result.error || 'Command failed.'),
    error: result.error,
  });
});

app.post('/api/terminal/complete', async (req, res) => {
  const { command, cwd } = req.body;
  const config = loadConfig();

  if (config.demoMode || !command || !command.trim()) {
    return res.json({ matches: [] });
  }

  let cleanCwd = cwd && cwd.trim() ? cwd.trim() : '~';
  if (cleanCwd.startsWith('/Users/')) cleanCwd = '~';

  let shellCwd = cleanCwd;
  if (cleanCwd === '~') {
    shellCwd = '$HOME';
  } else if (cleanCwd.startsWith('~/')) {
    shellCwd = `$HOME/${cleanCwd.slice(2)}`;
  }

  const parts = command.split(' ');
  const lastArg = parts[parts.length - 1] || '';
  const prefix = parts.slice(0, -1).join(' ');

  const compCmd = `cd ${shellCwd} 2>/dev/null || cd $HOME; compgen -f "${lastArg}" 2>/dev/null || ls -d ${lastArg}* 2>/dev/null`;
  const result = await runSshCommand(compCmd, { timeout: 3000 });

  if (result.success && result.stdout) {
    const matches = result.stdout
      .split('\n')
      .map((m) => m.trim())
      .filter((m) => m.length > 0 && m !== '.' && m !== '..');
    return res.json({ matches, lastArg, prefix });
  }

  res.json({ matches: [] });
});

// 10. Minecraft Multi-Server Management Routes
app.get('/api/minecraft/servers', async (req, res) => {
  const config = loadConfig();
  if (config.demoMode) {
    return res.json([
      {
        name: 'minecraft',
        port: '25565',
        status: 'Up',
        state: 'running',
        type: 'PAPER',
        version: 'LATEST',
        memory: '4G',
        mode: 'survival',
        difficulty: 'normal',
        motd: 'Main Paper Vanilla SMP Server',
      },
      {
        name: 'minecraft-creative',
        port: '25566',
        status: 'Up',
        state: 'running',
        type: 'SPIGOT',
        version: '1.20.4',
        memory: '2G',
        mode: 'creative',
        difficulty: 'peaceful',
        motd: 'Creative Builders World',
      },
    ]);
  }

  const result = await runSshCommand(
    `docker ps -a --format 'name={{.Names}}|status={{.Status}}|ports={{.Ports}}|image={{.Image}}' | grep -iE "minecraft|itzg|mc" || echo ""`
  );

  if (!result.success || !result.stdout) {
    return res.json([]);
  }

  const lines = result.stdout.split('\n').filter((l) => l.trim().length > 0);
  const servers = [];

  for (const line of lines) {
    const parts = line.split('|').reduce((acc, curr) => {
      const [k, ...v] = curr.split('=');
      acc[k] = v.join('=');
      return acc;
    }, {});

    const name = parts.name || 'minecraft';

    // Inspect env vars & properties for each instance
    const inspectRes = await runSshCommand(
      `docker inspect ${name} --format '{{json .Config.Env}}' 2>/dev/null || echo "[]"`
    );

    let memory = '2G', type = 'PAPER', version = 'LATEST', mode = 'survival', difficulty = 'normal', motd = 'Minecraft Server', mods = '';
    let port = '25565';

    if (parts.ports) {
      const portMatch = parts.ports.match(/0\.0\.0\.0:(\d+)->25565/);
      if (portMatch) port = portMatch[1];
    }

    try {
      if (inspectRes.success && inspectRes.stdout) {
        const envArray = JSON.parse(inspectRes.stdout);
        envArray.forEach((e) => {
          if (e.startsWith('MEMORY=')) memory = e.split('=')[1];
          if (e.startsWith('TYPE=')) type = e.split('=')[1];
          if (e.startsWith('VERSION=')) version = e.split('=')[1];
          if (e.startsWith('MODE=')) mode = e.split('=')[1];
          if (e.startsWith('DIFFICULTY=')) difficulty = e.split('=')[1];
          if (e.startsWith('MOTD=')) motd = e.split('=')[1];
          if (e.startsWith('MODS=')) mods = e.slice('MODS='.length);
          if (e.startsWith('MODRINTH_MODPACK=')) mods = mods || e.slice('MODRINTH_MODPACK='.length);
        });
      }
    } catch (e) {}

    servers.push({
      name,
      port,
      status: parts.status || 'Up',
      state: parts.status && parts.status.toLowerCase().includes('up') ? 'running' : 'exited',
      type,
      version,
      memory,
      mode,
      difficulty,
      motd,
      mods,
    });
  }

  res.json(servers);
});

app.post('/api/minecraft/create', async (req, res) => {
  const { name, port, type, version, javaVersion, memory, mode, difficulty, motd, maxPlayers, modpackUrl, mods } = req.body;
  const config = loadConfig();

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Server name is required' });
  }

  const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const cleanPort = parseInt(port, 10) || 25566;
  const cleanType = (type || 'PAPER').toUpperCase();
  const cleanVersion = version || '1.20.4';
  const cleanJava = javaVersion || 'java21';
  const cleanMem = memory || '2G';
  const cleanMode = mode || 'survival';
  const cleanDiff = difficulty || 'normal';
  const cleanMotd = motd || 'Minecraft Server';
  const cleanMax = parseInt(maxPlayers, 10) || 20;
  const cleanModpack = modpackUrl && modpackUrl.trim() ? modpackUrl.trim() : null;
  const cleanMods = mods && mods.trim() ? mods.trim() : null;

  if (config.demoMode) {
    return res.json({
      success: true,
      message: `[DEMO] Minecraft server '${cleanName}' created on port ${cleanPort} with Java ${cleanJava} successfully.`,
    });
  }

  // Build Docker execution command with selected Java version and optional Modpack URL
  let imageTag = cleanJava;
  if (cleanJava === 'java25' || cleanVersion.startsWith('26.') || cleanVersion.toUpperCase() === 'LATEST') {
    imageTag = 'latest'; // Uses Java 25 image supporting Minecraft 26.x
  }

  let effectiveType = cleanType;
  let modpackFlag = '';
  let loaderFlag = '';

  if (cleanModpack) {
    const lowerModpack = cleanModpack.toLowerCase();
    if (cleanType === 'MODRINTH' || lowerModpack.includes('modrinth') || lowerModpack.endsWith('.mrpack')) {
      effectiveType = 'MODRINTH';
      modpackFlag = ` -e MODRINTH_MODPACK="${cleanModpack}"`;
      if (cleanType === 'FABRIC' || cleanType === 'FORGE' || cleanType === 'QUILT') {
        loaderFlag = ` -e MODRINTH_LOADER=${cleanType.toLowerCase()}`;
      }
    } else if (cleanType === 'CURSEFORGE' || lowerModpack.includes('curseforge')) {
      effectiveType = 'AUTO_CURSEFORGE';
      modpackFlag = ` -e CF_PAGE_URL="${cleanModpack}"`;
    } else {
      // Generic ZIP modpack override
      modpackFlag = ` -e MODPACK="${cleanModpack}" -e GENERIC_PACK="${cleanModpack}" -e FORCE_WORLD_COPY=TRUE`;
    }
  }

  // Clean up any existing container with the same name before recreating
  const removeOldCmd = `docker rm -f ${cleanName} 2>/dev/null || true`;
  await runSshCommand(removeOldCmd);

  const modsFlag = cleanMods ? ` -e MODS="${cleanMods}"` : '';
  const cmd = `docker run -d --name ${cleanName} -p ${cleanPort}:25565 -e EULA=TRUE -e TYPE=${effectiveType} -e VERSION=${cleanVersion} -e MEMORY=${cleanMem} -e MODE=${cleanMode} -e DIFFICULTY=${cleanDiff} -e MOTD="${cleanMotd}" -e MAX_PLAYERS=${cleanMax}${modpackFlag}${loaderFlag}${modsFlag} -v ${cleanName}_data:/data --restart always itzg/minecraft-server:${imageTag}`;

  const result = await runSshCommand(cmd);

  if (!result.success) {
    return res.status(500).json({ success: false, error: result.error || 'Failed to deploy container.' });
  }

  // Dynamically add to config services if not already present
  if (!config.services.some((s) => s.containerName === cleanName)) {
    config.services.push({
      id: cleanName,
      name: `Minecraft (${cleanName})`,
      category: 'Gaming',
      containerName: cleanName,
      port: cleanPort,
      protocol: 'tcp',
      healthPath: '',
      uiPath: '',
      btnLabel: 'Server Address',
      icon: 'Gamepad2',
      description: `${effectiveType} Minecraft Server on port ${cleanPort}`,
    });
    saveConfig(config);
  }

  res.json({
    success: true,
    message: `Minecraft server '${cleanName}' deployed successfully on port ${cleanPort}! Engine: ${effectiveType}`,
    containerId: (result.stdout || '').trim(),
  });
});

// GET /api/minecraft/:name/mods — list actual .jar files in /data/mods/ inside container
app.get('/api/minecraft/:name/mods', async (req, res) => {
  const { name } = req.params;
  const config = loadConfig();

  if (config.demoMode) {
    return res.json({ mods: ['voicechat-forge-1.20.1-2.6.22.jar', 'examplemod-1.0.jar'] });
  }

  // List files actually present in the /data/mods directory
  const dirRes = await runSshCommand(
    `docker exec ${name} ls /data/mods/ 2>/dev/null || echo ""`
  );

  let mods = [];
  if (dirRes.success && dirRes.stdout && dirRes.stdout.trim()) {
    mods = dirRes.stdout
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0 && f.endsWith('.jar'));
  }

  res.json({ mods });
});

// PUT /api/minecraft/:name/mods — recreate container with updated MODS env (preserves data volume)
app.put('/api/minecraft/:name/mods', async (req, res) => {
  const { name } = req.params;
  const { mods } = req.body; // array of mod URLs/IDs
  const config = loadConfig();

  if (config.demoMode) {
    return res.json({ success: true, message: `[DEMO] Mods updated for '${name}'.` });
  }

  if (!Array.isArray(mods)) {
    return res.status(400).json({ success: false, error: 'mods must be an array of strings.' });
  }

  // Inspect current container to reconstruct its run arguments
  const inspectRes = await runSshCommand(
    `docker inspect ${name} --format '{{json .}}' 2>/dev/null || echo "null"`
  );

  if (!inspectRes.success || !inspectRes.stdout || inspectRes.stdout.trim() === 'null') {
    return res.status(404).json({ success: false, error: `Container '${name}' not found.` });
  }

  let containerInfo;
  try {
    containerInfo = JSON.parse(inspectRes.stdout);
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to parse container info.' });
  }

  const envArray = containerInfo.Config?.Env || [];
  // Strip old MODS entry, keep everything else
  const filteredEnv = envArray.filter(
    (e) => !e.startsWith('MODS=') && !e.startsWith('EULA=')
  );

  // Build -e flags from existing env
  const envFlags = filteredEnv.map((e) => `-e "${e}"`).join(' ');

  // Reconstruct port binding
  const portBindings = containerInfo.HostConfig?.PortBindings || {};
  let portFlag = '';
  for (const [containerPort, bindings] of Object.entries(portBindings)) {
    if (bindings && bindings.length > 0) {
      portFlag += ` -p ${bindings[0].HostPort}:${containerPort.replace('/tcp', '')}`;
    }
  }

  const image = containerInfo.Config?.Image || 'itzg/minecraft-server:java21';
  const modsStr = mods.join(',');
  const modsFlag = modsStr ? ` -e MODS="${modsStr}"` : '';
  const volumeFlag = ` -v ${name}_data:/data`;

  // Stop and remove old container (data volume is preserved)
  const stopCmd = `docker rm -f ${name} 2>/dev/null || true`;
  await runSshCommand(stopCmd);

  // Recreate with new MODS env
  const runCmd = `docker run -d --name ${name}${portFlag} -e EULA=TRUE ${envFlags}${modsFlag}${volumeFlag} --restart always ${image}`;
  const result = await runSshCommand(runCmd);

  if (!result.success) {
    return res.status(500).json({ success: false, error: result.error || 'Failed to recreate container with new mods.' });
  }

  res.json({
    success: true,
    message: `Mods updated and '${name}' restarted. ${mods.length} mod(s) active.`,
    containerId: (result.stdout || '').trim(),
  });
});

// POST /api/minecraft/:name/install-mod — wget URL → docker cp into /data/mods/ → restart
app.post('/api/minecraft/:name/install-mod', async (req, res) => {
  const { name } = req.params;
  const { url } = req.body;
  const config = loadConfig();

  if (config.demoMode) {
    return res.json({ success: true, message: `[DEMO] Mod installed from URL into '${name}'.` });
  }

  if (!url || !url.trim()) {
    return res.status(400).json({ success: false, error: 'url is required.' });
  }

  const cleanUrl = url.trim();
  // Extract filename from URL
  const filename = cleanUrl.split('/').pop().split('?')[0] || 'mod.jar';
  const tmpPath = `/tmp/${filename}`;

  // 1. Ensure /data/mods exists in container
  const mkdirRes = await runSshCommand(`docker exec ${name} mkdir -p /data/mods`);
  if (!mkdirRes.success) {
    return res.status(500).json({ success: false, error: `Failed to create /data/mods: ${mkdirRes.error}` });
  }

  // 2. wget the file onto the host
  const wgetRes = await runSshCommand(`wget -q -O "${tmpPath}" "${cleanUrl}"`, { timeout: 60000 });
  if (!wgetRes.success) {
    return res.status(500).json({ success: false, error: `Failed to download mod: ${wgetRes.error || wgetRes.stderr}` });
  }

  // 3. docker cp into container
  const cpRes = await runSshCommand(`docker cp "${tmpPath}" ${name}:/data/mods/${filename}`);
  if (!cpRes.success) {
    return res.status(500).json({ success: false, error: `Failed to copy mod into container: ${cpRes.error}` });
  }

  // 4. Restart container so Forge picks up the new mod
  const restartRes = await runSshCommand(`docker restart ${name}`);

  // 5. Clean up tmp file
  await runSshCommand(`rm -f "${tmpPath}"`);

  res.json({
    success: restartRes.success,
    message: restartRes.success
      ? `✅ '${filename}' installed into ${name} and server restarted!`
      : `Mod copied but restart failed: ${restartRes.error}`,
    filename,
  });
});

// DELETE /api/minecraft/:name/install-mod — remove a .jar from /data/mods/ and restart
app.delete('/api/minecraft/:name/install-mod', async (req, res) => {
  const { name } = req.params;
  const { filename } = req.body;
  const config = loadConfig();

  if (config.demoMode) {
    return res.json({ success: true, message: `[DEMO] Removed '${filename}' from '${name}'.` });
  }

  if (!filename || !filename.trim() || !filename.endsWith('.jar')) {
    return res.status(400).json({ success: false, error: 'Valid .jar filename required.' });
  }

  const cleanFilename = filename.trim().replace(/[^a-zA-Z0-9._\-+]/g, '');

  const rmRes = await runSshCommand(`docker exec ${name} rm -f /data/mods/${cleanFilename}`);
  if (!rmRes.success) {
    return res.status(500).json({ success: false, error: `Failed to remove mod: ${rmRes.error}` });
  }

  const restartRes = await runSshCommand(`docker restart ${name}`);

  res.json({
    success: restartRes.success,
    message: restartRes.success
      ? `🗑️ '${cleanFilename}' removed from ${name} and server restarted.`
      : `Mod removed but restart failed: ${restartRes.error}`,
  });
});

// POST /api/minecraft/:name/add-udp-port — recreate container with an extra UDP port mapping (e.g. voice chat)
app.post('/api/minecraft/:name/add-udp-port', async (req, res) => {
  const { name } = req.params;
  const { udpPort = 24454 } = req.body;
  const config = loadConfig();

  if (config.demoMode) {
    return res.json({ success: true, message: `[DEMO] UDP port ${udpPort} added to '${name}'.` });
  }

  // Inspect existing container to reconstruct run args
  const inspectRes = await runSshCommand(
    `docker inspect ${name} --format '{{json .}}' 2>/dev/null || echo "null"`
  );

  if (!inspectRes.success || !inspectRes.stdout || inspectRes.stdout.trim() === 'null') {
    return res.status(404).json({ success: false, error: `Container '${name}' not found.` });
  }

  let info;
  try { info = JSON.parse(inspectRes.stdout); }
  catch (e) { return res.status(500).json({ success: false, error: 'Failed to parse container info.' }); }

  const envArray = info.Config?.Env || [];
  const filteredEnv = envArray.filter((e) => !e.startsWith('EULA='));
  const envFlags = filteredEnv.map((e) => `-e "${e}"`).join(' ');

  // Reconstruct existing TCP port bindings
  const portBindings = info.HostConfig?.PortBindings || {};
  let portFlags = '';
  for (const [containerPort, bindings] of Object.entries(portBindings)) {
    if (bindings && bindings.length > 0) {
      const proto = containerPort.includes('udp') ? '/udp' : '';
      portFlags += ` -p ${bindings[0].HostPort}:${containerPort.replace('/tcp','').replace('/udp','')}${proto}`;
    }
  }

  // Check if UDP port is already mapped
  const alreadyMapped = Object.keys(portBindings).some(p => p === `${udpPort}/udp`);
  if (alreadyMapped) {
    return res.json({ success: true, message: `UDP port ${udpPort} is already mapped on '${name}'. No changes needed.` });
  }

  // Add the new UDP port
  portFlags += ` -p ${udpPort}:${udpPort}/udp`;

  const image = info.Config?.Image || 'itzg/minecraft-server:java17';
  const volumeFlag = ` -v ${name}_data:/data`;

  // Stop & remove container (data volume stays)
  await runSshCommand(`docker rm -f ${name} 2>/dev/null || true`);

  // Recreate with new UDP port
  const runCmd = `docker run -d --name ${name}${portFlags} -e EULA=TRUE ${envFlags}${volumeFlag} --restart always ${image}`;
  const result = await runSshCommand(runCmd);

  if (!result.success) {
    return res.status(500).json({ success: false, error: result.error || 'Failed to recreate container.' });
  }

  res.json({
    success: true,
    message: `✅ UDP port ${udpPort} added to '${name}' and server restarted. Voice chat is now reachable!`,
    containerId: (result.stdout || '').trim(),
  });
});

// Multer config — store uploads to OS temp dir, only accept .jar files
const modUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, file.originalname),
  }),
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.jar')) {
      cb(null, true);
    } else {
      cb(new Error('Only .jar files are accepted.'));
    }
  },
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max
});

// POST /api/minecraft/:name/upload-mod — drag & drop .jar → scp → docker cp → restart
app.post('/api/minecraft/:name/upload-mod', modUpload.single('mod'), async (req, res) => {
  const { name } = req.params;
  const config = loadConfig();

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded.' });
  }

  const localTmpPath = req.file.path;
  const filename = req.file.originalname;
  const remoteTmpPath = `/tmp/${filename}`;

  const cleanup = () => {
    try { fs.unlinkSync(localTmpPath); } catch {}
  };

  if (config.demoMode) {
    cleanup();
    return res.json({ success: true, message: `[DEMO] '${filename}' uploaded to '${name}'.` });
  }

  // 1. Ensure /data/mods exists in container
  await runSshCommand(`docker exec ${name} mkdir -p /data/mods`);

  // 2. scp the file from local Mac → Zenbook /tmp/
  const scpRes = await scpFileToServer(localTmpPath, remoteTmpPath);
  if (!scpRes.success) {
    cleanup();
    return res.status(500).json({ success: false, error: `SCP failed: ${scpRes.error}` });
  }

  // 3. docker cp from Zenbook /tmp/ → container /data/mods/
  const cpRes = await runSshCommand(`docker cp "${remoteTmpPath}" ${name}:/data/mods/${filename}`);
  if (!cpRes.success) {
    cleanup();
    await runSshCommand(`rm -f "${remoteTmpPath}"`);
    return res.status(500).json({ success: false, error: `docker cp failed: ${cpRes.error}` });
  }

  // 4. Restart container
  const restartRes = await runSshCommand(`docker restart ${name}`);

  // 5. Clean up both temp files
  cleanup();
  await runSshCommand(`rm -f "${remoteTmpPath}"`);

  res.json({
    success: restartRes.success,
    message: restartRes.success
      ? `✅ '${filename}' installed into ${name} via drag & drop and server restarted!`
      : `Mod uploaded but restart failed: ${restartRes.error}`,
    filename,
  });
});

app.get('/api/minecraft/:name/properties', async (req, res) => {

  const { name } = req.params;
  const config = loadConfig();

  if (config.demoMode) {
    return res.send(`# Minecraft server.properties (Simulated)\nserver-port=25565\ngamemode=survival\ndifficulty=normal\nmotd=Simulated Minecraft World\nmax-players=20\nview-distance=10\nallow-flight=false\n`);
  }

  const result = await runSshCommand(`docker exec ${name} cat /data/server.properties 2>/dev/null || docker exec ${name} cat /data/server.properties.orig 2>/dev/null`);

  if (!result.success && !result.stdout) {
    return res.status(500).send(`Failed to read server.properties for ${name}:\n${result.error}`);
  }

  res.send(result.stdout || 'server.properties not generated yet (Server initializing).');
});

app.post('/api/minecraft/:name/properties', async (req, res) => {
  const { name } = req.params;
  const { propertiesContent } = req.body;
  const config = loadConfig();

  if (config.demoMode) {
    return res.json({ success: true, message: `[DEMO] Saved server.properties for ${name}.` });
  }

  if (!propertiesContent) {
    return res.status(400).json({ success: false, error: 'Properties content required.' });
  }

  // Escape content and write file inside container volume
  const escapedContent = propertiesContent.replace(/'/g, "'\\''");
  const cmd = `docker exec -i ${name} sh -c 'cat << "EOF" > /data/server.properties\n${escapedContent}\nEOF' && docker restart -t 5 ${name}`;

  const result = await runSshCommand(cmd);

  res.json({
    success: result.success,
    message: result.success ? `Updated server.properties and restarted ${name}.` : 'Failed to write server.properties.',
    error: result.error,
  });
});

app.delete('/api/minecraft/:name', async (req, res) => {
  const { name } = req.params;
  const config = loadConfig();

  if (config.demoMode) {
    return res.json({ success: true, message: `[DEMO] Server '${name}' deleted successfully.` });
  }

  // Force stop and remove container and associated data volume over SSH
  const cmd = `docker rm -f ${name} && docker volume rm ${name}_data 2>/dev/null || true`;
  const result = await runSshCommand(cmd);

  // Remove from config services if present
  const initialLength = config.services.length;
  config.services = config.services.filter((s) => s.containerName !== name && s.id !== name);
  if (config.services.length !== initialLength) {
    saveConfig(config);
  }

  res.json({
    success: result.success,
    message: result.success ? `Server '${name}' deleted successfully.` : `Failed to delete ${name}.`,
    error: result.error,
  });
});

// SPA wildcard fallback for non-API GET requests
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  const indexPath = path.resolve(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

app.listen(PORT, () => {

  console.log(`🚀 Zenbook Homelab Dashboard Server running on http://localhost:${PORT}`);
});

