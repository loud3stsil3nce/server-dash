import { loadConfig, saveConfig, runSshCommand } from '../sshManager.js';

export async function getHealthData(config) {
  const host = config.sshHost || config.tailscaleIp || 'zenbook-server';

  const healthPromises = config.services.map(async (svc) => {
    if (config.demoMode) {
      return {
        id: svc.id,
        health: { status: 'ONLINE', latency: Math.floor(12 + Math.random() * 15), code: 200, message: '200 OK (Demo)' },
      };
    }

    const targetHost = svc.customHost ? svc.customHost : host;

    if (svc.protocol === 'tcp') {
      const probeCmd = `nc -z -w 3 ${targetHost} ${svc.port} 2>/dev/null && echo "OPEN" || echo "CLOSED"`;
      const res = await runSshCommand(probeCmd, { timeout: 4 });

      if (res.success && res.stdout.includes('OPEN')) {
        return { id: svc.id, health: { status: 'ONLINE', latency: 15, code: 200, message: 'TCP Port Open' } };
      } else {
        return { id: svc.id, health: { status: 'OFFLINE', latency: null, code: 0, message: 'TCP Port Closed' } };
      }
    }

    const url = `${svc.protocol}://${targetHost}:${svc.port}${svc.healthPath !== undefined ? svc.healthPath : ''}`;
    const probeCmd = `curl -s -o /dev/null -w "%{http_code}|%{time_total}" --connect-timeout 3 "${url}" 2>/dev/null || echo "000|0"`;
    const res = await runSshCommand(probeCmd, { timeout: 4 });

    if (res.success && res.stdout) {
      const [codeStr, timeStr] = res.stdout.trim().split('|');
      const code = parseInt(codeStr, 10);
      const latencyMs = Math.round(parseFloat(timeStr || '0') * 1000);

      if (code >= 200 && code < 400) {
        return { id: svc.id, health: { status: 'ONLINE', latency: latencyMs, code, message: `${code} OK` } };
      } else if (code >= 400 && code < 500) {
        return { id: svc.id, health: { status: 'ONLINE', latency: latencyMs, code, message: `${code} Auth/Path Required` } };
      } else {
        return { id: svc.id, health: { status: 'OFFLINE', latency: null, code, message: code ? `${code} Error` : 'Connection Refused' } };
      }
    }

    return { id: svc.id, health: { status: 'OFFLINE', latency: null, code: 0, message: 'Timeout' } };
  });

  const results = await Promise.all(healthPromises);
  const healthMap = new Map(results.map((r) => [r.id, r.health]));

  return config.services.map((svc) => ({
    ...svc,
    health: healthMap.get(svc.id) || { status: 'UNKNOWN', latency: null, code: 0, message: 'No telemetry' },
  }));
}
