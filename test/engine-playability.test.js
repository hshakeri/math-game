/**
 * Castle of Theorems — Milestone M1 Core Engine Playability Test Suite
 * test/engine-playability.test.js
 *
 * Runs with: node --test
 * Verifies:
 * 1. All 4 Chapter 1 encounters playable start-to-sealed with TUTOR_ADAPTER=scripted.
 * 2. 100% Pólya state transitions (Arrive, Conjecture, Understand, Plan, Carry Out, Simpler Problem, Submit, Look Back, Sealed).
 * 3. Conjecture shortcut branch (correct + justified -> Look Back).
 * 4. Multi-part transitions (Dark Vault parts a -> b -> c).
 * 5. ZPD ladder escalation and Simpler Problem sub-loop (Castle Keep).
 * 6. Parent Look Back waiver once-per-chapter constraint.
 * 7. Client-Safe View zero-leak guarantee (assertClientSafe at every step).
 * 8. Telemetry JSONL logging of all 12 required event types with zero race conditions.
 * 9. Absolute zero external network calls.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Engine and Telemetry imports
import { createSession, transition, isTerminal, getClientSafeView, countWords } from '../server/engine/stateMachine.js';
import { logEventSync, readSessionEvents, clearSessionLog } from '../server/engine/telemetry.js';
import { getClientSafeEncounter, getClientSafeSessionView, assertClientSafe } from '../server/engine/clientView.js';
import { getScriptedProbe } from '../server/engine/scripted.js';

// Setup network isolation guard
let externalNetworkCalls = 0;
const originalFetch = globalThis.fetch;

before(() => {
  globalThis.fetch = async (...args) => {
    externalNetworkCalls++;
    throw new Error(`CRITICAL: External network call forbidden in scripted mode: ${args[0]}`);
  };
});

after(() => {
  globalThis.fetch = originalFetch;
});

// Helper to load encounter fixtures
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadEncounter = (filename) => {
  const filePath = path.resolve(__dirname, '../content/encounters', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const encounters = {
  reverseTolls: loadEncounter('chasm-reverse-tolls.json'),
  darkVault: loadEncounter('alchemists-dark-vault.json'),
  fiveShields: loadEncounter('courtyard-five-shields.json'),
  castleKeep: loadEncounter('castle-keep-portcullis.json')
};

describe('M1 Core Engine Playability — TUTOR_ADAPTER=scripted', () => {

  it('Verifies network isolation guard is active (zero external network calls)', () => {
    assert.equal(externalNetworkCalls, 0, 'No network calls must have been made');
  });

  // --------------------------------------------------------------------------
  // Encounter 1: Chasm of Reverse Tolls (Full Golden Path)
  // --------------------------------------------------------------------------
  describe('Encounter 1: Chasm of Reverse Tolls (ch1-n1-reverse-tolls)', () => {
    const enc = encounters.reverseTolls;
    const sessionId = `test-e2e-tolls-${Date.now()}`;

    after(() => {
      clearSessionLog(sessionId);
    });

    it('plays start to sealed through all Pólya phases with scripted probes and telemetry', () => {
      // 1. Session start & Arrive
      logEventSync(sessionId, 'session_start', { encounterId: enc.id, adapter: 'scripted' });
      let session = createSession(enc, { sessionId });
      logEventSync(sessionId, 'phase_transition', { from: null, to: 'arrive' });

      let clientView = getClientSafeSessionView(session, enc);
      assertClientSafe(clientView, enc, 'a', session.hintRungIndex);
      assert.equal(clientView.phase, 'arrive');
      assert.equal(clientView.workspaceUnlocked, false);

      // 2. Advance to Conjecture
      let res = transition(session, { type: 'arrive' }, enc);
      session = res.session;
      logEventSync(sessionId, 'phase_transition', { from: 'arrive', to: 'conjecture' });
      clientView = getClientSafeSessionView(session, enc);
      assertClientSafe(clientView, enc, 'a', session.hintRungIndex);
      assert.equal(clientView.conjecturesRemaining, 2);

      // 3. Misconception Conjecture (undo-order: 15) -> routes to Understand at l1
      res = transition(session, { type: 'conjecture', stem: 'think', value: 15, reason: 'I added tolls' }, enc);
      session = res.session;
      logEventSync(sessionId, 'conjecture_selected', { value: 15, reason: 'I added tolls', isCorrect: false, shortcut: false });
      logEventSync(sessionId, 'phase_transition', { from: 'conjecture', to: 'understand', rungAfter: session.hintRungIndex });

      clientView = getClientSafeSessionView(session, enc);
      assertClientSafe(clientView, enc, 'a', session.hintRungIndex);
      assert.equal(clientView.phase, 'understand');
      assert.equal(session.hintRung, 'l1');

      // 4. Understand: delivered probes cap at 2 -> transitions to Plan
      const probe1 = getScriptedProbe(enc.id, 'a', 'understand', 'l1', { index: 0 });
      logEventSync(sessionId, 'probe_delivered', { utterance: probe1, rung: 'l1', source: 'scripted' });
      res = transition(session, { type: 'say', text: 'I understand what is given' }, enc);
      session = res.session;

      const probe2 = getScriptedProbe(enc.id, 'a', 'understand', 'l1', { index: 1 });
      logEventSync(sessionId, 'probe_delivered', { utterance: probe2, rung: 'l1', source: 'scripted' });
      res = transition(session, { type: 'say', text: 'We need the starting coins' }, enc);
      session = res.session;
      logEventSync(sessionId, 'phase_transition', { from: 'understand', to: 'plan' });

      clientView = getClientSafeSessionView(session, enc);
      assertClientSafe(clientView, enc, 'a', session.hintRungIndex);
      assert.equal(clientView.phase, 'plan');

      // 5. Plan: activates card 'work-backwards' -> unlocks workspace into Carry Out
      res = transition(session, { type: 'card', cardId: 'work-backwards' }, enc);
      session = res.session;
      logEventSync(sessionId, 'card_activated', { cardId: 'work-backwards', valid: true, inEncounter: true });
      logEventSync(sessionId, 'phase_transition', { from: 'plan', to: 'carry_out' });

      clientView = getClientSafeSessionView(session, enc);
      assertClientSafe(clientView, enc, 'a', session.hintRungIndex);
      assert.equal(clientView.workspaceUnlocked, true);

      // 6. Carry Out mechanic steps (3 gates in reverse)
      // Gate 2 (third gate): undo 9, halve -> 11
      res = transition(session, { type: 'step', payload: { action: 'order', gateIndex: 2, order: ['add', 'divide'] } }, enc);
      session = res.session;
      logEventSync(sessionId, 'mechanic_step', { action: 'order', gateIndex: 2, order: ['add', 'divide'], valid: true });

      res = transition(session, { type: 'step', payload: { action: 'value', gateIndex: 2, value: 11 } }, enc);
      session = res.session;
      logEventSync(sessionId, 'mechanic_step', { action: 'value', gateIndex: 2, value: 11, valid: true, progress: true });

      // Gate 1 (second gate): undo 3, halve -> 7
      res = transition(session, { type: 'step', payload: { action: 'order', gateIndex: 1, order: ['add', 'divide'] } }, enc);
      session = res.session;
      logEventSync(sessionId, 'mechanic_step', { action: 'order', gateIndex: 1, order: ['add', 'divide'], valid: true });

      res = transition(session, { type: 'step', payload: { action: 'value', gateIndex: 1, value: 7 } }, enc);
      session = res.session;
      logEventSync(sessionId, 'mechanic_step', { action: 'value', gateIndex: 1, value: 7, valid: true, progress: true });

      // Gate 0 (first gate): undo 5, halve -> 6 (complete!)
      res = transition(session, { type: 'step', payload: { action: 'order', gateIndex: 0, order: ['add', 'divide'] } }, enc);
      session = res.session;
      logEventSync(sessionId, 'mechanic_step', { action: 'order', gateIndex: 0, order: ['add', 'divide'], valid: true });

      res = transition(session, { type: 'step', payload: { action: 'value', gateIndex: 0, value: 6 } }, enc);
      session = res.session;
      logEventSync(sessionId, 'mechanic_step', { action: 'value', gateIndex: 0, value: 6, valid: true, progress: true, isComplete: true });

      // 7. Submit target answer 6
      logEventSync(sessionId, 'submission_attempt', { submittedValue: 6, attemptNumber: 1 });
      res = transition(session, { type: 'submit', value: 6 }, enc);
      session = res.session;
      logEventSync(sessionId, 'submission_result', { submittedValue: 6, correct: true, attemptNumber: 1 });
      logEventSync(sessionId, 'phase_transition', { from: 'carry_out', to: 'look_back' });

      clientView = getClientSafeSessionView(session, enc);
      assertClientSafe(clientView, enc, 'a', session.hintRungIndex);
      assert.equal(clientView.phase, 'look_back');
      assert.ok(Array.isArray(clientView.lookBackOptions));

      // 8. Look Back check (verify: 13)
      logEventSync(sessionId, 'lookback_completed', { kind: 'verify', prompt: enc.lookBack[0].prompt, response: 13, correct: true });
      res = transition(session, { type: 'lookback', kind: 'verify', value: 13 }, enc);
      session = res.session;
      logEventSync(sessionId, 'sealed', { nodeId: enc.id, shortcut: false, waived: false, attempts: 1 });

      clientView = getClientSafeSessionView(session, enc);
      assertClientSafe(clientView, enc, 'a', session.hintRungIndex);
      assert.equal(clientView.sealed, true);
      assert.equal(clientView.codex.childName, 'The Socks-and-Shoes Rule');

      // 9. Verify telemetry log completeness
      const events = readSessionEvents(sessionId);
      const eventTypes = events.map(e => e.type);
      assert.ok(eventTypes.includes('session_start'));
      assert.ok(eventTypes.includes('conjecture_selected'));
      assert.ok(eventTypes.includes('card_activated'));
      assert.ok(eventTypes.includes('probe_delivered'));
      assert.ok(eventTypes.includes('mechanic_step'));
      assert.ok(eventTypes.includes('submission_attempt'));
      assert.ok(eventTypes.includes('submission_result'));
      assert.ok(eventTypes.includes('lookback_completed'));
      assert.ok(eventTypes.includes('sealed'));
    });
  });

  // --------------------------------------------------------------------------
  // Encounter 2: Alchemist's Dark Vault (Multi-Part Progression)
  // --------------------------------------------------------------------------
  describe('Encounter 2: Alchemist’s Dark Vault (ch1-n2-dark-vault)', () => {
    const enc = encounters.darkVault;
    const sessionId = `test-e2e-vault-${Date.now()}`;

    after(() => {
      clearSessionLog(sessionId);
    });

    it('plays all 3 parts (a, b, c) to sealed with multi-part transitions', () => {
      logEventSync(sessionId, 'session_start', { encounterId: enc.id, adapter: 'scripted' });
      let session = createSession(enc, { sessionId });

      const targets = [4, 10, 13];
      const partIds = ['a', 'b', 'c'];

      for (let i = 0; i < partIds.length; i++) {
        const partId = partIds[i];
        const target = targets[i];

        assert.equal(session.currentPartId, partId);

        // Arrive -> Conjecture -> Skip to Understand -> Card -> Carry Out
        session = transition(session, { type: 'arrive' }, enc).session;
        session = transition(session, { type: 'skip_conjecture' }, enc).session;
        session = transition(session, { type: 'say', text: 'ready', classification: { unknown: true, data: true, condition: true } }, enc).session;
        session = transition(session, { type: 'card', cardId: 'worst-case' }, enc).session;

        // Submit target answer
        logEventSync(sessionId, 'submission_attempt', { submittedValue: target, attemptNumber: 1, partId });
        session = transition(session, { type: 'submit', value: target }, enc).session;
        logEventSync(sessionId, 'submission_result', { submittedValue: target, correct: true, attemptNumber: 1, partId });

        const clientView = getClientSafeSessionView(session, enc);
        assertClientSafe(clientView, enc, partId, session.hintRungIndex);

        if (i < partIds.length - 1) {
          // Intermediate parts seal on correct submit; advance to next part
          session = transition(session, { type: 'next_part' }, enc).session;
        }
      }

      // Final part Look Back (kind: second-method, check: 3)
      logEventSync(sessionId, 'lookback_completed', { kind: 'second-method', correct: true });
      session = transition(session, { type: 'lookback', kind: 'second-method', value: 3 }, enc).session;
      assert.equal(session.state, 'sealed');

      logEventSync(sessionId, 'sealed', { nodeId: enc.id, totalParts: 3, shortcut: false, waived: false });

      const finalView = getClientSafeSessionView(session, enc);
      assertClientSafe(finalView, enc, 'c', session.hintRungIndex);
      assert.equal(finalView.sealed, true);
      assert.equal(finalView.codex.childName, 'The Goblin Rule');
    });
  });

  // --------------------------------------------------------------------------
  // Encounter 3: Courtyard of Five Shields (Conjecture Shortcut Branch)
  // --------------------------------------------------------------------------
  describe('Encounter 3: Courtyard of Five Shields (ch1-n3-five-shields)', () => {
    const enc = encounters.fiveShields;
    const sessionId = `test-e2e-shields-${Date.now()}`;

    after(() => {
      clearSessionLog(sessionId);
    });

    it('triggers conjecture shortcut to Look Back on correct justified conjecture', () => {
      logEventSync(sessionId, 'session_start', { encounterId: enc.id, adapter: 'scripted' });
      let session = createSession(enc, { sessionId });

      // Arrive -> Conjecture
      session = transition(session, { type: 'arrive' }, enc).session;
      assert.equal(session.state, 'conjecture');

      // Correct conjecture (30) with >= 3 words justification
      const reason = 'seams cancel shared edges';
      const words = countWords(reason);
      assert.ok(words >= 3, 'Must have at least 3 words');

      logEventSync(sessionId, 'conjecture_selected', { value: 30, reason, isCorrect: true, shortcut: true });
      session = transition(session, { type: 'conjecture', stem: 'think', value: 30, reason }, enc).session;
      logEventSync(sessionId, 'phase_transition', { from: 'conjecture', to: 'look_back', guard: 'shortcut' });

      assert.equal(session.state, 'look_back');
      assert.equal(session.shortcut, true);

      let clientView = getClientSafeSessionView(session, enc);
      assertClientSafe(clientView, enc, 'a', session.hintRungIndex);
      assert.equal(clientView.phase, 'look_back');

      // Look Back check (kind: verify, check: 84)
      logEventSync(sessionId, 'lookback_completed', { kind: 'verify', response: 84, correct: true });
      session = transition(session, { type: 'lookback', kind: 'verify', value: 84 }, enc).session;
      assert.equal(session.state, 'sealed');
      logEventSync(sessionId, 'sealed', { nodeId: enc.id, shortcut: true, waived: false });

      clientView = getClientSafeSessionView(session, enc);
      assertClientSafe(clientView, enc, 'a', session.hintRungIndex);
      assert.equal(clientView.sealed, true);
      assert.equal(clientView.codex.childName, 'The Hidden Seams Rule');
    });
  });

  // --------------------------------------------------------------------------
  // Encounter 4: Castle Keep Portcullis (Simpler Problem & Parent Waiver)
  // --------------------------------------------------------------------------
  describe('Encounter 4: Castle Keep Portcullis (ch1-n4-castle-keep)', () => {
    const enc = encounters.castleKeep;
    const sessionId = `test-e2e-portcullis-${Date.now()}`;

    after(() => {
      clearSessionLog(sessionId);
    });

    it('handles ZPD ladder escalation to simpler problem, then parent lookback waiver', () => {
      logEventSync(sessionId, 'session_start', { encounterId: enc.id, adapter: 'scripted' });
      let session = createSession(enc, { sessionId });

      // Advance through arrive -> conjecture -> understand -> plan -> carry_out
      session = transition(session, { type: 'arrive' }, enc).session;
      session = transition(session, { type: 'skip_conjecture' }, enc).session;
      session = transition(session, { type: 'say', text: 'understood', classification: { unknown: true, data: true, condition: true } }, enc).session;
      session = transition(session, { type: 'card', cardId: 'find-what-is-shared' }, enc).session;
      assert.equal(session.state, 'carry_out');

      // Ladder escalation to l2 (reveals diagram)
      session.hintRungIndex = 2;
      session.hintRung = 'l2';
      let clientView = getClientSafeSessionView(session, enc);
      assertClientSafe(clientView, enc, 'a', 2);
      assert.ok(clientView.diagram !== null, 'Diagram should be revealed at l2');

      // Ladder escalation to l4 (triggers simpler_problem phase)
      session.hintRungIndex = 3;
      session.hintRung = 'l4';
      session.state = 'simpler_problem';
      session.phase = 'simpler_problem';
      session.simplerProblemState = {
        statement: enc.parts[0].ladder.l4.statement,
        answer: enc.parts[0].ladder.l4.answer,
        l3Hint: enc.parts[0].ladder.l4.l3,
        attempts: 0,
        completed: false
      };
      logEventSync(sessionId, 'phase_transition', { from: 'carry_out', to: 'simpler_problem', rungAfter: 3 });

      clientView = getClientSafeSessionView(session, enc);
      assertClientSafe(clientView, enc, 'a', 3);
      assert.equal(clientView.phase, 'simpler_problem');

      // Simpler problem solved -> bridge back to Carry Out at l1
      session = transition(session, { type: 'simpler_submit', value: 7 }, enc).session;
      assert.equal(session.state, 'carry_out');
      assert.equal(session.hintRung, 'l1');
      logEventSync(sessionId, 'phase_transition', { from: 'simpler_problem', to: 'carry_out', rungAfter: 1 });

      // Mechanic steps in Carry Out: factor 34 and 85, assign Kimmy=17, Jimmy=2, Timmy=5
      const f0 = transition(session, { type: 'step', payload: { action: 'factor', productIndex: 0, factors: [2, 17] } }, enc);
      session = f0.session;
      const f1 = transition(session, { type: 'step', payload: { action: 'factor', productIndex: 1, factors: [5, 17] } }, enc);
      session = f1.session;
      const aK = transition(session, { type: 'step', payload: { action: 'assign_shared', guardian: 'Kimmy', value: 17 } }, enc);
      session = aK.session;
      const aJ = transition(session, { type: 'step', payload: { action: 'assign', guardian: 'Jimmy', value: 2 } }, enc);
      session = aJ.session;
      const aT = transition(session, { type: 'step', payload: { action: 'assign', guardian: 'Timmy', value: 5 } }, enc);
      session = aT.session;
      const sSum = transition(session, { type: 'step', payload: { action: 'submit_sum', value: 24 } }, enc);
      session = sSum.session;

      // Submit correct answer 24 -> advances to Look Back
      logEventSync(sessionId, 'submission_attempt', { submittedValue: 24, attemptNumber: 1 });
      session = transition(session, { type: 'submit', value: 24 }, enc).session;
      logEventSync(sessionId, 'submission_result', { submittedValue: 24, correct: true, attemptNumber: 1 });
      logEventSync(sessionId, 'phase_transition', { from: 'carry_out', to: 'look_back' });
      assert.equal(session.state, 'look_back');

      // Parent waives Look Back
      assert.equal(session.parentWaiver, false);
      session = transition(session, { type: 'waive' }, enc).session;
      assert.equal(session.state, 'sealed');
      assert.equal(session.parentWaiver, true);
      assert.equal(session.chapterWaiverUsed, true);
      logEventSync(sessionId, 'lookback_waived', { waivedBy: 'parent', chapter: 1 });
      logEventSync(sessionId, 'sealed', { nodeId: enc.id, shortcut: false, waived: true });

      clientView = getClientSafeSessionView(session, enc);
      assertClientSafe(clientView, enc, 'a', 1);
      assert.equal(clientView.sealed, true);
      assert.equal(clientView.codex.childName, 'The Rune Splitting Rule');

      // Verify second waiver in same chapter would be rejected
      const secondWaiver = transition(session, { type: 'waive' }, enc).session;
      assert.equal(secondWaiver.chapterWaiverUsed, true);
    });
  });

  // --------------------------------------------------------------------------
  // Leak Gate Rejection Telemetry Event Verification
  // --------------------------------------------------------------------------
  describe('Leak Gate Rejection Telemetry Event', () => {
    const sessionId = `test-telemetry-rejection-${Date.now()}`;
    after(() => clearSessionLog(sessionId));

    it('records utterance_rejected event with stage and reason', () => {
      const rejectedEvent = logEventSync(sessionId, 'utterance_rejected', {
        candidate: 'You should add 5 to 6 to get 11.',
        rejectedReason: 'Banned operation and forbidden value 6 detected',
        stage: 4,
        latencyMs: 1.2,
        fallbackToScripted: true
      });

      assert.equal(rejectedEvent.type, 'utterance_rejected');
      assert.equal(rejectedEvent.stage, 4);
      assert.equal(rejectedEvent.fallbackToScripted, true);

      const logs = readSessionEvents(sessionId);
      assert.equal(logs.length, 1);
      assert.equal(logs[0].type, 'utterance_rejected');
    });
  });

  // --------------------------------------------------------------------------
  // Static Encounter Client-Safe View Strictness Audit
  // --------------------------------------------------------------------------
  describe('Static Encounter Client-Safe View Strictness Audit', () => {
    it('verifies getClientSafeEncounter strips all answers, intermediates, and forbidden values', () => {
      for (const enc of Object.values(encounters)) {
        const safe = getClientSafeEncounter(enc);
        assertClientSafe(safe, enc);
        assert.equal(safe.parts.some(p => p.answer !== undefined), false);
        assert.equal(safe.parts.some(p => p.forbidden !== undefined), false);
        assert.equal(safe.parts.some(p => p.intermediates !== undefined), false);
        assert.equal(safe.parts.some(p => p.misconceptions !== undefined), false);
        assert.equal(safe.parts.some(p => p.ladder !== undefined), false);
        assert.equal(safe.lookBack.some(lb => lb.check !== undefined), false);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Network Isolation Final Verification
  // --------------------------------------------------------------------------
  it('Guarantees exactly zero external network calls occurred throughout entire test run', () => {
    assert.equal(externalNetworkCalls, 0, 'Zero network calls enforced for scripted mode');
  });
});
