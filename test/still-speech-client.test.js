import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CastleGame } from '../client/app.js';

const markup = readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
const names = ['rivet', 'lemma'];
const textIds = { rivet: 'owl-speech-text', lemma: 'lemma-speech-text' };

function fakeClock() {
  let time = 0, nextId = 0;
  const jobs = new Map();
  return {
    setTimeout(callback, delay) { const id = ++nextId; jobs.set(id, { callback, at: time + delay }); return id; },
    clearTimeout(id) { jobs.delete(id); },
    get pending() { return jobs.size; },
    callbacks() { return [...jobs.values()].map(job => job.callback); },
    advance(duration) {
      const end = time + duration;
      for (;;) {
        const next = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, job] = next;
        jobs.delete(id);
        time = job.at;
        job.callback();
      }
      time = end;
    }
  };
}

// Only the small DOM surface used by these real client methods. IDs and classes
// come from index.html, so a missing live speech element cannot pass unnoticed.
function documentSurface() {
  const elements = [], ids = new Map();
  const document = {
    hidden: false,
    activeElement: null,
    listeners: {},
    addEventListener(type, callback) { this.listeners[type] = callback; },
    getElementById(id) { return ids.get(id) || null; },
    createElement() { return node(); },
    querySelector(selector) {
      if (selector === '.modal-overlay:not(.hidden)') return this.querySelectorAll('.modal-overlay').find(el => !el.classList.contains('hidden')) || null;
      const speech = selector.match(/^\[data-speech="([^"]+)"\]$/)?.[1];
      if (speech) return elements.find(el => el.getAttribute('data-speech') === speech) || null;
      return selector.startsWith('.') ? this.querySelectorAll(selector)[0] || null : null;
    },
    querySelectorAll(selector) { return elements.filter(el => el.classList.contains(selector.slice(1))); }
  };
  function node(attributes = {}) {
    const classes = new Set((attributes.class || '').split(/\s+/).filter(Boolean));
    return {
      id: attributes.id || '', textContent: '', innerHTML: '', disabled: false, open: false,
      style: {}, children: [], listeners: {},
      classList: {
        add: value => classes.add(value), remove: value => classes.delete(value),
        contains: value => classes.has(value),
        toggle(value, force = !classes.has(value)) { if (force) classes.add(value); else classes.delete(value); return force; }
      },
      setAttribute(name, value) { attributes[name] = String(value); },
      getAttribute(name) { return attributes[name] ?? null; },
      addEventListener(type, callback) { this.listeners[type] = callback; },
      appendChild(child) { this.children.push(child); },
      querySelector(selector) { return selector === 'button' ? ids.get('btn-close-deck') : null; },
      focus() { document.activeElement = this; }
    };
  }
  for (const [, tag] of markup.matchAll(/<[a-z][a-z\d-]*\b([^>]*)>/gi)) {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
    const element = node(attributes);
    elements.push(element);
    if (element.id) ids.set(element.id, element);
  }
  return document;
}

function harness(t) {
  const game = new CastleGame(); // No browser bootstrap; methods below remain real.
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalFetch = globalThis.fetch;
  const document = documentSurface();
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: document });
  const clock = fakeClock(), callbacks = [];
  game.initSpeech();
  for (const name of names) {
    assert.ok(document.getElementById(textIds[name]), `${name} needs its live text element`);
    const speech = game.speeches[name];
    speech.timers = clock;
    const start = speech.onStart, complete = speech.onComplete;
    speech.onStart = text => { callbacks.push([name, 'start', text]); start(text); };
    speech.onComplete = text => { callbacks.push([name, 'complete', text]); complete(text); };
  }
  game.activeSessionId = 'speech-session';
  t.after(() => {
    game.cancelSpeech();
    globalThis.fetch = originalFetch;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
  });
  return { game, clock, document, callbacks, text: name => document.getElementById(textIds[name]).textContent };
}

function view(overrides = {}) {
  return {
    encounterId: 'ch1-n1-reverse-tolls', currentPartId: 'a', state: 'understand',
    title: 'The Chasm of Reverse Tolls', inscription: 'The inscription stays here.',
    scene: { state: 'locked' }, workspaceUnlocked: false, availableChips: [], revealedHints: [],
    ...overrides
  };
}

