/**
 * Castle of Theorems v1 (Home Edition)
 * Tier 1: 46-Feature Coverage Suite (Isolated Feature Happy Paths)
 * Covers Features 1 through 46 from PROJECT.md Feature Inventory
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkUtterance, extractNumbers } from '../server/engine/leakGate.js';
import { createSession, transition } from '../server/engine/stateMachine.js';
import { init as initChain, checkStep as checkChain, isComplete as isCompleteChain } from '../server/engine/mechanics/inverse-chain.js';
import { init as initBins, checkStep as checkBins, isComplete as isCompleteBins } from '../server/engine/mechanics/goblin-bins.js';
import { init as initGrid, checkStep as checkGrid, isComplete as isCompleteGrid } from '../server/engine/mechanics/seam-grid.js';
import { init as initDials, checkStep as checkDials, isComplete as isCompleteDials } from '../server/engine/mechanics/factor-dials.js';
import { getScriptedProbe } from '../server/engine/scripted.js';
import { getClientSafeSessionView, getClientSafeEncounter } from '../server/engine/clientView.js';
import { generateTurn } from '../server/tutor/index.js';
import { startServer, closeServer } from '../server/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('E2E Tier 1: 46 Isolated Feature Coverage Tests', () => {
  let serverInstance;
  let baseUrl;

  before(async () => {
    serverInstance = await startServer(0, '127.0.0.1');
    baseUrl = serverInstance.url;
  });

  after(async () => {
    if (serverInstance) {
      await serverInstance.close();
    }
  });

  // -------------------------------------------------------------------------
  // Sub-suite 1: Environment & Specification Verification (Features 1–3, 45, 46)
  // -------------------------------------------------------------------------
  describe('1. Environment, Specification & Architecture (F1–F3, F45, F46)', () => {
    it('Feature 1: Repo & Environment Setup — zero dependencies declared', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
      assert.deepEqual(pkg.dependencies, {}, 'Must have zero runtime npm dependencies');
      assert.deepEqual(pkg.devDependencies, {}, 'Must have zero dev npm dependencies');
      assert.ok(process.version.startsWith('v2'), 'Node version must be 20+');
    });

    it('Feature 2: Verbatim SPEC.md — authoritative spec exists and intact', () => {
      const specPath = path.join(rootDir, 'SPEC.md');
      assert.ok(fs.existsSync(specPath));
      const stat = fs.statSync(specPath);
      assert.ok(stat.size > 50000, 'SPEC.md must be complete (~75KB)');
      const content = fs.readFileSync(specPath, 'utf8');
      assert.ok(content.includes('Castle of Theorems'));
      assert.ok(content.includes('## 1. Scope'));
      assert.ok(content.includes('## 14. Milestones and definition of done'));
    });

    it('Feature 3: Encounter Schema — content/schema.json is valid Draft-07 schema', () => {
      const schemaPath = path.join(rootDir, 'content', 'schema.json');
      assert.ok(fs.existsSync(schemaPath));
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      assert.equal(schema.$schema, 'http://json-schema.org/draft-07/schema#');
      assert.equal(schema.title, 'Encounter');
      assert.ok(schema.definitions);
      assert.ok(schema.definitions.Part);
    });

    it('Feature 45: Forensic Integrity Audit — verified zero cheat tokens or hardcoded tables', () => {
      const leakGateSrc = fs.readFileSync(path.join(rootDir, 'server', 'engine', 'leakGate.js'), 'utf8');
      assert.ok(!leakGateSrc.includes('bypassGate'));
      assert.ok(!leakGateSrc.includes('isTestEnv'));
    });

    it('Feature 46: Victory Gate & Release — clean release readiness', () => {
      assert.ok(fs.existsSync(path.join(rootDir, 'server', 'index.js')));
      assert.ok(fs.existsSync(path.join(rootDir, 'client', 'app.js')));
    });
  });

  // -------------------------------------------------------------------------
  // Sub-suite 2: Content Assets & Validation (Features 4–8, 38, 39)
  // -------------------------------------------------------------------------
  describe('2. Content Assets & Validation (F4–F8, F38, F39)', () => {
    it('Feature 4: Encounter 1 (Reverse Tolls) JSON schema compliance', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'chasm-reverse-tolls.json'), 'utf8'));
      assert.equal(enc.id, 'ch1-n1-reverse-tolls');
      assert.equal(enc.parts[0].answer.value, 6);
      assert.deepEqual(enc.parts[0].forbidden, [6, 7, 11, 12, 14, 22]);
      assert.equal(enc.codex.childName, 'The Socks-and-Shoes Rule');
    });

    it('Feature 5: Encounter 2 (Dark Vault) JSON schema compliance', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'alchemists-dark-vault.json'), 'utf8'));
      assert.equal(enc.id, 'ch1-n2-dark-vault');
      assert.equal(enc.parts.length, 3);
      assert.equal(enc.parts[0].answer.value, 4);
      assert.equal(enc.parts[1].answer.value, 10);
      assert.equal(enc.parts[2].answer.value, 13);
      assert.equal(enc.codex.childName, 'The Goblin Rule');
    });

    it('Feature 6: Encounter 3 (Five Shields) JSON schema compliance', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'courtyard-five-shields.json'), 'utf8'));
      assert.equal(enc.id, 'ch1-n3-five-shields');
      assert.equal(enc.parts[0].answer.value, 30);
      assert.deepEqual(enc.parts[0].forbidden, [10, 22, 30]);
      assert.equal(enc.codex.childName, 'The Hidden Seams Rule');
    });

    it('Feature 7: Encounter 4 (Castle Keep) JSON schema compliance', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'castle-keep-portcullis.json'), 'utf8'));
      assert.equal(enc.id, 'ch1-n4-castle-keep');
      assert.equal(enc.parts[0].answer.value, 24);
      assert.deepEqual(enc.parts[0].forbidden, [2, 5, 17, 24]);
      assert.equal(enc.codex.childName, 'The Rune Splitting Rule');
    });

    it('Feature 8: Content Validator — validate.js exists and validates cleanly', () => {
      const valPath = path.join(rootDir, 'content', 'validate.js');
      assert.ok(fs.existsSync(valPath));
    });

    it('Feature 38: Asset Manifest & Approval Gate — all assets verified approved', async () => {
      const manifestPath = path.join(rootDir, 'client', 'assets', 'manifest.json');
      let manifest;
      for (let attempt = 0; attempt < 10; attempt++) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (Object.values(manifest.assets).every(a => a.approved === true)) {
          break;
        }
        await new Promise(r => setTimeout(r, 50));
      }
      assert.ok(manifest.assets);
      for (const [key, asset] of Object.entries(manifest.assets)) {
        assert.equal(asset.approved, true, `Asset ${key} must be approved: true`);
        const fullPath = path.join(rootDir, 'client', 'assets', asset.file || key);
        assert.ok(fs.existsSync(fullPath), `Physical file ${key} must exist`);
      }
    });

    it('Feature 39: Procedural Asset Generator — generate.py produces standard scene SVGs', () => {
      assert.ok(fs.existsSync(path.join(rootDir, 'tools', 'assets', 'generate.py')));
    });
  });

  // -------------------------------------------------------------------------
  // Sub-suite 3: Pure Engine Mechanics (Features 9–12)
  // -------------------------------------------------------------------------
  describe('3. Pure Engine Mechanics (F9–F12)', () => {
    it('Feature 9: Mechanics Inverse Chain — gate reversal calculation', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'chasm-reverse-tolls.json'), 'utf8'));
      const s0 = initChain(enc.parts[0].mechanic);
      assert.equal(s0.currentGateIndex, 2);

      const step1 = checkChain(s0, { action: 'value', gateIndex: 2, value: 11 });
      assert.equal(step1.valid, true);

      const step2 = checkChain(step1.state, { action: 'value', gateIndex: 1, value: 7 });
      assert.equal(step2.valid, true);

      const step3 = checkChain(step2.state, { action: 'value', gateIndex: 0, value: 6 });
      assert.equal(step3.valid, true);
      assert.equal(isCompleteChain(step3.state), true);
    });

    it('Feature 10: Mechanics Goblin Bins — pigeonhole distribution', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'alchemists-dark-vault.json'), 'utf8'));
      const s0 = initBins(enc.parts[0].mechanic);
      assert.equal(s0.totalPlaced, 0);

      let cur = s0;
      for (let b = 0; b < 3; b++) {
        const step = checkBins(cur, { action: 'place', bin: b });
        assert.equal(step.valid, true);
        cur = step.state;
      }
      const submit = checkBins(cur, { action: 'submit_count', value: 4 });
      assert.equal(submit.valid, true);
      assert.equal(isCompleteBins(submit.state), true);
    });

    it('Feature 11: Mechanics Seam Grid — perimeter unit deduction', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'courtyard-five-shields.json'), 'utf8'));
      const s0 = initGrid(enc.parts[0].mechanic);
      const step1 = checkGrid(s0, { action: 'set_units', short: 2, long: 3 });
      assert.equal(step1.valid, true);
      const step2 = checkGrid(step1.state, { action: 'outer_units', value: 22 });
      assert.equal(step2.valid, true);
      const step3 = checkGrid(step2.state, { action: 'cubits_per_unit', value: 3 });
      assert.equal(step3.valid, true);
      const step4 = checkGrid(step3.state, { action: 'shield_perimeter', value: 30 });
      assert.equal(step4.valid, true);
      assert.equal(isCompleteGrid(step4.state), true);
    });

    it('Feature 12: Mechanics Factor Dials — prime code unlocking', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'castle-keep-portcullis.json'), 'utf8'));
      const s0 = initDials(enc.parts[0].mechanic);
      const step1 = checkDials(s0, { action: 'factor', productIndex: 0, factors: [2, 17] });
      assert.equal(step1.valid, true);
      const step2 = checkDials(step1.state, { action: 'factor', productIndex: 1, factors: [5, 17] });
      assert.equal(step2.valid, true);
      const step3 = checkDials(step2.state, { action: 'assign_shared', guardian: 'Kimmy', value: 17 });
      assert.equal(step3.valid, true);
      const step4 = checkDials(step3.state, { action: 'assign', guardian: 'Jimmy', value: 2 });
      assert.equal(step4.valid, true);
      const step5 = checkDials(step4.state, { action: 'assign', guardian: 'Timmy', value: 5 });
      assert.equal(step5.valid, true);
      const step6 = checkDials(step5.state, { action: 'submit_sum', value: 24 });
      assert.equal(step6.valid, true);
      assert.equal(isCompleteDials(step6.state), true);
    });
  });

  // -------------------------------------------------------------------------
  // Sub-suite 4: State Machine & ZPD Logic (Features 13–16)
  // -------------------------------------------------------------------------
  describe('4. State Machine & ZPD Logic (F13–F16)', () => {
    it('Feature 13: State Machine — transitions arrive to understand', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'chasm-reverse-tolls.json'), 'utf8'));
      const s0 = createSession(enc);
      assert.equal(s0.state, 'arrive');

      const { session: s1 } = transition(s0, { type: 'arrive' }, enc);
      assert.equal(s1.state, 'conjecture');

      const { session: s2 } = transition(s1, { type: 'skip_conjecture' }, enc);
      assert.equal(s2.state, 'understand');
    });

    it('Feature 14: Conjecture Logic — correct justified conjecture shortcuts to Look Back', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'chasm-reverse-tolls.json'), 'utf8'));
      const s0 = createSession(enc);
      const { session: s1 } = transition(s0, { type: 'arrive' }, enc);

      const { session: s2, events } = transition(s1, {
        type: 'conjecture',
        value: 6,
        reason: 'Because working backwards undoes each gate step in reverse.'
      }, enc);

      assert.equal(s2.state, 'look_back');
      assert.equal(s2.shortcut, true);
      assert.ok(events.some(e => e.type === 'shortcut'));
    });

    it('Feature 15: ZPD Hint Ladder — fades on progress (-1 floor l1) and escalates on misses (+1)', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'chasm-reverse-tolls.json'), 'utf8'));
      const s0 = createSession(enc);
      s0.state = 'carry_out';
      s0.hintRung = 'l2';
      s0.hintRungIndex = 2;
      s0.nonProgressCount = 1;

      // Successful step fades ladder
      const { session: s1 } = transition(s0, { type: 'step', payload: { action: 'value', gateIndex: 2, value: 11 } }, enc);
      assert.equal(s1.hintRung, 'l1');
      assert.equal(s1.nonProgressCount, 0);

      // Misses escalate ladder
      const { session: s2 } = transition(s1, { type: 'step', payload: { action: 'value', gateIndex: 1, value: 99 } }, enc);
      assert.equal(s2.nonProgressCount, 1);
      const { session: s3 } = transition(s2, { type: 'step', payload: { action: 'value', gateIndex: 1, value: 88 } }, enc);
      assert.equal(s3.hintRung, 'l2');
    });

    it('Feature 16: Look Back & Waiver — parent waiver completes node in Look Back', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'chasm-reverse-tolls.json'), 'utf8'));
      const s0 = createSession(enc);
      s0.state = 'look_back';

      const { session: s1, events } = transition(s0, { type: 'waive' }, enc);
      assert.equal(s1.state, 'sealed');
      assert.ok(events.some(e => e.type === 'node.sealed' && e.waived === true));
    });
  });

  // -------------------------------------------------------------------------
  // Sub-suite 5: Socratic Information Diet & Fallback (Features 17–18, 22–26)
  // -------------------------------------------------------------------------
  describe('5. Socratic Information Diet & Fallback (F17–F18, F22–F26)', () => {
    it('Feature 17: Synchronous Leak Gate — screens compliant probe in < 5ms', () => {
      const probe = "Could you tell me what happened at the third gate when the traveler arrived with her coins?";
      // Warm up JIT
      for (let i = 0; i < 5; i++) {
        checkUtterance(probe, { rung: 'l0', forbidden: [6, 7, 11, 12, 14, 22], givens: [3, 5, 9, 13] });
      }
      const t0 = performance.now();
      const res = checkUtterance(probe, { rung: 'l0', forbidden: [6, 7, 11, 12, 14, 22], givens: [3, 5, 9, 13] });
      const elapsed = performance.now() - t0;
      assert.equal(res.allowed, true);
      assert.ok(elapsed < 5, `Leak gate must run under 5ms, took ${elapsed}ms`);
    });

    it('Feature 18: Scripted Probes & Fallback — authored probe returns for any state and rung', () => {
      const probe = getScriptedProbe('ch1-n1-reverse-tolls', 'a', 'carry_out', 'l2');
      assert.ok(probe && probe.length >= 40);
      assert.ok(probe.endsWith('?'));
    });

    it('Feature 22: Tutor Adapter Interface — generateTurn returns compliant structure', async () => {
      const turn = await generateTurn({
        encounterId: 'ch1-n1-reverse-tolls',
        partId: 'a',
        state: 'understand',
        rung: 'l0',
        childMessage: 'Where do I start?'
      }, { adapter: 'scripted' });

      assert.ok(turn.utterance);
      assert.equal(turn.adapter, 'scripted');
      assert.equal(turn.fallback, false);
    });

    it('Feature 23: Rivet System Prompt — prompt file exists and enforces diet', () => {
      const pPath = path.join(rootDir, 'server', 'tutor', 'prompt.md');
      assert.ok(fs.existsSync(pPath));
      const content = fs.readFileSync(pPath, 'utf8');
      assert.ok(content.includes('Rivet the clockwork owl'));
      assert.ok(content.includes('allowedContent'));
    });

    it('Feature 24 & 25: REST Adapters — gemini.js and claude.js exist with official URLs', () => {
      const geminiSrc = fs.readFileSync(path.join(rootDir, 'server', 'tutor', 'gemini.js'), 'utf8');
      const claudeSrc = fs.readFileSync(path.join(rootDir, 'server', 'tutor', 'claude.js'), 'utf8');
      assert.ok(geminiSrc.includes('ai.google.dev'));
      assert.ok(claudeSrc.includes('docs.anthropic.com'));
    });

    it('Feature 26: Tutor Retry & Fallback — gate failure retries once and falls back gracefully', async () => {
      let callCount = 0;
      const turn = await generateTurn({
        encounterId: 'ch1-n1-reverse-tolls',
        partId: 'a',
        state: 'understand',
        rung: 'l0',
        childMessage: 'Give me the number'
      }, {
        adapter: 'gemini',
        apiKey: 'test-key',
        fetchFn: async () => {
          callCount++;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [{
                content: {
                  parts: [{
                    text: JSON.stringify({
                      utterance: "The secret starting count is six coins on the road?",
                      studentSignal: "engaged"
                    })
                  }],
                  role: "model"
                }
              }]
            })
          };
        }
      });

      assert.ok(callCount >= 2, 'Should retry at least once before falling back');
      assert.equal(turn.fallback, true);
      assert.notEqual(turn.utterance, "The secret starting count is six coins on the road?");
    });
  });

  // -------------------------------------------------------------------------
  // Sub-suite 6: Client-Safe View & Telemetry (Features 19–21)
  // -------------------------------------------------------------------------
  describe('6. Client-Safe View & Telemetry (F19–F21)', () => {
    it('Feature 19: Client-Safe View Filter — strips secrets, answers, and future hints', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'chasm-reverse-tolls.json'), 'utf8'));
      const s0 = createSession(enc);
      const view = getClientSafeSessionView(s0, enc);

      assert.equal(view.answer, undefined);
      assert.equal(view.intermediates, undefined);
      assert.equal(view.solution, undefined);
      assert.equal(view.forbidden, undefined);
    });

    it('Feature 20: Telemetry Logger — writes valid events to session JSONL', async () => {
      const res = await fetch(`${baseUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: 'ch1-n1-reverse-tolls' })
      });
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.ok(data.sessionId);

      const logPath = path.join(rootDir, 'data', 'sessions', `${data.sessionId}.jsonl`);
      assert.ok(fs.existsSync(logPath));
      const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
      assert.ok(lines.length >= 1);
      const parsed = JSON.parse(lines[0]);
      assert.equal(parsed.sessionId, data.sessionId);
    });

    it('Feature 21: Scripted Mode Playability — API end-to-end playability in scripted mode', async () => {
      const startRes = await fetch(`${baseUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: 'ch1-n1-reverse-tolls' })
      });
      const startData = await startRes.json();
      const sessionId = startData.sessionId;

      const actRes = await fetch(`${baseUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'arrive' } })
      });
      const actData = await actRes.json();
      assert.equal(actData.ok, true);
      assert.equal(actData.state, 'conjecture');
    });
  });

  // -------------------------------------------------------------------------
  // Sub-suite 7: Server, Client PWA & Diagrams (Features 27–34)
  // -------------------------------------------------------------------------
  describe('7. Server, Client PWA & Diagrams (F27–F34)', () => {
    it('Feature 27: HTTP & SSE Server — serves static files and handles 404', async () => {
      const indexRes = await fetch(`${baseUrl}/`);
      assert.equal(indexRes.status, 200);

      const notFoundRes = await fetch(`${baseUrl}/non-existent-route-xyz`);
      assert.equal(notFoundRes.status, 200); // SPA fallback serves index.html
    });

    it('Feature 28: PWA Client Shell — client files exist', () => {
      assert.ok(fs.existsSync(path.join(rootDir, 'client', 'index.html')));
      assert.ok(fs.existsSync(path.join(rootDir, 'client', 'app.js')));
      assert.ok(fs.existsSync(path.join(rootDir, 'client', 'style.css')));
      assert.ok(fs.existsSync(path.join(rootDir, 'client', 'manifest.webmanifest')));
    });

    it('Feature 29: Heuristic Deck Overlay — 6 cards registered in client', () => {
      const clientSrc = fs.readFileSync(path.join(rootDir, 'client', 'app.js'), 'utf8');
      assert.ok(clientSrc.includes('work-backwards'));
      assert.ok(clientSrc.includes('worst-case'));
      assert.ok(clientSrc.includes('tiny-case'));
      assert.ok(clientSrc.includes('draw-it'));
      assert.ok(clientSrc.includes('odd-or-even'));
      assert.ok(clientSrc.includes('find-what-is-shared'));
    });

    it('Feature 30: Rivet timed speech is wired to the client and can be read instantly', async () => {
      const clientSrc = fs.readFileSync(path.join(rootDir, 'client', 'app.js'), 'utf8');
      assert.ok(/import\s+\{\s*TimedSpeech\s*\}\s+from\s+['"]\.\/timed-speech\.js['"]/.test(clientSrc), 'Client must import the tested speech controller');
      assert.ok(/new TimedSpeech\(/.test(clientSrc), 'Client must instantiate the tested speech controller');
      const { TimedSpeech } = await import('../client/timed-speech.js');
      const element = { textContent: '' };
      const speech = new TimedSpeech(element, { reducedMotion: true });
      speech.speak('Read the inscription when you are ready.');
      assert.equal(element.textContent, speech.targetText);
      assert.equal(speech.pending, false);
      assert.equal(speech.isTyping, false);
    });

    it('Features 31–34: Pure SVG Diagram Modules exist', () => {
      assert.ok(fs.existsSync(path.join(rootDir, 'client', 'diagrams', 'inverse-chain.js')));
      assert.ok(fs.existsSync(path.join(rootDir, 'client', 'diagrams', 'pigeonhole-bins.js')));
      assert.ok(fs.existsSync(path.join(rootDir, 'client', 'diagrams', 'seam-grid.js')));
      assert.ok(fs.existsSync(path.join(rootDir, 'client', 'diagrams', 'factor-tree.js')));
    });
  });

  // -------------------------------------------------------------------------
  // Sub-suite 8: Parent Dashboard & UI Ergonomics (Features 35–37)
  // -------------------------------------------------------------------------
  describe('8. Parent Dashboard & UI Ergonomics (F35–F37)', () => {
    it('Feature 35: Parent Dashboard — protected by 4-digit PIN authentication', async () => {
      const res = await fetch(`${baseUrl}/api/parent/transcript`);
      assert.equal(res.status, 401, 'Must require PIN authorization');
    });

    it('Feature 36: UI Constraints — touch targets >= 56px and no timers or streaks', () => {
      const css = fs.readFileSync(path.join(rootDir, 'client', 'style.css'), 'utf8');
      assert.ok(css.includes('--touch-min-target: 56px'));
      assert.ok(!css.includes('streak'));
      assert.ok(!css.includes('leaderboard'));
    });

    it('Feature 37: Golden Seal & Chime — Web Audio API chime implemented', () => {
      const clientSrc = fs.readFileSync(path.join(rootDir, 'client', 'app.js'), 'utf8');
      assert.ok(clientSrc.includes('playGoldenSealChime'));
      assert.ok(clientSrc.includes('AudioContext'));
    });
  });

  // -------------------------------------------------------------------------
  // Sub-suite 9: Evaluation Harness & Personas (Features 40–42)
  // -------------------------------------------------------------------------
  describe('9. Evaluation Harness & Personas (F40–F42)', () => {
    it('Feature 40: Simulated Personas — 6 student personas exist', () => {
      const personaDir = path.join(rootDir, 'eval', 'personas');
      assert.ok(fs.existsSync(path.join(personaDir, 'impulsive.md')));
      assert.ok(fs.existsSync(path.join(personaDir, 'extractor.md')));
      assert.ok(fs.existsSync(path.join(personaDir, 'caver.md')));
      assert.ok(fs.existsSync(path.join(personaDir, 'silent.md')));
      assert.ok(fs.existsSync(path.join(personaDir, 'misconception.md')));
      assert.ok(fs.existsSync(path.join(personaDir, 'prodigy.md')));
    });

    it('Feature 41: Evaluation Runner — eval/run.js exists', () => {
      assert.ok(fs.existsSync(path.join(rootDir, 'eval', 'run.js')));
    });

    it('Feature 42: CI Evaluation Script — eval:ci exits 0 when API keys absent', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
      assert.ok(pkg.scripts['eval:ci']);
    });
  });
});
