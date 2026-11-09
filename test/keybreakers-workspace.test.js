import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSession, transition } from '../server/engine/stateMachine.js';
import { getClientSafeSessionView, assertClientSafe } from '../server/engine/clientView.js';
import { renderDiagram, mountDiagram } from '../client/diagrams/index.js';

const encounters = [
  'chasm-reverse-tolls',
  'alchemists-dark-vault',
  'courtyard-five-shields',
  'castle-keep-portcullis'
].map(name => JSON.parse(readFileSync(new URL(`../content/encounters/${name}.json`, import.meta.url), 'utf8')));

function enterWorkspace(encounter) {
  let session = createSession(encounter);
  for (const action of [
    { type: 'arrive' },
    { type: 'skip_conjecture' },
    { type: 'say', text: 'I can name what we know.' },
    { type: 'say', text: 'I can name what we are hunting.' },
    { type: 'card', cardId: encounter.cards[0] }
  ]) {
    session = transition(session, action, encounter).session;
  }
  return session;
}

describe('Keybreakers workspace availability without revealing higher hints', () => {
  for (const encounter of encounters) {
    it(`${encounter.id} exposes usable tools immediately after a card at l0`, () => {
      const session = enterWorkspace(encounter);
      const view = getClientSafeSessionView(session, encounter);

      assert.equal(view.phase, 'carry_out');
      assert.equal(view.hintRung, 'l0');
      assert.equal(view.workspaceUnlocked, true);
      assert.ok(view.diagram, 'Choosing a card must expose the workspace without needing a hint');
      assert.equal(view.diagram.mode, 'workspace');
      assert.deepEqual(view.revealedHints, []);
      assertClientSafe(view, encounter, session.currentPartId, 0);

      const svg = renderDiagram(view.diagram, view.diagram.mode, view.mechanicState);
      assert.match(svg, /data-action=/, 'The initial workspace must contain playable controls');
      assert.doesNotMatch(svg, /Diagram Component Not Found/);
      const params = view.diagram.params;
      for (const key of ['unitShort', 'unitLong', 'values', 'leaves', 'answer', 'intermediates', 'forbidden']) {
        assert.equal(Object.hasOwn(params, key), false, `Initial workspace must not reveal ${key}`);
      }

      // The hint renderer is still withheld before l2, even though Stage 3 tools exist.
      const beforeCard = getClientSafeSessionView(createSession(encounter), encounter);
      assert.equal(beforeCard.diagram, null);
      assert.deepEqual(beforeCard.revealedHints, []);
      assert.deepEqual(Object.keys(view).sort(), Object.keys(beforeCard).sort());
    });
  }

  it('uses only public mechanic givens for each workspace, including all Vault targets', () => {
    for (const encounter of encounters) {
      for (const part of encounter.parts) {
        // A one-part fixture keeps this test on the normal card-selection lifecycle.
        const fixture = { ...encounter, parts: [part] };
        const session = enterWorkspace(fixture);
        const view = getClientSafeSessionView(session, fixture);
        const mechanic = part.mechanic;
        assert.ok(view.diagram);
        assertClientSafe(view, fixture, part.id, 0);
        const expected = {
          'inverse-chain': { gates: mechanic.gates, end: mechanic.end },
          'goblin-bins': { bins: mechanic.bins, perBin: mechanic.perBin, target: mechanic.target },
          'seam-grid': { ...mechanic.relation, outerPerimeter: mechanic.outerPerimeter },
          'factor-dials': { roots: mechanic.products?.map(product => product.value) }
        }[mechanic.kind];
        assert.deepEqual(view.diagram.params, expected);
      }
    }
  });

  it('continues to expose authored hint diagrams only when their rung is reached', () => {
    const encounter = encounters[0];
    let session = createSession(encounter);
    session = transition(session, { type: 'parent_override', hintRung: 'l2' }, encounter).session;
    const view = getClientSafeSessionView(session, encounter);
    assert.equal(view.workspaceUnlocked, false);
    assert.equal(view.diagram.mode, 'hint');
    assert.deepEqual(view.diagram.params, encounter.parts[0].ladder.l2.diagram.params);
    assert.equal(view.revealedHints[0].text, encounter.parts[0].ladder.l2.text);
    assertClientSafe(view, encounter, session.currentPartId, 2);
  });
});

function displayedValue(svg, id) {
  const match = svg.match(new RegExp(`<text[^>]*id="${id}"[^>]*>([^<]*)</text>`));
  assert.ok(match, `Missing control ${id}`);
  return match[1].trim();
}