function response(payload) { return { ok: true, json: async () => payload }; }
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test('finishing or reloading a sealed encounter never replays the previous tutor question', async t => {
  const { game, clock, callbacks } = harness(t);
  const done = view({ state: 'sealed', sealed: true, lastTutorUtterance: 'What number does your final check give?', dialogue: [] });
  game.showGoldenSeal = () => { game.sealShown = true; };
  globalThis.fetch = async () => response({ view: done, speech: null, events: [] });
  await game.handleAction({ type: 'lookback', kind: 'verify', value: '13' });
  clock.advance(10_000);
  assert.equal(callbacks.length, 0, 'No old question should follow the completed check');
  game.lastSpoken = '';
  game.updateView(done);
  clock.advance(10_000);
  assert.equal(callbacks.length, 0, 'Reloading the finished view must also stay quiet');
});

test('one action response with speech in both API fields produces one Rivet line', async t => {
  const { game, clock, callbacks, text } = harness(t);
  const line = 'What do we know about the end of the road?';
  globalThis.fetch = async () => response({ view: view({ lastTutorUtterance: line }), speech: line, events: [] });
  assert.equal(await game.handleAction({ type: 'say', text: 'I am thinking.' }), true);
  assert.deepEqual(game.history.filter(item => item.who === 'Rivet'), [{ who: 'Rivet', words: line }]);
  clock.advance(10_000);
  assert.equal(text('rivet'), line);
  assert.deepEqual(callbacks.filter(([name]) => name === 'rivet'), [['rivet', 'start', line], ['rivet', 'complete', line]]);
});

test('identical scripted speech on separate successful turns is spoken once per turn', async t => {
  const { game, clock, callbacks } = harness(t);
  const line = 'Which end of the road do we know?';
  globalThis.fetch = async () => response({ view: view({ lastTutorUtterance: line }), speech: line });
  for (const text of ['The beginning?', 'Let me think again.']) {
    assert.equal(await game.handleAction({ type: 'say', text }), true);
    clock.advance(10_000);
  }
  assert.equal(game.history.filter(item => item.who === 'Rivet' && item.words === line).length, 2);
  assert.equal(callbacks.filter(([name, event]) => name === 'rivet' && event === 'start').length, 2);
  assert.equal(callbacks.filter(([name, event]) => name === 'rivet' && event === 'complete').length, 2);
});

test('starting an encounter cancels old lines before the new network request resolves', async t => {
  const { game, clock, callbacks, text } = harness(t);
  game.speak('Old Rivet line', { delay: 1000 });
  const staleCallbacks = clock.callbacks();
  const request = deferred();
  globalThis.fetch = () => request.promise;
  const starting = game.startEncounter('ch1-n2-dark-vault');
  assert.equal(game.busy, true);
  assert.equal(clock.pending, 0);
  staleCallbacks.forEach(callback => callback());
  clock.advance(10_000);
  assert.equal(text('rivet'), '');
  assert.deepEqual(callbacks, []);
  const arrival = 'A new room waits below the stones.';
  request.resolve(response({ sessionId: 'vault-session', view: view({ encounterId: 'ch1-n2-dark-vault', state: 'arrive', lastTutorUtterance: arrival }) }));
  await starting;
  clock.advance(10_000);
  assert.equal(game.activeSessionId, 'vault-session');
  assert.equal(game.busy, false);
  assert.equal(text('rivet'), arrival);
  assert.equal(callbacks.some(([, , line]) => line.startsWith('Old ')), false);
});

test('leaving the encounter clears every speech without firing old completion callbacks', t => {
  const { game, clock, document, callbacks, text } = harness(t);
  game.speak('Still being said', { delay: 0 });
  game.playSpeech('lemma', 'The previous collection.');
  const stale = clock.callbacks();
  const before = callbacks.slice();
  const epoch = game.requestEpoch;
  game.showScreen('screen-map');
  stale.forEach(callback => callback());
  clock.advance(10_000);
  assert.equal(game.requestEpoch, epoch + 1);
  assert.equal(game.currentView, null);
  assert.equal(document.getElementById('screen-map').classList.contains('hidden'), false);
  assert.equal(clock.pending, 0);
  assert.deepEqual(callbacks, before);
  for (const name of names) {
    assert.equal(text(name), '');
    assert.equal(document.getElementById(`${name}-speech-accessible`).textContent, '');
  }
});

