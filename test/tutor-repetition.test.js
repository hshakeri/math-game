import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { createServer, sessionStore } from '../server/index.js';
import { clearSessionLog } from '../server/engine/telemetry.js';
import { generateTurn, getEncounter } from '../server/tutor/index.js';
import { generateTurn as scriptedTurn, callAdapter as scriptedCall } from '../server/tutor/scripted.js';
import { getScriptedProbe, SCRIPTED_FOLLOW_UPS } from '../server/engine/scripted.js';
import { checkUtterance } from '../server/engine/leakGate.js';

const base = { encounterId: 'ch1-n1-reverse-tolls', partId: 'a', state: 'understand', rung: 'l0' };

function assertSafe(speech, ctx = base) {
  const encounter = getEncounter(ctx.encounterId);
  const part = encounter.parts.find(part => part.id === ctx.partId);
  const verdict = checkUtterance(speech, {
    rung: ctx.rung, forbidden: part.forbidden, givens: encounter.givens,
    inscription: encounter.inscription, hintText: part.ladder[ctx.rung]?.text || '',
    targetAnswer: part.answer.value
  });
  assert.equal(verdict.allowed, true, `${verdict.reason}: ${speech}`);
}

// Invoke the real HTTP handler without opening a port or making a model call.
function api(t) {
  const server = createServer();
  const handle = server.listeners('request')[0];
  const sessionId = `test-tutor-repetition-${randomUUID()}`;
  t.after(() => { sessionStore.delete(sessionId); clearSessionLog(sessionId); });
  return {
    sessionId,
    async post(url, body) {
      const req = Readable.from([Buffer.from(JSON.stringify(body))]);
      req.method = 'POST';
      req.url = url;
      req.headers = { host: 'localhost' };
      let status, payload;
      await handle(req, {
        writeHead(code) { status = code; },
        end(data) { payload = JSON.parse(data); }
      });
      assert.equal(status, 200);
      return payload;
    }
  };
}

test('Reverse Tolls responds to a child explanation without restarting its first Understand probe', async t => {
  const client = api(t);
  await client.post('/api/session/start', {
    encounterId: 'ch1-n1-reverse-tolls', sessionId: client.sessionId, tutorAdapter: 'scripted'
  });
  const act = action => client.post(`/api/session/${client.sessionId}/action`, { action });
  await act({ type: 'arrive' });
  const initial = await act({ type: 'skip_conjecture' });
  const explained = await act({ type: 'say', text: 'I am trying to undo the last gate before the castle.' });
  assert.equal(initial.state, 'understand');
  assert.equal(explained.state, 'understand');
  assert.notEqual(explained.speech, initial.speech, 'The next child turn must not restart the Grubb bluffing introduction');
  assertSafe(explained.speech);
});

test('both scripted adapter entry points advance past their previous authored probe', async () => {
  const first = await scriptedTurn(base);
  const expected = getScriptedProbe(base.encounterId, base.partId, base.state, base.rung, { index: 1 });
  const nextCtx = { ...base, previousSpeech: first.speech, childMessage: 'I am not sure.' };
  assert.equal((await scriptedTurn(nextCtx)).speech, expected);
  assert.equal((await scriptedCall(nextCtx)).parsed.speech, expected);
  assert.equal((await scriptedTurn(base)).speech, first.speech, 'A different session must start independently');
});

test('router retains public conversation context for scripted selection without echoing a calculation', async () => {
  const first = await generateTurn(base, { adapter: 'scripted' });
  const explaining = {
    ...base, previousSpeech: first.speech, childAction: 'say',
    childMessage: 'I calculated 13 + 9 = 22, then I tried another step.'
  };
  const second = await generateTurn(explaining, { adapter: 'scripted' });
  const third = await generateTurn({ ...explaining, previousSpeech: second.speech }, { adapter: 'scripted' });
  assert.notEqual(second.speech, first.speech);
  assert.notEqual(third.speech, second.speech);
  assert.match(second.speech, /working|explanation|idea/);
  assert.equal(/\d/.test(second.speech), false, 'Child calculations are not copied into tutor speech');
  assertSafe(second.speech);
  assertSafe(third.speech);
});

test('network-error fallback uses the same non-repeating selection without a retry', async () => {
  let calls = 0;
  const options = { adapter: 'gemini', apiKey: 'test-only', fetchFn: async () => { calls++; throw Error('Offline fixture'); } };
  const first = await generateTurn(base, options);
  const second = await generateTurn({ ...base, previousSpeech: first.speech }, options);
  assert.equal(calls, 2);
  assert.equal(second.fallback, true);
  assert.equal(second.retries, 0);
  assert.notEqual(first.speech, second.speech);
  assertSafe(second.speech);
});

