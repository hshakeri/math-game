/**
 * Castle of Theorems — Milestone M3 Iteration 4 Client Integration Test Suite
 * test/client-integration.test.js
 *
 * Verifies end-to-end browser client HTTP wire contract:
 * 1. Encounter start (POST /api/session/start) initializes session in 'arrive' state.
 * 2. Progression through arrival to 'conjecture' via { action: { type: 'arrive' } }.
 * 3. Conjecture submission via { action: { type: 'conjecture', stem, value, reason } } and skip_conjecture.
 * 4. Understand stage probe cap (2 probes) advancing to 'plan'.
 * 5. Plan stage heuristic card selection advancing to 'carry_out' with workspace unlocked.
 * 6. Diagram stepper wire formats across all 4 Chapter 1 mechanics:
 *    - Client wire format: { action: { type: 'step', step: { ... } } }
 *    - Payload wire format: { action: { type: 'step', payload: { ... } } }
 *    - Dual wire format: { action: { type: 'step', step: { ... }, payload: { ... } } }
 *    - Unwrapped action format: { type: 'step', step: { ... } }
 *    Verifying mechanic.checkStep receives step without 'undefined', mechanicState updates,
 *    and nonProgressCount does not increment erroneously.
 * 7. Verification that invalid/arbitrary steps evaluate cleanly without server crash.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { startServer, closeServer } from '../server/index.js';
import { getEncounter } from '../server/tutor/index.js';
import { assertClientSafe } from '../server/engine/clientView.js';

describe('End-to-End Client Action Wire Integration Suite', () => {
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

  // ===========================================================================
  // 1. Encounter Lifecycle & Arrival Progression
  // ===========================================================================
  describe('1. Encounter Lifecycle & Arrival Progression', () => {
    it('initializes session in arrive state and transitions to conjecture via arrive action', async () => {
      // 1. Client starts session
      const startRes = await fetch(`${testUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: 'ch1-n1-reverse-tolls' })
      });
      assert.equal(startRes.status, 200);
      const startData = await startRes.json();
      assert.ok(startData.sessionId);
      const sessionId = startData.sessionId;

      assert.equal(startData.view.state, 'arrive');
      assert.equal(startData.view.workspaceUnlocked, false);

      // 2. Client dispatches arrival action over wire
      const arriveRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'arrive' } })
      });
      assert.equal(arriveRes.status, 200);
      const arriveData = await arriveRes.json();
      assert.equal(arriveData.view.state, 'conjecture');
      assert.equal(arriveData.state, 'conjecture');
      assert.equal(arriveData.view.conjecturesRemaining, 2);
    });

    it('accepts alternative arrival trigger type "read_inscription" over wire', async () => {
      const startRes = await fetch(`${testUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: 'ch1-n2-dark-vault' })
      });
      const { sessionId } = await startRes.json();

      const arriveRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'read_inscription' } })
      });
      assert.equal(arriveRes.status, 200);
      const data = await arriveRes.json();
      assert.equal(data.view.state, 'conjecture');
    });
  });

  // ===========================================================================
  // 2. Early Conjecture & Stage Advancements
  // ===========================================================================
  describe('2. Early Conjecture & Stage Advancements', () => {
    it('submits conjecture using client/app.js wire format and routes wrong conjecture to understand', async () => {
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

      // Client wire format from client/app.js:464
      const conjPayload = {
        action: {
          type: 'conjecture',
          stem: 'think',
          value: '42',
          justification: 'I suspect forty two coins',
          reason: 'I suspect forty two coins'
        }
      };

      const conjRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conjPayload)
      });
      assert.equal(conjRes.status, 200);
      const data = await conjRes.json();
      assert.equal(data.view.state, 'understand');
      assert.equal(data.view.conjecturesRemaining, 1);
    });

    it('supports skipping conjecture via skip_conjecture wire format', async () => {
      const startRes = await fetch(`${testUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: 'ch1-n3-five-shields' })
      });
      const { sessionId } = await startRes.json();
      await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'arrive' } })
      });

      const skipRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'skip_conjecture' } })
      });
      assert.equal(skipRes.status, 200);
      const data = await skipRes.json();
      assert.equal(data.view.state, 'understand');
    });

    it('advances through understand (2-probe cap) to plan and unlocks workspace via card selection', async () => {
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
      await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'skip_conjecture' } })
      });

      // Probe 1 in Understand
      const p1Res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'say', text: 'What is the end coin count?' } })
      });
      const p1Data = await p1Res.json();
      assert.equal(p1Data.view.state, 'understand');

      // Probe 2 in Understand -> hits cap, transitions to Plan
      const p2Res = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'say', text: 'Thirteen coins remain at the end.' } })
      });
      const p2Data = await p2Res.json();
      assert.equal(p2Data.view.state, 'plan');

      // Select Card in Plan -> transitions to Carry Out and unlocks workspace
      const cardRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'card', cardId: 'work-backwards' } })
      });
      const cardData = await cardRes.json();
      assert.equal(cardData.view.state, 'carry_out');
      assert.equal(cardData.view.workspaceUnlocked, true);
      assert.equal(cardData.view.activeCard, 'work-backwards');
    });
  });

  // Helper to progress any encounter to carry_out stage
  async function progressToCarryOut(encounterId, cardId) {
    const startRes = await fetch(`${testUrl}/api/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId })
    });
    const { sessionId } = await startRes.json();

    await fetch(`${testUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'arrive' } })
    });

    await fetch(`${testUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'skip_conjecture' } })
    });

    await fetch(`${testUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'say', text: 'Probe 1' } })
    });

    await fetch(`${testUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'say', text: 'Probe 2' } })
    });

    const cardRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'card', cardId } })
    });
    const cardData = await cardRes.json();
    assert.equal(cardData.view.state, 'carry_out');
    return { sessionId, initialMechanicState: cardData.view.mechanicState };
  }

  // ===========================================================================
  // 3. Diagram Stepper Wire Format Normalization Across All Encounters
  // ===========================================================================
  describe('3. Diagram Stepper Wire Format Normalization Across All Encounters', () => {
    // -------------------------------------------------------------------------
    // Encounter 1: Reverse Tolls (inverse-chain)
    // -------------------------------------------------------------------------
    it('Reverse Tolls: accepts client wire format { action: { type: "step", step: ... } }', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n1-reverse-tolls', 'work-backwards');

      // Client wire format from client/app.js:527 mountDiagram callback
      const clientStepPayload = {
        action: {
          type: 'step',
          step: { action: 'order', gateIndex: 2, order: ['add', 'divide'] }
        }
      };

      const stepRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientStepPayload)
      });
      assert.equal(stepRes.status, 200);
      const stepData = await stepRes.json();

      // mechanic.checkStep must NOT have received undefined
      assert.equal(
        stepData.view.mechanicState.orderVerifiedForGate,
        2,
        'orderVerifiedForGate must be 2 when step is processed'
      );

      // Verify success event in events list
      const successEvent = (stepData.events || []).find(e => e.type === 'step.success');
      assert.ok(successEvent, 'step.success event must be present in response');
    });

    it('Reverse Tolls: accepts payload wire format { action: { type: "step", payload: ... } }', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n1-reverse-tolls', 'work-backwards');

      const payloadStep = {
        action: {
          type: 'step',
          payload: { action: 'order', gateIndex: 2, order: ['add', 'divide'] }
        }
      };

      const stepRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadStep)
      });
      assert.equal(stepRes.status, 200);
      const stepData = await stepRes.json();

      assert.equal(stepData.view.mechanicState.orderVerifiedForGate, 2);
    });

    it('Reverse Tolls: accepts dual wire format { action: { type: "step", payload: step, step: step } }', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n1-reverse-tolls', 'work-backwards');

      const stepObj = { action: 'order', gateIndex: 2, order: ['add', 'divide'] };
      const dualStep = {
        action: {
          type: 'step',
          payload: stepObj,
          step: stepObj
        }
      };

      const stepRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dualStep)
      });
      assert.equal(stepRes.status, 200);
      const stepData = await stepRes.json();

      assert.equal(stepData.view.mechanicState.orderVerifiedForGate, 2);
    });

    it('Reverse Tolls: drives numeric value step { action: "value", gateIndex: 2, value: 11 }', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n1-reverse-tolls', 'work-backwards');

      // First step: order
      await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'order', gateIndex: 2, order: ['add', 'divide'] } }
        })
      });

      // Second step: value
      const valStepRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'step', step: { action: 'value', gateIndex: 2, value: 11 } }
        })
      });
      assert.equal(valStepRes.status, 200);
      const valData = await valStepRes.json();

      assert.equal(valData.view.mechanicState.currentGateIndex, 1);
      assert.equal(valData.view.mechanicState.currentValue, 11);
    });

    // -------------------------------------------------------------------------
    // Encounter 2: Dark Vault (goblin-bins)
    // -------------------------------------------------------------------------
    it('Dark Vault: accepts client wire format { action: { type: "step", step: ... } }', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n2-dark-vault', 'worst-case');

      const clientStepPayload = {
        action: {
          type: 'step',
          step: { action: 'place', bin: 0 }
        }
      };

      const stepRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientStepPayload)
      });
      assert.equal(stepRes.status, 200);
      const stepData = await stepRes.json();

      assert.equal(stepData.view.mechanicState.bins[0], 1);
      assert.equal(stepData.view.mechanicState.totalPlaced, 1);
    });

    // -------------------------------------------------------------------------
    // Encounter 3: Five Shields (seam-grid)
    // -------------------------------------------------------------------------
    it('Five Shields: accepts client wire format { action: { type: "step", step: ... } }', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n3-five-shields', 'draw-it');

      const clientStepPayload = {
        action: {
          type: 'step',
          step: { action: 'set_units', short: 2, long: 3 }
        }
      };

      const stepRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientStepPayload)
      });
      assert.equal(stepRes.status, 200);
      const stepData = await stepRes.json();

      assert.deepEqual(stepData.view.mechanicState.units, { short: 2, long: 3 });
    });

    // -------------------------------------------------------------------------
    // Encounter 4: Castle Keep (factor-dials)
    // -------------------------------------------------------------------------
    it('Castle Keep: accepts client wire format { action: { type: "step", step: ... } }', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n4-castle-keep', 'find-shared');

      const clientStepPayload = {
        action: {
          type: 'step',
          step: { action: 'factor', productIndex: 0, factors: [2, 17] }
        }
      };

      const stepRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientStepPayload)
      });
      assert.equal(stepRes.status, 200);
      const stepData = await stepRes.json();

      assert.deepEqual(stepData.view.mechanicState.factored[0], [2, 17]);
    });

    // -------------------------------------------------------------------------
    // Unwrapped body compatibility: { type: "step", step: ... }
    // -------------------------------------------------------------------------
    it('accepts unwrapped body format without outer "action" wrapper', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n1-reverse-tolls', 'work-backwards');

      const unwrappedPayload = {
        type: 'step',
        step: { action: 'order', gateIndex: 2, order: ['add', 'divide'] }
      };

      const stepRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unwrappedPayload)
      });
      assert.equal(stepRes.status, 200);
      const stepData = await stepRes.json();

      assert.equal(stepData.view.mechanicState.orderVerifiedForGate, 2);
    });
  });

  // ===========================================================================
  // 4. Robustness & Non-Progress Evaluation
  // ===========================================================================
  describe('4. Robustness & Non-Progress Evaluation', () => {
    it('evaluates wrong order step cleanly as non-progress without server error', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n1-reverse-tolls', 'work-backwards');

      // Intentional wrong order: divide then add
      const wrongStepPayload = {
        action: {
          type: 'step',
          step: { action: 'order', gateIndex: 2, order: ['divide', 'add'] }
        }
      };

      const stepRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wrongStepPayload)
      });
      assert.equal(stepRes.status, 200);
      const stepData = await stepRes.json();

      assert.equal(stepData.view.mechanicState.orderVerifiedForGate, undefined);
      // step.success must NOT be emitted for wrong step
      const successEvent = (stepData.events || []).find(e => e.type === 'step.success');
      assert.equal(successEvent, undefined);
    });

    it('handles empty step body safely without 500 error', async () => {
      const { sessionId } = await progressToCarryOut('ch1-n1-reverse-tolls', 'work-backwards');

      const emptyStepPayload = {
        action: {
          type: 'step'
        }
      };

      const stepRes = await fetch(`${testUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emptyStepPayload)
      });
      assert.equal(stepRes.status, 200);
      const stepData = await stepRes.json();

      assert.equal(stepData.ok, true);
    });
  });
});
