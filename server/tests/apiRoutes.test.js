import assert from 'node:assert/strict';
import http from 'http';
import app from '../index.js';

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://localhost:3099${path}`,
      {
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const body = res.headers['content-type']?.includes('application/json') ? JSON.parse(data) : data;
            resolve({ status: res.statusCode, headers: res.headers, body });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, body: data });
          }
        });
      }
    );

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'object' ? JSON.stringify(options.body) : options.body);
    }
    req.end();
  });
}

export async function runApiRoutesTests() {
  console.log('🧪 Testing API Endpoints...');

  const server = app.listen(3099);

  try {
    // Test GET /api/config
    const resConfig = await makeRequest('/api/config');
    assert.equal(resConfig.status, 200, '/api/config should return 200 OK');
    assert.ok(resConfig.body.services, '/api/config should return services array');
    console.log('  ✓ GET /api/config test passed');

    // Test GET /api/status
    const resStatus = await makeRequest('/api/status');
    assert.equal(resStatus.status, 200, '/api/status should return 200 OK');
    assert.ok(resStatus.body.memory, '/api/status should return memory data');
    console.log('  ✓ GET /api/status test passed');

    // Test GET /api/containers
    const resContainers = await makeRequest('/api/containers');
    assert.equal(resContainers.status, 200, '/api/containers should return 200 OK');
    assert.ok(Array.isArray(resContainers.body), '/api/containers should return array');
    console.log('  ✓ GET /api/containers test passed');

    // Test GET /api/processes
    const resProc = await makeRequest('/api/processes');
    assert.equal(resProc.status, 200, '/api/processes should return 200 OK');
    assert.ok(resProc.body.success, '/api/processes should return success: true');
    console.log('  ✓ GET /api/processes test passed');
  } finally {
    server.close();
  }
}
