/**
 * Castle of Theorems — Milestone M1 State Machine Unit Test Suite
 * test/stateMachine.test.js
 *
 * 100% transition coverage of Pólya state machine (SPEC §4, §14):
 * Arrive -> Conjecture -> Understand -> Plan -> Carry Out ->
 * Simpler Problem -> Submit -> Look Back -> Sealed -> Map
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
  getClientSafeView,
  checkAnswer,
  countWords,
  matchMisconception,
  hasMoreParts,
  LADDER_RUNGS
} from '../server/engine/stateMachine.js';

// Deep freeze helper to verify immutability
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

describe('Pólya State Machine — Pure Functional Transitions', () => {

  // --------------------------------------------------------------------------
  // 1. Session Initialization & Validation
  // --------------------------------------------------------------------------
  describe('Session Initialization', () => {
    it('initializes session at Arrive state with initial mechanic state and l0 rung', () => {
      const session = createSession(encounters.reverseTolls, { sessionId: 'sess-001' });
      assert.equal(session.sessionId, 'sess-001');
      assert.equal(session.encounterId, 'ch1-n1-reverse-tolls');
      assert.equal(session.currentPartId, 'a');
      assert.equal(session.state, 'arrive');
      assert.equal(session.hintRung, 'l0');
      assert.equal(session.hintRungIndex, 0);
      assert.equal(session.conjectures, 0);
      assert.equal(session.attempts, 0);
      assert.equal(session.shortcut, false);
      assert.equal(session.completed, false);
      assert.ok(session.mechanicState);
      assert.equal(session.mechanicState.currentValue, 13);
      assert.equal(isTerminal(session), false);
    });

    it('rejects invalid encounter definition', () => {
      assert.throws(() => createSession(null), /Invalid encounter/);
      assert.throws(() => createSession({}), /Invalid encounter/);
      assert.throws(() => createSession({ id: 'bad', parts: [] }), /Invalid encounter/);
    });
  });

  // --------------------------------------------------------------------------
  // 2. T01: Arrive -> Conjecture
  // --------------------------------------------------------------------------
  describe('T01: Arrive -> Conjecture', () => {
    it('transitions from arrive to conjecture upon read_inscription or arrive action', () => {
      const s0 = createSession(encounters.reverseTolls);
      deepFreeze(s0);

      const { session: s1, events } = transition(s0, { type: 'arrive' }, encounters.reverseTolls);
      assert.equal(s1.state, 'conjecture');
      assert.equal(s1.conjectures, 0);
      assert.equal(events.some(e => e.type === 'engine.transition' && e.to === 'conjecture'), true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. T02 & T03: Conjecture Shortcut and Skeptic Probe
  // --------------------------------------------------------------------------
  describe('T02 & T03: Conjecture Shortcut vs Skeptic Probe', () => {
    it('T02: Right answer with >= 3 words justification shortcuts directly to look_back', () => {
      const s0 = createSession(encounters.reverseTolls);
      const { session: s1 } = transition(s0, { type: 'arrive' }, encounters.reverseTolls);
      deepFreeze(s1);

      // Target answer is 6; justification has 5 words
      const action = {
        type: 'conjecture',
        stem: 'think',
        value: 6,
        reason: 'undo doubling then add tolls'
      };
      assert.ok(countWords(action.reason) >= 3);

      const { session: s2, events } = transition(s1, action, encounters.reverseTolls);
      assert.equal(s2.state, 'look_back');
      assert.equal(s2.shortcut, true);
      assert.ok(events.some(e => e.type === 'shortcut' && e.shortcut === true));
    });

    it('T03: Right answer with < 3 words stays in conjecture with skeptic probe', () => {
      const s0 = createSession(encounters.reverseTolls);
      const { session: s1 } = transition(s0, { type: 'arrive' }, encounters.reverseTolls);
      deepFreeze(s1);

      // Target answer is 6, but justification has only 2 words
      const action = {
        type: 'conjecture',
        stem: 'notice',
        value: 6,
        reason: 'just guessed'
      };
      assert.ok(countWords(action.reason) < 3);

      const { session: s2, events } = transition(s1, action, encounters.reverseTolls);
      assert.equal(s2.state, 'conjecture');
      assert.equal(s2.conjectures, 0);
      assert.equal(s2.shortcut, false);
      assert.ok(events.some(e => e.type === 'conjecture.skeptic_prompt'));
    });
  });

  // --------------------------------------------------------------------------
  // 4. T04 & T05: Misconception Routing & 2-Conjecture Cap
  // --------------------------------------------------------------------------
  describe('T04 & T05: Misconception Routing & 2-Conjecture Cap', () => {
    it('T04: First wrong conjecture routes to Understand with misconception tag and start rung', () => {
      const s0 = createSession(encounters.reverseTolls);
      const { session: s1 } = transition(s0, { type: 'arrive' }, encounters.reverseTolls);
      deepFreeze(s1);

      // Value 15 matches misconception 'undo-order' with startLevel 1 ('l1')
      const action = {
        type: 'conjecture',
        stem: 'think',
        value: 15,
        reason: 'I added backwards'
      };

      const { session: s2, events } = transition(s1, action, encounters.reverseTolls);
      assert.equal(s2.state, 'understand');
      assert.equal(s2.conjectures, 1);
      assert.equal(s2.misconceptionTag, 'undo-order');
      assert.equal(s2.hintRung, 'l1');
      assert.equal(s2.hintRungIndex, 1);
    });

    it('T05: Second wrong conjecture increments to 2 and closes conjecture window', () => {
      const s0 = createSession(encounters.reverseTolls);
      const { session: s1 } = transition(s0, { type: 'arrive' }, encounters.reverseTolls);
      // First wrong conjecture
      const { session: s2 } = transition(s1, { type: 'conjecture', value: 99 }, encounters.reverseTolls);
      assert.equal(s2.conjectures, 1);

      // Child returns to conjecture or sends second conjecture
      s2.state = 'conjecture';
      deepFreeze(s2);

      const { session: s3 } = transition(s2, { type: 'conjecture', value: 100 }, encounters.reverseTolls);
      assert.equal(s3.state, 'understand');
      assert.equal(s3.conjectures, 2);
    });

    it('skip_conjecture action advances directly to Understand at current hint level', () => {
      const s0 = createSession(encounters.reverseTolls);
      const { session: s1 } = transition(s0, { type: 'arrive' }, encounters.reverseTolls);
      const { session: s2 } = transition(s1, { type: 'skip_conjecture' }, encounters.reverseTolls);
      assert.equal(s2.state, 'understand');
    });
  });

  // --------------------------------------------------------------------------
  // 5. T06 & T07: Understand Phase & 2-Probe Cap
  // --------------------------------------------------------------------------
  describe('T06 & T07: Understand Phase & 2-Probe Cap', () => {
    it('T06: Full classification { unknown, data, condition } advances to Plan immediately', () => {
      const s0 = createSession(encounters.reverseTolls);
      const { session: s1 } = transition(s0, { type: 'arrive' }, encounters.reverseTolls);
      const { session: s2 } = transition(s1, { type: 'skip_conjecture' }, encounters.reverseTolls);
      deepFreeze(s2);

      const action = {
        type: 'say',
        text: 'I know the end coins and gate rules and need the start',
        classification: { unknown: true, data: true, condition: true }
      };

      const { session: s3, events } = transition(s2, action, encounters.reverseTolls);
      assert.equal(s3.state, 'plan');
      assert.equal(s3.probeCountInState, 0);
      assert.ok(events.some(e => e.to === 'plan' && e.reason === 'classified'));
    });

    it('T07: Incomplete classification under 2 probes stays in Understand', () => {
      const s0 = createSession(encounters.reverseTolls);
      const { session: s1 } = transition(s0, { type: 'arrive' }, encounters.reverseTolls);
      const { session: s2 } = transition(s1, { type: 'skip_conjecture' }, encounters.reverseTolls);
      deepFreeze(s2);

      const action = {
        type: 'say',
        text: 'We have coins at the end',
        classification: { unknown: false, data: true, condition: false }
      };

      const { session: s3, events } = transition(s2, action, encounters.reverseTolls);
      assert.equal(s3.state, 'understand');
      assert.equal(s3.probeCountInState, 1);
      assert.ok(events.some(e => e.type === 'engine.transition' && e.to === 'understand'));
    });

    it('T06b: Reaching 2-probe cap advances to Plan even with incomplete classification', () => {
      const s0 = createSession(encounters.reverseTolls);
      const { session: s1 } = transition(s0, { type: 'arrive' }, encounters.reverseTolls);
      const { session: s2 } = transition(s1, { type: 'skip_conjecture' }, encounters.reverseTolls);

      // Turn 1
      const { session: s3 } = transition(s2, { type: 'chip', chip: 'end with 13' }, encounters.reverseTolls);
      assert.equal(s3.state, 'understand');
      assert.equal(s3.probeCountInState, 1);

      // Turn 2: cap reached
      const { session: s4, events } = transition(s3, { type: 'chip', chip: 'start coins' }, encounters.reverseTolls);
      assert.equal(s4.state, 'plan');
      assert.equal(s4.probeCountInState, 0);
      assert.ok(events.some(e => e.to === 'plan' && e.reason === 'probe_cap'));
    });
  });

  // --------------------------------------------------------------------------
  // 6. T08 & T09: Plan Phase & Deck Card Selection
  // --------------------------------------------------------------------------
  describe('T08 & T09: Plan Phase & Deck Card Selection', () => {
    it('T08: Selecting a card unlocks workspace and advances to Carry Out', () => {
      const s0 = createSession(encounters.reverseTolls);
      s0.state = 'plan';
      deepFreeze(s0);

      const { session: s1, events } = transition(s0, { type: 'card', cardId: 'work-backwards' }, encounters.reverseTolls);
      assert.equal(s1.state, 'carry_out');
      assert.equal(s1.activeCard, 'work-backwards');
      assert.ok(events.some(e => e.to === 'carry_out' && e.card === 'work-backwards' && e.onTarget === true));
    });

    it('T08b: Selecting off-target card flags onTarget: false for tutor l1 guidance', () => {
      const s0 = createSession(encounters.reverseTolls);
      s0.state = 'plan';
      deepFreeze(s0);

      const { session: s1, events } = transition(s0, { type: 'card', cardId: 'odd-or-even' }, encounters.reverseTolls);
      assert.equal(s1.state, 'carry_out');
      assert.equal(s1.activeCard, 'odd-or-even');
      assert.ok(events.some(e => e.to === 'carry_out' && e.onTarget === false));
    });

    it('T09: Stuck or idle action in Plan escalates hint ladder', () => {
      const s0 = createSession(encounters.reverseTolls);
      s0.state = 'plan';
      s0.hintRung = 'l0';
      s0.hintRungIndex = 0;
      deepFreeze(s0);

      const { session: s1, events } = transition(s0, { type: 'stuck' }, encounters.reverseTolls);
      assert.equal(s1.state, 'plan');
      assert.equal(s1.hintRung, 'l1');
      assert.equal(s1.hintRungIndex, 1);
      assert.ok(events.some(e => e.ladderEscalated === 'l1'));
    });
  });

  // --------------------------------------------------------------------------
  // 7. T10, T11, T12: Carry Out Mechanics & ZPD Ladder Dynamics
  // --------------------------------------------------------------------------
  describe('T10, T11, T12: Carry Out Dynamic Ladder and Mechanics', () => {
    it('T10: Valid progress step fades hint ladder by 1 rung (floor l1) and resets nonProgressCount', () => {
      const s0 = createSession(encounters.reverseTolls);
      s0.state = 'carry_out';
      s0.hintRung = 'l2';
      s0.hintRungIndex = 2;
      s0.nonProgressCount = 1;
      deepFreeze(s0);

      // Gate 2: undo 9, halve -> 11
      const orderStep = { type: 'step', payload: { action: 'order', gateIndex: 2, order: ['add', 'divide'] } };
      const { session: s1 } = transition(s0, orderStep, encounters.reverseTolls);
      assert.equal(s1.hintRung, 'l1');
      assert.equal(s1.hintRungIndex, 1);
      assert.equal(s1.nonProgressCount, 0);

      // Second valid step respects floor l1 (does not drop to l0)
      const valStep = { type: 'step', payload: { action: 'value', gateIndex: 2, value: 11 } };
      const { session: s2 } = transition(s1, valStep, encounters.reverseTolls);
      assert.equal(s2.hintRung, 'l1');
      assert.equal(s2.hintRungIndex, 1);
    });

    it('T11: Two consecutive wrong/non-progress steps advance ladder by 1 rung', () => {
      const s0 = createSession(encounters.reverseTolls);
      s0.state = 'carry_out';
      s0.hintRung = 'l1';
      s0.hintRungIndex = 1;
      s0.nonProgressCount = 0;
      deepFreeze(s0);

      // Wrong step 1
      const badStep1 = { type: 'step', payload: { action: 'value', gateIndex: 2, value: 999 } };
      const { session: s1 } = transition(s0, badStep1, encounters.reverseTolls);
      assert.equal(s1.nonProgressCount, 1);
      assert.equal(s1.hintRung, 'l1');

      // Wrong step 2: triggers ladder escalation to l2
      const badStep2 = { type: 'step', payload: { action: 'value', gateIndex: 2, value: 888 } };
      const { session: s2, events } = transition(s1, badStep2, encounters.reverseTolls);
      assert.equal(s2.nonProgressCount, 0);
      assert.equal(s2.hintRung, 'l2');
      assert.equal(s2.hintRungIndex, 2);
      assert.ok(events.some(e => e.type === 'ladder.escalate' && e.ladder === 'l2'));
    });

    it('T12: Ladder reaching l4 transitions to Simpler Problem sub-loop', () => {
      const s0 = createSession(encounters.reverseTolls);
      s0.state = 'carry_out';
      s0.hintRung = 'l2';
      s0.hintRungIndex = 2;
      s0.nonProgressCount = 1;
      deepFreeze(s0);

      // Another wrong step moves from l2 to l4 (index 3)
      const badStep = { type: 'step', payload: { action: 'value', gateIndex: 2, value: 0 } };
      const { session: s1, events } = transition(s0, badStep, encounters.reverseTolls);
      assert.equal(s1.state, 'simpler_problem');
      assert.equal(s1.hintRung, 'l4');
      assert.ok(s1.simplerProblemState);
      assert.equal(s1.simplerProblemState.statement, encounters.reverseTolls.parts[0].ladder.l4.statement);
      assert.ok(events.some(e => e.to === 'simpler_problem'));
    });

    it('T12b: Selecting tiny-case card directly opens Simpler Problem sub-loop', () => {
      const s0 = createSession(encounters.reverseTolls);
      s0.state = 'carry_out';
      deepFreeze(s0);

      const { session: s1 } = transition(s0, { type: 'card', cardId: 'tiny-case' }, encounters.reverseTolls);
      assert.equal(s1.state, 'simpler_problem');
      assert.ok(s1.simplerProblemState);
    });
  });

  // --------------------------------------------------------------------------
  // 8. T13 & T14: Simpler Problem Sub-loop Resolution
  // --------------------------------------------------------------------------
  describe('T13 & T14: Simpler Problem Sub-loop Resolution', () => {
    it('T13: Solving simpler problem returns to Carry Out at l1 with bridge probe', () => {
      const s0 = createSession(encounters.reverseTolls);
      s0.state = 'simpler_problem';
      s0.simplerProblemState = {
        statement: 'Tiny road',
        answer: { type: 'integer', value: 11 },
        l3Hint: 'Undo',
        attempts: 0,
        completed: false
      };
      deepFreeze(s0);

      const { session: s1, events } = transition(s0, { type: 'simpler_submit', value: 11 }, encounters.reverseTolls);
      assert.equal(s1.state, 'carry_out');
      assert.equal(s1.hintRung, 'l1');
      assert.equal(s1.hintRungIndex, 1);
      assert.equal(s1.simplerProblemState, null);
      assert.ok(events.some(e => e.bridge === true && e.reason === 'solved'));
    });

    it('T14: Failing simpler problem twice delivers l3 worked step and returns to Carry Out at l1', () => {
      const s0 = createSession(encounters.reverseTolls);
      s0.state = 'simpler_problem';
      s0.simplerProblemState = {
        statement: 'Tiny road',
        answer: { type: 'integer', value: 11 },
        l3Hint: 'Undo',
        attempts: 0,
        completed: false
      };

      // Attempt 1: wrong
      const { session: s1 } = transition(s0, { type: 'simpler_submit', value: 99 }, encounters.reverseTolls);
      assert.equal(s1.state, 'simpler_problem');
      assert.equal(s1.simplerProblemState.attempts, 1);

      // Attempt 2: wrong -> returns to carry_out
      const { session: s2, events } = transition(s1, { type: 'simpler_submit', value: 88 }, encounters.reverseTolls);
      assert.equal(s2.state, 'carry_out');
      assert.equal(s2.hintRung, 'l1');
      assert.equal(s2.simplerProblemL3Unlocked, true);
      assert.equal(s2.simplerProblemState, null);
      assert.ok(events.some(e => e.bridge === true && e.reason === 'max_attempts_l3_given'));
    });
  });

  // --------------------------------------------------------------------------
  // 9. T15 & T16: Submission Dial & Parent Interventions
  // --------------------------------------------------------------------------
  describe('T15 & T16: Submission Dial & Parent Interventions', () => {
    it('T15: Correct dial submission advances to Look Back', () => {
      const s0 = createSession(encounters.reverseTolls);
      s0.state = 'carry_out';
      deepFreeze(s0);

      const { session: s1, events } = transition(s0, { type: 'submit', value: 6 }, encounters.reverseTolls);
      assert.equal(s1.state, 'look_back');
      assert.equal(s1.attempts, 1);
      assert.ok(events.some(e => e.to === 'look_back'));
    });

    it('T16: Wrong dial submission increments attempts and returns to Carry Out', () => {
      const s0 = createSession(encounters.reverseTolls);
      s0.state = 'carry_out';
      deepFreeze(s0);

      const { session: s1 } = transition(s0, { type: 'submit', value: 10 }, encounters.reverseTolls);
      assert.equal(s1.state, 'carry_out');
      assert.equal(s1.attempts, 1);
      assert.equal(s1.parentFlag, false);

      // 3 wrong attempts triggers parent dashboard flag and l3 offer
      const { session: s2 } = transition(s1, { type: 'submit', value: 12 }, encounters.reverseTolls);
      const { session: s3, events } = transition(s2, { type: 'submit', value: 14 }, encounters.reverseTolls);
      assert.equal(s3.attempts, 3);
      assert.equal(s3.parentFlag, true);
      assert.ok(events.some(e => e.type === 'parent.flag' && e.l3Offered === true));
    });
  });

  // --------------------------------------------------------------------------
  // 10. T17 & T18: Look Back & Parent Waiver
  // --------------------------------------------------------------------------
  describe('T17 & T18: Look Back & Parent Waiver', () => {
    it('T17: Correct reflection answer seals node and unlocks Codex', () => {
      const s0 = createSession(encounters.reverseTolls);
      s0.state = 'look_back';
      deepFreeze(s0);

      // Option 0 in reverseTolls: kind 'verify', check { type: 'integer', value: 13 }
      const action = { type: 'lookback', kind: 'verify', value: 13 };
      const { session: s1, events } = transition(s0, action, encounters.reverseTolls);
      assert.equal(s1.state, 'sealed');
      assert.equal(s1.lookBackCompleted, true);
      assert.ok(events.some(e => e.type === 'node.sealed'));

      // Check client safe view has codex
      const view = getClientSafeView(s1, encounters.reverseTolls);
      assert.ok(view.codex);
      assert.equal(view.codex.childName, 'The Socks-and-Shoes Rule');
    });

    it('T18: Parent waiver seals node with waived = true', () => {
      const s0 = createSession(encounters.reverseTolls);
      s0.state = 'look_back';
      s0.parentWaiver = false;
      deepFreeze(s0);

      const { session: s1, events } = transition(s0, { type: 'waive' }, encounters.reverseTolls);
      assert.equal(s1.state, 'sealed');
      assert.equal(s1.parentWaiver, true);
      assert.equal(s1.chapterWaiverUsed, true);
      assert.ok(events.some(e => e.waived === true));
    });

    it('T18b: Second parent waiver in same chapter is rejected (max 1 per chapter)', () => {
      const s0 = createSession(encounters.reverseTolls);
      s0.state = 'look_back';
      s0.parentWaiver = true; // Already used
      deepFreeze(s0);

      const { session: s1, events } = transition(s0, { type: 'waive' }, encounters.reverseTolls);
      assert.equal(s1.state, 'look_back'); // Did not seal!
      assert.equal(events.length, 0);
    });
  });

  // --------------------------------------------------------------------------
  // 11. T19 & Terminal Progression
  // --------------------------------------------------------------------------
  describe('T19 & Terminal Progression', () => {
    it('T19: Multi-part encounter advances from Sealed to Arrive for the next part', () => {
      const s0 = createSession(encounters.darkVault);
      s0.currentPartId = 'a';
      s0.state = 'sealed';
      assert.equal(hasMoreParts(s0, encounters.darkVault), true);
      deepFreeze(s0);

      const { session: s1, events } = transition(s0, { type: 'next_part' }, encounters.darkVault);
      assert.equal(s1.state, 'arrive');
      assert.equal(s1.currentPartId, 'b');
      assert.equal(s1.conjectures, 0);
      assert.equal(s1.attempts, 0);
      assert.ok(events.some(e => e.to === 'arrive' && e.nextPartId === 'b'));
    });

    it('Terminal: Sealing final part completes encounter and transitions to Map', () => {
      const s0 = createSession(encounters.darkVault);
      s0.currentPartId = 'c'; // Final part
      s0.state = 'sealed';
      assert.equal(hasMoreParts(s0, encounters.darkVault), false);
      deepFreeze(s0);

      const { session: s1, events } = transition(s0, { type: 'next_part' }, encounters.darkVault);
      assert.equal(s1.state, 'map');
      assert.equal(s1.completed, true);
      assert.equal(isTerminal(s1), true);
      assert.ok(events.some(e => e.type === 'session.end' && e.reason === 'finished'));
    });
  });

  // --------------------------------------------------------------------------
  // 12. Parent Real-Time Overrides
  // --------------------------------------------------------------------------
  describe('Parent Real-Time Overrides', () => {
    it('sets hint level override in any state', () => {
      const s0 = createSession(encounters.reverseTolls);
      s0.state = 'carry_out';
      deepFreeze(s0);

      const { session: s1 } = transition(s0, { type: 'parent_override', hintRung: 'l3' }, encounters.reverseTolls);
      assert.equal(s1.hintRung, 'l3');
      assert.equal(s1.hintRungIndex, 4);
    });

    it('toggles scribe mode in any state', () => {
      const s0 = createSession(encounters.reverseTolls);
      assert.equal(s0.parentScribe, false);
      deepFreeze(s0);

      const { session: s1 } = transition(s0, { type: 'parent_scribe', enabled: true }, encounters.reverseTolls);
      assert.equal(s1.parentScribe, true);
    });
  });
});
