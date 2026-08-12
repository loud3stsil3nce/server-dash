import React, { useState } from 'react';
import { Plus } from 'lucide-react';

export default function MinecraftCreateForm({ onDeploy, isSubmitting }) {
  const [formData, setFormData] = useState({
    name: 'minecraft-survival',
    port: 25565,
    type: 'PAPER',
    version: '1.20.4',
    memory: '4G',
    mode: 'survival',
    difficulty: 'normal',
    motd: 'My Zenbook Minecraft Server',
    maxPlayers: 20,
    modpackUrl: '',
    mods: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onDeploy(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="add-service-form">
      <div className="form-row-2col">
        <div className="form-group-custom">
          <label className="form-label-custom">Container / Server Name *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="form-input-custom"
          />
          <span className="form-helper-text">Unique name for your container instance.</span>
        </div>
        <div className="form-group-custom">
          <label className="form-label-custom">Server Port *</label>
          <input
            type="number"
            required
            value={formData.port}
            onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value, 10) })}
            className="form-input-custom"
          />
          <span className="form-helper-text">TCP port (e.g. 25565, 25566).</span>
        </div>
      </div>

      <div className="form-row-2col">
        <div className="form-group-custom">
          <label className="form-label-custom">Server Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="form-select-custom"
          >
            <option value="PAPER">Paper (Optimized Performance)</option>
            <option value="SPIGOT">Spigot</option>

            <option value="FORGE">Forge (Modded)</option>
            <option value="FABRIC">Fabric (Modded)</option>
            <option value="VANILLA">Vanilla Official</option>
            <option value="PURPUR">Purpur</option>
          </select>
          <span className="form-helper-text">Server software platform.</span>
        </div>
        <div className="form-group-custom">
          <label className="form-label-custom">Minecraft Version</label>
          <input
            type="text"
            value={formData.version}
            onChange={(e) => setFormData({ ...formData, version: e.target.value })}
            className="form-input-custom"
          />
          <span className="form-helper-text">e.g. 1.20.4, 1.20.1, LATEST</span>
        </div>
      </div>

      <div className="form-row-2col">
        <div className="form-group-custom">
          <label className="form-label-custom">RAM Memory Allocation</label>
          <select
            value={formData.memory}
            onChange={(e) => setFormData({ ...formData, memory: e.target.value })}
            className="form-select-custom"
          >
            <option value="2G">2 GB RAM</option>
            <option value="4G">4 GB RAM (Recommended)</option>
            <option value="6G">6 GB RAM</option>
            <option value="8G">8 GB RAM</option>
            <option value="12G">12 GB RAM</option>
          </select>
          <span className="form-helper-text">Allocated heap memory limit.</span>
        </div>

        <div className="form-group-custom">
          <label className="form-label-custom">Game Mode</label>
          <select
            value={formData.mode}
            onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
            className="form-select-custom"
          >
            <option value="survival">Survival</option>
            <option value="creative">Creative</option>

            <option value="adventure">Adventure</option>
            <option value="spectator">Spectator</option>
          </select>
        </div>
      </div>

      <div className="form-group-custom">
        <label className="form-label-custom">Server MOTD (Message of the Day)</label>
        <input
          type="text"
          value={formData.motd}
          onChange={(e) => setFormData({ ...formData, motd: e.target.value })}
          className="form-input-custom"
        />
      </div>

      <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
        <Plus size={16} />
        <span>{isSubmitting ? 'Deploying Docker Container...' : 'Deploy Minecraft Server'}</span>
      </button>
    </form>
  );
}
