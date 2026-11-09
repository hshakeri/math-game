/**
 * Castle of Theorems — Milestone M4 Challenger Test Suite
 * test/challenger-m4-assets.test.js
 *
 * Adversarial empirical testing of:
 * 1. Server Static Asset Approval Gate:
 *    - Unlisted files physically on disk under /assets/
 *    - Non-existent asset paths
 *    - Unapproved assets (approved: false, non-boolean values, null)
 *    - Directory listings
 *    - Path traversal attacks (dot-dot, url-encoded, null bytes, backslash)
 *    - Manifest corruption and missing manifest resilience
 *    - SHA-256 integrity and file tampering detection
 * 2. Multi-Part Progression through Alchemist's Dark Vault:
 *    - Part a -> sealed (partSealed: true, hasMoreParts: true, sealed: false, NO Golden Seal modal)
 *    - next_part -> Part b arrive -> arrive -> Part b conjecture
 *    - Part b solve -> sealed (partSealed: true, hasMoreParts: true, sealed: false)
 *    - next_part -> Part c arrive -> solve -> look_back -> sealed
 *    - Full HTTP API verification of every step
 *    - UI contract verification in app.js and index.html
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { startServer, closeServer, getEncounterById } from '../server/index.js';
import { createSession, transition, getClientSafeView } from '../server/engine/stateMachine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const CANONICAL_CLIENT_DIR = path.resolve(REPO_ROOT, 'client');
const CANONICAL_ASSETS_DIR = path.resolve(CANONICAL_CLIENT_DIR, 'assets');
const CANONICAL_MANIFEST_PATH = path.resolve(CANONICAL_ASSETS_DIR, 'manifest.json');

describe('Challenger M4: Asset Gate Security & Dark Vault Multi-Part Progression', () => {
  let testEnv;
  let testUrl;
  let scratchClientDir;
  let scratchAssetsDir;
  let scratchManifestPath;

  before(async () => {
    // Create an isolated scratch client directory so adversarial manifest tests
    // never collide with concurrent tests (e.g. test/assets.test.js) in node --test
    scratchClientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cot-m4-challenger-'));
    fs.cpSync(CANONICAL_CLIENT_DIR, scratchClientDir, { recursive: true });
    scratchAssetsDir = path.join(scratchClientDir, 'assets');
    scratchManifestPath = path.join(scratchAssetsDir, 'manifest.json');

    testEnv = await startServer(0, '127.0.0.1', { clientDir: scratchClientDir });
    testUrl = testEnv.url;
  });

  after(async () => {
    if (testEnv?.server) {
      await closeServer(testEnv.server);
    }
    if (scratchClientDir && fs.existsSync(scratchClientDir)) {
      fs.rmSync(scratchClientDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // SUITE 1: ADVERSARIAL ASSET GATE STRESS
  // =========================================================================
  describe('1. Adversarial Asset Approval Gate Stress', () => {
    it('1.1 returns HTTP 404 for non-existent asset paths under /assets/', async () => {
      const paths = [
        '/assets/scenes/not-found-gate-99.svg',
        '/assets/avatars/phantom-owl.svg',
        '/assets/nonexistent-folder/test.svg',
        '/assets/ghost.svg'
      ];
      for (const p of paths) {
        const res = await fetch(`${testUrl}${p}`);
        assert.equal(res.status, 404, `Expected 404 for ${p}, got ${res.status}`);
        const data = await res.json();
        assert.equal(data.ok, false);
      }
    });

    it('1.2 strictly denies unlisted files physically existing on disk under /assets/ with HTTP 404', async () => {
      // Create a temporary unlisted file on disk in scratch client dir
      const unlistedPath = path.join(scratchAssetsDir, 'scenes/challenger-unlisted.svg');
      fs.writeFileSync(unlistedPath, '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>', 'utf8');

      try {
        const res = await fetch(`${testUrl}/assets/scenes/challenger-unlisted.svg`);
        assert.equal(res.status, 404, `Expected 404 for unlisted disk asset, got ${res.status}`);
        const data = await res.json();
        assert.equal(data.ok, false);
        assert.equal(data.error, 'Asset not registered in manifest');
      } finally {
        if (fs.existsSync(unlistedPath)) {
          fs.unlinkSync(unlistedPath);
        }
      }
    });

    it('1.3 strictly denies unapproved assets (approved: false) with HTTP 403', async () => {
      const rawManifest = fs.readFileSync(scratchManifestPath, 'utf8');
      const manifestObj = JSON.parse(rawManifest);
      const targetAsset = 'scenes/ch1-n2-locked.svg';
      const originalEntry = manifestObj.assets[targetAsset];

      try {
        manifestObj.assets[targetAsset] = {
          ...originalEntry,
          approved: false
        };
        fs.writeFileSync(scratchManifestPath, JSON.stringify(manifestObj, null, 2), 'utf8');
        const future = new Date(Date.now() + 2000);
        fs.utimesSync(scratchManifestPath, future, future);

        const res = await fetch(`${testUrl}/assets/${targetAsset}`);
        assert.equal(res.status, 403, `Expected 403 for unapproved asset, got ${res.status}`);
        const data = await res.json();
        assert.equal(data.ok, false);
        assert.equal(data.error, 'Asset not approved');
      } finally {
        fs.writeFileSync(scratchManifestPath, rawManifest, 'utf8');
        const future = new Date(Date.now() + 4000);
        fs.utimesSync(scratchManifestPath, future, future);
      }
    });

    it('1.4 strictly denies non-boolean or falsy approval states with HTTP 403', async () => {
      const rawManifest = fs.readFileSync(scratchManifestPath, 'utf8');
      const manifestObj = JSON.parse(rawManifest);
      const targetAsset = 'scenes/ch1-n3-locked.svg';
      const originalEntry = manifestObj.assets[targetAsset];

      const testValues = [null, undefined, 'true', 1, 0, 'approved', {}];

      try {
        let offset = 2000;
        for (const testVal of testValues) {
          offset += 1000;
          manifestObj.assets[targetAsset] = {
            ...originalEntry,
            approved: testVal
          };
          fs.writeFileSync(scratchManifestPath, JSON.stringify(manifestObj, null, 2), 'utf8');
          const future = new Date(Date.now() + offset);
          fs.utimesSync(scratchManifestPath, future, future);

          const res = await fetch(`${testUrl}/assets/${targetAsset}`);
          assert.equal(res.status, 403, `Expected 403 for approved=${JSON.stringify(testVal)}, got ${res.status}`);
          const data = await res.json();
          assert.equal(data.ok, false);
          assert.equal(data.error, 'Asset not approved');
        }
      } finally {
        fs.writeFileSync(scratchManifestPath, rawManifest, 'utf8');
        const future = new Date(Date.now() + 20000);
        fs.utimesSync(scratchManifestPath, future, future);
      }
    });

    it('1.5 blocks directory listing attempts on asset directories with HTTP 403', async () => {
      const dirs = ['/assets/', '/assets/scenes/', '/assets/avatars/'];
      for (const d of dirs) {
        const res = await fetch(`${testUrl}${d}`);
        assert.equal(res.status, 403, `Expected 403 for directory listing ${d}, got ${res.status}`);
        const data = await res.json();
        assert.equal(data.ok, false);
      }
    });

    it('1.6 defends against malicious path traversal attacks', async () => {
      const traversalAttacks = [
        '/assets/../package.json',
        '/assets/%2e%2e/package.json',
        '/assets/..%2fpackage.json',
        '/assets/%2e%2e%2fpackage.json',
        '/assets/%252e%252e/package.json',
        '/assets/scenes/../../package.json',
        '/assets/scenes/%2e%2e%2f%2e%2e%2fpackage.json',
        '/assets/scenes/..%2f..%2fpackage.json',
        '/assets/..%5c..%5cpackage.json',
        '/assets/%00package.json',
        '/assets/%2e%2e%2fserver/index.js',
        '/assets/%2e%2e%2f%2e%2e%2f.env',
        '/assets/scenes/../../server/index.js'
      ];

      for (const attack of traversalAttacks) {
        const res = await fetch(`${testUrl}${attack}`);
        assert.ok(
          [400, 403, 404].includes(res.status),
          `Expected 400/403/404 for traversal ${attack}, got ${res.status}`
        );
        const text = await res.text();
        // Crucial security invariant: never leak package.json or server code
        assert.ok(!text.includes('"name": "castle-of-theorems"'), `Traversal leaked package.json for ${attack}`);
        assert.ok(!text.includes('serveStaticFile'), `Traversal leaked server/index.js for ${attack}`);
      }
    });

    it('1.7 safely handles corrupted manifest.json syntax with HTTP 403 without crashing server', async () => {
      const rawManifest = fs.readFileSync(scratchManifestPath, 'utf8');

      try {
        fs.writeFileSync(scratchManifestPath, 'CORRUPTED_NOT_VALID_JSON{{{', 'utf8');
        const future = new Date(Date.now() + 25000);
        fs.utimesSync(scratchManifestPath, future, future);

        const res = await fetch(`${testUrl}/assets/scenes/ch1-n1-locked.svg`);
        assert.equal(res.status, 403, `Expected 403 for corrupted manifest, got ${res.status}`);
        const data = await res.json();
        assert.equal(data.ok, false);
        assert.equal(data.error, 'Asset validation failed');

        // Confirm server remains live and responsive
        const pingRes = await fetch(`${testUrl}/`);
        assert.equal(pingRes.status, 200);
      } finally {
        fs.writeFileSync(scratchManifestPath, rawManifest, 'utf8');
        const future = new Date(Date.now() + 30000);
        fs.utimesSync(scratchManifestPath, future, future);
      }
    });

    it('1.8 safely handles missing manifest.json with HTTP 403 without crashing server', async () => {
      const rawManifest = fs.readFileSync(scratchManifestPath, 'utf8');

      try {
        fs.unlinkSync(scratchManifestPath);

        const res = await fetch(`${testUrl}/assets/scenes/ch1-n1-locked.svg`);
        assert.equal(res.status, 403, `Expected 403 for missing manifest, got ${res.status}`);
        const data = await res.json();
        assert.equal(data.ok, false);
        assert.equal(data.error, 'Asset manifest missing');

        // Confirm server remains live and responsive
        const pingRes = await fetch(`${testUrl}/`);
        assert.equal(pingRes.status, 200);
      } finally {
        fs.writeFileSync(scratchManifestPath, rawManifest, 'utf8');
        const future = new Date(Date.now() + 35000);
        fs.utimesSync(scratchManifestPath, future, future);
      }
    });

    it('1.9 manifest SHA-256 integrity: verifies canonical assets and detects file tampering', () => {
      const rawManifest = fs.readFileSync(CANONICAL_MANIFEST_PATH, 'utf8');
      const manifest = JSON.parse(rawManifest);

      // Verify all canonical assets match their SHA-256 on disk
      for (const [relPath, entry] of Object.entries(manifest.assets)) {
        const fullPath = path.join(CANONICAL_ASSETS_DIR, relPath);
        assert.ok(fs.existsSync(fullPath), `Asset file missing on disk: ${fullPath}`);
        const buf = fs.readFileSync(fullPath);
        const digest = crypto.createHash('sha256').update(buf).digest('hex');
        assert.equal(digest, entry.sha256, `SHA-256 digest mismatch for ${relPath}`);
      }

      // Test tampering detection
      const testAssetRel = 'scenes/ch1-n4-locked.svg';
      const testAssetPath = path.join(scratchAssetsDir, testAssetRel);
      const originalContent = fs.readFileSync(testAssetPath, 'utf8');

      try {
        // Tamper with the asset by appending a comment
        const tamperedContent = originalContent + '<!-- tampered byte -->';
        fs.writeFileSync(testAssetPath, tamperedContent, 'utf8');

        const currentHash = crypto.createHash('sha256').update(fs.readFileSync(testAssetPath)).digest('hex');
        const registeredHash = manifest.assets[testAssetRel].sha256;

        assert.notEqual(
          currentHash,
          registeredHash,
          'Tampered asset hash must not match manifest SHA-256'
        );
      } finally {
        fs.writeFileSync(testAssetPath, originalContent, 'utf8');
      }
    });
  });

  // =========================================================================
  // SUITE 2: MULTI-PART PROGRESSION THROUGH DARK VAULT (PARTS a -> b -> c)
  // =========================================================================
  describe('2. Multi-Part Progression & Golden Seal Modal Invariant (Dark Vault)', () => {
    const darkVault = getEncounterById('ch1-n2-dark-vault');

    it('2.1 completes Part a -> partSealed: true, hasMoreParts: true, sealed: false, codex: null', () => {
      let session = createSession(darkVault);
      assert.equal(session.state, 'arrive');
      assert.equal(session.currentPartId, 'a');

      // Arrive -> Conjecture
      let res = transition(session, { type: 'arrive' }, darkVault);
      session = res.session;
      assert.equal(session.state, 'conjecture');

      // Skip conjecture -> Understand
      res = transition(session, { type: 'skip_conjecture' }, darkVault);
      session = res.session;
      assert.equal(session.state, 'understand');

      // Say -> Plan (allTrue classification)
      res = transition(session, { type: 'say', text: 'I understand', classification: { unknown: true, data: true, condition: true } }, darkVault);
      session = res.session;
      assert.equal(session.state, 'plan');

      // Card -> Carry Out (workspace unlocked)
      res = transition(session, { type: 'card', cardId: 'worst-case' }, darkVault);
      session = res.session;
      assert.equal(session.state, 'carry_out');

      // Submit correct answer 4 for part a
      res = transition(session, { type: 'submit', value: 4 }, darkVault);
      session = res.session;
      assert.equal(session.state, 'sealed');

      // Check clientSafeView invariants
      const view = getClientSafeView(session, darkVault);
      assert.equal(view.partSealed, true, 'partSealed must be true on intermediate part completion');
      assert.equal(view.hasMoreParts, true, 'hasMoreParts must be true when parts remain');
      assert.equal(view.sealed, false, 'sealed must NOT be true on intermediate part completion');
      assert.equal(view.nextPartAvailable, true, 'nextPartAvailable must be true');
      assert.equal(view.codex, null, 'codex must NOT be disclosed before final node seal');
      assert.equal(view.scene.state, 'locked', 'scene must remain locked until encounter completion');
    });

    it('2.2 dispatches next_part -> Part b arrives (state: arrive, currentPartId: b)', () => {
      let session = createSession(darkVault);
      // Fast forward part a solve
      session = transition(session, { type: 'arrive' }, darkVault).session;
      session = transition(session, { type: 'skip_conjecture' }, darkVault).session;
      session = transition(session, { type: 'say', classification: { unknown: true, data: true, condition: true } }, darkVault).session;
      session = transition(session, { type: 'card', cardId: 'worst-case' }, darkVault).session;
      session = transition(session, { type: 'submit', value: 4 }, darkVault).session;

      assert.equal(session.state, 'sealed');
      assert.equal(session.currentPartId, 'a');

      // Dispatch next_part
      const res = transition(session, { type: 'next_part' }, darkVault);
      session = res.session;

      assert.equal(session.state, 'arrive', 'next_part must transition to arrive');
      assert.equal(session.currentPartId, 'b', 'currentPartId must advance to b');

      const view = getClientSafeView(session, darkVault);
      assert.equal(view.currentPartId, 'b');
      assert.equal(view.state, 'arrive');
      assert.equal(view.partSealed, false);
      assert.equal(view.hasMoreParts, true);
    });

    it('2.3 dispatches arrive on Part b -> transitions to Part b conjecture', () => {
      let session = createSession(darkVault);
      // Fast forward to Part b arrive
      session = transition(session, { type: 'arrive' }, darkVault).session;
      session = transition(session, { type: 'skip_conjecture' }, darkVault).session;
      session = transition(session, { type: 'say', classification: { unknown: true, data: true, condition: true } }, darkVault).session;
      session = transition(session, { type: 'card', cardId: 'worst-case' }, darkVault).session;
      session = transition(session, { type: 'submit', value: 4 }, darkVault).session;
      session = transition(session, { type: 'next_part' }, darkVault).session;

      assert.equal(session.state, 'arrive');
      assert.equal(session.currentPartId, 'b');

      // Dispatch arrive
      const res = transition(session, { type: 'arrive' }, darkVault);
      session = res.session;

      assert.equal(session.state, 'conjecture', 'arrive must transition to conjecture');
      assert.equal(session.currentPartId, 'b');

      const view = getClientSafeView(session, darkVault);
      assert.equal(view.state, 'conjecture');
      assert.equal(view.currentPartId, 'b');
      assert.equal(view.conjecturesRemaining, 2);
    });

    it('2.4 complete Part b -> next_part -> Part c -> solve -> Look Back -> Sealed', () => {
      let session = createSession(darkVault);
      // Part a
      session = transition(session, { type: 'arrive' }, darkVault).session;
      session = transition(session, { type: 'skip_conjecture' }, darkVault).session;
      session = transition(session, { type: 'say', classification: { unknown: true, data: true, condition: true } }, darkVault).session;
      session = transition(session, { type: 'card', cardId: 'worst-case' }, darkVault).session;
      session = transition(session, { type: 'submit', value: 4 }, darkVault).session;
      assert.equal(session.state, 'sealed');

      // Next part -> Part b
      session = transition(session, { type: 'next_part' }, darkVault).session;
      assert.equal(session.state, 'arrive');
      assert.equal(session.currentPartId, 'b');

      // Part b arrive -> conjecture -> skip -> understand -> plan -> carry_out
      session = transition(session, { type: 'arrive' }, darkVault).session;
      assert.equal(session.state, 'conjecture');
      session = transition(session, { type: 'skip_conjecture' }, darkVault).session;
      session = transition(session, { type: 'say', classification: { unknown: true, data: true, condition: true } }, darkVault).session;
      session = transition(session, { type: 'card', cardId: 'worst-case' }, darkVault).session;
      assert.equal(session.state, 'carry_out');

      // Part b solve (answer is 10)
      session = transition(session, { type: 'submit', value: 10 }, darkVault).session;
      assert.equal(session.state, 'sealed');

      let viewB = getClientSafeView(session, darkVault);
      assert.equal(viewB.partSealed, true);
      assert.equal(viewB.hasMoreParts, true);
      assert.equal(viewB.sealed, false);
      assert.equal(viewB.codex, null);

      // Next part -> Part c
      session = transition(session, { type: 'next_part' }, darkVault).session;
      assert.equal(session.state, 'arrive');
      assert.equal(session.currentPartId, 'c');

      // Part c arrive -> conjecture -> skip -> understand -> plan -> carry_out
      session = transition(session, { type: 'arrive' }, darkVault).session;
      session = transition(session, { type: 'skip_conjecture' }, darkVault).session;
      session = transition(session, { type: 'say', classification: { unknown: true, data: true, condition: true } }, darkVault).session;
      session = transition(session, { type: 'card', cardId: 'worst-case' }, darkVault).session;
      assert.equal(session.state, 'carry_out');

      // Part c solve (answer is 13)
      session = transition(session, { type: 'submit', value: 13 }, darkVault).session;
      // Because part c is the LAST part, submit transitions directly to look_back!
      assert.equal(session.state, 'look_back', 'Final part submit must transition to look_back');

      let viewC = getClientSafeView(session, darkVault);
      assert.equal(viewC.state, 'look_back');
      assert.equal(viewC.hasMoreParts, false);
      assert.equal(viewC.partSealed, false);
      assert.equal(viewC.sealed, false);
      assert.ok(Array.isArray(viewC.lookBackOptions) && viewC.lookBackOptions.length === 3);

      // Complete Look Back check (perturb question: 4 colours -> 5 grabs)
      session = transition(session, { type: 'lookback', kind: 'perturb', value: 5 }, darkVault).session;
      assert.equal(session.state, 'sealed', 'Correct Look Back answer must transition to sealed');

      // Final encounter seal check
      let finalView = getClientSafeView(session, darkVault);
      assert.equal(finalView.sealed, true, 'Encounter must be sealed');
      assert.equal(finalView.partSealed, false);
      assert.equal(finalView.hasMoreParts, false);
      assert.ok(finalView.codex, 'Codex must be revealed upon encounter seal');
      assert.equal(finalView.codex.childName, 'The Goblin Rule');
      assert.equal(finalView.scene.state, 'unlocked', 'Scene state must be unlocked');
      assert.equal(finalView.sceneAsset, 'ch1-n2-unlocked');
    });

    it('2.5 full HTTP API verification of Dark Vault multi-part session lifecycle', async () => {
      // 1. Start Session via POST /api/session
      const startRes = await fetch(`${testUrl}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: 'ch1-n2-dark-vault' })
      });
      assert.equal(startRes.status, 200);
      const startData = await startRes.json();
      assert.equal(startData.ok, true);
      const sessionId = startData.sessionId;
      assert.ok(sessionId);
      assert.equal(startData.state, 'arrive');

      const act = async (action) => {
        const res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action)
        });
        assert.equal(res.status, 200, `Action ${action.type} failed with status ${res.status}`);
        return res.json();
      };

      // Part a flow
      let r = await act({ type: 'arrive' });
      assert.equal(r.state, 'conjecture');

      r = await act({ type: 'skip_conjecture' });
      assert.equal(r.state, 'understand');

      r = await act({ type: 'say', text: 'tell me', classification: { unknown: true, data: true, condition: true } });
      assert.equal(r.state, 'plan');

      r = await act({ type: 'card', cardId: 'worst-case' });
      assert.equal(r.state, 'carry_out');

      r = await act({ type: 'submit', value: 4 });
      assert.equal(r.state, 'sealed');
      assert.equal(r.view.partSealed, true);
      assert.equal(r.view.hasMoreParts, true);
      assert.equal(r.view.sealed, false);
      assert.equal(r.view.codex, null);

      // Transition to Part b
      r = await act({ type: 'next_part' });
      assert.equal(r.state, 'arrive');
      assert.equal(r.view.currentPartId, 'b');

      r = await act({ type: 'arrive' });
      assert.equal(r.state, 'conjecture');

      r = await act({ type: 'skip_conjecture' });
      r = await act({ type: 'say', classification: { unknown: true, data: true, condition: true } });
      r = await act({ type: 'card', cardId: 'worst-case' });
      r = await act({ type: 'submit', value: 10 });
      assert.equal(r.state, 'sealed');
      assert.equal(r.view.partSealed, true);
      assert.equal(r.view.hasMoreParts, true);
      assert.equal(r.view.sealed, false);

      // Transition to Part c
      r = await act({ type: 'next_part' });
      assert.equal(r.state, 'arrive');
      assert.equal(r.view.currentPartId, 'c');

      r = await act({ type: 'arrive' });
      r = await act({ type: 'skip_conjecture' });
      r = await act({ type: 'say', classification: { unknown: true, data: true, condition: true } });
      r = await act({ type: 'card', cardId: 'worst-case' });
      r = await act({ type: 'submit', value: 13 });
      assert.equal(r.state, 'look_back');
      assert.equal(r.view.hasMoreParts, false);

      // Look Back solve
      r = await act({ type: 'lookback', kind: 'perturb', value: 5 });
      assert.equal(r.state, 'sealed');
      assert.equal(r.view.sealed, true);
      assert.equal(r.view.hasMoreParts, false);
      assert.equal(r.view.codex.childName, 'The Goblin Rule');
    });

    it('2.6 verifies client UI DOM contracts (part-complete-panel vs golden-seal-overlay)', () => {
      const html = fs.readFileSync(path.join(CANONICAL_CLIENT_DIR, 'index.html'), 'utf8');
      const appJs = fs.readFileSync(path.join(CANONICAL_CLIENT_DIR, 'app.js'), 'utf8');

      // Verify DOM elements exist in HTML
      assert.match(html, /id="part-complete-panel"/, 'index.html must have #part-complete-panel');
      assert.match(html, /id="btn-next-part"/, 'index.html must have #btn-next-part');
      assert.match(html, /id="golden-seal-overlay"/, 'index.html must have #golden-seal-overlay');
      assert.match(html, /id="btn-seal-continue"/, 'index.html must have #btn-seal-continue');

      // Verify app.js wires #btn-next-part to dispatch next_part
      assert.match(appJs, /handleAction\(\s*\{\s*type:\s*'next_part'\s*\}\s*\)/, 'app.js must dispatch next_part');

      // Verify app.js strictly guards Golden Seal modal with !view.hasMoreParts
      assert.match(
        appJs,
        /view\.sealed\s*&&\s*!view\.hasMoreParts/,
        'app.js must strictly guard Golden Seal modal invocation with !view.hasMoreParts'
      );

      // Verify app.js shows part-complete-panel only on view.partSealed && view.hasMoreParts
      assert.match(
        appJs,
        /view\.partSealed\s*&&\s*view\.hasMoreParts/,
        'app.js must show part-complete-panel only when partSealed and hasMoreParts are both true'
      );
    });
  });
});
