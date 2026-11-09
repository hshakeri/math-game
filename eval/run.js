#!/usr/bin/env node
/**
 * Castle of Theorems v1 — Evaluation Harness & CI Matrix Runner (SPEC §11)
 * eval/run.js
 *
 * Drives simulated student dialogues against the Socratic tutor router,
 * measures post-gate leak rate, praise rate, length compliance, solve rates,
 * and generates audit reports.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createSession, transition } from '../server/engine/stateMachine.js';
import { getClientSafeSessionView, assertClientSafe } from '../server/engine/clientView.js';
import { checkUtterance } from '../server/engine/leakGate.js';
import { getScriptedProbe } from '../server/engine/scripted.js';
import { generateTurn, SYSTEM_PROMPT } from '../server/tutor/index.js';
import { chooseChildAction, PERSONA_NAMES, loadPersonaPrompt } from './personas/index.js';
import { aggregateMetrics } from './metrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const ENCOUNTERS_DIR = path.resolve(REPO_ROOT, 'content/encounters');
const REPORTS_DIR = path.resolve(__dirname, 'reports');
const PROMPT_FILE = path.resolve(REPO_ROOT, 'server/tutor/prompt.md');
const RULES_FILE = path.resolve(REPO_ROOT, 'server/engine/leakGate.rules.json');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Compute SHA-256 helper
function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return 'missing';
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Load all Chapter 1 encounters
function loadAllEncounters() {
  const files = fs.readdirSync(ENCOUNTERS_DIR).filter(f => f.endsWith('.json')).sort();
  return files.map(file => {
    const enc = JSON.parse(fs.readFileSync(path.join(ENCOUNTERS_DIR, file), 'utf8'));
    enc._filename = file;
    return enc;
  });
}

// Parse CLI flags
export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {
    smoke: false,
    ci: false,
    persona: 'all',
    adapter: process.env.TUTOR_ADAPTER || 'scripted',
    encounter: 'all',
    seeds: 1,
    out: null,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--smoke') {
      flags.smoke = true;
    } else if (arg === '--ci') {
      flags.ci = true;
    } else if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg.startsWith('--persona=')) {
      flags.persona = arg.slice(10);
    } else if ((arg === '--persona' || arg === '-p') && argv[i + 1]) {
      flags.persona = argv[++i];
    } else if (arg.startsWith('--adapter=')) {
      flags.adapter = arg.slice(10);
    } else if ((arg === '--adapter' || arg === '-a') && argv[i + 1]) {
      flags.adapter = argv[++i];
    } else if (arg.startsWith('--encounter=')) {
      flags.encounter = arg.slice(12);
    } else if ((arg === '--encounter' || arg === '-e') && argv[i + 1]) {
      flags.encounter = argv[++i];
    } else if (arg.startsWith('--seeds=')) {
      flags.seeds = parseInt(arg.slice(8), 10) || 1;
    } else if ((arg === '--seeds' || arg === '-s') && argv[i + 1]) {
      flags.seeds = parseInt(argv[++i], 10) || 1;
    } else if (arg.startsWith('--out=')) {
      flags.out = arg.slice(6);
    } else if ((arg === '--out' || arg === '-o') && argv[i + 1]) {
      flags.out = argv[++i];
    }
  }

  return flags;
}

/**
 * Runs a single simulated dialogue between student persona and Socratic tutor.
 * Capped at 14 child turns per SPEC §11.
 */
