/**
 * Castle of Theorems — Factor Dials Mechanic
 * Pure functions: init, checkStep, isComplete, finalValue
 *
 * Models prime factor deduction across clue products:
 * 1. factor: split product into prime factors (productIndex, factors)
 * 2. assign_shared: assign shared prime factor to shared guardian (Kimmy = 17)
 * 3. assign: assign remaining prime factors to other guardians (Jimmy = 2, Timmy = 5)
 * 4. submit_sum: submit the sum of all guardians (2 + 17 + 5 = 24)
 */

function isPrime(n) {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 2) return false;
  if (n === 2 || n === 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

export function init(params) {
  if (!params || !Array.isArray(params.products)) {
    throw new Error('factor-dials init requires products array');
  }

  return {
    products: params.products.map(p => ({ left: p.left, right: p.right, value: p.value })),
    factored: new Array(params.products.length).fill(null),
    assignments: {},
    sum: null,
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

  if (step.action === 'factor') {
    const idx = step.productIndex;
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= state.products.length) {
      return { valid: false, state, progress: false };
    }

    const factors = step.factors;
    if (!Array.isArray(factors) || factors.length < 2) {
      return { valid: false, state, progress: false };
    }

    for (const f of factors) {
      if (typeof f !== 'number' || !Number.isInteger(f) || f <= 0 || !isPrime(f)) {
        return { valid: false, state, progress: false }; // Factors must be positive prime integers
      }
    }

    const prod = factors.reduce((acc, f) => acc * f, 1);
    if (prod !== state.products[idx].value) {
      return { valid: false, state, progress: false }; // Factors do not multiply to product
    }

    const nextFactored = [...state.factored];
    nextFactored[idx] = [...factors].sort((a, b) => a - b);

    return {
      valid: true,
      state: {
        ...state,
        factored: nextFactored
      },
      progress: true
    };
  }

  if (step.action === 'assign_shared' || step.action === 'assign') {
    const guardian = step.guardian;
    if (typeof guardian !== 'string' || guardian.trim() === '') {
      return { valid: false, state, progress: false };
    }

    if (typeof step.value !== 'number' && typeof step.value !== 'string') {
      return { valid: false, state, progress: false };
    }

    const val = Number(step.value);
    if (!Number.isInteger(val) || val <= 0 || !Number.isFinite(val) || !isPrime(val)) {
      return { valid: false, state, progress: false };
    }

    // Verify consistency with products that name this guardian
    const relevantProducts = state.products.filter(p => p.left === guardian || p.right === guardian);
    if (relevantProducts.length === 0) {
      return { valid: false, state, progress: false };
    }

    for (const p of relevantProducts) {
      if (p.value % val !== 0) {
        return { valid: false, state, progress: false }; // Does not divide product
      }

      const otherGuardian = p.left === guardian ? p.right : p.left;
      const otherVal = state.assignments[otherGuardian];
      if (typeof otherVal === 'number' && Number.isFinite(otherVal)) {
        if (val * otherVal !== p.value) {
          return { valid: false, state, progress: false }; // Inconsistent with already assigned guardian
        }
      }
    }

    return {
      valid: true,
      state: {
        ...state,
        assignments: {
          ...state.assignments,
          [guardian]: val
        }
      },
      progress: true
    };
  }

  if (step.action === 'submit_sum') {
    if (typeof step.value !== 'number' && typeof step.value !== 'string') {
      return { valid: false, state, progress: false };
    }

    const val = Number(step.value);
    if (!Number.isInteger(val) || val <= 0 || !Number.isFinite(val)) {
      return { valid: false, state, progress: false };
    }

    // Identify all guardians from products
    const guardianSet = new Set();
    for (const p of state.products) {
      guardianSet.add(p.left);
      guardianSet.add(p.right);
    }

    // Verify that all products in state.products are satisfied
    for (const p of state.products) {
      const leftVal = state.assignments[p.left];
      const rightVal = state.assignments[p.right];
      if (
        typeof leftVal !== 'number' ||
        typeof rightVal !== 'number' ||
        !Number.isInteger(leftVal) ||
        !Number.isInteger(rightVal) ||
        leftVal * rightVal !== p.value
      ) {
        return { valid: false, state, progress: false };
      }
    }

    // Calculate sum of guardian values
    let expectedSum = 0;
    for (const g of guardianSet) {
      expectedSum += state.assignments[g];
    }

    if (val === expectedSum) {
      return {
        valid: true,
        state: {
          ...state,
          sum: val,
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
  return state.sum;
}
