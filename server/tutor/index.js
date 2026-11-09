/**
 * Castle of Theorems v1 (Home Edition)
 * Core Tutor Router & Information Diet Controller (SPEC §6, §7)
 * server/tutor/index.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkUtterance } from '../engine/leakGate.js';
import { getScriptedProbe, getScriptedFollowUp } from '../engine/scripted.js';
import { logEventSync } from '../engine/telemetry.js';

// Adapters
import * as scriptedAdapter from './scripted.js';
import * as geminiAdapter from './gemini.js';
import * as claudeAdapter from './claude.js';
import * as agyAdapter from './agy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pre-load system prompt
export const SYSTEM_PROMPT = fs.readFileSync(path.resolve(__dirname, 'prompt.md'), 'utf8').trim();

// Pre-load encounter definitions for allowedContent assembly and leakGateContext
const encountersCache = new Map();
const ENCOUNTERS_DIR = path.resolve(__dirname, '../../content/encounters');

export function getEncounter(encounterId) {
  if (!encounterId) return null;
  if (encountersCache.has(encounterId)) {
    return encountersCache.get(encounterId);
  }
  if (!fs.existsSync(ENCOUNTERS_DIR)) {
    return null;
  }
  const files = fs.readdirSync(ENCOUNTERS_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(ENCOUNTERS_DIR, file), 'utf8'));
      if (raw.id === encounterId) {
        encountersCache.set(encounterId, raw);
        return raw;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export const CARD_NAMES = {
  'work-backwards': 'Work backwards',
  'worst-case': 'Worst case',
  'tiny-case': 'Try a tiny case',
  'draw-it': 'Draw it',
  'odd-or-even': 'Odd or even',
  'odd-even': 'Odd or even',
  'find-what-is-shared': 'Find what is shared',
  'find-shared': 'Find what is shared'
};

/**
 * Strict Information Diet guard.
 * Asserts that no secret or intermediate values exist in the context passed to the router.
 * @param {object} ctx
 */
export function assertInformationDiet(ctx) {
  if (!ctx || typeof ctx !== 'object') return;

  const forbiddenKeys = [
    'targetAnswer',
    'answer',
    'solution',
    'intermediates',
    'solutionTree',
    'isCorrect',
    'correct',
    'correctness',
    'forbidden'
  ];

  for (const key of forbiddenKeys) {
    if (key in ctx && ctx[key] !== undefined) {
      throw new Error(`Information diet violation: ctx contains forbidden key "${key}"`);
    }
  }
}

/**
 * Builds allowedContent for model context adhering strictly to SPEC §6 Visibility Matrix.
 *
 * @param {object} encounter
 * @param {object} part
 * @param {string} state
 * @param {string} rung
 * @returns {{ pool: string[]|null, hintText: string|null, cardNames: string[]|null }}
 */
export function buildAllowedContent(encounter, part, state, rung) {
  const ladder = part?.ladder || {};
  let pool = null;
  let hintText = null;
  let cardNames = null;

  if (state === 'conjecture') {
    pool = part?.conjecture || [
      "Convince me of your thinking in one clear sentence: why does that make sense for this problem?"
    ];
  } else if (state === 'understand') {
    pool = Array.isArray(ladder.l0) ? [...ladder.l0] : [];
  } else if (state === 'plan') {
    pool = Array.isArray(ladder.l1) ? [...ladder.l1] : [];
    cardNames = (encounter?.cards || []).map(id => CARD_NAMES[id] || id);
  } else if (state === 'carry_out') {
    if (rung === 'l1') {
      pool = Array.isArray(ladder.l1) ? [...ladder.l1] : [];
      cardNames = (encounter?.cards || []).map(id => CARD_NAMES[id] || id);
    } else if (rung === 'l2') {
      hintText = ladder.l2?.text || null;
    } else if (rung === 'l3') {
      hintText = ladder.l3?.text || null;
    }
  } else if (state === 'simpler_problem') {
    pool = [ladder.l4?.statement || "Try this tiny version of the problem first."];
    hintText = ladder.l4?.l3 || null;
  } else if (state === 'look_back') {
    pool = (encounter?.lookBack || []).map(opt => opt.prompt);
  }

  return { pool, hintText, cardNames };
}

