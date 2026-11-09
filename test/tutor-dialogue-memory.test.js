import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { createServer, sessionStore } from '../server/index.js';
import { clearSessionLog, logEventSync } from '../server/engine/telemetry.js';
import { getEncounter, buildAllowedContent, buildLeakGateContext } from '../server/tutor/index.js';
import { getClientSafeSessionView, assertClientSafe } from '../server/engine/clientView.js';
import { appendDialogue, childDialogueText, displayDialogue, modelDialogue, MAX_DIALOGUE_ENTRIES } from '../server/tutor/dialogue.js';

const question = 'We can keep your idea beside the inscription while we inspect the story. My notebook has room for the reasons behind your plan. Which detail would you check before taking the next step?';

// Run the real server handler and provider request builder, intercepting fetch
// before any network access. All dialogue here is synthetic and non-evaluative.
function client(t, encounterId = 'ch1-n1-reverse-tolls') {
  const sessionId = `test-dialogue-memory-${randomUUID()}`;
  const captures = [];
  const originalFetch = globalThis.fetch, oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'local-fixture-only';
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/generativelanguage\.googleapis\.com\//);
    captures.push(JSON.parse(JSON.parse(options.body).contents[0].parts[0].text).context);
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ utterance: question }) }] } }] }) };
  };
  const server = createServer();
  const handler = server.listeners('request')[0];
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
    sessionStore.delete(sessionId);
    clearSessionLog(sessionId);
  });
  async function request(method, url, body) {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
    Object.assign(req, { method, url, headers: { host: 'localhost' } });
    let status, payload;
    await handler(req, { writeHead(code) { status = code; }, end(data) { payload = JSON.parse(data); } });
    return { status, ...payload };
  }
  return {
    sessionId, captures, request,
    start: () => request('POST', '/api/session/start', { encounterId, sessionId, tutorAdapter: 'gemini' }),
    act: action => request('POST', `/api/session/${sessionId}/action`, { action }),
    state: () => request('GET', `/api/session/${sessionId}/state`),
    dialogue: () => request('GET', `/api/session/${sessionId}/dialogue`)
  };
}

function assertTextProjection(entries) {
  for (const entry of entries) {
    assert.deepEqual(Object.keys(entry).sort(), ['text', 'who']);
    assert.ok(['child', 'tutor'].includes(entry.who));
    assert.equal(typeof entry.text, 'string');
  }
}

test('a real tutor request remembers the prior safe question and explicit child reply, without engine history', async t => {
  const api = client(t);
  await api.start();
  await api.act({ type: 'arrive' });
  const previous = await api.act({ type: 'skip_conjecture' });
  const words = 'The goal is the coins at the beginning of the road.';
  const current = await api.act({ type: 'say', text: words });
  assert.equal(previous.speech, question);
  assert.equal(current.state, 'understand');
  const context = api.captures.at(-1);
  assert.ok(context.transcript.some(entry => entry.who === 'tutor' && entry.text === previous.speech));
  assert.ok(context.transcript.some(entry => entry.who === 'child' && entry.text === words));
  assertTextProjection(context.transcript);
  assert.equal(/session\.start|arrive_to_conjecture|skip_conjecture|correctness|gateVerdict/.test(JSON.stringify(context.transcript)), false);
  assert.equal('previousSpeech' in context, false);

  const state = await api.state();
  assert.deepEqual(state.view.dialogue, current.view.dialogue);
  assert.ok(state.view.dialogue.some(entry => entry.who === 'child' && entry.text === words));
  assertTextProjection(state.view.dialogue);
  assertClientSafe(state.view, getEncounter('ch1-n1-reverse-tolls'), 'a', 0);
  assert.deepEqual((await api.dialogue()).dialogue, state.view.dialogue);
});

test('a real part transition retains displayed dialogue but removes the previous part from model memory', async t => {
  const api = client(t, 'ch1-n2-dark-vault');
  await api.start();
  await api.act({ type: 'arrive' });
  const record = sessionStore.get(api.sessionId);
  record.session = { ...record.session, state: 'sealed', phase: 'sealed' };
  const next = await api.act({ type: 'next_part' });
  assert.equal(next.view.currentPartId, 'b');
  assert.equal(api.captures.at(-1).transcript.length, 0, 'The next part must not inherit an earlier part’s tutor hints');
  assert.ok(next.view.dialogue.some(entry => entry.who === 'tutor' && entry.text === question));
  assert.equal(record.session.dialogue.at(-1).partId, 'b');
});

test('a faded rung drops earlier tutor questions while keeping the child-visible conversation', async t => {
  const api = client(t);
  await api.start();
  const record = sessionStore.get(api.sessionId);
  record.session = { ...record.session, state: 'carry_out', phase: 'carry_out', activeCard: 'work-backwards' };
  await api.act({ type: 'parent_override', hintRung: 'l2' });
  await api.act({ type: 'say', text: 'I am looking at the shape of the road.' });
  await api.act({ type: 'parent_override', hintRung: 'l1' });
  const next = await api.act({ type: 'say', text: 'Let me try my plan again.' });
  assert.equal(api.captures.at(-1).transcript.some(entry => entry.who === 'tutor'), false);
  assert.ok(next.view.dialogue.some(entry => entry.who === 'tutor' && entry.text === question));
  assert.equal(api.captures.at(-1).transcript.some(entry => entry.text === 'I am looking at the shape of the road.'), false);
});

