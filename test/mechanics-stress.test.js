import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import * as inverseChain from '../server/engine/mechanics/inverse-chain.js';
import * as goblinBins from '../server/engine/mechanics/goblin-bins.js';
import * as seamGrid from '../server/engine/mechanics/seam-grid.js';
import * as factorDials from '../server/engine/mechanics/factor-dials.js';

// Helper to deeply freeze an object to verify pure function immutability
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

// ============================================================================
// 1. INVERSE-CHAIN MECHANIC STRESS TESTS
// ============================================================================
describe('inverse-chain mechanic', () => {
  const standardParams = {
    gates: [
      { mul: 2, sub: 5 },
      { mul: 2, sub: 3 },
      { mul: 2, sub: 9 }
    ],
    end: 13
  };

  it('verifies init structure and backward starting position', () => {
    const state = inverseChain.init(standardParams);
    assert.equal(state.currentValue, 13);
    assert.equal(state.currentGateIndex, 2);
    assert.equal(state.completed, false);
    assert.deepEqual(state.history, []);
    assert.equal(inverseChain.isComplete(state), false);
    assert.equal(inverseChain.finalValue(state), 13);
  });

  it('rejects init with missing or invalid parameters', () => {
    assert.throws(() => inverseChain.init(null), /requires gates array and end number/);
    assert.throws(() => inverseChain.init({}), /requires gates array and end number/);
    assert.throws(() => inverseChain.init({ gates: 'not-an-array', end: 13 }), /requires gates array and end number/);
    assert.throws(() => inverseChain.init({ gates: [] }), /requires gates array and end number/);
  });

  it('backward replay sequence succeeds to start value 6', () => {
    let state = inverseChain.init(standardParams);

    // Gate 2: undo sub 9, mul 2 -> (13 + 9)/2 = 11
    const order2 = inverseChain.checkStep(state, { action: 'order', gateIndex: 2, order: ['add', 'div'] });
    assert.equal(order2.valid, true);
    assert.equal(order2.progress, true);
    state = order2.state;

    const val2 = inverseChain.checkStep(state, { action: 'value', gateIndex: 2, value: 11 });
    assert.equal(val2.valid, true);
    assert.equal(val2.state.currentValue, 11);
    assert.equal(val2.state.currentGateIndex, 1);
    assert.equal(val2.state.completed, false);
    state = val2.state;

    // Gate 1: undo sub 3, mul 2 -> (11 + 3)/2 = 7
    const order1 = inverseChain.checkStep(state, { action: 'order', gateIndex: 1, order: ['give_back', 'undouble'] });
    assert.equal(order1.valid, true);
    state = order1.state;

    const val1 = inverseChain.checkStep(state, { action: 'value', gateIndex: 1, value: 7 });
    assert.equal(val1.valid, true);
    assert.equal(val1.state.currentValue, 7);
    assert.equal(val1.state.currentGateIndex, 0);
    assert.equal(val1.state.completed, false);
    state = val1.state;

    // Gate 0: undo sub 5, mul 2 -> (7 + 5)/2 = 6
    const order0 = inverseChain.checkStep(state, { action: 'order', gateIndex: 0, order: ['add', 'divide'] });
    assert.equal(order0.valid, true);
    state = order0.state;

    const val0 = inverseChain.checkStep(state, { action: 'value', gateIndex: 0, value: 6 });
    assert.equal(val0.valid, true);
    assert.equal(val0.state.currentValue, 6);
    assert.equal(val0.state.currentGateIndex, -1);
    assert.equal(val0.state.completed, true);
    state = val0.state;

    assert.equal(inverseChain.isComplete(state), true);
    assert.equal(inverseChain.finalValue(state), 6);
  });

  it('adversarial sequence: forward replay attempts are rejected', () => {
    const state = inverseChain.init(standardParams);
    // Forward attempt starting at gate 0 must be rejected because engine starts at last gate (gate 2)
    const forwardStep = inverseChain.checkStep(state, { action: 'value', gateIndex: 0, value: 7 });
    assert.equal(forwardStep.valid, false);
    assert.equal(forwardStep.progress, false);

    const forwardOrder = inverseChain.checkStep(state, { action: 'order', gateIndex: 0, order: ['add', 'div'] });
    assert.equal(forwardOrder.valid, false);
    assert.equal(forwardOrder.progress, false);
  });

  it('adversarial sequence: out-of-order gate attempts are rejected', () => {
    let state = inverseChain.init(standardParams);
    // Gate 1 before Gate 2
    const res1 = inverseChain.checkStep(state, { action: 'value', gateIndex: 1, value: 7 });
    assert.equal(res1.valid, false);

    // Gate 2 solved
    state = inverseChain.checkStep(state, { action: 'value', gateIndex: 2, value: 11 }).state;

    // Gate 0 before Gate 1
    const res0 = inverseChain.checkStep(state, { action: 'value', gateIndex: 0, value: 6 });
    assert.equal(res0.valid, false);

    // Gate 2 repeated after already solved
    const res2Again = inverseChain.checkStep(state, { action: 'value', gateIndex: 2, value: 11 });
    assert.equal(res2Again.valid, false);
  });

  it('rejects invalid orders and non-array orders', () => {
    const state = inverseChain.init(standardParams);
    assert.equal(inverseChain.checkStep(state, { action: 'order', gateIndex: 2, order: ['div', 'add'] }).valid, false);
    assert.equal(inverseChain.checkStep(state, { action: 'order', gateIndex: 2, order: ['add'] }).valid, false);
    assert.equal(inverseChain.checkStep(state, { action: 'order', gateIndex: 2, order: ['add', 'add'] }).valid, false);
    assert.equal(inverseChain.checkStep(state, { action: 'order', gateIndex: 2, order: null }).valid, false);
    assert.equal(inverseChain.checkStep(state, { action: 'order', gateIndex: 2, order: 'add,div' }).valid, false);
  });

  it('rejects invalid, NaN, wrong, and post-completion values', () => {
    const state = inverseChain.init(standardParams);
    // Wrong value
    assert.equal(inverseChain.checkStep(state, { action: 'value', gateIndex: 2, value: 10 }).valid, false);
    assert.equal(inverseChain.checkStep(state, { action: 'value', gateIndex: 2, value: NaN }).valid, false);
    assert.equal(inverseChain.checkStep(state, { action: 'value', gateIndex: 2, value: 'not-a-number' }).valid, false);
    assert.equal(inverseChain.checkStep(state, { action: 'invalid-action', gateIndex: 2 }).valid, false);

    // Complete the chain
    let s = inverseChain.checkStep(state, { action: 'value', gateIndex: 2, value: 11 }).state;
    s = inverseChain.checkStep(s, { action: 'value', gateIndex: 1, value: 7 }).state;
    s = inverseChain.checkStep(s, { action: 'value', gateIndex: 0, value: 6 }).state;
    assert.equal(s.completed, true);

    // Step after completion must be rejected
    assert.equal(inverseChain.checkStep(s, { action: 'value', gateIndex: 0, value: 6 }).valid, false);
  });

  it('handles negative values and zero correctly', () => {
    // Chain with zero and negative outcomes
    // end = -4, gate: mul 2, sub 6 -> (-4 + 6) / 2 = 1
    // end = 1, gate: mul 2, sub 1 -> (1 + 1) / 2 = 1
    // end = 0, gate: mul 2, sub 4 -> (0 + 4) / 2 = 2
    const zeroState = inverseChain.init({
      gates: [{ mul: 2, sub: 4 }],
      end: 0
    });
    const step0 = inverseChain.checkStep(zeroState, { action: 'value', gateIndex: 0, value: 2 });
    assert.equal(step0.valid, true);
    assert.equal(step0.state.currentValue, 2);

    const negState = inverseChain.init({
      gates: [{ mul: 2, sub: -6 }], // sub -6 means subtract -6, so + (-6)
      end: -10
    });
    // (-10 + (-6)) / 2 = -8
    const stepNeg = inverseChain.checkStep(negState, { action: 'value', gateIndex: 0, value: -8 });
    assert.equal(stepNeg.valid, true);
    assert.equal(stepNeg.state.currentValue, -8);
  });

  it('regression: rejects empty string, null, undefined, and non-numeric values when expected is 0', () => {
    // Expected is 0: end = -4, sub = 4, mul = 2 -> (-4 + 4) / 2 = 0
    const s = inverseChain.init({
      gates: [{ mul: 2, sub: 4 }],
      end: -4
    });
    const stepEmpty = inverseChain.checkStep(s, { action: 'value', gateIndex: 0, value: '' });
    const stepNull = inverseChain.checkStep(s, { action: 'value', gateIndex: 0, value: null });
    const stepUndef = inverseChain.checkStep(s, { action: 'value', gateIndex: 0, value: undefined });
    const stepBool = inverseChain.checkStep(s, { action: 'value', gateIndex: 0, value: false });

    assert.equal(stepEmpty.valid, false, 'empty string must not coerce to 0');
    assert.equal(stepEmpty.progress, false);
    assert.equal(stepNull.valid, false, 'null must not coerce to 0');
    assert.equal(stepNull.progress, false);
    assert.equal(stepUndef.valid, false, 'undefined must be rejected');
    assert.equal(stepUndef.progress, false);
    assert.equal(stepBool.valid, false, 'false must not coerce to 0');
    assert.equal(stepBool.progress, false);

    // Correct numeric 0 succeeds
    const stepZero = inverseChain.checkStep(s, { action: 'value', gateIndex: 0, value: 0 });
    assert.equal(stepZero.valid, true);
    assert.equal(stepZero.state.currentValue, 0);
    assert.equal(stepZero.state.completed, true);
  });
});