/**
 * Builds a targeted corrective message when candidate fails leak gate.
 *
 * @param {object} gateResult
 * @param {string} candidate
 * @returns {string}
 */
export function formatCorrectivePrompt(gateResult, candidate) {
  switch (gateResult.reason) {
    case 'length':
      return `Your previous reply was ${candidate.trim().length} characters. Write a single sentence strictly between 150 and 300 characters ending with a question mark.`;
    case 'shape':
      return `Your previous reply did not end with exactly one question mark, or contained list markers or emoji. Write a single natural question ending with a question mark.`;
    case 'forbidden':
      return `Your previous reply contained a forbidden number or calculation. Never mention numbers or calculations. Ask a pure Socratic question about the student's idea or what to try next.`;
    case 'construction':
      return `Your previous reply contained an answer reveal construction or equation. Do not state answers or give equations. Ask a guiding question instead.`;
    case 'praise':
      return `Your previous reply contained evaluative praise or judgment (${gateResult.detail || ''}). Keep a neutral, curious tone without praising or saying whether the idea is correct.`;
    case 'rung':
      return `Your previous reply contained digits or operation words not permitted at this hint level. Do not name operations or digits. Ask a pure conceptual question.`;
    case 'banned_operation':
      return `Your previous reply named an operation (${gateResult.detail || ''}). Do not suggest arithmetic operations. Ask what the student notices.`;
    default:
      return `Your previous reply broke rule ${gateResult.reason || 'leak_gate'}. Write a different reply asking a pure question.`;
  }
}

/**
 * Generates a validated tutor turn for the child interface.
 *
 * @param {object} ctx
 * @param {string} ctx.encounterId
 * @param {string} [ctx.partId='a']
 * @param {string} [ctx.state='understand']
 * @param {string} [ctx.hintRung='l0']
 * @param {string} [ctx.rung='l0']
 * @param {Array<{ who: string, text: string }>} [ctx.publicHistory=[]]
 * @param {string} [ctx.childMessage]
 * @param {string} [ctx.previousSpeech] Local selection only; never sent to a model.
 * @param {string} [ctx.chosenCard]
 * @param {string} [ctx.sessionId]
 * @param {object} [options={}]
 * @param {string} [options.adapter]
 * @param {function} [options.fetchFn]
 * @param {string} [options.apiKey]
 * @param {number} [options.timeoutMs=4000]
 * @param {object} [options.leakContext]
 * @param {number} [options.minLen=150]
 * @param {number} [options.maxLen=300]
 * @returns {Promise<{ utterance: string, speech: string, adapter: string, latencyMs: number, retries: number, fallback: boolean, fallbackReason?: string, parsed?: object }>}
 */
