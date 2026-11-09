import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, transition, getClientSafeView } from '../server/engine/stateMachine.js';
import { getEncounter, generateTurn } from '../server/tutor/index.js';

test('tiny-problem model requests exclude the worked hint before both failed attempts', async () => {
  const encounter = getEncounter('ch1-n1-reverse-tolls');
  const part = encounter.parts[0];
  let session = createSession(encounter);
  const act = action => { session = transition(session, action, encounter).session; };
  for (const action of [
    { type: 'arrive' }, { type: 'skip_conjecture' },
    { type: 'say', text: 'I need the starting amount.' },
    { type: 'say', text: 'I know the ending amount.' },
    { type: 'card', cardId: 'work-backwards' }, { type: 'card', cardId: 'tiny-case' }
  ]) act(action);
  for (let failed = 0; failed < 2; failed++) {
    assert.equal(session.state, 'simpler_problem');
    let request;
    await generateTurn({ encounterId: encounter.id, partId: part.id, state: session.state, rung: session.hintRung }, {
      adapter: 'gemini', apiKey: 'test-only', fetchFn: async (_url, options) => {
        request = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text).context;
        throw Error('Offline wire fixture');
      }
    });
    assert.equal(request.allowedContent.hintText, null);
    assert.equal(JSON.stringify(request).includes(part.ladder.l4.l3), false);
    act({ type: 'simpler_submit', value: 999 });
  }
  assert.equal(session.state, 'carry_out');
  assert.equal(session.simplerProblemL3Unlocked, true);
  const view = getClientSafeView(session, encounter);
  assert.ok(JSON.stringify(view).includes(part.ladder.l4.l3), 'The engine still reveals the earned worked step to the child');
});
