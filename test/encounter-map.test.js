import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSession } from '../server/engine/stateMachine.js';
import { getClientSafeEncounter, getClientSafeSessionView, assertClientSafe } from '../server/engine/clientView.js';
import { storyStops, renderEncounterMap } from '../client/encounter-map.js';
import { escapeHTML } from '../client/story.js';

const encounterNames = ['chasm-reverse-tolls', 'alchemists-dark-vault', 'courtyard-five-shields', 'castle-keep-portcullis'];
const encounters = encounterNames.map(name => JSON.parse(readFileSync(
  new URL(`../content/encounters/${name}.json`, import.meta.url), 'utf8'
)));
const tolls = encounters[0];
const arrivalView = encounter => getClientSafeSessionView(createSession(encounter), encounter);
const vaultStory = {
  encounterId: 'ch1-n2-dark-vault', currentPartId: 'a',
  story: { kind: 'dark-vault', beats: [
    { id: 'chest', text: 'The chest is dark and its crystals are mixed.' },
    { id: 'rules', text: 'Choose the smallest guaranteed count. Drawn crystals stay out. Each torch starts with a new full chest.' },
    { id: 'goal', text: 'What is the smallest count for this torch?' }
  ] }
};

function stopButtons(html) {
  return html.match(/<button\b(?=[^>]*\bdata-story-stop=)[^>]*>/g) || [];
}

function selectedStop(html) {
  const selected = stopButtons(html).filter(tag => /aria-pressed="true"/.test(tag));
  assert.equal(selected.length, 1, 'Exactly one story stop must be selected');
  return Number(selected[0].match(/data-story-stop="(\d+)"/)[1]);
}

describe('Comic story exposes only public forward givens', () => {
  it('projects the same inscription givens into the static and dynamic arrival story', () => {
    const expected = {
      kind: 'toll-road',
      gates: tolls.parts[0].mechanic.gates.map(({ mul, sub }) => ({ mul, sub })),
      end: tolls.parts[0].mechanic.end
    };
    assert.deepEqual(getClientSafeEncounter(tolls).story, expected);
    const view = arrivalView(tolls);
    assert.deepEqual(view.story, expected);
    assert.equal(view.workspaceUnlocked, false);
    assert.equal(view.diagram, null);
    assert.deepEqual(view.revealedHints, []);
    assertClientSafe(view, tolls, tolls.parts[0].id, 0);
  });

  it('describes each gate in source order: multiplication, then payment', () => {
    const stops = storyStops(arrivalView(tolls));
    const gates = tolls.parts[0].mechanic.gates;
    assert.equal(stops.length, gates.length + 2);
    for (const [index, gate] of gates.entries()) {
      const stop = stops[index + 1];
      assert.equal(stop.name, `Gate ${index + 1}`);
      assert.equal(stop.rule, `× ${gate.mul} → − ${gate.sub}`);
      assert.ok(stop.words.indexOf('double') < stop.words.indexOf('Then he pays'), 'Multiplication comes before payment');
      assert.match(stop.words, new RegExp(`Then he pays ${gate.sub} Star-Coins\\.`));
    }
    assert.match(stops[0].words, /How many coins did he start with\?/);
    assert.match(stops.at(-1).words, new RegExp(`exactly ${tolls.parts[0].mechanic.end} Star-Coins`));
    assert.doesNotMatch(stops.map(stop => `${stop.words} ${stop.rule || ''}`).join(' '),
      /\b(?:undo|divide|backwards|give back|halves|add the toll)\b/i,
      'The arrival story must not teach the later inverse procedure');
  });

  it('does not reveal the target answer or unproduced intermediate values in story prose', () => {
    const view = arrivalView(tolls);
    const stops = storyStops(view);
    const storyText = stops.map(stop => `${stop.name} ${stop.words} ${stop.rule || ''}`).join(' ');
    const hidden = new Set([tolls.parts[0].answer.value, ...tolls.parts[0].intermediates.map(item => item.value)]);
    for (const value of hidden) assert.doesNotMatch(storyText, new RegExp(`\\b${value}\\b`));
    assert.deepEqual(Object.keys(view.story).sort(), ['end', 'gates', 'kind']);
    for (const gate of view.story.gates) assert.deepEqual(Object.keys(gate).sort(), ['mul', 'sub']);
  });

  it('keeps hidden metadata out of the story and static mechanic gate objects', () => {
    const fixture = structuredClone(tolls);
    const part = fixture.parts[0];
    part.mechanic.solution = 'PRIVATE_MECHANIC_SOLUTION';
    part.mechanic.values = ['PRIVATE_FILLED_VALUES'];
    part.mechanic.gates[0].answer = { value: 987654321 };
    part.mechanic.gates[0].solutionHint = 'PRIVATE_GATE_SOLUTION';
    const staticView = getClientSafeEncounter(fixture);
    const dynamicView = arrivalView(fixture);
    for (const view of [staticView, dynamicView]) {
      assert.doesNotMatch(JSON.stringify(view), /PRIVATE_|987654321/);
      assertClientSafe(view, fixture, part.id, 0);
    }
    assert.deepEqual(staticView.parts[0].mechanic.gates[0], {
      mul: tolls.parts[0].mechanic.gates[0].mul,
      sub: tolls.parts[0].mechanic.gates[0].sub
    });
    staticView.story.gates[0].sub = -123;
    assert.equal(fixture.parts[0].mechanic.gates[0].sub, tolls.parts[0].mechanic.gates[0].sub,
      'The client story must not alias the authored mechanic');
  });

  it('does not add toll instructions or invented clues to other encounters', () => {
    for (const encounter of encounters.slice(2)) {
      const view = arrivalView(encounter);
      assert.equal(view.story, null);
      assert.equal(getClientSafeEncounter(encounter).story, null);
      const stops = storyStops(view);
      assert.ok(stops.length > 0);
      assert.equal(stops.map(stop => stop.words).join(' '), encounter.inscription);
      assert.ok(stops.every(stop => stop.rule === undefined));
    }
  });
});

