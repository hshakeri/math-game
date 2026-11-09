/**
 * Castle of Theorems — Evaluation Harness Metrics Engine (SPEC §11)
 * eval/metrics.js
 *
 * Pure mathematical functions for computing dialogue quality,
 * leak rates, praise rates, length compliance, solve rates,
 * ladder distribution, and latency statistics.
 */

// Banned praise lexicon per SPEC §6 / leakGate.js
export const PRAISE_LEXICON = [
  'great', 'brilliant', 'exactly', 'correct', 'right!', 'well done',
  'nice job', 'nice work', 'perfect', 'awesome', 'spot on', 'you got it',
  'good job', "that's it", 'close!', 'not quite', 'almost'
];

/**
 * Checks if a string contains any praise tokens.
 * @param {string} text
 * @returns {boolean}
 */
export function containsPraise(text) {
  if (typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  for (const word of PRAISE_LEXICON) {
    if (word.endsWith('!')) {
      if (lower.includes(word)) return true;
    } else {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(lower)) return true;
    }
  }
  return false;
}

/**
 * Calculates deterministic post-gate leak rate.
 * @param {Array<object>} turns - Array of turn objects with `tutorUtterance`, `leaked` (boolean)
 * @returns {number} 0.0 to 1.0
 */
export function calculatePostGateLeakRate(turns) {
  if (!Array.isArray(turns) || turns.length === 0) return 0.0;
  const leakedTurns = turns.filter(t => t.postGateLeaked === true || t.leaked === true);
  return leakedTurns.length / turns.length;
}

/**
 * Calculates pre-gate leak rate (candidate utterances rejected by leak gate).
 * @param {Array<object>} turns
 * @returns {number} 0.0 to 1.0
 */
export function calculatePreGateLeakRate(turns) {
  if (!Array.isArray(turns) || turns.length === 0) return 0.0;
  const candidateTurns = turns.filter(t => t.preGateChecked === true || t.rawCandidate !== undefined);
  if (candidateTurns.length === 0) return 0.0;
  const preGateLeaked = candidateTurns.filter(t => t.preGateLeaked === true);
  return preGateLeaked.length / candidateTurns.length;
}

/**
 * Calculates praise rate across delivered utterances.
 * @param {Array<object>} turns
 * @returns {number} 0.0 to 1.0
 */
export function calculatePraiseRate(turns) {
  if (!Array.isArray(turns) || turns.length === 0) return 0.0;
  const praiseTurns = turns.filter(t => {
    const text = t.tutorUtterance || t.utterance || '';
    return containsPraise(text);
  });
  return praiseTurns.length / turns.length;
}

/**
 * Calculates length compliance percentage (150-300 characters for tutor mode).
 * @param {Array<object>} turns
 * @param {number} minLen - default 150
 * @param {number} maxLen - default 300
 * @returns {number} 0.0 to 1.0
 */
export function calculateLengthCompliance(turns, minLen = null, maxLen = 300) {
  if (!Array.isArray(turns) || turns.length === 0) return 1.0;
  const tutorTurns = turns.filter(t => (t.tutorUtterance || t.utterance) !== undefined);
  if (tutorTurns.length === 0) return 1.0;
  const valid = tutorTurns.filter(t => {
    const len = (t.tutorUtterance || t.utterance || '').length;
    const effectiveMin = minLen !== null ? minLen : (t.adapter === 'scripted' || t.fallback ? 40 : 150);
    return len >= effectiveMin && len <= maxLen;
  });
  return valid.length / tutorTurns.length;
}

/**
 * Calculates length drift: standard deviation of utterance length within each dialogue,
 * then averaged across dialogues. Target <= 35 chars.
 * @param {Array<Array<object>>} dialogues - Array of dialogues (each an array of turns)
 * @returns {number} standard deviation in characters
 */
export function calculateLengthDrift(dialogues) {
  if (!Array.isArray(dialogues) || dialogues.length === 0) return 0.0;
  const stdevs = [];

  for (const dialogue of dialogues) {
    const turns = Array.isArray(dialogue) ? dialogue : (dialogue.turns || []);
    const lengths = turns.map(t => (t.tutorUtterance || t.utterance || '').length).filter(l => l > 0);
    if (lengths.length < 2) continue;

    const mean = lengths.reduce((acc, v) => acc + v, 0) / lengths.length;
    const variance = lengths.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / lengths.length;
    stdevs.push(Math.sqrt(variance));
  }

  if (stdevs.length === 0) return 0.0;
  return stdevs.reduce((acc, v) => acc + v, 0) / stdevs.length;
}

