import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateEncounter } from '../content/validate.js';
import { createSession, transition } from '../server/engine/stateMachine.js';
import { getClientSafeEncounter, getClientSafeSessionView, assertClientSafe } from '../server/engine/clientView.js';
import { generateTurn } from '../server/tutor/index.js';

const encounter = JSON.parse(readFileSync(new URL('../content/encounters/alchemists-dark-vault.json', import.meta.url), 'utf8'));
const paragraphs = encounter.inscription.split('\n\n');

test('Dark Vault states the minimum, keeps picked crystals out, and resets each torch', () => {
  assert.equal(encounter.contentVersion, 2);
  assert.equal(paragraphs.length, 2);
  assert.match(paragraphs[0], /12 ruby crystals, 12 sapphire crystals and 12 emerald crystals/);
  assert.match(paragraphs[1], /Each torch starts with a full chest/);
  assert.match(paragraphs[1], /picks one crystal at a time/);
  assert.match(paragraphs[1], /Do not put any crystals back until that torch is finished/);
  assert.match(paragraphs[1], /smallest number of grabs.*always.*worst luck/);
  for (const part of encounter.parts) assert.match(part.prompt, /smallest number of grabs.*always/);
});

test('static and active-part views expose exactly three public story beats', () => {
  const first = getClientSafeEncounter(encounter).story;
  assert.deepEqual(first, { kind: 'dark-vault', beats: [
    { id: 'chest', text: paragraphs[0] },
    { id: 'rules', text: paragraphs[1] },
    { id: 'goal', text: encounter.parts[0].prompt }
  ] });
  let session = createSession(encounter);
  for (const [index, part] of encounter.parts.entries()) {
    assert.equal(session.currentPartId, part.id);
    const view = getClientSafeSessionView(session, encounter);
    assert.equal(view.story.beats.length, 3);
    assert.deepEqual(view.story.beats.slice(0, 2), first.beats.slice(0, 2));
    assert.deepEqual(view.story.beats[2], { id: 'goal', text: part.prompt });
    assert.equal(view.story.beats[2].text, view.partPrompt);
    assertClientSafe(view, encounter, part.id, 0);
    if (index < encounter.parts.length - 1) {
      session = transition(session, { type: 'arrive' }, encounter).session;
      session = transition(session, { type: 'conjecture', value: part.answer.value, reason: 'I considered every colour.' }, encounter).session;
      session = transition(session, { type: 'next_part' }, encounter).session;
    }
  }
});

test('story projection never copies answer, strategy or mechanic metadata', () => {
  const fixture = structuredClone(encounter);
  fixture.story = { answer: 'PRIVATE_STORY_ANSWER', solution: 'PRIVATE_STORY_SOLUTION' };
  for (const part of fixture.parts) {
    part.answer.extra = 'PRIVATE_ANSWER';
    part.mechanic.solution = 'PRIVATE_MECHANIC';
    part.story = { text: 'PRIVATE_PART_HINT' };
  }
  for (const view of [getClientSafeEncounter(fixture), getClientSafeSessionView(createSession(fixture), fixture)]) {
    assert.deepEqual(Object.keys(view.story).sort(), ['beats', 'kind']);
    for (const beat of view.story.beats) assert.deepEqual(Object.keys(beat).sort(), ['id', 'text']);
    assert.doesNotMatch(JSON.stringify(view.story), /PRIVATE_|answer|intermediate|forbidden|mechanic|ladder|solution/i);
    assert.equal(view.story.beats[2].text, fixture.parts[0].prompt);
  }
});

test('the tutor receives the same public rules and the active torch goal', async () => {
  let request;
  await generateTurn({ encounterId: encounter.id, partId: 'b', state: 'understand', rung: 'l0' }, {
    adapter: 'gemini', apiKey: 'offline-fixture', fetchFn: async (_url, options) => {
      request = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text).context;
      throw Error('Offline request inspection');
    }
  });
  assert.equal(request.inscription, encounter.inscription);
  assert.equal(request.partPrompt, encounter.parts[1].prompt);
  assert.equal('answer' in request, false);
  assert.equal('mechanic' in request, false);
});

test('content validation preserves the two authored paragraphs used by the three-beat story', async () => {
  assert.equal((await validateEncounter(encounter, { runMechanics: true })).errors.length, 0);
  for (const inscription of [paragraphs.join(' '), paragraphs.join('\n\n') + '\n\nAnother separate paragraph.']) {
    const result = await validateEncounter({ ...encounter, inscription });
    assert.ok(result.errors.some(error => error.field === 'inscription' && /exactly two public story paragraphs/.test(error.message)));
  }
});