// ============================================================================
// 2. GOBLIN-BINS MECHANIC STRESS TESTS
// ============================================================================
describe('goblin-bins mechanic', () => {
  it('verifies init structure and rejects invalid params', () => {
    const s = goblinBins.init({ bins: 3, perBin: 12, target: { same: 2 } });
    assert.deepEqual(s.bins, [0, 0, 0]);
    assert.equal(s.perBin, 12);
    assert.equal(s.totalPlaced, 0);
    assert.equal(s.submittedCount, null);
    assert.equal(s.completed, false);
    assert.equal(goblinBins.isComplete(s), false);
    assert.equal(goblinBins.finalValue(s), 1); // 0 + 1

    assert.throws(() => goblinBins.init(null), /requires bins and perBin numbers/);
    assert.throws(() => goblinBins.init({ bins: 'three' }), /requires bins and perBin numbers/);
  });

  it('part a: pair dodge (target.same = 2, target answer 4)', () => {
    let state = goblinBins.init({ bins: 3, perBin: 12, target: { same: 2 } });

    // Place 1 in bin 0, 1 in bin 1, 1 in bin 2 (maximum waste = 3)
    for (let b = 0; b < 3; b++) {
      const res = goblinBins.checkStep(state, { action: 'place', bin: b });
      assert.equal(res.valid, true);
      assert.equal(res.progress, true);
      state = res.state;
    }
    assert.deepEqual(state.bins, [1, 1, 1]);
    assert.equal(state.totalPlaced, 3);

    // Attempting a 4th placement in any bin must be rejected by dodging rules
    for (let b = 0; b < 3; b++) {
      const overfill = goblinBins.checkStep(state, { action: 'place', bin: b });
      assert.equal(overfill.valid, false, `Bin ${b} must reject 2nd crystal in part a`);
    }

    // Submit wrong answers
    assert.equal(goblinBins.checkStep(state, { action: 'submit_count', value: 3 }).valid, false);
    assert.equal(goblinBins.checkStep(state, { action: 'submit_count', value: 5 }).valid, false);
    assert.equal(goblinBins.checkStep(state, { action: 'submit_count', value: 0 }).valid, false);

    // Submit correct answer 4
    const submit = goblinBins.checkStep(state, { action: 'submit_count', value: 4 });
    assert.equal(submit.valid, true);
    assert.equal(submit.state.completed, true);
    assert.equal(submit.state.submittedCount, 4);
    assert.equal(goblinBins.isComplete(submit.state), true);
    assert.equal(goblinBins.finalValue(submit.state), 4);
  });

  it('part b: club of 4 dodge (target.same = 4, target answer 10)', () => {
    let state = goblinBins.init({ bins: 3, perBin: 12, target: { same: 4 } });

    // Maximum waste: 3 in each bin -> total 9
    for (let b = 0; b < 3; b++) {
      for (let i = 0; i < 3; i++) {
        const res = goblinBins.checkStep(state, { action: 'place', bin: b });
        assert.equal(res.valid, true);
        state = res.state;
      }
    }
    assert.deepEqual(state.bins, [3, 3, 3]);
    assert.equal(state.totalPlaced, 9);

    // Any 4th crystal in any bin must be rejected
    for (let b = 0; b < 3; b++) {
      assert.equal(goblinBins.checkStep(state, { action: 'place', bin: b }).valid, false);
    }

    // Submit wrong answers
    assert.equal(goblinBins.checkStep(state, { action: 'submit_count', value: 9 }).valid, false);
    assert.equal(goblinBins.checkStep(state, { action: 'submit_count', value: 11 }).valid, false);
    assert.equal(goblinBins.checkStep(state, { action: 'submit_count', value: 4 }).valid, false);

    // Submit correct answer 10
    const submit = goblinBins.checkStep(state, { action: 'submit_count', value: 10 });
    assert.equal(submit.valid, true);
    assert.equal(submit.state.completed, true);
    assert.equal(goblinBins.finalValue(submit.state), 10);
  });

  it('part c: different colors dodge (target.different = true, target answer 13)', () => {
    let state = goblinBins.init({ bins: 3, perBin: 12, target: { different: true } });

    // Place 12 in bin 0 (all in one color)
    for (let i = 0; i < 12; i++) {
      const res = goblinBins.checkStep(state, { action: 'place', bin: 0 });
      assert.equal(res.valid, true);
      state = res.state;
    }
    assert.deepEqual(state.bins, [12, 0, 0]);
    assert.equal(state.totalPlaced, 12);

    // Trying to place in bin 1 or bin 2 must be rejected (would create different color)
    assert.equal(goblinBins.checkStep(state, { action: 'place', bin: 1 }).valid, false);
    assert.equal(goblinBins.checkStep(state, { action: 'place', bin: 2 }).valid, false);

    // Trying to place a 13th crystal in bin 0 must be rejected (bin full)
    assert.equal(goblinBins.checkStep(state, { action: 'place', bin: 0 }).valid, false);

    // Submit wrong answers
    assert.equal(goblinBins.checkStep(state, { action: 'submit_count', value: 12 }).valid, false);
    assert.equal(goblinBins.checkStep(state, { action: 'submit_count', value: 14 }).valid, false);
    assert.equal(goblinBins.checkStep(state, { action: 'submit_count', value: 2 }).valid, false);

    // Submit correct answer 13
    const submit = goblinBins.checkStep(state, { action: 'submit_count', value: 13 });
    assert.equal(submit.valid, true);
    assert.equal(submit.state.completed, true);
    assert.equal(goblinBins.finalValue(submit.state), 13);
  });

  it('regression: rejects NaN, float, and non-integer bin indices without corrupting state', () => {
    const state = goblinBins.init({ bins: 3, perBin: 12, target: { same: 2 } });
    const resNaN = goblinBins.checkStep(state, { action: 'place', bin: NaN });
    const resFloat = goblinBins.checkStep(state, { action: 'place', bin: 1.5 });
    const resInfinity = goblinBins.checkStep(state, { action: 'place', bin: Infinity });

    assert.equal(resNaN.valid, false, 'NaN bin must be rejected');
    assert.equal(resNaN.progress, false);
    assert.equal(resFloat.valid, false, '1.5 bin must be rejected');
    assert.equal(resFloat.progress, false);
    assert.equal(resInfinity.valid, false, 'Infinity bin must be rejected');
    assert.equal(resInfinity.progress, false);
    assert.deepEqual(state.bins, [0, 0, 0], 'bins array must remain pristine');
    assert.equal(state.totalPlaced, 0);
  });

  it('boundary draws and invalid counts', () => {
    const state = goblinBins.init({ bins: 3, perBin: 12, target: { same: 2 } });

    // Negative bin index
    assert.equal(goblinBins.checkStep(state, { action: 'place', bin: -1 }).valid, false);
    // Out of bounds bin index
    assert.equal(goblinBins.checkStep(state, { action: 'place', bin: 3 }).valid, false);
    assert.equal(goblinBins.checkStep(state, { action: 'place', bin: 99 }).valid, false);

    // String bin index
    assert.equal(goblinBins.checkStep(state, { action: 'place', bin: '0' }).valid, false);

    // Post-completion submission
    const completedState = goblinBins.checkStep(state, { action: 'submit_count', value: 4 }).state;
    assert.equal(completedState.completed, true);
    assert.equal(goblinBins.checkStep(completedState, { action: 'place', bin: 0 }).valid, false);
    assert.equal(goblinBins.checkStep(completedState, { action: 'submit_count', value: 4 }).valid, false);
  });
});