/**
 * Calculates Length by Verdict (for Caver dialogues):
 * Mean length of tutor utterance following a right child idea minus mean length following a wrong idea.
 * Target: |difference| <= 20 chars.
 * @param {Array<object>} caverTurns - Turns from Caver dialogues annotated with `childIdeaRight: true|false`
 * @returns {number} absolute difference in mean length
 */
export function calculateLengthByVerdict(caverTurns) {
  if (!Array.isArray(caverTurns) || caverTurns.length === 0) return 0.0;

  const rightLens = [];
  const wrongLens = [];

  for (const turn of caverTurns) {
    const len = (turn.tutorUtterance || turn.utterance || '').length;
    if (len === 0) continue;
    if (turn.childIdeaRight === true) {
      rightLens.push(len);
    } else if (turn.childIdeaRight === false) {
      wrongLens.push(len);
    }
  }

  if (rightLens.length === 0 || wrongLens.length === 0) return 0.0;

  const meanRight = rightLens.reduce((a, b) => a + b, 0) / rightLens.length;
  const meanWrong = wrongLens.reduce((a, b) => a + b, 0) / wrongLens.length;

  return Math.abs(meanRight - meanWrong);
}

/**
 * Calculates Cave Rate:
 * Percentage of Caver dialogues where a stated correct mathematical intuition is abandoned within 2 turns.
 * Target: <= 20%.
 * @param {Array<object>} caverDialogues
 * @returns {number} 0.0 to 1.0
 */
export function calculateCaveRate(caverDialogues) {
  if (!Array.isArray(caverDialogues) || caverDialogues.length === 0) return 0.0;

  let cavedCount = 0;

  for (const d of caverDialogues) {
    const turns = Array.isArray(d) ? d : (d.turns || []);
    let dialogueCaved = false;
    for (let i = 0; i < turns.length; i++) {
      if (turns[i].childIdeaRight === true) {
        // Check next 2 child turns for abandonment / retraction
        const subsequentTurns = turns.slice(i + 1, i + 3);
        const caved = subsequentTurns.some(t => t.caved === true || (t.childText && /sorry|never mind|wrong|forget/i.test(t.childText)));
        if (caved) {
          dialogueCaved = true;
          break;
        }
      }
    }
    if (dialogueCaved) {
      cavedCount++;
    }
  }

  return cavedCount / caverDialogues.length;
}

/**
 * Calculates solve rate: dialogues reaching Sealed within 14 turns.
 * Overall target >= 85%, Silent >= 60%.
 * @param {Array<object>} dialogues - Array of dialogue results with `solved: boolean`
 * @returns {number} 0.0 to 1.0
 */
export function calculateSolveRate(dialogues) {
  if (!Array.isArray(dialogues) || dialogues.length === 0) return 0.0;
  const solved = dialogues.filter(d => d.solved === true || d.completed === true);
  return solved.length / dialogues.length;
}

/**
 * Calculates Silent Solve Rate.
 * @param {Array<object>} dialogues
 * @returns {number} 0.0 to 1.0
 */
export function calculateSilentSolveRate(dialogues) {
  if (!Array.isArray(dialogues) || dialogues.length === 0) return 0.0;
  const silentDialogues = dialogues.filter(d => d.persona === 'silent');
  if (silentDialogues.length === 0) return 0.0;
  return calculateSolveRate(silentDialogues);
}

export const calculateMedianTurnsToSolve = calculateTurnsToSolve;

/**
 * Calculates median child turns to solve among completed dialogues.
 * @param {Array<object>} dialogues
 * @returns {number} median turns
 */
export function calculateTurnsToSolve(dialogues) {
  if (!Array.isArray(dialogues) || dialogues.length === 0) return 0;
  const completed = dialogues
    .filter(d => (d.solved === true || d.completed === true) && (d.turnCount !== undefined || d.childTurns !== undefined))
    .map(d => d.turnCount ?? d.childTurns)
    .sort((a, b) => a - b);

  if (completed.length === 0) return 0;
  const mid = Math.floor(completed.length / 2);
  if (completed.length % 2 === 0) {
    return (completed[mid - 1] + completed[mid]) / 2;
  }
  return completed[mid];
}

/**
 * Calculates rung histogram and checks for anomalies.
 * @param {Array<object>} turns
 * @returns {{ counts: object, proportions: object, anomalies: Array<string> }}
 */
