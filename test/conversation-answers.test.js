import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { createServer, sessionStore } from '../server/index.js';
import { clearSessionLog } from '../server/engine/telemetry.js';
import { parseIntegerClaim } from '../server/engine/conversationAnswer.js';
import { generateTurn, getEncounter, buildLeakGateContext } from '../server/tutor/index.js';
import { checkUtterance } from '../server/engine/leakGate.js';

// Exercise the actual HTTP action handler, offline, without a listening socket.
async function conversation(t, encounterId = 'ch1-n1-reverse-tolls') {
  const handle = createServer().listeners('request')[0];
  const sessionId = `test-conversation-answers-${randomUUID()}`;
  t.after(() => { sessionStore.delete(sessionId); clearSessionLog(sessionId); });
  async function post(url, body) {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]);
    Object.assign(req, { method: 'POST', url, headers: { host: 'localhost' } });
    let status, payload;
    await handle(req, {
      writeHead(code) { status = code; },
      end(data) { payload = JSON.parse(data); }
    });
    assert.equal(status, 200);
    return payload;
  }
  await post('/api/session/start', { encounterId, sessionId, tutorAdapter: 'scripted' });
  const act = action => post(`/api/session/${sessionId}/action`, { action });
  act.session = () => sessionStore.get(sessionId).session;
  return act;
}

async function plan(act) {
  await act({ type: 'arrive' });
  await act({ type: 'skip_conjecture' });
  await act({ type: 'say', text: 'I need the starting amount.' });
  await act({ type: 'say', text: 'I can explain what the inscription tells me.' });
}

test('an explicit conclusion with the complete forward verification earns the Seal', async t => {
  const act = await conversation(t);
  await act({ type: 'arrive' });
  const text = 'I undid each toll in reverse order, then checked forwards. The journey gives 2*(2*(2*x-5)-3)-9=13; so x is 6.';
  const result = await act({ type: 'conjecture', value: text, reason: text });
  assert.equal(result.state, 'sealed', 'The final numeric conclusion and complete forward verification must both be credited');
  assert.equal(result.speech, null);
});

test('a numeric chat answer followed by its reason continues to Look Back', async t => {
  const act = await conversation(t);
  await act({ type: 'arrive' });
  await act({ type: 'skip_conjecture' });
  const answer = await act({ type: 'say', text: '6' });
  assert.equal(answer.state, 'understand');
  const explained = await act({ type: 'say', text: 'I undid each toll in reverse order and checked the journey forwards.' });
  assert.equal(explained.state, 'look_back', 'A pending chat answer and reason must not be counted as two Understand probes');
  assert.equal(explained.view.sealed, false, 'The earned Look Back is still required');
});

test('a typed answer to the active Look Back check earns the Seal instead of another probe', async t => {
  const act = await conversation(t);
  await act({ type: 'arrive' });
  const solved = await act({ type: 'say', text: 'The answer is 6 because I undid each toll and checked the journey.' });
  assert.equal(solved.state, 'look_back');
  const reflected = await act({ type: 'say', text: '13' });
  assert.equal(reflected.state, 'sealed');
  assert.equal(reflected.view.sealed, true);
  assert.equal(reflected.events.some(event => event.type === 'node.sealed'), true);
  assert.equal(reflected.speech, null, 'No further tutor question follows the Seal');
});

test('an incomplete symbolic equation in the Look Back form gets result-format guidance', async t => {
  const act = await conversation(t);
  await act({ type: 'arrive' });
  const algebra = 'The journey gives 2*(2*x-5)-9=13; so x is 6.';
  const solved = await act({ type: 'conjecture', value: 6, reason: 'I undid each toll.' });
  assert.equal(solved.state, 'look_back');
  assert.match(solved.speech, /What does he hold at the castle door/);
  const repeated = await act({ type: 'lookback', kind: 'verify', value: algebra });
  assert.equal(repeated.state, 'look_back');
  assert.ok(repeated.events.some(event => event.type === 'lookback.input_requested'));
  assert.match(repeated.speech, /result|number/);
  assert.notEqual(repeated.speech, solved.speech);
  assert.equal(repeated.view.sealed, false);
  const again = await act({ type: 'lookback', kind: 'verify', value: algebra });
  assert.equal(again.state, 'look_back');
  assert.ok(again.events.some(event => event.type === 'lookback.input_requested'));
  const finished = await act({ type: 'say', text: '13' });
  assert.equal(finished.state, 'sealed');
  assert.equal(finished.speech, null);
  assert.equal(finished.events.filter(event => event.type === 'node.sealed').length, 1);
  const duplicate = await act({ type: 'say', text: '13' });
  assert.equal(duplicate.events.some(event => event.type === 'node.sealed'), false);
  assert.equal(duplicate.speech, null);
});