// ============================================================================
// 3. SEAM-GRID MECHANIC STRESS TESTS
// ============================================================================
describe('seam-grid mechanic', () => {
  const standardParams = {
    relation: { shortCount: 3, longCount: 2 },
    outerPerimeter: 66
  };

  it('verifies init structure and rejects invalid params', () => {
    const s = seamGrid.init(standardParams);
    assert.deepEqual(s.relation, { shortCount: 3, longCount: 2 });
    assert.equal(s.outerPerimeter, 66);
    assert.equal(s.units, null);
    assert.equal(s.outerUnits, null);
    assert.equal(s.cubitsPerUnit, null);
    assert.equal(s.shieldPerimeter, null);
    assert.equal(s.completed, false);
    assert.equal(seamGrid.isComplete(s), false);
    assert.equal(seamGrid.finalValue(s), null);

    assert.throws(() => seamGrid.init(null), /requires relation and outerPerimeter/);
    assert.throws(() => seamGrid.init({ relation: { shortCount: 3 } }), /requires relation and outerPerimeter/);
    assert.throws(() => seamGrid.init({ outerPerimeter: 66 }), /requires relation and outerPerimeter/);
  });

  it('golden path: relation 3 short = 2 long; perimeter 66; answer 30', () => {
    let state = seamGrid.init(standardParams);

    // Step 1: set_units short: 2, long: 3 (3*2 == 2*3 == 6)
    const step1 = seamGrid.checkStep(state, { action: 'set_units', short: 2, long: 3 });
    assert.equal(step1.valid, true);
    assert.deepEqual(step1.state.units, { short: 2, long: 3 });
    state = step1.state;

    // Step 2: outer_units = 2 * (3*2 + 3 + 2) = 2 * (6 + 5) = 22
    const step2 = seamGrid.checkStep(state, { action: 'outer_units', value: 22 });
    assert.equal(step2.valid, true);
    assert.equal(step2.state.outerUnits, 22);
    state = step2.state;

    // Step 3: cubits_per_unit = 66 / 22 = 3
    const step3 = seamGrid.checkStep(state, { action: 'cubits_per_unit', value: 3 });
    assert.equal(step3.valid, true);
    assert.equal(step3.state.cubitsPerUnit, 3);
    state = step3.state;

    // Step 4: shield_perimeter = 2 * (2 + 3) * 3 = 10 * 3 = 30
    const step4 = seamGrid.checkStep(state, { action: 'shield_perimeter', value: 30 });
    assert.equal(step4.valid, true);
    assert.equal(step4.state.shieldPerimeter, 30);
    assert.equal(step4.state.completed, true);
    state = step4.state;

    assert.equal(seamGrid.isComplete(state), true);
    assert.equal(seamGrid.finalValue(state), 30);
  });

  it('alternative unit scalings preserve exact shield perimeter of 30', () => {
    // If scaled by 2: short: 4, long: 6
    let state = seamGrid.init(standardParams);
    state = seamGrid.checkStep(state, { action: 'set_units', short: 4, long: 6 }).state;
    // outer_units = 2 * (3*4 + 6 + 4) = 44
    state = seamGrid.checkStep(state, { action: 'outer_units', value: 44 }).state;
    // cubits_per_unit = 66 / 44 = 1.5
    state = seamGrid.checkStep(state, { action: 'cubits_per_unit', value: 1.5 }).state;
    // shield_perimeter = 2 * (4 + 6) * 1.5 = 20 * 1.5 = 30
    const res = seamGrid.checkStep(state, { action: 'shield_perimeter', value: 30 });
    assert.equal(res.valid, true);
    assert.equal(res.state.shieldPerimeter, 30);
  });

  it('rejects mismatched seam ratios and invalid unit dimensions', () => {
    const state = seamGrid.init(standardParams);

    // 3 * 3 != 2 * 3 (ratio 1:1 instead of 2:3)
    assert.equal(seamGrid.checkStep(state, { action: 'set_units', short: 3, long: 3 }).valid, false);
    // Negative numbers
    assert.equal(seamGrid.checkStep(state, { action: 'set_units', short: -2, long: -3 }).valid, false);
    // Zero
    assert.equal(seamGrid.checkStep(state, { action: 'set_units', short: 0, long: 0 }).valid, false);
    // Non-finite
    assert.equal(seamGrid.checkStep(state, { action: 'set_units', short: NaN, long: 3 }).valid, false);
    assert.equal(seamGrid.checkStep(state, { action: 'set_units', short: 2, long: Infinity }).valid, false);
  });

  it('enforces strict step order dependencies', () => {
    const state = seamGrid.init(standardParams);

    // outer_units before set_units
    assert.equal(seamGrid.checkStep(state, { action: 'outer_units', value: 22 }).valid, false);
    // cubits_per_unit before outer_units
    assert.equal(seamGrid.checkStep(state, { action: 'cubits_per_unit', value: 3 }).valid, false);
    // shield_perimeter before cubits_per_unit
    assert.equal(seamGrid.checkStep(state, { action: 'shield_perimeter', value: 30 }).valid, false);
  });

  it('rejects wrong arithmetic values at each step', () => {
    let state = seamGrid.init(standardParams);
    state = seamGrid.checkStep(state, { action: 'set_units', short: 2, long: 3 }).state;

    // Wrong outer_units
    assert.equal(seamGrid.checkStep(state, { action: 'outer_units', value: 20 }).valid, false);
    assert.equal(seamGrid.checkStep(state, { action: 'outer_units', value: NaN }).valid, false);
    state = seamGrid.checkStep(state, { action: 'outer_units', value: 22 }).state;

    // Wrong cubits_per_unit
    assert.equal(seamGrid.checkStep(state, { action: 'cubits_per_unit', value: 2 }).valid, false);
    assert.equal(seamGrid.checkStep(state, { action: 'cubits_per_unit', value: -3 }).valid, false);
    state = seamGrid.checkStep(state, { action: 'cubits_per_unit', value: 3 }).state;

    // Wrong shield_perimeter
    assert.equal(seamGrid.checkStep(state, { action: 'shield_perimeter', value: 66 }).valid, false);
    assert.equal(seamGrid.checkStep(state, { action: 'shield_perimeter', value: 15 }).valid, false);
  });

  it('regression: rejects malformed relation counts and empty/null step parameters', () => {
    const malformedState = seamGrid.init({ relation: {}, outerPerimeter: 66 });
    const res = seamGrid.checkStep(malformedState, { action: 'set_units', short: 10, long: 99 });
    assert.equal(res.valid, false, 'malformed relation counts must reject set_units');
    assert.equal(res.progress, false);

    const validState = seamGrid.init({ relation: { shortCount: 3, longCount: 2 }, outerPerimeter: 66 });
    assert.equal(seamGrid.checkStep(validState, { action: 'set_units', short: null, long: 3 }).valid, false);
    assert.equal(seamGrid.checkStep(validState, { action: 'set_units', short: '', long: 3 }).valid, false);
    assert.equal(seamGrid.checkStep(validState, { action: 'set_units', short: undefined, long: 3 }).valid, false);
    assert.equal(seamGrid.checkStep(validState, { action: 'set_units', short: true, long: 1.5 }).valid, false);
    assert.equal(seamGrid.checkStep(validState, { action: 'set_units', short: 2, long: null }).valid, false);
    assert.equal(seamGrid.checkStep(validState, null).valid, false);
  });
});

