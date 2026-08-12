# 🖥️ Server-Dash

**Server-Dash** is a lightweight, modern, real-time Homelab Dashboard & Remote Server Management suite built with **React 19**, **Vite 8**, **Express 5**, and **SSH / Docker CLI**. 

It provides self-hosters, sysadmins, and game server managers with an intuitive, unified control center to monitor Linux server telemetry, manage Docker containers, inspect live container logs, run remote SSH commands, and administer game servers—**without requiring heavyweight background agents installed on target machines.**

---

## ✨ Features at a Glance

### ⚡ Real-Time Telemetry Streaming
- **Live Hardware Monitoring**: High-frequency real-time Server-Sent Events (`/api/stream`) for CPU usage, RAM utilization, Disk space, Load averages, Network I/O, and CPU temperature.
- **Configurable Sync Rates**: Switch dynamically between real-time SSE streaming (1s) and polling intervals (5s, 10s, 30s) or offline simulation/demo mode.

### 🐳 Docker Container Control Center
- **Live Stats Table**: Real-time per-container CPU%, RAM footprint, block I/O, and PIDs (`docker stats`).
- **Instant Actions**: One-click Start, Stop, and Restart controls with zero-latency optimistic UI feedback.
- **Log Streaming Modal**: Interactive container log viewer (`docker logs --tail --follow`) with search filtering and clear log capabilities.

### 🌐 Homelab Services Matrix
- **Service Health Checks**: Monitor homelab services (Pi-hole DNS, Ollama AI, Odysseus Portal, Wi-Fi Gateways, game servers) with live TCP/HTTP probe status indicators.
- **One-Click Portals**: Direct quick-access launch buttons for all web interfaces and services across Tailscale or local LAN IPs.

### 💻 Web SSH Interactive Terminal
- **Browser Terminal**: Execute remote Linux shell commands over SSH directly from your browser.
- **Auto-Completion Support**: Smart command suggestions and completion suggestions (`/api/terminal/complete`).

### 🎮 Dedicated Minecraft Multi-Server Suite
- **Multi-Instance Management**: Deploy, manage, and monitor Paper, Forge, Fabric, or Vanilla server instances.
- **Mod & Plugin Manager**: 1-click install, uninstall, and custom `.jar` mod file upload directly into server `/mods` directories.
- **Property & UDP Configuration**: Live GUI editor for `server.properties` and allocation of dynamic UDP ports for voice chat and multiplayer mods.

---

## 🎯 Purpose & Why Use Server-Dash?

### For You (The Homelab Administrator)
Server-Dash was designed to consolidate server monitoring, container management, and game hosting into a single, sleek dashboard. It eliminates the need to ssh manually into terminal sessions just to restart a container, check memory usage, or add a Minecraft mod.

### How Others Can Benefit
- **Homelab Enthusiasts**: Centralized portal for monitoring self-hosted stacks (Pi-hole, Plex, Home Assistant, Ollama, Portainer) on home servers, NUCs, or Raspberry Pis.
- **Game Server Admins**: Effortless deployment and management of Minecraft server instances and mods without complex multi-panel setups.
- **Developers & Sysadmins**: Zero-agent architecture allows managing any remote Linux instance over standard SSH key authentication out-of-the-box.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite 8, Lucide React Icons, Custom Fluid CSS Design System.
- **Backend**: Express 5 (Node.js ES Modules), `ssh2`, `chokidar`, `multer`, `cors`.
- **Infrastructure**: Docker, Docker Compose, Tailscale / SSH.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: `v18.x` or higher
- **Target Remote Host**: Any Linux server accessible via SSH (SSH key-based auth recommended)
- **Docker**: Installed on the target server (if using container management features)

### 2. Installation & Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/server-dash.git
cd server-dash

# Install dependencies
npm install

# Create your server configuration
cp server/config.example.json server/config.json
```

### 3. Configuration

Edit `server/config.json` with your target server details:

```json
{
  "sshHost": "your-server-hostname-or-ip",
  "tailscaleIp": "100.x.y.z",
  "sshUser": "your-username",
  "sshPort": 22,
  "sshKeyPath": "~/.ssh/id_ed25519",
  "strictHostKeyChecking": false,
  "autoRefreshInterval": 5000,
  "demoMode": false,
  "services": [ ... ]
}
```

### 4. Running the Development Server

Start both the Express backend and React Vite frontend concurrently:

```bash
npm run dev
```

Open your browser at `http://localhost:8050` (or `http://localhost:3001` for backend API).

---

## 🐳 Docker Deployment

You can also run Server-Dash inside a Docker container:

```bash
# Build & start using Docker Compose
docker-compose up -d --build
```

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for details.
