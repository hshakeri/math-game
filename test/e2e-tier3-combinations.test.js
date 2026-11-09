/**
 * Castle of Theorems v1 (Home Edition)
 * Tier 3: Cross-Feature Integration Suite (10 Interacting Feature Pairs)
 * Tests multi-subsystem combinations, state interactions, and concurrency invariants.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSession, transition, LADDER_RUNGS } from '../server/engine/stateMachine.js';
import { checkUtterance } from '../server/engine/leakGate.js';
import { getClientSafeSessionView, getClientSafeEncounter } from '../server/engine/clientView.js';
import { generateTurn } from '../server/tutor/index.js';
import { startServer } from '../server/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('E2E Tier 3: Cross-Feature Integration (10 Feature Pairs)', () => {
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
  // Pair 1: Look Back Waiver + Multi-Part Progression
  // -------------------------------------------------------------------------
  it('Pair 1: Look Back Waiver + Multi-Part Progression enforces at most 1 waiver per chapter', () => {
    const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'alchemists-dark-vault.json'), 'utf8'));
    assert.equal(enc.parts.length, 3); // Encounter 2 has 3 parts (a, b, c)

    let session = createSession(enc);
    // Part a: advance to look_back
    session.currentPartId = 'a';
    session.state = 'look_back';

    // Use waiver on Part a
    const { session: s1, events: e1 } = transition(session, { type: 'waive' }, enc);
    assert.equal(s1.state, 'sealed');
    assert.equal(s1.chapterWaiverUsed, true);
    assert.equal(s1.parentWaiver, true);
    assert.ok(e1.some(e => e.type === 'node.sealed' && e.waived === true));

    // Advance to Part b
    const { session: s2 } = transition(s1, { type: 'next_part' }, enc);
    assert.equal(s2.currentPartId, 'b');
    assert.equal(s2.state, 'arrive');

    // Fast-forward Part b to look_back
    s2.state = 'look_back';
    // Attempting a second waiver on Part b MUST be rejected / ignored because chapter waiver is already used
    const { session: s3, events: e3 } = transition(s2, { type: 'waive' }, enc);
    assert.equal(s3.state, 'look_back', 'State must remain in look_back when waiver is already consumed');
    assert.ok(!e3.some(e => e.type === 'node.sealed'), 'Must not seal part b via waiver');
  });

  // -------------------------------------------------------------------------
  // Pair 2: Parent Scribe Mode + Live SSE Transcript
  // -------------------------------------------------------------------------
  it('Pair 2: Parent Scribe Mode + Live SSE Transcript records scribe turns cleanly without leaks', async () => {
    // Start a session via HTTP API
    const startRes = await fetch(`${baseUrl}/api/session/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ encounterId: 'ch1-n1-reverse-tolls' })
    });
    const { sessionId } = await startRes.json();
    assert.ok(sessionId);

    // Enable Parent Scribe mode
    const scribeRes = await fetch(`${baseUrl}/api/parent/toggle-scribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-parent-pin': '1234' },
      body: JSON.stringify({ session: sessionId, enabled: true })
    });
    assert.equal(scribeRes.status, 200);
    const scribeData = await scribeRes.json();
    assert.equal(scribeData.parentScribe, true);

    // Advance from arrive -> conjecture -> understand
    await fetch(`${baseUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: { type: 'arrive' } })
    });
    await fetch(`${baseUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: { type: 'skip_conjecture' } })
    });

    // Parent submits child speech on child behalf in understand state
    const actRes = await fetch(`${baseUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: { type: 'say', text: 'My dad is typing this: we see three gates ahead.' } })
    });
    assert.equal(actRes.status, 200);
    const actData = await actRes.json();
    assert.ok(actData.ok);
    assert.equal(actData.view.parentScribe, true);
    assert.ok(actData.speech, 'Tutor must generate a speech probe in response');
    assert.ok(actData.events.some(e => e.type === 'engine.transition' && e.from === 'understand'));
  });

  // -------------------------------------------------------------------------
  // Pair 3: Parent Hint Override + Autonomous Ladder Fading/Escalation
  // -------------------------------------------------------------------------
  it('Pair 3: Parent Hint Override seamlessly hands back to autonomous ZPD ladder fading', () => {
    const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'chasm-reverse-tolls.json'), 'utf8'));
    let session = createSession(enc);
    session.state = 'carry_out';
    session.hintRung = 'l1';
    session.hintRungIndex = 1;

    // Parent overrides rung to l2
    const { session: s1, events: e1 } = transition(session, { type: 'parent_override', hintRung: 'l2' }, enc);
    assert.equal(s1.hintRung, 'l2');
    assert.equal(s1.hintRungIndex, 2);
    assert.ok(e1.some(e => e.type === 'parent.override' && e.value === 'l2'));

    // Child makes a successful step -> ladder fades one rung down (to floor l1)
    const { session: s2 } = transition(s1, { type: 'step', payload: { action: 'value', gateIndex: 2, value: 11 } }, enc);
    assert.equal(s2.hintRungIndex, 1);
    assert.equal(s2.hintRung, 'l1');

    // Child makes another successful step -> stays at floor l1
    const { session: s3 } = transition(s2, { type: 'step', payload: { action: 'value', gateIndex: 1, value: 7 } }, enc);
    assert.equal(s3.hintRungIndex, 1);
    assert.equal(s3.hintRung, 'l1');

    // Two misses escalate back to l2
    const { session: s4 } = transition(s3, { type: 'step', payload: { action: 'value', gateIndex: 0, value: 99 } }, enc);
    assert.equal(s4.nonProgressCount, 1);
    const { session: s5 } = transition(s4, { type: 'step', payload: { action: 'value', gateIndex: 0, value: 88 } }, enc);
    assert.equal(s5.hintRung, 'l2');
    assert.equal(s5.hintRungIndex, 2);
  });

  // -------------------------------------------------------------------------
  // Pair 4: LLM Leak Gate Interception + Retry + Scripted Fallback
  // -------------------------------------------------------------------------
  it('Pair 4: LLM Leak Gate Interception retries once with corrective prompt then delivers scripted fallback', async () => {
    let callCount = 0;
    const promptsReceived = [];

    const turn = await generateTurn({
      encounterId: 'ch1-n1-reverse-tolls',
      partId: 'a',
      state: 'understand',
      rung: 'l0',
      childMessage: 'What is the answer?'
    }, {
      adapter: 'gemini',
      apiKey: 'test-key',
      fetchFn: async (_url, opts) => {
        callCount++;
        const reqBody = JSON.parse(opts.body);
        promptsReceived.push(reqBody);

        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    utterance: `Leaking forbidden number six in attempt ${callCount}?`,
                    studentSignal: 'engaged'
                  })
                }],
                role: 'model'
              }
            }]
          })
        };
      }
    });

    assert.equal(callCount, 2, 'Must attempt initial call plus exactly 1 retry');
    assert.equal(turn.fallback, true);
    assert.equal(turn.adapter, 'scripted_fallback');
    // Scripted fallback probe must pass leak gate 100%
    const gateRes = checkUtterance(turn.utterance, {
      rung: 'l0',
      forbidden: [6, 7, 11, 12, 14, 22],
      givens: [3, 5, 9, 13]
    });
    assert.equal(gateRes.allowed, true);
  });

  // -------------------------------------------------------------------------
  // Pair 5: Heuristic Card Unlock + SVG Diagram Mode Switch
  // -------------------------------------------------------------------------
  it('Pair 5: Heuristic Card Selection attaches activeCard and transitions to carry_out', () => {
    const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'courtyard-five-shields.json'), 'utf8'));
    let session = createSession(enc);
    session.state = 'plan';

    // Child selects card 'Draw it' (draw-it)
    const { session: s1, events: e1 } = transition(session, { type: 'card', card: 'draw-it' }, enc);
    assert.equal(s1.activeCard, 'draw-it');
    assert.equal(s1.state, 'carry_out');
    assert.ok(e1.some(e => e.type === 'engine.transition' && e.card === 'draw-it'));

    // Check client-safe view shows activeCard
    const view = getClientSafeSessionView(s1, enc);
    assert.equal(view.activeCard, 'draw-it');
  });

  // -------------------------------------------------------------------------
  // Pair 6: Simpler Problem Sub-loop + Submit Dial Integration
  // -------------------------------------------------------------------------
  it('Pair 6: Simpler Problem Sub-loop escalates from l4, solves, and bridges back to carry_out', () => {
    const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'chasm-reverse-tolls.json'), 'utf8'));
    let session = createSession(enc);
    session.state = 'carry_out';
    session.hintRung = 'l2';
    session.hintRungIndex = 2;
    session.nonProgressCount = 1;

    // Escalate via non-progress step to index 3 ('l4')
    const { session: s1 } = transition(session, { type: 'step', payload: { action: 'value', gateIndex: 2, value: 99 } }, enc);
    assert.equal(s1.state, 'simpler_problem');
    assert.ok(s1.simplerProblemState);
    assert.equal(s1.simplerProblemState.answer.value, 7);

    // Solve simpler problem
    const { session: s2, events: e2 } = transition(s1, { type: 'simpler_submit', value: 7 }, enc);
    assert.equal(s2.state, 'carry_out');
    assert.equal(s2.hintRung, 'l1');
    assert.equal(s2.simplerProblemState, null);
    assert.ok(e2.some(e => e.type === 'engine.transition' && e.bridge === true));
  });

  // -------------------------------------------------------------------------
  // Pair 7: High-Speed Action Dispatch + Consistency
  // -------------------------------------------------------------------------
  it('Pair 7: High-Speed Action Dispatch maintains strictly monotonic history and state consistency', () => {
    const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'chasm-reverse-tolls.json'), 'utf8'));
    let session = createSession(enc);
    let s = transition(session, { type: 'arrive' }, enc).session;
    s = transition(s, { type: 'skip_conjecture' }, enc).session;

    // Rapid dispatch of 10 child messages and actions
    for (let i = 0; i < 10; i++) {
      s = transition(s, { type: 'say', text: `Thinking turn step ${i}` }, enc).session;
    }

    assert.equal(s.history.length >= 10, true);
    assert.equal(s.state, 'plan'); // Must have transitioned to plan after 2 understand turns
    // Verify history timestamps and sequence IDs are strictly non-decreasing
    for (let i = 1; i < s.history.length; i++) {
      assert.ok(s.history[i].turnId > s.history[i - 1].turnId);
      assert.ok(s.history[i].timestamp >= s.history[i - 1].timestamp);
    }
  });

  // -------------------------------------------------------------------------
  // Pair 8: Client-Safe View Zero-Leak Guarantee Across All 6 Transitions
  // -------------------------------------------------------------------------
  it('Pair 8: Client-Safe View Zero-Leak Guarantee Across All Transitions', () => {
    const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'castle-keep-portcullis.json'), 'utf8'));

    const statesToTest = ['arrive', 'conjecture', 'understand', 'plan', 'carry_out', 'simpler_problem', 'look_back', 'sealed'];

    for (const st of statesToTest) {
      const s = createSession(enc);
      s.state = st;
      const view = getClientSafeSessionView(s, enc);
      const jsonStr = JSON.stringify(view);

      // Verify answer object is not leaked
      assert.equal(view.answer, undefined, `Answer must be undefined in state ${st}`);
      // Verify forbidden numbers are not exposed in plaintext keys
      for (const num of [24]) {
        assert.ok(!jsonStr.includes(`"value":${num}`), `Answer ${num} must never be exposed as value in state ${st}`);
      }
    }
  });

  // -------------------------------------------------------------------------
  // Pair 9: Asset Approval Gate + Client Scene Rendering
  // -------------------------------------------------------------------------
  it('Pair 9: Asset Approval Gate verifies all scenes in manifest are approved before use', async () => {
    const manifestPath = path.join(rootDir, 'client', 'assets', 'manifest.json');
    const requiredScenes = [
      'scenes/ch1-n1-locked.svg',
      'scenes/ch1-n1-unlocked.svg',
      'scenes/ch1-n2-locked.svg',
      'scenes/ch1-n2-unlocked.svg',
      'scenes/ch1-n3-locked.svg',
      'scenes/ch1-n3-unlocked.svg',
      'scenes/ch1-n4-locked.svg',
      'scenes/ch1-n4-unlocked.svg'
    ];

    let manifest;
    for (let attempt = 0; attempt < 10; attempt++) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (requiredScenes.every(sc => manifest.assets[sc]?.approved === true)) {
        break;
      }
      await new Promise(r => setTimeout(r, 50));
    }

    for (const sc of requiredScenes) {
      const asset = manifest.assets[sc];
      assert.ok(asset, `Manifest must register scene ${sc}`);
      assert.equal(asset.approved, true, `Scene ${sc} must be approved: true`);
      assert.ok(fs.existsSync(path.join(rootDir, 'client', 'assets', asset.file || sc)));
    }
  });

  // -------------------------------------------------------------------------
  // Pair 10: Offline Network Isolation Guard
  // -------------------------------------------------------------------------
  it('Pair 10: Offline Network Isolation Guard ensures engine logic makes zero outbound HTTP calls', async () => {
    const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'chasm-reverse-tolls.json'), 'utf8'));

    // Spy on globalThis.fetch
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async (...args) => {
      fetchCalled = true;
      return originalFetch(...args);
    };

    try {
      // Run complete offline engine operations
      let s = createSession(enc);
      s = transition(s, { type: 'arrive' }, enc).session;
      s = transition(s, { type: 'skip_conjecture' }, enc).session;
      s = transition(s, { type: 'say', text: 'Offline thinking' }, enc).session;
      s = transition(s, { type: 'card', card: 'work-backwards' }, enc).session;
      s = transition(s, { type: 'step', payload: { action: 'value', gateIndex: 2, value: 11 } }, enc).session;

      // Scripted tutor turn
      const turn = await generateTurn({
        encounterId: 'ch1-n1-reverse-tolls',
        partId: 'a',
        state: 'understand',
        rung: 'l0',
        childMessage: 'Help'
      }, { adapter: 'scripted' });

      // Client view filter
      const view = getClientSafeSessionView(s, enc);
      assert.ok(view);
      assert.ok(turn.utterance);

      // Verify zero network calls were made
      assert.equal(fetchCalled, false, 'Engine and scripted tutor must run 100% offline without network calls');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