test('a new Vault part cancels prior speech and starts only that part’s lines', t => {
  const { game, clock, callbacks, text } = harness(t);
  game.updateView(view({ encounterId: 'ch1-n2-dark-vault', currentPartId: 'a', lastTutorUtterance: 'The previous torch.' }));
  game.renderReaction(view(), []);
  const stale = clock.callbacks();
  const newLine = 'Let us read what this torch asks for.';
  game.updateView(view({ encounterId: 'ch1-n2-dark-vault', currentPartId: 'b', state: 'arrive', lastTutorUtterance: newLine }));
  stale.forEach(callback => callback());
  assert.equal(text('rivet'), '');
  clock.advance(10_000);
  assert.equal(game.sceneSpeechKey, 'ch1-n2-dark-vault:b');
  assert.equal(text('rivet'), newLine);
  assert.equal(callbacks.some(([, , line]) => line === 'The previous torch.'), false);
  assert.deepEqual(callbacks.filter(([name, event]) => name === 'rivet' && event === 'complete'), [['rivet', 'complete', newLine]]);
});

test('speech pacing never keeps reply controls busy or blocks the next child action', async t => {
  const { game, clock, document } = harness(t);
  game.speak('The previous line is still revealing.', { delay: 0 });
  assert.equal(game.speeches.rivet.isTyping, true);
  const request = deferred();
  let requests = 0;
  globalThis.fetch = () => { requests++; return request.promise; };
  const acting = game.handleAction({ type: 'say', text: 'I have an idea.' });
  assert.equal(requests, 1, 'Typing speech must not reject a child action');
  assert.equal(game.busy, true, 'Only the actual request holds the busy flag');
  request.resolve(response({ view: view(), speech: 'We can keep thinking about that.' }));
  assert.equal(await acting, true);
  assert.equal(game.busy, false);
  assert.equal(document.getElementById('child-text-input').disabled, false);
  assert.equal(game.speeches.rivet.pending, true);
  globalThis.fetch = async () => { requests++; return response({ view: view(), speech: 'What would you try next?' }); };
  assert.equal(await game.handleAction({ type: 'say', text: 'Here is my next idea.' }), true);
  assert.equal(requests, 2);
  assert.equal(game.busy, false);
  clock.advance(450);
  assert.equal(game.speeches.rivet.isTyping, true);
  assert.equal(document.getElementById('child-text-input').disabled, false);
});

test('a modal completes covered speech and makes new covered lines instant without hidden timers', t => {
  const { game, clock, document, text } = harness(t);
  game.speak('The line behind the deck.', { delay: 900 });
  game.showModal('deck-overlay');
  assert.equal(text('rivet'), 'The line behind the deck.');
  assert.equal(clock.pending, 0);
  assert.equal(game.speechObscured('rivet'), true);
  assert.equal(game.speechObscured('lemma'), false);
  game.speak('A response received while the deck is open.', { repeat: true });
  assert.equal(text('rivet'), 'A response received while the deck is open.');
  assert.equal(document.getElementById('rivet-speech-accessible').getAttribute('aria-live'), 'off');
  assert.equal(game.speeches.rivet.pending, false);
  assert.equal(game.speeches.rivet.isTyping, false);
  assert.equal(clock.pending, 0);
  game.playSpeech('lemma', 'Choose a card to inspect.');
  assert.equal(game.speeches.lemma.pending, true, 'The visible Deck speaker can still use paced speech');
  const stale = clock.callbacks();
  game.closeDeck();
  const lastVisible = text('lemma');
  stale.forEach(callback => callback());
  clock.advance(10_000);
  assert.equal(text('lemma'), lastVisible);
  assert.equal(clock.pending, 0);
  assert.equal(document.getElementById('app-root').inert, false);
  assert.equal(document.getElementById('rivet-speech-accessible').getAttribute('aria-live'), 'polite');
});

