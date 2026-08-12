import React, { useState } from 'react';
import { X, Plus, Server } from 'lucide-react';

export default function AddServiceModal({ onClose, onSave, onToast }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Custom Services');
  const [containerName, setContainerName] = useState('');
  const [port, setPort] = useState('');
  const [protocol, setProtocol] = useState('http');
  const [healthPath, setHealthPath] = useState('/');
  const [uiPath, setUiPath] = useState('/');
  const [icon, setIcon] = useState('Server');
  const [description, setDescription] = useState('');

  const icons = ['Server', 'Globe', 'ShieldCheck', 'Gamepad2', 'Cpu', 'HardDrive', 'Compass', 'Wifi'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !port) {
      if (onToast) onToast({ type: 'error', message: 'Service name and port are required.' });
      return;
    }

    try {
      const res = await fetch('/api/services/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          containerName,
          port: parseInt(port, 10),
          protocol,
          healthPath,
          uiPath,
          icon,
          description,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (onToast) onToast({ type: 'success', message: `Service '${name}' added successfully!` });
        onSave();
        onClose();
      } else {
        if (onToast) onToast({ type: 'error', message: data.error || 'Failed to add service' });
      }
    } catch (err) {
      if (onToast) onToast({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-service-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-box">
            <div className="modal-icon-badge">
              <Plus size={20} color="#06b6d4" />
            </div>
            <div>
              <h2>Add Tracked Homelab Service</h2>
              <p className="modal-subtitle">Register a new self-hosted web app or service portal to your matrix</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-sm">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="modal-body add-service-form">
          <div className="form-row-2col">
            <div className="form-group-custom">
              <label className="form-label-custom">Service Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Home Assistant"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input-custom"
              />
              <span className="form-helper-text">Display name on your portal card.</span>
            </div>
            <div className="form-group-custom">
              <label className="form-label-custom">Category</label>
              <input
                type="text"
                placeholder="e.g. Smart Home"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="form-input-custom"
              />
              <span className="form-helper-text">Group title (Gaming, AI, Gateway).</span>
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group-custom">
              <label className="form-label-custom">Port Number *</label>
              <input
                type="number"
                required
                placeholder="e.g. 8123"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="form-input-custom"
              />
              <span className="form-helper-text">TCP/HTTP port bound on host.</span>
            </div>
            <div className="form-group-custom">
              <label className="form-label-custom">Docker Container Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. homeassistant"
                value={containerName}
                onChange={(e) => setContainerName(e.target.value)}
                className="form-input-custom"
              />
              <span className="form-helper-text">For direct container log & restart shortcuts.</span>
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group-custom">
              <label className="form-label-custom">Protocol</label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                className="form-select-custom"
              >
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="tcp">TCP Raw</option>
              </select>
              <span className="form-helper-text">Connection type for health checks.</span>
            </div>
            <div className="form-group-custom">
              <label className="form-label-custom">Display Icon</label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="form-select-custom"
              >
                {icons.map((ic) => (
                  <option key={ic} value={ic}>
                    {ic}
                  </option>
                ))}
              </select>
              <span className="form-helper-text">Visual badge icon for card header.</span>
            </div>
          </div>

          <div className="form-group-custom">
            <label className="form-label-custom">Description</label>
            <input
              type="text"
              placeholder="Brief service description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input-custom"
            />
            <span className="form-helper-text">Subtitle description displayed on the card.</span>
          </div>

          <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              Add Service
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