test('Look Back keeps a selected task and checks only that task', async t => {
  const act = await conversation(t);
  await act({ type: 'arrive' });
  const solved = await act({ type: 'conjecture', value: 6, reason: 'I reversed each toll.' });
  assert.equal(solved.view.activeLookBackKind, 'verify');
  const wrongTask = await act({ type: 'say', text: '45' });
  assert.equal(wrongTask.state, 'look_back');
  assert.equal(wrongTask.view.activeLookBackKind, 'verify');
  assert.ok(wrongTask.events.some(event => event.type === 'lookback.retry'));
  assert.match(wrongTask.speech, /still open/);
  const selected = await act({ type: 'lookback_select', kind: 'second-method' });
  assert.equal(selected.view.activeLookBackKind, 'second-method');
  const finished = await act({ type: 'say', text: 'The answer is 45' });
  assert.equal(finished.state, 'sealed');
});

test('an invalid explicit reflection kind cannot fall back and earn a Seal', async t => {
  const act = await conversation(t);
  await act({ type: 'arrive' });
  await act({ type: 'conjecture', value: 6, reason: 'I reversed each toll.' });
  const result = await act({ type: 'lookback', kind: 'not-a-task', value: 13 });
  assert.equal(result.state, 'look_back');
  assert.equal(result.view.activeLookBackKind, 'verify');
  assert.ok(result.events.some(event => event.type === 'lookback.input_requested'));
});

test('unsupported equation results are never extracted as a reflection answer', async t => {
  const act = await conversation(t);
  await act({ type: 'arrive' });
  await act({ type: 'conjecture', value: 6, reason: 'I reversed each toll.' });
  for (const value of ['2+2=13', '2*(2*6-5)-9=13', 'x=13 or x=6', 'x is 6', '13?', '', 'true']) {
    const result = await act({ type: 'lookback', kind: 'verify', value });
    assert.equal(result.state, 'look_back', value);
    assert.ok(result.events.some(event => event.type === 'lookback.input_requested'), value);
  }
});

test('choice reflections expose all labels but no answer key and accept an exact label', async t => {
  const act = await conversation(t, 'ch1-n4-castle-keep');
  await act({ type: 'arrive' });
  const solved = await act({ type: 'conjecture', value: 24, reason: 'I used the shared factor.' });
  assert.equal(solved.view.activeLookBackKind, 'verify');
  const task = solved.view.lookBackOptions.find(option => option.kind === 'verify');
  assert.equal(task.responseType, 'choice');
  assert.equal(task.choices.length, 3);
  assert.equal('correct' in task, false);
  assert.equal('check' in task, false);
  const unsupported = await act({ type: 'say', text: 'I know which guardian it is.' });
  assert.ok(unsupported.events.some(event => event.type === 'lookback.input_requested'));
  assert.match(unsupported.speech, /statement/);
  const wrong = await act({ type: 'say', text: task.choices[1] });
  assert.equal(wrong.state, 'look_back');
  assert.ok(wrong.events.some(event => event.type === 'lookback.retry'));
  const finished = await act({ type: 'say', text: task.choices[0] });
  assert.equal(finished.state, 'sealed');
  assert.equal(finished.speech, null);
});

test('all reflection guidance stays local and passes the current leak gate', async () => {
  let calls = 0;
  for (const id of ['ch1-n1-reverse-tolls', 'ch1-n2-dark-vault', 'ch1-n3-five-shields', 'ch1-n4-castle-keep']) {
    const encounter = getEncounter(id);
    const part = encounter.parts.at(-1);
    for (const option of encounter.lookBack) {
      for (const conversationCue of [undefined, 'reflection_format', 'reflection_retry']) {
        const ctx = { encounterId: id, partId: part.id, state: 'look_back', rung: 'l0', reflectionKind: option.kind, conversationCue };
        const result = await generateTurn(ctx, { adapter: 'gemini', fetchFn: async () => { calls++; throw Error('Must not call model'); } });
        assert.equal(result.adapter, 'scripted');
        assert.equal(result.fallback, false);
        assert.equal(checkUtterance(result.speech, buildLeakGateContext(encounter, part, ctx)).allowed, true);
      }
    }
  }
  assert.equal(calls, 0);
});

