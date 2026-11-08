/**
 * Castle of Theorems — Inverse Chain Mechanic
 * Pure functions: init, checkStep, isComplete, finalValue
 *
 * Models reverse toll gates:
 * Forward: val * mul - sub
 * Reverse: (val + sub) / mul
 * Gates are solved right-to-left (end towards start).
 */

export function init(params) {
  if (!params || !Array.isArray(params.gates) || typeof params.end !== 'number') {
    throw new Error('inverse-chain init requires gates array and end number');
  }

  return {
    gates: params.gates.map(g => ({ mul: g.mul, sub: g.sub })),
    currentValue: params.end,
    currentGateIndex: params.gates.length - 1,
    history: [],
    completed: false
  };
}

export function checkStep(state, step) {
  if (!state || !step || typeof step.action !== 'string') {
    return { valid: false, state, progress: false };
  }

  if (state.completed || state.currentGateIndex < 0) {
    return { valid: false, state, progress: false };
  }

  const gateIndex = step.gateIndex;
  if (gateIndex !== state.currentGateIndex) {
    return { valid: false, state, progress: false };
  }

  const currentGate = state.gates[gateIndex];

  if (step.action === 'order') {
    // Valid order to undo a (multiply, subtract) operation is: add, then divide
    const order = step.order;
    if (!Array.isArray(order) || order.length !== 2) {
      return { valid: false, state, progress: false };
    }
    const firstValid = order[0] === 'add' || order[0] === 'give_back';
    const secondValid = order[1] === 'div' || order[1] === 'divide' || order[1] === 'undouble';

    if (firstValid && secondValid) {
      return {
        valid: true,
        state: {
          ...state,
          orderVerifiedForGate: gateIndex
        },
        progress: true
      };
    }
    return { valid: false, state, progress: false };
  }

  if (step.action === 'value') {
    const val = Number(step.value);
    if (Number.isNaN(val)) {
      return { valid: false, state, progress: false };
    }

    const expected = (state.currentValue + currentGate.sub) / currentGate.mul;
    if (Math.abs(val - expected) < 1e-6) {
      const nextGateIndex = state.currentGateIndex - 1;
      const isDone = nextGateIndex < 0;
      return {
        valid: true,
        state: {
          ...state,
          currentValue: val,
          currentGateIndex: nextGateIndex,
          completed: isDone,
          history: [...state.history, { gateIndex, value: val }]
        },
        progress: true
      };
    }
    return { valid: false, state, progress: false };
  }

  return { valid: false, state, progress: false };
}

export function isComplete(state) {
  return Boolean(state && state.completed);
}

export function finalValue(state) {
  if (!state) return null;
  return state.currentValue;
}
