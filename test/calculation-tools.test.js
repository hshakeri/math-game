import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, createCalculationState, reduceCalculation, mountCalculationTools } from '../client/calculation-tools.js';

test('child-entered decimal arithmetic is exact for addition, subtraction, and multiplication', () => {
  for (const [left, op, right, result] of [
    ['0.1', '+', '0.2', '0.3'], ['1.2', '−', '2.35', '-1.15'],
    ['0.07', '×', '0.03', '0.0021'], ['-3.5', '*', '-2', '7'],
    ['.5', '+', '000.50', '1'], ['-0', '+', '0', '0'],
    ['12345678901234567890', '+', '1', '12345678901234567891']
  ]) assert.deepEqual(calculate(left, op, right), { ok: true, result, approximate: false });
});

test('division distinguishes exact decimals from rounded results and preserves sign', () => {
  assert.deepEqual(calculate('1', '÷', '8'), { ok: true, result: '0.125', approximate: false });
  assert.deepEqual(calculate('0.3', '/', '0.2'), { ok: true, result: '1.5', approximate: false });
  assert.deepEqual(calculate('1', '/', '3'), { ok: true, result: '0.333333333333', approximate: true });
  assert.deepEqual(calculate('-2', '/', '3'), { ok: true, result: '-0.666666666667', approximate: true });
  assert.deepEqual(calculate('1', '/', '-8'), { ok: true, result: '-0.125', approximate: false });
});

test('zero division, invalid numbers, unknown operators, and overflow never produce a numeric result', () => {
  for (const zero of ['0', '-0', '0.00']) {
    const result = calculate('4', '/', zero);
    assert.equal(result.ok, false);
    assert.match(result.error, /zero/);
    assert.equal(result.result, undefined);
  }
  for (const value of ['', '-', '.', '1 + 2', 'NaN', 'Infinity', '1e3', 'globalThis.injected = true']) {
    assert.equal(calculate(value, '+', '2').ok, false);
  }
  for (const op of ['**', 'constructor', '__proto__', 'toString']) assert.equal(calculate('2', op, '0').ok, false);
  const overflow = calculate('9'.repeat(200), '*', '9'.repeat(200));
  assert.equal(overflow.ok, false);
  assert.match(overflow.error, /too large/);
});

function enter(state, left, operator, right) {
  for (const action of [
    { type: 'input', value: left }, { type: 'operator', value: operator },
    { type: 'input', value: right }, { type: 'equals' }
  ]) state = reduceCalculation(state, action);
  return state;
}

test('an empty or incomplete calculator never invents operands or repeats an operation', () => {
  let state = createCalculationState();
  assert.equal(state.draft, '');
  state = reduceCalculation(state, { type: 'equals' });
  assert.equal(state.tape.length, 0);
  state = reduceCalculation(state, { type: 'input', value: '9' });
  state = reduceCalculation(state, { type: 'operator', value: '+' });
  state = reduceCalculation(state, { type: 'equals' });
  assert.equal(state.draft, '');
  assert.equal(state.left, '9');
  assert.equal(state.tape.length, 0);
  state = reduceCalculation(state, { type: 'input', value: '1' });
  state = reduceCalculation(state, { type: 'equals' });
  assert.equal(state.draft, '10');
  state = reduceCalculation(state, { type: 'equals' });
  assert.equal(state.draft, '10');
  assert.equal(state.tape.length, 1, 'Repeated equals must not invent another +1');
});

test('decimal, sign, deletion, and operator replacement keep the child in control of the number', () => {
  let state = createCalculationState();
  for (const action of [{ type: 'sign' }, { type: 'decimal' }, { type: 'digit', value: '5' }, { type: 'decimal' }]) state = reduceCalculation(state, action);
  assert.equal(state.draft, '-0.5');
  state = reduceCalculation(state, { type: 'backspace' });
  assert.equal(state.draft, '-0.');
  state = reduceCalculation(state, { type: 'digit', value: '2' });
  state = reduceCalculation(state, { type: 'operator', value: '+' });
  state = reduceCalculation(state, { type: 'operator', value: '*' });
  assert.equal(state.operator, '*');
  assert.equal(state.tape.length, 0);
  state = reduceCalculation(state, { type: 'backspace' });
  assert.equal(state.draft, '-0.2');
  assert.equal(state.operator, null);
});

