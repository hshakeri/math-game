/**
 * Castle of Theorems — Goblin Bins Mechanic (Pigeonhole Principle)
 * Pure functions: init, checkStep, isComplete, finalValue
 *
 * Models worst-case crystal dodging:
 * - target.same: at least K crystals of same color -> max dodge is (K - 1) per bin.
 * - target.different: at least 2 crystals of different colors -> max dodge is all in 1 bin.
 * Final certain grab = maximal waste + 1.
 */

export function init(params) {
  if (!params || typeof params.bins !== 'number' || typeof params.perBin !== 'number') {
    throw new Error('goblin-bins init requires bins and perBin numbers');
  }

  const binCount = Math.max(1, params.bins);
  return {
    bins: new Array(binCount).fill(0),
    perBin: params.perBin,
    target: params.target || {},
    totalPlaced: 0,
    submittedCount: null,
    completed: false
  };
}

export function checkStep(state, step) {
  if (!state || !step || typeof step.action !== 'string') {
    return { valid: false, state, progress: false };
  }

  if (state.completed) {
    return { valid: false, state, progress: false };
  }

  if (step.action === 'place') {
    const binIdx = step.bin;
    if (typeof binIdx !== 'number' || binIdx < 0 || binIdx >= state.bins.length) {
      return { valid: false, state, progress: false };
    }

    if (state.bins[binIdx] >= state.perBin) {
      return { valid: false, state, progress: false }; // Bin already full
    }

    // Check target constraints for dodging
    if (state.target.same) {
      // Must not reach target.same in any bin
      if (state.bins[binIdx] + 1 >= state.target.same) {
        return { valid: false, state, progress: false };
      }
    } else if (state.target.different) {
      // Must not place in more than 1 bin
      const activeBins = state.bins.reduce((acc, count, idx) => (count > 0 ? [...acc, idx] : acc), []);
      if (activeBins.length > 0 && !activeBins.includes(binIdx)) {
        return { valid: false, state, progress: false };
      }
    }

    const nextBins = [...state.bins];
    nextBins[binIdx] += 1;

    return {
      valid: true,
      state: {
        ...state,
        bins: nextBins,
        totalPlaced: state.totalPlaced + 1
      },
      progress: true
    };
  }

  if (step.action === 'submit_count') {
    const val = Number(step.value);
    if (Number.isNaN(val)) {
      return { valid: false, state, progress: false };
    }

    // Calculate maximal dodging capacity
    let maxWaste = 0;
    if (state.target.same) {
      maxWaste = state.bins.length * (state.target.same - 1);
    } else if (state.target.different) {
      maxWaste = state.perBin;
    }

    const expectedAnswer = maxWaste + 1;
    if (val === expectedAnswer) {
      return {
        valid: true,
        state: {
          ...state,
          submittedCount: val,
          completed: true
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
  return state.submittedCount ?? (state.totalPlaced + 1);
}