// Exercises the real mount handlers without introducing a browser dependency.
function mountedControls(view) {
  const handlers = [];
  const actions = [];
  const elements = new Map();
  const container = {
    innerHTML: '',
    addEventListener(_type, callback) { handlers.push(callback); },
    querySelector(selector) {
      const id = selector.slice(1);
      if (!this.innerHTML.includes(`id="${id}"`)) return null;
      if (!elements.has(id)) elements.set(id, { textContent: '', setAttribute() {}, removeAttribute() {} });
      return elements.get(id);
    }
  };
  const previousWindow = globalThis.window;
  globalThis.window = {};
  try {
    mountDiagram(container, view.diagram, 'workspace', view.mechanicState, step => actions.push(step));
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
  return {
    actions,
    click(action, data = {}) {
      for (const handler of handlers) handler({ target: {
        closest(selector) {
          return selector === `[data-action="${action}"]` ? { dataset: { action, ...data } } : null;
        }
      } });
    }
  };
}

describe('Workspace values are supplied by the child', () => {
  const vault = encounters.find(encounter => encounter.id === 'ch1-n2-dark-vault');

  for (const part of vault.parts) {
    it(`Vault ${part.id} does not display a hidden maximum or prefill the final grab`, () => {
      const fixture = { ...vault, parts: [part] };
      let session = enterWorkspace(fixture);
      let view = getClientSafeSessionView(session, fixture);
      let svg = renderDiagram(view.diagram, 'workspace', view.mechanicState);
      const summary = svg.match(/Goblin Crystals Wasted:[\s\S]*?<tspan[^>]*>([^<]*)<\/tspan>/);
      assert.ok(summary);
      assert.equal(summary[1].trim(), '0', 'Show only the crystals the child has placed');

      const perBin = part.mechanic.target.same ? part.mechanic.target.same - 1 : part.mechanic.perBin;
      const usedBins = part.mechanic.target.same ? part.mechanic.bins : 1;
      for (let bin = 0; bin < usedBins; bin++) {
        for (let count = 0; count < perBin; count++) {
          session = transition(session, { type: 'step', step: { action: 'place', bin } }, fixture).session;
        }
      }
      view = getClientSafeSessionView(session, fixture);
      svg = renderDiagram(view.diagram, 'workspace', view.mechanicState);
      assert.equal(displayedValue(svg, 'vault-input-grab'), '?');

      const controls = mountedControls(view);
      controls.click('submit-count');
      assert.deepEqual(controls.actions, [], 'An unanswered control must not silently submit the solution');
      for (let count = 0; count < 7; count++) controls.click('grab-delta', { delta: '1' });
      controls.click('submit-count');
      assert.deepEqual(controls.actions, [{ action: 'submit_count', value: 7 }]);
    });
  }

  it('Castle Keep factor inputs start unanswered and submit only child-selected numbers', () => {
    const encounter = encounters.find(item => item.id === 'ch1-n4-castle-keep');
    const session = enterWorkspace(encounter);
    const view = getClientSafeSessionView(session, encounter);
    const svg = renderDiagram(view.diagram, 'workspace', view.mechanicState);
    for (const id of ['keep-val-f0-1', 'keep-val-f0-2', 'keep-val-f1-1', 'keep-val-f1-2']) {
      assert.equal(displayedValue(svg, id), '?');
    }
    const controls = mountedControls(view);
    controls.click('confirm-factor', { idx: '0' });
    assert.deepEqual(controls.actions, []);
    controls.click('delta-f0-1', { delta: '1' });
    controls.click('confirm-factor', { idx: '0' });
    assert.deepEqual(controls.actions, [], 'Both factor values must be supplied');
    for (let count = 0; count < 16; count++) controls.click('delta-f0-2', { delta: '1' });
    controls.click('confirm-factor', { idx: '0' });
    assert.deepEqual(controls.actions, [{ action: 'factor', productIndex: 0, factors: [2, 17] }]);
  });
});

describe('Explicit tiny-case requests and multi-part shortcuts', () => {
  const vault = encounters.find(encounter => encounter.id === 'ch1-n2-dark-vault');

  it('shows the requested tiny-case statement at l0 without exposing its answer or higher hint text', () => {
    let session = enterWorkspace(vault);
    session = transition(session, { type: 'card', cardId: 'tiny-case' }, vault).session;
    const view = getClientSafeSessionView(session, vault);
    assert.equal(view.phase, 'simpler_problem');
    assert.equal(view.hintRung, 'l0');
    assert.deepEqual(view.revealedHints, [{ rung: 'l4', statement: vault.parts[0].ladder.l4.statement }]);
    assertClientSafe(view, vault, session.currentPartId, 0);
  });

  it('keeps an earned tiny worked step after returning to the workspace, only for that part', () => {
    let session = enterWorkspace(vault);
    session = transition(session, { type: 'card', cardId: 'tiny-case' }, vault).session;
    session = transition(session, { type: 'simpler_submit', value: -1 }, vault).session;
    let view = getClientSafeSessionView(session, vault);
    assert.equal(view.phase, 'simpler_problem');
    assert.deepEqual(view.revealedHints, [{ rung: 'l4', statement: vault.parts[0].ladder.l4.statement }]);

    session = transition(session, { type: 'simpler_submit', value: -1 }, vault).session;
    view = getClientSafeSessionView(session, vault);
    assert.equal(view.phase, 'carry_out');
    assert.equal(view.hintRung, 'l1');
    assert.deepEqual(view.revealedHints, [{
      rung: 'l4', statement: vault.parts[0].ladder.l4.statement, l3: vault.parts[0].ladder.l4.l3
    }]);
    assertClientSafe(view, vault, session.currentPartId, 1);

    session = transition(session, { type: 'submit', value: vault.parts[0].answer.value }, vault).session;
    session = transition(session, { type: 'next_part' }, vault).session;
    view = getClientSafeSessionView(session, vault);
    assert.equal(view.currentPartId, vault.parts[1].id);
    assert.equal(session.simplerProblemL3Unlocked, false);
    assert.deepEqual(view.revealedHints, [], 'A worked step in the previous chamber does not earn the next one');
    assertClientSafe(view, vault, session.currentPartId, 0);
  });

  for (const useSecondConjecture of [false, true]) {
    it(`a ${useSecondConjecture ? 'second' : 'first'} conjecture opens only the current Vault chamber`, () => {
      let session = createSession(vault);
      session = transition(session, { type: 'arrive' }, vault).session;
      if (useSecondConjecture) {
        session = transition(session, { type: 'conjecture', value: 0, reason: 'I am testing this idea' }, vault).session;
        assert.equal(session.state, 'understand');
      }
      const { session: accepted, events } = transition(session, {
        type: 'conjecture', value: vault.parts[0].answer.value, reason: 'I considered each possible color'
      }, vault);
      const view = getClientSafeSessionView(accepted, vault);
      assert.equal(accepted.state, 'sealed');
      assert.ok(events.some(event => event.type === 'engine.transition' && event.to === 'sealed'));
      assert.equal(view.partSealed, true);
      assert.equal(view.hasMoreParts, true);
      assert.equal(view.sealed, false);
      assert.equal(view.codex, null);
      assert.equal(view.scene.state, 'locked');
      assert.equal(view.lookBackOptions, null);
      assertClientSafe(view, vault, accepted.currentPartId, 0);

      const prematureComplete = transition(accepted, { type: 'complete' }, vault).session;
      assert.equal(prematureComplete.completed, false);
      assert.equal(prematureComplete.state, 'sealed');
      const next = transition(accepted, { type: 'next_part' }, vault).session;
      assert.equal(next.currentPartId, vault.parts[1].id);
      assert.equal(next.state, 'arrive');
    });
  }

  it('withholds whole-node rewards even from a stale intermediate look-back completion flag', () => {
    const session = { ...createSession(vault), state: 'sealed', lookBackCompleted: true };
    const view = getClientSafeSessionView(session, vault);
    assert.equal(view.partSealed, true);
    assert.equal(view.sealed, false);
    assert.equal(view.codex, null);
    assert.equal(view.scene.state, 'locked');
  });

  it('still requires final-part Look Back before the Vault Golden Seal', () => {
    let session = createSession(vault);
    for (const part of vault.parts) {
      assert.equal(session.currentPartId, part.id);
      session = transition(session, { type: 'arrive' }, vault).session;
      session = transition(session, { type: 'conjecture', value: part.answer.value, reason: 'I considered each possible color' }, vault).session;
      if (part !== vault.parts.at(-1)) session = transition(session, { type: 'next_part' }, vault).session;
    }
    assert.equal(session.state, 'look_back');
    assert.equal(getClientSafeSessionView(session, vault).sealed, false);
    const option = vault.lookBack[0];
    session = transition(session, { type: 'lookback', kind: option.kind, value: option.check.value }, vault).session;
    assert.equal(getClientSafeSessionView(session, vault).sealed, true);
    session = transition(session, { type: 'complete' }, vault).session;
    assert.equal(session.completed, true);
  });
});
