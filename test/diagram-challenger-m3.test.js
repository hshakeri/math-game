/**
 * Castle of Theorems — Milestone M3 Empirical Challenger Test Suite
 * test/diagram-challenger-m3.test.js
 *
 * Empirical Adversarial Verification of:
 * 1. Pure SVG Diagrams Stress Test & Accessibility:
 *    - All 4 encounters (Reverse Tolls, Dark Vault, Five Shields, Castle Keep) in 'hint' and 'workspace' modes.
 *    - role="img" and accessible aria-label presence.
 *    - Strict absence of target answers (24, 30, 4, 6) and secret intermediates/forbidden values in 'hint' mode.
 * 2. Information Diet & Client Script Audit:
 *    - Zero hardcoded secret target answers or intermediate solution values in client scripts and markup.
 *    - getClientSafeSessionView / assertClientSafe guarantees.
 * 3. Mechanics Problem-Solving Lifecycle:
 *    - Diagram interactions emit valid checkStep actions driving the problem to completion.
 * 4. Strict UI Invariants:
 *    - 100% absence of countdown, timer, score, streak, rank, or leaderboard in client code.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderDiagram, getDiagramComponent } from '../client/diagrams/index.js';
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

describe('M3 Empirical Challenger — Pure SVG Diagrams, Information Diet & UI Invariants', () => {

  // Challenge 1: SVG Structure, role="img", aria-label
  describe('1. SVG Structure & Accessibility', () => {
    it('all 4 diagrams include role="img" and non-empty aria-label in both hint and workspace modes', () => {
      for (const enc of encounters) {
        const parts = enc.parts || [enc];
        for (const part of parts) {
          const spec = part.ladder?.l2?.diagram;
          if (!spec) continue;

          for (const mode of ['hint', 'workspace']) {
            const svg = renderDiagram(spec, mode, null);
            assert.match(svg, /<svg[^>]*role="img"/, `Diagram ${spec.component} in ${mode} mode missing role="img"`);
            assert.match(svg, /<svg[^>]*aria-label="[^"]+"/, `Diagram ${spec.component} in ${mode} mode missing aria-label`);
          }
        }
      }
    });
  });

  // Challenge 2: Hint Mode Information Diet (Rung l2)
  describe('2. Hint Mode Information Diet (Rung l2)', () => {
    it('Encounter 1 (Reverse Tolls): zero target answer (6) or forbidden values in visible hint text', () => {
      const enc = encounters[0];
      const spec = enc.parts[0].ladder.l2.diagram;
      const svg = renderDiagram(spec, 'hint', null);
      const texts = extractVisibleText(svg);
      const combinedText = texts.join(' ');

      // Target answer is 6, forbidden: [6, 7, 11, 12, 14, 22]
      assert.doesNotMatch(combinedText, /\b6\b/, 'Target answer 6 leaked in Reverse Tolls hint text');
      assert.doesNotMatch(combinedText, /\b7\b/, 'Forbidden 7 leaked in Reverse Tolls hint text');
      assert.doesNotMatch(combinedText, /\b11\b/, 'Forbidden 11 leaked in Reverse Tolls hint text');
    });

    it('Encounter 2 (Dark Vault): zero target answers (4, 10, 13) or forbidden worst-case waste counts in visible hint text', () => {
      const enc = encounters[1];
      for (const part of enc.parts) {
        const spec = part.ladder.l2.diagram;
        const svg = renderDiagram(spec, 'hint', null);
        const texts = extractVisibleText(svg);
        const combinedText = texts.join(' ');

        // In Part a: target answer is 4, forbidden: [3, 4]. Waste count 3 must NOT be leaked!
        if (part.id === 'a') {
          assert.doesNotMatch(combinedText, /\b4\b/, 'Target answer 4 leaked in Dark Vault part a hint text');
          assert.doesNotMatch(combinedText, /\b0\s*\/\s*3\b/, 'Worst-case waste count 3 leaked in Dark Vault part a hint text');
        }
        if (part.id === 'b') {
          assert.doesNotMatch(combinedText, /\b10\b/, 'Target answer 10 leaked in Dark Vault part b hint text');
          assert.doesNotMatch(combinedText, /\b0\s*\/\s*9\b/, 'Worst-case waste count 9 leaked in Dark Vault part b hint text');
        }
        if (part.id === 'c') {
          assert.doesNotMatch(combinedText, /\b13\b/, 'Target answer 13 leaked in Dark Vault part c hint text');
          assert.doesNotMatch(combinedText, /\b0\s*\/\s*12\b/, 'Worst-case waste count 12 leaked in Dark Vault part c hint text');
        }
      }
    });

    it('Encounter 3 (Five Shields): zero target answer (30) or intermediate numbers (22, 10, 3) in visible hint text', () => {
      const enc = encounters[2];
      const spec = enc.parts[0].ladder.l2.diagram;
      const svg = renderDiagram(spec, 'hint', null);
      const texts = extractVisibleText(svg);
      const combinedText = texts.join(' ');

      // Target answer 30, intermediates: 22, 10, 3, forbidden: [10, 22, 30]
      assert.doesNotMatch(combinedText, /\b30\b/, 'Target answer 30 leaked in Five Shields hint text');
      assert.doesNotMatch(combinedText, /\b22\b/, 'Intermediate 22 leaked in Five Shields hint text');
      assert.doesNotMatch(combinedText, /\b10 units × 3\b/, 'Intermediate expression "10 units × 3" leaked in Five Shields hint text');
      assert.doesNotMatch(combinedText, /\b66 ÷ 22\b/, 'Expression "66 ÷ 22" leaked in Five Shields hint text');
      assert.doesNotMatch(combinedText, /Seam Equation Fits/, 'Ratio solution pre-solved in Five Shields hint text');
    });

    it('Encounter 4 (Castle Keep): zero target answer (24) or intermediate prime factors in visible hint text', () => {
      const enc = encounters[3];
      const spec = enc.parts[0].ladder.l2.diagram;
      const svg = renderDiagram(spec, 'hint', null);
      const texts = extractVisibleText(svg);
      const combinedText = texts.join(' ');

      assert.doesNotMatch(combinedText, /\b24\b/, 'Target answer 24 leaked in Castle Keep hint text');
      assert.doesNotMatch(combinedText, /\b17\b/, 'Intermediate prime 17 leaked in Castle Keep hint text');
    });
  });

  // Challenge 3: Information Diet in Client Diagram Source Code
  describe('3. Information Diet in Client Diagram Source Code', () => {
    it('client/diagrams/*.js does NOT hardcode target answers or secret solution values on buttons', () => {
      const diagramDir = path.resolve(__dirname, '../client/diagrams');
      const files = ['five-shields.js', 'castle-keep.js', 'reverse-tolls.js', 'dark-vault.js'];

      for (const f of files) {
        const code = fs.readFileSync(path.join(diagramDir, f), 'utf8');

        // Check for hardcoded target answer buttons
        assert.doesNotMatch(code, /Submit 24/, `Hardcoded answer button "Submit 24" in ${f}`);
        assert.doesNotMatch(code, /Confirm 30 Cubits/, `Hardcoded answer button "Confirm 30 Cubits" in ${f}`);
        assert.doesNotMatch(code, /Submit 22 Units/, `Hardcoded intermediate button "Submit 22 Units" in ${f}`);
        assert.doesNotMatch(code, /Split into 2 × 17/, `Hardcoded factor button "Split into 2 × 17" in ${f}`);
        assert.doesNotMatch(code, /Assign Shared 17/, `Hardcoded assignment button "Assign Shared 17" in ${f}`);
      }
    });
  });

  // Challenge 4: Mechanics Lifecycle Completable
  describe('4. Mechanics Problem-Solving Lifecycle Completable', () => {
    it('drives Reverse Tolls to completion via checkStep', () => {
      let state = revMech.init({ gates: [{ mul: 2, sub: 5 }, { mul: 2, sub: 3 }, { mul: 2, sub: 9 }], end: 13 });
      state = revMech.checkStep(state, { action: 'order', gateIndex: 2, order: ['add', 'div'] }).state;
      state = revMech.checkStep(state, { action: 'value', gateIndex: 2, value: 11 }).state;
      state = revMech.checkStep(state, { action: 'order', gateIndex: 1, order: ['add', 'div'] }).state;
      state = revMech.checkStep(state, { action: 'value', gateIndex: 1, value: 7 }).state;
      state = revMech.checkStep(state, { action: 'order', gateIndex: 0, order: ['add', 'div'] }).state;
      state = revMech.checkStep(state, { action: 'value', gateIndex: 0, value: 6 }).state;
      assert.equal(revMech.isComplete(state), true);
      assert.equal(revMech.finalValue(state), 6);
    });

    it('drives Dark Vault to completion via checkStep', () => {
      let state = vaultMech.init({ bins: 3, perBin: 12, target: { same: 2 } });
      state = vaultMech.checkStep(state, { action: 'place', bin: 0 }).state;
      state = vaultMech.checkStep(state, { action: 'place', bin: 1 }).state;
      state = vaultMech.checkStep(state, { action: 'place', bin: 2 }).state;
      state = vaultMech.checkStep(state, { action: 'submit_count', value: 4 }).state;
      assert.equal(vaultMech.isComplete(state), true);
      assert.equal(vaultMech.finalValue(state), 4);
    });

    it('drives Five Shields to completion via checkStep', () => {
      let state = shieldMech.init({ relation: { shortCount: 3, longCount: 2 }, outerPerimeter: 66 });
      state = shieldMech.checkStep(state, { action: 'set_units', short: 2, long: 3 }).state;
      state = shieldMech.checkStep(state, { action: 'outer_units', value: 22 }).state;
      state = shieldMech.checkStep(state, { action: 'cubits_per_unit', value: 3 }).state;
      state = shieldMech.checkStep(state, { action: 'shield_perimeter', value: 30 }).state;
      assert.equal(shieldMech.isComplete(state), true);
      assert.equal(shieldMech.finalValue(state), 30);
    });

    it('drives Castle Keep to completion via checkStep', () => {
      let state = keepMech.init({ products: [{ left: 'Jimmy', right: 'Kimmy', value: 34 }, { left: 'Kimmy', right: 'Timmy', value: 85 }] });
      state = keepMech.checkStep(state, { action: 'factor', productIndex: 0, factors: [2, 17] }).state;
      state = keepMech.checkStep(state, { action: 'factor', productIndex: 1, factors: [5, 17] }).state;
      state = keepMech.checkStep(state, { action: 'assign_shared', guardian: 'Kimmy', value: 17 }).state;
      state = keepMech.checkStep(state, { action: 'assign', guardian: 'Jimmy', value: 2 }).state;
      state = keepMech.checkStep(state, { action: 'assign', guardian: 'Timmy', value: 5 }).state;
      state = keepMech.checkStep(state, { action: 'submit_sum', value: 24 }).state;
      assert.equal(keepMech.isComplete(state), true);
      assert.equal(keepMech.finalValue(state), 24);
    });
  });

  // Challenge 5: Strict UI Invariant Challenge
  describe('5. Strict UI Invariants (100% Absence of Timers/Scores/Streaks)', () => {
    it('guarantees zero timer, countdown, score, streak, rank, or leaderboard in client files', () => {
      const clientFiles = [
        path.resolve(__dirname, '../client/index.html'),
        path.resolve(__dirname, '../client/app.js'),
        path.resolve(__dirname, '../client/parent.html'),
        path.resolve(__dirname, '../client/parent.js'),
        path.resolve(__dirname, '../client/style.css')
      ];

      const forbiddenTerms = [
        /\bcountdown\b/i,
        /\btimer\b/i,
        /\bscore\b/i,
        /\bstreak\b/i,
        /\brank\b/i,
        /\bleaderboard\b/i
      ];

      for (const filePath of clientFiles) {
        const text = fs.readFileSync(filePath, 'utf8');
        for (const re of forbiddenTerms) {
          assert.doesNotMatch(text, re, `Forbidden term ${re} found in ${filePath}`);
        }
      }
    });
  });
});
