/**
 * Castle of Theorems — Milestone M3 Adversarial Challenge Suite
 * test/waiver-stream-stress.test.js
 *
 * EMPIRICAL ADVERSARIAL STRESS:
 * 1. Look Back Waiver Security & Stage Guarding:
 *    - Rejection of invalid/wrong PIN (401 Unauthorized)
 *    - Strict rejection during arrive, understand, plan, carry_out (HTTP 400)
 *    - Success only during look_back (HTTP 200, sets sealed: true, waived: true)
 *    - Rejection on second waiver attempt within same session (HTTP 400 "already used")
 * 2. Multi-Session Chapter Waiver Invariant:
 *    - SPEC §4 & §12: Max 1 waiver per chapter across all sessions.
 *    - Session 1 (Chapter 1) waives in look_back -> succeeds.
 *    - Session 2 (Chapter 1) reaches look_back -> waiver MUST be rejected with HTTP 400.
 * 3. Parent SSE Stream Discovery:
 *    - Multiple parent listeners connected before session start.
 *    - All listeners receive session.start upon session initiation.
 *    - All listeners receive live actions and updates without manual re-registration.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { startServer, closeServer, resetServerState, sessionStore, chapterWaiversUsed } from '../server/index.js';
import { readSessionEvents } from '../server/engine/telemetry.js';

const PARENT_PIN = '1234';

describe('Adversarial Stress: Look Back Waiver & Parent SSE Discovery', () => {
  let testEnv;
  let testUrl;

  before(async () => {
    testEnv = await startServer(0, '127.0.0.1', { parentPin: PARENT_PIN });
    testUrl = testEnv.url;
  });

  beforeEach(() => {
    resetServerState?.();
    sessionStore?.clear();
    chapterWaiversUsed?.clear();
  });

  after(async () => {
    if (testEnv?.server) {
      await closeServer(testEnv.server);
    }
  });

  // Helper to advance session to specific phases
  async function setupSessionToPhase(encounterId, targetPhase) {
    const startRes = await fetch(`${testUrl}/api/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId })
    });
    const { sessionId } = await startRes.json();

    if (targetPhase === 'arrive') {
      return sessionId;
    }

    // arrive -> conjecture
    await fetch(`${testUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'arrive' } })
    });

    if (targetPhase === 'conjecture') {
      return sessionId;
    }

    if (targetPhase === 'look_back') {
      // Justified correct conjecture shortcuts directly to look_back (3+ words)
      const conjVal = encounterId.includes('reverse-tolls') ? 6 :
                      encounterId.includes('dark-vault') ? 4 :
                      encounterId.includes('five-shields') ? 30 : 24;
      const res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: {
            type: 'conjecture',
            stem: 'think',
            value: conjVal,
            reason: 'I am completely certain of this answer'
          }
        })
      });
      const data = await res.json();
      assert.equal(data.state, 'look_back', `Expected state look_back, got ${data.state}`);
      return sessionId;
    }

    // skip_conjecture -> understand
    await fetch(`${testUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'skip_conjecture' } })
    });

    if (targetPhase === 'understand') {
      return sessionId;
    }

    // 2 probes in understand -> plan
    await fetch(`${testUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'say', text: 'probe answer one' } })
    });
    await fetch(`${testUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'say', text: 'probe answer two' } })
    });

    if (targetPhase === 'plan') {
      return sessionId;
    }

    if (targetPhase === 'carry_out') {
      const cardId = encounterId.includes('reverse-tolls') ? 'work-backwards' :
                     encounterId.includes('dark-vault') ? 'worst-case' :
                     encounterId.includes('five-shields') ? 'find-shared' : 'find-shared';
      await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'card', cardId } })
      });
      return sessionId;
    }

    throw new Error(`Unsupported targetPhase: ${targetPhase}`);
  }

  // ===========================================================================
  // 1. Look Back Waiver Security & PIN Authentication
  // ===========================================================================
  describe('1. Look Back Waiver Security & Authentication', () => {
    it('rejects waiver calls with missing, empty, or wrong PIN with HTTP 401', async () => {
      const sessionId = await setupSessionToPhase('ch1-n1-reverse-tolls', 'look_back');
      const badPins = ['', 'wrong', '0000', '1235', '9999', null, undefined];

      for (const pin of badPins) {
        const payload = { sessionId };
        if (pin !== undefined) payload.pin = pin;

        const res = await fetch(`${testUrl}/api/parent/waiver`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        assert.equal(
          res.status,
          401,
          `Expected 401 for PIN "${pin}", got HTTP ${res.status}`
        );
        const data = await res.json();
        assert.equal(data.ok, false);
      }
    });
  });

  // ===========================================================================
  // 2. Look Back Waiver Stage Guarding (Forbidden outside look_back)
  // ===========================================================================
  describe('2. Look Back Waiver Stage Guarding', () => {
    it('strictly returns HTTP 400 when waiver is called during arrive stage', async () => {
      const sessionId = await setupSessionToPhase('ch1-n1-reverse-tolls', 'arrive');
      const res = await fetch(`${testUrl}/api/parent/waiver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, pin: PARENT_PIN })
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.ok, false);
      assert.match(data.error, /Look Back/i);
    });

    it('strictly returns HTTP 400 when waiver is called during understand stage', async () => {
      const sessionId = await setupSessionToPhase('ch1-n1-reverse-tolls', 'understand');
      const res = await fetch(`${testUrl}/api/parent/waiver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, pin: PARENT_PIN })
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.ok, false);
      assert.match(data.error, /Look Back/i);
    });

    it('strictly returns HTTP 400 when waiver is called during plan stage', async () => {
      const sessionId = await setupSessionToPhase('ch1-n1-reverse-tolls', 'plan');
      const res = await fetch(`${testUrl}/api/parent/waiver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, pin: PARENT_PIN })
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.ok, false);
      assert.match(data.error, /Look Back/i);
    });

    it('strictly returns HTTP 400 when waiver is called during carry_out stage', async () => {
      const sessionId = await setupSessionToPhase('ch1-n1-reverse-tolls', 'carry_out');
      const res = await fetch(`${testUrl}/api/parent/waiver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, pin: PARENT_PIN })
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.ok, false);
      assert.match(data.error, /Look Back/i);
    });
  });

  // ===========================================================================
  // 3. Single-Session Waiver Lifecycle (Success on first, 400 on duplicate)
  // ===========================================================================
  describe('3. Single-Session Waiver Lifecycle', () => {
    it('executes waiver successfully in look_back and seals node', async () => {
      const sessionId = await setupSessionToPhase('ch1-n1-reverse-tolls', 'look_back');

      // First waiver call -> MUST SUCCEED
      const res1 = await fetch(`${testUrl}/api/parent/waiver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, pin: PARENT_PIN })
      });
      assert.equal(res1.status, 200);
      const data1 = await res1.json();
      assert.equal(data1.ok, true);
      assert.equal(data1.waived, true);
      assert.equal(data1.state, 'sealed');
      assert.equal(data1.sealed, true);

      // Verify session view state in database/memory is sealed
      const stateRes = await fetch(`${testUrl}/api/session/${sessionId}/state`);
      const stateData = await stateRes.json();
      assert.equal(stateData.state, 'sealed');
      assert.equal(stateData.view.sealed, true);

      // Second waiver call on same session -> MUST FAIL WITH 400
      const res2 = await fetch(`${testUrl}/api/parent/waiver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, pin: PARENT_PIN })
      });
      assert.equal(res2.status, 400);
      const data2 = await res2.json();
      assert.equal(data2.ok, false);
      assert.match(data2.error, /(already used|Look Back)/i);
    });
  });

  // ===========================================================================
  // 4. Multi-Session Chapter Waiver Invariant (Max 1 waiver per chapter)
  // ===========================================================================
  describe('4. Multi-Session Chapter Waiver Invariant', () => {
    it('enforces that a waiver used in session 1 of chapter 1 blocks waiver in session 2 of chapter 1', async () => {
      // Start Session 1: Chasm of Reverse Tolls (Chapter 1)
      const session1Id = await setupSessionToPhase('ch1-n1-reverse-tolls', 'look_back');

      // Parent waives session 1
      const waiveRes1 = await fetch(`${testUrl}/api/parent/waiver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session1Id, pin: PARENT_PIN })
      });
      assert.equal(waiveRes1.status, 200, 'Session 1 waiver should succeed');
      const waiveData1 = await waiveRes1.json();
      assert.equal(waiveData1.waived, true);
      assert.equal(waiveData1.sealed, true);

      // Start Session 2: Alchemist Dark Vault (Also Chapter 1)
      const session2Id = await setupSessionToPhase('ch1-n2-dark-vault', 'look_back');

      // Parent attempts to waive session 2 in the same chapter
      // SPEC §4 & §12: Max 1 waiver per chapter!
      const waiveRes2 = await fetch(`${testUrl}/api/parent/waiver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session2Id, pin: PARENT_PIN })
      });

      // MUST FAIL WITH HTTP 400 "already used this chapter"
      assert.equal(
        waiveRes2.status,
        400,
        `Expected HTTP 400 because chapter waiver was already used in session 1, got ${waiveRes2.status}`
      );
      const waiveData2 = await waiveRes2.json();
      assert.equal(waiveData2.ok, false);
      assert.match(waiveData2.error, /already used/i);

      // Session 2 state must remain unsealed in look_back
      const s2StateRes = await fetch(`${testUrl}/api/session/${session2Id}/state`);
      const s2StateData = await s2StateRes.json();
      assert.equal(s2StateData.state, 'look_back');
      assert.equal(s2StateData.view.sealed, false);
    });
  });

  // ===========================================================================
  // 5. Parent SSE Stream Discovery (Multiple Pre-connected Listeners)
  // ===========================================================================
  describe('5. Parent SSE Stream Discovery', () => {
    it('delivers session.start and subsequent live actions to multiple parent listeners connected before session start', async () => {
      const listenerCount = 3;
      const listenerBuffers = Array.from({ length: listenerCount }, () => '');
      const reqs = [];

      // Connect 3 parent dashboard SSE streams with no sessionId
      for (let i = 0; i < listenerCount; i++) {
        const req = http.get(
          `${testUrl}/api/parent/transcript?pin=${PARENT_PIN}`,
          res => {
            assert.equal(res.statusCode, 200);
            assert.equal(res.headers['content-type'], 'text/event-stream; charset=utf-8');
            res.on('data', chunk => {
              listenerBuffers[i] += chunk.toString();
            });
          }
        );
        reqs.push(req);
      }

      // Allow connections to establish
      await new Promise(r => setTimeout(r, 100));

      // Verify each received connected event
      for (let i = 0; i < listenerCount; i++) {
        assert.match(listenerBuffers[i], /event: connected/);
      }

      // Now start a child session
      const startRes = await fetch(`${testUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: 'ch1-n3-five-shields' })
      });
      assert.equal(startRes.status, 200);
      const { sessionId } = await startRes.json();

      // Allow event propagation
      await new Promise(r => setTimeout(r, 100));

      // Verify ALL listeners received session.start event with the new sessionId
      for (let i = 0; i < listenerCount; i++) {
        assert.match(
          listenerBuffers[i],
          /event: session\.start/,
          `Listener ${i} failed to receive session.start event`
        );
        assert.ok(
          listenerBuffers[i].includes(sessionId),
          `Listener ${i} buffer did not include sessionId ${sessionId}`
        );
      }

      // Child performs action 'arrive'
      await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'arrive' } })
      });

      // Allow event propagation
      await new Promise(r => setTimeout(r, 100));

      // Verify ALL listeners received update event
      for (let i = 0; i < listenerCount; i++) {
        assert.match(
          listenerBuffers[i],
          /event: update/,
          `Listener ${i} failed to receive action update event`
        );
        reqs[i].destroy();
      }
    });
  });

  // ===========================================================================
  // 6. Gameplay Action Dispatch & Telemetry Event Robustness
  // ===========================================================================
  describe('6. Gameplay Action Dispatch & Telemetry Event Robustness', () => {
    it('handles valid mechanic step in carry_out without HTTP 500 telemetry crash', async () => {
      const sessionId = await setupSessionToPhase('ch1-n1-reverse-tolls', 'carry_out');

      // Valid reverse-tolls step: undo gate 2
      const stepRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: {
            type: 'step',
            payload: { action: 'order', gateIndex: 2, order: ['add', 'div'] }
          }
        })
      });

      assert.equal(
        stepRes.status,
        200,
        `Expected HTTP 200 on valid mechanic step, got ${stepRes.status}`
      );
      const events = readSessionEvents(sessionId);
      assert.ok(events.some(e => e.type === 'step.success'), 'Telemetry must record step.success');
    });

    it('handles short conjecture (< 3 words) without HTTP 500 telemetry crash', async () => {
      const startRes = await fetch(`${testUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: 'ch1-n1-reverse-tolls' })
      });
      const { sessionId } = await startRes.json();

      await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'arrive' } })
      });

      // Submit correct value 6 but with short justification ("start six" = 2 words)
      const conjRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: {
            type: 'conjecture',
            stem: 'think',
            value: 6,
            reason: 'start six'
          }
        })
      });

      assert.equal(
        conjRes.status,
        200,
        `Expected HTTP 200 on short conjecture (skeptic prompt), got ${conjRes.status}`
      );
      const events = readSessionEvents(sessionId);
      assert.ok(events.some(e => e.type === 'conjecture.skeptic_prompt'), 'Telemetry must record conjecture.skeptic_prompt');
    });

    it('handles child dialogue and ladder escalation in carry_out without HTTP 500 telemetry crash', async () => {
      const sessionId = await setupSessionToPhase('ch1-n1-reverse-tolls', 'carry_out');

      // Child dialogue emits child.say
      const sayRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'say', text: 'I am planning my next move' } })
      });
      assert.equal(sayRes.status, 200);

      // Stuck action emits ladder.escalate
      const stuckRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'stuck' } })
      });
      assert.equal(stuckRes.status, 200);

      const events = readSessionEvents(sessionId);
      assert.ok(events.some(e => e.type === 'child.say'), 'Telemetry must record child.say');
      assert.ok(events.some(e => e.type === 'ladder.escalate'), 'Telemetry must record ladder.escalate');
    });

    it('handles incorrect look back reflection without HTTP 500 telemetry crash', async () => {
      const sessionId = await setupSessionToPhase('ch1-n1-reverse-tolls', 'look_back');
      const lbRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'lookback', kind: 'verify', value: 999 } })
      });
      assert.equal(lbRes.status, 200);
      const events = readSessionEvents(sessionId);
      assert.ok(events.some(e => e.type === 'lookback.retry'), 'Telemetry must record lookback.retry');
    });
  });
});