test('the Seal replaces the Deck and closing an already hidden Deck keeps the background inert', t => {
  const { game, clock, document } = harness(t);
  game.showModal('deck-overlay');
  game.playSpeech('lemma', 'A card from my collection.');
  game.showModal('golden-seal-overlay');
  const visible = () => document.querySelectorAll('.modal-overlay').filter(el => !el.classList.contains('hidden')).map(el => el.id);
  assert.deepEqual(visible(), ['golden-seal-overlay']);
  assert.equal(game.speechObscured('lemma'), true);
  assert.equal(clock.pending, 0);
  game.closeDeck();
  assert.deepEqual(visible(), ['golden-seal-overlay']);
  assert.equal(document.getElementById('app-root').inert, true);
  game.hideModal('golden-seal-overlay');
  assert.deepEqual(visible(), []);
  assert.equal(document.getElementById('app-root').inert, false);
});

test('starting an encounter dismisses a stale modal before its request resolves', async t => {
  const { game, document } = harness(t);
  game.showModal('golden-seal-overlay');
  assert.equal(document.getElementById('app-root').inert, true);
  const request = deferred();
  globalThis.fetch = () => request.promise;
  const starting = game.startEncounter('ch1-n2-dark-vault');
  assert.equal(document.querySelector('.modal-overlay:not(.hidden)'), null);
  assert.equal(document.getElementById('app-root').inert, false);
  assert.equal(game.modalReturnFocus, null);
  request.resolve(response({ sessionId: 'vault-session', view: view({ encounterId: 'ch1-n2-dark-vault' }) }));
  await starting;
  assert.equal(game.activeSessionId, 'vault-session');
  assert.equal(document.querySelector('.modal-overlay:not(.hidden)'), null);
});

test('a delayed completion catalog refresh cannot navigate away from a newer encounter', async t => {
  const { game } = harness(t);
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const browser = { location: { hash: '#encounter?id=ch1-n1-reverse-tolls' } };
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: browser });
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  });
  const catalog = deferred(), catalogStarted = deferred();
  globalThis.fetch = async (url, options) => {
    if (url === '/api/session/speech-session/action') {
      assert.equal(JSON.parse(options.body).action.type, 'complete');
      return response({ view: view({ state: 'complete', completed: true }) });
    }
    if (url === '/api/encounters') {
      catalogStarted.resolve();
      return catalog.promise;
    }
    assert.equal(url, '/api/session/start');
    return response({ sessionId: 'vault-session', view: view({ encounterId: 'ch1-n2-dark-vault' }) });
  };
  game.showModal('golden-seal-overlay');
  const finishing = game.finishEncounter();
  await catalogStarted.promise;
  assert.equal(game.busy, false, 'The completed action does not hold controls through the catalog refresh');
  const nextRoute = '#encounter?id=ch1-n2-dark-vault';
  browser.location.hash = nextRoute;
  await game.startEncounter('ch1-n2-dark-vault');
  catalog.resolve(response({ encounters: [] }));
  await finishing;
  assert.equal(game.activeSessionId, 'vault-session');
  assert.equal(game.currentView.encounterId, 'ch1-n2-dark-vault');
  assert.equal(browser.location.hash, nextRoute);
});