test('integer claim parsing recognizes declarations without solving arithmetic', () => {
  for (const [text, value] of [['6', 6], ['six', 6], ['zero', 0], ['-4', -4], ['twenty-four', 24], ['The answer is 6.', 6], ['x = 6', 6], ['I think x is 6', 6], ['I believe the answer is six', 6], ['I get x = 6', 6]]) {
    assert.deepEqual(parseIntegerClaim(text), { value, reason: '' }, text);
  }
  assert.deepEqual(parseIntegerClaim('My answer is six because I reversed each toll.'), { value: 6, reason: 'i reversed each toll' });
  assert.deepEqual(parseIntegerClaim('I think the answer is 6 because I reversed each toll.'), { value: 6, reason: 'i reversed each toll' });
  for (const text of ['', ' ', '3 gates', 'I saw 6 coins', '3 + 3', 'x = 3 + 3', 'x is 6 or 7', 'x is 6 and answer is 7', 'x is 6.5', 'x is 6?', 'maybe the answer is 6', 'if x is 6', 'the answer is not 6', 'the answer is 0x6', 'Infinity', '1e6', '9007199254740993', 'I do not think the answer is 6', 'I think the answer is 6?', 'I think maybe x is 6', 'I think x is 6 but the answer is 7', 'I get 6']) {
    assert.equal(parseIntegerClaim(text), null, text);
  }
});

test('correct and incorrect bare chat claims both ask for a reason before checking', async t => {
  const responses = [];
  for (const text of ['6', '99']) {
    const act = await conversation(t);
    await act({ type: 'arrive' });
    const response = await act({ type: 'say', text });
    responses.push(response);
    assert.equal(response.state, 'conjecture');
    assert.equal(act.session().conjectures, 0);
    assert.equal(act.session().attempts, 0);
    assert.equal(response.events.some(event => event.type === 'conversation.reason_requested'), true);
    assert.equal('pendingConversationAnswer' in response.view, false);
    assert.equal('value' in response.events[0], false);
  }
  assert.equal(responses[0].speech, responses[1].speech);
});

test('a justified answer in Plan progresses without forcing card selection', async t => {
  const act = await conversation(t);
  await plan(act);
  const result = await act({ type: 'say', text: 'I think the answer is 6 because I checked each toll forwards.' });
  assert.equal(result.state, 'look_back');
  assert.equal(act.session().shortcut, true);
  assert.equal(act.session().activeCard, null);
});

test('Plan wrong claims keep the phase and the two-conjecture limit', async t => {
  const act = await conversation(t);
  await plan(act);
  for (let i = 0; i < 3; i++) {
    const result = await act({ type: 'say', text: 'My answer is 99 because I checked each toll forwards.' });
    assert.equal(result.state, 'plan');
    assert.equal(result.view.sealed, false);
  }
  assert.equal(act.session().conjectures, 2);
  assert.equal(act.session().attempts, 1, 'After the conjecture window, explicit chat claims use submission checking');
  const result = await act({ type: 'say', text: 'My answer is 6 because I checked each toll forwards.' });
  assert.equal(result.state, 'look_back');
  assert.equal(act.session().shortcut, false);
});

test('Carry Out chat submissions retain failure counting and Look Back', async t => {
  const act = await conversation(t);
  await plan(act);
  await act({ type: 'card', cardId: 'work-backwards' });
  for (let i = 0; i < 3; i++) {
    const wrong = await act({ type: 'say', text: 'My answer is 99 because I traced the whole journey.' });
    assert.equal(wrong.state, 'carry_out');
  }
  assert.equal(act.session().parentFlag, true);
  const answer = await act({ type: 'say', text: '6' });
  assert.equal(answer.state, 'carry_out');
  const result = await act({ type: 'say', text: 'I traced the whole journey forwards.' });
  assert.equal(result.state, 'look_back');
  assert.equal(act.session().attempts, 4);
  assert.equal(act.session().shortcut, false);
});

test('a later explicit chat answer can submit after Understand conjectures are exhausted', async t => {
  const act = await conversation(t);
  await act({ type: 'arrive' });
  await act({ type: 'conjecture', value: 98 });
  await act({ type: 'conjecture', value: 99 });
  const result = await act({ type: 'say', text: 'The answer is 6 because I checked each toll forwards.' });
  assert.equal(result.state, 'look_back');
  assert.equal(act.session().conjectures, 2);
  assert.equal(act.session().attempts, 1);
  assert.equal(act.session().shortcut, false);
});

