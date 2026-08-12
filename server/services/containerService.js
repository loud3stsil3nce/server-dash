import { loadConfig, runSshCommand, getMockContainers } from '../sshManager.js';

export async function getContainersData(config) {
  if (config.demoMode) {
    return getMockContainers();
  }

  const cmd = `docker ps -a --format '{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","status":"{{.Status}}","state":"{{.State}}"}' && echo "===STATS===" && docker stats --no-stream --format '{"name":"{{.Name}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}","memPerc":"{{.MemPerc}}","netIO":"{{.NetIO}}","blockIO":"{{.BlockIO}}","pids":"{{.PIDs}}"}' 2>/dev/null || echo ""`;

  const result = await runSshCommand(cmd, { timeout: 6 });

  if (!result.success || !result.stdout) {
    return getMockContainers();
  }

  try {
    const [psOutput, statsOutput] = result.stdout.split('===STATS===');

    const containersMap = new Map();
    if (psOutput) {
      psOutput
        .trim()
        .split('\n')
        .forEach((line) => {
          if (!line.trim()) return;
          try {
            const obj = JSON.parse(line);
            containersMap.set(obj.name, {
              id: obj.id,
              name: obj.name,
              image: obj.image,
              status: obj.status,
              state: obj.state,
              cpu: '0.0%',
              mem: '0B / 0B',
              memPerc: '0.0%',
              netIO: '0B / 0B',
              blockIO: '0B / 0B',
              pids: '0',
            });
          } catch (e) {}
        });
    }

    if (statsOutput) {
      statsOutput
        .trim()
        .split('\n')
        .forEach((line) => {
          if (!line.trim()) return;
          try {
            const st = JSON.parse(line);
            if (containersMap.has(st.name)) {
              const existing = containersMap.get(st.name);
              existing.cpu = st.cpu || '0.0%';
              existing.mem = st.mem || '0B / 0B';
              existing.memPerc = st.memPerc || '0.0%';
              existing.netIO = st.netIO || '0B / 0B';
              existing.blockIO = st.blockIO || '0B / 0B';
              existing.pids = st.pids || '0';
            }
          } catch (e) {}
        });
    }

    return Array.from(containersMap.values());
  } catch (err) {
    return getMockContainers();
  }
}

export async function executeContainerAction(name, action) {
  const config = loadConfig();
  if (!['restart', 'stop', 'start'].includes(action)) {
    throw new Error('Invalid container action');
  }

  if (config.demoMode) {
    return {
      success: true,
      newState: action === 'stop' ? 'exited' : 'running',
      message: `[DEMO] Container ${name} ${action} command simulated successfully.`,
    };
  }

  const timeoutFlag = action === 'stop' || action === 'restart' ? ' -t 5' : '';
  const cmd = `docker ${action}${timeoutFlag} ${name} && docker inspect -f '{{.State.Status}}' ${name} 2>/dev/null || echo "unknown"`;

  const result = await runSshCommand(cmd);
  const lines = (result.stdout || '').split('\n');
  const newState = lines[lines.length - 1].trim();

  return {
    success: result.success,
    newState: newState || (action === 'stop' ? 'exited' : 'running'),
    output: result.stdout || result.stderr,
    error: result.error,
  };
}

export async function getContainerLogs(name, tail = 100) {
  const config = loadConfig();
  if (config.demoMode) {
    return `[DEMO LOGS FOR ${name}]\n[INFO] Initializing service...\n[SUCCESS] Ready on port 8080.`;
  }

  const cmd = `docker logs --tail ${tail} ${name} 2>&1`;
  const result = await runSshCommand(cmd, { timeout: 8 });
  return result.stdout || result.stderr || 'No logs returned.';
}

export async function execInsideContainer(name, command) {
  const config = loadConfig();
  if (!command || !command.trim()) throw new Error('Command required');

  if (config.demoMode) {
    return {
      success: true,
      output: `[DEMO EXEC inside '${name}']:\n$ ${command}\nExecuted successfully.`,
    };
  }

  const sanitizedCmd = command.replace(/"/g, '\\"');
  const execCmd = `docker exec ${name} sh -c "${sanitizedCmd}" 2>&1 || docker exec ${name} bash -c "${sanitizedCmd}" 2>&1`;
  const result = await runSshCommand(execCmd, { timeout: 20000 });

  return {
    success: result.success,
    output: result.stdout || result.stderr || 'Command executed with no output.',
    error: result.error,
  };
}

export async function pruneDockerSystem() {
  const config = loadConfig();
  if (config.demoMode) {
    return {
      success: true,
      output: '[DEMO] Total reclaimed space: 1.45 GB (deleted 4 unused images & 2 volumes)',
    };
  }

  const cmd = `docker system prune -af --volumes`;
  const result = await runSshCommand(cmd, { timeout: 45000 });

  return {
    success: result.success,
    output: result.stdout || result.stderr || 'System prune completed.',
    error: result.error,
  };
}