test('Grubb status and sprite change only for deterministic gate outcomes, without speech timers', t => {
  const { game, clock, document, callbacks } = harness(t);
  game.renderReaction(view(), []);
  const idleArt = document.getElementById('scene-grubb').innerHTML;
  assert.match(idleArt, /grubb-idle\.svg/);
  clock.advance(100);
  for (const events of [
    [], [{ type: 'child.say', correct: true }], [{ type: 'step.success' }],
    [{ type: 'shortcut' }], [{ type: 'engine.transition', from: 'conjecture', to: 'look_back', shortcut: true }],
    [{ type: 'ladder.escalate' }]
  ]) game.renderReaction(view(), events);
  assert.equal(game.reactionKey, 'idle:');
  assert.equal(document.getElementById('scene-grubb').innerHTML, idleArt);
  assert.equal(document.getElementById('gate-word').textContent, '');
  assert.equal(document.getElementById('gate-reaction').textContent, '');
  assert.equal(document.getElementById('gate-event').classList.contains('hidden'), true);
  assert.equal(game.history.filter(item => item.who === 'Grubb').length, 0);
  clock.advance(10_000);
  assert.deepEqual(callbacks, []);
  assert.equal(clock.pending, 0);
  game.renderReaction(view({ sealed: true, hasMoreParts: true, scene: { state: 'unlocked' } }), []);
  assert.equal(game.reactionKey, 'idle:', 'An intermediate chamber cannot trigger the whole-gate reaction');
  game.renderReaction(view(), [{ type: 'engine.transition', from: 'submit', to: 'carry_out', correct: false }]);
  assert.equal(game.reactionKey, 'smirk:clunk');
  assert.match(document.getElementById('scene-grubb').innerHTML, /grubb-smirk\.svg/);
  assert.equal(document.getElementById('gate-word').textContent, 'clunk');
  assert.match(document.getElementById('gate-reaction').textContent, /gate stays shut/);
  assert.equal(document.getElementById('gate-event').classList.contains('hidden'), false);
  game.renderReaction(view({ sealed: true, hasMoreParts: false, scene: { state: 'unlocked' } }), []);
  assert.equal(game.reactionKey, 'fume:CLANK');
  assert.match(document.getElementById('scene-grubb').innerHTML, /grubb-fume\.svg/);
  assert.equal(document.getElementById('gate-word').textContent, 'CLANK');
  assert.match(document.getElementById('gate-reaction').textContent, /gate opens/);
  assert.equal(clock.pending, 0);
});

function toolDrawers(document) {
  return ['tools-drawer', 'workspace-details'].map(id => document.getElementById(id));
}

test('entering Tiny Case exposes its statement and input but same-state updates respect a closed drawer', t => {
  const { game, document } = harness(t);
  game.updateView(view());
  const drawers = toolDrawers(document);
  assert.ok(drawers.every(drawer => drawer.open === false), 'Ordinary dialogue does not open tools');
  const tiny = view({
    state: 'simpler_problem', workspaceUnlocked: true, activeCard: 'tiny-case',
    revealedHints: [{ rung: 'l4', statement: 'Try the smaller version of the story.' }]
  });
  game.updateView(tiny);
  assert.ok(drawers.every(drawer => drawer.open === true), 'Both ancestor details must open to expose Tiny Case');
  assert.equal(document.getElementById('tiny-case-form').classList.contains('hidden'), false);
  assert.match(document.getElementById('hint-notes').innerHTML, /Try the smaller version/);
  drawers.forEach(drawer => { drawer.open = false; });
  game.updateView({ ...tiny, lastTutorUtterance: 'What would you try here?' });
  assert.ok(drawers.every(drawer => drawer.open === false), 'A later reply in the same Tiny Case must not reopen closed tools');
});

test('a newly revealed hint opens the workspace once, including a newly earned tiny worked step', t => {
  const { game, document } = harness(t);
  const working = view({ state: 'carry_out', workspaceUnlocked: true, activeCard: 'work-backwards' });
  const drawers = toolDrawers(document);
  game.updateView(working);
  drawers.forEach(drawer => { drawer.open = false; });
  const hinted = { ...working, revealedHints: [{ rung: 'l2', text: 'Picture the road in separate pieces.' }] };
  game.updateView(hinted);
  assert.ok(drawers.every(drawer => drawer.open === true), 'A new earned hint must be visible');
  drawers.forEach(drawer => { drawer.open = false; });
  game.updateView({ ...hinted, revealedHints: hinted.revealedHints.map(hint => ({ ...hint })) });
  assert.ok(drawers.every(drawer => drawer.open === false), 'Equivalent hint data must not reopen the drawer');

  const tiny = { ...working, revealedHints: [{ rung: 'l4', statement: 'Try the smaller story.' }] };
  game.updateView(tiny);
  drawers.forEach(drawer => { drawer.open = false; });
  const earnedStep = { ...tiny, revealedHints: [{ ...tiny.revealedHints[0], l3: 'Use the last step to work toward the beginning.' }] };
  game.updateView(earnedStep);
  assert.ok(drawers.every(drawer => drawer.open === true), 'An earned worked step is new even when its rung name is unchanged');
  drawers.forEach(drawer => { drawer.open = false; });
  game.updateView({ ...earnedStep });
  assert.ok(drawers.every(drawer => drawer.open === false));
});

