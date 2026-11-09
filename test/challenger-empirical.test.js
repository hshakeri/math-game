/**
 * Castle of Theorems — Milestone M1 Iteration 2 Empirical Challenger Test Suite
 * test/challenger-empirical.test.js
 *
 * Empirical verification of:
 * 1. Transition T05 (second conjecture in understand, cap 2, shortcut, no state mutation shortcuts)
 * 2. Immutability stress with recursive deepFreeze() in simpler_problem, carry_out, understand
 * 3. Single "stuck" click in carry_out immediate escalation & nonProgressCount reset
 * 4. Chapter waiver persistence and disallowance in look_back
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

// Recursive deep freeze to enforce absolute immutability
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

describe('Empirical Challenger — Milestone M1 Iteration 2 Verification', () => {

  // ==========================================================================
  // CHALLENGE 1: Transition T05 (Second conjecture in Understand)
  // ==========================================================================
  describe('Challenge 1: Transition T05 semantics in Understand phase', () => {

    it('T05 Lifecycle across ALL 4 encounters: first wrong -> understand (conjectures=1), second wrong -> understand (conjectures=2), third -> ignored', () => {
      for (const [name, enc] of Object.entries(encounters)) {
        const s0 = createSession(enc);
        deepFreeze(s0);

        // 1. Arrive -> Conjecture
        const { session: s1 } = transition(s0, { type: 'arrive' }, enc);
        assert.equal(s1.state, 'conjecture');
        assert.equal(s1.conjectures, 0);
        deepFreeze(s1);

        // 2. First WRONG conjecture -> Understand (conjectures = 1)
        const wrongVal1 = 999999;
        const { session: s2, events: e2 } = transition(s1, {
          type: 'conjecture',
          stem: 'think',
          value: wrongVal1,
          reason: 'first wrong guess'
        }, enc);
        assert.equal(s2.state, 'understand', `${name}: first wrong conjecture should transition to understand`);
        assert.equal(s2.conjectures, 1, `${name}: conjectures count should be 1`);
        assert.ok(e2.some(e => e.type === 'engine.transition' && e.to === 'understand'));
        deepFreeze(s2);

        // 3. Second WRONG conjecture in understand (NO state mutation shortcut!)
        // Verify s2.state is still 'understand'
        assert.equal(s2.state, 'understand');
        const wrongVal2 = 888888;
        const { session: s3, events: e3 } = transition(s2, {
          type: 'conjecture',
          stem: 'think',
          value: wrongVal2,
          reason: 'second wrong guess'
        }, enc);
        assert.equal(s3.state, 'understand', `${name}: second wrong conjecture should remain in understand`);
        assert.equal(s3.conjectures, 2, `${name}: conjectures count should increment to 2`);
        assert.ok(e3.some(e => e.type === 'engine.transition' && e.from === 'understand' && e.to === 'understand' && e.conjectures === 2));
        deepFreeze(s3);

        // 4. Third conjecture attempt in understand: completely ignored (counter stays at 2)
        const historyLenBefore = s3.history.length;
        const { session: s4, events: e4 } = transition(s3, {
          type: 'conjecture',
          stem: 'think',
          value: 777777,
          reason: 'third conjecture attempt should be ignored'
        }, enc);
        assert.equal(s4.state, 'understand', `${name}: state must remain understand`);
        assert.equal(s4.conjectures, 2, `${name}: conjectures counter must remain 2`);
        assert.equal(e4.length, 0, `${name}: no events emitted on ignored third conjecture`);
        assert.equal(s4.history.length, historyLenBefore, `${name}: no history entry added on ignored conjecture`);
        deepFreeze(s4);

        // 5. Even a RIGHT conjecture on 3rd attempt is ignored because conjecture window is closed
        const rightVal = enc.parts[0].answer.type === 'set' ? enc.parts[0].answer.values : enc.parts[0].answer.value || enc.parts[0].answer.correct;
        const { session: s5, events: e5 } = transition(s4, {
          type: 'conjecture',
          stem: 'think',
          value: rightVal,
          reason: 'now I actually know the real answer and proof'
        }, enc);
        assert.equal(s5.state, 'understand', `${name}: right conjecture after window closed must be ignored`);
        assert.equal(s5.conjectures, 2, `${name}: conjectures must remain 2`);
        assert.equal(e5.length, 0, `${name}: no shortcut events after conjecture cap reached`);
      }
    });

    it('T05b: Second RIGHT conjecture in understand with >= 3 words shortcuts directly to look_back across all encounters', () => {
      for (const [name, enc] of Object.entries(encounters)) {
        const s0 = createSession(enc);
        const { session: s1 } = transition(s0, { type: 'arrive' }, enc);
        const { session: s2 } = transition(s1, { type: 'conjecture', value: 999999, reason: 'wrong guess' }, enc);
        assert.equal(s2.state, 'understand');
        assert.equal(s2.conjectures, 1);
        deepFreeze(s2);

        // Child submits correct conjecture with >= 3 words directly from understand state
        const rightVal = enc.parts[0].answer.type === 'set' ? enc.parts[0].answer.values : enc.parts[0].answer.value || enc.parts[0].answer.correct;
        const { session: s3, events: e3 } = transition(s2, {
          type: 'conjecture',
          stem: 'notice',
          value: rightVal,
          reason: 'I deduced the mathematical pattern directly'
        }, enc);

        assert.equal(s3.state, 'look_back', `${name}: should shortcut directly to look_back`);
        assert.equal(s3.shortcut, true, `${name}: shortcut flag must be true`);
        assert.ok(e3.some(e => e.type === 'engine.transition' && e.from === 'understand' && e.to === 'look_back' && e.shortcut === true));
        assert.ok(e3.some(e => e.type === 'shortcut' && e.shortcut === true));
      }
    });

    it('T05c: Second RIGHT conjecture in understand with < 3 words triggers skeptic prompt, staying in understand at conjectures=1', () => {
      const enc = encounters.reverseTolls;
      const s0 = createSession(enc);
      const { session: s1 } = transition(s0, { type: 'arrive' }, enc);
      const { session: s2 } = transition(s1, { type: 'conjecture', value: 999999, reason: 'wrong' }, enc);
      assert.equal(s2.state, 'understand');
      assert.equal(s2.conjectures, 1);
      deepFreeze(s2);

      // Submit correct value with 2 words ("just guessed")
      const { session: s3, events: e3 } = transition(s2, {
        type: 'conjecture',
        stem: 'think',
        value: 6,
        reason: 'just guessed'
      }, enc);

      assert.equal(s3.state, 'understand');
      assert.equal(s3.conjectures, 1, 'conjectures counter stays 1 on skeptic probe');
      assert.ok(e3.some(e => e.type === 'conjecture.skeptic_prompt'));

      // Now child replies to skeptic prompt with >= 3 words -> shortcuts to look_back
      deepFreeze(s3);
      const { session: s4, events: e4 } = transition(s3, {
        type: 'conjecture',
        stem: 'think',
        value: 6,
        reason: 'because thirteen plus nine is twenty-two'
      }, enc);

      assert.equal(s4.state, 'look_back');
      assert.equal(s4.shortcut, true);
      assert.ok(e4.some(e => e.type === 'shortcut'));
    });

    it('Zero state mutation shortcuts: verify no test code needs `s2.state = "conjecture"`', () => {
      const s0 = createSession(encounters.castleKeep);
      const s1 = transition(s0, { type: 'arrive' }, encounters.castleKeep).session;
      const s2 = transition(s1, { type: 'conjecture', value: 999 }, encounters.castleKeep).session;

      // Pure assertion: s2 is in 'understand', NOT 'conjecture'
      assert.equal(s2.state, 'understand');
      // Transitioning directly without touching s2.state
      const s3 = transition(s2, { type: 'conjecture', value: 998 }, encounters.castleKeep).session;
      assert.equal(s3.state, 'understand');
      assert.equal(s3.conjectures, 2);
    });
  });

  // ==========================================================================
  // CHALLENGE 2: Immutability Stress with Recursive deepFreeze()
  // ==========================================================================
  describe('Challenge 2: Immutability stress across multi-turn sequences', () => {

    it('Stress tests simplerProblemState immutability: deepFreeze before every turn, attempts increments in clone without mutating original', () => {
      const enc = encounters.reverseTolls;
      let session = createSession(enc);
      session = transition(session, { type: 'arrive' }, enc).session;
      session = transition(session, { type: 'skip_conjecture' }, enc).session;
      session = transition(session, { type: 'say', classification: { unknown: true, data: true, condition: true } }, enc).session;
      session = transition(session, { type: 'card', cardId: 'draw-it' }, enc).session;
      assert.equal(session.state, 'carry_out');
      session = transition(session, { type: 'card', cardId: 'tiny-case' }, enc).session;
      assert.equal(session.state, 'simpler_problem');
      assert.ok(session.simplerProblemState);
      assert.equal(session.simplerProblemState.attempts, 0);

      // Deep freeze state 0 of simpler_problem
      deepFreeze(session);
      const s0 = session;

      // Turn 1: Wrong submit on frozen s0
      const res1 = transition(s0, { type: 'simpler_submit', value: 999999 }, enc);
      const s1 = res1.session;

      assert.equal(s0.simplerProblemState.attempts, 0, 'Original s0.simplerProblemState must NOT have been mutated');
      assert.equal(s1.simplerProblemState.attempts, 1, 'Cloned s1.simplerProblemState must have attempts = 1');
      assert.equal(s1.state, 'simpler_problem');
      assert.ok(res1.events.some(e => e.type === 'simpler_problem.wrong' && e.attempts === 1));

      // Deep freeze state 1 of simpler_problem
      deepFreeze(s1);

      // Turn 2: Second wrong submit on frozen s1 -> triggers worked step l3 and returns to carry_out
      const res2 = transition(s1, { type: 'simpler_submit', value: 999999 }, enc);
      const s2 = res2.session;

      assert.equal(s1.simplerProblemState.attempts, 1, 'Original s1.simplerProblemState must NOT have been mutated');
      assert.equal(s2.state, 'carry_out');
      assert.equal(s2.hintRung, 'l1');
      assert.equal(s2.simplerProblemL3Unlocked, true);
      assert.equal(s2.simplerProblemState, null);
      assert.ok(res2.events.some(e => e.type === 'engine.transition' && e.reason === 'max_attempts_l3_given'));

      // Deep freeze state 2 of carry_out
      deepFreeze(s2);

      // Turn 3: Also test branching from s0 with correct simpler answer
      const res1_correct = transition(s0, { type: 'simpler_submit', value: s0.simplerProblemState.answer.value }, enc);
      const s1_corr = res1_correct.session;
      assert.equal(s0.simplerProblemState.attempts, 0, 's0 untouched during correct branch');
      assert.equal(s1_corr.state, 'carry_out');
      assert.equal(s1_corr.hintRung, 'l1');
      assert.equal(s1_corr.simplerProblemState, null);
    });

    it('Stress tests carry_out multi-turn immutability: deepFreeze before say, step, stuck, and submit across all 4 encounters', () => {
      for (const [name, enc] of Object.entries(encounters)) {
        let s = createSession(enc);
        s = transition(s, { type: 'arrive' }, enc).session;
        s = transition(s, { type: 'skip_conjecture' }, enc).session;
        s = transition(s, { type: 'say', classification: { unknown: true, data: true, condition: true } }, enc).session;
        // Select first card in encounter
        const cardId = enc.cards[0];
        s = transition(s, { type: 'card', cardId }, enc).session;
        assert.equal(s.state, 'carry_out');

        // Turn 1: say dialogue
        deepFreeze(s);
        let nextRes = transition(s, { type: 'say', text: 'I am examining the problem.' }, enc);
        s = nextRes.session;
        assert.equal(s.state, 'carry_out');
        assert.ok(nextRes.events.some(e => e.type === 'child.say'));

        // Turn 2: invalid step (wrong step)
        deepFreeze(s);
        nextRes = transition(s, { type: 'step', payload: { action: 'invalid_action' } }, enc);
        s = nextRes.session;
        assert.equal(s.state, 'carry_out');
        assert.equal(s.nonProgressCount, 1);

        // Turn 3: stuck click
        deepFreeze(s);
        nextRes = transition(s, { type: 'stuck' }, enc);
        s = nextRes.session;
        assert.equal(s.nonProgressCount, 0, `${name}: stuck must reset nonProgressCount`);

        // Turn 4: wrong submit dial
        if (s.state === 'carry_out') {
          deepFreeze(s);
          nextRes = transition(s, { type: 'submit', value: 999999 }, enc);
          s = nextRes.session;
          assert.equal(s.attempts, 1);
        }

        // Turn 5: parent override rung
        deepFreeze(s);
        nextRes = transition(s, { type: 'parent_override', hintRung: 'l2' }, enc);
        s = nextRes.session;
        assert.equal(s.hintRung, 'l2');

        // Turn 6: parent scribe toggle
        deepFreeze(s);
        nextRes = transition(s, { type: 'parent_scribe', enabled: true }, enc);
        s = nextRes.session;
        assert.equal(s.parentScribe, true);
      }
    });

    it('Stress tests understand multi-turn immutability with repeated probe classifications', () => {
      const enc = encounters.reverseTolls;
      let s = createSession(enc);
      s = transition(s, { type: 'arrive' }, enc).session;
      s = transition(s, { type: 'skip_conjecture' }, enc).session;
      assert.equal(s.state, 'understand');
      assert.equal(s.probeCountInState, 0);

      // Probe 1: incomplete classification
      deepFreeze(s);
      let res = transition(s, { type: 'say', text: 'unknown is coins', classification: { unknown: true, data: false, condition: false } }, enc);
      s = res.session;
      assert.equal(s.state, 'understand');
      assert.equal(s.probeCountInState, 1);

      // Probe 2: reaches cap of 2 -> advances to plan
      deepFreeze(s);
      res = transition(s, { type: 'say', text: 'data is 13 coins', classification: { unknown: true, data: true, condition: false } }, enc);
      s = res.session;
      assert.equal(s.state, 'plan');
      assert.equal(s.probeCountInState, 0);
    });
  });

  // ==========================================================================
  // CHALLENGE 3: Single "stuck" Click Escalation & Reset in Carry Out
  // ==========================================================================
  describe('Challenge 3: Single "stuck" click in carry_out', () => {

    it('escalates from l0 to l1 immediately and resets nonProgressCount to 0', () => {
      const enc = encounters.reverseTolls;
      let s = createSession(enc);
      s = transition(s, { type: 'arrive' }, enc).session;
      s = transition(s, { type: 'skip_conjecture' }, enc).session;
      s = transition(s, { type: 'say', classification: { unknown: true, data: true, condition: true } }, enc).session;
      s = transition(s, { type: 'card', cardId: enc.cards[0] }, enc).session;

      // Force to l0 and nonProgressCount = 1
      s.hintRung = 'l0';
      s.hintRungIndex = 0;
      s.nonProgressCount = 1;
      deepFreeze(s);

      const res = transition(s, { type: 'stuck' }, enc);
      assert.equal(res.session.hintRung, 'l1');
      assert.equal(res.session.hintRungIndex, 1);
      assert.equal(res.session.nonProgressCount, 0, 'nonProgressCount must reset to 0');
      assert.ok(res.events.some(e => e.type === 'ladder.escalate' && e.ladder === 'l1' && e.reason === 'stuck'));
    });

    it('escalates from l1 to l2 immediately and resets nonProgressCount to 0', () => {
      const enc = encounters.reverseTolls;
      let s = createSession(enc);
      s = transition(s, { type: 'arrive' }, enc).session;
      s = transition(s, { type: 'skip_conjecture' }, enc).session;
      s = transition(s, { type: 'say', classification: { unknown: true, data: true, condition: true } }, enc).session;
      s = transition(s, { type: 'card', cardId: enc.cards[0] }, enc).session;

      s.hintRung = 'l1';
      s.hintRungIndex = 1;
      s.nonProgressCount = 1;
      deepFreeze(s);

      const res = transition(s, { type: 'stuck' }, enc);
      assert.equal(res.session.hintRung, 'l2');
      assert.equal(res.session.hintRungIndex, 2);
      assert.equal(res.session.nonProgressCount, 0, 'nonProgressCount must reset to 0');
      assert.ok(res.events.some(e => e.type === 'ladder.escalate' && e.ladder === 'l2' && e.reason === 'stuck'));
    });

    it('escalates from l2 to l4 (simpler_problem) on single stuck click', () => {
      const enc = encounters.reverseTolls;
      let s = createSession(enc);
      s = transition(s, { type: 'arrive' }, enc).session;
      s = transition(s, { type: 'skip_conjecture' }, enc).session;
      s = transition(s, { type: 'say', classification: { unknown: true, data: true, condition: true } }, enc).session;
      s = transition(s, { type: 'card', cardId: enc.cards[0] }, enc).session;

      s.hintRung = 'l2';
      s.hintRungIndex = 2;
      s.nonProgressCount = 1;
      deepFreeze(s);

      const res = transition(s, { type: 'stuck' }, enc);
      assert.equal(res.session.hintRung, 'l4');
      assert.equal(res.session.hintRungIndex, 3);
      assert.equal(res.session.state, 'simpler_problem');
      assert.ok(res.session.simplerProblemState);
      assert.equal(res.session.simplerProblemState.attempts, 0);
      assert.equal(res.session.nonProgressCount, 0);
      assert.ok(res.events.some(e => e.type === 'engine.transition' && e.to === 'simpler_problem' && e.trigger === 'ladder_l4'));
    });
  });

  // ==========================================================================
  // CHALLENGE 4: Chapter Waiver Persistence & Look Back Disallowance
  // ==========================================================================
  describe('Challenge 4: Chapter waiver persistence and Look Back enforcement', () => {

    it('session initialized with { chapterWaiverUsed: true } rejects parent waiver in Look Back', () => {
      const enc = encounters.reverseTolls;
      const s0 = createSession(enc, { chapterWaiverUsed: true });
      assert.equal(s0.chapterWaiverUsed, true);
      assert.equal(s0.parentWaiver, true);

      // Fast forward to look_back via right conjecture shortcut
      const s1 = transition(s0, { type: 'arrive' }, enc).session;
      const s2 = transition(s1, {
        type: 'conjecture',
        stem: 'think',
        value: 6,
        reason: 'thirteen plus nine is twenty two halve it'
      }, enc).session;
      assert.equal(s2.state, 'look_back');
      assert.equal(s2.chapterWaiverUsed, true);
      assert.equal(s2.parentWaiver, true);

      // Parent attempts to waive Look Back
      deepFreeze(s2);
      const res = transition(s2, { type: 'waive' }, enc);
      assert.equal(res.session.state, 'look_back', 'State must remain look_back');
      assert.equal(res.session.lookBackCompleted, false, 'lookBackCompleted must remain false');
      assert.equal(res.session.isSealed, false, 'isSealed must remain false');
      assert.equal(res.events.length, 0, 'No waiver events should be emitted');
      assert.ok(!res.session.history.some(h => h.action === 'waive_lookback'));
    });

    it('session initialized with { parentWaiver: true } also rejects waiver in Look Back', () => {
      const enc = encounters.reverseTolls;
      const s0 = createSession(enc, { parentWaiver: true });
      assert.equal(s0.chapterWaiverUsed, true);
      assert.equal(s0.parentWaiver, true);

      const s1 = transition(s0, { type: 'arrive' }, enc).session;
      const s2 = transition(s1, {
        type: 'conjecture',
        stem: 'think',
        value: 6,
        reason: 'thirteen plus nine is twenty two halve it'
      }, enc).session;
      assert.equal(s2.state, 'look_back');

      deepFreeze(s2);
      const res = transition(s2, { type: 'waive' }, enc);
      assert.equal(res.session.state, 'look_back');
      assert.equal(res.session.lookBackCompleted, false);
    });

    it('multi-encounter chapter waiver propagation: waiver in encounter 1 prevents waiver in encounter 2', () => {
      // Encounter 1: Chasm of Reverse Tolls (starts with waiver available)
      const enc1 = encounters.reverseTolls;
      let sA = createSession(enc1);
      assert.equal(sA.chapterWaiverUsed, false);
      sA = transition(sA, { type: 'arrive' }, enc1).session;
      sA = transition(sA, { type: 'conjecture', value: 6, reason: 'I worked backwards from the goal' }, enc1).session;
      assert.equal(sA.state, 'look_back');

      // Parent uses the chapter waiver on encounter 1
      const waiveResA = transition(sA, { type: 'waive' }, enc1);
      sA = waiveResA.session;
      assert.equal(sA.state, 'sealed');
      assert.equal(sA.chapterWaiverUsed, true);
      assert.equal(sA.parentWaiver, true);
      assert.ok(waiveResA.events.some(e => e.type === 'engine.transition' && e.waived === true));

      // Encounter 2: Courtyard of Five Shields (initialized with chapterWaiverUsed from encounter 1)
      const enc2 = encounters.fiveShields;
      let sB = createSession(enc2, { chapterWaiverUsed: sA.chapterWaiverUsed });
      assert.equal(sB.chapterWaiverUsed, true);
      assert.equal(sB.parentWaiver, true);

      sB = transition(sB, { type: 'arrive' }, enc2).session;
      sB = transition(sB, { type: 'conjecture', value: 30, reason: 'I solved the perimeter equation' }, enc2).session;
      assert.equal(sB.state, 'look_back');

      // Parent attempts to waive again in Encounter 2 -> REJECTED
      deepFreeze(sB);
      const waiveResB = transition(sB, { type: 'waive' }, enc2);
      assert.equal(waiveResB.session.state, 'look_back', 'Second chapter waiver must be rejected');
      assert.equal(waiveResB.session.lookBackCompleted, false);

      // Child must solve reflection legitimately to seal
      const lookbackRes = transition(waiveResB.session, { type: 'lookback', kind: 'verify', value: 84 }, enc2);
      assert.equal(lookbackRes.session.state, 'sealed');
      assert.equal(lookbackRes.session.lookBackCompleted, true);
      assert.ok(lookbackRes.events.some(e => e.type === 'node.sealed'));
    });
  });
});
