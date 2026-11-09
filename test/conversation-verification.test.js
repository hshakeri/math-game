import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { createServer, sessionStore } from '../server/index.js';
import { clearSessionLog } from '../server/engine/telemetry.js';
import { getEncounter } from '../server/tutor/index.js';
import { verifyForwardEvidence } from '../server/engine/forwardVerification.js';

async function child(t) {
  const handle = createServer().listeners('request')[0];
  const sessionId = `test-existing-verification-${randomUUID()}`;
  t.after(() => { sessionStore.delete(sessionId); clearSessionLog(sessionId); });
  async function post(url, body) {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]);
    Object.assign(req, { method: 'POST', url, headers: { host: 'localhost' } });
    let status, data;
    await handle(req, { writeHead(code) { status = code; }, end(body) { data = JSON.parse(body); } });
    assert.equal(status, 200);
    return data;
  }
  await post('/api/session/start', { encounterId: 'ch1-n1-reverse-tolls', sessionId, tutorAdapter: 'scripted' });
  const act = action => post(`/api/session/${sessionId}/action`, { action });
  await act({ type: 'arrive' });
  return act;
}

const route = '((2x-5)*2-3)*2-9';
const gateSteps = 'Gate 1: 6*2 -5 = 7, Gate 2: 7*2-3 = 11, Gate 3: 11*2-9 = 13';

test('the complete ordered Gate list earns verification after a partial Gate reply', async t => {
  const act = await child(t);
  await act({ type: 'conjecture', value: 6, reason: 'I reversed each toll.' });
  const partial = await act({ type: 'lookback', kind: 'verify', value: 'Gate 1: 6*2 -5 = 7' });
  assert.equal(partial.state, 'look_back');
  const complete = await act({ type: 'lookback', kind: 'verify', value: gateSteps });
  assert.equal(complete.state, 'sealed');
  assert.equal(complete.speech, null);
  assert.equal(complete.events.filter(event => event.type === 'lookback.verified').length, 1);
  assert.equal(complete.events.filter(event => event.type === 'node.sealed').length, 1);
});

test('a gate-step reason with a separately entered answer and a chat gate list both finish', async t => {
  const initial = await child(t);
  assert.equal((await initial({ type: 'conjecture', value: '6', reason: gateSteps })).state, 'sealed');
  const chat = await child(t);
  await chat({ type: 'conjecture', value: 6, reason: 'I reversed each toll.' });
  assert.equal((await chat({ type: 'say', text: gateSteps })).state, 'sealed');
});

for (const phase of ['conjecture', 'understand', 'plan']) {
  test(`a fully validated Gate list in ${phase} chat includes its own starting claim`, async t => {
    const act = await child(t);
    if (phase !== 'conjecture') await act({ type: 'skip_conjecture' });
    if (phase === 'plan') {
      await act({ type: 'say', text: 'I need the starting amount.' });
      await act({ type: 'say', text: 'I know the story ends at the castle.' });
    }
    const partial = await act({ type: 'say', text: 'Gate 1: 6*2-5=7' });
    assert.equal(partial.state, phase);
    assert.equal(partial.events.some(event => event.type === 'node.sealed'), false);
    const complete = await act({ type: 'say', text: gateSteps });
    assert.equal(complete.state, 'sealed');
    assert.equal(complete.speech, null);
    assert.equal(complete.events.filter(event => event.type === 'node.sealed').length, 1);
  });
}

test('gate lists reject wrong, disconnected, incomplete or extended steps', async t => {
  const invalid = [
    'Gate 1: 6*2-5=8, Gate 2: 8*2-3=13, Gate 3: 13*2-9=17',
    'Gate 1: 6*2-5=7, Gate 2: 8*2-3=13, Gate 3: 11*2-9=13',
    'Gate 2: 6*2-5=7, Gate 1: 7*2-3=11, Gate 3: 11*2-9=13',
    'Gate 1: 6*2-5=7, Gate 3: 11*2-9=13',
    'Gate 1: 6*2-5=7, Gate 1: 7*2-3=11, Gate 3: 11*2-9=13',
    gateSteps.replace('6*2', '6*2+0'),
    gateSteps.replace('= 13', '= 13%2'),
    gateSteps + ', Gate 4: 13*2-9=17',
    gateSteps + '; 1=2',
    gateSteps + '; so x is 7',
    'I did not check: ' + gateSteps
  ];
  const encounter = getEncounter('ch1-n1-reverse-tolls');
  const verification = encounter.lookBack.find(option => option.kind === 'verify');
  for (const value of invalid) {
    assert.equal(verifyForwardEvidence(value, 6, encounter.parts[0], verification), null, value);
  }
  assert.equal(verifyForwardEvidence(gateSteps, 7, encounter.parts[0], verification), null);
  assert.equal(verifyForwardEvidence('7\n' + gateSteps, 6, encounter.parts[0], verification), null);
  assert.equal(verifyForwardEvidence(gateSteps, 6, encounter.parts[0], encounter.lookBack.find(option => option.kind === 'perturb')), null);
  const act = await child(t);
  await act({ type: 'conjecture', value: 6, reason: 'I reversed each toll.' });
  for (const value of invalid) {
    const result = await act({ type: 'lookback', kind: 'verify', value });
    assert.equal(result.state, 'look_back');
    assert.equal(result.events.some(event => event.type === 'node.sealed'), false);
  }
});

