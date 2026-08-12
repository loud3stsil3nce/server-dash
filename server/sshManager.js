import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, 'config.json');

// Default initial configuration
const defaultConfig = {
  sshHost: 'zenbook-server', // or '100.115.220.54'
  tailscaleIp: '100.115.220.54',
  sshUser: os.userInfo().username || 'rafiurrahman',
  sshPort: 22,
  sshKeyPath: '~/.ssh/id_ed25519',
  strictHostKeyChecking: false,
  autoRefreshInterval: 5000,
  demoMode: false, // will auto fallback if SSH fails
  services: [
    {
      id: 'pihole',
      name: 'Pi-hole DNS',
      category: 'Network & AdBlock',
      containerName: 'pihole',
      port: 80,
      protocol: 'http',
      healthPath: '/admin/login',
      uiPath: '/admin',
      btnLabel: 'Open Pi-hole Admin',
      icon: 'ShieldCheck',
      description: 'Network-wide ad blocking & DNS sinkhole',
    },
    {
      id: 'minecraft',
      name: 'Minecraft Server',
      category: 'Gaming',
      containerName: 'minecraft',
      port: 25565,
      protocol: 'tcp',
      healthPath: '',
      uiPath: '',
      btnLabel: 'Server Address',
      icon: 'Gamepad2',
      description: 'Survival Multiplayer Vanilla/Paper server',
    },
    {
      id: 'ollama',
      name: 'Ollama AI Host',
      category: 'AI & Machine Learning',
      containerName: 'ollama',
      port: 11434,
      uiPort: 3000,
      protocol: 'http',
      healthPath: '/api/version',
      uiPath: '/',
      btnLabel: 'Launch Open WebUI',
      icon: 'Cpu',
      description: 'Local Large Language Model inference engine',
    },
    {
      id: 'odysseus',
      name: 'Odysseus',
      category: 'Homelab Portal / Proxy',
      containerName: 'odysseus-odysseus-1',
      port: 7000,
      protocol: 'http',
      healthPath: '/',
      uiPath: '/',
      btnLabel: 'Open Odysseus Portal',
      icon: 'Compass',
      description: 'Homelab dashboard and service gateway',
    },
    {
      id: 'verizon-wifi',
      name: 'Verizon Wi-Fi Router',
      category: 'Network & Gateway',
      containerName: '',
      customHost: '192.168.1.1',
      port: 80,
      protocol: 'http',
      healthPath: '/',
      uiPath: '/',
      uiUrl: 'http://192.168.1.1/',
      btnLabel: 'Open Router Settings',
      icon: 'Wifi',
      description: 'Verizon Fios Router Settings & Wi-Fi Management',
    },
  ],
};

export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return { ...defaultConfig, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error loading config, using defaults:', err.message);
  }
  return defaultConfig;
}