export async function runDialogue({ encounter, persona, seed, adapter }) {
  let session = createSession(encounter);
  const turns = [];
  const transcript = [];
  let childTurns = 0;
  const MAX_CHILD_TURNS = encounter.parts && encounter.parts.length > 1 ? 20 : 14;

  while (childTurns < MAX_CHILD_TURNS) {
    const view = getClientSafeSessionView(session, encounter);
    const rungIndex = typeof session.hintRung === 'number'
      ? session.hintRung
      : ['l0', 'l1', 'l2', 'l4', 'l3'].indexOf(session.hintRung || 'l0');
    assertClientSafe(view, encounter, session.currentPartId, Math.max(0, rungIndex));

    // Terminal completion check
    if (session.completed || (view.sealed && !view.hasMoreParts)) {
      return {
        encounterId: encounter.id,
        persona,
        seed,
        adapter,
        solved: true,
        childTurns,
        turns
      };
    }

    // Step A: Student Action
    const { action, annotation } = chooseChildAction(persona, view, childTurns, transcript);
    childTurns++;

    // Step B: Transition Engine
    const transitionRes = transition(session, action, encounter);
    session = transitionRes.session;

    transcript.push({
      speaker: 'child',
      text: action.text || action.chip || action.stem || action.type,
      action
    });

    // Check if encounter sealed immediately
    if (session.completed || (session.state === 'sealed' && !view.hasMoreParts)) {
      turns.push({
        turnIndex: childTurns,
        childAction: action,
        childIdeaRight: annotation?.childIdeaRight,
        caved: annotation?.caved,
        state: session.state,
        hintRung: session.hintRung || 'l0',
        solved: true
      });
      return {
        encounterId: encounter.id,
        persona,
        seed,
        adapter,
        solved: true,
        childTurns,
        turns
      };
    }

    // If intermediate part sealed, loop continues to advance part
    if (session.state === 'sealed' && view.hasMoreParts) {
      turns.push({
        turnIndex: childTurns,
        childAction: action,
        childIdeaRight: annotation?.childIdeaRight,
        state: session.state,
        hintRung: session.hintRung || 'l0',
        partSealed: true
      });
      continue;
    }

    // Step C: Generate Tutor Utterance
    const currentPart = encounter.parts.find(p => p.id === session.currentPartId) || encounter.parts[0];
    const tutorCtx = {
      encounterId: encounter.id,
      partId: session.currentPartId,
      state: session.state,
      rung: session.hintRung || 'l0',
      inscription: encounter.inscription,
      partPrompt: currentPart.prompt,
      transcript: transcript.map(t => ({
        speaker: t.speaker,
        text: t.text,
        action: t.action
      })),
      childMessage: action.text || action.chip || '',
      childAction: action.type,
      chosenCard: session.activeCard || null,
      allowedContent: {
        givens: encounter.givens || [],
        hintText: currentPart.ladder?.[session.hintRung]?.text || ''
      }
    };

    const startMs = Date.now();
    let tutorTurn;
    try {
      tutorTurn = await generateTurn(tutorCtx, { adapter, timeoutMs: 4000 });
    } catch (err) {
      tutorTurn = {
        utterance: getScriptedProbe(encounter.id, session.currentPartId, session.state, session.hintRung || 'l0'),
        fallback: true,
        error: err.message
      };
    }
    const latencyMs = Date.now() - startMs;

    // Verify post-gate compliance
    const gateCtx = {
      forbidden: currentPart.forbidden || [],
      targetAnswer: currentPart.targetAnswer,
      givens: encounter.givens || [],
      inscription: encounter.inscription || '',
      hintText: currentPart.ladder?.[session.hintRung]?.text || '',
      rung: session.hintRung || 'l0',
      mode: 'tutor'
    };
    const gateVerdict = checkUtterance(tutorTurn.utterance, gateCtx, {
      minLen: adapter === 'scripted' ? 40 : 150,
      maxLen: 300
    });
    const postGateLeaked = !gateVerdict.allowed;

    turns.push({
      turnIndex: childTurns,
      adapter,
      childAction: action,
      childIdeaRight: annotation?.childIdeaRight,
      caved: annotation?.caved,
      state: session.state,
      hintRung: session.hintRung || 'l0',
      tutorUtterance: tutorTurn.utterance,
      rawCandidate: tutorTurn.rawCandidate,
      preGateLeaked: Boolean(tutorTurn.preGateLeak),
      postGateLeaked,
      fallback: Boolean(tutorTurn.fallback),
      latencyMs
    });

    transcript.push({
      speaker: 'tutor',
      text: tutorTurn.utterance
    });
  }

  // Capped at 14 child turns without reaching sealed
  return {
    encounterId: encounter.id,
    persona,
    seed,
    adapter,
    solved: Boolean(session.completed || session.state === 'sealed'),
    childTurns,
    turns
  };
}

/**
 * Main Evaluation Orchestrator
 */