test('division errors keep both entries editable, and a repaired divisor can be calculated', () => {
  let state = enter(createCalculationState(), '6', '/', '0');
  assert.equal(state.left, '6');
  assert.equal(state.draft, '0');
  assert.equal(state.tape.length, 0);
  state = reduceCalculation(state, { type: 'input', value: '2' });
  state = reduceCalculation(state, { type: 'equals' });
  assert.equal(state.draft, '3');
  assert.equal(state.tape.length, 1);
});

test('sequential operations record only completed child-entered arithmetic on a bounded tape', () => {
  let state = createCalculationState();
  for (const action of [
    { type: 'input', value: '2' }, { type: 'operator', value: '+' },
    { type: 'input', value: '3' }, { type: 'operator', value: '*' },
    { type: 'input', value: '4' }, { type: 'equals' }
  ]) state = reduceCalculation(state, action);
  assert.equal(state.draft, '20');
  assert.deepEqual(state.tape.map(entry => entry.result), ['5', '20']);
  for (let i = 0; i < 25; i++) state = enter(state, String(i), '+', '1');
  assert.equal(state.tape.length, 20);
  assert.equal(state.tape[0].left, '5');
  assert.equal(state.tape.at(-1).result, '25');
});

test('clear keeps notes and tape, reset clears all, and input limits do not mutate prior work', () => {
  const original = enter(createCalculationState(), '1', '/', '3');
  let state = reduceCalculation(original, { type: 'scratchpad', value: 'x'.repeat(2100) });
  assert.equal(state.scratchpad.length, 2000);
  assert.equal(original.scratchpad, '');
  state = reduceCalculation(state, { type: 'input', value: '9'.repeat(25) });
  assert.equal(state.draft, original.draft);
  state = reduceCalculation(state, { type: 'clear' });
  assert.equal(state.draft, '');
  assert.equal(state.tape.length, 1);
  assert.equal(state.scratchpad.length, 2000);
  assert.deepEqual(reduceCalculation(state, { type: 'reset' }), createCalculationState());
});

function node() {
  return { value: '', textContent: '', hidden: false, children: [], replaceChildren(...children) { this.children = children; } };
}

function dom() {
  const listeners = new Map();
  const nodes = Object.fromEntries(['entry', 'notes', 'expression', 'rounding', 'status', 'empty', 'tape'].map(name => [`[data-calc-${name}]`, node()]));
  const mount = {
    innerHTML: '',
    ownerDocument: { createElement() { return { textContent: '', set innerHTML(_) { assert.fail('Working must be rendered as text'); } }; } },
    querySelector: selector => nodes[selector],
    contains: target => target.inside === true,
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: (type, callback) => { if (listeners.get(type) === callback) listeners.delete(type); },
    replaceChildren() { this.innerHTML = ''; }
  };
  const emit = (type, event) => listeners.get(type)?.(event);
  return {
    mount, listeners, nodes,
    click(action, value) {
      const button = { inside: true, dataset: { calcAction: action, calcValue: value }, closest() { return this; } };
      emit('click', { target: button });
    },
    input(value, name = 'entry') {
      const target = nodes[`[data-calc-${name}]`];
      target.value = value;
      emit('input', { target });
    },
    key(key, name = 'entry', extra = {}) {
      let prevented = false;
      emit('keydown', { key, target: nodes[`[data-calc-${name}]`] || {}, preventDefault() { prevented = true; }, ...extra });
      return prevented;
    }
  };
}

test('mounted keys calculate only explicit entries and keyboard entry after a result starts a new number', () => {
  const view = dom();
  const tools = mountCalculationTools(view.mount);
  const entry = view.nodes['[data-calc-entry]'];
  assert.equal(entry.value, '');
  view.input('12');
  assert.equal(view.key('+'), true);
  assert.equal(entry.value, '');
  view.input('3');
  assert.equal(view.key('Enter'), true);
  assert.equal(entry.value, '15');
  assert.equal(view.nodes['[data-calc-tape]'].children[0].textContent, '12 + 3 = 15');
  assert.equal(view.key('2'), true);
  assert.equal(entry.value, '2', 'Typing after a result must replace it, not append to 15');
  view.key('*');
  view.click('digit', '4');
  view.click('equals');
  assert.equal(entry.value, '8');
  tools.dispose();
  assert.equal(view.listeners.size, 0);
  assert.equal(view.mount.innerHTML, '');
});

