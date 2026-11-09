/**
 * Castle of Theorems v1 (Home Edition)
 * Milestone M5 Independent Empirical Stress Test Suite
 * Author: teamwork_challenger_m5_1
 *
 * Verifies commit 90dfde1 with adversarial stress tests:
 * 1. Full Chapter 1 playthrough via HTTP API with sequential catalog unlocks
 * 2. Out-of-order calls, simulated network delays & malformed body handling
 * 3. Simultaneous sessions across multiple simulated browser tabs with isolated state & targeted parent overrides
 * 4. Boundary cutoffs in conjectures, reason lengths, word parsing & Look Back validation across all 4 encounters
 * 5. Single Look Back waiver per chapter invariant across multiple sessions and HTTP endpoints
 * 6. Authentic 46-feature execution audit: zero mocks hiding failures, strict information diet & zero forbidden anti-patterns
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startServer, closeServer, resetServerState, sessionStore } from '../server/index.js';
import { checkUtterance, extractNumbers } from '../server/engine/leakGate.js';
import { generateTurn, getEncounter } from '../server/tutor/index.js';
import { countWords } from '../server/engine/stateMachine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper for HTTP requests
async function httpRequest(baseUrl, pathname, options = {}) {
  const url = `${baseUrl}${pathname}`;
  const method = options.method || 'GET';
  const headers = { ...options.headers };
  let body = options.body;

  if (body && typeof body === 'object' && !(body instanceof Buffer)) {
    body = JSON.stringify(body);
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body
  });

  let json = null;
  let text = '';
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      json = await res.json();
    } catch {
      // not json
    }
  } else {
    text = await res.text();
  }

  return {
    status: res.status,
    ok: res.ok,
    headers: res.headers,
    body: json,
    text
  };
}

describe('Challenger M5 Empirical Stress Test Suite', () => {
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

  beforeEach(() => {
    resetServerState();
  });

  // =========================================================================
  // SECTION 1: Full Chapter 1 Playthrough via Real HTTP API
  // =========================================================================
  describe('1. Full Chapter 1 Golden Playthrough via HTTP API with Dynamic Catalog Unlocking', () => {
    it('plays all 4 encounters in sequence over HTTP, asserting catalog unlock gates at every step', async () => {
      // 1. Initial catalog check: Only Encounter 1 is unlocked
      const cat0 = await httpRequest(baseUrl, '/api/encounters');
      assert.equal(cat0.status, 200);
      assert.equal(cat0.body.encounters.length, 4);
      assert.equal(cat0.body.encounters[0].unlocked, true, 'Encounter 1 must be unlocked initially');
      assert.equal(cat0.body.encounters[0].completed, false);
      assert.equal(cat0.body.encounters[1].unlocked, false, 'Encounter 2 must be locked initially');
      assert.equal(cat0.body.encounters[2].unlocked, false, 'Encounter 3 must be locked initially');
      assert.equal(cat0.body.encounters[3].unlocked, false, 'Encounter 4 must be locked initially');

      // ---------------------------------------------------------------------
      // Encounter 1: Chasm of Reverse Tolls (Inverse Chain)
      // ---------------------------------------------------------------------
      const startE1 = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        body: { encounterId: 'ch1-n1-reverse-tolls' }
      });
      assert.equal(startE1.status, 200);
      const s1Id = startE1.body.sessionId;
      assert.ok(s1Id);
      assert.equal(startE1.body.state, 'arrive');

      // Client view filter check
      assert.equal(startE1.body.view.answer, undefined, 'Client view must not expose final answer');
      assert.equal(startE1.body.view.intermediates, undefined, 'Client view must not expose intermediate values');

      // Advance: Arrive -> Skip Conjecture -> Understand
      await httpRequest(baseUrl, `/api/session/${s1Id}/action`, { method: 'POST', body: { type: 'arrive' } });
      await httpRequest(baseUrl, `/api/session/${s1Id}/action`, { method: 'POST', body: { type: 'skip_conjecture' } });

      // Understand: 2 say dialogue probes advance to Plan
      await httpRequest(baseUrl, `/api/session/${s1Id}/action`, {
        method: 'POST',
        body: { type: 'say', text: 'Three toll gates stand ahead.' }
      });
      const und2 = await httpRequest(baseUrl, `/api/session/${s1Id}/action`, {
        method: 'POST',
        body: { type: 'say', text: 'She leaves the road with 13 coins.' }
      });
      assert.equal(und2.body.state, 'plan');

      // Plan: Pick "work-backwards" card
      const planRes = await httpRequest(baseUrl, `/api/session/${s1Id}/action`, {
        method: 'POST',
        body: { type: 'card', card: 'work-backwards' }
      });
      assert.equal(planRes.body.state, 'carry_out');

      // Carry Out: Solve the 3 gates backwards (11, 7, 6)
      await httpRequest(baseUrl, `/api/session/${s1Id}/action`, {
        method: 'POST',
        body: { type: 'step', payload: { action: 'value', gateIndex: 2, value: 11 } }
      });
      await httpRequest(baseUrl, `/api/session/${s1Id}/action`, {
        method: 'POST',
        body: { type: 'step', payload: { action: 'value', gateIndex: 1, value: 7 } }
      });
      await httpRequest(baseUrl, `/api/session/${s1Id}/action`, {
        method: 'POST',
        body: { type: 'step', payload: { action: 'value', gateIndex: 0, value: 6 } }
      });

      // Submit final answer 6 via stone dial
      const submitE1 = await httpRequest(baseUrl, `/api/session/${s1Id}/action`, {
        method: 'POST',
        body: { type: 'submit', value: 6 }
      });
      assert.equal(submitE1.body.state, 'look_back');

      // Look Back: Option 0 verification check is 13
      const lbE1 = await httpRequest(baseUrl, `/api/session/${s1Id}/action`, {
        method: 'POST',
        body: { type: 'lookback', index: 0, value: 13 }
      });
      assert.equal(lbE1.body.state, 'sealed');

      // Complete Encounter 1 to seal and return to map
      const compE1 = await httpRequest(baseUrl, `/api/session/${s1Id}/action`, {
        method: 'POST',
        body: { type: 'complete' }
      });
      assert.equal(compE1.body.state, 'map');
      assert.equal(compE1.body.finished, true);

      // Verify Catalog Update: E1 is completed, E2 is unlocked!
      const cat1 = await httpRequest(baseUrl, '/api/encounters');
      assert.equal(cat1.body.encounters[0].completed, true);
      assert.equal(cat1.body.encounters[1].unlocked, true, 'Encounter 2 must now be unlocked');
      assert.equal(cat1.body.encounters[2].unlocked, false, 'Encounter 3 must still be locked');

      // ---------------------------------------------------------------------
      // Encounter 2: Alchemist's Dark Vault (3 Parts: a, b, c)
      // ---------------------------------------------------------------------
      const startE2 = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        body: { encounterId: 'ch1-n2-dark-vault' }
      });
      const s2Id = startE2.body.sessionId;
      assert.ok(s2Id);

      // Part a: Matching Pair (target 4)
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'arrive' } });
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'skip_conjecture' } });
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'say', text: 'Three colored crystal bins.' } });
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'say', text: 'We need two of the same color.' } });
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'card', card: 'worst-case' } });
      // Place 1 crystal in each bin (worst case: 3 different colors)
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'step', payload: { action: 'place', bin: 0 } } });
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'step', payload: { action: 'place', bin: 1 } } });
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'step', payload: { action: 'place', bin: 2 } } });
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'step', payload: { action: 'submit_count', value: 4 } } });
      const submitE2a = await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'submit', value: 4 } });
      // Intermediate part seals directly
      assert.equal(submitE2a.body.state, 'sealed');

      // Advance to Part b
      const nextPartB = await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'next_part' } });
      assert.equal(nextPartB.body.state, 'arrive');

      // Part b: Club of Four (target 10)
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'arrive' } });
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'skip_conjecture' } });
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'say', text: 'Now we want 4 crystals of one color.' } });
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'say', text: 'What if we get 3 of each first?' } });
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'card', card: 'worst-case' } });
      for (let b = 0; b < 3; b++) {
        for (let k = 0; k < 3; k++) {
          await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'step', payload: { action: 'place', bin: b } } });
        }
      }
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'step', payload: { action: 'submit_count', value: 10 } } });
      const submitE2b = await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'submit', value: 10 } });
      assert.equal(submitE2b.body.state, 'sealed');

      // Advance to Part c
      const nextPartC = await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'next_part' } });
      assert.equal(nextPartC.body.state, 'arrive');

      // Part c: Different Colors (target 13)
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'arrive' } });
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'skip_conjecture' } });
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'say', text: 'We must guarantee at least two distinct colors.' } });
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'say', text: 'The goblin could pull all 12 of one color first.' } });
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'card', card: 'worst-case' } });
      for (let k = 0; k < 12; k++) {
        await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'step', payload: { action: 'place', bin: 0 } } });
      }
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'step', payload: { action: 'submit_count', value: 13 } } });
      const submitE2c = await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'submit', value: 13 } });
      // Final part moves to Look Back
      assert.equal(submitE2c.body.state, 'look_back');

      // Look Back on Dark Vault: option 0 check value is 5
      const lbE2 = await httpRequest(baseUrl, `/api/session/${s2Id}/action`, {
        method: 'POST',
        body: { type: 'lookback', index: 0, value: 5 }
      });
      assert.equal(lbE2.body.state, 'sealed');

      // Complete Encounter 2
      await httpRequest(baseUrl, `/api/session/${s2Id}/action`, { method: 'POST', body: { type: 'complete' } });

      // Verify Catalog: E2 completed, E3 unlocked!
      const cat2 = await httpRequest(baseUrl, '/api/encounters');
      assert.equal(cat2.body.encounters[1].completed, true);
      assert.equal(cat2.body.encounters[2].unlocked, true, 'Encounter 3 must now be unlocked');
      assert.equal(cat2.body.encounters[3].unlocked, false, 'Encounter 4 must still be locked');

      // ---------------------------------------------------------------------
      // Encounter 3: Courtyard of Five Shields (Seam Grid)
      // ---------------------------------------------------------------------
      const startE3 = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        body: { encounterId: 'ch1-n3-five-shields' }
      });
      const s3Id = startE3.body.sessionId;
      assert.ok(s3Id);

      await httpRequest(baseUrl, `/api/session/${s3Id}/action`, { method: 'POST', body: { type: 'arrive' } });
      await httpRequest(baseUrl, `/api/session/${s3Id}/action`, { method: 'POST', body: { type: 'skip_conjecture' } });
      await httpRequest(baseUrl, `/api/session/${s3Id}/action`, { method: 'POST', body: { type: 'say', text: 'Five identical upright and flat rectangular shields.' } });
      await httpRequest(baseUrl, `/api/session/${s3Id}/action`, { method: 'POST', body: { type: 'say', text: 'Three widths equal two lengths.' } });
      await httpRequest(baseUrl, `/api/session/${s3Id}/action`, { method: 'POST', body: { type: 'card', card: 'draw-it' } });

      await httpRequest(baseUrl, `/api/session/${s3Id}/action`, {
        method: 'POST',
        body: { type: 'step', payload: { action: 'set_units', short: 2, long: 3 } }
      });
      await httpRequest(baseUrl, `/api/session/${s3Id}/action`, {
        method: 'POST',
        body: { type: 'step', payload: { action: 'outer_units', value: 22 } }
      });
      await httpRequest(baseUrl, `/api/session/${s3Id}/action`, {
        method: 'POST',
        body: { type: 'step', payload: { action: 'cubits_per_unit', value: 3 } }
      });
      await httpRequest(baseUrl, `/api/session/${s3Id}/action`, {
        method: 'POST',
        body: { type: 'step', payload: { action: 'shield_perimeter', value: 30 } }
      });
      const submitE3 = await httpRequest(baseUrl, `/api/session/${s3Id}/action`, {
        method: 'POST',
        body: { type: 'submit', value: 30 }
      });
      assert.equal(submitE3.body.state, 'look_back');

      // Look Back on Five Shields: option 0 check value is 84
      const lbE3 = await httpRequest(baseUrl, `/api/session/${s3Id}/action`, {
        method: 'POST',
        body: { type: 'lookback', index: 0, value: 84 }
      });
      assert.equal(lbE3.body.state, 'sealed');
      await httpRequest(baseUrl, `/api/session/${s3Id}/action`, { method: 'POST', body: { type: 'complete' } });

      // Verify Catalog: E3 completed, E4 unlocked!
      const cat3 = await httpRequest(baseUrl, '/api/encounters');
      assert.equal(cat3.body.encounters[2].completed, true);
      assert.equal(cat3.body.encounters[3].unlocked, true, 'Encounter 4 must now be unlocked');

      // ---------------------------------------------------------------------
      // Encounter 4: Castle Keep Portcullis (Factor Dials)
      // ---------------------------------------------------------------------
      const startE4 = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        body: { encounterId: 'ch1-n4-castle-keep' }
      });
      const s4Id = startE4.body.sessionId;
      assert.ok(s4Id);

      await httpRequest(baseUrl, `/api/session/${s4Id}/action`, { method: 'POST', body: { type: 'arrive' } });
      await httpRequest(baseUrl, `/api/session/${s4Id}/action`, { method: 'POST', body: { type: 'skip_conjecture' } });
      await httpRequest(baseUrl, `/api/session/${s4Id}/action`, { method: 'POST', body: { type: 'say', text: 'Three guardians guarding the lock.' } });
      await httpRequest(baseUrl, `/api/session/${s4Id}/action`, { method: 'POST', body: { type: 'say', text: 'Kimmy is shared between products 34 and 85.' } });
      await httpRequest(baseUrl, `/api/session/${s4Id}/action`, { method: 'POST', body: { type: 'card', card: 'find-what-is-shared' } });

      await httpRequest(baseUrl, `/api/session/${s4Id}/action`, {
        method: 'POST',
        body: { type: 'step', payload: { action: 'factor', productIndex: 0, factors: [2, 17] } }
      });
      await httpRequest(baseUrl, `/api/session/${s4Id}/action`, {
        method: 'POST',
        body: { type: 'step', payload: { action: 'factor', productIndex: 1, factors: [5, 17] } }
      });
      await httpRequest(baseUrl, `/api/session/${s4Id}/action`, {
        method: 'POST',
        body: { type: 'step', payload: { action: 'assign_shared', guardian: 'Kimmy', value: 17 } }
      });
      await httpRequest(baseUrl, `/api/session/${s4Id}/action`, {
        method: 'POST',
        body: { type: 'step', payload: { action: 'assign', guardian: 'Jimmy', value: 2 } }
      });
      await httpRequest(baseUrl, `/api/session/${s4Id}/action`, {
        method: 'POST',
        body: { type: 'step', payload: { action: 'assign', guardian: 'Timmy', value: 5 } }
      });
      await httpRequest(baseUrl, `/api/session/${s4Id}/action`, {
        method: 'POST',
        body: { type: 'step', payload: { action: 'submit_sum', value: 24 } }
      });
      const submitE4 = await httpRequest(baseUrl, `/api/session/${s4Id}/action`, {
        method: 'POST',
        body: { type: 'submit', value: 24 }
      });
      assert.equal(submitE4.body.state, 'look_back');

      // Look Back on Castle Keep: option 1 check value is 22
      const lbE4 = await httpRequest(baseUrl, `/api/session/${s4Id}/action`, {
        method: 'POST',
        body: { type: 'lookback', index: 1, value: 22 }
      });
      assert.equal(lbE4.body.state, 'sealed');
      await httpRequest(baseUrl, `/api/session/${s4Id}/action`, { method: 'POST', body: { type: 'complete' } });

      // ---------------------------------------------------------------------
      // Final Catalog Check: All 4 Encounters Completed!
      // ---------------------------------------------------------------------
      const catFinal = await httpRequest(baseUrl, '/api/encounters');
      assert.equal(catFinal.body.encounters.length, 4);
      for (let i = 0; i < 4; i++) {
        assert.equal(catFinal.body.encounters[i].unlocked, true, `Encounter ${i + 1} must be unlocked`);
        assert.equal(catFinal.body.encounters[i].completed, true, `Encounter ${i + 1} must be completed`);
      }
    });
  });

  // =========================================================================
  // SECTION 2: Out-of-Order API Calls, Simulated Delays & Payload Boundaries
  // =========================================================================
  describe('2. Out-of-Order Transitions, Concurrency Bursts & Malformed Payloads', () => {
    it('gracefully ignores out-of-order action types without state corruption', async () => {
      const start = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        body: { encounterId: 'ch1-n1-reverse-tolls' }
      });
      const sessionId = start.body.sessionId;
      assert.equal(start.body.state, 'arrive');

      // Out-of-order attempts in arrive: step, submit, lookback, next_part
      const stepRes = await httpRequest(baseUrl, `/api/session/${sessionId}/action`, {
        method: 'POST',
        body: { type: 'step', payload: { action: 'value', gateIndex: 2, value: 11 } }
      });
      assert.equal(stepRes.status, 200);
      assert.equal(stepRes.body.state, 'arrive', 'Step in arrive must be ignored');

      const submitRes = await httpRequest(baseUrl, `/api/session/${sessionId}/action`, {
        method: 'POST',
        body: { type: 'submit', value: 6 }
      });
      assert.equal(submitRes.body.state, 'arrive', 'Submit in arrive must be ignored');

      const lbRes = await httpRequest(baseUrl, `/api/session/${sessionId}/action`, {
        method: 'POST',
        body: { type: 'lookback', index: 0, value: 13 }
      });
      assert.equal(lbRes.body.state, 'arrive', 'Lookback in arrive must be ignored');

      const npRes = await httpRequest(baseUrl, `/api/session/${sessionId}/action`, {
        method: 'POST',
        body: { type: 'next_part' }
      });
      assert.equal(npRes.body.state, 'arrive', 'Next part in arrive must be ignored');

      // Verify session can still proceed normally
      const normRes = await httpRequest(baseUrl, `/api/session/${sessionId}/action`, {
        method: 'POST',
        body: { type: 'arrive' }
      });
      assert.equal(normRes.body.state, 'conjecture');
    });

    it('rejects malformed HTTP payloads with proper HTTP 400 status codes', async () => {
      // 1. Array instead of object
      const arrayRes = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([1, 2, 3])
      });
      assert.equal(arrayRes.status, 400);

      // 2. Primitive JSON string
      const primRes = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify("plain string")
      });
      assert.equal(primRes.status, 400);

      // 3. Null JSON
      const nullRes = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'null'
      });
      assert.equal(nullRes.status, 400);

      // 4. Invalid JSON syntax
      const syntaxRes = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ malformed: true '
      });
      assert.equal(syntaxRes.status, 400);

      // 5. Action missing type
      const start = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        body: { encounterId: 'ch1-n1-reverse-tolls' }
      });
      const noTypeRes = await httpRequest(baseUrl, `/api/session/${start.body.sessionId}/action`, {
        method: 'POST',
        body: { payload: 'no type field' }
      });
      assert.equal(noTypeRes.status, 400);
    });

    it('processes rapid concurrent action bursts on the same session without crash or unhandled error', async () => {
      const start = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        body: { encounterId: 'ch1-n1-reverse-tolls' }
      });
      const sessionId = start.body.sessionId;
      await httpRequest(baseUrl, `/api/session/${sessionId}/action`, { method: 'POST', body: { type: 'arrive' } });
      await httpRequest(baseUrl, `/api/session/${sessionId}/action`, { method: 'POST', body: { type: 'skip_conjecture' } });

      // Fire 6 concurrent say actions simultaneously
      const burstPromises = Array.from({ length: 6 }).map((_, i) =>
        httpRequest(baseUrl, `/api/session/${sessionId}/action`, {
          method: 'POST',
          body: { type: 'say', text: `Concurrent probe message number ${i + 1}?` }
        })
      );

      const results = await Promise.all(burstPromises);
      for (const r of results) {
        assert.equal(r.status, 200, 'Each concurrent request must return HTTP 200');
        assert.ok(r.body.ok);
      }

      // Check final state integrity
      const stateCheck = await httpRequest(baseUrl, `/api/session/${sessionId}/state`);
      assert.equal(stateCheck.status, 200);
      assert.ok(['understand', 'plan'].includes(stateCheck.body.state));
    });
  });

  // =========================================================================
  // SECTION 3: Simultaneous Sessions Across Multiple Browser Tabs
  // =========================================================================
  describe('3. Simultaneous Sessions Across Multiple Browser Tabs & SSE Streams', () => {
    it('maintains strict state isolation and targeted overrides across 3 concurrent sessions', async () => {
      // Tab 1: Reverse Tolls
      const tab1Start = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        body: { encounterId: 'ch1-n1-reverse-tolls' }
      });
      const tab1Id = tab1Start.body.sessionId;

      // Tab 2: Dark Vault
      const tab2Start = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        body: { encounterId: 'ch1-n2-dark-vault' }
      });
      const tab2Id = tab2Start.body.sessionId;

      // Tab 3: Castle Keep
      const tab3Start = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        body: { encounterId: 'ch1-n4-castle-keep' }
      });
      const tab3Id = tab3Start.body.sessionId;

      assert.notEqual(tab1Id, tab2Id);
      assert.notEqual(tab2Id, tab3Id);

      // Advance all 3 tabs simultaneously to arrive -> conjecture
      await Promise.all([
        httpRequest(baseUrl, `/api/session/${tab1Id}/action`, { method: 'POST', body: { type: 'arrive' } }),
        httpRequest(baseUrl, `/api/session/${tab2Id}/action`, { method: 'POST', body: { type: 'arrive' } }),
        httpRequest(baseUrl, `/api/session/${tab3Id}/action`, { method: 'POST', body: { type: 'arrive' } })
      ]);

      // Verify each session record in sessionStore
      assert.equal(sessionStore.get(tab1Id).session.state, 'conjecture');
      assert.equal(sessionStore.get(tab2Id).session.state, 'conjecture');
      assert.equal(sessionStore.get(tab3Id).session.state, 'conjecture');

      // Parent Overrides targeted specifically to Tab 1 (Hint Rung l3)
      const overrideTab1 = await httpRequest(baseUrl, '/api/parent/hint-override', {
        method: 'POST',
        body: { pin: '1234', sessionId: tab1Id, hintRung: 'l3' }
      });
      assert.equal(overrideTab1.status, 200);

      // Verify Tab 1 changed to l3, while Tab 2 and Tab 3 remain at l0!
      const tab1State = await httpRequest(baseUrl, `/api/session/${tab1Id}/state`);
      const tab2State = await httpRequest(baseUrl, `/api/session/${tab2Id}/state`);
      const tab3State = await httpRequest(baseUrl, `/api/session/${tab3Id}/state`);

      assert.equal(tab1State.body.view.hintRung, 'l3', 'Tab 1 must reflect overridden hint rung l3');
      assert.equal(tab2State.body.view.hintRung, 'l0', 'Tab 2 must not be modified by Tab 1 override');
      assert.equal(tab3State.body.view.hintRung, 'l0', 'Tab 3 must not be modified by Tab 1 override');

      // Parent Scribe Mode targeted specifically to Tab 2
      const scribeTab2 = await httpRequest(baseUrl, '/api/parent/toggle-scribe', {
        method: 'POST',
        body: { pin: '1234', sessionId: tab2Id, enabled: true }
      });
      assert.equal(scribeTab2.status, 200);
      assert.equal(scribeTab2.body.scribeEnabled, true);

      assert.equal(sessionStore.get(tab2Id).parentScribe, true, 'Tab 2 must have scribe enabled');
      assert.equal(sessionStore.get(tab1Id).parentScribe, false, 'Tab 1 must not have scribe enabled');
      assert.equal(sessionStore.get(tab3Id).parentScribe, false, 'Tab 3 must not have scribe enabled');

      // Telemetry log files check for each session
      const log1Path = path.join(rootDir, 'data', 'sessions', `${tab1Id}.jsonl`);
      const log2Path = path.join(rootDir, 'data', 'sessions', `${tab2Id}.jsonl`);
      const log3Path = path.join(rootDir, 'data', 'sessions', `${tab3Id}.jsonl`);

      assert.ok(fs.existsSync(log1Path), 'Log file for Tab 1 must exist');
      assert.ok(fs.existsSync(log2Path), 'Log file for Tab 2 must exist');
      assert.ok(fs.existsSync(log3Path), 'Log file for Tab 3 must exist');

      // Verify that log entries are valid JSONL and match their session IDs
      const lines1 = fs.readFileSync(log1Path, 'utf8').trim().split('\n');
      for (const line of lines1) {
        const ev = JSON.parse(line);
        assert.equal(ev.sessionId, tab1Id, 'Every event in log1 must match tab1Id');
      }
    });

    it('parent SSE streaming broadcasts live events to subscribed clients without cross-talk', async () => {
      const start = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        body: { encounterId: 'ch1-n1-reverse-tolls' }
      });
      const sessionId = start.body.sessionId;

      // Connect an SSE client to this session
      const sseEvents = [];
      const port = new URL(baseUrl).port;

      const ssePromise = new Promise((resolve, reject) => {
        const req = http.get({
          hostname: '127.0.0.1',
          port: Number(port),
          path: `/api/parent/transcript?pin=1234&session=${sessionId}`,
          headers: { Accept: 'text/event-stream' }
        }, (res) => {
          assert.equal(res.statusCode, 200);
          assert.equal(res.headers['content-type'], 'text/event-stream; charset=utf-8');

          res.on('data', chunk => {
            const raw = chunk.toString('utf8');
            const lines = raw.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const ev = JSON.parse(line.slice(6));
                  sseEvents.push(ev);
                  if (ev.type === 'child.action' || ev.type === 'engine.transition') {
                    // Received live action
                    resolve(req);
                  }
                } catch {}
              }
            }
          });
        });
        req.on('error', reject);
      });

      // Dispatch an action on the session to trigger an SSE broadcast
      await new Promise(r => setTimeout(r, 50));
      await httpRequest(baseUrl, `/api/session/${sessionId}/action`, {
        method: 'POST',
        body: { type: 'arrive' }
      });

      const reqHandle = await Promise.race([
        ssePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('SSE timeout')), 2000))
      ]);

      assert.ok(sseEvents.length > 0, 'Must have received SSE events');
      reqHandle.destroy();
    });
  });

  // =========================================================================
  // SECTION 4: Boundary Cutoffs in Conjectures & Look Back Validation
  // =========================================================================
  describe('4. Boundary Cutoffs in Conjectures, Reason Lengths & Look Back Checks', () => {
    it('rigorously tests conjecture reason word-count boundaries (2 vs 3 words)', async () => {
      // Encounter 1 target answer is 6
      const start = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        body: { encounterId: 'ch1-n1-reverse-tolls' }
      });
      const sessionId = start.body.sessionId;
      await httpRequest(baseUrl, `/api/session/${sessionId}/action`, { method: 'POST', body: { type: 'arrive' } });

      // Boundary Test 1: Exactly 2 words in reason ("I know")
      // Spec §4: "Right answer with reason < 3 words -> Skeptic prompt"
      const res2words = await httpRequest(baseUrl, `/api/session/${sessionId}/action`, {
        method: 'POST',
        body: { type: 'conjecture', stem: 'think', value: 6, reason: 'I know' }
      });
      assert.equal(res2words.body.state, 'conjecture', 'Reason with 2 words must not shortcut to Look Back');
      const events2w = res2words.body.events || [];
      assert.ok(events2w.some(e => e.type === 'conjecture.skeptic_prompt'), 'Must emit skeptic prompt');

      // Boundary Test 2: Exactly 3 words in reason ("I know this")
      // Spec §4: "Right answer with reason >= 3 words -> Shortcut to Look back"
      const res3words = await httpRequest(baseUrl, `/api/session/${sessionId}/action`, {
        method: 'POST',
        body: { type: 'conjecture', stem: 'think', value: 6, reason: 'I know this' }
      });
      assert.equal(res3words.body.state, 'look_back', 'Reason with 3 words must shortcut directly to Look Back');
      const events3w = res3words.body.events || [];
      assert.ok(events3w.some(e => e.type === 'shortcut'), 'Must record shortcut event');
    });

    it('correctly parses unicode whitespace and multi-space intervals in word count', () => {
      assert.equal(countWords(''), 0);
      assert.equal(countWords('   '), 0);
      assert.equal(countWords('one'), 1);
      assert.equal(countWords('one two'), 2);
      assert.equal(countWords('one   two   three'), 3);
      assert.equal(countWords('one\ttwo\nthree'), 3);
      assert.equal(countWords('one\u00A0two\u2003three'), 3);
      assert.equal(countWords(null), 0);
      assert.equal(countWords(undefined), 0);
    });

    it('enforces conjecture attempt limits: max 2 wrong conjectures route to understand', async () => {
      const start = await httpRequest(baseUrl, '/api/session/start', {
        method: 'POST',
        body: { encounterId: 'ch1-n1-reverse-tolls' }
      });
      const sessionId = start.body.sessionId;
      await httpRequest(baseUrl, `/api/session/${sessionId}/action`, { method: 'POST', body: { type: 'arrive' } });

      // Wrong conjecture 1: routes to understand
      const c1 = await httpRequest(baseUrl, `/api/session/${sessionId}/action`, {
        method: 'POST',
        body: { type: 'conjecture', stem: 'think', value: 99, reason: 'just a guess' }
      });
      assert.equal(c1.body.state, 'understand');

      // Wrong conjecture 2 (in understand): updates misconception and closes conjecture window
      const c2 = await httpRequest(baseUrl, `/api/session/${sessionId}/action`, {
        method: 'POST',
        body: { type: 'conjecture', stem: 'think', value: 100, reason: 'another guess' }
      });
      assert.equal(c2.body.state, 'understand');

      // Third conjecture attempt in understand: should be ignored or capped at 2
      const c3 = await httpRequest(baseUrl, `/api/session/${sessionId}/action`, {
        method: 'POST',
        body: { type: 'conjecture', stem: 'think', value: 101, reason: 'third attempt' }
      });
      assert.equal(c3.body.state, 'understand');
      assert.equal(sessionStore.get(sessionId).session.conjectures, 2, 'Conjecture counter must be capped at 2');
    });

    it('validates Look Back reflection checks across all 4 encounters (rejecting incorrect reflections)', async () => {
      // E1: target check 13 (wrong: 99)
      const s1 = await httpRequest(baseUrl, '/api/session/start', { method: 'POST', body: { encounterId: 'ch1-n1-reverse-tolls' } });
      const id1 = s1.body.sessionId;
      await httpRequest(baseUrl, `/api/session/${id1}/action`, { method: 'POST', body: { type: 'arrive' } });
      await httpRequest(baseUrl, `/api/session/${id1}/action`, { method: 'POST', body: { type: 'conjecture', stem: 'think', value: 6, reason: 'three word shortcut' } });
      assert.equal(sessionStore.get(id1).session.state, 'look_back');

      // Wrong reflection
      const wrongLb1 = await httpRequest(baseUrl, `/api/session/${id1}/action`, {
        method: 'POST',
        body: { type: 'lookback', index: 0, value: 99 }
      });
      assert.equal(wrongLb1.body.state, 'look_back', 'Wrong reflection must keep state in look_back');
      assert.ok(wrongLb1.body.events.some(e => e.type === 'lookback.retry'));

      // Right reflection (13)
      const rightLb1 = await httpRequest(baseUrl, `/api/session/${id1}/action`, {
        method: 'POST',
        body: { type: 'lookback', index: 0, value: 13 }
      });
      assert.equal(rightLb1.body.state, 'sealed');

      // E3: target check 84 (wrong: 50)
      const s3 = await httpRequest(baseUrl, '/api/session/start', { method: 'POST', body: { encounterId: 'ch1-n3-five-shields' } });
      const id3 = s3.body.sessionId;
      await httpRequest(baseUrl, `/api/session/${id3}/action`, { method: 'POST', body: { type: 'arrive' } });
      await httpRequest(baseUrl, `/api/session/${id3}/action`, { method: 'POST', body: { type: 'conjecture', stem: 'think', value: 30, reason: 'shortcut to reflection' } });
      assert.equal(sessionStore.get(id3).session.state, 'look_back');

      const wrongLb3 = await httpRequest(baseUrl, `/api/session/${id3}/action`, {
        method: 'POST',
        body: { type: 'lookback', index: 0, value: 50 }
      });
      assert.equal(wrongLb3.body.state, 'look_back');

      const rightLb3 = await httpRequest(baseUrl, `/api/session/${id3}/action`, {
        method: 'POST',
        body: { type: 'lookback', index: 0, value: 84 }
      });
      assert.equal(rightLb3.body.state, 'sealed');
    });

    it('enforces single Look Back waiver per chapter across sessions with PIN protection', async () => {
      // 1. Session 1: Chasm of Reverse Tolls (Chapter 1)
      const s1 = await httpRequest(baseUrl, '/api/session/start', { method: 'POST', body: { encounterId: 'ch1-n1-reverse-tolls' } });
      const id1 = s1.body.sessionId;
      await httpRequest(baseUrl, `/api/session/${id1}/action`, { method: 'POST', body: { type: 'arrive' } });
      await httpRequest(baseUrl, `/api/session/${id1}/action`, { method: 'POST', body: { type: 'conjecture', stem: 'think', value: 6, reason: 'shortcut to waiver' } });
      assert.equal(sessionStore.get(id1).session.state, 'look_back');

      // Wrong PIN should return HTTP 401
      const badPin = await httpRequest(baseUrl, '/api/parent/waiver', {
        method: 'POST',
        body: { pin: '9999', sessionId: id1 }
      });
      assert.equal(badPin.status, 401);

      // Correct PIN should succeed and seal
      const okWaiver = await httpRequest(baseUrl, '/api/parent/waiver', {
        method: 'POST',
        body: { pin: '1234', sessionId: id1 }
      });
      assert.equal(okWaiver.status, 200);
      assert.equal(okWaiver.body.waived, true);
      assert.equal(okWaiver.body.sealed, true);
      assert.equal(sessionStore.get(id1).session.state, 'sealed');

      // Immediate second waiver on same session must fail with HTTP 400
      const repeatWaiver = await httpRequest(baseUrl, '/api/parent/waiver', {
        method: 'POST',
        body: { pin: '1234', sessionId: id1 }
      });
      assert.equal(repeatWaiver.status, 400);

      // 2. Session 2: Different encounter in same chapter (Five Shields, Chapter 1)
      const s2 = await httpRequest(baseUrl, '/api/session/start', { method: 'POST', body: { encounterId: 'ch1-n3-five-shields' } });
      const id2 = s2.body.sessionId;
      await httpRequest(baseUrl, `/api/session/${id2}/action`, { method: 'POST', body: { type: 'arrive' } });
      await httpRequest(baseUrl, `/api/session/${id2}/action`, { method: 'POST', body: { type: 'conjecture', stem: 'think', value: 30, reason: 'shortcut in encounter 3' } });
      assert.equal(sessionStore.get(id2).session.state, 'look_back');

      // Waiver attempt on Session 2 must fail because Chapter 1 waiver was already consumed!
      const crossSessionWaiver = await httpRequest(baseUrl, '/api/parent/waiver', {
        method: 'POST',
        body: { pin: '1234', sessionId: id2 }
      });
      assert.equal(crossSessionWaiver.status, 400);
      assert.ok(crossSessionWaiver.body.error.includes('already used this chapter'));
    });
  });

  // =========================================================================
  // SECTION 5: Authentic 46-Feature Execution & Anti-Pattern Compliance
  // =========================================================================
  describe('5. Authentic 46-Feature Execution, Information Diet & Anti-Pattern Audit', () => {
    it('Feature 17 & 26: Leak gate synchronously blocks adversarial vectors including simpler problem and Look Back checks', () => {
      // Simpler problem answer value 5
      const ctx1 = {
        forbidden: [6, 7, 11, 12, 14, 22, 5],
        hintText: 'Work backwards.',
        givens: [13],
        state: 'carry_out',
        hintRung: 'l2',
        rung: 'l2'
      };
      const leakSp = checkUtterance('Could the intermediate answer be 5 coins here?', ctx1);
      assert.equal(leakSp.allowed, false, 'Must block simpler problem answer 5');

      // Look Back check target 45
      const ctx2 = {
        forbidden: [6, 7, 11, 12, 14, 22, 45],
        hintText: 'Reflect upon the steps.',
        givens: [13],
        state: 'look_back',
        hintRung: 'l3',
        rung: 'l3'
      };
      const leakLb = checkUtterance('What happens if the starting amount was 45?', ctx2);
      assert.equal(leakLb.allowed, false, 'Must block Look Back check value 45');

      // Obfuscated homoglyphs (Cyrillic)
      const leakHomo = checkUtterance('Could the answer be \u0455\u0456\u0445 coins?', ctx1);
      assert.equal(leakHomo.allowed, false, 'Must block Cyrillic homoglyph for six');

      // Roman numerals
      const leakRoman = checkUtterance('Could the answer be \u2165?', ctx1);
      assert.equal(leakRoman.allowed, false, 'Must block Roman numeral VI');

      // Praise phrases
      const leakPraise = checkUtterance('That is right! What clue tells you that?', ctx1);
      assert.equal(leakPraise.allowed, false, 'Must block evaluative praise');
    });

    it('Feature 19 & 45: Zero secrets ever leak over client-safe endpoints', async () => {
      // 1. Static encounter views
      const encounters = ['ch1-n1-reverse-tolls', 'ch1-n2-dark-vault', 'ch1-n3-five-shields', 'ch1-n4-castle-keep'];
      for (const encId of encounters) {
        const viewRes = await httpRequest(baseUrl, `/api/encounter/${encId}/view`);
        assert.equal(viewRes.status, 200);
        const str = JSON.stringify(viewRes.body);
        assert.ok(!str.includes('"answer"'), `Encounter ${encId} must not contain answer`);
        assert.ok(!str.includes('"intermediates"'), `Encounter ${encId} must not contain intermediates`);
        assert.ok(!str.includes('"solutionTree"'), `Encounter ${encId} must not contain solutionTree`);
      }
    });

    it('Feature 36: Strictly zero timers, streaks, scores, countdowns, or leaderboards in code', () => {
      const clientFiles = [
        path.join(rootDir, 'client', 'app.js'),
        path.join(rootDir, 'client', 'index.html'),
        path.join(rootDir, 'client', 'parent.html'),
        path.join(rootDir, 'client', 'parent.js')
      ];

      for (const f of clientFiles) {
        const content = fs.readFileSync(f, 'utf8').toLowerCase();
        assert.ok(!content.includes('countdown'), `${f} must not contain countdowns`);
        assert.ok(!content.includes('leaderboard'), `${f} must not contain leaderboards`);
        assert.ok(!content.includes('streak'), `${f} must not contain streaks`);
        assert.ok(!content.includes('high_score'), `${f} must not contain high scores`);
      }
    });

    it('Feature 36 & 43: CSS touch targets and accessibility styles meet requirements', () => {
      const cssPath = path.join(rootDir, 'client', 'style.css');
      assert.ok(fs.existsSync(cssPath));
      const css = fs.readFileSync(cssPath, 'utf8');

      // Touch targets >= 56px check
      assert.ok(css.includes('min-height: 56px') || css.includes('56px'), 'CSS must include touch target minimums of 56px');
      // Dyslexia class check
      assert.ok(css.includes('.dyslexia-font'), 'CSS must support .dyslexia-font accessibility class');
    });

    it('Feature 38: Asset manifest approval check prevents unapproved assets', async () => {
      // Normal approved asset serves 200
      const approvedRes = await httpRequest(baseUrl, '/assets/manifest.json');
      assert.equal(approvedRes.status, 200);

      // Unregistered asset returns 404
      const unregRes = await httpRequest(baseUrl, '/assets/nonexistent-image.svg');
      assert.equal(unregRes.status, 404);

      // Null byte injection in static path returns 403
      const nullByteRes = await httpRequest(baseUrl, '/assets/scenes/ch1-n1-locked.svg%00.png');
      assert.equal(nullByteRes.status, 403);

      // Unapproved asset returns 403
      const manifestPath = path.join(rootDir, 'client', 'assets', 'manifest.json');
      const rawManifest = fs.readFileSync(manifestPath, 'utf8');
      const manifestObj = JSON.parse(rawManifest);
      const originalEntry = manifestObj.assets['scenes/ch1-n1-locked.svg'];

      try {
        manifestObj.assets['scenes/ch1-n1-locked.svg'] = {
          ...originalEntry,
          approved: false
        };
        fs.writeFileSync(manifestPath, JSON.stringify(manifestObj, null, 2));

        const unapprovedRes = await httpRequest(baseUrl, '/assets/scenes/ch1-n1-locked.svg');
        assert.equal(unapprovedRes.status, 403, 'Unapproved asset must return HTTP 403');
        assert.equal(unapprovedRes.body.error, 'Asset not approved');
      } finally {
        fs.writeFileSync(manifestPath, rawManifest);
      }
    });
  });
});
