/**
 * Castle of Theorems — Milestone M3 Server & Integration Test Suite
 * test/server.test.js
 *
 * Runs with: node --test
 * Verifies:
 * 1. Server startup on ephemeral port 0 (server.listen(0)).
 * 2. Static file serving (HTML, JS, CSS, SVG) with correct MIME types and path traversal prevention (403/404).
 * 3. REST API tests: POST /api/session/start, POST /api/session/:id/action, GET /api/session/:id/state, GET /api/encounters, GET /api/encounter/:id/view.
 * 4. SSE test: GET /api/parent/transcript?session=<id>&pin=1234 verifying text/event-stream headers,
 *    initial connection event, and real-time streaming upon child action.
 * 5. Security & PIN tests: 401 Unauthorized for missing or incorrect PIN (timing-safe check).
 * 6. Parent actions: POST /api/parent/hint-override, POST /api/parent/toggle-scribe, POST /api/parent/waiver.
 * 7. Clean server teardown without hanging sockets.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startServer, closeServer } from '../server/index.js';
import { assertClientSafe } from '../server/engine/clientView.js';
import { getEncounter } from '../server/tutor/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIR = path.resolve(__dirname, '../client');

describe('M3 Server & Integration Test Suite', () => {
  let testEnv;
  let testUrl;
  const PARENT_PIN = '1234';

  before(async () => {
    // Start server on ephemeral port 0
    testEnv = await startServer(0, '127.0.0.1', { parentPin: PARENT_PIN });
    testUrl = testEnv.url;
  });

  after(async () => {
    if (testEnv && testEnv.server) {
      await closeServer(testEnv.server);
    }
  });

  // 1. Server Startup on Ephemeral Port 0
  describe('1. Server Startup on Ephemeral Port 0', () => {
    it('listens on an assigned positive ephemeral port', () => {
      assert.ok(testEnv.port > 0, `Port should be > 0, got ${testEnv.port}`);
      assert.ok(Number.isInteger(testEnv.port));
      assert.match(testUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
    });
  });

  // 2. Static File Serving & Path Traversal Security
  describe('2. Static File Serving & Security', () => {
    it('serves index.html at root with text/html; charset=utf-8', async () => {
      const res = await fetch(`${testUrl}/`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/html/);
      const text = await res.text();
      assert.match(text, /Castle of Theorems/);
    });

    it('serves style.css with text/css; charset=utf-8', async () => {
      const res = await fetch(`${testUrl}/style.css`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/css/);
      const text = await res.text();
      assert.match(text, /--parchment-bg/);
    });

    it('serves app.js with text/javascript; charset=utf-8', async () => {
      const res = await fetch(`${testUrl}/app.js`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/javascript/);
      const text = await res.text();
      assert.match(text, /CastleGame/);
    });

    it('serves manifest.webmanifest with application/manifest+json; charset=utf-8', async () => {
      const res = await fetch(`${testUrl}/manifest.webmanifest`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /manifest\+json/);
    });

    it('blocks directory traversal attempts (../../package.json) with 403 or 404', async () => {
      const res = await fetch(`${testUrl}/../../package.json`);
      assert.ok(res.status === 403 || res.status === 404, `Expected 403/404, got ${res.status}`);
    });

    it('blocks encoded directory traversal attempts (%2e%2e%2f) with 403 or 404', async () => {
      const res = await fetch(`${testUrl}/%2e%2e%2fpackage.json`);
      assert.ok(res.status === 403 || res.status === 404, `Expected 403/404, got ${res.status}`);
    });

    it('rejects null byte injection with 403 or 400', async () => {
      const res = await fetch(`${testUrl}/index.html%00.js`);
      assert.ok(res.status === 403 || res.status === 400);
    });

    it('returns 404 for non-existent static files with extensions', async () => {
      const res = await fetch(`${testUrl}/non-existent-artifact.xyz`);
      assert.equal(res.status, 404);
    });
  });

  // 3. REST API: Sessions, Actions & Client-Safe Views
  describe('3. REST API Gameplay Endpoints', () => {
    let sessionId;
    const encounterId = 'ch1-n1-reverse-tolls';

    it('GET /api/encounters returns catalog of 4 encounters with node 1 unlocked', async () => {
      const res = await fetch(`${testUrl}/api/encounters`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(data.encounters.length, 4);
      assert.equal(data.encounters[0].unlocked, true);
      assert.equal(data.encounters[0].node, 1);
    });

    it('POST /api/session/start initializes session and returns client-safe view', async () => {
      const res = await fetch(`${testUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId, tutorAdapter: 'scripted' })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.sessionId);
      sessionId = data.sessionId;
      assert.ok(data.view);
      assert.equal(data.view.encounterId, encounterId);
      assert.equal(data.view.state, 'arrive');
      assert.equal(data.view.workspaceUnlocked, false);

      // Verify zero secret leakage
      const encounter = getEncounter(encounterId);
      assert.doesNotThrow(() => assertClientSafe(data.view, encounter));
    });

    it('GET /api/session/:id/state returns current client-safe view', async () => {
      const res = await fetch(`${testUrl}/api/session/${sessionId}/state`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.view);
      assert.equal(data.view.sessionId, sessionId);
      assert.equal(data.view.state, 'arrive');
    });

    it('POST /api/session/:id/action advances game state and records events', async () => {
      // Arrive -> Conjecture
      const act1 = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'arrive' } })
      });
      assert.equal(act1.status, 200);
      const data1 = await act1.json();
      assert.equal(data1.state, 'conjecture');

      // Conjecture -> Understand (wrong conjecture routes to understand at l1)
      const act2 = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: {
            type: 'conjecture',
            stem: 'think',
            value: 99,
            reason: 'I am guessing 99 coins'
          }
        })
      });

      assert.equal(act2.status, 200);
      const data2 = await act2.json();
      assert.ok(data2.view);
      assert.equal(data2.view.state, 'understand');
      assert.ok(Array.isArray(data2.events));
      assert.ok(data2.speech);
    });

    it('GET /api/encounter/:id/view returns sanitized encounter without secret keys', async () => {
      const res = await fetch(`${testUrl}/api/encounter/${encounterId}/view`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.id, encounterId);
      assert.equal(data.answer, undefined);
      assert.equal(data.intermediates, undefined);
      assert.equal(data.forbidden, undefined);
    });
  });

  // 4. SSE Real-Time Streaming & Parent Transcript
  describe('4. SSE Parent Transcript Streaming', () => {
    it('streams connected event and live updates upon child action', async () => {
      // Start session
      const startRes = await fetch(`${testUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: 'ch1-n1-reverse-tolls' })
      });
      const { sessionId } = await startRes.json();

      // Connect SSE client
      const ssePromise = new Promise((resolve, reject) => {
        const req = http.get(`${testUrl}/api/parent/transcript?session=${sessionId}&pin=${PARENT_PIN}`, (res) => {
          assert.equal(res.statusCode, 200);
          assert.match(res.headers['content-type'], /text\/event-stream/);
          assert.equal(res.headers['connection'], 'keep-alive');

          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk.toString();
            if (buffer.includes('event: connected') && buffer.includes('event: update')) {
              req.destroy();
              resolve(buffer);
            }
          });
          res.on('error', reject);
        });
        req.on('error', reject);
      });

      // Allow SSE connection to register
      await new Promise(r => setTimeout(r, 60));

      // Child executes action triggering SSE update
      await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'chip', text: 'Find how many coins she paid in total' }
        })
      });

      const sseContent = await ssePromise;
      assert.match(sseContent, /event: connected/);
      assert.match(sseContent, /event: update/);
    });
  });

  // 5. Security & PIN Authentication Tests
  describe('5. Security & PIN Authentication', () => {
    it('rejects SSE request without PIN with 401', async () => {
      const res = await fetch(`${testUrl}/api/parent/transcript?session=s1`);
      assert.equal(res.status, 401);
    });

    it('rejects SSE request with wrong PIN with 401', async () => {
      const res = await fetch(`${testUrl}/api/parent/transcript?session=s1&pin=9999`);
      assert.equal(res.status, 401);
    });

    it('rejects parent override with wrong PIN with 401', async () => {
      const res = await fetch(`${testUrl}/api/parent/hint-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 's1', pin: '9999', hintRung: 'l2' })
      });
      assert.equal(res.status, 401);
    });
  });

  // 6. Parent Controls: Hint Override, Scribe Mode & Waiver
  describe('6. Parent Actions & Controls', () => {
    let sessionId;

    before(async () => {
      const startRes = await fetch(`${testUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: 'ch1-n1-reverse-tolls' })
      });
      const data = await startRes.json();
      sessionId = data.sessionId;
    });

    it('POST /api/parent/hint-override updates current hint level', async () => {
      const res = await fetch(`${testUrl}/api/parent/hint-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, pin: PARENT_PIN, hintRung: 'l2' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.hintRung, 'l2');

      const stateRes = await fetch(`${testUrl}/api/session/${sessionId}/state`);
      const stateData = await stateRes.json();
      assert.equal(stateData.view.hintRung, 'l2');
    });

    it('POST /api/parent/toggle-scribe toggles scribe mode on session view', async () => {
      const res = await fetch(`${testUrl}/api/parent/toggle-scribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, pin: PARENT_PIN, enabled: true })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.parentScribe, true);

      const stateRes = await fetch(`${testUrl}/api/session/${sessionId}/state`);
      const stateData = await stateRes.json();
      assert.equal(stateData.view.parentScribe, true);
    });

    it('POST /api/parent/waiver applies once-per-chapter Look Back waiver', async () => {
      const res1 = await fetch(`${testUrl}/api/parent/waiver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, pin: PARENT_PIN })
      });
      assert.equal(res1.status, 200);
      const data1 = await res1.json();
      assert.equal(data1.waived, true);

      // Attempting second waiver must fail with 400
      const res2 = await fetch(`${testUrl}/api/parent/waiver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, pin: PARENT_PIN })
      });
      assert.equal(res2.status, 400);
      const data2 = await res2.json();
      assert.match(data2.error, /already used/i);
    });
  });

  // 7. Pure SVG Diagram Components Tests
  describe('7. Pure SVG Diagram Components', () => {
    it('renders all 4 diagram components in hint and workspace modes without errors', async () => {
      const { getDiagramComponent, renderDiagram } = await import('../client/diagrams/index.js');

      const diagramComponents = [
        { name: 'reverse-tolls', alias: 'inverse-chain', spec: { component: 'reverse-tolls', params: { end: 13, gates: [{ mul: 2, sub: 5 }] } } },
        { name: 'dark-vault', alias: 'pigeonhole-bins', spec: { component: 'dark-vault', params: { bins: 3, perBin: 12, target: { same: 2 } } } },
        { name: 'five-shields', alias: 'seam-grid', spec: { component: 'five-shields', params: { outerPerimeter: 66, relation: { shortCount: 3, longCount: 2 } } } },
        { name: 'castle-keep', alias: 'factor-tree', spec: { component: 'castle-keep', params: { products: [{ left: 'Jimmy', right: 'Kimmy', value: 34 }] } } }
      ];

      for (const diag of diagramComponents) {
        const mod1 = getDiagramComponent(diag.name);
        const mod2 = getDiagramComponent(diag.alias);
        assert.ok(mod1, `Component ${diag.name} should be resolved`);
        assert.ok(mod2, `Component alias ${diag.alias} should be resolved`);
        assert.equal(typeof mod1.render, 'function');
        assert.equal(typeof mod1.mount, 'function');

        // Test mode: hint
        const hintSvg = renderDiagram(diag.spec, 'hint', null);
        assert.match(hintSvg, /<svg[^>]+role="img"/);
        assert.match(hintSvg, /aria-label=/);

        // Test mode: workspace
        const wsSvg = renderDiagram(diag.spec, 'workspace', null);
        assert.match(wsSvg, /<svg[^>]+role="img"/);
        assert.match(wsSvg, /aria-label=/);
      }
    });
  });

  // 8. SPA Routes & Static Assets
  describe('8. SPA Routes & Static Assets', () => {
    it('serves parent.html at /parent', async () => {
      const res = await fetch(`${testUrl}/parent`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/html/);
      const text = await res.text();
      assert.match(text, /Parent Dashboard/);
    });

    it('falls back to index.html for client route /codex', async () => {
      const res = await fetch(`${testUrl}/codex`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/html/);
      const text = await res.text();
      assert.match(text, /Castle of Theorems/);
    });

    it('serves sw.js with text/javascript; charset=utf-8', async () => {
      const res = await fetch(`${testUrl}/sw.js`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/javascript/);
      const text = await res.text();
      assert.match(text, /cot-v1-cache/);
    });

    it('confirms zero runtime dependencies in package.json', () => {
      const pkgPath = path.resolve(CLIENT_DIR, '../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assert.deepEqual(pkg.dependencies, {}, 'dependencies must be strictly empty');
    });
  });
});

