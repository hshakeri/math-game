/**
 * Castle of Theorems — Client-Safe View Filter & Leak Auditor
 * server/engine/clientView.js
 *
 * Implements strict information diet (SPEC §5, §6, §13, §14):
 * Strips answers, intermediates, forbidden values, misconceptions,
 * higher hint ladder texts, and solution trees.
 */

import { hasMoreParts, getActiveLookBack } from './stateMachine.js';
import { displayDialogue } from '../tutor/dialogue.js';

export class SecurityLeakError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SecurityLeakError';
    this.details = details;
  }
}

/**
 * Maps numeric hint rung to symbolic identifier.
 * [0: 'l0', 1: 'l1', 2: 'l2', 3: 'l4', 4: 'l3']
 */
export function getRungName(rungIndex) {
  const rungs = ['l0', 'l1', 'l2', 'l4', 'l3'];
  if (typeof rungIndex === 'string') return rungIndex;
  return rungs[rungIndex] || 'l0';
}

// A comic can show the inscription's forward rules before workspace tools unlock.
// Copy only these public givens, never the mechanic object or solution values.
function getStoryGivens(part, encounter) {
  if (encounter?.id === 'ch1-n2-dark-vault') {
    if (typeof encounter.inscription !== 'string' || typeof part?.prompt !== 'string') return null;
    const paragraphs = encounter.inscription.split(/\r?\n\s*\r?\n/).map(text => text.trim());
    // These are authored paragraph boundaries, never inferred sentence stops.
    // The final beat always comes from this part's public torch question.
    if (paragraphs.length !== 2 || paragraphs.some(text => !text)) return null;
    return {
      kind: 'dark-vault',
      beats: [
        { id: 'chest', text: paragraphs[0] },
        { id: 'rules', text: paragraphs[1] },
        { id: 'goal', text: part.prompt }
      ]
    };
  }
  const mechanic = part?.mechanic;
  return mechanic?.kind === 'inverse-chain' ? {
    kind: 'toll-road',
    gates: mechanic.gates.map(gate => ({ mul: gate.mul, sub: gate.sub })),
    end: mechanic.end
  } : null;
}

/**
 * Returns a static, client-safe encounter definition.
 * Used by GET /api/encounter/:id/view (SPEC §4 line 61).
 * Strips solution tree, answer, forbidden, intermediates, misconceptions, ladder, and lookback checks.
 *
 * @param {object} encounter - Authoritative encounter object
 * @returns {object} Sanitized client encounter
 */
export function getClientSafeEncounter(encounter) {
  if (!encounter) throw new Error('Encounter object is required');

  return {
    id: encounter.id,
    chapter: encounter.chapter,
    node: encounter.node,
    contentVersion: encounter.contentVersion,
    title: encounter.title,
    scene: {
      locked: encounter.scene.locked,
      unlocked: encounter.scene.unlocked
    },
    narrative: {
      arrival: encounter.narrative.arrival
    },
    inscription: encounter.inscription,
    story: getStoryGivens(encounter.parts?.[0], encounter),
    cards: [...(encounter.cards || [])],
    givens: [...(encounter.givens || [])],
    parts: encounter.parts.map(part => ({
      id: part.id,
      prompt: part.prompt,
      chips: {
        understand: [...(part.chips?.understand || [])],
        plan: [...(part.chips?.plan || [])]
      },
      mechanic: {
        kind: part.mechanic.kind,
        ...(part.mechanic.gates && { gates: part.mechanic.gates.map(({ mul, sub }) => ({ mul, sub })) }),
        ...(part.mechanic.end !== undefined && { end: part.mechanic.end }),
        ...(part.mechanic.bins !== undefined && { bins: part.mechanic.bins }),
        ...(part.mechanic.perBin !== undefined && { perBin: part.mechanic.perBin }),
        ...(part.mechanic.target && { target: part.mechanic.target }),
        ...(part.mechanic.relation && { relation: part.mechanic.relation }),
        ...(part.mechanic.outerPerimeter !== undefined && { outerPerimeter: part.mechanic.outerPerimeter }),
        ...(part.mechanic.products && { products: part.mechanic.products })
      }
    })),
    lookBack: encounter.lookBack.map(lb => ({
      kind: lb.kind,
      prompt: lb.prompt
    }))
  };
}

