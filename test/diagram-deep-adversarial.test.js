/**
 * Castle of Theorems — Milestone M3 Deep Adversarial Verification Suite
 * test/diagram-deep-adversarial.test.js
 *
 * Empirical Stress Testing of:
 * 1. Information Diet in Hint Mode (Rung l2) across all 4 encounters and all parts.
 * 2. Interactive Workspace Controls:
 *    - Permits entering incorrect conjectures and steps.
 *    - Zero visual oracles indicating correctness before submission.
 *    - Initial state contains no premature victory / completion indicators.
 * 3. Ergonomics & Touch Target Strictness:
 *    - Hit dimensions >= 44px for interactive SVG controls.
 *    - Text font-size >= 14px across all diagram SVGs.
 * 4. Audio Invariants:
 *    - Zero references to playTypewriterPip in client/ and server/.
 *    - Golden Seal Chime is the sole audio event.
 * 5. Gamification Invariants:
 *    - Strict absence of 'stars' or gamification tokens in client views and catalog.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderDiagram, mountDiagram } from '../client/diagrams/index.js';
import * as revMech from '../server/engine/mechanics/inverse-chain.js';
import * as vaultMech from '../server/engine/mechanics/goblin-bins.js';
import * as shieldMech from '../server/engine/mechanics/seam-grid.js';
import * as keepMech from '../server/engine/mechanics/factor-dials.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const encounters = [
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../content/encounters/chasm-reverse-tolls.json'), 'utf8')),
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../content/encounters/alchemists-dark-vault.json'), 'utf8')),
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../content/encounters/courtyard-five-shields.json'), 'utf8')),
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../content/encounters/castle-keep-portcullis.json'), 'utf8'))
];

function extractPrimitiveAnswers(answer) {
  if (answer == null) return [];
  if (typeof answer === "number") return [answer];
  if (typeof answer === "string") return [answer.trim()];
  if (Array.isArray(answer)) return answer.flatMap(extractPrimitiveAnswers);
  if (typeof answer === "object") {
    if (answer.type === "integer" && answer.value !== undefined) {
      return extractPrimitiveAnswers(answer.value);
    }
    if (answer.type === "set" && Array.isArray(answer.values)) {
      return answer.values.flatMap(extractPrimitiveAnswers);
    }
    if (answer.type === "choice" && Array.isArray(answer.options) && answer.correct !== undefined) {
      return extractPrimitiveAnswers(answer.options[answer.correct]);
    }
    if (answer.value !== undefined) {
      return extractPrimitiveAnswers(answer.value);
    }
    if (answer.values !== undefined) {
      return extractPrimitiveAnswers(answer.values);
    }
    return Object.values(answer).flatMap(extractPrimitiveAnswers);
  }
  return [];
}

function extractVisibleText(svg) {
  const texts = [];
  const textMatches = svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g);
  for (const m of textMatches) {
    const clean = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean) texts.push(clean);
  }
  const ariaMatches = svg.matchAll(/aria-label="([^"]+)"/g);
  for (const m of ariaMatches) texts.push(m[1]);
  return texts;
}

describe('M3 Deep Adversarial Challenger — Empirical Stress Tests', () => {

  // =========================================================================
  // 1. Hint Mode Exhaustive Information Diet
  // =========================================================================
  describe('1. Hint Mode Information Diet Across All Encounters & Parts', () => {
    for (const enc of encounters) {
      const parts = enc.parts || [enc];
      for (const part of parts) {
        it(`${enc.id} part ${part.id || 'main'}: hint mode leaks zero forbidden tokens or target answer`, () => {
          const spec = part.ladder?.l2?.diagram;
          assert.ok(spec, `Encounter ${enc.id} part ${part.id} missing l2 diagram spec`);

          // Test with null state and empty state
          for (const testState of [null, {}, { completed: false }]) {
            const svg = renderDiagram(spec, 'hint', testState);
            const texts = extractVisibleText(svg);
            const combinedText = texts.join(' ');

            // Check forbidden values for this part
            const forbidden = part.forbidden || enc.forbidden || [];
            for (const val of forbidden) {
              const numStr = String(val);
              // Avoid flagging if the number is legitimately in the givens/inscription
              const givens = part.givens || enc.givens || [];
              const givenValues = Array.isArray(givens) ? givens.map(String) : Object.values(givens).map(String);
              if (givenValues.includes(numStr)) continue;

              // Check if forbidden value appears as a standalone mathematical value or leak
              // In Castle Keep, "CLUE 2" is a clue ordinal header (Clue 1, Clue 2); we check that 2 does not appear as a factor or dial value
              if (enc.id === 'ch1-n4-castle-keep' && val === 2) {
                assert.doesNotMatch(
                  combinedText,
                  /\b(factor|rune|kimmy|jimmy|timmy)\D*2\b/i,
                  `Intermediate prime 2 leaked in association with rune/factor in ${enc.id}`
                );
                continue;
              }

              const regex = new RegExp(`\\b${numStr}\\b`);
              assert.doesNotMatch(
                combinedText,
                regex,
                `Forbidden value ${val} leaked in hint mode for ${enc.id} part ${part.id || 'main'}`
              );
            }

            // Check target answers (including composite, set, choice, and simpler problem)
            const targetAnswers = [
              ...extractPrimitiveAnswers(part.answer),
              ...extractPrimitiveAnswers(part.ladder?.l4?.answer)
            ];
            const givens = part.givens || enc.givens || [];
            const givenValues = Array.isArray(givens) ? givens.map(String) : Object.values(givens).map(String);
            for (const ans of targetAnswers) {
              const ansStr = String(ans).trim();
              if (!ansStr || givenValues.includes(ansStr)) continue;

              const escaped = ansStr.replace(/[.*+?^$${}()|[\]\\]/g, "\\$$&");
              const isWord = /^\\w+$/.test(ansStr);
              const ansRegex = new RegExp(isWord ? `\\b${escaped}\\b` : escaped, "i");
              assert.doesNotMatch(
                combinedText,
                ansRegex,
                `Target answer "${ansStr}" leaked in hint mode for ${enc.id} part ${part.id || 'main'}`
              );
            }
          }
        });
      }
    }
  });

  // =========================================================================
  // 2. Interactive Workspace Controls — Conjecture Acceptance & No Pre-Oracle
  // =========================================================================
  describe('2. Interactive Workspace Controls: Permits Incorrect Inputs & Has Zero Oracle', () => {

    it('Reverse Tolls: accepts incorrect order and wrong coin conjectures without pre-oracle', () => {
      const enc = encounters[0];
      const spec = enc.parts[0].ladder.l2.diagram;

      // 1. Initial workspace render
      const initialSvg = renderDiagram(spec, 'workspace', null);
      assert.doesNotMatch(initialSvg, /coins before gate.*6/, 'Does not leak target answer');
      assert.doesNotMatch(initialSvg, /START.*6/, 'Does not leak start answer');
      assert.match(initialSvg, /Add 9, then ÷ 2/, 'Offers correct undo order option');
      assert.match(initialSvg, /÷ 2, then \+ Add 9/, 'Offers incorrect undo order option');

      // 2. Mock DOM container to test interactive stepping and submission of wrong conjecture
      let dispatchedAction = null;
      const onStep = (action) => { dispatchedAction = action; };

      const mockListeners = {};
      const mockElements = {
        '#gate-input-val': { textContent: '10' }
      };

      const mockContainer = {
        innerHTML: '',
        addEventListener: (event, handler) => {
          mockListeners[event] = handler;
        },
        querySelector: (sel) => mockElements[sel] || null
      };

      // Set up global window shim
      const prevWindow = global.window;
      global.window = {};

      try {
        mountDiagram(mockContainer, spec, 'workspace', null, onStep);

        // Click wrong order: div,add
        assert.ok(mockListeners['click'], 'Click listener registered on container');
        mockListeners['click']({
          target: {
            closest: (sel) => {
              if (sel === '[data-action="order"]') {
                return { dataset: { action: 'order', gate: '2', val: 'div,add' } };
              }
              return null;
            }
          }
        });

        assert.deepEqual(dispatchedAction, { action: 'order', gateIndex: 2, order: ['div', 'add'] });

        // Now simulate state where order is verified, and user adjusts value stepper to an incorrect conjecture
        const orderVerifiedState = {
          currentGateIndex: 2,
          orderVerifiedForGate: 2,
          history: []
        };
        mountDiagram(mockContainer, spec, 'workspace', orderVerifiedState, onStep);

        // Stepper starts at 10. True value is 11. Decrement to 9 (wrong conjecture).
        mockListeners['click']({
          target: {
            closest: (sel) => {
              if (sel === '[data-action="val-delta"]') {
                return { dataset: { delta: '-1' } };
              }
              return null;
            }
          }
        });
        assert.equal(mockElements['#gate-input-val'].textContent, 9);

        // Submit the wrong conjecture 9
        mockListeners['click']({
          target: {
            closest: (sel) => {
              if (sel === '[data-action="submit-val"]') {
                return { dataset: { gate: '2' } };
              }
              return null;
            }
          }
        });
        assert.deepEqual(dispatchedAction, { action: 'value', gateIndex: 2, value: 9 });

        // Verify that passing this wrong step to the engine rejects it correctly
        const initialEngineState = revMech.init({ gates: [{ mul: 2, sub: 5 }, { mul: 2, sub: 3 }, { mul: 2, sub: 9 }], end: 13 });
        const stepRes = revMech.checkStep(initialEngineState, dispatchedAction);
        assert.equal(stepRes.valid, false, 'Engine correctly rejects wrong conjecture');
      } finally {
        global.window = prevWindow;
      }
    });

    it('Dark Vault: permits arbitrary crystal placement and arbitrary grab conjectures', () => {
      const enc = encounters[1];
      const spec = enc.parts[0].ladder.l2.diagram;

      let dispatchedAction = null;
      const onStep = (action) => { dispatchedAction = action; };

      const mockListeners = {};
      const mockElements = {
        '#vault-input-grab': { textContent: '?' }
      };
      const mockContainer = {
        innerHTML: '',
        addEventListener: (event, handler) => { mockListeners[event] = handler; },
        querySelector: (sel) => mockElements[sel] || null
      };

      const prevWindow = global.window;
      global.window = {};

      try {
        mountDiagram(mockContainer, spec, 'workspace', null, onStep);

        // Click place crystal in bin 1
        mockListeners['click']({
          target: {
            closest: (sel) => {
              if (sel === '[data-action="place"]') {
                return { dataset: { bin: '1' } };
              }
              return null;
            }
          }
        });
        assert.deepEqual(dispatchedAction, { action: 'place', bin: 1 });

        // When maximal waste reached (totalPlaced = 3, target.same = 2, maxWaste = 3)
        const maximalState = {
          bins: [1, 1, 1],
          totalPlaced: 3,
          target: { same: 2 }
        };
        mountDiagram(mockContainer, spec, 'workspace', maximalState, onStep);

        // The unanswered grab stepper accepts the child's choice of 2 (wrong conjecture).
        mockListeners['click']({
          target: {
            closest: (sel) => {
              if (sel === '[data-action="grab-delta"]') {
                return { dataset: { delta: '1' } };
              }
              return null;
            }
          }
        });
        mockListeners['click']({
          target: {
            closest: (sel) => {
              if (sel === '[data-action="grab-delta"]') {
                return { dataset: { delta: '1' } };
              }
              return null;
            }
          }
        });
        assert.equal(mockElements['#vault-input-grab'].textContent, 2);

        // Submit grab count 2
        mockListeners['click']({
          target: {
            closest: (sel) => {
              if (sel === '[data-action="submit-count"]') {
                return {};
              }
              return null;
            }
          }
        });
        assert.deepEqual(dispatchedAction, { action: 'submit_count', value: 2 });

        // Verify that passing count 2 to engine rejects it
        let engineState = vaultMech.init({ bins: 3, perBin: 12, target: { same: 2 } });
        engineState = vaultMech.checkStep(engineState, { action: 'place', bin: 0 }).state;
        engineState = vaultMech.checkStep(engineState, { action: 'place', bin: 1 }).state;
        engineState = vaultMech.checkStep(engineState, { action: 'place', bin: 2 }).state;
        const submitRes = vaultMech.checkStep(engineState, dispatchedAction);
        assert.equal(submitRes.valid, false, 'Engine rejects grab count 2');
      } finally {
        global.window = prevWindow;
      }
    });

    it('Five Shields: permits arbitrary unit ratios and wrong perimeter guesses without pre-oracle', () => {
      const enc = encounters[2];
      const spec = enc.parts[0].ladder.l2.diagram;

      let dispatchedAction = null;
      const onStep = (action) => { dispatchedAction = action; };

      const mockListeners = {};
      const mockElements = {
        '#shield-val-short': { textContent: '1' },
        '#shield-val-long': { textContent: '1' },
        '#shield-val-outer': { textContent: '20' },
        '#shield-val-cubits': { textContent: '1' },
        '#shield-val-perim': { textContent: '25' }
      };
      const mockContainer = {
        innerHTML: '',
        addEventListener: (event, handler) => { mockListeners[event] = handler; },
        querySelector: (sel) => mockElements[sel] || null
      };

      const prevWindow = global.window;
      global.window = {};

      try {
        mountDiagram(mockContainer, spec, 'workspace', null, onStep);

        // Adjust short to 4, long to 5 (wrong ratio, not 3*s == 2*l)
        for (let i = 0; i < 3; i++) {
          mockListeners['click']({
            target: { closest: (sel) => sel === '[data-action="delta-short"]' ? { dataset: { delta: '1' } } : null }
          });
        }
        for (let i = 0; i < 4; i++) {
          mockListeners['click']({
            target: { closest: (sel) => sel === '[data-action="delta-long"]' ? { dataset: { delta: '1' } } : null }
          });
        }
        assert.equal(mockElements['#shield-val-short'].textContent, 4);
        assert.equal(mockElements['#shield-val-long'].textContent, 5);

        // Confirm units (wrong: short 4, long 5)
        mockListeners['click']({
          target: { closest: (sel) => sel === '[data-action="set-units"]' ? {} : null }
        });
        assert.deepEqual(dispatchedAction, { action: 'set_units', short: 4, long: 5 });

        // Engine rejects 4 and 5
        let engineState = shieldMech.init({ relation: { shortCount: 3, longCount: 2 }, outerPerimeter: 66 });
        let res = shieldMech.checkStep(engineState, dispatchedAction);
        assert.equal(res.valid, false, 'Engine rejects mismatched seam units 4 and 5');

        // Now test outer units with valid units in state
        const unitsConfirmedState = {
          units: { short: 2, long: 3 }
        };
        mountDiagram(mockContainer, spec, 'workspace', unitsConfirmedState, onStep);

        // Default outer units is 20 (correct is 22). Submit 20 directly.
        mockListeners['click']({
          target: { closest: (sel) => sel === '[data-action="outer-units"]' ? {} : null }
        });
        assert.deepEqual(dispatchedAction, { action: 'outer_units', value: 20 });
        engineState = shieldMech.checkStep(engineState, { action: 'set_units', short: 2, long: 3 }).state;
        res = shieldMech.checkStep(engineState, dispatchedAction);
        assert.equal(res.valid, false, 'Engine rejects wrong outer units 20');
      } finally {
        global.window = prevWindow;
      }
    });

    it('Castle Keep: permits entering arbitrary factors and guardian assignments without pre-oracle', () => {
      const enc = encounters[3];
      const spec = enc.parts[0].ladder.l2.diagram;

      let dispatchedAction = null;
      const onStep = (action) => { dispatchedAction = action; };

      const mockListeners = {};
      const mockElements = {
        '#keep-val-f0-1': { textContent: '?' },
        '#keep-val-f0-2': { textContent: '?' },
        '#keep-val-f1-1': { textContent: '?' },
        '#keep-val-f1-2': { textContent: '?' },
        '#keep-val-assign': { textContent: '?' },
        '#keep-val-sum': { textContent: '?' },
        '#chip-kimmy': { setAttribute: () => {}, removeAttribute: () => {} },
        '#chip-jimmy': { setAttribute: () => {}, removeAttribute: () => {} },
        '#chip-timmy': { setAttribute: () => {}, removeAttribute: () => {} }
      };
      const mockContainer = {
        innerHTML: '',
        addEventListener: (event, handler) => { mockListeners[event] = handler; },
        querySelector: (sel) => mockElements[sel] || null
      };

      const prevWindow = global.window;
      global.window = {};

      try {
        mountDiagram(mockContainer, spec, 'workspace', null, onStep);

        // Choose and submit wrong factors [2, 2] for product 0 (34).
        for (const action of ['delta-f0-1', 'delta-f0-2']) {
          mockListeners['click']({
            target: { closest: (sel) => sel === `[data-action="${action}"]` ? { dataset: { delta: '1' } } : null }
          });
        }
        mockListeners['click']({
          target: { closest: (sel) => sel === '[data-action="confirm-factor"]' ? { dataset: { idx: '0' } } : null }
        });
        assert.deepEqual(dispatchedAction, { action: 'factor', productIndex: 0, factors: [2, 2] });

        // Engine check
        let engineState = keepMech.init({ products: [{ left: 'Jimmy', right: 'Kimmy', value: 34 }, { left: 'Kimmy', right: 'Timmy', value: 85 }] });
        let res = keepMech.checkStep(engineState, dispatchedAction);
        assert.equal(res.valid, false, 'Engine rejects invalid factors [2, 2] for 34');

        // Test guardian assignment with wrong value
        const factoredState = {
          factored: [[2, 17], [5, 17]],
          assignments: {}
        };
        mountDiagram(mockContainer, spec, 'workspace', factoredState, onStep);

        // Select Jimmy and assign value 9 (wrong)
        mockListeners['click']({
          target: { closest: (sel) => sel === '[data-action="pick-guardian"]' ? { dataset: { name: 'Jimmy' } } : null }
        });
        for (let i = 0; i < 8; i++) {
          mockListeners['click']({
            target: { closest: (sel) => sel === '[data-action="delta-assign-val"]' ? { dataset: { delta: '1' } } : null }
          });
        }
        mockListeners['click']({
          target: { closest: (sel) => sel === '[data-action="confirm-assign"]' ? {} : null }
        });
        assert.deepEqual(dispatchedAction, { action: 'assign', guardian: 'Jimmy', value: 9 });

        engineState = keepMech.checkStep(engineState, { action: 'factor', productIndex: 0, factors: [2, 17] }).state;
        engineState = keepMech.checkStep(engineState, { action: 'factor', productIndex: 1, factors: [5, 17] }).state;
        res = keepMech.checkStep(engineState, dispatchedAction);
        assert.equal(res.valid, false, 'Engine rejects wrong guardian value 9 for Jimmy');
      } finally {
        global.window = prevWindow;
      }
    });
  });

  // =========================================================================
  // 3. Ergonomics & Touch Target Strictness
  // =========================================================================
  describe('3. Ergonomics & Touch Targets (Dimensions >= 44px, Font >= 14px)', () => {
    it('verifies all interactive SVG button targets meet touch dimension >= 44px', () => {
      for (const enc of encounters) {
        const parts = enc.parts || [enc];
        for (const part of parts) {
          const spec = part.ladder?.l2?.diagram;
          const svg = renderDiagram(spec, 'workspace', null);

          // Find rects inside interactive groups
          const interactiveRectMatches = svg.matchAll(/<g class="btn-[^"]*"[^>]*>[\s\S]*?<rect [^>]*width="([^"]+)" [^>]*height="([^"]+)"/g);
          for (const m of interactiveRectMatches) {
            const width = parseFloat(m[1]);
            const height = parseFloat(m[2]);
            assert.ok(width >= 44, `Interactive button width ${width} < 44px in ${enc.id}`);
            assert.ok(height >= 44, `Interactive button height ${height} < 44px in ${enc.id}`);
          }
        }
      }
    });

    it('verifies all visible text elements have font-size >= 14px', () => {
      for (const enc of encounters) {
        const parts = enc.parts || [enc];
        for (const part of parts) {
          const spec = part.ladder?.l2?.diagram;
          for (const mode of ['hint', 'workspace']) {
            const svg = renderDiagram(spec, mode, null);
            const fontMatches = svg.matchAll(/<text[^>]*font-size="([^"]+)"/g);
            for (const m of fontMatches) {
              const size = parseFloat(m[1]);
              assert.ok(size >= 14, `Font size ${size}px < 14px in ${enc.id} (${mode} mode)`);
            }
          }
        }
      }
    });
  });

  // =========================================================================
  // 4. Audio Invariants
  // =========================================================================
  describe('4. Audio Strictness: Zero Typewriter Pips & Only Golden Seal Chime', () => {
    it('verifies zero occurrences of playTypewriterPip in all client and server code', () => {
      const clientDir = path.resolve(__dirname, '../client');
      const serverDir = path.resolve(__dirname, '../server');

      function scanDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.name.endsWith('.js') || entry.name.endsWith('.html')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            assert.doesNotMatch(
              content,
              /playTypewriterPip/,
              `Forbidden playTypewriterPip found in ${fullPath}`
            );
          }
        }
      }

      scanDir(clientDir);
      scanDir(serverDir);
    });

    it('verifies SoundSynth in client/app.js exposes ONLY chime methods and no pip methods', () => {
      const appJs = fs.readFileSync(path.resolve(__dirname, '../client/app.js'), 'utf8');
      assert.match(appJs, /playGoldenSealChime\s*\(/);
      assert.doesNotMatch(appJs, /playTypewriterPip/);
      assert.doesNotMatch(appJs, /synth\.playTypewriter/);
    });
  });

  // =========================================================================
  // 5. Gamification Invariants
  // =========================================================================
  describe('5. Gamification Invariants: Zero Stars or Extrinsic Tokens', () => {
    it('verifies that server and client never export or expose "stars"', () => {
      const serverIndex = fs.readFileSync(path.resolve(__dirname, '../server/index.js'), 'utf8');
      assert.doesNotMatch(serverIndex, /\bstars\s*:/, 'Server catalog or views must not contain "stars:" property');
      assert.doesNotMatch(serverIndex, /\bstars\s*=/, 'Server catalog or views must not assign "stars ="');

      const clientApp = fs.readFileSync(path.resolve(__dirname, '../client/app.js'), 'utf8');
      assert.doesNotMatch(clientApp, /\bstars\b/, 'Client app must not reference "stars"');
    });
  });
});
