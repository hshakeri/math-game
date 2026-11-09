/**
 * Castle of Theorems — Milestone M4 Asset Pipeline & Approval Gate Test Suite
 * test/assets.test.js
 *
 * Runs with: node --test
 * Verifies:
 * 1. Procedural generation via tools/assets/generate.py (pure Python 3, code 0).
 * 2. Manifest integrity: version, sha256 checksums, dimensions, approved and placeholder flags.
 * 3. Palette and art style compliance (Guild palette).
 * 4. Server static asset approval gate (200 for approved, 403 for unapproved, 404 for unlisted, 403 for traversal).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { startServer, closeServer } from '../server/index.js';
import { ILLUSTRATIONS, ILLUSTRATION_DIMENSIONS } from '../client/illustrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const CLIENT_DIR = path.resolve(REPO_ROOT, 'client');
const ASSETS_DIR = path.resolve(CLIENT_DIR, 'assets');
const MANIFEST_PATH = path.resolve(ASSETS_DIR, 'manifest.json');
const GENERATE_SCRIPT = path.resolve(REPO_ROOT, 'tools/assets/generate.py');

describe('Milestone M4: Asset Pipeline & Approval Gate', () => {
  let testEnv;
  let testUrl;

  before(async () => {
    testEnv = await startServer(0, '127.0.0.1');
    testUrl = testEnv.url;
  });

  after(async () => {
    if (testEnv && testEnv.server) {
      await closeServer(testEnv.server);
    }
  });

  describe('1. Procedural SVG Generator (generate.py)', () => {
    it('executes cleanly with Python 3 and exits 0', () => {
      const res = spawnSync('python3', [GENERATE_SCRIPT], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
      });
      assert.equal(res.status, 0, `Generator failed with status ${res.status}: ${res.stderr}`);
      assert.match(res.stdout, /Manifest successfully written/);
    });

    it('generates style guide and prompt templates in tools/assets/', () => {
      assert.ok(fs.existsSync(path.join(REPO_ROOT, 'tools/assets/style.md')));
      assert.ok(fs.existsSync(path.join(REPO_ROOT, 'tools/assets/prompts/ch1-n1.md')));
      assert.ok(fs.existsSync(path.join(REPO_ROOT, 'tools/assets/prompts/ch1-n2.md')));
      assert.ok(fs.existsSync(path.join(REPO_ROOT, 'tools/assets/prompts/ch1-n3.md')));
      assert.ok(fs.existsSync(path.join(REPO_ROOT, 'tools/assets/prompts/ch1-n4.md')));
      assert.ok(fs.existsSync(path.join(REPO_ROOT, 'tools/assets/prompts/map-ch1.md')));
      assert.ok(fs.existsSync(path.join(REPO_ROOT, 'tools/assets/prompts/chapter1-card.md')));
      assert.ok(fs.existsSync(path.join(REPO_ROOT, 'tools/assets/prompts/avatars.md')));
    });
  });

  describe('2. Manifest Integrity & Review Checklist', () => {
    it('manifest.json exists and is valid JSON', () => {
      assert.ok(fs.existsSync(MANIFEST_PATH), 'manifest.json must exist');
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      assert.equal(manifest.version, 1);
      assert.ok(typeof manifest.assets === 'object');
    });

    it('all manifest entries correspond to physical files with matching SHA-256 digests', () => {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      const entries = Object.entries(manifest.assets);
      assert.ok(entries.length >= 10, 'Expected at least 10 assets');

      for (const [relPath, entry] of entries) {
        const fullPath = path.join(ASSETS_DIR, relPath);
        assert.ok(fs.existsSync(fullPath), `Asset file missing on disk: ${fullPath}`);

        const fileBuffer = fs.readFileSync(fullPath);
        const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        assert.equal(actualHash, entry.sha256, `SHA-256 digest mismatch for ${relPath}`);

        assert.equal(entry.approved, true, `Asset ${relPath} must be approved: true`);
        const width = entry.dimensions?.width ?? entry.width;
        const height = entry.dimensions?.height ?? entry.height;
        assert.ok(width > 0 && height > 0, `Width and height must be positive for ${relPath}`);

        if (entry.format === 'image/svg+xml') {
          assert.equal(entry.placeholder, true, `Procedural SVG ${relPath} must remain marked as a placeholder`);
          assert.equal(path.extname(relPath), '.svg');
          const svg = fileBuffer.toString('utf8');
          const viewBox = svg.match(/<svg\b[^>]*\bviewBox="0 0 ([\d.]+) ([\d.]+)"/);
          assert.ok(viewBox, `Missing root SVG viewBox for ${relPath}`);
          assert.equal(Number(viewBox[1]), width, `SVG width differs from manifest for ${relPath}`);
          assert.equal(Number(viewBox[2]), height, `SVG height differs from manifest for ${relPath}`);
        } else {
          assert.equal(entry.format, 'image/png', `Unsupported asset format for ${relPath}`);
          assert.equal(path.extname(relPath), '.png');
          assert.equal(entry.placeholder, false, `Selected illustration ${relPath} must not be marked as a placeholder`);
          assert.ok(fileBuffer.length >= 33, `Truncated PNG for ${relPath}`);
          assert.deepEqual(fileBuffer.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
          assert.equal(fileBuffer.toString('ascii', 12, 16), 'IHDR');
          assert.equal(fileBuffer.readUInt32BE(16), width, `PNG width differs from manifest for ${relPath}`);
          assert.equal(fileBuffer.readUInt32BE(20), height, `PNG height differs from manifest for ${relPath}`);
          assert.equal(fileBuffer.length, entry.bytes, `PNG byte count differs from manifest for ${relPath}`);
          assert.ok(entry.source?.file, `Missing selected source for ${relPath}`);
          const source = fs.readFileSync(path.resolve(REPO_ROOT, entry.source.file));
          assert.deepEqual(fileBuffer, source, `Illustration must preserve its selected source bytes: ${relPath}`);
          assert.equal(entry.source.sha256, actualHash, `Selected source hash differs for ${relPath}`);
        }

        // Verify review checklist passes all 5 criteria
        const review = entry.review || entry.reviewChecklist;
        assert.ok(review, `Missing review check for ${relPath}`);
        assert.equal(review.heroOwlMatch, true);
        assert.equal(review.noTextInImage, true);
        assert.equal(review.nothingFrightening, true);
        assert.equal(review.noPuzzleHints, true);
        assert.equal(review.plausibleAnatomy ?? review.anatomyPlausible, true);
      }
    });

    it('contains all 10 Chapter 1 scene assets', () => {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      const expectedScenes = [
        'scenes/ch1-n1-locked.svg',
        'scenes/ch1-n1-unlocked.svg',
        'scenes/ch1-n2-locked.svg',
        'scenes/ch1-n2-unlocked.svg',
        'scenes/ch1-n3-locked.svg',
        'scenes/ch1-n3-unlocked.svg',
        'scenes/ch1-n4-locked.svg',
        'scenes/ch1-n4-unlocked.svg',
        'scenes/map-ch1.svg',
        'scenes/chapter1-card.svg'
      ];
      for (const scene of expectedScenes) {
        assert.ok(manifest.assets[scene], `Manifest must include scene: ${scene}`);
        assert.ok(fs.existsSync(path.join(ASSETS_DIR, scene)), `File must exist: ${scene}`);
      }
    });

    it('contains avatar sheets for Archimedes and Hero variants', () => {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      assert.ok(manifest.assets['avatars/archimedes-sheet.svg'], 'Must include archimedes-sheet.svg');
      assert.ok(manifest.assets['avatars/hero-sheet.svg'], 'Must include hero-sheet.svg');
    });

    it('includes every illustrated still used by the presentation helper with its native dimensions', () => {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      for (const [id, url] of Object.entries(ILLUSTRATIONS)) {
        assert.ok(url.startsWith('/assets/illustrations/'), `Still ${id} must use the local approval gate`);
        const relPath = url.slice('/assets/'.length);
        const entry = manifest.assets[relPath];
        assert.ok(entry, `Presentation still missing from manifest: ${id}`);
        assert.equal(entry.format, 'image/png');
        assert.equal(entry.approved, true);
        assert.deepEqual(entry.dimensions, ILLUSTRATION_DIMENSIONS[id]);
        assert.equal(manifest.byAssetId[entry.id], relPath);
      }
    });

    it('scene SVGs comply with Royal Architect Guild palette and SVG structure', () => {
      const scenePath = path.join(ASSETS_DIR, 'scenes/ch1-n1-locked.svg');
      const content = fs.readFileSync(scenePath, 'utf8');
      assert.match(content, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      assert.match(content, /viewBox="0 0 1920 1080"/);
      // Check Guild palette color presence (e.g., parchment background #f7f1e3 or #d8cca8)
      assert.match(content, /#f7f1e3|#d8cca8/i);
    });
  });

  describe('3. Server Static Asset Approval Gate', () => {
    it('serves manifest.json with 200 OK', async () => {
      const res = await fetch(`${testUrl}/assets/manifest.json`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /json/);
      const data = await res.json();
      assert.equal(data.version, 1);
    });

    it('serves approved scene SVG with 200 OK and image/svg+xml', async () => {
      const res = await fetch(`${testUrl}/assets/scenes/ch1-n1-locked.svg`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /image\/svg\+xml/);
      const text = await res.text();
      assert.match(text, /<svg/);
    });

    it('serves an approved illustrated PNG with its original bytes and image/png type', async () => {
      const relPath = 'illustrations/rivet.png';
      const res = await fetch(`${testUrl}/assets/${relPath}`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /image\/png/);
      assert.deepEqual(Buffer.from(await res.arrayBuffer()), fs.readFileSync(path.join(ASSETS_DIR, relPath)));
    });

    it('returns 404 for unlisted static asset path under /assets/', async () => {
      const res = await fetch(`${testUrl}/assets/scenes/non-existent-ghost.svg`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.ok, false);
      assert.ok(data.error === 'Asset not found' || data.error === 'Not Found', `Expected Not Found error, got ${data.error}`);
    });

    it('blocks directory traversal under /assets/ with 403 Forbidden', async () => {
      const res = await fetch(`${testUrl}/assets/../../package.json`);
      assert.ok(res.status === 403 || res.status === 404, `Expected 403/404, got ${res.status}`);
    });

    it('blocks unapproved SVG and PNG assets with HTTP 403 Forbidden', async () => {
      // Temporarily mark an asset as approved: false in manifest.json
      const rawManifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
      const manifestObj = JSON.parse(rawManifest);
      for (const relPath of ['scenes/ch1-n1-locked.svg', 'illustrations/rivet.png']) {
        const originalEntry = manifestObj.assets[relPath];
        try {
          manifestObj.assets[relPath] = { ...originalEntry, approved: false };
          fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestObj, null, 2));

          const res = await fetch(`${testUrl}/assets/${relPath}`);
          assert.equal(res.status, 403, `Unapproved ${relPath} must be blocked`);
          const data = await res.json();
          assert.equal(data.ok, false);
          assert.equal(data.error, 'Asset not approved');
        } finally {
          manifestObj.assets[relPath] = originalEntry;
          fs.writeFileSync(MANIFEST_PATH, rawManifest);
        }
      }
    });

    it('re-serves asset with 200 OK once approved is restored to true', async () => {
      for (const relPath of ['scenes/ch1-n1-locked.svg', 'illustrations/rivet.png']) {
        const res = await fetch(`${testUrl}/assets/${relPath}`);
        assert.equal(res.status, 200);
        await res.arrayBuffer();
      }
    });
  });
});