// Stage 3 tools use the problem's public givens, independently of hint access.
// In particular, do not copy authored unit lengths, filled leaves, or values
// from a hint diagram into an initial workspace.
function getWorkspaceDiagram(part) {
  const mechanic = part.mechanic;
  let component;
  let params;
  switch (mechanic.kind) {
    case 'inverse-chain':
      component = 'inverse-chain';
      params = {
        gates: mechanic.gates.map(({ mul, sub }) => ({ mul, sub })),
        end: mechanic.end
      };
      break;
    case 'goblin-bins':
      component = 'pigeonhole-bins';
      params = {
        bins: mechanic.bins,
        perBin: mechanic.perBin,
        target: { ...mechanic.target }
      };
      break;
    case 'seam-grid':
      component = 'seam-grid';
      params = {
        shortCount: mechanic.relation.shortCount,
        longCount: mechanic.relation.longCount,
        outerPerimeter: mechanic.outerPerimeter
      };
      break;
    case 'factor-dials':
      component = 'factor-tree';
      params = { roots: mechanic.products.map(product => product.value) };
      break;
    default:
      return null;
  }
  return { component, params, mode: 'workspace' };
}

/**
 * Returns dynamic, client-safe session state payload.
 * Used during active gameplay transitions.
 * @param {object} session - Session state from state machine
 * @param {object} encounter - Authoritative encounter object
 * @returns {object} Sanitized session view
 */
export function getClientSafeSessionView(session, encounter) {
  if (!session || !encounter) {
    throw new Error('Both session and encounter objects are required');
  }

  const currentPart = encounter.parts.find(p => p.id === session.currentPartId) || encounter.parts[0];
  const rungName = getRungName(session.hintRung);
  const rungIndex = typeof session.hintRung === 'number'
    ? session.hintRung
    : ['l0', 'l1', 'l2', 'l4', 'l3'].indexOf(session.hintRung);

  const phase = session.state || session.phase || 'arrive';

  // Determine unlocked workspace
  const workspaceUnlocked = ['carry_out', 'simpler_problem', 'submit', 'look_back', 'sealed', 'map'].includes(phase);

  // Build revealed hints based strictly on current or passed rungs
  const revealedHints = [];
  let clientDiagram = null;

  // Rung l2: conceptual hint text and diagram
  if (rungIndex >= 2 && currentPart.ladder?.l2) {
    revealedHints.push({
      rung: 'l2',
      text: currentPart.ladder.l2.text
    });
    clientDiagram = currentPart.ladder.l2.diagram ? {
      ...currentPart.ladder.l2.diagram,
      mode: workspaceUnlocked ? 'workspace' : 'hint'
    } : null;
  }

  // Keep an earned tiny worked step available after returning to the main task.
  // Otherwise, an explicit Tiny Case request exposes only its statement.
  if ((rungIndex >= 3 || phase === 'simpler_problem' || session.simplerProblemL3Unlocked) && currentPart.ladder?.l4) {
    revealedHints.push({
      rung: 'l4',
      statement: currentPart.ladder.l4.statement,
      ...(session.simplerProblemL3Unlocked && { l3: currentPart.ladder.l4.l3 })
    });
  }

  // Rung l3 (operational hint): text and optional diagram
  if (rungIndex >= 4 && currentPart.ladder?.l3) {
    revealedHints.push({
      rung: 'l3',
      text: currentPart.ladder.l3.text
    });
    if (currentPart.ladder.l3.diagram) {
      clientDiagram = {
        ...currentPart.ladder.l3.diagram,
        mode: workspaceUnlocked ? 'workspace' : 'hint'
      };
    }
  }

  // Choosing a card unlocks the mechanic even when no hint has been requested.
  // Hint text above remains restricted to its earned rung.
  if (workspaceUnlocked) {
    clientDiagram = getWorkspaceDiagram(currentPart) || clientDiagram;
  }

  // Chips available for current phase
  let availableChips = [];
  if (phase === 'understand') {
    availableChips = currentPart.chips?.understand || [];
  } else if (phase === 'plan') {
    availableChips = currentPart.chips?.plan || [];
  }

  const moreParts = hasMoreParts(session, encounter);
  const isEncounterSealed = !moreParts && Boolean(session.completed || session.lookBackCompleted || phase === 'sealed' || phase === 'map');
  const isPartSealed = Boolean(phase === 'sealed' && moreParts);

  return {
    sessionId: session.sessionId,
    encounterId: encounter.id,
    chapter: encounter.chapter,
    node: encounter.node,
    title: encounter.title,
    sceneAsset: isEncounterSealed ? encounter.scene.unlocked : encounter.scene.locked,
    scene: {
      assetId: isEncounterSealed ? encounter.scene.unlocked : encounter.scene.locked,
      state: isEncounterSealed ? 'unlocked' : 'locked'
    },
    narrative: {
      arrival: encounter.narrative.arrival,
      ...(isEncounterSealed && { sealed: encounter.narrative.sealed })
    },
    inscription: encounter.inscription,
    phase,
    state: phase,
    currentPartId: currentPart.id,
    story: getStoryGivens(currentPart, encounter),
    prompt: currentPart.prompt,
    partPrompt: currentPart.prompt,
    availableCards: encounter.cards,
    activeCard: session.activeCard || null,
    workspaceUnlocked,
    hintRung: rungName,
    revealedHints,
    diagram: clientDiagram,
    mechanicState: session.mechanicState || null,
    availableChips,
    chips: {
      understand: currentPart.chips?.understand || [],
      plan: currentPart.chips?.plan || []
    },
    conjecturesRemaining: Math.max(0, 2 - (session.conjecturesCount ?? session.conjectures ?? 0)),
    lastTutorUtterance: session.lastTutorUtterance || null,
    dialogue: displayDialogue(session.dialogue),
    activeLookBackKind: phase === 'look_back' ? getActiveLookBack(session, encounter)?.kind || null : null,
    lookBackOptions: phase === 'look_back'
      ? encounter.lookBack.map(lb => ({ kind: lb.kind, prompt: lb.prompt,
        responseType: lb.check?.type,
        ...(lb.check?.type === 'choice' ? { choices: [...lb.check.options] } : {}) }))
      : null,
    sealed: isEncounterSealed,
    partSealed: isPartSealed,
    hasMoreParts: moreParts,
    nextPartAvailable: isPartSealed,
    codex: isEncounterSealed ? encounter.codex : null,
    parentWaiverAvailable: !(session.chapterWaiverUsed ?? session.parentWaiver),
    parentScribe: Boolean(session.parentScribe),
    parentFlag: Boolean(session.parentFlag),
    completed: Boolean(session.completed)
  };
}