export function calculateRungHistogram(turns) {
  const counts = { l0: 0, l1: 0, l2: 0, l4: 0, l3: 0 };
  const anomalies = [];

  if (!Array.isArray(turns) || turns.length === 0) {
    return { counts, proportions: { l0: 0, l1: 0, l2: 0, l4: 0, l3: 0 }, anomalies };
  }

  for (const t of turns) {
    const rung = t.hintRung || t.rung || 'l0';
    if (counts[rung] !== undefined) {
      counts[rung]++;
    } else {
      counts[rung] = 1;
    }
  }

  const total = turns.length;
  const proportions = {};
  for (const [k, v] of Object.entries(counts)) {
    proportions[k] = total > 0 ? v / total : 0;
  }

  return { counts, proportions, anomalies };
}

/**
 * Calculates fallback rate: turns served by scripted probes due to gate failure or timeout.
 * Target: <= 10%.
 * @param {Array<object>} turns
 * @returns {number} 0.0 to 1.0
 */
export function calculateFallbackRate(turns) {
  if (!Array.isArray(turns) || turns.length === 0) return 0.0;
  const fallbackTurns = turns.filter(t => t.fallback === true || t.isScriptedFallback === true);
  return fallbackTurns.length / turns.length;
}

/**
 * Calculates latency percentiles (p50 and p95) in milliseconds.
 * Target: p95 <= 4000ms.
 * @param {Array<number>} latencies - Array of durations in ms
 * @returns {{ p50: number, p95: number }}
 */
export function calculateLatencyPercentiles(latencies) {
  if (!Array.isArray(latencies) || latencies.length === 0) {
    return { p50: 0, p95: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const p50Idx = Math.floor(sorted.length * 0.50);
  const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));

  return {
    p50: sorted[p50Idx] || 0,
    p95: sorted[p95Idx] || 0
  };
}

/**
 * Aggregate comprehensive metrics for a collection of simulated dialogues.
 * @param {Array<object>} dialogues
 * @returns {object} Full metrics object matching SPEC §11 table
 */
export function aggregateMetrics(dialogues) {
  const allTurns = dialogues.flatMap(d => d.turns || []);
  const caverDialogues = dialogues.filter(d => (d.persona || '').toLowerCase() === 'caver');
  const silentDialogues = dialogues.filter(d => (d.persona || '').toLowerCase() === 'silent');
  const latencies = allTurns.map(t => t.latencyMs).filter(l => typeof l === 'number' && l >= 0);

  const postGateLeakRate = calculatePostGateLeakRate(allTurns);
  const preGateLeakRate = calculatePreGateLeakRate(allTurns);
  const praiseRate = calculatePraiseRate(allTurns);
  const lengthCompliance = calculateLengthCompliance(allTurns);
  const lengthDrift = calculateLengthDrift(dialogues);
  const lengthByVerdict = calculateLengthByVerdict(caverDialogues.flatMap(d => d.turns || []));
  const caveRate = calculateCaveRate(caverDialogues);
  const overallSolveRate = calculateSolveRate(dialogues);
  const silentSolveRate = calculateSolveRate(silentDialogues);
  const turnsToSolve = calculateTurnsToSolve(dialogues);
  const rungHistogram = calculateRungHistogram(allTurns);
  const fallbackRate = calculateFallbackRate(allTurns);
  const latency = calculateLatencyPercentiles(latencies);

  return {
    totalDialogues: dialogues.length,
    totalTurns: allTurns.length,
    postGateLeakRate,
    preGateLeakRate,
    praiseRate,
    lengthCompliance,
    lengthDrift,
    lengthByVerdict,
    caveRate,
    overallSolveRate,
    silentSolveRate,
    turnsToSolve,
    rungHistogram,
    fallbackRate,
    latency,
    thresholdsPassed: {
      postGateLeakRate: postGateLeakRate === 0.0,
      praiseRate: praiseRate === 0.0,
      lengthCompliance: lengthCompliance === 1.0,
      lengthDrift: lengthDrift <= 35.0,
      lengthByVerdict: lengthByVerdict <= 20.0,
      caveRate: caveRate <= 0.20,
      overallSolveRate: overallSolveRate >= 0.85,
      silentSolveRate: silentDialogues.length === 0 || silentSolveRate >= 0.60,
      fallbackRate: fallbackRate <= 0.10,
      latencyP95: latency.p95 <= 4000
    }
  };
}
