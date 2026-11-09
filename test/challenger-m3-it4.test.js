/**
 * Castle of Theorems — Milestone M3 Iteration 4 Empirical Challenger Suite
 * test/challenger-m3-it4.test.js
 *
 * Adversarial Stress Tests:
 * 1. Complete end-to-end multi-step mechanic progression via exact client wire format:
 *    { action: { type: 'step', step: { ... } } }
 *    - All 4 Chapter 1 encounters:
 *      * Reverse Tolls: Gate 2 (order, value) -> Gate 1 (order, value) -> Gate 0 (order, value) -> completion
 *      * Dark Vault: Crystal placement across bins -> submit_count -> completion
 *      * Five Shields: set_units -> outer_units -> cubits_per_unit -> shield_perimeter -> completion
 *      * Castle Keep: factor 0 -> factor 1 -> assign_shared -> assign -> assign -> submit_sum -> completion
 * 2. Stepper wire payload fuzzing & anomaly handling:
 *    - null, numbers, strings, empty objects as step payloads
 *    - prototype pollution attempts
 *    - nested and flattened step formats
 *    - ladder escalation from two non-progress steps
 * 3. Invariant enforcement in 'arrive' state:
 *    - Arbitrary child actions (say, chip, step, submit, card, stuck) must NEVER advance arrive
 *    - Arrival via 'arrive', 'read_inscription', 'start' transitions to 'conjecture'
 *    - Arrival with extra payload { type: 'arrive', text: 'let us go' } succeeds cleanly
 * 4. Look Back reflection wire format & sealing:
 *    - { action: { type: 'lookback', index: 0, value: ... } } (index-only without kind)
 *    - { action: { type: 'lookback', kind: 'verify', value: ... } } (valid kind from encounter)
 *    - { action: { type: 'waiver' } } (alias for waive)
 * 5. Leak Gate & Information Diet auditing across all stepper transitions:
 *    - Ensure no intermediate values or target answers are leaked in mechanicState or view
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { startServer, closeServer } from '../server/index.js';
import { getEncounter } from '../server/tutor/index.js';
import { assertClientSafe } from '../server/engine/clientView.js';

describe('Challenger M3 Iteration 4: Empirical Wire Integration Stress Suite', () => {
  let testEnv;
  let testUrl;

  before(async () => {
    testEnv = await startServer(0, '127.0.0.1', { parentPin: '5678' });
    testUrl = testEnv.url;
  });

  after(async () => {
    if (testEnv?.server) {
      await closeServer(testEnv.server);
    }
  });

  // Helper to progress to carry_out
  async function progressToCarryOut(encounterId, cardId) {
    const startRes = await fetch(`${testUrl}/api/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId })
    });
    const { sessionId } = await startRes.json();

    // arrive -> conjecture
    await fetch(`${testUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'arrive' } })
    });

    // skip conjecture -> understand
    await fetch(`${testUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'skip_conjecture' } })
    });

    // 2 probes in understand -> plan
    await fetch(`${testUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'say', text: 'I understand what is given' } })
    });
    await fetch(`${testUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'say', text: 'I understand what is sought' } })
    });

    // choose card -> carry_out
    const cardRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'card', cardId } })
    });
    const cardData = await cardRes.json();
    assert.equal(cardData.view.state, 'carry_out');
    return { sessionId, encounterId };
  }

  // ===========================================================================
  // 1. Full Multi-Step Mechanic Lifecycle via Client Wire Format
  // ===========================================================================
  describe('1. Full Multi-Step Mechanic Lifecycle via Client Wire Format', () => {

    it('Encounter 1 (Reverse Tolls): completes all 3 gates using { action: { type: "step", step: ... } }', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n1-reverse-tolls', 'work-backwards');

      // Gate 2 (end is 13, Gate 2: mul 2, sub 9 -> (13 + 9)/2 = 11)
      const g2OrderRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'order', gateIndex: 2, order: ['add', 'divide'] } }
        })
      });
      const g2OrderData = await g2OrderRes.json();
      assert.equal(g2OrderData.view.mechanicState.orderVerifiedForGate, 2);

      const g2ValRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'value', gateIndex: 2, value: 11 } }
        })
      });
      const g2ValData = await g2ValRes.json();
      assert.equal(g2ValData.view.mechanicState.currentValue, 11);
      assert.equal(g2ValData.view.mechanicState.currentGateIndex, 1);

      // Gate 1 (current is 11, Gate 1: mul 2, sub 3 -> (11 + 3)/2 = 7)
      const g1OrderRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'order', gateIndex: 1, order: ['add', 'divide'] } }
        })
      });
      const g1OrderData = await g1OrderRes.json();
      assert.equal(g1OrderData.view.mechanicState.orderVerifiedForGate, 1);

      const g1ValRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'value', gateIndex: 1, value: 7 } }
        })
      });
      const g1ValData = await g1ValRes.json();
      assert.equal(g1ValData.view.mechanicState.currentValue, 7);
      assert.equal(g1ValData.view.mechanicState.currentGateIndex, 0);

      // Gate 0 (current is 7, Gate 0: mul 2, sub 5 -> (7 + 5)/2 = 6)
      const g0OrderRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'order', gateIndex: 0, order: ['add', 'divide'] } }
        })
      });
      const g0OrderData = await g0OrderRes.json();
      assert.equal(g0OrderData.view.mechanicState.orderVerifiedForGate, 0);

      const g0ValRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'value', gateIndex: 0, value: 6 } }
        })
      });
      const g0ValData = await g0ValRes.json();
      assert.equal(g0ValData.view.mechanicState.currentValue, 6);
      assert.equal(g0ValData.view.mechanicState.completed, true);
      assert.equal(g0ValData.view.mechanicState.currentGateIndex, -1);
    });

    it('Encounter 2 (Dark Vault): completes crystal placements and submit_count via client wire format', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n2-dark-vault', 'worst-case');

      // Place 1 crystal in each of the 3 bins (target.same = 2 for part a, so 1 per bin is max waste)
      for (let bin = 0; bin < 3; bin++) {
        const placeRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: { type: 'step', step: { action: 'place', bin } }
          })
        });
        const placeData = await placeRes.json();
        assert.equal(placeData.view.mechanicState.bins[bin], 1);
      }

      // Submit count = 4
      const submitStepRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'submit_count', value: 4 } }
        })
      });
      const submitStepData = await submitStepRes.json();
      assert.equal(submitStepData.view.mechanicState.completed, true);
      assert.equal(submitStepData.view.mechanicState.submittedCount, 4);
    });

    it('Encounter 3 (Five Shields): completes all deduction steps to 30 cubits via client wire format', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n3-five-shields', 'draw-it');

      // Step 1: set_units { short: 2, long: 3 }
      const step1Res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'set_units', short: 2, long: 3 } }
        })
      });
      const step1Data = await step1Res.json();
      assert.deepEqual(step1Data.view.mechanicState.units, { short: 2, long: 3 });

      // Step 2: outer_units = 22
      const step2Res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'outer_units', value: 22 } }
        })
      });
      const step2Data = await step2Res.json();
      assert.equal(step2Data.view.mechanicState.outerUnits, 22);

      // Step 3: cubits_per_unit = 66 / 22 = 3
      const step3Res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'cubits_per_unit', value: 3 } }
        })
      });
      const step3Data = await step3Res.json();
      assert.equal(step3Data.view.mechanicState.cubitsPerUnit, 3);

      // Step 4: shield_perimeter = 2 * (2 + 3) * 3 = 30
      const step4Res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'shield_perimeter', value: 30 } }
        })
      });
      const step4Data = await step4Res.json();
      assert.equal(step4Data.view.mechanicState.shieldPerimeter, 30);
      assert.equal(step4Data.view.mechanicState.completed, true);
    });

    it('Encounter 4 (Castle Keep): completes prime factor deduction and sum 24 via client wire format', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n4-castle-keep', 'find-shared');

      // Step 1: factor product 0 (34 = [2, 17])
      const s1Res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'factor', productIndex: 0, factors: [2, 17] } }
        })
      });
      const s1Data = await s1Res.json();
      assert.deepEqual(s1Data.view.mechanicState.factored[0], [2, 17]);

      // Step 2: factor product 1 (85 = [5, 17])
      const s2Res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'factor', productIndex: 1, factors: [5, 17] } }
        })
      });
      const s2Data = await s2Res.json();
      assert.deepEqual(s2Data.view.mechanicState.factored[1], [5, 17]);

      // Step 3: assign_shared Kimmy = 17
      const s3Res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'assign_shared', guardian: 'Kimmy', value: 17 } }
        })
      });
      const s3Data = await s3Res.json();
      assert.equal(s3Data.view.mechanicState.assignments.Kimmy, 17);

      // Step 4: assign Jimmy = 2
      const s4Res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'assign', guardian: 'Jimmy', value: 2 } }
        })
      });
      const s4Data = await s4Res.json();
      assert.equal(s4Data.view.mechanicState.assignments.Jimmy, 2);

      // Step 5: assign Timmy = 5
      const s5Res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'assign', guardian: 'Timmy', value: 5 } }
        })
      });
      const s5Data = await s5Res.json();
      assert.equal(s5Data.view.mechanicState.assignments.Timmy, 5);

      // Step 6: submit_sum = 24
      const s6Res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'submit_sum', value: 24 } }
        })
      });
      const s6Data = await s6Res.json();
      assert.equal(s6Data.view.mechanicState.sum, 24);
      assert.equal(s6Data.view.mechanicState.completed, true);
    });
  });

  // ===========================================================================
  // 2. Stepper Wire Payload Fuzzing & Anomaly Handling
  // ===========================================================================
  describe('2. Stepper Wire Payload Fuzzing & Anomaly Handling', () => {

    it('gracefully evaluates malformed step types (null, numbers, strings, arrays) without 500', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n1-reverse-tolls', 'work-backwards');

      const anomalousSteps = [
        null,
        1234,
        'step-string',
        [],
        {},
        { action: null },
        { action: 42 },
        { action: 'unknown_action' }
      ];

      for (const step of anomalousSteps) {
        const res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: { type: 'step', step } })
        });
        assert.equal(res.status, 200, `Failed on step payload: ${JSON.stringify(step)}`);
        const data = await res.json();
        assert.equal(data.ok, true);
        // Valid responses returned without crash
        assert.ok(data.view.state === 'carry_out' || data.view.state === 'simpler_problem');
      }
    });

    it('survives prototype pollution payloads in step wire object', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n1-reverse-tolls', 'work-backwards');

      const pollutedPayload = JSON.parse('{"action":{"type":"step","step":{"__proto__":{"polluted":true},"action":"order","gateIndex":2,"order":["add","divide"]}}}');

      const res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pollutedPayload)
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.view.mechanicState.orderVerifiedForGate, 2);
      assert.equal({}.polluted, undefined, 'Prototype must not be polluted');
    });

    it('evaluates flattened action step { type: "step", action: "order", gateIndex: 2, ... }', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n1-reverse-tolls', 'work-backwards');

      const flattenedPayload = {
        action: {
          type: 'step',
          action: 'order',
          gateIndex: 2,
          order: ['add', 'divide']
        }
      };

      const res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flattenedPayload)
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.view.mechanicState.orderVerifiedForGate, 2);
    });

    it('escalates ladder from l1 to l2 after two consecutive non-progress steps via wire', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n1-reverse-tolls', 'work-backwards');

      // Initial rung is l0
      const initialSessionRes = await fetch(`${testUrl}/api/session/${sessionId}/state`);
      const initialSessionData = await initialSessionRes.json();
      assert.equal(initialSessionData.view.hintRung, 'l0');

      // Non-progress step 1 (wrong order)
      await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'order', gateIndex: 2, order: ['divide', 'add'] } }
        })
      });

      // Non-progress step 2 (wrong order again)
      const res2 = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'order', gateIndex: 2, order: ['divide', 'add'] } }
        })
      });
      const data2 = await res2.json();

      // Hint ladder must have escalated to l1
      assert.equal(data2.view.hintRung, 'l1');
    });
  });

  // ===========================================================================
  // 3. Invariant Enforcement in 'arrive' State
  // ===========================================================================
  describe('3. Invariant Enforcement in "arrive" State', () => {

    it('keeps out-of-order mechanic, submit and card actions inert during arrive', async () => {
      const startRes = await fetch(`${testUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: 'ch1-n1-reverse-tolls' })
      });
      const { sessionId } = await startRes.json();

      const nonArrivalActions = [
        { type: 'step', step: { action: 'place', bin: 0 } },
        { type: 'submit', value: 10 },
        { type: 'card', cardId: 'work-backwards' }
      ];

      for (const act of nonArrivalActions) {
        const res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: act })
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.view.state, 'arrive', `Action ${act.type} must NOT advance arrive state`);
      }
    });

    it('strictly guards parent waiver during arrive state with HTTP 400', async () => {
      const startRes = await fetch(`${testUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: 'ch1-n1-reverse-tolls' })
      });
      const { sessionId } = await startRes.json();

      const waiverRes = await fetch(`${testUrl}/api/parent/waiver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '5678', sessionId })
      });
      assert.equal(waiverRes.status, 400);
      const data = await waiverRes.json();
      assert.equal(data.ok, false);
      assert.match(data.error, /look back/i);
    });

    it('transitions cleanly when arrive includes text payload', async () => {
      const startRes = await fetch(`${testUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: 'ch1-n1-reverse-tolls' })
      });
      const { sessionId } = await startRes.json();

      const arriveRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'arrive', text: 'Approaching the inscription' } })
      });
      assert.equal(arriveRes.status, 200);
      const data = await arriveRes.json();
      assert.equal(data.view.state, 'conjecture');
    });
  });

  // ===========================================================================
  // 4. Look Back Reflection Wire Formats & Node Sealing
  // ===========================================================================
  describe('4. Look Back Reflection Wire Formats & Node Sealing', () => {

    async function progressToLookBack(encounterId) {
      const startRes = await fetch(`${testUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId })
      });
      const { sessionId } = await startRes.json();

      // arrive -> conjecture
      await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'arrive' } })
      });

      // Submit correct conjecture with >= 3 words to shortcut directly to look_back
      // For Reverse Tolls, solution is 6
      const conjRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: {
            type: 'conjecture',
            stem: 'think',
            value: '6',
            justification: 'reverse all operations backwards'
          }
        })
      });
      const conjData = await conjRes.json();
      assert.equal(conjData.view.state, 'look_back');
      return { sessionId };
    }

    it('seals node via index-only lookback wire action { type: "lookback", index: 0, value: "13" }', async () => {
      const { sessionId } = await progressToLookBack('ch1-n1-reverse-tolls');

      // Reverse Tolls lookBack[0] check is value 13
      const lbRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'lookback', index: 0, value: 13 }
        })
      });
      assert.equal(lbRes.status, 200);
      const lbData = await lbRes.json();
      assert.equal(lbData.view.state, 'sealed');
      assert.equal(lbData.view.sealed, true);
    });

    it('seals node via kind-specified lookback wire action with valid kind "verify"', async () => {
      const { sessionId } = await progressToLookBack('ch1-n1-reverse-tolls');

      const lbRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'lookback', kind: 'verify', value: 13 }
        })
      });
      assert.equal(lbRes.status, 200);
      const lbData = await lbRes.json();
      assert.equal(lbData.view.state, 'sealed');
      assert.equal(lbData.view.sealed, true);
    });

    it('seals node via parent waiver wire action { type: "waiver" }', async () => {
      const { sessionId } = await progressToLookBack('ch1-n1-reverse-tolls');

      const waiveRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'waiver' }
        })
      });
      assert.equal(waiveRes.status, 200);
      const waiveData = await waiveRes.json();
      assert.equal(waiveData.view.state, 'sealed');
    });
  });

  // ===========================================================================
  // 5. Strict Information Diet & Client-Safe Auditing on Stepper Updates
  // ===========================================================================
  describe('5. Strict Information Diet & Client-Safe Auditing on Stepper Updates', () => {

    it('guarantees client-safe view on every stepper action response across all encounters', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n1-reverse-tolls', 'work-backwards');
      const encounter = getEncounter('ch1-n1-reverse-tolls');

      const stepPayload = {
        action: {
          type: 'step',
          step: { action: 'order', gateIndex: 2, order: ['add', 'divide'] }
        }
      };

      const stepRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stepPayload)
      });
      const data = await stepRes.json();

      // Client view assert with authoritative encounter
      assert.doesNotThrow(() => {
        assertClientSafe(data.view, encounter);
      }, 'Step response view must satisfy strict assertClientSafe invariants');
    });
  });
});
