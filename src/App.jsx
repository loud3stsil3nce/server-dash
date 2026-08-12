import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import MetricsCards from './components/MetricsCards';
import TelemetryCharts from './components/TelemetryCharts';
import ServicesHealth from './components/ServicesHealth';
import ContainerTable from './components/ContainerTable';
import LogViewerModal from './components/LogViewerModal';
import SettingsModal from './components/SettingsModal';
import InteractiveTerminal from './components/InteractiveTerminal';
import MinecraftManagerModal from './components/MinecraftManagerModal';
import ProcessExplorerModal from './components/ProcessExplorerModal';
import ContainerExecModal from './components/ContainerExecModal';
import OllamaAssistantModal from './components/OllamaAssistantModal';
import AddServiceModal from './components/AddServiceModal';
import Toast from './components/Toast';

export default function App() {
  const [systemStats, setSystemStats] = useState(null);
  const [containers, setContainers] = useState([]);
  const [services, setServices] = useState([]);
  const [config, setConfig] = useState(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(1000); // Default to Real-Time SSE Stream (1s)

  // Modals & Drawers state
  const [activeLogContainer, setActiveLogContainer] = useState(null);
  const [activeExecContainer, setActiveExecContainer] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMinecraftManagerOpen, setIsMinecraftManagerOpen] = useState(false);
  const [isProcessExplorerOpen, setIsProcessExplorerOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [aiDiagnosisData, setAiDiagnosisData] = useState({ logs: '', context: '' });

  const [actionStateMap, setActionStateMap] = useState({});
  const [toast, setToast] = useState(null);

  // 1. Fetch initial configuration
  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  // 2. Fetch all telemetry metrics manually
  const fetchAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [statsRes, containersRes, healthRes] = await Promise.all([
        fetch('/api/status').then((r) => r.json()),
        fetch('/api/containers').then((r) => r.json()),
        fetch('/api/services/health').then((r) => r.json()),
      ]);

      setSystemStats(statsRes);
      setContainers(containersRes);
      setServices(healthRes);
    } catch (err) {
      console.error('Error syncing telemetry:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, []);

  // 3. Real-Time Streaming / Polling Interval Effect
  useEffect(() => {
    if (refreshInterval === 1000) {
      // Open persistent Real-Time Server-Sent Events Stream
      const evtSource = new EventSource('/api/stream');
      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.systemStats) setSystemStats(data.systemStats);
          if (data.containers) setContainers(data.containers);
          if (data.services) setServices(data.services);
        } catch (err) {
          console.error('SSE data parse error:', err);
        }
      };
      evtSource.onerror = (err) => {
        console.warn('SSE stream error, reconnecting...', err);
      };
      return () => {
        evtSource.close();
      };
    } else if (refreshInterval > 1000) {
      fetchAllData();
      const interval = setInterval(() => {
        fetchAllData();
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchAllData]);

  // Handle Save Configuration
  const handleSaveConfig = async (newConfig) => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setToast({ type: 'success', message: 'Configuration saved successfully' });
        fetchAllData();
      }
    } catch (err) {
      setToast({ type: 'error', message: `Failed to save config: ${err.message}` });
    }
  };

  // Handle Container Actions (Restart, Start, Stop) with optimistic feedback
  const handleContainerAction = async (name, action) => {
    setActionStateMap((prev) => ({ ...prev, [name]: action }));

    setContainers((prev) =>
      prev.map((c) => {
        if (c.name === name) {
          return {
            ...c,
            status: action === 'restart' ? 'Restarting...' : action === 'stop' ? 'Stopping...' : 'Starting...',
            state: action === 'stop' ? 'exited' : 'running',
          };
        }
        return c;
      })
    );

    setToast({
      type: 'info',
      message: `Sending ${action} signal to container ${name}...`,
    });

    try {
      const res = await fetch(`/api/container/${name}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (data.success) {
        setToast({
          type: 'success',
          message: `Container ${name} ${action}ed successfully (${data.newState || 'OK'}).`,
        });

        await fetchAllData();
        setTimeout(() => fetchAllData(), 2500);
      } else {
        setToast({
          type: 'error',
          message: `Failed to ${action} ${name}: ${data.error || data.output || 'Unknown error'}`,
        });
        fetchAllData();
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: `Network error on ${action} ${name}: ${err.message}`,
      });
      fetchAllData();
    } finally {
      setActionStateMap((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  return (
    <div className="dashboard-container">
      {/* Navigation Header */}
      <Header
        systemStats={systemStats}
        onRefresh={fetchAllData}
        isRefreshing={isRefreshing}
        refreshInterval={refreshInterval}
        onIntervalChange={setRefreshInterval}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Top Telemetry Cards Grid */}
      <MetricsCards
        systemStats={systemStats}
        containersCount={containers.length}
        onOpenProcesses={() => setIsProcessExplorerOpen(true)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
      />

      {/* Live Animated Telemetry Charts */}
      <TelemetryCharts systemStats={systemStats} />

      {/* Homelab Services Health Matrix */}
      <ServicesHealth
        services={services}
        tailscaleIp={systemStats?.tailscaleIp || config?.tailscaleIp}
        sshHost={systemStats?.host || config?.sshHost}
        onRestartContainer={(name) => handleContainerAction(name, 'restart')}
        onOpenLogs={(name) => setActiveLogContainer(name)}
        onOpenMinecraftManager={() => setIsMinecraftManagerOpen(true)}
        onOpenAddService={() => setIsAddServiceOpen(true)}
        actionStateMap={actionStateMap}
      />

      {/* Docker Containers Monitor Table */}
      <ContainerTable
        containers={containers}
        onRestartContainer={(name) => handleContainerAction(name, 'restart')}
        onContainerAction={handleContainerAction}
        onOpenLogs={(name) => setActiveLogContainer(name)}
        onOpenExec={(name) => setActiveExecContainer(name)}
        actionStateMap={actionStateMap}
      />

      {/* Interactive Web SSH Terminal */}
      <InteractiveTerminal
        isLive={systemStats?.isLive ?? true}
        hostName={systemStats?.host || config?.sshHost || 'zenbook-server'}
      />

      {/* Minecraft Multi-Server Manager Modal */}
      {isMinecraftManagerOpen && (
        <MinecraftManagerModal
          onClose={() => setIsMinecraftManagerOpen(false)}
          onOpenLogs={(name) => setActiveLogContainer(name)}
          onTriggerRefresh={fetchAllData}
        />
      )}

      {/* Log Viewer Modal */}
      {activeLogContainer && (
        <LogViewerModal
          containerName={activeLogContainer}
          onClose={() => setActiveLogContainer(null)}
          onOpenAiDiagnosis={(logs, context) => {
            setAiDiagnosisData({ logs, context });
            setIsAiAssistantOpen(true);
          }}
        />
      )}

      {/* Process Explorer Modal */}
      {isProcessExplorerOpen && (
        <ProcessExplorerModal
          onClose={() => setIsProcessExplorerOpen(false)}
          onToast={setToast}
        />
      )}

      {/* Container Exec Modal */}
      {activeExecContainer && (
        <ContainerExecModal
          containerName={activeExecContainer}
          onClose={() => setActiveExecContainer(null)}
          onToast={setToast}
        />
      )}

      {/* Ollama AI Assistant Modal */}
      {isAiAssistantOpen && (
        <OllamaAssistantModal
          initialLogs={aiDiagnosisData.logs}
          initialContext={aiDiagnosisData.context}
          onClose={() => {
            setIsAiAssistantOpen(false);
            setAiDiagnosisData({ logs: '', context: '' });
          }}
        />
      )}

      {/* Add Custom Service Modal */}
      {isAddServiceOpen && (
        <AddServiceModal
          onClose={() => setIsAddServiceOpen(false)}
          onSave={fetchAllData}
          onToast={setToast}
        />
      )}

      {/* Configuration Settings Modal */}
      {isSettingsOpen && config && (
        <SettingsModal
          config={config}
          onSaveConfig={handleSaveConfig}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