test('a bare conjecture accepts its explanation on the following chat turn', async t => {
  const act = await conversation(t);
  await act({ type: 'arrive' });
  const answer = await act({ type: 'conjecture', value: 6 });
  assert.equal(answer.state, 'conjecture');
  const result = await act({ type: 'say', text: 'I traced the whole journey forwards.' });
  assert.equal(result.state, 'look_back');
});

test('a replacement chat claim replaces the pending candidate and preserves the original action', async t => {
  const act = await conversation(t);
  await act({ type: 'arrive' });
  await act({ type: 'say', text: '6' });
  await act({ type: 'say', text: '99' });
  const result = await act({ type: 'say', text: 'I traced the whole journey forwards.' });
  assert.equal(result.state, 'understand');
  assert.equal(act.session().conjectures, 1);
  assert.equal(act.session().pendingConversationAnswer, null);
  assert.equal(act.session().history.at(-1).payload.text, 'I traced the whole journey forwards.');
});

test('questions and ambiguous claims do not justify a pending answer', async t => {
  for (const text of ['Why do I need a reason?', 'I do not know', 'The answer is 6 or 7', 'I want a hint']) {
    const act = await conversation(t);
    await act({ type: 'arrive' });
    await act({ type: 'say', text: '6' });
    const result = await act({ type: 'say', text });
    assert.equal(result.state, 'conjecture', text);
    assert.equal(act.session().pendingConversationAnswer, null);
    assert.equal(act.session().conjectures, 0);
  }
});

for (const text of ['six or seven', 'I changed my mind', 'I cannot explain', 'I am unsure', 'It is seven']) {
  test(`pending chat claim is not justified by "${text}"`, async t => {
    const act = await conversation(t);
    await act({ type: 'arrive' });
    await act({ type: 'say', text: '6' });
    const result = await act({ type: 'say', text });
    assert.equal(result.state, 'conjecture');
    assert.equal(act.session().pendingConversationAnswer, null);
    assert.equal(act.session().conjectures, 0);
    assert.equal(act.session().shortcut, false);
  });
}

test('card selection clears a pending answer before an unrelated explanation', async t => {
  const act = await conversation(t);
  await plan(act);
  await act({ type: 'say', text: '6' });
  await act({ type: 'card', cardId: 'work-backwards' });
  const result = await act({ type: 'say', text: 'I want to begin with this card.' });
  assert.equal(result.state, 'carry_out');
  assert.equal(act.session().pendingConversationAnswer, null);
  assert.equal(act.session().attempts, 0);
});

test('chat answers seal only the current part and cannot carry into the next part', async t => {
  const act = await conversation(t, 'ch1-n2-dark-vault');
  await act({ type: 'arrive' });
  await act({ type: 'say', text: '4' });
  const first = await act({ type: 'say', text: 'I considered how the colours could differ.' });
  assert.equal(first.state, 'sealed');
  const second = await act({ type: 'next_part' });
  assert.equal(second.state, 'arrive');
  assert.equal(second.view.currentPartId, 'b');
  assert.equal(act.session().pendingConversationAnswer, null);
  await act({ type: 'arrive' });
  const explanation = await act({ type: 'say', text: 'I considered how the colours could differ.' });
  assert.equal(explanation.state, 'conjecture');
});

test('reason requests stay local and pass every gate across encounter rungs', async () => {
  let calls = 0;
  for (const id of ['ch1-n1-reverse-tolls', 'ch1-n2-dark-vault', 'ch1-n3-five-shields', 'ch1-n4-castle-keep']) {
    const encounter = getEncounter(id);
    for (const part of encounter.parts) {
      for (const rung of ['l0', 'l1', 'l2', 'l4', 'l3']) {
        const ctx = { encounterId: id, partId: part.id, state: 'carry_out', rung, conversationCue: 'reason' };
        const turn = await generateTurn(ctx, { adapter: 'gemini', fetchFn: async () => { calls++; throw Error('Must not call a model'); } });
        assert.equal(turn.adapter, 'scripted');
        assert.equal(turn.fallback, false);
        assert.match(turn.speech, /proposed answer/);
        assert.equal(checkUtterance(turn.speech, buildLeakGateContext(encounter, part, ctx)).allowed, true);
      }
    }
  }
  assert.equal(calls, 0);
});
