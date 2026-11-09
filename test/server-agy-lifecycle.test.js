import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverPath = fileURLToPath(new URL('../server/index.js', import.meta.url));

async function waitFor(read, message, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  do {
    const value = await read();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 10));
  } while (Date.now() < deadline);
  assert.fail(message);
}

function processExists(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(`server ${signal} stops an in-flight detached tutor and its helper`, {
    timeout: 10_000, skip: process.platform === 'win32'
  }, async t => {
    const directory = await mkdtemp(path.join(tmpdir(), 'keybreakers-server-shutdown-'));
    const scratch = path.join(directory, 'scratch');
    const bin = path.join(directory, 'fake-agy.cjs');
    const observationPath = path.join(directory, 'started.json');
    await mkdir(scratch);
    // A local fixture, not an AI provider. It deliberately ignores SIGTERM and
    // the native timeout so this checks the server's own shutdown cleanup.
    await writeFile(bin, `#!${process.execPath}
const fs = require('node:fs');
const {spawn} = require('node:child_process');
process.on('SIGTERM', () => {});
process.stdin.resume();
process.stdin.on('end', () => {
  const helper = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], {stdio: 'ignore'});
  helper.unref();
  fs.writeFileSync(${JSON.stringify(observationPath)}, JSON.stringify({pid: process.pid, helperPid: helper.pid, cwd: process.cwd(), args: process.argv.slice(2)}));
  setInterval(() => {}, 1000);
});
`, { mode: 0o700 });

    const child = spawn(process.execPath, [serverPath], {
      env: {
        PATH: `${path.dirname(process.execPath)}${path.delimiter}/usr/bin${path.delimiter}/bin`,
        PORT: '0', TUTOR_ADAPTER: 'agy', AGY_BIN: bin,
        AGY_TIMEOUT_MS: '60000', TMPDIR: scratch, PARENT_PIN: '1234'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '', observation;
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    const exit = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, exitSignal) => resolve({ code, signal: exitSignal }));
    });
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      // Keep a failing assertion from leaving test helpers behind.
      if (!observation) {
        try { observation = JSON.parse(await readFile(observationPath, 'utf8')); } catch {}
      }
      if (observation) {
        try { process.kill(-observation.pid, 'SIGKILL'); } catch {}
      }
      await exit;
      await rm(directory, { recursive: true, force: true });
    });

    const url = await waitFor(() => stdout.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0],
      `Server did not start: ${stderr}`);
    const started = await fetch(`${url}/api/session/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: 'ch1-n1-reverse-tolls' })
    });
    assert.equal(started.status, 200);
    const { sessionId } = await started.json();
    // Attach rejection immediately: shutdown intentionally closes this request.
    const pendingAction = fetch(`${url}/api/session/${sessionId}/action`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'arrive' } })
    }).then(response => response.arrayBuffer()).catch(() => null);
    observation = await waitFor(async () => {
      try { return JSON.parse(await readFile(observationPath, 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    }, 'The local tutor fixture did not start');
    assert.equal(processExists(observation.pid), true);
    assert.equal(processExists(observation.helperPid), true);
    assert.equal(observation.args[observation.args.indexOf('--print-timeout') + 1], '60s');

    assert.equal(child.kill(signal), true);
    assert.deepEqual(await exit, { code: 0, signal: null });
    await pendingAction;
    await waitFor(() => !processExists(observation.pid) && !processExists(observation.helperPid),
      'Server exit left the tutor or its descendant alive');
  });
}
