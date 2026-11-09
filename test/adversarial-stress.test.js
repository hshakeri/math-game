/**
 * Castle of Theorems — Milestone M1 Adversarial Stress Test Suite
 * test/adversarial-stress.test.js
 *
 * Empirical challenger stress harness covering:
 * 1. State Machine edge cases and invariants:
 *    - Invalid action types, missing payloads, non-integer inputs, out-of-order transitions.
 *    - Conjecture edge cases: 2 words vs 3 words, punctuation, wrong conjecture overflow.
 *    - Understand edge cases: classification combinations, probe counter overflow (>2), deck locking.
 *    - Plan edge cases: off-target cards, multiple card activations, idle escalation past l3.
 *    - Carry Out edge cases: mechanics step replay, ladder fading floor (l1) and ceiling (l3), rapid non-progress.
 *    - Simpler Problem edge cases: double failure with l3 given, bridge probe return to real chest.
 *    - Submit edge cases: 3-attempt parent flag, wrong answer dial values.
 *    - Look Back edge cases: reflection answer validation, parent waiver restriction (max 1 per chapter).
 *    - Multi-part progression: parts a -> b -> c in Dark Vault, verifying intermediate seals without premature completion.
 * 2. Client-Safe View Adversarial Leak Scan:
 *    - Deep property scan across all states of all 4 encounters using assertClientSafe.
 *    - Zero leakage of target answers, intermediates, forbidden values, unearned hints, misconception probes.
 * 3. Telemetry Concurrency Stress:
 *    - Concurrent asynchronous write bursts testing FIFO promise queue order and zero JSONL corruption.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createSession,
  transition,
  isTerminal,
  countWords,
  checkAnswer,
  matchMisconception,
  hasMoreParts,
  LADDER_RUNGS
} from '../server/engine/stateMachine.js';

import {
  getClientSafeEncounter,
  getClientSafeSessionView,
  assertClientSafe,
  SecurityLeakError
} from '../server/engine/clientView.js';

import {
  logEvent,
  logEventSync,
  readSessionEvents,
  clearSessionLog,
  getSessionLogPath,
  MANDATORY_EVENT_TYPES
} from '../server/engine/telemetry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadEncounter = (filename) => {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../content/encounters', filename), 'utf8'));
};

const encounters = {
  reverseTolls: loadEncounter('chasm-reverse-tolls.json'),
  darkVault: loadEncounter('alchemists-dark-vault.json'),
  fiveShields: loadEncounter('courtyard-five-shields.json'),
  castleKeep: loadEncounter('castle-keep-portcullis.json')
};

// Deep freeze utility to ensure immutability
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const prop of Object.getOwnPropertyNames(obj)) {
    if (obj[prop] !== null && (typeof obj[prop] === 'object' || typeof obj[prop] === 'function')) {
      deepFreeze(obj[prop]);
    }
  }
  return obj;
}

describe('Empirical Adversarial Stress Suite — Milestone M1', () => {

  // =========================================================================
  // 1. STATE MACHINE EDGE CASES & INVARIANTS
  // =========================================================================
  describe('1. State Machine Edge Cases & Invariants', () => {

    describe('1.1 Invalid Actions, Missing Payloads & Out-of-Order Transitions', () => {
      it('safely handles empty, nullish, or corrupted action objects without state mutation', () => {
        const s0 = createSession(encounters.reverseTolls);
        deepFreeze(s0);

        // Missing or non-string action types
        const invalidActions = [
          {},
          { type: null },
          { type: undefined },
          { type: 12345 },
          { type: true },
          { type: {} },
          { type: [] },
          { type: 'UNKNOWN_ACTION_TYPE' },
          { type: '__proto__' },
          { type: 'constructor' }
        ];

        for (const act of invalidActions) {
          const { session, events } = transition(s0, act, encounters.reverseTolls);
          assert.equal(session.state, 'arrive');
          assert.equal(session.conjectures, 0);
          assert.equal(session.hintRung, 'l0');
          assert.equal(events.length, 0);
        }
      });

      it('safely rejects out-of-order transitions across all phases', () => {
        const s0 = createSession(encounters.reverseTolls);
        deepFreeze(s0);

        // While in 'arrive', these must be ignored
        const outOfOrderInArrive = [
          { type: 'step', payload: { action: 'value', gateIndex: 2, value: 11 } },
          { type: 'card', cardId: 'work-backwards' },
          { type: 'submit', value: 6 },
          { type: 'lookback', kind: 'verify', value: 13 },
          { type: 'waive' },
          { type: 'next_part' },
          { type: 'complete' }
        ];

        for (const act of outOfOrderInArrive) {
          const { session, events } = transition(s0, act, encounters.reverseTolls);
          assert.equal(session.state, 'arrive', `Action ${act.type} should not advance from arrive`);
          assert.equal(events.length, 0);
        }
      });

      it('safely rejects missing or invalid payloads in step action', () => {
        const s0 = createSession(encounters.reverseTolls);
        s0.state = 'carry_out';
        s0.hintRung = 'l1';
        s0.hintRungIndex = 1;
        deepFreeze(s0);

        const malformedSteps = [
          { type: 'step' },
          { type: 'step', payload: null },
          { type: 'step', payload: undefined },
          { type: 'step', payload: 'not-an-object' },
          { type: 'step', payload: 42 },
          { type: 'step', payload: {} },
          { type: 'step', payload: { action: null } },
          { type: 'step', payload: { action: 999 } },
          { type: 'step', payload: { action: 'value', gateIndex: 'NaN', value: 'bad' } },
          { type: 'step', payload: { action: 'value', gateIndex: -5, value: Infinity } }
        ];

        let current = s0;
        for (const act of malformedSteps) {
          const { session } = transition(current, act, encounters.reverseTolls);
          // Malformed step should count as non-progress, NOT crash
          assert.ok(session.nonProgressCount >= 0);
          assert.equal(session.state === 'carry_out' || session.state === 'simpler_problem', true);
          current = session;
        }
      });
    });

    describe('1.2 Conjecture Edge Cases & Boundaries', () => {
      it('rigorously tests justification word count boundaries (2 words vs 3 words)', () => {
        const s0 = createSession(encounters.reverseTolls);
        const { session: sConjecture } = transition(s0, { type: 'arrive' }, encounters.reverseTolls);

        // 2-word variations -> MUST NOT shortcut, stays in conjecture with skeptic prompt
        const twoWordCases = [
          'two words',
          'just guessed',
          '  two   words  ',
          'my answer',
          'word1 word2'
        ];

        for (const reason of twoWordCases) {
          assert.equal(countWords(reason), 2, `Expected 2 words for "${reason}"`);
          const { session, events } = transition(sConjecture, {
            type: 'conjecture',
            stem: 'think',
            value: 6, // correct
            reason
          }, encounters.reverseTolls);

          assert.equal(session.state, 'conjecture', `2 words ("${reason}") must stay in conjecture`);
          assert.equal(session.shortcut, false);
          assert.ok(events.some(e => e.type === 'conjecture.skeptic_prompt'));
        }

        // 3-word variations -> MUST shortcut to look_back
        const threeWordCases = [
          'three whole words',
          'undo doubling then',
          '  spaced   out   words  ',
          'one\ntwo\tthree',
          'Word1, word2, word3!'
        ];

        for (const reason of threeWordCases) {
          assert.ok(countWords(reason) >= 3, `Expected >= 3 words for "${reason}"`);
          const { session, events } = transition(sConjecture, {
            type: 'conjecture',
            stem: 'think',
            value: 6, // correct
            reason
          }, encounters.reverseTolls);

          assert.equal(session.state, 'look_back', `3 words ("${reason}") must shortcut to look_back`);
          assert.equal(session.shortcut, true);
          assert.ok(events.some(e => e.type === 'shortcut' && e.shortcut === true));
        }
      });

      it('prevents wrong conjecture counter overflow beyond cap (>2)', () => {
        const s0 = createSession(encounters.reverseTolls);
        const { session: s1 } = transition(s0, { type: 'arrive' }, encounters.reverseTolls);
        assert.equal(s1.state, 'conjecture');

        // First wrong conjecture -> routes to understand, conjectures = 1
        const { session: s2 } = transition(s1, { type: 'conjecture', value: 99 }, encounters.reverseTolls);
        assert.equal(s2.state, 'understand');
        assert.equal(s2.conjectures, 1);

        // Second wrong conjecture in understand increments conjectures to cap of 2
        const { session: s3 } = transition(s2, { type: 'conjecture', value: 100 }, encounters.reverseTolls);
        assert.equal(s3.state, 'understand');
        assert.equal(s3.conjectures, 2);

        // Additional conjecture attempts while cap of 2 is reached MUST be ignored
        let current = s3;
        for (let i = 0; i < 5; i++) {
          const { session } = transition(current, { type: 'conjecture', value: 101 + i }, encounters.reverseTolls);
          assert.equal(session.state, 'understand');
          assert.equal(session.conjectures, 2, 'Conjecture counter must not increment beyond cap of 2');
          current = session;
        }

        // Check client view conjecturesRemaining never goes negative
        const view = getClientSafeSessionView(current, encounters.reverseTolls);
        assert.equal(view.conjecturesRemaining, 0);
      });
    });

    describe('1.3 Understand Edge Cases & Probe Counter Invariants', () => {
      it('evaluates all 8 combinations of classification { unknown, data, condition }', () => {
        const combinations = [
          { c: { unknown: false, data: false, condition: false }, advances: false },
          { c: { unknown: true,  data: false, condition: false }, advances: false },
          { c: { unknown: false, data: true,  condition: false }, advances: false },
          { c: { unknown: false, data: false, condition: true  }, advances: false },
          { c: { unknown: true,  data: true,  condition: false }, advances: false },
          { c: { unknown: true,  data: false, condition: true  }, advances: false },
          { c: { unknown: false, data: true,  condition: true  }, advances: false },
          { c: { unknown: true,  data: true,  condition: true  }, advances: true }
        ];

        for (const { c, advances } of combinations) {
          const s0 = createSession(encounters.reverseTolls);
          s0.state = 'understand';
          s0.probeCountInState = 0;

          const { session, events } = transition(s0, {
            type: 'say',
            text: 'restatement',
            classification: c
          }, encounters.reverseTolls);

          if (advances) {
            assert.equal(session.state, 'plan', `All-true classification must advance to plan`);
            assert.equal(session.probeCountInState, 0);
            assert.ok(events.some(e => e.to === 'plan' && e.reason === 'classified'));
          } else {
            assert.equal(session.state, 'understand', `Incomplete classification on turn 1 must stay in understand`);
            assert.equal(session.probeCountInState, 1);
          }
        }
      });

      it('guarantees probe counter never overflows > 2 in understand', () => {
        const s0 = createSession(encounters.reverseTolls);
        s0.state = 'understand';
        s0.probeCountInState = 0;

        // Probe 1: incomplete
        const { session: s1 } = transition(s0, {
          type: 'chip',
          chip: 'coin data',
          classification: { unknown: false, data: true, condition: false }
        }, encounters.reverseTolls);
        assert.equal(s1.state, 'understand');
        assert.equal(s1.probeCountInState, 1);

        // Probe 2: reaches cap -> advances to plan and resets probeCountInState
        const { session: s2, events } = transition(s1, {
          type: 'chip',
          chip: 'coin rule',
          classification: { unknown: false, data: false, condition: true }
        }, encounters.reverseTolls);
        assert.equal(s2.state, 'plan');
        assert.equal(s2.probeCountInState, 0);
        assert.ok(events.some(e => e.to === 'plan' && e.reason === 'probe_cap'));

        // Workspace and deck locking: workspace must remain locked in understand and plan
        const viewUnderstand = getClientSafeSessionView(s1, encounters.reverseTolls);
        assert.equal(viewUnderstand.workspaceUnlocked, false);

        const viewPlan = getClientSafeSessionView(s2, encounters.reverseTolls);
        assert.equal(viewPlan.workspaceUnlocked, false);
      });
    });

    describe('1.4 Plan Edge Cases: Off-Target Cards, Multiple Activations & Idle Escalation', () => {
      it('correctly tags off-target cards and ignores redundant card activations in carry_out', () => {
        const s0 = createSession(encounters.reverseTolls);
        s0.state = 'plan';

        // Select off-target card (odd-or-even is not in reverseTolls.cards)
        const { session: s1, events: e1 } = transition(s0, { type: 'card', cardId: 'odd-or-even' }, encounters.reverseTolls);
        assert.equal(s1.state, 'carry_out');
        assert.equal(s1.activeCard, 'odd-or-even');
        assert.ok(e1.some(e => e.to === 'carry_out' && e.onTarget === false));

        // Now in carry_out: attempting to select a different regular card must NOT overwrite activeCard
        const { session: s2 } = transition(s1, { type: 'card', cardId: 'work-backwards' }, encounters.reverseTolls);
        assert.equal(s2.activeCard, 'odd-or-even', 'Active card must remain unchanged');
        assert.equal(s2.state, 'carry_out');
      });

      it('caps idle/stuck escalation at ceiling l3 without overflow', () => {
        const s0 = createSession(encounters.reverseTolls);
        s0.state = 'plan';
        s0.hintRung = 'l0';
        s0.hintRungIndex = 0;

        let current = s0;
        // Fire 10 consecutive stuck actions in plan
        for (let i = 0; i < 10; i++) {
          const { session } = transition(current, { type: 'stuck' }, encounters.reverseTolls);
          current = session;
          assert.equal(current.state, 'plan');
          assert.ok(current.hintRungIndex <= 4);
          assert.ok(['l0', 'l1', 'l2', 'l4', 'l3'].includes(current.hintRung));
        }

        // At ceiling: hintRungIndex should be 4 ('l3')
        assert.equal(current.hintRungIndex, 4);
        assert.equal(current.hintRung, 'l3');
      });
    });

    describe('1.5 Carry Out Edge Cases: Step Replays, Ladder Floor (l1) and Ceiling (l3)', () => {
      it('rejects step replay of already solved gates in inverse-chain', () => {
        const s0 = createSession(encounters.reverseTolls);
        s0.state = 'carry_out';

        // Solve gate 2
        const s1 = transition(s0, {
          type: 'step',
          payload: { action: 'order', gateIndex: 2, order: ['add', 'divide'] }
        }, encounters.reverseTolls).session;

        const s2 = transition(s1, {
          type: 'step',
          payload: { action: 'value', gateIndex: 2, value: 11 }
        }, encounters.reverseTolls).session;

        assert.equal(s2.mechanicState.currentGateIndex, 1);

        // Attempt to replay gate 2 again -> MUST be rejected as non-progress
        const { session: s3 } = transition(s2, {
          type: 'step',
          payload: { action: 'value', gateIndex: 2, value: 11 }
        }, encounters.reverseTolls);

        assert.equal(s3.mechanicState.currentGateIndex, 1);
        assert.equal(s3.nonProgressCount, 1);
      });

      it('strictly enforces ladder floor at l1 during successful step execution', () => {
        const s0 = createSession(encounters.reverseTolls);
        s0.state = 'carry_out';
        s0.hintRung = 'l1';
        s0.hintRungIndex = 1;

        // Perform 5 consecutive successful steps
        let current = s0;
        for (let i = 0; i < 5; i++) {
          // Re-arm state for testing fading floor
          current.mechanicState.currentGateIndex = 2;
          const { session } = transition(current, {
            type: 'step',
            payload: { action: 'order', gateIndex: 2, order: ['add', 'divide'] }
          }, encounters.reverseTolls);

          assert.equal(session.hintRungIndex, 1, 'Hint ladder floor must not drop below index 1 (l1)');
          assert.equal(session.hintRung, 'l1');
          current = session;
        }
      });
    });

    describe('1.6 Simpler Problem Sub-loop Edge Cases', () => {
      it('delivers worked step l3 on double failure and returns to carry_out at l1 with bridge probe', () => {
        const s0 = createSession(encounters.reverseTolls);
        s0.state = 'simpler_problem';
        s0.simplerProblemState = {
          statement: encounters.reverseTolls.parts[0].ladder.l4.statement,
          answer: encounters.reverseTolls.parts[0].ladder.l4.answer,
          l3Hint: encounters.reverseTolls.parts[0].ladder.l4.l3,
          attempts: 0,
          completed: false
        };

        // Attempt 1: wrong
        const { session: s1, events: e1 } = transition(s0, { type: 'submit', value: 999 }, encounters.reverseTolls);
        assert.equal(s1.state, 'simpler_problem');
        assert.equal(s1.simplerProblemState.attempts, 1);
        assert.ok(e1.some(e => e.type === 'simpler_problem.wrong'));

        // Attempt 2: wrong -> triggers l3 unlock and return to carry_out
        const { session: s2, events: e2 } = transition(s1, { type: 'submit', value: 888 }, encounters.reverseTolls);
        assert.equal(s2.state, 'carry_out');
        assert.equal(s2.hintRung, 'l1');
        assert.equal(s2.hintRungIndex, 1);
        assert.equal(s2.simplerProblemL3Unlocked, true);
        assert.equal(s2.simplerProblemState, null);
        assert.ok(e2.some(e => e.bridge === true && e.reason === 'max_attempts_l3_given'));
      });
    });

    describe('1.7 Submit Dial Edge Cases', () => {
      it('flags parent dashboard and offers l3 upon exactly 3 wrong submissions', () => {
        const s0 = createSession(encounters.reverseTolls);
        s0.state = 'carry_out';

        // Submit 1 wrong
        const { session: s1 } = transition(s0, { type: 'submit', value: -1 }, encounters.reverseTolls);
        assert.equal(s1.state, 'carry_out');
        assert.equal(s1.attempts, 1);
        assert.equal(s1.parentFlag, false);

        // Submit 2 wrong
        const { session: s2 } = transition(s1, { type: 'submit', value: 'not-a-number' }, encounters.reverseTolls);
        assert.equal(s2.state, 'carry_out');
        assert.equal(s2.attempts, 2);
        assert.equal(s2.parentFlag, false);

        // Submit 3 wrong -> parentFlag becomes true
        const { session: s3, events: e3 } = transition(s2, { type: 'submit', value: 999 }, encounters.reverseTolls);
        assert.equal(s3.state, 'carry_out');
        assert.equal(s3.attempts, 3);
        assert.equal(s3.parentFlag, true);
        assert.ok(e3.some(e => e.type === 'parent.flag' && e.l3Offered === true));
      });
    });

    describe('1.8 Look Back & Parent Waiver Enforcement', () => {
      it('enforces maximum 1 parent waiver per chapter (second attempt strictly rejected)', () => {
        const s0 = createSession(encounters.reverseTolls);
        s0.state = 'look_back';
        s0.parentWaiver = false;

        // Waiver 1: allowed
        const { session: s1, events: e1 } = transition(s0, { type: 'waive' }, encounters.reverseTolls);
        assert.equal(s1.state, 'sealed');
        assert.equal(s1.parentWaiver, true);
        assert.equal(s1.chapterWaiverUsed, true);
        assert.ok(e1.some(e => e.waived === true));

        // Now suppose another encounter is played, and reaches look_back with waiver already used
        const sOther = createSession(encounters.fiveShields, { chapterWaiverUsed: true });
        sOther.state = 'look_back';
        deepFreeze(sOther);

        // Waiver 2: MUST be rejected
        const { session: sOther2, events: eOther2 } = transition(sOther, { type: 'waive' }, encounters.fiveShields);
        assert.equal(sOther2.state, 'look_back', 'Second waiver in chapter must not seal encounter');
        assert.equal(eOther2.length, 0);

        const view = getClientSafeSessionView(sOther2, encounters.fiveShields);
        assert.equal(view.parentWaiverAvailable, false);
      });
    });

    describe('1.9 Multi-Part Progression (Dark Vault a -> b -> c)', () => {
      it('verifies intermediate parts seal without premature node completion', () => {
        const s0 = createSession(encounters.darkVault);
        assert.equal(s0.currentPartId, 'a');

        // Play Part a: Target is 4
        s0.state = 'carry_out';
        const { session: s1, events: e1 } = transition(s0, { type: 'submit', value: 4 }, encounters.darkVault);
        assert.equal(s1.state, 'sealed');
        assert.equal(s1.completed, false, 'Part a completion must not complete entire encounter');
        assert.equal(isTerminal(s1), false);
        assert.ok(e1.some(e => e.to === 'sealed' && e.partId === 'a'));

        // Advance to Part b
        const { session: s2 } = transition(s1, { type: 'next_part' }, encounters.darkVault);
        assert.equal(s2.state, 'arrive');
        assert.equal(s2.currentPartId, 'b');
        assert.equal(s2.completed, false);

        // Play Part b: Target is 10
        s2.state = 'carry_out';
        const { session: s3 } = transition(s2, { type: 'submit', value: 10 }, encounters.darkVault);
        assert.equal(s3.state, 'sealed');
        assert.equal(s3.completed, false);
        assert.equal(isTerminal(s3), false);

        // Advance to Part c
        const { session: s4 } = transition(s3, { type: 'next_part' }, encounters.darkVault);
        assert.equal(s4.state, 'arrive');
        assert.equal(s4.currentPartId, 'c');
        assert.equal(s4.completed, false);

        // Play Part c (final part): Target is 13
        s4.state = 'carry_out';
        const { session: s5 } = transition(s4, { type: 'submit', value: 13 }, encounters.darkVault);
        assert.equal(s5.state, 'look_back', 'Final part correct submit must advance to look_back');
        assert.equal(s5.completed, false);

        // Look back perturb: kind 'perturb' check is 5
        const { session: s6 } = transition(s5, { type: 'lookback', kind: 'perturb', value: 5 }, encounters.darkVault);
        assert.equal(s6.state, 'sealed');
        assert.equal(s6.lookBackCompleted, true);

        // Complete encounter -> transitions to Map
        const { session: s7, events: e7 } = transition(s6, { type: 'next_part' }, encounters.darkVault);
        assert.equal(s7.state, 'map');
        assert.equal(s7.completed, true);
        assert.equal(isTerminal(s7), true);
        assert.ok(e7.some(e => e.type === 'session.end' && e.reason === 'finished'));
      });
    });
  });

  // =========================================================================
  // 2. CLIENT-SAFE VIEW ADVERSARIAL LEAK SCAN
  // =========================================================================
  describe('2. Client-Safe View Adversarial Leak Scan', () => {

    it('scans all static encounter views for forbidden keys, target answers, and intermediates', () => {
      const encounterKeys = Object.keys(encounters);

      for (const key of encounterKeys) {
        const encounter = encounters[key];
        const safeView = getClientSafeEncounter(encounter);

        // 1. assertClientSafe check
        assert.doesNotThrow(() => assertClientSafe(safeView, encounter));

        // 2. Recursive inspection for forbidden keys
        const jsonStr = JSON.stringify(safeView);
        assert.equal(/"answer":/.test(jsonStr), false, `Leak in ${key}: 'answer' key found in JSON`);
        assert.equal(/"intermediates":/.test(jsonStr), false, `Leak in ${key}: 'intermediates' key found`);
        assert.equal(/"forbidden":/.test(jsonStr), false, `Leak in ${key}: 'forbidden' key found`);
        assert.equal(/"misconceptions":/.test(jsonStr), false, `Leak in ${key}: 'misconceptions' key found`);

        // In lookBack, verify no 'check' key exists
        if (Array.isArray(safeView.lookBack)) {
          for (const lb of safeView.lookBack) {
            assert.equal(lb.check, undefined, `Leak in ${key}: lookBack check property found`);
          }
        }
      }
    });

    it('exhaustively scans dynamic session views across all 4 encounters, all states, all rungs, and all parts', () => {
      const PHASES = ['arrive', 'conjecture', 'understand', 'plan', 'carry_out', 'simpler_problem', 'submit', 'look_back', 'sealed', 'map'];
      const RUNGS = ['l0', 'l1', 'l2', 'l4', 'l3'];

      let totalScanned = 0;

      for (const [encKey, encounter] of Object.entries(encounters)) {
        for (const part of encounter.parts) {
          for (const phase of PHASES) {
            for (let rungIdx = 0; rungIdx < RUNGS.length; rungIdx++) {
              const rung = RUNGS[rungIdx];

              const session = {
                sessionId: `scan-${encKey}-${part.id}-${phase}-${rung}`,
                encounterId: encounter.id,
                currentPartId: part.id,
                state: phase,
                phase,
                hintRung: rung,
                hintRungIndex: rungIdx,
                activeCard: phase === 'carry_out' ? 'work-backwards' : null,
                isSealed: phase === 'sealed' || phase === 'map',
                completed: phase === 'map',
                lookBackCompleted: phase === 'sealed' || phase === 'map',
                parentWaiver: false,
                chapterWaiverUsed: false,
                parentScribe: false,
                parentFlag: false,
                simplerProblemL3Unlocked: false,
                mechanicState: null
              };

              const view = getClientSafeSessionView(session, encounter);

              // 1. Run strict assertClientSafe auditor
              assert.doesNotThrow(
                () => assertClientSafe(view, encounter, part.id, rungIdx),
                `Leak detected for ${encKey} part ${part.id} in phase ${phase} at rung ${rung}`
              );

              // 2. Verify unearned hint boundaries
              if (rungIdx < 2) {
                // Must not contain l2 hint text
                assert.equal(view.revealedHints.some(h => h.rung === 'l2'), false);
              }
              if (rungIdx < 3) {
                // An explicit Tiny Case card earns its statement independently of hint rung.
                const tinyHint = view.revealedHints.find(h => h.rung === 'l4');
                if (phase === 'simpler_problem') {
                  assert.deepEqual(tinyHint, { rung: 'l4', statement: part.ladder.l4.statement });
                } else {
                  assert.equal(tinyHint, undefined);
                }
              }
              if (rungIdx < 4) {
                // Must not contain l3 hint text
                assert.equal(view.revealedHints.some(h => h.rung === 'l3'), false);
              }

              // 3. Verify unearned codex
              if (!view.sealed) {
                assert.equal(view.codex, null, `Codex must be null when not sealed in ${encKey}`);
              }

              // 4. Verify lookBackOptions only available in look_back phase
              if (phase !== 'look_back') {
                assert.equal(view.lookBackOptions, null, `lookBackOptions must be null outside look_back in ${encKey}`);
              } else {
                assert.ok(Array.isArray(view.lookBackOptions));
                for (const opt of view.lookBackOptions) {
                  assert.equal(opt.check, undefined, 'lookBack check must never leak');
                }
              }

              totalScanned++;
            }
          }
        }
      }

      assert.ok(totalScanned >= 200, `Expected at least 200 combinatorial scans, ran ${totalScanned}`);
    });
  });

  // =========================================================================
  // 3. TELEMETRY CONCURRENCY STRESS
  // =========================================================================
  describe('3. Telemetry Concurrency Stress', () => {

    it('processes concurrent asynchronous write bursts in strict FIFO order with zero JSONL corruption', async () => {
      const sessionIdA = `stress-concurrency-A-${Date.now()}`;
      const sessionIdB = `stress-concurrency-B-${Date.now()}`;
      const burstSize = 100;

      clearSessionLog(sessionIdA);
      clearSessionLog(sessionIdB);

      // Launch 100 concurrent writes to session A and 100 to session B simultaneously
      const writesA = [];
      const writesB = [];

      for (let i = 0; i < burstSize; i++) {
        writesA.push(logEvent(sessionIdA, 'child.action', { seq: i, payload: { action: 'step', stepIndex: i } }));
        writesB.push(logEvent(sessionIdB, 'engine.transition', { seq: i, from: 'carry_out', to: 'carry_out' }));
      }

      // Await all 200 concurrent async operations
      await Promise.all([...writesA, ...writesB]);

      // Read back raw file lines directly from filesystem
      const logPathA = getSessionLogPath(sessionIdA);
      const logPathB = getSessionLogPath(sessionIdB);

      assert.ok(fs.existsSync(logPathA), 'Session A JSONL file must exist');
      assert.ok(fs.existsSync(logPathB), 'Session B JSONL file must exist');

      const linesA = fs.readFileSync(logPathA, 'utf8').trim().split('\n');
      const linesB = fs.readFileSync(logPathB, 'utf8').trim().split('\n');

      assert.equal(linesA.length, burstSize, `Session A must have exactly ${burstSize} lines`);
      assert.equal(linesB.length, burstSize, `Session B must have exactly ${burstSize} lines`);

      // Verify every line is valid JSON and strictly preserves sequential FIFO ordering
      for (let i = 0; i < burstSize; i++) {
        let parsedA, parsedB;
        assert.doesNotThrow(() => { parsedA = JSON.parse(linesA[i]); }, `Line ${i} in session A must be valid JSON`);
        assert.doesNotThrow(() => { parsedB = JSON.parse(linesB[i]); }, `Line ${i} in session B must be valid JSON`);

        assert.equal(parsedA.seq, i, `Session A line ${i} must preserve strict FIFO sequence`);
        assert.equal(parsedA.sessionId, sessionIdA);
        assert.equal(parsedA.type, 'child.action');

        assert.equal(parsedB.seq, i, `Session B line ${i} must preserve strict FIFO sequence`);
        assert.equal(parsedB.sessionId, sessionIdB);
        assert.equal(parsedB.type, 'engine.transition');
      }

      // Cleanup
      clearSessionLog(sessionIdA);
      clearSessionLog(sessionIdB);
    });

    it('rejects unrecognized event types outside mandatory taxonomy', async () => {
      const badSessionId = `bad-event-${Date.now()}`;
      await assert.rejects(
        () => logEvent(badSessionId, 'ILLEGAL_EVENT_TYPE', { foo: 'bar' }),
        /Unknown telemetry event type/
      );
    });
  });
});
