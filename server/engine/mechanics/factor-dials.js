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
    if (typeof idx !== 'number' || idx < 0 || idx >= state.products.length) {
      return { valid: false, state, progress: false };
    }

    const factors = step.factors;
    if (!Array.isArray(factors) || factors.length < 2) {
      return { valid: false, state, progress: false };
    }

    for (const f of factors) {
      if (!isPrime(f)) {
        return { valid: false, state, progress: false }; // Factor must be prime
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
    const val = Number(step.value);

    if (typeof guardian !== 'string' || !isPrime(val)) {
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
    const val = Number(step.value);
    if (Number.isNaN(val)) {
      return { valid: false, state, progress: false };
    }

    // Identify all guardians from products
    const guardianSet = new Set();
    for (const p of state.products) {
      guardianSet.add(p.left);
      guardianSet.add(p.right);
    }

    // Calculate sum of guardian values
    let expectedSum = 0;
    for (const g of guardianSet) {
      const gVal = state.assignments[g];
      if (typeof gVal !== 'number') {
        // If not explicitly assigned, compute from product if other is known
        const rel = state.products.find(p => (p.left === g && state.assignments[p.right]) || (p.right === g && state.assignments[p.left]));
        if (rel) {
          const other = rel.left === g ? state.assignments[rel.right] : state.assignments[rel.left];
          expectedSum += (rel.value / other);
        } else {
          return { valid: false, state, progress: false };
        }
      } else {
        expectedSum += gVal;
      }
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
