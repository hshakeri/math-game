/**
 * The child's own calculator and scratchpad. No encounter data, answers, tutor
 * calls, game actions, or DOM access at module scope.
 */
const INPUT_LIMIT = 24;
const NOTE_LIMIT = 2000;
const TAPE_LIMIT = 20;
const DIVISION_PLACES = 12;
const OPERATORS = { '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '/': '/', '÷': '/' };
const SYMBOLS = { '+': '+', '-': '−', '*': '×', '/': '÷' };
const DRAFT = /^-?\d*(?:\.\d*)?$/;
const normalizeOperator = value => Object.hasOwn(OPERATORS, value) ? OPERATORS[value] : null;

function operand(value) {
  const text = String(value ?? '').trim();
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  // Bound work even for malformed persisted data or direct API calls.
  if (text.length > 512 || !Number.isFinite(Number(text))) return null;
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace(/^-/, '').split('.');
  return { coefficient: BigInt((negative ? '-' : '') + (whole || '0') + fraction), scale: fraction.length };
}

function decimal(coefficient, scale) {
  if (coefficient === 0n) return '0';
  const sign = coefficient < 0n ? '-' : '';
  let digits = (coefficient < 0n ? -coefficient : coefficient).toString();
  if (scale) {
    digits = digits.padStart(scale + 1, '0');
    digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/0+$/, '').replace(/\.$/, '');
  }
  return sign + digits;
}

/** Exact decimal +, −, ×; division rounds only when needed, to twelve places. */
export function calculate(left, operator, right) {
  const a = operand(left), b = operand(right), op = normalizeOperator(operator);
  if (!a || !b) return { ok: false, error: 'Enter a finite number on each side.' };
  if (!op) return { ok: false, error: 'Choose +, −, ×, or ÷.' };
  if (op === '/' && b.coefficient === 0n) return { ok: false, error: 'We cannot divide by zero. Try another divisor.' };
  let coefficient, scale, approximate = false;
  if (op === '+' || op === '-') {
    scale = Math.max(a.scale, b.scale);
    const first = a.coefficient * 10n ** BigInt(scale - a.scale);
    const second = b.coefficient * 10n ** BigInt(scale - b.scale);
    coefficient = op === '+' ? first + second : first - second;
  } else if (op === '*') {
    coefficient = a.coefficient * b.coefficient;
    scale = a.scale + b.scale;
  } else {
    scale = DIVISION_PLACES;
    let numerator = a.coefficient * 10n ** BigInt(b.scale + scale);
    let denominator = b.coefficient * 10n ** BigInt(a.scale);
    const negative = (numerator < 0n) !== (denominator < 0n);
    if (numerator < 0n) numerator = -numerator;
    if (denominator < 0n) denominator = -denominator;
    coefficient = numerator / denominator;
    const remainder = numerator % denominator;
    approximate = remainder !== 0n;
    if (remainder * 2n >= denominator) coefficient += 1n;
    if (negative) coefficient = -coefficient;
  }
  const result = decimal(coefficient, scale);
  if (!Number.isFinite(Number(result))) return { ok: false, error: 'That result is too large for this calculator.' };
  return { ok: true, result, approximate };
}

export function createCalculationState() {
  return { draft: '', left: null, operator: null, freshResult: false, approximate: false, tape: [], scratchpad: '', message: '' };
}

function entryText(entry) {
  return `${entry.left} ${SYMBOLS[entry.operator]} ${entry.right} ${entry.approximate ? '≈' : '='} ${entry.result}`;
}

function finish(state) {
  if (state.left === null || !state.operator || !operand(state.draft)) {
    return { ...state, message: 'Enter two numbers and choose an operation.' };
  }
  const result = calculate(state.left, state.operator, state.draft);
  if (!result.ok) return { ...state, message: result.error };
  const entry = { left: state.left, operator: state.operator, right: state.draft, result: result.result, approximate: result.approximate };
  return {
    ...state, draft: result.result, left: null, operator: null,
    freshResult: true, approximate: result.approximate,
    tape: [...state.tape, entry].slice(-TAPE_LIMIT),
    message: `${entryText(entry)}${result.approximate ? ' (rounded)' : ''}`
  };
}