test('model history rechecks tutor speech under the full current gate and projects only plain dialogue', () => {
  const encounter = getEncounter('ch1-n1-reverse-tolls'), part = encounter.parts[0];
  const scope = { currentPartId: part.id, state: 'understand', hintRung: 'l0' };
  const entries = [
    { who: 'engine', text: 'The gate opened.', partId: part.id, rung: 'l0' },
    { who: 'tutor', text: 'Great work!', partId: part.id, rung: 'l0' },
    { who: 'tutor', text: question, partId: 'other', rung: 'l0' },
    { who: 'tutor', text: question, partId: part.id, rung: 'l2' },
    { who: 'tutor', text: question, partId: part.id, rung: 'l0', correct: true, hidden: 'not for the provider' },
    { who: 'child', text: 'My own idea is 99 coins.', partId: part.id, rung: 'l0', isCorrect: false }
  ];
  const gate = buildLeakGateContext(encounter, part, {
    state: scope.state, rung: scope.hintRung,
    allowedContent: buildAllowedContent(encounter, part, scope.state, scope.hintRung)
  });
  assert.deepEqual(modelDialogue({ ...scope, dialogue: entries }, gate), [
    { who: 'tutor', text: question }, { who: 'child', text: 'My own idea is 99 coins.' }
  ]);
});

test('dialogue is bounded, immutable across transitions, and never copies mechanics or parent data', () => {
  let session = { currentPartId: 'a', state: 'understand', hintRung: 'l0', dialogue: [] };
  const original = session;
  for (let i = 0; i < MAX_DIALOGUE_ENTRIES + 5; i++) {
    session = { ...session, dialogue: appendDialogue(session, 'child', `My own thought ${i}`) };
  }
  assert.equal(original.dialogue.length, 0);
  assert.equal(session.dialogue.length, MAX_DIALOGUE_ENTRIES);
  assert.equal(session.dialogue[0].text, 'My own thought 5');
  assert.equal(childDialogueText({ type: 'step', payload: { result: 99 } }), '');
  assert.equal(childDialogueText({ type: 'parent_override', text: 'private override', value: 99 }), '');
  assert.equal(childDialogueText({ type: 'conjecture', value: 99, reason: 'I counted my own coins.' }), '99 — I counted my own coins.');
  assertTextProjection(displayDialogue([...session.dialogue, { who: 'parent', text: 'private override' }]));
  const encounter = getEncounter('ch1-n1-reverse-tolls');
  const view = getClientSafeSessionView({ ...session, encounterId: encounter.id, dialogue: [{ ...session.dialogue[0], answer: 99, correct: true }] }, encounter);
  assert.deepEqual(view.dialogue, [{ who: 'child', text: 'My own thought 5' }]);
  assertClientSafe(view, encounter);
});

test('saved dialogue survives a missing in-memory session without returning rejected output or replaying state', async t => {
  const api = client(t);
  await api.start();
  await api.act({ type: 'arrive' });
  await api.act({ type: 'skip_conjecture' });
  await api.act({ type: 'say', text: 'I want to remember what we said about the road.' });
  const expected = (await api.dialogue()).dialogue;
  logEventSync(api.sessionId, 'utterance_rejected', { candidate: 'private rejected candidate', raw: 'private provider output' });
  logEventSync(api.sessionId, 'engine.transition', { correct: true, answer: 'private engine answer' });
  logEventSync(api.sessionId, 'tutor.say', { speech: question, source: 'unpaired injection' });
  logEventSync(api.sessionId, 'tutor.call', { encounterId: 'ch1-n1-reverse-tolls', partId: 'a', state: 'understand', rung: 'l0' });
  logEventSync(api.sessionId, 'tutor.say', { speech: 'Great work!', source: 'unsafe injection' });
  sessionStore.delete(api.sessionId);
  assert.equal((await api.state()).status, 404);
  const saved = await api.dialogue();
  assert.equal(saved.status, 200);
  assert.equal(saved.encounterId, 'ch1-n1-reverse-tolls');
  assert.deepEqual(saved.dialogue, expected);
  assertTextProjection(saved.dialogue);
  assert.equal(sessionStore.has(api.sessionId), false, 'Reading history must not reconstruct progress or a model session');
  assert.equal(JSON.stringify(saved).includes('private'), false);
});

test('saved dialogue rejects path-like IDs and does not invent missing conversations', async t => {
  const api = client(t);
  for (const id of ['%2e%2e%2fprivate', 'bad.id', '%00', 'bad%5cpath']) {
    const response = await api.request('GET', `/api/session/${id}/dialogue`);
    assert.equal(response.status, 400);
    assert.equal(response.dialogue, undefined);
  }
  assert.equal((await api.dialogue()).status, 404);
});