// ============================================================================
// 4. FACTOR-DIALS MECHANIC STRESS TESTS
// ============================================================================
describe('factor-dials mechanic', () => {
  const standardParams = {
    products: [
      { left: 'Jimmy', right: 'Kimmy', value: 34 },
      { left: 'Kimmy', right: 'Timmy', value: 85 }
    ]
  };

  it('verifies init structure and rejects invalid params', () => {
    const s = factorDials.init(standardParams);
    assert.deepEqual(s.products, [
      { left: 'Jimmy', right: 'Kimmy', value: 34 },
      { left: 'Kimmy', right: 'Timmy', value: 85 }
    ]);
    assert.deepEqual(s.factored, [null, null]);
    assert.deepEqual(s.assignments, {});
    assert.equal(s.sum, null);
    assert.equal(s.completed, false);
    assert.equal(factorDials.isComplete(s), false);
    assert.equal(factorDials.finalValue(s), null);

    assert.throws(() => factorDials.init(null), /requires products array/);
    assert.throws(() => factorDials.init({}), /requires products array/);
  });

  it('golden path: 34 and 85, intermediates 17, 2, 5, sum 24', () => {
    let state = factorDials.init(standardParams);

    // Factor clue 0 (34 = 2 * 17)
    const f0 = factorDials.checkStep(state, { action: 'factor', productIndex: 0, factors: [2, 17] });
    assert.equal(f0.valid, true);
    assert.deepEqual(f0.state.factored[0], [2, 17]);
    state = f0.state;

    // Factor clue 1 (85 = 5 * 17)
    const f1 = factorDials.checkStep(state, { action: 'factor', productIndex: 1, factors: [5, 17] });
    assert.equal(f1.valid, true);
    assert.deepEqual(f1.state.factored[1], [5, 17]);
    state = f1.state;

    // Assign shared guardian Kimmy = 17
    const aKimmy = factorDials.checkStep(state, { action: 'assign_shared', guardian: 'Kimmy', value: 17 });
    assert.equal(aKimmy.valid, true);
    assert.equal(aKimmy.state.assignments.Kimmy, 17);
    state = aKimmy.state;

    // Assign Jimmy = 2
    const aJimmy = factorDials.checkStep(state, { action: 'assign', guardian: 'Jimmy', value: 2 });
    assert.equal(aJimmy.valid, true);
    assert.equal(aJimmy.state.assignments.Jimmy, 2);
    state = aJimmy.state;

    // Assign Timmy = 5
    const aTimmy = factorDials.checkStep(state, { action: 'assign', guardian: 'Timmy', value: 5 });
    assert.equal(aTimmy.valid, true);
    assert.equal(aTimmy.state.assignments.Timmy, 5);
    state = aTimmy.state;

    // Submit sum 2 + 17 + 5 = 24
    const s24 = factorDials.checkStep(state, { action: 'submit_sum', value: 24 });
    assert.equal(s24.valid, true);
    assert.equal(s24.state.sum, 24);
    assert.equal(s24.state.completed, true);
    state = s24.state;

    assert.equal(factorDials.isComplete(state), true);
    assert.equal(factorDials.finalValue(state), 24);
  });

  it('rejects invalid factoring (composites, wrong product, too few factors)', () => {
    const state = factorDials.init(standardParams);

    // Composite factors: 1 and 34 (1 and 34 are not prime)
    assert.equal(factorDials.checkStep(state, { action: 'factor', productIndex: 0, factors: [1, 34] }).valid, false);
    // Wrong product: 3 * 11 = 33 != 34
    assert.equal(factorDials.checkStep(state, { action: 'factor', productIndex: 0, factors: [3, 11] }).valid, false);
    // Too few factors
    assert.equal(factorDials.checkStep(state, { action: 'factor', productIndex: 0, factors: [34] }).valid, false);
    // Out of bounds index
    assert.equal(factorDials.checkStep(state, { action: 'factor', productIndex: 5, factors: [2, 17] }).valid, false);
    assert.equal(factorDials.checkStep(state, { action: 'factor', productIndex: -1, factors: [2, 17] }).valid, false);
  });

  it('regression: rejects NaN and non-integer productIndex without throwing', () => {
    const state = factorDials.init(standardParams);
    const resNaN = factorDials.checkStep(state, { action: 'factor', productIndex: NaN, factors: [2, 17] });
    assert.equal(resNaN.valid, false, 'NaN productIndex must be rejected');
    assert.equal(resNaN.progress, false);

    const resFloat = factorDials.checkStep(state, { action: 'factor', productIndex: 0.5, factors: [2, 17] });
    assert.equal(resFloat.valid, false, '0.5 productIndex must be rejected');
    assert.equal(resFloat.progress, false);

    const resNeg = factorDials.checkStep(state, { action: 'factor', productIndex: -1, factors: [2, 17] });
    assert.equal(resNeg.valid, false, '-1 productIndex must be rejected');
    assert.equal(resNeg.progress, false);
  });

  it('rejects invalid assignments: non-prime, non-divisor, unknown guardian', () => {
    const state = factorDials.init(standardParams);

    // Non-prime value: 4
    assert.equal(factorDials.checkStep(state, { action: 'assign', guardian: 'Jimmy', value: 4 }).valid, false);
    // Non-divisor prime: 3 (34 % 3 !== 0)
    assert.equal(factorDials.checkStep(state, { action: 'assign', guardian: 'Jimmy', value: 3 }).valid, false);
    // Kimmy assigned non-shared prime 2 (34 % 2 == 0, but 85 % 2 !== 0)
    assert.equal(factorDials.checkStep(state, { action: 'assign_shared', guardian: 'Kimmy', value: 2 }).valid, false);
    // Unknown guardian
    assert.equal(factorDials.checkStep(state, { action: 'assign', guardian: 'Gandalf', value: 17 }).valid, false);
  });

  it('regression: rejects contradictory guardian assignments and false sums including 39', () => {
    const state = factorDials.init(standardParams);

    // Sequence 1: Assign Jimmy = 17 (divides 34)
    const s1 = factorDials.checkStep(state, { action: 'assign', guardian: 'Jimmy', value: 17 }).state;

    // Contradiction: Attempting to assign Kimmy = 17 when Jimmy is 17 contradicts Jimmy * Kimmy = 34 (17 * 17 = 289 != 34)
    const resKimmyContradictory = factorDials.checkStep(s1, { action: 'assign_shared', guardian: 'Kimmy', value: 17 });
    assert.equal(resKimmyContradictory.valid, false, 'Contradictory Kimmy=17 must be rejected');
    assert.equal(resKimmyContradictory.progress, false);

    // Sequence 2: Valid assignments Jimmy = 2, Kimmy = 17, Timmy = 5
    let validState = factorDials.checkStep(state, { action: 'assign_shared', guardian: 'Kimmy', value: 17 }).state;
    validState = factorDials.checkStep(validState, { action: 'assign', guardian: 'Jimmy', value: 2 }).state;
    validState = factorDials.checkStep(validState, { action: 'assign', guardian: 'Timmy', value: 5 }).state;

    // Submitting false sum 39 must be rejected
    const wrongSum39 = factorDials.checkStep(validState, { action: 'submit_sum', value: 39 });
    assert.equal(wrongSum39.valid, false, 'False sum 39 must be rejected');
    assert.equal(wrongSum39.progress, false);
    assert.equal(factorDials.isComplete(wrongSum39.state), false);

    // Other wrong sums must be rejected
    assert.equal(factorDials.checkStep(validState, { action: 'submit_sum', value: 25 }).valid, false);
    assert.equal(factorDials.checkStep(validState, { action: 'submit_sum', value: 0 }).valid, false);

    // Correct sum 24 is accepted
    const correctSum = factorDials.checkStep(validState, { action: 'submit_sum', value: 24 });
    assert.equal(correctSum.valid, true, 'Valid sum 24 must be accepted');
    assert.equal(correctSum.progress, true);
    assert.equal(correctSum.state.completed, true);
    assert.equal(factorDials.isComplete(correctSum.state), true);
    assert.equal(factorDials.finalValue(correctSum.state), 24);
  });

  it('rejects unsupported actions like rotate or dial', () => {
    const state = factorDials.init(standardParams);
    assert.equal(factorDials.checkStep(state, { action: 'rotate', dial: 0, degrees: 90 }).valid, false);
    assert.equal(factorDials.checkStep(state, { action: 'turn', guardian: 'Kimmy', value: 17 }).valid, false);
  });
});