test('selecting a different card exposes its workspace while repeated same-card updates do not reopen it', t => {
  const { game, document } = harness(t);
  game.updateView(view({ state: 'plan' }));
  const drawers = toolDrawers(document);
  assert.ok(drawers.every(drawer => drawer.open === false));
  const selected = view({ state: 'carry_out', workspaceUnlocked: true, activeCard: 'work-backwards' });
  game.updateView(selected);
  assert.ok(drawers.every(drawer => drawer.open === true), 'A newly chosen card should expose its tools');
  drawers.forEach(drawer => { drawer.open = false; });
  game.updateView({ ...selected, lastTutorUtterance: 'What is your next move?' });
  assert.ok(drawers.every(drawer => drawer.open === false), 'Routine responses using the same card respect manual closure');
  game.updateView({ ...selected, activeCard: 'draw-it' });
  assert.ok(drawers.every(drawer => drawer.open === true), 'Choosing a different card exposes the changed workspace');
});

test('server dialogue restores both speakers without duplicating the latest paced reply', async t => {
  const { game, document } = harness(t);
  const dialogue = [{ who: 'child', text: '<img src=x> My route.' }, { who: 'tutor', text: 'Which part would you try next?' }];
  globalThis.fetch = async () => response({ view: view({ dialogue, lastTutorUtterance: dialogue[1].text }), speech: dialogue[1].text });
  await game.handleAction({ type: 'say', text: dialogue[0].text });
  assert.deepEqual(game.history, [{ who: 'You', words: dialogue[0].text }, { who: 'Rivet', words: dialogue[1].text }]);
  const log = document.getElementById('dialogue-history-log');
  assert.match(log.innerHTML, /&lt;img src=x&gt;/);
  assert.equal((log.innerHTML.match(/Which part would you try next/g) || []).length, 1);
  game.updateView(view({ dialogue, lastTutorUtterance: dialogue[1].text }));
  assert.equal(game.history.length, 2, 'Refreshing the same view must not duplicate the log');
});

