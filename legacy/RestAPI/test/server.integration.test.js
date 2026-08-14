const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const port = 18080 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
let server;

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('RestAPI did not start in time.')), 5_000);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Server running.')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      if (code !== 0) {
        clearTimeout(timer);
        reject(new Error(`RestAPI exited early with code ${code}.`));
      }
    });
  });
}

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      API_WRITE_KEY: 'integration-test-key',
      ALLOWED_ORIGIN: 'http://teacher.example',
      DATABASE_URL: 'postgresql://invalid:invalid@127.0.0.1:5432/invalid',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer(server);
});

after(() => {
  if (server && !server.killed) server.kill('SIGTERM');
});

test('health is available and returns a constrained CORS origin', async () => {
  const response = await fetch(`${baseUrl}/`, { headers: { Origin: 'http://teacher.example' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://teacher.example');
  assert.deepEqual(await response.json(), { status: 'ok' });

  const untrusted = await fetch(`${baseUrl}/`, { headers: { Origin: 'http://untrusted.example' } });
  assert.equal(untrusted.headers.get('access-control-allow-origin'), null);
});

test('daily-question writes require the configured write key', async () => {
  const denied = await fetch(`${baseUrl}/daily-question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Unauthenticated write' }),
  });
  assert.equal(denied.status, 401);

  const accepted = await fetch(`${baseUrl}/daily-question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': 'integration-test-key' },
    body: JSON.stringify({ question: 'Authenticated write', body: 'Trusted update' }),
  });
  assert.equal(accepted.status, 201);
});

test('metrics writes reject missing keys and negative values before database access', async () => {
  const missingKey = await fetch(`${baseUrl}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reading_speed: 10, mistakes: 0, rereads: 0, word_count: 10, mistake_ratio: 0, duration: '00:30' }),
  });
  assert.equal(missingKey.status, 401);

  const invalidValues = await fetch(`${baseUrl}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': 'integration-test-key' },
    body: JSON.stringify({ reading_speed: -1, mistakes: 0, rereads: 0, word_count: 10, mistake_ratio: 0, duration: '00:30' }),
  });
  assert.equal(invalidValues.status, 400);
});