export function saveConfig(newConfig) {
  try {
    const updated = { ...loadConfig(), ...newConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (err) {
    console.error('Error saving config:', err);
    throw err;
  }
}

// Expand ~ to homedir in key path
function getExpandedKeyPath(keyPath) {
  if (!keyPath) return '';
  if (keyPath.startsWith('~')) {
    return path.join(os.homedir(), keyPath.slice(1));
  }
  return keyPath;
}

// Helper to run SSH command asynchronously
export async function runSshCommand(cmd, options = {}) {
  const config = loadConfig();

  // If running directly on host or inside container with mounted docker socket, try local execution first
  if (process.env.RUN_LOCAL === 'true' || fs.existsSync('/var/run/docker.sock')) {
    const localRes = await new Promise((resolve) => {
      exec(cmd, { timeout: ((options.timeout || 4) + 15) * 1000 }, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: stderr.trim() || error.message, stdout: stdout.trim(), host: 'localhost (docker.sock)' });
        } else {
          resolve({ success: true, stdout: stdout.trim(), stderr: stderr.trim(), host: 'localhost (docker.sock)' });
        }
      });
    });
    if (localRes.success) {
      return localRes;
    }
  }

  const primaryHost = options.host || config.sshHost || '100.115.220.54';

  const user = options.user || config.sshUser || 'rafiurrahman';
  const port = options.port || config.sshPort || 22;
  const timeout = options.timeout || 4;

  // Hosts to attempt: primary host, then tailscale IP or local IP fallback
  const hostsToTry = [primaryHost];
  if (config.tailscaleIp && !hostsToTry.includes(config.tailscaleIp)) {
    hostsToTry.push(config.tailscaleIp);
  }
  if (!hostsToTry.includes('192.168.1.164')) {
    hostsToTry.push('192.168.1.164');
  }

  let keyFlag = '';
  if (config.sshKeyPath) {
    const expandedPath = getExpandedKeyPath(config.sshKeyPath);
    if (fs.existsSync(expandedPath)) {
      keyFlag = `-i "${expandedPath}"`;
    }
  }

  const strictCheck = config.strictHostKeyChecking ? 'yes' : 'accept-new';
  let lastResult = { success: false, error: 'No hosts tried' };

  for (const host of hostsToTry) {
    const sshCmd = `ssh -o ConnectTimeout=${timeout} -o StrictHostKeyChecking=${strictCheck} -o BatchMode=yes ${keyFlag} -p ${port} ${user}@${host} "${cmd.replace(/"/g, '\\"')}"`;

    const res = await new Promise((resolve) => {
      exec(sshCmd, { timeout: (timeout + 2) * 1000 }, (error, stdout, stderr) => {
        if (error) {
          const errText = stderr.trim() || error.message;
          let userFriendlyError = errText;
          if (errText.includes('Permission denied')) {
            userFriendlyError = `SSH key authorization required for ${user}@${host}.\nRun 'ssh-copy-id ${user}@${host}' in Mac terminal.`;
          } else if (errText.includes('Connection reset') || errText.includes('kex_exchange_identification')) {
            userFriendlyError = `SSH server reset connection on ${host}:22.\nPlease ensure your SSH public key is added to ~/.ssh/authorized_keys on the Zenbook host.`;
          }
          resolve({
            success: false,
            error: userFriendlyError,
            rawError: errText,
            stdout: stdout.trim(),
            cmd: sshCmd,
            host,
          });
        } else {
          resolve({
            success: true,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            cmd: sshCmd,
            host,
          });
        }
      });
    });

    if (res.success) {
      return res;
    }
    lastResult = res;
  }

  return lastResult;
}

// Transfer a local file to the remote server via scp
export async function scpFileToServer(localPath, remotePath, options = {}) {
  const config = loadConfig();

  // If running locally or in container with docker socket, do direct file copy
  if (process.env.RUN_LOCAL === 'true' || fs.existsSync('/var/run/docker.sock')) {
    try {
      fs.copyFileSync(localPath, remotePath);
      return { success: true, stdout: `Copied ${localPath} -> ${remotePath}`, host: 'localhost' };
    } catch (e) {
      // Fallback to scp if direct copy fails
    }
  }

  const primaryHost = options.host || config.sshHost || '100.115.220.54';

  const user = options.user || config.sshUser || 'rafiurrahman';
  const port = options.port || config.sshPort || 22;

  const hostsToTry = [primaryHost];
  if (config.tailscaleIp && !hostsToTry.includes(config.tailscaleIp)) {
    hostsToTry.push(config.tailscaleIp);
  }
  if (!hostsToTry.includes('192.168.1.164')) {
    hostsToTry.push('192.168.1.164');
  }

  let keyFlag = '';
  if (config.sshKeyPath) {
    const expandedPath = getExpandedKeyPath(config.sshKeyPath);
    if (fs.existsSync(expandedPath)) {
      keyFlag = `-i "${expandedPath}"`;
    }
  }

  const strictCheck = config.strictHostKeyChecking ? 'yes' : 'accept-new';
  let lastResult = { success: false, error: 'No hosts tried' };

  for (const host of hostsToTry) {
    const scpCmd = `scp -o ConnectTimeout=10 -o StrictHostKeyChecking=${strictCheck} -o BatchMode=yes ${keyFlag} -P ${port} "${localPath}" ${user}@${host}:"${remotePath}"`;

    const res = await new Promise((resolve) => {
      exec(scpCmd, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: stderr.trim() || error.message, host });
        } else {
          resolve({ success: true, stdout: stdout.trim(), host });
        }
      });
    });

    if (res.success) return res;
    lastResult = res;
  }

  return lastResult;
}

