import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CastleGame } from '../client/app.js';

const markup = readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
const options = [
  { kind: 'verify', prompt: 'What is the final total?', responseType: 'integer' },
  { kind: 'perturb', prompt: 'What if the toll changes?', responseType: 'integer' },
  { kind: 'second-method', prompt: 'Which reason explains the route?', responseType: 'choice', choices: ['It follows the road.', 'It skips the road.'] }
];

function harness(t) {
  const game = new CastleGame();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  function node(tag) {
    return {
      tag, children: [], attributes: {}, listeners: {}, style: {}, value: '', textContent: '',
      set innerHTML(value) { this.children = []; },
      setAttribute(key, value) { this.attributes[key] = value; },
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(event, callback) { this.listeners[event] = callback; }
    };
  }
  const container = node('div');
  const elements = node => [node, ...node.children.flatMap(elements)];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    getElementById: id => id === 'look-back-options' ? container : null,
    createElement: node
  }});
  t.after(() => { if (original) Object.defineProperty(globalThis, 'document', original); else delete globalThis.document; });
  const actions = [];
  game.handleAction = async action => { actions.push(action); return true; };
  return { game, actions, all: () => elements(container), byTag: tag => elements(container).filter(el => el.tag === tag) };
}

test('the selected final check shows one numeric task and sends its result to that task', t => {
  const { game, all, byTag, actions } = harness(t);
  game.renderLookBack(options, 'verify');
  assert.equal(byTag('form').length, 1, 'Only one check should compete for the child’s attention');
  assert.equal(byTag('input').length, 1);
  const input = byTag('input')[0];
  assert.equal(input.inputMode, 'numeric');
  assert.match(input.placeholder, /number/i);
  assert.ok(all().some(el => el.textContent === options[0].prompt));
  assert.ok(!all().some(el => el.textContent === options[1].prompt));
  input.value = '17';
  byTag('form')[0].listeners.submit({ preventDefault() {} });
  assert.deepEqual(actions, [{ type: 'lookback', kind: 'verify', value: '17' }]);
  game.renderLookBack(options, 'verify');
  assert.equal(byTag('input')[0], input, 'A retry must preserve the child’s working');
});

test('changing the final check selects its kind and labels choices by kind, not array position', t => {
  const { game, byTag, actions } = harness(t);
  game.renderLookBack(options, 'verify');
  const select = byTag('select')[0];
  assert.ok(select, 'Alternative checks need an explicit selector');
  const labels = Object.fromEntries(byTag('option').map(el => [el.value, el.textContent]));
  assert.equal(labels.perturb, 'Change the story');
  assert.equal(labels['second-method'], 'Try another way');
  select.value = 'perturb';
  select.listeners.change();
  assert.deepEqual(actions, [{ type: 'lookback_select', kind: 'perturb' }]);
});

test('a choice reflection exposes its authored choices as actions instead of an impossible text box', t => {
  const { game, byTag, actions } = harness(t);
  game.renderLookBack(options, 'second-method');
  assert.equal(byTag('input').length, 0);
  const choices = byTag('button').filter(button => options[2].choices.includes(button.textContent));
  assert.equal(choices.length, 2);
  choices[1].listeners.click();
  assert.deepEqual(actions, [{ type: 'lookback', kind: 'second-method', value: 1 }]);
});

test('a failed task selection restores the selector to the task its form will submit', async t => {
  const { game, byTag } = harness(t);
  game.renderLookBack(options, 'verify');
  let resolve;
  game.handleAction = () => new Promise(done => { resolve = done; });
  const select = byTag('select')[0];
  select.value = 'perturb';
  const pending = select.listeners.change();
  assert.equal(select.disabled, true);
  resolve(false);
  await pending;
  assert.equal(select.value, 'verify');
  assert.equal(select.disabled, false);
  game.renderLookBack(options, 'verify');
  assert.equal(select.value, 'verify');
});

test('the final-check state is explicit and the history follows the active controls', () => {
  const panel = markup.match(/<section[^>]*id="look-back-panel"[\s\S]*?<\/section>/)?.[0];
  assert.match(panel, /aria-label="One final check"/);
  assert.doesNotMatch(panel, /<h3|id="look-back-prompt"/, 'Only the selected reflection question belongs above its reply controls');
  assert.ok(markup.indexOf('id="dialogue-history-details"') > markup.indexOf('id="btn-send-reply"'));
});