export async function generateTurn(ctx, options = {}) {
  const t0 = Date.now();
  assertInformationDiet(ctx);

  const {
    encounterId,
    partId = 'a',
    state = 'understand',
    hintRung,
    publicHistory = [],
    transcript,
    childMessage = '',
    childAction = null,
    chosenCard = null,
    sessionId = null
  } = ctx;

  const rung = ctx.rung || hintRung || 'l0';
  const history = publicHistory.length > 0 ? publicHistory : (transcript || []);

  const encounter = getEncounter(encounterId);
  const part = encounter?.parts?.find(p => p.id === partId) || encounter?.parts?.[0];

  const allowedContent = ctx.allowedContent || buildAllowedContent(encounter, part, state, rung);

  // STRICT INFORMATION DIET:
  // Whitelist request payload. Never include target answer, intermediates, or correctness signals.
  const adapterRequest = {
    encounterId,
    partId,
    state,
    rung,
    inscription: ctx.inscription || encounter?.inscription || '',
    partPrompt: ctx.partPrompt || part?.prompt || '',
    transcript: (history || []).slice(-6),
    publicHistory: (history || []).slice(-6),
    childMessage: childMessage || null,
    childAction: childAction || null,
    chosenCard: chosenCard ? (CARD_NAMES[chosenCard] || chosenCard) : null,
    allowedContent,
    style: {
      minChars: 150,
      maxChars: 300,
      persona: 'Rivet the clockwork owl, engineer',
      correction: null
    }
  };

  // Leak gate context for screening candidate output
  const givensList = encounter?.givens || [];
  const lookBackChecks = (encounter?.lookBack || [])
    .map(lb => lb.check?.value)
    .filter(v => typeof v === 'number' && !givensList.includes(v));

  const simplerProblemAnswers = (encounter?.parts || [])
    .map(p => p?.ladder?.l4?.answer?.value)
    .filter(v => typeof v === 'number' && !givensList.includes(v));

  const expandedForbidden = Array.from(new Set([
    ...(part?.forbidden || []),
    ...simplerProblemAnswers,
    ...lookBackChecks
  ]));

  const combinedHintText = [
    allowedContent.hintText,
    (state === 'simpler_problem' || rung === 'l4') ? part?.ladder?.l4?.statement : ''
  ].filter(Boolean).join(' ');

  const leakGateContext = options.leakContext || {
    rung,
    forbidden: expandedForbidden,
    givens: givensList,
    inscription: ctx.inscription || encounter?.inscription || '',
    hintText: combinedHintText,
    targetAnswer: part?.answer?.value !== undefined ? part.answer.value : undefined
  };

  const adapterType = options.adapter || ctx.adapter || process.env.TUTOR_ADAPTER || 'scripted';
  const timeoutMs = options.timeoutMs ?? (adapterType === 'agy' ? agyAdapter.configuredTimeoutMs() : 4000);
  const activeSessionId = sessionId || options.sessionId;

  // Prior tutor speech is only a local cursor, never new model context: it may
  // contain a hint from a rung that has since faded. The ordinary public request
  // remains whitelisted above and unchanged for model adapters.
  const scriptedRequest = { ...adapterRequest, previousSpeech: ctx.previousSpeech || '' };
  const screenScripted = speech => {
    // Authored text uses the validator's 40–300 bounds; every other gate stage is
    // identical to model screening. Never return a rejected authored candidate.
    if (checkUtterance(speech, leakGateContext).allowed) return speech;
    const followUp = getScriptedFollowUp(state, scriptedRequest);
    if (checkUtterance(followUp, leakGateContext).allowed) return followUp;
    throw new Error('No safe scripted tutor probe is available');
  };

  // Helper for scripted fallback
  const deliverScriptedFallback = (retries, reason) => {
    const fallbackProbe = screenScripted(getScriptedProbe(encounterId, partId, state, rung, scriptedRequest));
    const latencyMs = Date.now() - t0;
    if (activeSessionId) {
      logEventSync(activeSessionId, 'tutor.call', {
        encounterId,
        partId,
        state,
        rung,
        adapter: adapterType,
        fallback: true,
        fallbackReason: reason,
        retries,
        latencyMs
      });
      logEventSync(activeSessionId, 'tutor.say', {
        speech: fallbackProbe,
        source: 'scripted'
      });
    }
    return {
      utterance: fallbackProbe,
      speech: fallbackProbe,
      adapter: adapterType === 'scripted' ? 'scripted' : 'scripted_fallback',
      latencyMs,
      retries,
      fallback: true,
      fallbackReason: reason
    };
  };

  // Scripted adapter direct path
  if (adapterType === 'scripted') {
    const res = await scriptedAdapter.generateTurn(scriptedRequest);
    const speech = screenScripted(res.utterance);
    res.utterance = res.speech = speech;
    res.parsed.utterance = res.parsed.speech = speech;
    const latencyMs = Date.now() - t0;
    if (activeSessionId) {
      logEventSync(activeSessionId, 'tutor.call', {
        encounterId,
        partId,
        state,
        rung,
        adapter: 'scripted',
        fallback: false,
        retries: 0,
        latencyMs
      });
      logEventSync(activeSessionId, 'tutor.say', {
        speech: res.utterance,
        source: 'scripted'
      });
    }
    return {
      ...res,
      latencyMs
    };
  }

  let adapterImpl;
  if (adapterType === 'gemini') {
    adapterImpl = geminiAdapter;
  } else if (adapterType === 'claude') {
    adapterImpl = claudeAdapter;
  } else if (adapterType === 'agy') {
    adapterImpl = agyAdapter;
  } else {
    adapterImpl = scriptedAdapter;
  }

  // Attempt 1
  let parsedTurn = null;
  let candidate = null;

  try {
    const res = await adapterImpl.callAdapter(adapterRequest, SYSTEM_PROMPT, timeoutMs, options);
    parsedTurn = res.parsed;
    candidate = (parsedTurn?.utterance || parsedTurn?.speech || '').trim();
  } catch (err) {
    return deliverScriptedFallback(0, `Adapter error: ${err.message}`);
  }

  // Screen candidate through leak gate
  const minLen = options.minLen ?? 150;
  const maxLen = options.maxLen ?? 300;
  const gateVerdict1 = checkUtterance(candidate, leakGateContext, { minLen, maxLen });

  if (gateVerdict1.allowed) {
    const latencyMs = Date.now() - t0;
    if (activeSessionId) {
      logEventSync(activeSessionId, 'tutor.call', {
        encounterId,
        partId,
        state,
        rung,
        adapter: adapterType,
        fallback: false,
        retries: 0,
        gateVerdict: 'allowed',
        latencyMs
      });
      logEventSync(activeSessionId, 'tutor.say', {
        speech: candidate,
        source: 'model'
      });
    }
    return {
      utterance: candidate,
      speech: candidate,
      adapter: adapterType,
      latencyMs,
      retries: 0,
      fallback: false,
      parsed: parsedTurn
    };
  }

  // Attempt 2: Gate rejected, trigger 1 retry with corrective prompt
  if (activeSessionId) {
    logEventSync(activeSessionId, 'utterance_rejected', {
      encounterId,
      partId,
      state,
      rung,
      candidate,
      stage: gateVerdict1.stage,
      reason: gateVerdict1.reason,
      detail: gateVerdict1.detail
    });
  }

  const correction = formatCorrectivePrompt(gateVerdict1, candidate);
  adapterRequest.style.correction = correction;

  let retryParsed = null;
  let retryCandidate = null;

  try {
    const retryOptions = { ...options, correctiveContext: correction };
    const res2 = await adapterImpl.callAdapter(adapterRequest, SYSTEM_PROMPT, timeoutMs, retryOptions);
    retryParsed = res2.parsed;
    retryCandidate = (retryParsed?.utterance || retryParsed?.speech || '').trim();
  } catch (err) {
    return deliverScriptedFallback(1, `Retry adapter error: ${err.message}`);
  }

  const gateVerdict2 = checkUtterance(retryCandidate, leakGateContext, { minLen, maxLen });

  if (gateVerdict2.allowed) {
    const latencyMs = Date.now() - t0;
    if (activeSessionId) {
      logEventSync(activeSessionId, 'tutor.call', {
        encounterId,
        partId,
        state,
        rung,
        adapter: adapterType,
        fallback: false,
        retries: 1,
        gateVerdict: 'allowed',
        latencyMs
      });
      logEventSync(activeSessionId, 'tutor.say', {
        speech: retryCandidate,
        source: 'regenerated'
      });
    }
    return {
      utterance: retryCandidate,
      speech: retryCandidate,
      adapter: adapterType,
      latencyMs,
      retries: 1,
      fallback: false,
      parsed: retryParsed
    };
  }

  // Second failure: scripted probe fallback
  return deliverScriptedFallback(1, `Gate rejected retry: stage ${gateVerdict2.stage} (${gateVerdict2.reason})`);
}

export default {
  SYSTEM_PROMPT,
  assertInformationDiet,
  buildAllowedContent,
  formatCorrectivePrompt,
  generateTurn
};
