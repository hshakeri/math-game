import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { createServer, sessionStore } from '../server/index.js';
import { clearSessionLog } from '../server/engine/telemetry.js';

async function start(t, encounterId = 'ch1-n1-reverse-tolls') {
  const handler = createServer().listeners('request')[0];
  const sessionId = `test-first-note-${randomUUID()}`;
  t.after(() => { sessionStore.delete(sessionId); clearSessionLog(sessionId); });
  async function post(url, body) {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]);
    Object.assign(req, { method: 'POST', url, headers: { host: 'localhost' } });
    let status, data;
    await handler(req, { writeHead(code) { status = code; }, end(body) { data = JSON.parse(body); } });
    assert.equal(status, 200);
    return data;
  }
  await post('/api/session/start', { encounterId, sessionId, tutorAdapter: 'scripted' });
  const act = action => post(`/api/session/${sessionId}/action`, { action });
  act.session = () => sessionStore.get(sessionId).session;
  return act;
}

test('the first free-form note can contain the complete answer and verification', async t => {
  const act = await start(t);
  const text = 'Gate 1: 6*2-5=7, Gate 2: 7*2-3=11, Gate 3: 11*2-9=13';
  const result = await act({ type: 'say', text });
  assert.equal(result.state, 'sealed');
  assert.equal(result.speech, null);
  assert.equal(result.events.filter(event => event.type === 'node.sealed').length, 1);
  assert.equal(result.view.dialogue.filter(entry => entry.who === 'child' && entry.text === text).length, 1);
});

test('the first bare answer asks for its reason and consumes the follow-up', async t => {
  const act = await start(t);
  const first = await act({ type: 'say', text: '6' });
  assert.equal(first.state, 'conjecture');
  assert.ok(first.events.some(event => event.type === 'conversation.reason_requested'));
  assert.match(first.speech, /proposed answer/);
  const next = await act({ type: 'say', text: 'I worked backwards through each toll.' });
  assert.equal(next.state, 'look_back');
});

for (const text of ["I don't know", 'What does the gate do?', 'I tried to start at the castle and work backwards.', 'Gate 1: 6*2-5=7']) {
  test(`a first unstructured note starts support without being dropped: ${text}`, async t => {
    const act = await start(t);
    const result = await act({ type: 'say', text });
    assert.equal(result.state, 'understand');
    assert.equal(act.session().probeCountInState, 1);
    assert.equal(act.session().history.filter(entry => entry.who === 'child' && entry.payload?.text === text).length, 1);
    assert.equal(result.view.dialogue.filter(entry => entry.who === 'child' && entry.text === text).length, 1);
    assert.doesNotMatch(result.speech, /convince|bluffing|reason behind/i);
    assert.equal(act.session().conjectures, 0);
  });
}

test('a first chip and a first stuck request enter support in the same action', async t => {
  for (const action of [{ type: 'chip', chip: 'I know where the journey ends.' }, { type: 'stuck' }]) {
    const act = await start(t);
    const result = await act(action);
    assert.equal(result.state, 'understand');
    assert.equal(act.session().history.filter(entry => entry.who === 'child').length, 1);
    assert.doesNotMatch(result.speech, /convince|bluffing/i);
  }
});

test('legacy ready action still works, and uncertainty afterward begins Understand', async t => {
  const act = await start(t);
  assert.equal((await act({ type: 'arrive' })).state, 'conjecture');
  const supported = await act({ type: 'say', text: 'I am not sure where to begin.' });
  assert.equal(supported.state, 'understand');
  const next = await act({ type: 'say', text: 'I know where the journey ends.' });
  assert.equal(next.state, 'plan');
});

test('a generic opening does not consume either allowed conjecture', async t => {
  const act = await start(t);
  await act({ type: 'say', text: 'I am not sure how to begin.' });
  const first = await act({ type: 'say', text: 'The answer is 8 because I reversed each toll.' });
  assert.equal(first.state, 'understand');
  assert.equal(first.view.conjecturesRemaining, 1);
  assert.equal(act.session().conjectures, 1);
  const second = await act({ type: 'say', text: 'The answer is 9 because I reversed each toll.' });
  assert.equal(second.state, 'understand');
  assert.equal(second.view.conjecturesRemaining, 0);
});

test('repeated stuck requests are consumed rather than leaving an inert opening', async t => {
  const act = await start(t);
  const first = await act({ type: 'stuck' });
  assert.equal(first.state, 'understand');
  assert.equal(act.session().probeCountInState, 1);
  const second = await act({ type: 'stuck' });
  assert.equal(second.state, 'plan');
  assert.equal(act.session().history.filter(entry => entry.who === 'child' && entry.action === 'stuck').length, 2);
});

test('a first explicit answer with a reason is checked without a verification shortcut', async t => {
  const act = await start(t);
  const text = 'The answer is 6 because I reversed each toll.';
  const result = await act({ type: 'say', text });
  assert.equal(result.state, 'look_back');
  assert.equal(act.session().history.filter(entry => entry.who === 'child' && entry.payload?.text === text).length, 1);
  assert.equal(result.view.dialogue.filter(entry => entry.who === 'child').length, 1);
});

test('a first leading number with because is an explicit answer and reason', async t => {
  for (const text of ['6 because I worked backwards', 'I think six because I worked backwards', '6 because I worked backwards\nthrough each toll and checked the journey']) {
    const act = await start(t);
    const result = await act({ type: 'say', text });
    assert.equal(result.state, 'look_back', text);
    assert.equal(act.session().shortcut, true);
  }
});

test('leading numeric uncertainty, questions and alternatives remain ungraded notes', async t => {
  for (const text of ['Maybe 6 because I worked backwards', '6 or 7 because I worked backwards', '6 because I am unsure', 'I think 6 because I worked backwards?', 'There are 6 coins because the story says so']) {
    const act = await start(t);
    const result = await act({ type: 'say', text });
    assert.equal(result.state, 'understand', text);
    assert.equal(act.session().conjectures, 0);
    assert.equal(act.session().pendingConversationAnswer, null);
  }
});

test('leading answer notes do not grade contradictory, retracted or help-request reasons', async t => {
  for (const text of ['6 because I get 7', '6 because I got seven', '6 because it is 7', '6 because I change my mind', '6 because I cannot tell', '6 because I can’t tell', '6 because I want help', '6 because I am unable to explain', '6 because it is six or seven']) {
    const act = await start(t);
    const result = await act({ type: 'say', text });
    assert.equal(result.state, 'understand', text);
    assert.equal(act.session().conjectures, 0);
    assert.equal(act.session().pendingConversationAnswer, null);
    assert.equal(act.session().shortcut, false);
  }
});

test('the next part accepts its first note without an explicit arrival action', async t => {
  const act = await start(t, 'ch1-n2-dark-vault');
  const first = await act({ type: 'say', text: '4 because I considered every colour' });
  assert.equal(first.state, 'sealed');
  assert.equal(first.events.some(event => event.type === 'node.sealed'), false);
  const nextPart = await act({ type: 'next_part' });
  assert.equal(nextPart.state, 'arrive');
  assert.equal(nextPart.view.currentPartId, 'b');
  const note = '10 because I considered every colour';
  const second = await act({ type: 'say', text: note });
  assert.equal(second.state, 'sealed');
  assert.equal(second.view.currentPartId, 'b');
  assert.equal(second.events.some(event => event.type === 'node.sealed'), false);
  assert.equal(act.session().history.filter(entry => entry.who === 'child' && entry.payload?.text === note).length, 1);
});