test('keyboard editing and scratchpad shortcuts preserve ordinary native control behavior', () => {
  const view = dom();
  mountCalculationTools(view.mount);
  view.input('12');
  assert.equal(view.key('Backspace'), false, 'Number input uses native cursor-aware deletion');
  view.input('1'); // Browser input event after native deletion.
  assert.equal(view.nodes['[data-calc-entry]'].value, '1');
  assert.equal(view.key('+', 'notes'), false);
  assert.equal(view.key('a', 'entry', { ctrlKey: true }), false);
  assert.equal(view.key('Enter', 'button'), false, 'Enter on a keypad button keeps its native click behavior');
  view.key('.', 'button');
  view.key('5', 'button');
  assert.equal(view.nodes['[data-calc-entry]'].value, '1.5');
  view.key('Backspace', 'button');
  assert.equal(view.nodes['[data-calc-entry]'].value, '1.');
  view.key('Escape');
  assert.equal(view.nodes['[data-calc-entry]'].value, '');
});

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

function withStorage(store, run) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: store });
  try { run(); } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
}

test('saved work survives remount, changing workspace keys isolates puzzles, and clear-all removes saved work', () => {
  withStorage(storage(), () => {
    const first = dom();
    const tools = mountCalculationTools(first.mount, { storageKey: 'gate-a' });
    first.input('18'); first.click('operator', '/'); first.input('3'); first.click('equals');
    first.input('My own reasoning', 'notes');
    tools.setStorageKey('gate-b');
    assert.equal(first.nodes['[data-calc-entry]'].value, '');
    assert.equal(first.nodes['[data-calc-notes]'].value, '');
    assert.equal(first.nodes['[data-calc-tape]'].children.length, 0);
    first.input('42');
    tools.setStorageKey('gate-a');
    assert.equal(first.nodes['[data-calc-entry]'].value, '6');
    assert.equal(first.nodes['[data-calc-notes]'].value, 'My own reasoning');
    tools.dispose();
    const second = dom();
    const remounted = mountCalculationTools(second.mount, { storageKey: 'gate-a' });
    assert.equal(second.nodes['[data-calc-tape]'].children[0].textContent, '18 ÷ 3 = 6');
    remounted.reset();
    assert.equal(localStorage.getItem('gate-a'), null);
    assert.equal(second.nodes['[data-calc-notes]'].value, '');
    assert.ok(localStorage.getItem('gate-b'), 'Reset affects only the current workspace');
  });
});

test('malformed saved work is ignored and saved markup stays literal scratchpad text', () => {
  withStorage(storage(), () => {
    localStorage.setItem('broken', '{');
    const view = dom();
    const tools = mountCalculationTools(view.mount, { storageKey: 'broken' });
    assert.equal(view.nodes['[data-calc-entry]'].value, '');
    const markup = '<img src=x onerror=alert(1)>';
    localStorage.setItem('unsafe', JSON.stringify({ draft: markup, scratchpad: markup, tape: [
      { left: '1', operator: '+', right: '2', result: markup },
      { left: '1', operator: 'constructor', right: '0', result: '0' },
      { left: '1', operator: '+', right: '2', result: '3' }
    ] }));
    tools.setStorageKey('unsafe');
    assert.equal(view.nodes['[data-calc-entry]'].value, '');
    assert.equal(view.nodes['[data-calc-notes]'].value, markup);
    assert.equal(view.nodes['[data-calc-tape]'].children.length, 1);
    assert.ok(!view.mount.innerHTML.includes(markup));
  });
});

test('denied browser storage does not prevent calculation or clearing', () => {
  const deny = () => { throw new Error('storage denied'); };
  withStorage({ getItem: deny, setItem: deny, removeItem: deny }, () => {
    const view = dom();
    const tools = mountCalculationTools(view.mount, { storageKey: 'private' });
    view.click('digit', '2'); view.click('operator', '+'); view.click('digit', '2'); view.click('equals');
    assert.equal(view.nodes['[data-calc-entry]'].value, '4');
    assert.doesNotThrow(() => tools.reset());
    assert.equal(view.nodes['[data-calc-entry]'].value, '');
  });
});
