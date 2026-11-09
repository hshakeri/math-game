import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CastleGame, SoundSynth } from '../client/app.js';
import { gateReaction, escapeHTML } from '../client/story.js';

const sealed = { sealed: true, hasMoreParts: false, scene: { state: 'unlocked' } };

test('Grubb never evaluates tentative speech, conjectures, step successes or hint escalation', () => {
  for (const events of [[], [{ type: 'child.say', correct: true }], [{ type: 'step.success' }], [{ type: 'shortcut' }], [{ type: 'engine.transition', from: 'conjecture', to: 'look_back', shortcut: true }], [{ type: 'ladder.escalate' }]]) {
    assert.equal(gateReaction({ scene: { state: 'locked' } }, events).pose, 'idle');
  }
  assert.equal(gateReaction(sealed).pose, 'fume');
  assert.notEqual(gateReaction({ ...sealed, hasMoreParts: true }).pose, 'fume');
  assert.equal(gateReaction({ partSealed: true, hasMoreParts: true, scene: { state: 'locked' } }).pose, 'idle');
  assert.equal(gateReaction({}, [{ type: 'engine.transition', from: 'submit', to: 'carry_out', correct: false }]).pose, 'smirk');
});

test('Hero names and child notes are escaped before rendering', () => {
  assert.equal(escapeHTML('<img src=x onerror="x">&\''), '&lt;img src=x onerror=&quot;x&quot;&gt;&amp;&#39;');
});

function clientHarness() {
  const game = new CastleGame();
  game.activeSessionId = 'local-session';
  game.setBusy = value => { game.busy = value; };
  game.notice = message => { game.lastNotice = message; };
  game.updateView = view => { game.currentView = view; };
  game.renderReaction = () => {};
  game.appendHistory = () => {};
  game.speak = () => {};
  return game;
}

test('One in-flight action cannot be sent twice and stale responses do not replace another route', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let finish;
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Promise(resolve => { finish = resolve; }); };
    const game = clientHarness();
    const first = game.handleAction({ type: 'say', text: 'My idea' });
    assert.equal(await game.handleAction({ type: 'say', text: 'My idea' }), false);
    assert.equal(calls, 1);
    game.requestEpoch++;
    game.currentView = { encounterId: 'another-gate' };
    finish({ ok: true, json: async () => ({ view: { encounterId: 'old-gate' } }) });
    assert.equal(await first, false);
    assert.equal(game.currentView.encounterId, 'another-gate');
  } finally { globalThis.fetch = originalFetch; }
});

test('Failed actions retain the view and show a recoverable notice', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: false });
    const game = clientHarness();
    const before = { encounterId: 'current' };
    game.currentView = before;
    assert.equal(await game.handleAction({ type: 'submit', value: 99 }), false);
    assert.equal(game.currentView, before);
    assert.equal(game.busy, false);
    assert.match(game.lastNotice, /try again/);
  } finally { globalThis.fetch = originalFetch; }
});

test('Seal Continue completes the engine before catalog refresh and navigation', async () => {
  const originalWindow = globalThis.window;
  try {
    const game = clientHarness();
    const calls = [];
    globalThis.window = { location: { hash: '#encounter' } };
    game.handleAction = async action => { calls.push(action.type); return true; };
    game.hideModal = id => calls.push(id);
    game.loadCatalog = async () => calls.push('catalog');
    await game.finishEncounter();
    assert.deepEqual(calls, ['complete', 'golden-seal-overlay', 'catalog']);
    assert.equal(window.location.hash, '#map');
    game.handleAction = async () => false;
    window.location.hash = '#encounter';
    await game.finishEncounter();
    assert.equal(window.location.hash, '#encounter');
  } finally { if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; }
});

test('Denied local storage does not prevent game or sound controls from initializing', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
    assert.doesNotThrow(() => new CastleGame());
    const sound = new SoundSynth();
    assert.doesNotThrow(() => sound.toggleSound());
  } finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete globalThis.localStorage; }
});


test('Plan speech chips reach the engine as speech and open the creature deck', async () => {
  const game = clientHarness();
  game.currentView = { state: 'plan' };
  let sent;
  let opened = 0;
  game.handleAction = async action => { sent = action; return true; };
  game.openDeck = () => { opened++; };
  await game.handleChip('Work backwards from the castle door');
  assert.equal(sent.type, 'say');
  assert.equal(opened, 1);
  game.currentView = { state: 'understand' };
  await game.handleChip('I am looking for the start');
  assert.equal(sent.type, 'chip');
  assert.equal(opened, 1);
});
