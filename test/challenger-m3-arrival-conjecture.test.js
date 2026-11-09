/**
 * Castle of Theorems — Milestone M3 Empirical Challenger Test Suite
 * test/challenger-m3-arrival-conjecture.test.js
 *
 * Adversarial stress testing for:
 * 1. Encounter Arrival Progression:
 *    - All 4 encounters start in 'arrive' and cleanly transition to 'conjecture' via { type: 'arrive' }.
 *    - Multi-part encounter (Alchemist's Dark Vault, Parts a -> b -> c) transitions cleanly
 *      through each subpart's arrival lifecycle.
 * 2. Stress Arbitrary Non-Solution Conjectures:
 *    - State 'conjecture' resilience to extreme, non-solution, malformed inputs.
 *    - State 'carry_out' resilience to arbitrary non-solution diagram stepper/control actions
 *      across all 4 mechanics:
 *        * inverse-chain (Reverse Tolls)
 *        * goblin-bins (Dark Vault)
 *        * seam-grid (Five Shields)
 *        * factor-dials (Castle Keep)
 *    - Correct non-progress evaluation, nonProgressCount increments, ladder escalation,
 *      and zero HTTP 500 errors.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, closeServer } from '../server/index.js';

describe('Empirical Challenger M3: Arrival Progression & Arbitrary Diagram Conjectures', () => {
  let testEnv;
  let testUrl;

  before(async () => {
    testEnv = await startServer(0, '127.0.0.1', { parentPin: '1234' });
    testUrl = testEnv.url;
  });

  after(async () => {
    if (testEnv?.server) {
      await closeServer(testEnv.server);
    }
  });

  // Helper to post an action to the server
  async function postAction(sessionId, action) {
    const res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    return { status: res.status, ok: res.ok, data };
  }

  // Helper to start an encounter session
  async function startSession(encounterId) {
    const res = await fetch(`${testUrl}/api/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId })
    });
    assert.equal(res.status, 200, `Failed to start session for ${encounterId}`);
    const data = await res.json();
    return { sessionId: data.sessionId, view: data.view };
  }

  // Helper to advance a session from start to carry_out
  async function advanceToCarryOut(encounterId, cardId) {
    const { sessionId } = await startSession(encounterId);
    // Arrive -> conjecture
    await postAction(sessionId, { type: 'arrive' });
    // Skip conjecture -> understand
    await postAction(sessionId, { type: 'skip_conjecture' });
    // Understand -> 2 probes cap -> plan
    await postAction(sessionId, { type: 'say', text: 'I understand what is given and what we need.' });
    await postAction(sessionId, { type: 'say', text: 'We must solve according to the rules of the gate.' });
    // Plan -> card -> carry_out
    const cardRes = await postAction(sessionId, { type: 'card', cardId });
    assert.equal(cardRes.data.view.state, 'carry_out', `Failed to enter carry_out for ${encounterId}`);
    return { sessionId, view: cardRes.data.view };
  }

  // ===========================================================================
  // 1. Encounter Arrival Progression
  // ===========================================================================
  describe('1. Encounter Arrival Progression Across All Encounters', () => {
    const encounters = [
      { id: 'ch1-n1-reverse-tolls', name: 'Reverse Tolls' },
      { id: 'ch1-n2-dark-vault', name: 'Dark Vault' },
      { id: 'ch1-n3-five-shields', name: 'Five Shields' },
      { id: 'ch1-n4-castle-keep', name: 'Castle Keep' }
    ];

    for (const enc of encounters) {
      it(`${enc.name}: starts in "arrive" and cleanly transitions to "conjecture" via { type: 'arrive' }`, async () => {
        const { sessionId, view } = await startSession(enc.id);
        assert.equal(view.state, 'arrive', `${enc.name} must start in arrive`);
        assert.equal(view.workspaceUnlocked, false);
        assert.equal(view.sealed, false);

        // Advance via { type: 'arrive' }
        const { status, data } = await postAction(sessionId, { type: 'arrive' });
        assert.equal(status, 200);
        assert.equal(data.view.state, 'conjecture', `${enc.name} must transition to conjecture`);
        assert.equal(data.view.conjecturesRemaining, 2);
      });
    }

    it('Dark Vault: multi-part progression (a -> b -> c) transitions cleanly through each subpart arrival', async () => {
      const { sessionId, view: initialView } = await startSession('ch1-n2-dark-vault');

      // -----------------------------------------------------------------------
      // Part a
      // -----------------------------------------------------------------------
      assert.equal(initialView.currentPartId, 'a');
      assert.equal(initialView.state, 'arrive');

      // Transition Part a: arrive -> conjecture
      const arriveA = await postAction(sessionId, { type: 'arrive' });
      assert.equal(arriveA.data.view.state, 'conjecture');
      assert.equal(arriveA.data.view.currentPartId, 'a');

      // Skip conjecture -> understand
      await postAction(sessionId, { type: 'skip_conjecture' });
      // Cap understand -> plan
      await postAction(sessionId, { type: 'say', text: 'There are twelve ruby crystals.' });
      await postAction(sessionId, { type: 'say', text: 'We want to guarantee a matching pair.' });
      // Select card -> carry_out
      await postAction(sessionId, { type: 'card', cardId: 'worst-case' });

      // Part a target answer is 4 (draw 4 crystals to guarantee a pair of 3 colors)
      const submitA = await postAction(sessionId, { type: 'submit', value: 4 });
      assert.equal(submitA.data.view.state, 'sealed', 'Intermediate Part a must seal');
      assert.equal(submitA.data.view.currentPartId, 'a');

      // Advance to Part b
      const nextPartB = await postAction(sessionId, { type: 'next_part' });
      assert.equal(nextPartB.status, 200);
      assert.equal(nextPartB.data.view.state, 'arrive', 'Part b must enter state arrive');
      assert.equal(nextPartB.data.view.currentPartId, 'b', 'Current part must advance to b');
      assert.equal(nextPartB.data.view.workspaceUnlocked, false, 'Workspace must be locked in arrive');

      // -----------------------------------------------------------------------
      // Part b
      // -----------------------------------------------------------------------
      // Transition Part b: arrive -> conjecture
      const arriveB = await postAction(sessionId, { type: 'arrive' });
      assert.equal(arriveB.status, 200);
      assert.equal(arriveB.data.view.state, 'conjecture', 'Part b must transition to conjecture');
      assert.equal(arriveB.data.view.currentPartId, 'b');
      assert.equal(arriveB.data.view.conjecturesRemaining, 2);

      // Part b early conjecture with wrong guess (e.g. 5) -> understand
      const wrongConjB = await postAction(sessionId, {
        type: 'conjecture',
        stem: 'I guess',
        value: 5,
        reason: 'Five seems like enough.'
      });
      assert.equal(wrongConjB.data.view.state, 'understand');
      assert.equal(wrongConjB.data.view.conjecturesRemaining, 1);

      // Understand -> plan
      await postAction(sessionId, { type: 'say', text: 'We need four crystals of the same color.' });
      await postAction(sessionId, { type: 'say', text: 'We want the worst case distribution.' });
      // Plan -> carry_out
      await postAction(sessionId, { type: 'card', cardId: 'worst-case' });

      // Part b target answer is 10 (3 * 3 + 1 = 10)
      const submitB = await postAction(sessionId, { type: 'submit', value: 10 });
      assert.equal(submitB.data.view.state, 'sealed', 'Intermediate Part b must seal');
      assert.equal(submitB.data.view.currentPartId, 'b');

      // Advance to Part c
      const nextPartC = await postAction(sessionId, { type: 'next_part' });
      assert.equal(nextPartC.status, 200);
      assert.equal(nextPartC.data.view.state, 'arrive', 'Part c must enter state arrive');
      assert.equal(nextPartC.data.view.currentPartId, 'c', 'Current part must advance to c');
      assert.equal(nextPartC.data.view.workspaceUnlocked, false, 'Workspace must be locked in arrive');

      // -----------------------------------------------------------------------
      // Part c (Final Part)
      // -----------------------------------------------------------------------
      // Transition Part c: arrive -> conjecture
      const arriveC = await postAction(sessionId, { type: 'arrive' });
      assert.equal(arriveC.status, 200);
      assert.equal(arriveC.data.view.state, 'conjecture', 'Part c must transition to conjecture');
      assert.equal(arriveC.data.view.currentPartId, 'c');
      assert.equal(arriveC.data.view.conjecturesRemaining, 2);

      // Skip conjecture -> understand -> plan -> carry_out
      await postAction(sessionId, { type: 'skip_conjecture' });
      await postAction(sessionId, { type: 'say', text: 'We need all different colors.' });
      await postAction(sessionId, { type: 'say', text: 'One color has twelve crystals.' });
      await postAction(sessionId, { type: 'card', cardId: 'worst-case' });

      // Part c target answer is 13 (draw 12 of one color + 1)
      const submitC = await postAction(sessionId, { type: 'submit', value: 13 });
      assert.equal(submitC.data.view.state, 'look_back', 'Final Part c submit must advance to look_back');

      // Look back perturb option: check is 5
      const lbRes = await postAction(sessionId, { type: 'lookback', kind: 'perturb', value: 5 });
      assert.equal(lbRes.data.view.state, 'sealed', 'Look back must seal final encounter');

      // Final completion -> Map
      const mapRes = await postAction(sessionId, { type: 'next_part' });
      assert.equal(mapRes.data.view.state, 'map', 'Final next_part must transition to map');
    });

    it('empirically documents multi-part browser client UI transition gap for intermediate parts', async () => {
      // 1. Verify that server view emits view.sealed=true and codex on intermediate part a
      const { sessionId } = await startSession('ch1-n2-dark-vault');
      await postAction(sessionId, { type: 'arrive' });
      await postAction(sessionId, { type: 'skip_conjecture' });
      await postAction(sessionId, { type: 'say', text: 'I understand what is given' });
      await postAction(sessionId, { type: 'say', text: 'I understand what is sought' });
      await postAction(sessionId, { type: 'card', cardId: 'worst-case' });
      const submitRes = await postAction(sessionId, { type: 'submit', value: 4 });

      assert.equal(submitRes.data.view.state, 'sealed');
      assert.equal(submitRes.data.view.sealed, false, 'Server view must NOT set sealed: true on intermediate part');
      assert.equal(submitRes.data.view.partSealed, true, 'Server view sets partSealed: true on intermediate part');
      assert.equal(submitRes.data.view.hasMoreParts, true, 'Server view sets hasMoreParts: true on intermediate part');
      assert.equal(submitRes.data.view.codex, null, 'Server view must not attach codex prior to full encounter completion');

      // 2. Inspect client/app.js and client/index.html to confirm presence of next_part wire dispatch
      const fs = await import('node:fs/promises');
      const appJs = await fs.readFile('client/app.js', 'utf-8');
      const indexHtml = await fs.readFile('client/index.html', 'utf-8');

      const appHasNextPart = appJs.includes('next_part');
      const htmlHasNextPart = indexHtml.includes('next-part') || indexHtml.includes('next_part');

      assert.equal(appHasNextPart, true, 'client/app.js must contain handler to dispatch next_part');
      assert.equal(htmlHasNextPart, true, 'client/index.html must contain button to advance parts');

      // 3. Advancing with next_part transitions to Part b in arrive state
      const nextPartRes = await postAction(sessionId, { type: 'next_part' });
      assert.equal(nextPartRes.status, 200);
      assert.equal(nextPartRes.data.view.currentPartId, 'b');
      assert.equal(nextPartRes.data.view.state, 'arrive');
    });
  });

  // ===========================================================================
  // 2. Stress Arbitrary Non-Solution Conjectures in State "conjecture"
  // ===========================================================================
  describe('2. Stress Arbitrary Non-Solution Conjectures in State "conjecture"', () => {
    it('handles negative, decimal, extreme, and malformed conjecture values without crashing', async () => {
      const weirdValues = [-9999, 0, 3.14159, 1e9, 999999999, 'not-a-number'];

      for (const val of weirdValues) {
        const { sessionId } = await startSession('ch1-n1-reverse-tolls');
        await postAction(sessionId, { type: 'arrive' });

        const conjRes = await postAction(sessionId, {
          type: 'conjecture',
          stem: 'I conjecture that',
          value: val,
          reason: 'This is a stress test justification with many words.'
        });

        assert.equal(conjRes.status, 200, `Failed for value ${val}`);
        assert.equal(conjRes.data.view.state, 'understand', 'Wrong conjecture must route to understand');
        assert.equal(conjRes.data.view.conjecturesRemaining, 1);
      }
    });

    it('enforces 2-conjecture maximum cap under repeated arbitrary wrong guesses', async () => {
      const { sessionId } = await startSession('ch1-n1-reverse-tolls');
      await postAction(sessionId, { type: 'arrive' });

      // First wrong conjecture -> understand (conjectures=1)
      const c1 = await postAction(sessionId, {
        type: 'conjecture',
        value: 100,
        reason: 'Arbitrary guess one that has more than three words.'
      });
      assert.equal(c1.data.view.state, 'understand');
      assert.equal(c1.data.view.conjecturesRemaining, 1);

      // Second wrong conjecture in understand -> understand (conjectures=2, slate closed)
      const c2 = await postAction(sessionId, {
        type: 'conjecture',
        value: 200,
        reason: 'Arbitrary guess two that also has more than three words.'
      });
      assert.equal(c2.data.view.state, 'understand');
      assert.equal(c2.data.view.conjecturesRemaining, 0);

      // Third conjecture attempt in understand must be rejected / ignored by state machine
      const c3 = await postAction(sessionId, {
        type: 'conjecture',
        value: 6, // correct answer, but conjecture cap reached!
        reason: 'Attempting to conjecture after cap is reached.'
      });
      assert.equal(c3.data.view.state, 'understand', 'Must remain in understand; conjecture window closed');
      assert.equal(c3.data.view.conjecturesRemaining, 0);
    });

    it('handles justifications with empty text, single words, emojis, and giant strings safely', async () => {
      const testCases = [
        { reason: '', expectedWords: 0 },
        { reason: '   ', expectedWords: 0 },
        { reason: 'Short', expectedWords: 1 },
        { reason: 'Two words', expectedWords: 2 },
        { reason: '🧙‍♂️ 🦉 🏰 ✨', expectedWords: 4 },
        { reason: 'Word '.repeat(500), expectedWords: 500 }
      ];

      for (const tc of testCases) {
        const { sessionId } = await startSession('ch1-n1-reverse-tolls');
        await postAction(sessionId, { type: 'arrive' });

        const res = await postAction(sessionId, {
          type: 'conjecture',
          value: 42,
          reason: tc.reason
        });

        assert.equal(res.status, 200);
        assert.equal(res.data.view.state, 'understand');
      }
    });
  });

  // ===========================================================================
  // 3. Stress Arbitrary Non-Solution Diagram Stepper & Control Actions in State "carry_out"
  // ===========================================================================
  describe('3. Stress Arbitrary Non-Solution Diagram Steppers Across All 4 Mechanics', () => {

    // -------------------------------------------------------------------------
    // Mechanic 1: inverse-chain (Reverse Tolls)
    // -------------------------------------------------------------------------
    describe('Mechanic 1: inverse-chain (Reverse Tolls)', () => {
      it('evaluates arbitrary non-solution order and value steps as non-progress without 500 errors', async () => {
        const arbitrarySteps = [
          // Invalid action name
          { action: 'invalid_op', gateIndex: 2 },
          // Wrong order sequence (divide then add instead of add then divide)
          { action: 'order', gateIndex: 2, order: ['divide', 'add'] },
          // Non-existent operations
          { action: 'order', gateIndex: 2, order: ['pow', 'sqrt'] },
          // Out of bounds gate index
          { action: 'order', gateIndex: 99, order: ['add', 'divide'] },
          { action: 'order', gateIndex: -1, order: ['add', 'divide'] },
          // Empty or non-array order
          { action: 'order', gateIndex: 2, order: null },
          // Wrong intermediate value (expected 11 for gate 2, test wrong numbers)
          { action: 'value', gateIndex: 2, value: 999 },
          { action: 'value', gateIndex: 2, value: -5 },
          { action: 'value', gateIndex: 2, value: 0 },
          { action: 'value', gateIndex: 2, value: 3.1415 },
          // Value before order verified
          { action: 'value', gateIndex: 1, value: 7 },
          // Out of bounds gate index for value
          { action: 'value', gateIndex: 10, value: 11 }
        ];

        for (const step of arbitrarySteps) {
          const { sessionId } = await advanceToCarryOut('ch1-n1-reverse-tolls', 'work-backwards');
          const res = await postAction(sessionId, { type: 'step', step });
          assert.equal(res.status, 200, `Step failed with status ${res.status}: ${JSON.stringify(step)}`);
          assert.equal(res.data.ok, true);
          assert.equal(res.data.view.state, 'carry_out');
          // Verify no step.success event was emitted for non-solution step
          const successEv = (res.data.events || []).find(e => e.type === 'step.success');
          assert.equal(successEv, undefined, 'Must not emit step.success for invalid/non-solution step');
        }
      });

      it('accumulates consecutive non-progress steps and advances hint ladder', async () => {
        const { sessionId, view: initialView } = await advanceToCarryOut('ch1-n1-reverse-tolls', 'work-backwards');
        assert.equal(initialView.hintRung, 'l0');

        // Two consecutive wrong steps should advance ladder from l0 -> l1
        await postAction(sessionId, {
          type: 'step',
          step: { action: 'order', gateIndex: 2, order: ['divide', 'add'] }
        });
        const res2 = await postAction(sessionId, {
          type: 'step',
          step: { action: 'order', gateIndex: 2, order: ['divide', 'add'] }
        });

        assert.equal(res2.status, 200);
        assert.equal(res2.data.view.hintRung, 'l1', 'Two consecutive non-progress steps must advance hint ladder to l1');
      });
    });

    // -------------------------------------------------------------------------
    // Mechanic 2: goblin-bins (Dark Vault)
    // -------------------------------------------------------------------------
    describe('Mechanic 2: goblin-bins (Dark Vault)', () => {
      it('evaluates arbitrary non-solution crystal placements as non-progress without 500 errors', async () => {
        const arbitrarySteps = [
          // Placing negative crystals
          { action: 'place', binIndex: 0, count: -5 },
          // Placing in non-existent bin
          { action: 'place', binIndex: 99, count: 1 },
          { action: 'place', binIndex: -1, count: 1 },
          // Placing non-numeric count
          { action: 'place', binIndex: 0, count: 'two' },
          // Exceeding per-bin limit / threshold
          { action: 'place', binIndex: 0, count: 50 },
          // Resetting bins
          { action: 'reset' },
          // Unrecognized action type
          { action: 'smash_crystals' }
        ];

        for (const step of arbitrarySteps) {
          const { sessionId } = await advanceToCarryOut('ch1-n2-dark-vault', 'worst-case');
          const res = await postAction(sessionId, { type: 'step', step });
          assert.equal(res.status, 200, `Step failed with status ${res.status}: ${JSON.stringify(step)}`);
          assert.equal(res.data.ok, true);
          assert.equal(res.data.view.state, 'carry_out');
          const successEv = (res.data.events || []).find(e => e.type === 'step.success');
          assert.equal(successEv, undefined, 'Must not emit step.success for invalid/non-solution step');
        }
      });
    });

    // -------------------------------------------------------------------------
    // Mechanic 3: seam-grid (Five Shields)
    // -------------------------------------------------------------------------
    describe('Mechanic 3: seam-grid (Five Shields)', () => {
      it('evaluates arbitrary unit ratios and wrong perimeter calculations as non-progress without 500 errors', async () => {
        const arbitrarySteps = [
          // Wrong unit lengths (solution is short: 2, long: 3)
          { action: 'set_units', short: 1, long: 1 },
          { action: 'set_units', short: 5, long: 2 },
          { action: 'set_units', short: 0, long: 0 },
          { action: 'set_units', short: -2, long: 3 },
          { action: 'set_units', short: 100, long: 200 },
          // Malformed types
          { action: 'set_units', short: 'two', long: 'three' },
          // Wrong perimeter checks (target perimeter is 30, test incorrect checks)
          { action: 'check_perimeter', perimeter: 999 },
          { action: 'check_perimeter', perimeter: 0 },
          { action: 'check_perimeter', perimeter: -1 },
          // Unrecognized action
          { action: 'paint_shield', color: 'gold' }
        ];

        for (const step of arbitrarySteps) {
          const { sessionId } = await advanceToCarryOut('ch1-n3-five-shields', 'draw-it');
          const res = await postAction(sessionId, { type: 'step', step });
          assert.equal(res.status, 200, `Step failed with status ${res.status}: ${JSON.stringify(step)}`);
          assert.equal(res.data.ok, true);
          assert.equal(res.data.view.state, 'carry_out');
          const successEv = (res.data.events || []).find(e => e.type === 'step.success');
          assert.equal(successEv, undefined, 'Must not emit step.success for invalid/non-solution step');
        }
      });
    });

    // -------------------------------------------------------------------------
    // Mechanic 4: factor-dials (Castle Keep)
    // -------------------------------------------------------------------------
    describe('Mechanic 4: factor-dials (Castle Keep)', () => {
      it('evaluates arbitrary factors and guardian assignments as non-progress without 500 errors', async () => {
        const arbitrarySteps = [
          // Non-prime or non-factor combinations for product 0 (Jimmy * Kimmy = 34, prime factors 2, 17)
          { action: 'factor', productIndex: 0, factors: [1, 34] },
          { action: 'factor', productIndex: 0, factors: [3, 11] },
          { action: 'factor', productIndex: 0, factors: [4, 8] },
          { action: 'factor', productIndex: 0, factors: [-2, -17] },
          { action: 'factor', productIndex: 0, factors: [0, 0] },
          // Out of bounds product index
          { action: 'factor', productIndex: 10, factors: [2, 17] },
          { action: 'factor', productIndex: -1, factors: [2, 17] },
          // Arbitrary guardian assignments
          { action: 'assign', rune: 'Kimmy', factor: 99 },
          { action: 'assign', rune: 'Kimmy', factor: 0 },
          { action: 'assign', rune: 'InvalidRune', factor: 17 },
          // Unrecognized action
          { action: 'rotate_dials', degrees: 180 }
        ];

        for (const step of arbitrarySteps) {
          const { sessionId } = await advanceToCarryOut('ch1-n4-castle-keep', 'find-shared');
          const res = await postAction(sessionId, { type: 'step', step });
          assert.equal(res.status, 200, `Step failed with status ${res.status}: ${JSON.stringify(step)}`);
          assert.equal(res.data.ok, true);
          assert.equal(res.data.view.state, 'carry_out');
          const successEv = (res.data.events || []).find(e => e.type === 'step.success');
          assert.equal(successEv, undefined, 'Must not emit step.success for invalid/non-solution step');
        }
      });
    });
  });

  // ===========================================================================
  // 4. Client Wire Body Permutations & Edge Payloads
  // ===========================================================================
  describe('4. Client Wire Body Permutations & Edge Payloads', () => {
    it('safely handles deeply corrupted, empty, or unexpected action envelopes', async () => {
      const { sessionId } = await startSession('ch1-n1-reverse-tolls');

      const corruptedPayloads = [
        {},
        { action: null },
        { action: {} },
        { action: { type: 'unknown_action_type' } },
        { action: { type: '' } },
        { action: { type: 12345 } }
      ];

      for (const payload of corruptedPayloads) {
        const res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        // Server should return 400 Bad Request or 200 with no state corruption, never 500
        assert.ok(res.status === 200 || res.status === 400, `Expected 200 or 400, got ${res.status}`);
      }
    });
  });
});
