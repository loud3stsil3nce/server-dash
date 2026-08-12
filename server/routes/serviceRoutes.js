import express from 'express';
import { loadConfig, saveConfig, runSshCommand } from '../sshManager.js';
import { getHealthData } from '../services/serviceService.js';

const router = express.Router();

// GET /api/services/health
router.get('/services/health', async (req, res) => {
  const config = loadConfig();
  const data = await getHealthData(config);
  res.json(data);
});

// POST /api/pihole/action
router.post('/pihole/action', async (req, res) => {
  const { action } = req.body;
  const config = loadConfig();

  if (config.demoMode) {
    return res.json({ success: true, message: `[DEMO] Pi-hole action ${action} executed.` });
  }

  let piCmd = 'docker exec pihole pihole enable';
  if (action === 'disable_5m') piCmd = 'docker exec pihole pihole disable 5m';
  if (action === 'disable_15m') piCmd = 'docker exec pihole pihole disable 15m';

  const result = await runSshCommand(piCmd);
  res.json({
    success: result.success,
    message: result.success ? `Pi-hole action executed successfully.` : `Failed to execute Pi-hole action.`,
    output: result.stdout || result.stderr,
    error: result.error,
  });
});

// POST /api/services/add
router.post('/services/add', async (req, res) => {
  const { name, category, containerName, port, protocol, healthPath, uiPath, icon, description, customHost } = req.body;
  const config = loadConfig();

  if (!name || !port) {
    return res.status(400).json({ success: false, error: 'Name and Port are required' });
  }

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const newService = {
    id,
    name,
    category: category || 'Custom Service',
    containerName: containerName || '',
    customHost: customHost || '',
    port: parseInt(port, 10),
    protocol: protocol || 'http',
    healthPath: healthPath || '/',
    uiPath: uiPath || '/',
    btnLabel: `Open ${name}`,
    icon: icon || 'Server',
    description: description || 'User configured service',
  };

  config.services.push(newService);
  saveConfig(config);

  res.json({ success: true, services: config.services });
});

// DELETE /api/services/:id
router.delete('/services/:id', async (req, res) => {
  const { id } = req.params;
  const config = loadConfig();

  config.services = config.services.filter((s) => s.id !== id);
  saveConfig(config);

  res.json({ success: true, services: config.services });
});

export default router;