function sessionStorageSurface(t) {
  const previous = new Map(['localStorage', 'sessionStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const local = new Map(), session = new Map([['keybreakers_session_ch1-n1-reverse-tolls', 'old-session']]);
  const archived = { sessionId: 'old-session', prefix: [{ who: 'You', words: 'Archived conversation.' }], entries: [{ who: 'You', words: 'Earlier play.' }] };
  local.set('keybreakers_dialogue_ch1-n1-reverse-tolls_old-session', JSON.stringify(archived));
  local.set('keybreakers_dialogue_ch1-n1-reverse-tolls', JSON.stringify(archived));
  for (const [name, values] of [['localStorage', local], ['sessionStorage', session]]) {
    Object.defineProperty(globalThis, name, { configurable: true, value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } });
  }
  t.after(() => { for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  return { local, session };
}

test('starting a challenge from the map creates a new session and an empty conversation', async t => {
  const { game, document } = harness(t);
  const { local, session } = sessionStorageSurface(t);
  const cached = [...local];
  game.history = [{ who: 'You', words: 'The last play must end here.' }];
  const requests = [];
  globalThis.fetch = async url => {
    requests.push(url);
    if (url.endsWith('/state')) return response({ view: view({ dialogue: [{ who: 'child', text: 'Old active session.' }] }) });
    return response({ sessionId: 'new-session', view: view({ state: 'arrive', dialogue: [] }) });
  };
  await game.startEncounter('ch1-n1-reverse-tolls');
  assert.deepEqual(requests, ['/api/session/start']);
  assert.equal(game.activeSessionId, 'new-session');
  assert.deepEqual(game.history, []);
  assert.equal(document.getElementById('dialogue-history-log').innerHTML, '');
  assert.equal(session.get('keybreakers_session_ch1-n1-reverse-tolls'), 'new-session');
  assert.deepEqual([...local], cached, 'Conversation text must not be read from or persisted into local storage');
});

test('a reloaded active challenge resumes only its current server session', async t => {
  const { game } = harness(t);
  const { local } = sessionStorageSurface(t);
  const cached = [...local];
  const dialogue = [{ who: 'child', text: 'My current thought.' }, { who: 'tutor', text: 'Which part would you try next?' }];
  const requests = [];
  globalThis.fetch = async url => {
    requests.push(url);
    return response({ view: view({ dialogue, lastTutorUtterance: dialogue[1].text }) });
  };
  await game.startEncounter('ch1-n1-reverse-tolls', { resume: true });
  assert.deepEqual(requests, ['/api/session/old-session/state']);
  assert.equal(game.activeSessionId, 'old-session');
  assert.deepEqual(game.history, dialogue.map(({ who, text }) => ({ who: who === 'child' ? 'You' : 'Rivet', words: text })));
  assert.deepEqual([...local], cached);
  game.updateView(view({ dialogue, lastTutorUtterance: dialogue[1].text }));
  assert.equal(game.history.length, 2, 'A repeated server view must not duplicate current dialogue');
});

test('a restarted server starts a fresh conversation without recovering archived dialogue', async t => {
  const { game, document } = harness(t);
  sessionStorageSurface(t);
  const requests = [];
  globalThis.fetch = async url => {
    requests.push(url);
    if (url.endsWith('/old-session/state')) return { ok: false, status: 404 };
    if (url.endsWith('/dialogue')) return response({ encounterId: 'ch1-n1-reverse-tolls', dialogue: [{ who: 'child', text: 'Archived conversation.' }] });
    return response({ sessionId: 'new-session', view: view({ state: 'arrive', dialogue: [] }) });
  };
  await game.startEncounter('ch1-n1-reverse-tolls', { resume: true });
  assert.equal(game.activeSessionId, 'new-session');
  assert.deepEqual(requests, ['/api/session/old-session/state', '/api/session/start']);
  assert.deepEqual(game.history, []);
  assert.equal(document.getElementById('dialogue-history-log').innerHTML, '');
  const newDialogue = [{ who: 'tutor', text: 'Which place shall we explore?' }];
  game.updateView(view({ dialogue: newDialogue, lastTutorUtterance: newDialogue[0].text }));
  assert.deepEqual(game.history, [{ who: 'Rivet', words: newDialogue[0].text }]);
});

test('new plays use fresh calculation workspaces while reloads retain the current workspace', async t => {
  const { game } = harness(t);
  sessionStorageSurface(t);
  const keys = [];
  game.calculationTools = { setStorageKey: key => keys.push(key) };
  let nextId = 'play-a';
  globalThis.fetch = async url => url.endsWith('/state')
    ? response({ view: view({ dialogue: [] }) })
    : response({ sessionId: nextId, view: view({ dialogue: [] }) });
  await game.startEncounter('ch1-n1-reverse-tolls');
  await game.startEncounter('ch1-n1-reverse-tolls', { resume: true });
  nextId = 'play-b';
  await game.startEncounter('ch1-n1-reverse-tolls');
  assert.equal(keys[0], keys[1], 'Reload retains the same session’s calculator and scratchpad');
  assert.notEqual(keys[1], keys[2], 'Starting again must not show another play’s numbers or notes');
});

test('only the initial encounter route may resume; map navigation always starts a new play', t => {
  const { game } = harness(t);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const routes = [], listeners = {};
  const browser = { location: { hash: '#encounter?id=ch1-n1-reverse-tolls' }, addEventListener: (name, callback) => { listeners[name] = callback; } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window; });
  game.showScreen = () => {};
  game.loadCatalog = () => {};
  game.startEncounter = (id, options) => routes.push({ id, resume: Boolean(options?.resume) });
  game.initRouter();
  browser.location.hash = '#map';
  listeners.hashchange();
  browser.location.hash = '#encounter?id=ch1-n1-reverse-tolls';
  listeners.hashchange();
  assert.deepEqual(routes, [
    { id: 'ch1-n1-reverse-tolls', resume: true },
    { id: 'ch1-n1-reverse-tolls', resume: false }
  ]);
});