describe('Comic language, safe markup and reading controls', () => {
  it('pairs the three Vault beats with distinct neutral illustrations and named speakers', () => {
    const stops = storyStops(vaultStory);
    assert.deepEqual(stops.map(stop => stop.name), ['The chest', 'The rules', 'This torch']);
    assert.deepEqual(stops.map(stop => stop.words), vaultStory.story.beats.map(beat => beat.text));
    const scenes = [
      ['keeper-alchemist', 'The Alchemist', 'Keeper'],
      ['rivet', 'Rivet', 'Owl guide'],
      ['grubb-neutral', 'Grubb', 'Goblin challenger']
    ];
    scenes.forEach(([art, speaker, role], index) => {
      const html = renderEncounterMap(vaultStory, index);
      assert.equal(selectedStop(html), index);
      assert.match(html, new RegExp(`/assets/illustrations/${art}\\.png`));
      assert.match(html, new RegExp(`<strong>${speaker}</strong>`));
      assert.ok(html.includes(`<span>${role}</span>`));
      assert.ok(html.includes(`<p>${escapeHTML(stops[index].words)}</p>`));
      assert.equal((html.match(/class="story-caption"/g) || []).length, 1);
      assert.doesNotMatch(html, /grubb-(?:smirk|fume)|CLANK|clunk/);
    });
  });

  it('uses fixed presentation assets and escapes each public Vault beat', () => {
    const malicious = structuredClone(vaultStory);
    malicious.story.beats[1].text = 'A "rule" & <script>not markup</script>.';
    malicious.story.beats[1].art = 'https://example.invalid/private.png';
    malicious.story.beats[1].speaker = '<img src=x onerror=alert(1)>';
    const html = renderEncounterMap(malicious, 1);
    assert.match(html, /A &quot;rule&quot; &amp; &lt;script&gt;not markup&lt;\/script&gt;/);
    assert.match(html, /\/assets\/illustrations\/rivet\.png/);
    assert.doesNotMatch(html, /https:\/\/example|<script>|<img src=x/);
  });

  it('marks the selected toll landmark visually and names its narrator', () => {
    const html = renderEncounterMap(arrivalView(tolls), 2);
    assert.match(html, /class="story-landmark story-landmark-selected"/);
    assert.match(html, /<strong>The Toll Troll<\/strong>/);
    assert.match(html, /<span>Keeper<\/span>/);
    assert.equal((html.match(/story-landmark-selected/g) || []).length, 1);
  });

  it('uses the fixed boy and his journey without a name or avatar questionnaire', () => {
    const view = arrivalView(tolls);
    const words = storyStops(view).map(stop => stop.words).join(' ');
    assert.match(words, /A boy/);
    assert.match(words, /His coins/);
    assert.match(words, /Then he pays/);
    assert.match(words, /He reaches/);
    assert.doesNotMatch(words, /\b(?:she|her|they|their)\b/i);
    const html = renderEncounterMap(view);
    assert.match(html, /\/assets\/sprites\/hero-1-idle\.svg/);
    assert.doesNotMatch(html, /<input|<select|hero-options|hero-name/);
  });

  it('escapes public prose in both captions and accessible button labels', () => {
    const inscription = 'A boy reads "<img src=x onerror=alert(1)>" & waits. His satchel stays closed.';
    const view = { encounterId: encounters[1].id, inscription, story: null };
    const html = renderEncounterMap(view);
    assert.ok(html.includes(escapeHTML(storyStops(view)[0].words)));
    assert.doesNotMatch(html, /<img src=x|<script|aria-label="[^"]*"<img/);
    assert.match(html, /&quot;&lt;img src=x onerror=alert\(1\)&gt;&quot; &amp; waits/);
    assert.match(html, /aria-live="polite" aria-atomic="true"/);
  });

  it('exposes a selectable control for every story stop and one active caption', () => {
    const view = arrivalView(tolls);
    const stops = storyStops(view);
    for (let index = 0; index < stops.length; index++) {
      const html = renderEncounterMap(view, index);
      const buttons = stopButtons(html);
      assert.equal(buttons.length, stops.length);
      assert.deepEqual(buttons.map(tag => Number(tag.match(/data-story-stop="(\d+)"/)[1])), stops.map((_, i) => i));
      assert.equal(selectedStop(html), index);
      assert.ok(html.includes(`<p>${escapeHTML(stops[index].words)}</p>`));
      assert.ok(buttons.every(tag => /type="button"/.test(tag)));
    }
  });

  it('clamps out-of-range selections and changes the final control to replay', () => {
    const view = arrivalView(tolls);
    const last = storyStops(view).length - 1;
    assert.equal(selectedStop(renderEncounterMap(view, -100)), 0);
    assert.equal(selectedStop(renderEncounterMap(view, 100)), last);
    assert.equal(selectedStop(renderEncounterMap(view, 1.9)), 1);
    for (const selection of [NaN, Infinity, -Infinity, '2']) {
      assert.equal(selectedStop(renderEncounterMap(view, selection)), 0,
        'Invalid selection state must leave a usable selected stop');
    }
    assert.match(renderEncounterMap(view, 0), /data-story-next>Next part of the story →<\/button>/);
    assert.match(renderEncounterMap(view, last), /data-story-next>Read the story again ↺<\/button>/);
    assert.equal(selectedStop(renderEncounterMap(view)), 0, 'Starting the reading cycle again selects the beginning');
  });
});