test('the natural prose form and numeric answer field earn the existing verification', async t => {
  const act = await child(t);
  const reason = 'I assume the initial number of coins is x, then I have ((2x-5)*2-3)*2)-9 = 13 so x is 6';
  const result = await act({ type: 'conjecture', value: '6', reason });
  assert.equal(result.state, 'sealed');
  assert.equal(result.speech, null);
  assert.equal(result.events.filter(event => event.type === 'lookback.verified').length, 1);
});

test('the same complete explanation works in chat and in an existing verify task', async t => {
  const explanation = `The journey gives ${route}=13; so x is 6.`;
  const act = await child(t);
  const result = await act({ type: 'say', text: explanation });
  assert.equal(result.state, 'sealed');
  const later = await child(t);
  assert.equal((await later({ type: 'conjecture', value: 6, reason: 'I reversed the journey.' })).state, 'look_back');
  const credited = await later({ type: 'lookback', kind: 'verify', value: explanation });
  assert.equal(credited.state, 'sealed');
  assert.equal(credited.speech, null);
});

test('a fully substituted numeric toll route verifies without a repeated starting declaration', async t => {
  const act = await child(t);
  await act({ type: 'conjecture', value: 6, reason: 'I reversed the journey.' });
  const result = await act({ type: 'say', text: '2*(2*(2*6-5)-3)-9=13' });
  assert.equal(result.state, 'sealed');
});

test('generic reasons still require Look Back and evidence does not complete another selected task', async t => {
  const act = await child(t);
  const guessed = await act({ type: 'conjecture', value: 6, reason: 'I thought about it.' });
  assert.equal(guessed.state, 'look_back');
  await act({ type: 'lookback_select', kind: 'second-method' });
  const result = await act({ type: 'say', text: `The journey gives ${route}=13; so x is 6.` });
  assert.equal(result.state, 'look_back');
  assert.equal(result.events.some(event => event.type === 'node.sealed'), false);
});

test('wrong or incomplete evidence never completes the verification', async t => {
  for (const equation of ['((2x-3)*2-5)*2-9=13', '((2x-5)+2-3)*2-9=13', '(2x-5)*2-9=13', '((2x-5)*2-3)*2-9=14', '((2x-5)*2-3*2-9=13', '((2x-5)*2-3)*2))-9=13', '13=13']) {
    const act = await child(t);
    const text = `I have ${equation}; so x is 6.`;
    const result = await act({ type: 'conjecture', value: text, reason: text });
    assert.equal(result.state, 'look_back', equation);
    assert.equal(result.events.some(event => event.type === 'node.sealed'), false);
  }
  const wrong = await child(t);
  const wrongAnswer = await wrong({ type: 'conjecture', value: 7, reason: `I have ${route}=13; so x is 7.` });
  assert.equal(wrongAnswer.state, 'understand');
});

test('the verifier consumes closed equation boundaries and rejects unsupported arithmetic or retractions', () => {
  const encounter = getEncounter('ch1-n1-reverse-tolls');
  const part = encounter.parts[0];
  const verification = encounter.lookBack.find(option => option.kind === 'verify');
  const invalid = [
    ...['1+', '1 + ', '99＋', 'false && ', '!', '99|', '99+\u200b', 'foo'].map(prefix => `${prefix}${route}=13; so x is 6.`),
    ...['13%2', '13^2', '13−2', '13(2)', '13!=13', '13<0', '13!', '13[0]', '13.5', '13/1', '13 + 0'].map(rhs => `${route}=${rhs}; so x is 6.`),
    `${route}=13; 1=2; so x is 6.`, `${route}=13; so x is 6 or 7.`,
    `${route}=13; so x is 7.`, `((2*7-5)*2-3)*2-9=13; so x is 6.`,
    ...["I didn't check this", "I haven't checked", 'I haven’t checked', 'I don’t know', 'I never checked', 'Ignore this', 'Cancel that', 'Maybe', 'I am unsure'].map(prefix => `${prefix}: ${route}=13; so x is 6.`)
  ];
  for (const text of invalid) assert.equal(verifyForwardEvidence(text, 6, part, verification), null, text);
  assert.ok(verifyForwardEvidence(`I have ${route}=13 so x is 6`, 6, part, verification));
  assert.ok(verifyForwardEvidence(`The journey gives ${route}=13; so the answer is 6.`, 6, part, verification));
});

for (const equation of ['((2x-5)*2-3)*2-9=13', '((2x-5)*2-3)*2)-9=13']) {
  test(`a complete forward verification earns the Seal in its original turn: ${equation}`, async t => {
    const act = await child(t);
    const explanation = `I followed each toll in the journey: ${equation}; so x is 6.`;
    const result = await act({ type: 'conjecture', value: explanation, reason: explanation });
    assert.equal(result.state, 'sealed', 'The child has supplied both the starting answer and its full forward verification');
    assert.equal(result.speech, null);
    assert.equal(result.events.filter(event => event.type === 'node.sealed').length, 1);
    const repeated = await act({ type: 'say', text: explanation });
    assert.equal(repeated.events.some(event => event.type === 'node.sealed'), false);
  });
}