test('gate-rejected fallback still retries exactly once and rotates its authored response', async () => {
  let calls = 0;
  const options = {
    adapter: 'gemini', apiKey: 'test-only', fetchFn: async () => {
      calls++;
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ utterance: 'Great work!' }) }] } }] }) };
    }
  };
  const first = await generateTurn(base, options);
  const second = await generateTurn({ ...base, previousSpeech: first.speech }, options);
  assert.equal(calls, 4);
  assert.equal(second.fallback, true);
  assert.equal(second.retries, 1);
  assert.notEqual(first.speech, second.speech);
  assertSafe(second.speech);
});

test('a phase change selects that phase and an explanation in Plan asks about choosing a tool', async () => {
  const previous = await generateTurn(base, { adapter: 'scripted' });
  const plan = { ...base, state: 'plan', rung: 'l1', previousSpeech: previous.speech };
  const arrival = await generateTurn(plan, { adapter: 'scripted' });
  assert.equal(arrival.speech, getScriptedProbe(base.encounterId, 'a', 'plan', 'l1'));
  const reply = await generateTurn({ ...plan, previousSpeech: arrival.speech, childAction: 'say', childMessage: 'I would start at the end and work backwards.' }, { adapter: 'scripted' });
  assert.match(reply.speech, /card|Deck/);
  assertSafe(reply.speech, plan);
});

test('previous revealed tutor speech stays local and never gets added to a model request', async () => {
  let payload;
  await generateTurn({ ...base, previousSpeech: 'Private fixture for a previously revealed hint.' }, {
    adapter: 'gemini', apiKey: 'test-only', fetchFn: async (_url, options) => {
      payload = JSON.parse(options.body);
      throw Error('Offline fixture');
    }
  });
  const context = JSON.parse(payload.contents[0].parts[0].text).context;
  assert.equal('previousSpeech' in context, false);
  assert.equal(JSON.stringify(context).includes('Private fixture'), false);
});

test('all explanation follow-ups pass the full gate at every encounter, part and rung', () => {
  const ids = ['ch1-n1-reverse-tolls', 'ch1-n2-dark-vault', 'ch1-n3-five-shields', 'ch1-n4-castle-keep'];
  for (const encounterId of ids) {
    const encounter = getEncounter(encounterId);
    for (const part of encounter.parts) {
      for (const rung of ['l0', 'l1', 'l2', 'l3', 'l4']) {
        for (const [state, speeches] of Object.entries(SCRIPTED_FOLLOW_UPS)) {
          for (const speech of speeches) {
            assert.ok(speech.length >= 150 && speech.length <= 300, `${state} follow-up length`);
            assertSafe(speech, { encounterId, partId: part.id, state, rung });
          }
        }
      }
    }
  }
});

test('single-probe phases get fresh follow-ups and a faded rung never repeats the higher hint', async () => {
  for (const [state, rung] of [['conjecture', 'l0'], ['carry_out', 'l2'], ['simpler_problem', 'l4']]) {
    const ctx = { ...base, state, rung };
    const first = await generateTurn(ctx, { adapter: 'scripted' });
    const second = await generateTurn({ ...ctx, previousSpeech: first.speech }, { adapter: 'scripted' });
    const third = await generateTurn({ ...ctx, previousSpeech: second.speech }, { adapter: 'scripted' });
    assert.notEqual(second.speech, first.speech, state);
    assert.notEqual(third.speech, second.speech, state);
    assertSafe(second.speech, ctx);
    assertSafe(third.speech, ctx);
  }
  const high = await generateTurn({ ...base, state: 'carry_out', rung: 'l3' }, { adapter: 'scripted' });
  const faded = await generateTurn({ ...base, state: 'carry_out', rung: 'l1', previousSpeech: high.speech }, { adapter: 'scripted' });
  assert.equal(/\d/.test(faded.speech), false);
  assertSafe(faded.speech, { ...base, rung: 'l1' });
});

test('an authored candidate rejected by the actual gate is replaced before delivery', async () => {
  const encounter = getEncounter(base.encounterId);
  // A stricter l0 gate must reject the selected l3 text, then screen its neutral
  // replacement through the same gate. This tests the authored delivery guard.
  const turn = await generateTurn({ ...base, state: 'carry_out', rung: 'l3' }, {
    adapter: 'scripted', leakContext: {
      rung: 'l0', forbidden: encounter.parts[0].forbidden, givens: encounter.givens,
      inscription: encounter.inscription, targetAnswer: encounter.parts[0].answer.value
    }
  });
  assert.equal(/\d/.test(turn.speech), false);
  assertSafe(turn.speech);
});
