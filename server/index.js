import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Modular Route Handlers
import systemRoutes from './routes/systemRoutes.js';
import containerRoutes from './routes/containerRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import minecraftRoutes from './routes/minecraftRoutes.js';
import ollamaRoutes from './routes/ollamaRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());

// Serve Production React Build Static Assets
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Mount API Routers
app.use('/api', systemRoutes);
app.use('/api', containerRoutes);
app.use('/api', serviceRoutes);
app.use('/api', minecraftRoutes);
app.use('/api', ollamaRoutes);

// SPA Fallback Route
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

export default app;
