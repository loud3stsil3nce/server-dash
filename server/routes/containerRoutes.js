import express from 'express';
import { loadConfig } from '../sshManager.js';
import {
  getContainersData,
  executeContainerAction,
  getContainerLogs,
  execInsideContainer,
  pruneDockerSystem,
} from '../services/containerService.js';

const router = express.Router();

// GET /api/containers
router.get('/containers', async (req, res) => {
  const config = loadConfig();
  const data = await getContainersData(config);
  res.json(data);
});

// GET /api/container/:name/logs
router.get('/container/:name/logs', async (req, res) => {
  const { name } = req.params;
  const logs = await getContainerLogs(name);
  res.send(logs);
});

// POST /api/container/:name/action
router.post('/container/:name/action', async (req, res) => {
  const { name } = req.params;
  const { action } = req.body;
  try {
    const result = await executeContainerAction(name, action);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/container/:name/exec
router.post('/container/:name/exec', async (req, res) => {
  const { name } = req.params;
  const { command } = req.body;
  try {
    const result = await execInsideContainer(name, command);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/docker/prune
router.post('/docker/prune', async (req, res) => {
  const result = await pruneDockerSystem();
  res.json(result);
});

export default router;
