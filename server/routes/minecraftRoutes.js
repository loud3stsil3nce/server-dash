import express from 'express';
import multer from 'multer';
import path from 'path';
import { loadConfig, saveConfig, runSshCommand } from '../sshManager.js';
import {
  getMinecraftServers,
  createMinecraftServer,
  parseProperties,
  serializeProperties,
} from '../services/minecraftService.js';

const router = express.Router();
const modUpload = multer({ dest: '/tmp/mc-uploads/' });

// GET /api/minecraft/servers
router.get('/minecraft/servers', async (req, res) => {
  const servers = await getMinecraftServers();
  res.json(servers);
});

// POST /api/minecraft/create
router.post('/minecraft/create', async (req, res) => {
  const result = await createMinecraftServer(req.body);
  res.json(result);
});

// GET /api/minecraft/:name/mods
router.get('/minecraft/:name/mods', async (req, res) => {
  const { name } = req.params;
  const config = loadConfig();

  if (config.demoMode) {
    return res.json([
      { filename: 'voicechat-fabric-1.20.4-2.5.10.jar', path: '/data/mods/voicechat-fabric-1.20.4-2.5.10.jar', enabled: true },
      { filename: 'sodium-fabric-0.5.8.jar', path: '/data/mods/sodium-fabric-0.5.8.jar', enabled: true },
    ]);
  }

  const cmd = `docker run --rm --volumes-from ${name} alpine ls -lh /data/mods 2>/dev/null || echo ""`;
  const result = await runSshCommand(cmd);

  if (!result.success || !result.stdout) return res.json([]);

  const lines = result.stdout.split('\n').filter((l) => l.trim().length > 0);
  const mods = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const filename = parts[parts.length - 1];
    if (filename && (filename.endsWith('.jar') || filename.endsWith('.disabled'))) {
      mods.push({
        filename,
        path: `/data/mods/${filename}`,
        enabled: !filename.endsWith('.disabled'),
      });
    }
  }

  res.json(mods);
});

// POST /api/minecraft/:name/install-mod
router.post('/minecraft/:name/install-mod', async (req, res) => {
  const { name } = req.params;
  const { modUrl } = req.body;
  const config = loadConfig();

  if (!modUrl) return res.status(400).json({ success: false, error: 'Mod URL is required' });

  if (config.demoMode) {
    return res.json({ success: true, message: `[DEMO] Downloaded mod from ${modUrl}` });
  }

  const filename = modUrl.split('/').pop().split('?')[0] || `mod_${Date.now()}.jar`;
  const cmd = `docker run --rm --volumes-from ${name} alpine sh -c "mkdir -p /data/mods && wget -O /data/mods/${filename} '${modUrl}'" && docker restart ${name}`;

  const result = await runSshCommand(cmd, { timeout: 45 });
  res.json({
    success: result.success,
    message: result.success ? `Installed mod '${filename}' and restarted server.` : `Failed to install mod.`,
    error: result.error,
  });
});