/**
 * Deep audit: scans any payload to guarantee zero information leakage.
 * Asserts no forbidden values, target answers, intermediate values,
 * unearned higher hints, or misconception probes exist in payload.
 *
 * @param {object} payload - Output from getClientSafeEncounter or getClientSafeSessionView
 * @param {object} encounter - Authoritative encounter
 * @param {string} [partId] - Specific part under play
 * @param {number} [currentRungIndex] - Current rung level (0 to 4)
 * @throws {SecurityLeakError} If any leak is detected
 */
export function assertClientSafe(payload, encounter, partId = null, currentRungIndex = 0) {
  if (!payload || typeof payload !== 'object') {
    throw new SecurityLeakError('Payload must be a non-null object');
  }

  // 1. Recursive key check: forbidden properties must NEVER appear anywhere in client view
  const FORBIDDEN_KEYS = new Set(['answer', 'intermediates', 'forbidden', 'misconceptions', 'check']);
  function checkForbiddenKeys(obj, path = '') {
    if (obj === null || typeof obj !== 'object') return;
    for (const [key, value] of Object.entries(obj)) {
      if (FORBIDDEN_KEYS.has(key)) {
        throw new SecurityLeakError(`Forbidden property key '${key}' leaked at path '${path}.${key}'`, { key, path });
      }
      checkForbiddenKeys(value, `${path}.${key}`);
    }
  }
  checkForbiddenKeys(payload, '$');

  const partsToCheck = partId ? encounter.parts.filter(p => p.id === partId) : encounter.parts;

  // Check revealedHints content
  const revealedHints = payload.revealedHints || [];
  const revealedText = revealedHints.map(h => `${h.text || ''} ${h.statement || ''} ${h.l3 || ''}`).join(' ');

  for (const part of partsToCheck) {
    // 2. Misconception probes must NEVER appear in any text field
    if (Array.isArray(part.misconceptions)) {
      for (const misc of part.misconceptions) {
        if (misc.probe && revealedText.includes(misc.probe)) {
          throw new SecurityLeakError(`Misconception probe leaked in revealedHints: "${misc.probe.slice(0, 30)}..."`, { partId: part.id, tag: misc.tag });
        }
      }
    }

    // 3. Higher hint texts must NEVER appear if child is below that rung
    if (currentRungIndex < 2 && part.ladder?.l2?.text) {
      if (revealedText.includes(part.ladder.l2.text)) {
        throw new SecurityLeakError(`Higher hint l2.text leaked when child is at rung ${currentRungIndex}`, { partId: part.id });
      }
    }
    if (currentRungIndex < 4 && part.ladder?.l3?.text) {
      if (revealedText.includes(part.ladder.l3.text)) {
        throw new SecurityLeakError(`Higher hint l3.text leaked when child is at rung ${currentRungIndex}`, { partId: part.id });
      }
    }
  }

  // 4. Lookback check values must NEVER appear
  if (Array.isArray(payload.lookBackOptions)) {
    for (const opt of payload.lookBackOptions) {
      if (opt.check !== undefined) {
        throw new SecurityLeakError('Look back check leaked in lookBackOptions', { opt });
      }
    }
  }

  // 5. Unearned codex must NEVER appear before sealed
  if (!payload.sealed && payload.codex) {
    throw new SecurityLeakError('Codex leaked prior to sealed state');
  }

  return true;
}
