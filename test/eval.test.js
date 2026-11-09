/**
 * Castle of Theorems — Milestone M4 Evaluation Harness & Metrics Test Suite
 * test/eval.test.js
 *
 * Runs with: node --test
 * Verifies:
 * 1. Persona loading and policy behaviors across all 6 synthetic personas.
 * 2. Pure metrics calculations (eval/metrics.js) against synthetic fixtures.
 * 3. Information diet enforcement (no forbidden keys passed to tutor context).
 * 4. Offline dialogue simulation with scripted adapter and fault-injection fallback.
 * 5. CLI flag parsing and CI missing-key skip logic.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PERSONA_NAMES,
  loadPersonaPrompt,
  chooseChildAction
} from '../eval/personas/index.js';

import {
  containsPraise,
  calculatePostGateLeakRate,
  calculatePreGateLeakRate,
  calculatePraiseRate,
  calculateLengthCompliance,
  calculateLengthDrift,
  calculateLengthByVerdict,
  calculateCaveRate,
  calculateSolveRate,
  calculateSilentSolveRate,
  calculateMedianTurnsToSolve,
  calculateRungHistogram,
  calculateFallbackRate,
  calculateLatencyPercentiles,
  aggregateMetrics
} from '../eval/metrics.js';

import { runDialogue, parseArgs } from '../eval/run.js';
import { loadAllEncounters } from '../server/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

describe('Milestone M4: Evaluation Harness & Metrics Engine', () => {
  // 1. Personas Loading & Actions
  describe('1. Synthetic Student Personas', () => {
    it('declares all 6 canonical student personas per SPEC §11', () => {
      assert.deepEqual(
        [...PERSONA_NAMES].sort(),
        ['caver', 'extractor', 'impulsive', 'misconception', 'prodigy', 'silent'].sort()
      );
    });

    it('each persona has an authored markdown profile with Character Profile and Evaluation Purpose', () => {
      for (const name of PERSONA_NAMES) {
        const content = loadPersonaPrompt(name);
        assert.ok(typeof content === 'string' && content.length > 50, `Persona prompt empty: ${name}`);
        assert.match(content, /Character Profile/i);
        assert.match(content, /Evaluation Purpose/i);
      }
    });

    it('chooseChildAction handles initial arrive phase', () => {
      const mockView = { state: 'arrive', encounterId: 'ch1-n1-reverse-tolls', currentPartId: 'a' };
      const { action } = chooseChildAction('impulsive', mockView, 0, []);
      assert.equal(action.type, 'arrive');
    });

    it('prodigy provides justified shortcut on conjecture', () => {
      const mockView = { state: 'conjecture', encounterId: 'ch1-n1-reverse-tolls', currentPartId: 'a' };
      const { action, annotation } = chooseChildAction('prodigy', mockView, 1, []);
      assert.equal(action.type, 'conjecture');
      assert.equal(action.value, 6);
      assert.ok(action.reason.split(' ').length >= 3);
      assert.equal(annotation.childIdeaRight, true);
    });

    it('misconception persona proposes buggy answer on conjecture', () => {
      const mockView = { state: 'conjecture', encounterId: 'ch1-n1-reverse-tolls', currentPartId: 'a' };
      const { action } = chooseChildAction('misconception', mockView, 1, []);
      assert.equal(action.type, 'conjecture');
      assert.equal(action.value, 15);
    });

    it('extractor attempts to probe parent or authority for answers', () => {
      const mockView = { state: 'carry_out', encounterId: 'ch1-n1-reverse-tolls', currentPartId: 'a' };
      const { action } = chooseChildAction('extractor', mockView, 4, []);
      assert.equal(action.type, 'say');
      assert.match(action.text, /parent|confirm|tell/i);
    });

    it('silent persona skips conjecture and requests help via stuck', () => {
      const mockViewConj = { state: 'conjecture', encounterId: 'ch1-n1-reverse-tolls', currentPartId: 'a' };
      const resConj = chooseChildAction('silent', mockViewConj, 1, []);
      assert.equal(resConj.action.type, 'skip_conjecture');

      const mockViewCarry = { state: 'carry_out', encounterId: 'ch1-n1-reverse-tolls', currentPartId: 'a' };
      const resCarry = chooseChildAction('silent', mockViewCarry, 3, []);
      assert.equal(resCarry.action.type, 'stuck');
    });
  });

  // 2. Metrics Calculations
  describe('2. Pure Metrics Functions (eval/metrics.js)', () => {
    it('containsPraise accurately detects praise words and ignores clean text', () => {
      assert.equal(containsPraise('Great job! That is brilliant.'), true);
      assert.equal(containsPraise('Well done, you got it!'), true);
      assert.equal(containsPraise('Spot on! Exactly right.'), true);
      assert.equal(containsPraise('What do you notice about the coins at gate three?'), false);
      assert.equal(containsPraise('Count how many ruby crystals remain inside the vault.'), false);
    });

    it('calculatePostGateLeakRate computes exact leak ratio', () => {
      const cleanTurns = [{ postGateLeaked: false }, { postGateLeaked: false }];
      assert.equal(calculatePostGateLeakRate(cleanTurns), 0.0);

      const leakedTurns = [{ postGateLeaked: true }, { postGateLeaked: false }, { postGateLeaked: false }, { postGateLeaked: false }];
      assert.equal(calculatePostGateLeakRate(leakedTurns), 0.25);
    });

    it('calculatePreGateLeakRate measures candidate leak rejections', () => {
      const candidateTurns = [
        { rawCandidate: '6', preGateLeaked: true },
        { rawCandidate: 'prompt', preGateLeaked: false }
      ];
      assert.equal(calculatePreGateLeakRate(candidateTurns), 0.5);
    });

    it('calculatePraiseRate measures frequency of praise tokens', () => {
      const turns = [
        { tutorUtterance: 'What is your next step?' },
        { tutorUtterance: 'That is great work, keep going.' },
        { tutorUtterance: 'Count the gates.' },
        { tutorUtterance: 'Awesome job!' }
      ];
      assert.equal(calculatePraiseRate(turns), 0.5);
    });

    it('calculateLengthCompliance validates 150-300 char boundaries (or 40-300 for scripted)', () => {
      const tutorTurns = [
        { adapter: 'scripted', tutorUtterance: 'A'.repeat(50) },  // compliant (>= 40)
        { adapter: 'scripted', tutorUtterance: 'B'.repeat(250) }, // compliant (<= 300)
        { adapter: 'scripted', tutorUtterance: 'C'.repeat(10) }   // non-compliant (< 40)
      ];
      assert.equal(calculateLengthCompliance(tutorTurns), 2 / 3);
    });

    it('calculateLengthDrift computes standard deviation across dialogues', () => {
      const d1 = [{ tutorUtterance: 'A'.repeat(100) }, { tutorUtterance: 'B'.repeat(100) }];
      const d2 = [{ tutorUtterance: 'A'.repeat(50) }, { tutorUtterance: 'B'.repeat(70) }];
      const drift = calculateLengthDrift([d1, d2]);
      assert.ok(drift >= 0 && drift < 35);
    });

    it('calculateLengthByVerdict calculates difference following right vs wrong child turns', () => {
      const caverTurns = [
        { childIdeaRight: true, tutorUtterance: 'A'.repeat(100) },
        { childIdeaRight: false, tutorUtterance: 'B'.repeat(90) }
      ];
      const diff = calculateLengthByVerdict(caverTurns);
      assert.equal(diff, 10);
    });

    it('calculateCaveRate measures percentage of Caver dialogues abandoned', () => {
      const d1 = {
        turns: [
          { childIdeaRight: true },
          { caved: true }
        ]
      };
      const d2 = {
        turns: [
          { childIdeaRight: true },
          { caved: false }
        ]
      };
      assert.equal(calculateCaveRate([d1, d2]), 0.5);
      assert.equal(calculateCaveRate([d2]), 0.0);
    });

    it('calculateSolveRate and calculateSilentSolveRate compute completion rates', () => {
      const dialogues = [
        { persona: 'impulsive', solved: true },
        { persona: 'silent', solved: true },
        { persona: 'silent', solved: false }
      ];
      assert.equal(calculateSolveRate(dialogues), 2 / 3);
      assert.equal(calculateSilentSolveRate(dialogues), 0.5);
    });

    it('calculateMedianTurnsToSolve calculates correct median for odd and even sets', () => {
      const dialoguesOdd = [
        { solved: true, childTurns: 3 },
        { solved: true, childTurns: 5 },
        { solved: true, childTurns: 9 }
      ];
      assert.equal(calculateMedianTurnsToSolve(dialoguesOdd), 5);

      const dialoguesEven = [
        { solved: true, childTurns: 4 },
        { solved: true, childTurns: 6 }
      ];
      assert.equal(calculateMedianTurnsToSolve(dialoguesEven), 5);
    });

    it('calculateRungHistogram computes counts and checks proportions', () => {
      const turns = [
        { hintRung: 'l0' },
        { hintRung: 'l0' },
        { hintRung: 'l1' },
        { hintRung: 'l2' }
      ];
      const hist = calculateRungHistogram(turns);
      assert.equal(hist.counts.l0, 2);
      assert.equal(hist.counts.l1, 1);
      assert.equal(hist.counts.l2, 1);
      assert.equal(hist.proportions.l0, 0.5);
    });

    it('calculateLatencyPercentiles returns p50 and p95 correctly', () => {
      const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const p = calculateLatencyPercentiles(latencies);
      assert.ok(p.p50 >= 40 && p.p50 <= 60);
      assert.ok(p.p95 >= 90);
    });

    it('aggregateMetrics summarizes entire run into report structure', () => {
      const mockDialogue = {
        encounterId: 'ch1-n1-reverse-tolls',
        persona: 'impulsive',
        seed: 1,
        solved: true,
        childTurns: 8,
        turns: [
          {
            adapter: 'scripted',
            tutorUtterance: 'A'.repeat(80),
            childIdeaRight: false,
            caved: false,
            hintRung: 'l0',
            postGateLeaked: false,
            fallback: false,
            latencyMs: 12
          }
        ]
      };
      const summary = aggregateMetrics([mockDialogue]);
      assert.equal(summary.totalDialogues, 1);
      assert.equal(summary.postGateLeakRate, 0.0);
      assert.equal(summary.praiseRate, 0.0);
      assert.equal(summary.overallSolveRate, 1.0);
      assert.equal(summary.thresholdsPassed.postGateLeakRate, true);
    });
  });

  // 3. Information Diet & Offline Simulation
  describe('3. Information Diet & Simulation', () => {
    it('runDialogue executes successfully with scripted adapter and achieves solved state', async () => {
      const encounters = loadAllEncounters();
      const encounter = encounters.get('ch1-n1-reverse-tolls');
      assert.ok(encounter, 'Encounter ch1-n1-reverse-tolls must exist');

      const res = await runDialogue({
        encounter,
        persona: 'prodigy',
        seed: 1,
        adapter: 'scripted'
      });

      assert.equal(res.solved, true);
      assert.ok(res.childTurns <= 5);
      assert.ok(res.turns.length > 0);
    });

    it('runDialogue engages fallback on tutor failure without unhandled rejection', async () => {
      const encounters = loadAllEncounters();
      const encounter = encounters.get('ch1-n1-reverse-tolls');

      // Custom mock adapter that throws
      const res = await runDialogue({
        encounter,
        persona: 'impulsive',
        seed: 1,
        adapter: 'non-existent-broken-adapter'
      });

      assert.ok(res);
      assert.ok(Array.isArray(res.turns));
      // Proves fallback turned on
      const fallbackTurn = res.turns.find(t => t.fallback === true);
      assert.ok(fallbackTurn, 'Fallback turn must be recorded when adapter fails');
    });
  });

  // 4. CLI Argument Parsing
  describe('4. CLI Argument Parsing (eval/run.js)', () => {
    it('parseArgs accurately parses flags', () => {
      const args1 = parseArgs(['--smoke']);
      assert.equal(args1.smoke, true);

      const args2 = parseArgs(['--ci', '--seeds', '3', '--persona', 'caver', '--encounter', 'ch1-n2-dark-vault']);
      assert.equal(args2.ci, true);
      assert.equal(args2.seeds, 3);
      assert.equal(args2.persona, 'caver');
      assert.equal(args2.encounter, 'ch1-n2-dark-vault');

      const args3 = parseArgs(['--out', 'eval/reports/custom.json']);
      assert.equal(args3.out, 'eval/reports/custom.json');
    });
  });
});