// POST /api/minecraft/:name/add-udp-port
router.post('/minecraft/:name/add-udp-port', async (req, res) => {
  const { name } = req.params;
  const { udpPort = 24454 } = req.body;
  const config = loadConfig();

  if (config.demoMode) {
    return res.json({ success: true, message: `[DEMO] UDP Port ${udpPort} bound to ${name}.` });
  }

  const inspCmd = `docker inspect ${name} --format '{{json .Config}}'`;
  const result = await runSshCommand(inspCmd);

  if (!result.success || !result.stdout) {
    return res.status(404).json({ success: false, error: `Server container ${name} not found.` });
  }

  try {
    const configObj = JSON.parse(result.stdout);
    const envs = configObj.Env || [];
    const envFlags = envs.map((e) => `-e "${e.replace(/"/g, '\\"')}"`).join(' ');

    const recreateCmd = `docker stop ${name} && docker rm ${name} && docker run -d --name ${name} ${envFlags} -p 25565:25565 -p ${udpPort}:${udpPort}/udp -v ${name}_data:/data --restart unless-stopped ${configObj.Image}`;
    const recResult = await runSshCommand(recreateCmd, { timeout: 30 });

    res.json({
      success: recResult.success,
      message: recResult.success ? `UDP Port ${udpPort} mapped and ${name} recreated!` : `Failed to update UDP port.`,
      error: recResult.error,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/minecraft/:name/properties
router.get('/minecraft/:name/properties', async (req, res) => {
  const { name } = req.params;
  const config = loadConfig();

  if (config.demoMode) {
    return res.json({
      raw: 'gamemode=survival\ndifficulty=normal\nmax-players=20\nmotd=A Minecraft Server',
      parsed: { gamemode: 'survival', difficulty: 'normal', 'max-players': '20', motd: 'A Minecraft Server' },
    });
  }

  const cmd = `docker run --rm --volumes-from ${name} alpine cat /data/server.properties 2>/dev/null || echo ""`;
  const result = await runSshCommand(cmd);

  if (!result.success) return res.status(500).json({ success: false, error: result.error });

  const raw = result.stdout || '';
  const parsed = parseProperties(raw);
  res.json({ raw, parsed });
});

// POST /api/minecraft/:name/properties
router.post('/minecraft/:name/properties', async (req, res) => {
  const { name } = req.params;
  const { properties } = req.body;
  const config = loadConfig();

  if (!properties || typeof properties !== 'object') {
    return res.status(400).json({ success: false, error: 'Properties object is required' });
  }

  if (config.demoMode) {
    return res.json({ success: true, message: `[DEMO] server.properties updated for ${name}.` });
  }

  const fileContent = serializeProperties(properties);
  const base64Content = Buffer.from(fileContent).toString('base64');
  const cmd = `docker run --rm --volumes-from ${name} alpine sh -c "echo '${base64Content}' | base64 -d > /data/server.properties" && docker restart ${name}`;

  const result = await runSshCommand(cmd, { timeout: 30 });
  res.json({
    success: result.success,
    message: result.success ? `server.properties updated and ${name} restarted.` : `Failed to save properties.`,
    error: result.error,
  });
});

// DELETE /api/minecraft/:name
router.delete('/minecraft/:name', async (req, res) => {
  const { name } = req.params;
  const config = loadConfig();

  if (config.demoMode) {
    return res.json({ success: true, message: `[DEMO] Server '${name}' deleted successfully.` });
  }

  const cmd = `docker rm -f ${name} && docker volume rm ${name}_data 2>/dev/null || true`;
  const result = await runSshCommand(cmd);

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

// GET /api/minecraft/:name/backups
router.get('/minecraft/:name/backups', async (req, res) => {
  const { name } = req.params;
  const config = loadConfig();

  if (config.demoMode) {
    return res.json([
      { id: 'b1', filename: 'minecraft_backup_2026-08-10.tar.gz', date: '2026-08-10 14:30', size: '342 MB' },
    ]);
  }

  const remoteUser = config.sshUser || 'rafiurrahman';
  const backupDir = `/home/${remoteUser}/minecraft_backups/${name}`;

  const cmd = `mkdir -p ${backupDir} && ls -lh ${backupDir}/*.tar.gz 2>/dev/null || echo ""`;
  const result = await runSshCommand(cmd);

  if (!result.success || !result.stdout) return res.json([]);

  const lines = result.stdout.split('\n').filter((l) => l.trim().length > 0);
  const backups = lines.map((line, idx) => {
    const parts = line.trim().split(/\s+/);
    const filename = parts[parts.length - 1].split('/').pop();
    const size = parts[4] || 'Unknown';
    const date = `${parts[5] || ''} ${parts[6] || ''} ${parts[7] || ''}`.trim();
    return { id: `b-${idx}`, filename, date, size };
  });

  res.json(backups);
});

// POST /api/minecraft/:name/backup
router.post('/minecraft/:name/backup', async (req, res) => {
  const { name } = req.params;
  const config = loadConfig();

  if (config.demoMode) {
    return res.json({ success: true, message: `[DEMO] World backup created for ${name}.` });
  }

  const remoteUser = config.sshUser || 'rafiurrahman';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = `/home/${remoteUser}/minecraft_backups/${name}`;
  const backupFile = `${backupDir}/${name}_backup_${timestamp}.tar.gz`;

  const cmd = `mkdir -p ${backupDir} && docker run --rm --volumes-from ${name} -v ${backupDir}:${backupDir} alpine tar -czf ${backupFile} -C /data .`;
  const result = await runSshCommand(cmd, { timeout: 60000 });

  res.json({
    success: result.success,
    message: result.success ? `Backup created: ${name}_backup_${timestamp}.tar.gz` : `Failed to create backup.`,
    error: result.error,
  });
});

// POST /api/minecraft/:name/restore
router.post('/minecraft/:name/restore', async (req, res) => {
  const { name } = req.params;
  const { filename } = req.body;
  const config = loadConfig();

  if (!filename) return res.status(400).json({ success: false, error: 'Filename is required' });
  if (config.demoMode) {
    return res.json({ success: true, message: `[DEMO] Restored world from ${filename}.` });
  }

  const remoteUser = config.sshUser || 'rafiurrahman';

  const cmd = `docker stop ${name} && docker run --rm --volumes-from ${name} -v /home/${remoteUser}/minecraft_backups/${name}:/backup alpine sh -c "rm -rf /data/* && tar -xzf /backup/${filename} -C /data" && docker start ${name}`;
  const result = await runSshCommand(cmd, { timeout: 90000 });

  res.json({
    success: result.success,
    message: result.success ? `World restored from ${filename} and server restarted.` : `Failed to restore backup.`,
    error: result.error,
  });
});

export default router;