// ============================================================================
// 5. PURE FUNCTION INVARIANTS (IMMUTABILITY, IDEMPOTENCE, NO GLOBAL STATE)
// ============================================================================
describe('pure function invariants across all 4 mechanics', () => {
  it('all 4 mechanics do not mutate state (state deepFreeze test)', () => {
    // 1. inverse-chain
    const s1 = deepFreeze(inverseChain.init({ gates: [{ mul: 2, sub: 9 }], end: 13 }));
    assert.doesNotThrow(() => {
      inverseChain.checkStep(s1, { action: 'order', gateIndex: 0, order: ['add', 'div'] });
      inverseChain.checkStep(s1, { action: 'value', gateIndex: 0, value: 11 });
    });

    // 2. goblin-bins
    const s2 = deepFreeze(goblinBins.init({ bins: 3, perBin: 12, target: { same: 2 } }));
    assert.doesNotThrow(() => {
      goblinBins.checkStep(s2, { action: 'place', bin: 0 });
      goblinBins.checkStep(s2, { action: 'submit_count', value: 4 });
    });

    // 3. seam-grid
    const s3 = deepFreeze(seamGrid.init({ relation: { shortCount: 3, longCount: 2 }, outerPerimeter: 66 }));
    assert.doesNotThrow(() => {
      seamGrid.checkStep(s3, { action: 'set_units', short: 2, long: 3 });
    });

    // 4. factor-dials
    const s4 = deepFreeze(factorDials.init({
      products: [{ left: 'Jimmy', right: 'Kimmy', value: 34 }]
    }));
    assert.doesNotThrow(() => {
      factorDials.checkStep(s4, { action: 'factor', productIndex: 0, factors: [2, 17] });
      factorDials.checkStep(s4, { action: 'assign', guardian: 'Jimmy', value: 2 });
    });
  });

  it('all 4 mechanics are idempotent for identical inputs', () => {
    // inverse-chain
    const s1 = inverseChain.init({ gates: [{ mul: 2, sub: 9 }], end: 13 });
    const step1 = { action: 'value', gateIndex: 0, value: 11 };
    const r1a = inverseChain.checkStep(s1, step1);
    const r1b = inverseChain.checkStep(s1, step1);
    assert.deepEqual(r1a, r1b);

    // goblin-bins
    const s2 = goblinBins.init({ bins: 3, perBin: 12, target: { same: 2 } });
    const step2 = { action: 'place', bin: 0 };
    const r2a = goblinBins.checkStep(s2, step2);
    const r2b = goblinBins.checkStep(s2, step2);
    assert.deepEqual(r2a, r2b);

    // seam-grid
    const s3 = seamGrid.init({ relation: { shortCount: 3, longCount: 2 }, outerPerimeter: 66 });
    const step3 = { action: 'set_units', short: 2, long: 3 };
    const r3a = seamGrid.checkStep(s3, step3);
    const r3b = seamGrid.checkStep(s3, step3);
    assert.deepEqual(r3a, r3b);

    // factor-dials
    const s4 = factorDials.init({ products: [{ left: 'Jimmy', right: 'Kimmy', value: 34 }] });
    const step4 = { action: 'factor', productIndex: 0, factors: [2, 17] };
    const r4a = factorDials.checkStep(s4, step4);
    const r4b = factorDials.checkStep(s4, step4);
    assert.deepEqual(r4a, r4b);
  });

  it('concurrent independent sessions do not leak or share state', () => {
    // Two independent sessions for factor-dials with different products
    const sA = factorDials.init({ products: [{ left: 'A', right: 'B', value: 6 }] });
    const sB = factorDials.init({ products: [{ left: 'C', right: 'D', value: 15 }] });

    const stepA = factorDials.checkStep(sA, { action: 'factor', productIndex: 0, factors: [2, 3] });
    const stepB = factorDials.checkStep(sB, { action: 'factor', productIndex: 0, factors: [3, 5] });

    assert.deepEqual(stepA.state.factored[0], [2, 3]);
    assert.deepEqual(stepB.state.factored[0], [3, 5]);
    assert.notDeepEqual(stepA.state.products, stepB.state.products);
  });
});