// System stats mock data generator for fallback
export function getMockSystemStats() {
  const cpuVal = (12 + Math.random() * 25).toFixed(1);
  const ramUsed = (4.8 + Math.random() * 0.8).toFixed(1);
  const ramTotal = 16.0;
  const diskUsed = 124.5;
  const diskTotal = 512.0;

  return {
    isLive: false,
    mode: 'DEMO / SIMULATION',
    host: 'zenbook-server (Demo)',
    tailscaleIp: '100.115.220.54',
    uptime: '14 days, 6 hours, 22 mins',
    cpuPercent: parseFloat(cpuVal),
    memory: {
      usedGb: parseFloat(ramUsed),
      totalGb: ramTotal,
      percent: Math.round((parseFloat(ramUsed) / ramTotal) * 100),
    },
    disk: {
      usedGb: diskUsed,
      totalGb: diskTotal,
      percent: Math.round((diskUsed / diskTotal) * 100),
    },
    tempC: (44 + Math.random() * 5).toFixed(1),
    loadAvg: ['0.42', '0.55', '0.61'],
    lastUpdated: new Date().toISOString(),
  };
}

export function getMockContainers() {
  const baseTime = Date.now();
  return [
    {
      id: 'a1b2c3d4e5f6',
      name: 'pihole',
      image: 'pihole/pihole:latest',
      status: 'Up 4 days (healthy)',
      state: 'running',
      cpu: `${(0.4 + Math.random() * 0.8).toFixed(1)}%`,
      mem: '142.5MiB / 15.6GiB',
      memPerc: '0.89%',
      netIO: '4.2MB / 18.5MB',
      blockIO: '0B / 12.4MB',
      pids: '18',
    },
    {
      id: 'f6e5d4c3b2a1',
      name: 'minecraft',
      image: 'itzg/minecraft-server:latest',
      status: 'Up 2 days',
      state: 'running',
      cpu: `${(15.2 + Math.random() * 12).toFixed(1)}%`,
      mem: '3.42GiB / 15.6GiB',
      memPerc: '21.9%',
      netIO: '85.4MB / 142.1MB',
      blockIO: '1.2GB / 450MB',
      pids: '44',
    },
    {
      id: '7a8b9c0d1e2f',
      name: 'ollama',
      image: 'ollama/ollama:latest',
      status: 'Up 1 day',
      state: 'running',
      cpu: `${(1.2 + Math.random() * 3).toFixed(1)}%`,
      mem: '850.2MiB / 15.6GiB',
      memPerc: '5.32%',
      netIO: '12.8MB / 4.1MB',
      blockIO: '8.4GB / 0B',
      pids: '12',
    },
    {
      id: '9f8e7d6c5b4a',
      name: 'odysseus',
      image: 'odysseus/portal:v1.2.0',
      status: 'Up 6 days (healthy)',
      state: 'running',
      cpu: `${(0.2 + Math.random() * 0.4).toFixed(1)}%`,
      mem: '68.4MiB / 15.6GiB',
      memPerc: '0.43%',
      netIO: '1.5MB / 2.8MB',
      blockIO: '0B / 0B',
      pids: '8',
    },
  ];
}
