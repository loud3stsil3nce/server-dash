import assert from 'node:assert/strict';
import { getSystemStatusData, getProcessesList, killProcess } from '../services/systemService.js';

export async function runSystemServiceTests() {
  console.log('🧪 Testing System Service...');

  // Test 1: getSystemStatusData in Demo Mode
  const demoConfig = { demoMode: true };
  const stats = await getSystemStatusData(demoConfig);
  assert.equal(typeof stats.cpuPercent, 'number', 'CPU percent should be a number');
  assert.ok(stats.memory.usedGb >= 0, 'Memory used should be non-negative');
  assert.ok(stats.disk.percent >= 0, 'Disk percent should be non-negative');
  console.log('  ✓ getSystemStatusData demo mode test passed');

  // Test 2: getProcessesList in Demo Mode
  const processes = await getProcessesList();
  assert.ok(Array.isArray(processes), 'Processes should be an array');
  assert.ok(processes.length > 0, 'Processes array should contain items');
  assert.ok(processes[0].pid, 'Process item should have PID');
  console.log('  ✓ getProcessesList test passed');

  // Test 3: killProcess
  const killRes = await killProcess('1234', 'TERM');
  assert.ok(killRes.success, 'killProcess should return success');
  console.log('  ✓ killProcess test passed');
}