/** Pure calculator transitions; no implied second operand or repeated-equals shortcut. */
export function reduceCalculation(state, action) {
  if (!action || typeof action !== 'object') return state;
  if (action.type === 'reset') return createCalculationState();
  if (action.type === 'scratchpad') return { ...state, scratchpad: String(action.value ?? '').slice(0, NOTE_LIMIT) };
  if (action.type === 'clear') return { ...createCalculationState(), tape: state.tape, scratchpad: state.scratchpad };
  if (action.type === 'equals') return finish(state);
  if (action.type === 'operator') {
    const operator = normalizeOperator(action.value);
    if (!operator) return state;
    if (!state.draft && state.left !== null) return { ...state, operator, message: '' };
    if (!operand(state.draft)) return { ...state, message: 'Enter a number first.' };
    const ready = state.operator ? finish(state) : state;
    if (ready.operator) return ready; // Keep the operands visible if calculation failed.
    return { ...ready, left: ready.draft, operator, draft: '', freshResult: false, approximate: false, message: '' };
  }
  if (action.type === 'backspace') {
    if (!state.draft && state.left !== null) return { ...state, draft: state.left, left: null, operator: null, message: '', approximate: false };
    return { ...state, draft: state.draft.slice(0, -1), freshResult: false, approximate: false, message: '' };
  }
  if (action.type === 'sign') {
    return { ...state, draft: state.draft.startsWith('-') ? state.draft.slice(1) : `-${state.draft}`, freshResult: false, approximate: false, message: '' };
  }
  if (action.type === 'digit' || action.type === 'decimal' || action.type === 'input') {
    let draft = state.freshResult ? '' : state.draft;
    if (action.type === 'input') draft = String(action.value ?? '');
    else if (action.type === 'decimal') {
      if (draft.includes('.')) return state;
      draft += draft === '' || draft === '-' ? '0.' : '.';
    } else {
      if (!/^\d$/.test(String(action.value))) return state;
      draft += String(action.value);
    }
    if (!DRAFT.test(draft) || draft.length > INPUT_LIMIT) return { ...state, message: 'Use digits and one decimal point, up to twenty-four characters.' };
    return { ...state, draft, freshResult: false, approximate: false, message: '' };
  }
  return state;
}

function restore(raw) {
  const state = createCalculationState();
  if (!raw || typeof raw !== 'object') return state;
  if (typeof raw.draft === 'string' && DRAFT.test(raw.draft) && raw.draft.length <= 512) state.draft = raw.draft;
  if (typeof raw.left === 'string' && operand(raw.left) && normalizeOperator(raw.operator)) {
    state.left = raw.left;
    state.operator = normalizeOperator(raw.operator);
  }
  state.freshResult = Boolean(raw.freshResult) && state.left === null && Boolean(operand(state.draft));
  state.approximate = state.freshResult && Boolean(raw.approximate);
  state.scratchpad = typeof raw.scratchpad === 'string' ? raw.scratchpad.slice(0, NOTE_LIMIT) : '';
  for (const entry of (Array.isArray(raw.tape) ? raw.tape.slice(-TAPE_LIMIT) : [])) {
    if (!entry || typeof entry.left !== 'string' || typeof entry.right !== 'string') continue;
    const result = calculate(entry.left, entry.operator, entry.right);
    if (result.ok && result.result === entry.result) state.tape.push({ left: entry.left, operator: normalizeOperator(entry.operator), right: entry.right, result: result.result, approximate: result.approximate });
  }
  return state;
}

/**
 * Mount once. Optional storageKey must identify the intended encounter/part.
 * setStorageKey switches workspaces without carrying numbers into another puzzle.
 * dispose removes listeners; reset clears calculator, tape, notes and saved work.
 */
