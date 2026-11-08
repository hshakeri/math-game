/**
 * Castle of Theorems — Seam Grid Mechanic
 * Pure functions: init, checkStep, isComplete, finalValue
 *
 * Models compound perimeter deduction along shared seams:
 * 1. set_units: sets short & long units satisfying shortCount * short = longCount * long
 * 2. outer_units: counts outer perimeter in units = 2 * (shortCount * short + long + short)
 * 3. cubits_per_unit: computes outerPerimeter / outer_units
 * 4. shield_perimeter: computes 2 * (short + long) * cubits_per_unit
 */

export function init(params) {
  if (!params || !params.relation || typeof params.outerPerimeter !== 'number') {
    throw new Error('seam-grid init requires relation and outerPerimeter');
  }

  return {
    relation: {
      shortCount: params.relation.shortCount,
      longCount: params.relation.longCount
    },
    outerPerimeter: params.outerPerimeter,
    units: null,
    outerUnits: null,
    cubitsPerUnit: null,
    shieldPerimeter: null,
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

  if (step.action === 'set_units') {
    const short = Number(step.short);
    const long = Number(step.long);
    if (!Number.isFinite(short) || !Number.isFinite(long) || short <= 0 || long <= 0) {
      return { valid: false, state, progress: false };
    }

    const { shortCount, longCount } = state.relation;
    if (Math.abs(shortCount * short - longCount * long) > 1e-6) {
      return { valid: false, state, progress: false }; // Ratio does not match seam relation
    }

    return {
      valid: true,
      state: {
        ...state,
        units: { short, long }
      },
      progress: true
    };
  }

  if (step.action === 'outer_units') {
    if (!state.units) {
      return { valid: false, state, progress: false };
    }

    const val = Number(step.value);
    const { short, long } = state.units;
    const { shortCount } = state.relation;
    // Top row width: shortCount * short. Total height: long + short.
    const expectedOuterUnits = 2 * (shortCount * short + long + short);

    if (Math.abs(val - expectedOuterUnits) < 1e-6) {
      return {
        valid: true,
        state: {
          ...state,
          outerUnits: val
        },
        progress: true
      };
    }
    return { valid: false, state, progress: false };
  }

  if (step.action === 'cubits_per_unit') {
    if (!state.outerUnits) {
      return { valid: false, state, progress: false };
    }

    const val = Number(step.value);
    const expectedCubitsPerUnit = state.outerPerimeter / state.outerUnits;

    if (Math.abs(val - expectedCubitsPerUnit) < 1e-6) {
      return {
        valid: true,
        state: {
          ...state,
          cubitsPerUnit: val
        },
        progress: true
      };
    }
    return { valid: false, state, progress: false };
  }

  if (step.action === 'shield_perimeter') {
    if (!state.units || state.cubitsPerUnit === null) {
      return { valid: false, state, progress: false };
    }

    const val = Number(step.value);
    const { short, long } = state.units;
    const shieldUnits = 2 * (short + long);
    const expectedPerimeter = shieldUnits * state.cubitsPerUnit;

    if (Math.abs(val - expectedPerimeter) < 1e-6) {
      return {
        valid: true,
        state: {
          ...state,
          shieldPerimeter: val,
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
  return state.shieldPerimeter;
}
