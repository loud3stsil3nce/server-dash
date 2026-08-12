import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';
import { scpFileToServer, runSshCommand, loadConfig } from '../server/sshManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const config = loadConfig();
const REMOTE_USER = process.env.REMOTE_USER || config.sshUser || 'user';
const REMOTE_HOST = process.env.REMOTE_HOST || config.tailscaleIp || config.sshHost || '100.x.y.z';
const REMOTE_DIR = process.env.REMOTE_DIR || `/home/${REMOTE_USER}/Dev/server-dash`;

console.log('⚡ Starting Zenbook Hot-Reload File Watcher...');

// Ensure remote workspace directory structure exists
async function initRemote() {
  await runSshCommand(`mkdir -p ${REMOTE_DIR}/server ${REMOTE_DIR}/src ${REMOTE_DIR}/public`);
  console.log(`📁 Target directory on Zenbook: ${REMOTE_DIR}`);
}

initRemote();

const watcher = chokidar.watch(['src', 'server', 'public', 'index.html', 'vite.config.js', 'package.json'], {
  cwd: rootDir,
  ignoreInitial: true,
  persistent: true,
});

let isBuilding = false;

watcher.on('all', async (event, relPath) => {
  const localFile = path.join(rootDir, relPath);
  const remoteFile = `${REMOTE_DIR}/${relPath}`;
  console.log(`\n🔄 [${event.toUpperCase()}] ${relPath}`);

  if (event === 'addDir') {
    await runSshCommand(`mkdir -p "${remoteFile}"`);
    return;
  }
  if (event === 'unlinkDir') {
    await runSshCommand(`rm -rf "${remoteFile}"`);
    return;
  }
  if (event === 'unlink') {
    await runSshCommand(`rm -f "${remoteFile}"`);
    return;
  }

  // Sync modified file to Zenbook
  const start = Date.now();
  const scpRes = await scpFileToServer(localFile, remoteFile);
  const duration = Date.now() - start;

  if (scpRes.success) {
    console.log(`⚡ Synced ${relPath} to Zenbook in ${duration}ms`);
    
    // If frontend file changed, rebuild dist locally on Mac & sync dist to Zenbook
    if (relPath.startsWith('src/') || relPath === 'index.html' || relPath === 'vite.config.js') {
      if (!isBuilding) {
        isBuilding = true;
        const bStart = Date.now();
        console.log('📦 Rebuilding frontend bundle on Mac...');
        const { exec } = await import('child_process');
        await new Promise(r => exec('npm run build', { cwd: rootDir }, r));
        console.log(`✨ Rebuilt dist in ${Date.now() - bStart}ms! Syncing dist to Zenbook...`);
        await runSshCommand(`mkdir -p ${REMOTE_DIR}/dist/assets`);
        await new Promise(r => exec(`scp -r ${rootDir}/dist/* ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/dist/`, r));
        console.log('🎉 UI updated on Zenbook!');
        isBuilding = false;
      }
    }
  } else {

    console.error(`❌ Sync error for ${relPath}:`, scpRes.error);
  }
});