export async function main() {
  const flags = parseArgs();

  if (flags.help) {
    console.log(`
Castle of Theorems — Evaluation Harness CLI
Usage: node eval/run.js [options]

Options:
  --smoke              Fast smoke test (1 seed, 4 encounters, 6 personas, scripted adapter)
  --ci                 CI Matrix mode (4 encounters × 3 personas × 3 seeds)
  --persona=<name>     Filter persona: impulsive, extractor, caver, silent, misconception, prodigy, all
  --adapter=<name>     Tutor adapter: scripted (default), gemini, claude
  --encounter=<id>     Filter encounter ID or 'all'
  --seeds=<n>          Number of seeds per combination (default: 1)
  --out=<path>         Destination report JSON path
  --help, -h           Show this help message
`);
    process.exit(0);
  }

  // 1. CI Mode Guard Check (ORIGINAL_REQUEST line 20, SPEC §11)
  if (flags.ci) {
    if (fs.existsSync('.env') && typeof process.loadEnvFile === 'function') {
      try { process.loadEnvFile('.env'); } catch {}
    }
    const hasApiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.ANTHROPIC_API_KEY);
    if (!hasApiKey) {
      console.log('======================================================================');
      console.log('Castle of Theorems — Evaluation Harness (CI Mode)');
      console.log('======================================================================');
      console.log('[INFO] No GEMINI_API_KEY, GOOGLE_API_KEY, or ANTHROPIC_API_KEY detected.');
      console.log('[INFO] Skipping LLM evaluation in CI environment without failing build.');
      console.log('[INFO] To run evaluation locally: configure API keys in .env.');
      console.log('======================================================================');
      process.exit(0);
    }
  }

  // 2. Determine Matrix Configuration
  let encounters = loadAllEncounters();
  if (flags.encounter !== 'all') {
    encounters = encounters.filter(e => e.id === flags.encounter || e.id.includes(flags.encounter));
  }

  let personas = PERSONA_NAMES;
  if (flags.ci) {
    personas = ['extractor', 'caver', 'misconception'];
  } else if (flags.persona !== 'all') {
    personas = [flags.persona.toLowerCase().replace('-x', '')];
  }

  let seedCount = flags.seeds;
  if (flags.smoke) {
    seedCount = 1;
    flags.adapter = 'scripted';
    personas = PERSONA_NAMES;
  } else if (flags.ci) {
    seedCount = 3;
  }

  console.log('======================================================================');
  console.log(`Castle of Theorems — Evaluation Harness (${flags.smoke ? 'Smoke' : flags.ci ? 'CI' : 'Standard'})`);
  console.log(`Adapter: ${flags.adapter} | Encounters: ${encounters.length} | Personas: ${personas.length} | Seeds: ${seedCount}`);
  console.log('======================================================================');

  const dialogues = [];
  const startTime = Date.now();

  for (const encounter of encounters) {
    for (const persona of personas) {
      for (let s = 1; s <= seedCount; s++) {
        process.stdout.write(`  Running ${encounter.id} × ${persona} (seed ${s})... `);
        const res = await runDialogue({
          encounter,
          persona,
          seed: s,
          adapter: flags.adapter
        });
        dialogues.push(res);
        console.log(`${res.solved ? 'SOLVED' : 'INCOMPLETE'} (${res.childTurns} turns)`);
      }
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const metrics = aggregateMetrics(dialogues);

  console.log('======================================================================');
  console.log('Evaluation Summary:');
  console.log(`  Total Dialogues:         ${metrics.totalDialogues}`);
  console.log(`  Total Turns:             ${metrics.totalTurns}`);
  console.log(`  Post-Gate Leak Rate:     ${(metrics.postGateLeakRate * 100).toFixed(1)}% (Target: 0.0%)`);
  console.log(`  Praise Rate:             ${(metrics.praiseRate * 100).toFixed(1)}% (Target: 0.0%)`);
  console.log(`  Length Compliance:       ${(metrics.lengthCompliance * 100).toFixed(1)}% (Target: 100.0%)`);
  console.log(`  Length Drift (stdev):    ${metrics.lengthDrift.toFixed(1)} chars (Target: <= 35)`);
  console.log(`  Length by Verdict:       ${metrics.lengthByVerdict.toFixed(1)} chars (Target: <= 20)`);
  console.log(`  Cave Rate:               ${(metrics.caveRate * 100).toFixed(1)}% (Target: <= 20.0%)`);
  console.log(`  Overall Solve Rate:      ${(metrics.overallSolveRate * 100).toFixed(1)}% (Target: >= 85.0%)`);
  console.log(`  Silent Solve Rate:       ${(metrics.silentSolveRate * 100).toFixed(1)}% (Target: >= 60.0%)`);
  console.log(`  Fallback Rate:           ${(metrics.fallbackRate * 100).toFixed(1)}% (Target: <= 10.0%)`);
  console.log(`  Duration:                ${durationSec}s`);
  console.log('======================================================================');

  // 3. Write Reports
  const dateStr = new Date().toISOString().slice(0, 10);
  const reportJsonPath = flags.out || path.join(REPORTS_DIR, `${dateStr}-${flags.adapter}.json`);
  const reportMdPath = reportJsonPath.replace(/\.json$/, '.md');

  const reportData = {
    metadata: {
      date: new Date().toISOString(),
      adapter: flags.adapter,
      promptHash: hashFile(PROMPT_FILE),
      rulesHash: hashFile(RULES_FILE),
      encounterHashes: Object.fromEntries(
        encounters.map(e => [e.id, hashFile(path.join(ENCOUNTERS_DIR, e._filename || `${e.id}.json`))])
      )
    },
    metrics,
    dialogues: dialogues.map(d => ({
      encounterId: d.encounterId,
      persona: d.persona,
      seed: d.seed,
      solved: d.solved,
      childTurns: d.childTurns
    }))
  };

  fs.writeFileSync(reportJsonPath, JSON.stringify(reportData, null, 2) + '\n');

  const mdSummary = `# Evaluation Audit Report: ${dateStr} (${flags.adapter})

- **Timestamp**: ${reportData.metadata.date}
- **Adapter**: ${flags.adapter}
- **Prompt Hash**: \`${reportData.metadata.promptHash}\`
- **Gate Rules Hash**: \`${reportData.metadata.rulesHash}\`

## Metrics Summary Table
| Metric | Result | Target Threshold | Status |
|---|---|---|---|
| Post-Gate Leak Rate | ${(metrics.postGateLeakRate * 100).toFixed(1)}% | 0.0% | ${metrics.thresholdsPassed.postGateLeakRate ? 'PASS' : 'FAIL'} |
| Praise Rate | ${(metrics.praiseRate * 100).toFixed(1)}% | 0.0% | ${metrics.thresholdsPassed.praiseRate ? 'PASS' : 'FAIL'} |
| Length Compliance | ${(metrics.lengthCompliance * 100).toFixed(1)}% | 100.0% | ${metrics.thresholdsPassed.lengthCompliance ? 'PASS' : 'FAIL'} |
| Length Drift | ${metrics.lengthDrift.toFixed(1)} chars | <= 35 chars | ${metrics.thresholdsPassed.lengthDrift ? 'PASS' : 'FAIL'} |
| Length by Verdict | ${metrics.lengthByVerdict.toFixed(1)} chars | <= 20 chars | ${metrics.thresholdsPassed.lengthByVerdict ? 'PASS' : 'FAIL'} |
| Cave Rate | ${(metrics.caveRate * 100).toFixed(1)}% | <= 20.0% | ${metrics.thresholdsPassed.caveRate ? 'PASS' : 'FAIL'} |
| Overall Solve Rate | ${(metrics.overallSolveRate * 100).toFixed(1)}% | >= 85.0% | ${metrics.thresholdsPassed.overallSolveRate ? 'PASS' : 'FAIL'} |
| Silent Solve Rate | ${(metrics.silentSolveRate * 100).toFixed(1)}% | >= 60.0% | ${metrics.thresholdsPassed.silentSolveRate ? 'PASS' : 'FAIL'} |
| Fallback Rate | ${(metrics.fallbackRate * 100).toFixed(1)}% | <= 10.0% | ${metrics.thresholdsPassed.fallbackRate ? 'PASS' : 'FAIL'} |
| Latency p95 | ${metrics.latency.p95}ms | <= 4000ms | ${metrics.thresholdsPassed.latencyP95 ? 'PASS' : 'FAIL'} |
`;
  fs.writeFileSync(reportMdPath, mdSummary);
  console.log(`Reports saved to:\n  JSON: ${reportJsonPath}\n  Markdown: ${reportMdPath}`);

  // Exit with failure if any critical threshold failed
  const criticalPass = metrics.thresholdsPassed.postGateLeakRate &&
                       metrics.thresholdsPassed.praiseRate &&
                       metrics.thresholdsPassed.lengthCompliance;

  if (!criticalPass) {
    console.error('[ERROR] Critical evaluation thresholds failed.');
    process.exit(1);
  }

  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Fatal evaluation error:', err);
    process.exit(1);
  });
}
