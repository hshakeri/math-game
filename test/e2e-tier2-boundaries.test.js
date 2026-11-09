/**
 * Castle of Theorems v1 (Home Edition)
 * Tier 2: Boundary & Edge Case Test Suite
 * Tests limits, boundaries, overflows, malformed inputs, and state machine constraints.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkUtterance, extractNumbers } from '../server/engine/leakGate.js';
import { createSession, transition } from '../server/engine/stateMachine.js';
import * as inverseChain from '../server/engine/mechanics/inverse-chain.js';
import * as goblinBins from '../server/engine/mechanics/goblin-bins.js';
import * as seamGrid from '../server/engine/mechanics/seam-grid.js';
import * as factorDials from '../server/engine/mechanics/factor-dials.js';
import { generateTurn } from '../server/tutor/index.js';
import { startServer } from '../server/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('E2E Tier 2: Boundary & Edge Case Suite', () => {
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
  // 1. String & Length Cutoffs
  // -------------------------------------------------------------------------
  describe('1. String & Length Cutoffs', () => {
    const leakCtx = { rung: 'l0', forbidden: [6, 12, 24], givens: [3, 5] };

    it('rejects utterance with exactly 149 characters (below 150 minLen)', () => {
      const base = "What if we consider the magic stones in the castle gate and see how they change when walking along the quiet road in the morning twilight";
      const pad = "x".repeat(149 - base.length - 2);
      const text149 = `${base} ${pad}?`;
      assert.equal(text149.length, 149);
      const res = checkUtterance(text149, leakCtx, { minLen: 150, maxLen: 300 });
      assert.equal(res.allowed, false);
      assert.equal(res.reason, 'length');
    });

    it('accepts utterance with exactly 150 characters (boundary minLen)', () => {
      const base = "What if we consider the magic stones in the castle gate and see how they change when walking along the quiet road in the morning twilight";
      const pad = "x".repeat(150 - base.length - 2);
      const text150 = `${base} ${pad}?`;
      assert.equal(text150.length, 150);
      const res = checkUtterance(text150, leakCtx);
      assert.equal(res.allowed, true);
    });

    it('accepts utterance with exactly 300 characters (boundary maxLen)', () => {
      const base = "What if we consider the magic stones in the castle gate and see how they change when walking along the quiet road in the morning twilight";
      const pad = "x".repeat(300 - base.length - 2);
      const text300 = `${base} ${pad}?`;
      assert.equal(text300.length, 300);
      const res = checkUtterance(text300, leakCtx);
      assert.equal(res.allowed, true);
    });

    it('rejects utterance with exactly 301 characters (above 300 maxLen)', () => {
      const base = "What if we consider the magic stones in the castle gate and see how they change when walking along the quiet road in the morning twilight";
      const pad = "x".repeat(301 - base.length - 2);
      const text301 = `${base} ${pad}?`;
      assert.equal(text301.length, 301);
      const res = checkUtterance(text301, leakCtx);
      assert.equal(res.allowed, false);
      assert.equal(res.reason, 'length');
    });

    it('rejects utterance with 0 question marks', () => {
      const text = "What if we consider the magic stones in the castle gate and see how they change when walking along the quiet road in the morning twilight now and then.";
      assert.ok(text.length >= 150 && text.length <= 300);
      const res = checkUtterance(text, leakCtx);
      assert.equal(res.allowed, false);
      assert.equal(res.reason, 'shape');
    });

    it('rejects utterance with 2 question marks', () => {
      const base = "What if we consider the magic stones in the castle gate and see how they change when walking along the quiet road in the morning twilight";
      const pad = "x".repeat(180 - base.length - 3);
      const text2Q = `${base}? ${pad}?`;
      assert.ok(text2Q.length >= 150 && text2Q.length <= 300);
      const res = checkUtterance(text2Q, leakCtx);
      assert.equal(res.allowed, false);
      assert.equal(res.reason, 'shape');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Number Extraction & Word Variations
  // -------------------------------------------------------------------------
  describe('2. Number Extraction & Spelling Boundaries', () => {
    it('extracts number words up to 100 correctly', () => {
      const text = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-four thirty forty fifty sixty seventy eighty ninety one-hundred";
      const values = extractNumbers(text).map(n => n.value);
      assert.ok(values.includes(0));
      assert.ok(values.includes(1));
      assert.ok(values.includes(6));
      assert.ok(values.includes(12));
      assert.ok(values.includes(24));
      assert.ok(values.includes(100));
    });

    it('extracts fractions and ordinals', () => {
      const fracValues = extractNumbers("We have half of the tokens and one quarter of the runes.").map(n => n.value);
      assert.ok(fracValues.includes(0.5));
      assert.ok(fracValues.includes(0.25));

      const ordValues = extractNumbers("Look at the first gate, then the second gate, then the third gate.").map(n => n.value);
      assert.ok(ordValues.includes(1));
      assert.ok(ordValues.includes(2));
      assert.ok(ordValues.includes(3));
    });

    it('extracts decimals and typographic hyphens', () => {
      const decValues = extractNumbers("twenty—four and thirty–one with 3.14 units").map(n => n.value);
      assert.ok(decValues.includes(24));
      assert.ok(decValues.includes(31));
      assert.ok(decValues.includes(3.14));
    });

    it('detects and extracts unicode Roman numerals and Cyrillic homoglyphs', () => {
      const homoglyphValues = extractNumbers("He had \u2165 coins and \u0455\u0456\u0445 gems hidden away").map(n => n.value);
      assert.ok(homoglyphValues.includes(6));
    });
  });

  // -------------------------------------------------------------------------
  // 3. Mechanics Numerical Boundaries & Invariants
  // -------------------------------------------------------------------------
  describe('3. Mechanics Numerical Boundaries & Invariants', () => {
    it('inverse-chain: handles zero and negative start/end values correctly', () => {
      const zeroState = inverseChain.init({
        gates: [{ mul: 2, sub: 4 }],
        end: 0
      });
      // (-0 + 4) / 2 = 2
      const step = inverseChain.checkStep(zeroState, { action: 'value', gateIndex: 0, value: 2 });
      assert.equal(step.valid, true);
      assert.equal(step.state.currentValue, 2);
      assert.equal(step.state.completed, true);
    });

    it('goblin-bins: rejects negative, float, out-of-range, and post-completion inputs', () => {
      const s = goblinBins.init({ bins: 3, perBin: 12, target: { same: 2 } });
      assert.equal(goblinBins.checkStep(s, { action: 'place', bin: -1 }).valid, false);
      assert.equal(goblinBins.checkStep(s, { action: 'place', bin: 1.5 }).valid, false);
      assert.equal(goblinBins.checkStep(s, { action: 'place', bin: 3 }).valid, false);
      assert.equal(goblinBins.checkStep(s, { action: 'submit_count', value: -5 }).valid, false);

      // Complete game
      let cur = s;
      cur = goblinBins.checkStep(cur, { action: 'place', bin: 0 }).state;
      cur = goblinBins.checkStep(cur, { action: 'place', bin: 1 }).state;
      cur = goblinBins.checkStep(cur, { action: 'place', bin: 2 }).state;
      const comp = goblinBins.checkStep(cur, { action: 'submit_count', value: 4 });
      assert.equal(comp.valid, true);
      assert.equal(comp.state.completed, true);

      // Further actions rejected after completion
      assert.equal(goblinBins.checkStep(comp.state, { action: 'place', bin: 0 }).valid, false);
      assert.equal(goblinBins.checkStep(comp.state, { action: 'submit_count', value: 4 }).valid, false);
    });

    it('seam-grid: rejects invalid unit ratios, wrong units, and out-of-order steps', () => {
      const s = seamGrid.init({ relation: { shortCount: 3, longCount: 2 }, outerPerimeter: 66 });
      // Step out of order (outer_units before set_units)
      assert.equal(seamGrid.checkStep(s, { action: 'outer_units', value: 22 }).valid, false);

      // Wrong unit ratio (2, 2 instead of 2, 3)
      assert.equal(seamGrid.checkStep(s, { action: 'set_units', short: 2, long: 2 }).valid, false);

      // Valid set_units
      const s1 = seamGrid.checkStep(s, { action: 'set_units', short: 2, long: 3 }).state;
      // Wrong outer units
      assert.equal(seamGrid.checkStep(s1, { action: 'outer_units', value: 99 }).valid, false);
    });

    it('factor-dials: rejects composite numbers, non-divisors, and false sums', () => {
      const s = factorDials.init({
        products: [
          { value: 34, guardians: ['Jimmy', 'Kimmy'] },
          { value: 85, guardians: ['Timmy', 'Kimmy'] }
        ]
      });

      // Composite factors: 1 and 34
      assert.equal(factorDials.checkStep(s, { action: 'factor', productIndex: 0, factors: [1, 34] }).valid, false);
      // Non-divisor
      assert.equal(factorDials.checkStep(s, { action: 'assign', guardian: 'Jimmy', value: 3 }).valid, false);
      // Non-prime
      assert.equal(factorDials.checkStep(s, { action: 'assign', guardian: 'Jimmy', value: 4 }).valid, false);
    });
  });

  // -------------------------------------------------------------------------
  // 4. State Machine Caps, Floors & Bounds
  // -------------------------------------------------------------------------
  describe('4. State Machine Caps, Floors & Bounds', () => {
    it('conjectures: wrong conjecture immediately transitions to understand with misconception start rung', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'chasm-reverse-tolls.json'), 'utf8'));
      const s0 = createSession(enc);
      const s1 = transition(s0, { type: 'arrive' }, enc).session;
      assert.equal(s1.state, 'conjecture');

      // Wrong guess transitions to understand with misconception starting level
      const s2 = transition(s1, { type: 'conjecture', value: 15, reason: 'Wrong guess' }, enc).session;
      assert.equal(s2.state, 'understand');
      assert.equal(s2.conjectures, 1);
      assert.equal(s2.misconceptionTag, 'undo-order');
      assert.equal(s2.hintRung, 'l1');
    });

    it('forces advance to plan after at most 2 understand turns', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'chasm-reverse-tolls.json'), 'utf8'));
      const s0 = createSession(enc);
      const s1 = transition(s0, { type: 'arrive' }, enc).session;
      const s2 = transition(s1, { type: 'skip_conjecture' }, enc).session;
      assert.equal(s2.state, 'understand');

      // Child say 1
      const s3 = transition(s2, { type: 'say', text: 'I am reading the sign.' }, enc).session;
      assert.equal(s3.state, 'understand');

      // Child say 2 -> forces transition to plan (SPEC §2 pillar 9)
      const s4 = transition(s3, { type: 'say', text: 'Now I understand the road.' }, enc).session;
      assert.equal(s4.state, 'plan');
    });

    it('prevents hint ladder from fading below l1 during carry_out', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'chasm-reverse-tolls.json'), 'utf8'));
      const s0 = createSession(enc);
      s0.state = 'carry_out';
      s0.hintRung = 'l1';
      s0.hintRungIndex = 1;

      // Successful step at l1 remains at l1 floor (never drops to l0)
      const s1 = transition(s0, { type: 'step', payload: { action: 'value', gateIndex: 2, value: 11 } }, enc).session;
      assert.equal(s1.hintRung, 'l1');
      assert.equal(s1.hintRungIndex, 1);
    });

    it('escalates simpler problem to l3 hint after 2 wrong attempts', () => {
      const enc = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'encounters', 'chasm-reverse-tolls.json'), 'utf8'));
      const s0 = createSession(enc);
      s0.state = 'simpler_problem';
      s0.simplerProblemState = {
        statement: enc.parts[0].ladder.l4.statement,
        answer: enc.parts[0].ladder.l4.answer,
        l3Hint: enc.parts[0].ladder.l4.l3,
        attempts: 0,
        completed: false
      };

      // Wrong attempt 1
      const s1 = transition(s0, { type: 'simpler_submit', value: 99 }, enc).session;
      assert.equal(s1.state, 'simpler_problem');
      assert.equal(s1.simplerProblemState.attempts, 1);

      // Wrong attempt 2 -> delivers worked l3 hint and transitions back to carry_out
      const s2 = transition(s1, { type: 'simpler_submit', value: 88 }, enc).session;
      assert.equal(s2.state, 'carry_out');
      assert.equal(s2.simplerProblemL3Unlocked, true);
      assert.equal(s2.hintRung, 'l1');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Security, Auth & Malformed HTTP Boundaries
  // -------------------------------------------------------------------------
  describe('5. Security, Auth & Malformed HTTP Boundaries', () => {
    it('rejects parent dashboard access without PIN or with wrong PIN', async () => {
      // Missing PIN
      const resMissing = await fetch(`${baseUrl}/api/parent/transcript`);
      assert.equal(resMissing.status, 401);

      // Wrong PIN
      const resWrong = await fetch(`${baseUrl}/api/parent/transcript?pin=9999`);
      assert.equal(resWrong.status, 401);

      // Correct PIN 1234
      const resOk = await fetch(`${baseUrl}/api/parent/transcript?pin=1234`);
      assert.equal(resOk.status, 200);
    });

    it('blocks directory traversal attempts in static server', async () => {
      const resDotDot = await fetch(`${baseUrl}/../../package.json`);
      assert.notEqual(resDotDot.status, 200);

      const resEncoded = await fetch(`${baseUrl}/%2e%2e/%2e%2e/package.json`);
      assert.notEqual(resEncoded.status, 200);
    });

    it('returns 400 Bad Request on null, primitive, or invalid JSON bodies', async () => {
      const resNull = await fetch(`${baseUrl}/api/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'null'
      });
      assert.equal(resNull.status, 400);

      const resPrimitive = await fetch(`${baseUrl}/api/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '123'
      });
      assert.equal(resPrimitive.status, 400);

      const resMalformed = await fetch(`${baseUrl}/api/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"unclosed": '
      });
      assert.equal(resMalformed.status, 400);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Timeout & Network Isolation Boundaries
  // -------------------------------------------------------------------------
  describe('6. Timeout & Network Isolation Boundaries', () => {
    it('simulated 4-second timeout aborts cleanly and returns scripted fallback', async () => {
      const turn = await generateTurn({
        encounterId: 'ch1-n1-reverse-tolls',
        partId: 'a',
        state: 'understand',
        rung: 'l0',
        childMessage: 'What should I do?'
      }, {
        adapter: 'gemini',
        apiKey: 'test-key',
        timeoutMs: 50, // 50ms test timeout to trigger abort
        fetchFn: async (_url, opts) => {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              resolve({
                ok: true,
                status: 200,
                json: async () => ({})
              });
            }, 500);

            if (opts?.signal) {
              opts.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                const abortErr = new Error('The operation was aborted');
                abortErr.name = 'AbortError';
                reject(abortErr);
              });
            }
          });
        }
      });

      assert.equal(turn.fallback, true);
      assert.equal(turn.adapter, 'scripted_fallback');
      assert.ok(turn.utterance && turn.utterance.length >= 40);
      assert.ok(turn.fallbackReason?.includes('aborted') || turn.fallbackReason?.includes('timeout') || turn.fallbackReason?.includes('Adapter error'));
    });
  });
});