export function mountCalculationTools(element, { storageKey = null } = {}) {
  if (!element?.addEventListener) throw new TypeError('A calculation-tools mount element is required');
  let key = typeof storageKey === 'string' && storageKey ? storageKey : null;
  let disposed = false;
  const read = () => {
    try { return key ? restore(JSON.parse(globalThis.localStorage.getItem(key) || 'null')) : createCalculationState(); }
    catch { return createCalculationState(); }
  };
  let state = read();
  element.innerHTML = `
    <section class="calculation-tools" aria-label="My calculation tools">
      <div class="calculation-tools-heading"><div><h3>My tools</h3><p>Try your own numbers. Keep your own notes.</p></div><button type="button" class="calculation-reset" data-calc-action="reset">Clear all my work</button></div>
      <div class="calculation-tools-layout">
        <section class="calculation-pad" aria-label="Calculator">
          <p class="calculation-expression" data-calc-expression aria-label="Calculation so far"></p>
          <label class="calculation-number-label">Number<input data-calc-entry class="calculation-entry" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" maxlength="24" placeholder="Enter a number"></label>
          <p class="calculation-rounding" data-calc-rounding></p>
          <div class="calculation-keypad" role="group" aria-label="Calculator keys">
            <button type="button" data-calc-action="clear" aria-label="Clear this calculation">C</button>
            <button type="button" data-calc-action="backspace" aria-label="Delete the last character">⌫</button>
            <button type="button" data-calc-action="sign" aria-label="Change number sign">+/−</button>
            <button type="button" data-calc-action="operator" data-calc-value="/" aria-label="Divide">÷</button>
            <button type="button" data-calc-action="digit" data-calc-value="7">7</button>
            <button type="button" data-calc-action="digit" data-calc-value="8">8</button>
            <button type="button" data-calc-action="digit" data-calc-value="9">9</button>
            <button type="button" data-calc-action="operator" data-calc-value="*" aria-label="Multiply">×</button>
            <button type="button" data-calc-action="digit" data-calc-value="4">4</button>
            <button type="button" data-calc-action="digit" data-calc-value="5">5</button>
            <button type="button" data-calc-action="digit" data-calc-value="6">6</button>
            <button type="button" data-calc-action="operator" data-calc-value="-" aria-label="Subtract">−</button>
            <button type="button" data-calc-action="digit" data-calc-value="1">1</button>
            <button type="button" data-calc-action="digit" data-calc-value="2">2</button>
            <button type="button" data-calc-action="digit" data-calc-value="3">3</button>
            <button type="button" data-calc-action="operator" data-calc-value="+" aria-label="Add">+</button>
            <button type="button" data-calc-action="digit" data-calc-value="0">0</button>
            <button type="button" data-calc-action="decimal" aria-label="Decimal point">.</button>
            <button type="button" class="calculation-equals" data-calc-action="equals" aria-label="Calculate">=</button>
          </div>
          <p class="calculation-status" data-calc-status role="status" aria-live="polite" aria-atomic="true"></p>
        </section>
        <section class="calculation-notes" aria-label="My working">
          <label>My scratchpad<textarea data-calc-notes maxlength="2000" rows="4" placeholder="Write or paste your own working here…"></textarea></label>
          <h4>My calculation tape</h4><p class="calculation-empty" data-calc-empty>Your completed calculations will stay here.</p>
          <ul class="calculation-tape" data-calc-tape aria-label="Completed calculations"></ul>
        </section>
      </div>
    </section>`;
  const entry = element.querySelector('[data-calc-entry]');
  const notes = element.querySelector('[data-calc-notes]');
  const render = () => {
    if (entry.value !== state.draft) entry.value = state.draft;
    if (notes.value !== state.scratchpad) notes.value = state.scratchpad;
    element.querySelector('[data-calc-expression]').textContent = state.left === null ? '' : `${state.left} ${SYMBOLS[state.operator]}`;
    element.querySelector('[data-calc-rounding]').textContent = state.approximate ? '≈ Rounded to twelve decimal places.' : '';
    element.querySelector('[data-calc-status]').textContent = state.message;
    element.querySelector('[data-calc-empty]').hidden = state.tape.length > 0;
    const tape = element.querySelector('[data-calc-tape]');
    tape.replaceChildren(...state.tape.map(calculation => {
      const item = element.ownerDocument.createElement('li');
      item.textContent = entryText(calculation);
      return item;
    }));
  };
  const save = () => {
    try { if (key) globalThis.localStorage.setItem(key, JSON.stringify(state)); } catch {}
  };
  const dispatch = action => {
    if (disposed) return;
    state = reduceCalculation(state, action);
    if (action.type === 'reset') {
      try { if (key) globalThis.localStorage.removeItem(key); } catch {}
    } else save();
    render();
  };
  const click = event => {
    const button = event.target.closest?.('[data-calc-action]');
    if (button && element.contains(button)) dispatch({ type: button.dataset.calcAction, value: button.dataset.calcValue });
  };
  const input = event => {
    if (event.target === entry) dispatch({ type: 'input', value: entry.value });
    else if (event.target === notes) dispatch({ type: 'scratchpad', value: notes.value });
  };
  const keydown = event => {
    if (event.target === notes || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const nativeEntry = event.target === entry;
    let action;
    if (event.key === 'Escape') action = { type: 'clear' };
    else if (nativeEntry && state.freshResult && /^\d$/.test(event.key)) action = { type: 'digit', value: event.key };
    else if (nativeEntry && state.freshResult && event.key === '.') action = { type: 'decimal' };
    else if (event.key === 'Enter' && nativeEntry) action = { type: 'equals' };
    else if (event.key === '=') action = { type: 'equals' };
    else if (['+', '*', '/'].includes(event.key) || event.key === '-' && (!nativeEntry || state.draft !== '')) action = { type: 'operator', value: event.key };
    else if (!nativeEntry && /^\d$/.test(event.key)) action = { type: 'digit', value: event.key };
    else if (!nativeEntry && event.key === '.') action = { type: 'decimal' };
    else if (!nativeEntry && event.key === 'Backspace') action = { type: 'backspace' };
    if (action) { event.preventDefault(); dispatch(action); }
  };
  element.addEventListener('click', click);
  element.addEventListener('input', input);
  element.addEventListener('keydown', keydown);
  render();
  return {
    reset() { dispatch({ type: 'reset' }); },
    setStorageKey(nextKey) {
      if (disposed) return;
      const next = typeof nextKey === 'string' && nextKey ? nextKey : null;
      if (next === key) return;
      key = next;
      state = read();
      render();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      element.removeEventListener('click', click);
      element.removeEventListener('input', input);
      element.removeEventListener('keydown', keydown);
      element.replaceChildren();
    }
  };
}
