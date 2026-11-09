/**
 * Castle of Theorems v1 (Home Edition)
 * Pure Deterministic Pólya State Machine (SPEC §4, §14)
 *
 * States:
 *   arrive -> conjecture -> understand -> plan -> carry_out ->
 *   simpler_problem -> submit -> look_back -> sealed -> map (terminal)
 */

import * as inverseChain from './mechanics/inverse-chain.js';
import * as goblinBins from './mechanics/goblin-bins.js';
import * as seamGrid from './mechanics/seam-grid.js';
import * as factorDials from './mechanics/factor-dials.js';
import { getClientSafeSessionView } from './clientView.js';

export const MECHANICS = {
  'inverse-chain': inverseChain,
  'goblin-bins': goblinBins,
  'seam-grid': seamGrid,
  'factor-dials': factorDials
};

export const LADDER_RUNGS = ['l0', 'l1', 'l2', 'l4', 'l3'];

export const CONJECTURE_STEMS = [
  { id: 'think', text: 'I think...' },
  { id: 'notice', text: 'I notice...' },
  { id: 'what_if', text: 'What if...' }
];

// Helper: Word count for justification
export function countWords(str) {
  if (typeof str !== 'string') return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

// Helper: Check answer deterministically
export function checkAnswer(value, targetAnswer) {
  if (!targetAnswer) return false;
  if (targetAnswer.type === 'integer') {
    return Number(value) === targetAnswer.value;
  }
  if (targetAnswer.type === 'set') {
    if (!Array.isArray(value) || !Array.isArray(targetAnswer.values)) return false;
    const s1 = new Set(value.map(Number));
    const s2 = new Set(targetAnswer.values.map(Number));
    if (s1.size !== s2.size) return false;
    for (const v of s1) if (!s2.has(v)) return false;
    return true;
  }
  if (targetAnswer.type === 'choice') {
    return value === targetAnswer.correct || Number(value) === targetAnswer.correct;
  }
  return false;
}

// Helper: Match misconception
export function matchMisconception(value, misconceptions) {
  if (!Array.isArray(misconceptions)) return null;
  const num = Number(value);
  for (const m of misconceptions) {
    if (typeof m.match === 'number' && m.match === num) return m;
    if (Array.isArray(m.match) && m.match.includes(num)) return m;
    if (typeof m.match === 'object' && m.match !== null && m.match.min !== undefined && m.match.max !== undefined) {
      if (num >= m.match.min && num <= m.match.max) return m;
    }
  }
  return misconceptions.find(m => m.match === 'any-wrong') || null;
}

// Helper: Check if encounter has more parts
export function hasMoreParts(session, encounter) {
  if (!encounter || !Array.isArray(encounter.parts)) return false;
  const currentIdx = encounter.parts.findIndex(p => p.id === session.currentPartId);
  return currentIdx >= 0 && currentIdx < encounter.parts.length - 1;
}

// Helper: Get part definition
export function getPart(encounter, partId) {
  return encounter.parts.find(p => p.id === partId) || encounter.parts[0];
}

/**
 * 1. createSession(encounter, options)
 * Initializes a new deterministic session.
 */
export function createSession(encounter, options = {}) {
  if (!encounter || !encounter.id || !Array.isArray(encounter.parts) || encounter.parts.length === 0) {
    throw new Error('createSession: Invalid encounter definition');
  }

  const initialPart = encounter.parts[0];
  const mechanicKind = initialPart.mechanic.kind;
  const mechanic = MECHANICS[mechanicKind];
  if (!mechanic) {
    throw new Error(`Unknown mechanic: ${mechanicKind}`);
  }

  const initialMechanicState = mechanic.init(initialPart.mechanic);
  const sessionId = options.sessionId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`);

  return {
    sessionId,
    encounterId: encounter.id,
    currentPartId: initialPart.id,
    state: 'arrive',
    phase: 'arrive',
    history: [
      {
        turnId: 0,
        timestamp: Date.now(),
        who: 'engine',
        action: 'session.start',
        state: 'arrive',
        hintRung: 'l0'
      }
    ],
    activeCard: null,
    probeCountInState: 0,
    hintRung: 'l0',
    hintRungIndex: 0,
    nonProgressCount: 0,
    conjectures: 0,
    conjecturesCount: 0,
    attempts: 0,
    shortcut: false,
    misconceptionTag: null,
    mechanicState: initialMechanicState,
    simplerProblemState: null,
    simplerProblemL3Unlocked: false,
    lookBackCompleted: false,
    parentWaiver: Boolean(options.parentWaiver || options.chapterWaiverUsed),
    chapterWaiverUsed: Boolean(options.chapterWaiverUsed || options.parentWaiver),
    parentFlag: false,
    parentScribe: false,
    isSealed: false,
    completed: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

/**
 * 2. transition(session, action, encounter)
 * Pure transition function: (state, action, encounter) -> { session, events }
 */
export function transition(session, action, encounter) {
  if (!session || !action || !encounter) {
    throw new Error('transition requires session, action, and encounter');
  }

  const events = [];
  const part = getPart(encounter, session.currentPartId);

  // Pure deep clone of session state to prevent in-place mutation
  let next = {
    ...session,
    history: [...(session.history || [])],
    simplerProblemState: session.simplerProblemState
      ? { ...session.simplerProblemState }
      : null,
    updatedAt: Date.now()
  };

  function syncAliases() {
    next.phase = next.state;
    next.conjecturesCount = next.conjectures;
    next.chapterWaiverUsed = Boolean(next.chapterWaiverUsed || next.parentWaiver);
    next.parentWaiver = next.chapterWaiverUsed;
    next.isSealed = Boolean(next.completed || next.lookBackCompleted || next.state === 'sealed' || next.state === 'map');
  }

  function recordEvent(type, payload = {}) {
    events.push({ type, state: next.state, hintRung: next.hintRung, ...payload });
  }

  function appendHistory(who, actionType, payload = {}) {
    const turnId = next.history.length;
    next.history = [
      ...next.history,
      {
        turnId,
        timestamp: Date.now(),
        who,
        action: actionType,
        payload,
        state: next.state,
        hintRung: next.hintRung
      }
    ];
  }

  // --- Parent Overrides (Can occur in any state) ---
  if (action.type === 'parent_override') {
    if (typeof action.hintRung === 'string') {
      const idx = LADDER_RUNGS.indexOf(action.hintRung);
      if (idx >= 0) {
        next.hintRung = action.hintRung;
        next.hintRungIndex = idx;
        recordEvent('parent.override', { kind: 'rung', value: action.hintRung });
        appendHistory('parent', 'override_rung', { hintRung: action.hintRung });
      }
    }
    syncAliases();
    return { session: next, events };
  }

  if (action.type === 'parent_scribe') {
    next.parentScribe = Boolean(action.enabled);
    recordEvent('parent.override', { kind: 'scribe', value: next.parentScribe });
    appendHistory('parent', 'toggle_scribe', { enabled: next.parentScribe });
    syncAliases();
    return { session: next, events };
  }

  // =========================================================================
  // STATE: ARRIVE
  // =========================================================================
  if (next.state === 'arrive') {
    if (action.type === 'arrive' || action.type === 'read_inscription' || action.type === 'start') {
      // T01: Arrive -> Conjecture
      next.state = 'conjecture';
      next.conjectures = 0;
      next.probeCountInState = 0;
      recordEvent('engine.transition', { from: 'arrive', to: 'conjecture' });
      appendHistory('engine', 'arrive_to_conjecture');
    }
    syncAliases();
    return { session: next, events };
  }

  // =========================================================================
  // STATE: CONJECTURE
  // =========================================================================
  if (next.state === 'conjecture') {
    if (action.type === 'skip_conjecture') {
      // Direct skip to Understand
      next.state = 'understand';
      next.probeCountInState = 0;
      recordEvent('engine.transition', { from: 'conjecture', to: 'understand', reason: 'skipped' });
      appendHistory('child', 'skip_conjecture');
      syncAliases();
      return { session: next, events };
    }

    if (action.type === 'conjecture') {
      const stem = action.stem;
      const value = action.value;
      const reason = action.reason ?? action.justification ?? '';
      appendHistory('child', 'conjecture', { stem, value, reason });
      const isRight = checkAnswer(value, part.answer);
      const wordCount = countWords(reason);

      if (isRight) {
        if (wordCount >= 3) {
          // A shortcut opens this part. Look Back belongs to the final part only.
          next.state = hasMoreParts(next, encounter) ? 'sealed' : 'look_back';
          next.shortcut = true;
          recordEvent('engine.transition', { from: 'conjecture', to: next.state, shortcut: true });
          recordEvent('shortcut', { shortcut: true, words: wordCount });
          syncAliases();
          return { session: next, events };
        } else {
          // T03: Conjecture -> Conjecture (Skeptic prompt)
          recordEvent('conjecture.skeptic_prompt', { prompt: 'Convince me in one sentence.' });
          syncAliases();
          return { session: next, events };
        }
      } else {
        // Wrong conjecture
        next.conjectures += 1;
        const matched = matchMisconception(value, part.misconceptions);
        if (matched) {
          next.misconceptionTag = matched.tag;
          const startLvl = typeof matched.startLevel === 'number' ? matched.startLevel : 0;
          next.hintRungIndex = Math.min(4, Math.max(0, startLvl));
          next.hintRung = LADDER_RUNGS[next.hintRungIndex];
        }

        // T04 & T05: Conjecture -> Understand
        next.state = 'understand';
        next.probeCountInState = 0;
        recordEvent('engine.transition', {
          from: 'conjecture',
          to: 'understand',
          conjectures: next.conjectures,
          tag: next.misconceptionTag,
          startRung: next.hintRung
        });
        syncAliases();
        return { session: next, events };
      }
    }
  }

  // =========================================================================
  // STATE: UNDERSTAND
  // =========================================================================
  if (next.state === 'understand') {
    // T05 & Second Conjecture Handling (SPEC §4 Rows 2–5)
    if (action.type === 'conjecture' && next.conjectures < 2) {
      const stem = action.stem;
      const value = action.value;
      const reason = action.reason ?? action.justification ?? '';
      appendHistory('child', 'conjecture', { stem, value, reason });
      const isRight = checkAnswer(value, part.answer);
      const wordCount = countWords(reason);

      if (isRight) {
        if (wordCount >= 3) {
          // As with a first conjecture, only the final part enters Look Back.
          next.state = hasMoreParts(next, encounter) ? 'sealed' : 'look_back';
          next.shortcut = true;
          recordEvent('engine.transition', { from: 'understand', to: next.state, shortcut: true });
          recordEvent('shortcut', { shortcut: true, words: wordCount });
          syncAliases();
          return { session: next, events };
        } else {
          // T03: Right answer with < 3 words -> Skeptic prompt
          recordEvent('conjecture.skeptic_prompt', { prompt: 'Convince me in one sentence.' });
          syncAliases();
          return { session: next, events };
        }
      } else {
        // T05: Second wrong conjecture -> closes conjecture window, updates misconception
        next.conjectures = 2;
        const matched = matchMisconception(value, part.misconceptions);
        if (matched) {
          next.misconceptionTag = matched.tag;
          const startLvl = typeof matched.startLevel === 'number' ? matched.startLevel : 0;
          next.hintRungIndex = Math.min(4, Math.max(0, startLvl));
          next.hintRung = LADDER_RUNGS[next.hintRungIndex];
        }

        recordEvent('engine.transition', {
          from: 'understand',
          to: 'understand',
          conjectures: next.conjectures,
          tag: next.misconceptionTag,
          startRung: next.hintRung
        });
        syncAliases();
        return { session: next, events };
      }
    }

    if (action.type === 'say' || action.type === 'chip') {
      appendHistory('child', action.type, { text: action.text || action.chip });
      const classification = action.classification || {};
      const allTrue = Boolean(classification.unknown && classification.data && classification.condition);
      next.probeCountInState += 1;

      if (allTrue || next.probeCountInState >= 2) {
        // T06: Understand -> Plan (Deck opens)
        next.state = 'plan';
        next.probeCountInState = 0;
        recordEvent('engine.transition', { from: 'understand', to: 'plan', reason: allTrue ? 'classified' : 'probe_cap' });
      } else {
        // T07: Understand -> Understand (next probe)
        recordEvent('engine.transition', { from: 'understand', to: 'understand', probeCount: next.probeCountInState });
      }
      syncAliases();
      return { session: next, events };
    }
  }

  // =========================================================================
  // STATE: PLAN
  // =========================================================================
  if (next.state === 'plan') {
    if (action.type === 'card') {
      // T08: Plan -> Carry out (Workspace unlocks)
      const cardId = action.cardId ?? action.card;
      next.activeCard = cardId;
      next.state = 'carry_out';
      next.probeCountInState = 0;
      const isCardInEncounter = Array.isArray(encounter.cards) && encounter.cards.includes(cardId);
      recordEvent('engine.transition', { from: 'plan', to: 'carry_out', card: cardId, onTarget: isCardInEncounter });
      appendHistory('child', 'select_card', { cardId });
      syncAliases();
      return { session: next, events };
    }

    if (action.type === 'say') {
      // Child conversation in Plan (e.g. discussing card choice or trailing understand burst)
      const text = action.text || '';
      appendHistory('child', 'say', { text });
      recordEvent('child.say', { utterance: text });
      syncAliases();
      return { session: next, events };
    }

    if (action.type === 'stuck' || action.type === 'idle' || action.type === 'probe') {
      // T09: Plan -> Plan (Ladder escalates)
      next.hintRungIndex = Math.min(4, next.hintRungIndex + 1);
      next.hintRung = LADDER_RUNGS[next.hintRungIndex];
      recordEvent('engine.transition', { from: 'plan', to: 'plan', ladderEscalated: next.hintRung });
      appendHistory('child', action.type);
      syncAliases();
      return { session: next, events };
    }
  }

  // =========================================================================
  // STATE: CARRY_OUT
  // =========================================================================
  if (next.state === 'carry_out') {
    // Child dialogue / speech in Carry Out (SPEC §4, §6)
    if (action.type === 'say') {
      const text = action.text || '';
      appendHistory('child', 'say', { text });
      recordEvent('child.say', { utterance: text });
      syncAliases();
      return { session: next, events };
    }

    // Interactive workspace step
    if (action.type === 'step') {
      const stepPayload = action.payload ?? action.step ?? action;
      appendHistory('child', 'step', stepPayload);
      const mechanic = MECHANICS[part.mechanic.kind];
      const stepRes = mechanic.checkStep(next.mechanicState, stepPayload);
      next.mechanicState = stepRes.state;

      if (stepRes.valid && stepRes.progress) {
        // T10: Carry out -> Carry out (Step right, ladder fades floor l1)
        next.hintRungIndex = Math.max(1, next.hintRungIndex - 1);
        next.hintRung = LADDER_RUNGS[next.hintRungIndex];
        next.nonProgressCount = 0;
        recordEvent('step.success', { progress: true, ladder: next.hintRung });
      } else {
        // T11: Carry out -> Carry out (Step wrong/non-progress)
        next.nonProgressCount += 1;
        if (next.nonProgressCount >= 2) {
          next.hintRungIndex = Math.min(4, next.hintRungIndex + 1);
          next.hintRung = LADDER_RUNGS[next.hintRungIndex];
          next.nonProgressCount = 0;
          recordEvent('ladder.escalate', { ladder: next.hintRung, reason: 'two_consecutive_non_progress' });
        }
      }

      // T12: Escalation to Simpler Problem sub-loop
      if (next.hintRungIndex === 3) { // 'l4'
        next.state = 'simpler_problem';
        next.simplerProblemState = {
          statement: part.ladder.l4.statement,
          answer: part.ladder.l4.answer,
          l3Hint: part.ladder.l4.l3,
          attempts: 0,
          completed: false
        };
        recordEvent('engine.transition', { from: 'carry_out', to: 'simpler_problem', trigger: 'ladder_l4' });
      }
      syncAliases();
      return { session: next, events };
    }

    // Direct card trigger for simpler problem
    const activeCardId = action.cardId ?? action.card;
    if (action.type === 'card' && (activeCardId === 'tiny-case' || activeCardId === 'try-simpler-numbers')) {
      next.state = 'simpler_problem';
      next.simplerProblemState = {
        statement: part.ladder.l4.statement,
        answer: part.ladder.l4.answer,
        l3Hint: part.ladder.l4.l3,
        attempts: 0,
        completed: false
      };
      recordEvent('engine.transition', { from: 'carry_out', to: 'simpler_problem', trigger: 'card_tiny_case' });
      syncAliases();
      return { session: next, events };
    }

    // Submission via stone dial
    if (action.type === 'submit') {
      appendHistory('child', 'submit', { value: action.value });
      next.state = 'submit';
      recordEvent('engine.transition', { from: 'carry_out', to: 'submit' });

      // Immediate check inside submit evaluation
      const isRight = checkAnswer(action.value, part.answer);
      if (isRight) {
        next.attempts += 1;
        if (hasMoreParts(next, encounter)) {
          // SPEC §4 line 65: Look Back runs after the last part. Intermediate parts seal directly.
          next.state = 'sealed';
          recordEvent('engine.transition', { from: 'submit', to: 'sealed', partId: next.currentPartId, attempts: next.attempts });
        } else {
          // T15: Submit -> Look back (last part)
          next.state = 'look_back';
          recordEvent('engine.transition', { from: 'submit', to: 'look_back', attempts: next.attempts });
        }
      } else {
        // T16: Submit -> Carry out
        next.state = 'carry_out';
        next.attempts += 1;
        recordEvent('engine.transition', { from: 'submit', to: 'carry_out', attempts: next.attempts, correct: false });
        if (next.attempts >= 3) {
          next.parentFlag = true;
          recordEvent('parent.flag', { reason: 'three_failed_submits', l3Offered: true });
        }
      }
      syncAliases();
      return { session: next, events };
    }

    if (action.type === 'stuck') {
      appendHistory('child', 'stuck');
      next.nonProgressCount = 0;
      next.hintRungIndex = Math.min(4, next.hintRungIndex + 1);
      next.hintRung = LADDER_RUNGS[next.hintRungIndex];
      recordEvent('ladder.escalate', { ladder: next.hintRung, reason: 'stuck' });

      if (next.hintRungIndex === 3) {
        next.state = 'simpler_problem';
        next.simplerProblemState = {
          statement: part.ladder.l4.statement,
          answer: part.ladder.l4.answer,
          l3Hint: part.ladder.l4.l3,
          attempts: 0,
          completed: false
        };
        recordEvent('engine.transition', { from: 'carry_out', to: 'simpler_problem', trigger: 'ladder_l4' });
      }
      syncAliases();
      return { session: next, events };
    }
  }

  // =========================================================================
  // STATE: SIMPLER_PROBLEM
  // =========================================================================
  if (next.state === 'simpler_problem') {
    if (action.type === 'simpler_submit' || action.type === 'submit') {
      appendHistory('child', 'simpler_submit', { value: action.value });
      const sp = next.simplerProblemState;
      const isRight = checkAnswer(action.value, sp.answer);

      if (isRight) {
        // T13: Simpler problem -> Carry out (Solved)
        next.state = 'carry_out';
        next.hintRungIndex = 1; // reset to l1
        next.hintRung = 'l1';
        next.simplerProblemState = null;
        recordEvent('engine.transition', { from: 'simpler_problem', to: 'carry_out', reason: 'solved', bridge: true });
        syncAliases();
        return { session: next, events };
      } else {
        sp.attempts += 1;
        if (sp.attempts >= 2) {
          // T14: Deliver worked step l3 and return
          next.state = 'carry_out';
          next.hintRungIndex = 1; // reset to l1
          next.hintRung = 'l1';
          next.simplerProblemL3Unlocked = true;
          next.simplerProblemState = null;
          recordEvent('engine.transition', { from: 'simpler_problem', to: 'carry_out', reason: 'max_attempts_l3_given', bridge: true });
          syncAliases();
          return { session: next, events };
        }
        recordEvent('simpler_problem.wrong', { attempts: sp.attempts });
        syncAliases();
        return { session: next, events };
      }
    }
  }

  // =========================================================================
  // STATE: LOOK_BACK
  // =========================================================================
  if (next.state === 'look_back') {
    if (action.type === 'lookback') {
      const option = (action.kind && encounter.lookBack.find(o => o.kind === action.kind))
        ?? (typeof action.index === 'number' && encounter.lookBack[action.index])
        ?? encounter.lookBack[0];
      const kind = action.kind ?? option?.kind;
      appendHistory('child', 'lookback', { kind, index: action.index, value: action.value });
      const isRight = option && checkAnswer(action.value, option.check);

      if (isRight) {
        // T17: Look back -> Sealed
        next.state = 'sealed';
        next.lookBackCompleted = true;
        recordEvent('engine.transition', { from: 'look_back', to: 'sealed', kind });
        recordEvent('node.sealed', { encounterId: encounter.id, partId: next.currentPartId, kind, shortcut: next.shortcut });
        syncAliases();
        return { session: next, events };
      } else {
        recordEvent('lookback.retry', { kind });
        syncAliases();
        return { session: next, events };
      }
    }

    if (action.type === 'waive' || action.type === 'waiver') {
      // T18: Look back -> Sealed (Parent waiver)
      if (!next.parentWaiver && !next.chapterWaiverUsed) {
        next.parentWaiver = true;
        next.chapterWaiverUsed = true;
        next.lookBackCompleted = true;
        next.state = 'sealed';
        recordEvent('engine.transition', { from: 'look_back', to: 'sealed', waived: true });
        recordEvent('node.sealed', { encounterId: encounter.id, partId: next.currentPartId, waived: true });
        appendHistory('parent', 'waive_lookback');
      }
      syncAliases();
      return { session: next, events };
    }
  }

  // =========================================================================
  // STATE: SEALED
  // =========================================================================
  if (next.state === 'sealed') {
    if (action.type === 'next_part') {
      if (hasMoreParts(next, encounter)) {
        // T19: Sealed -> Arrive (Next part)
        const currentIdx = encounter.parts.findIndex(p => p.id === next.currentPartId);
        const nextPart = encounter.parts[currentIdx + 1];
        next.currentPartId = nextPart.id;
        next.state = 'arrive';
        next.conjectures = 0;
        next.probeCountInState = 0;
        next.nonProgressCount = 0;
        next.hintRung = 'l0';
        next.hintRungIndex = 0;
        next.attempts = 0;
        next.shortcut = false;
        next.misconceptionTag = null;
        next.simplerProblemState = null;
        next.simplerProblemL3Unlocked = false;
        next.lookBackCompleted = false;

        const mechanic = MECHANICS[nextPart.mechanic.kind];
        next.mechanicState = mechanic.init(nextPart.mechanic);

        recordEvent('engine.transition', { from: 'sealed', to: 'arrive', nextPartId: nextPart.id });
        appendHistory('engine', 'advance_part', { nextPartId: nextPart.id });
      } else {
        // Terminal: Node complete -> Map
        next.completed = true;
        next.state = 'map';
        recordEvent('session.end', { reason: 'finished', encounterId: encounter.id });
        appendHistory('engine', 'session_complete');
      }
      syncAliases();
      return { session: next, events };
    }

    if (action.type === 'complete' && !hasMoreParts(next, encounter)) {
      next.completed = true;
      next.state = 'map';
      recordEvent('session.end', { reason: 'finished', encounterId: encounter.id });
      appendHistory('engine', 'session_complete');
      syncAliases();
      return { session: next, events };
    }
  }

  syncAliases();
  return { session: next, events };
}

/**
 * 3. isTerminal(session)
 * Returns true if the session is fully completed.
 */
export function isTerminal(session) {
  return Boolean(session && session.completed);
}

/**
 * 4. getClientSafeView(session, encounter)
 * Strips answers, intermediates, solution trees, higher hint texts,
 * and misconception tags server-side (SPEC §6, §14).
 */
export function getClientSafeView(session, encounter) {
  return getClientSafeSessionView(session, encounter);
}
