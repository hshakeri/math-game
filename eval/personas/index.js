/**
 * Castle of Theorems — Synthetic Student Personas Simulation Engine (SPEC §11)
 * eval/personas/index.js
 *
 * Implements deterministic child action policies for all 6 personas:
 * - impulsive
 * - extractor
 * - caver
 * - silent
 * - misconception (misconception-x)
 * - prodigy
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PERSONA_NAMES = [
  'impulsive',
  'extractor',
  'caver',
  'silent',
  'misconception',
  'prodigy'
];

/**
 * Loads markdown definition for a persona.
 * @param {string} name
 * @returns {string}
 */
export function loadPersonaPrompt(name) {
  const norm = name.toLowerCase().replace('-x', '');
  const filePath = path.join(__dirname, `${norm}.md`);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return '';
}

// Authoritative solutions and look back checks per encounter
const ENCOUNTER_DATA = {
  'chasm-reverse-tolls': {
    targetAnswer: 6,
    misconceptionVal: 15,
    conjectureJustification: 'Walking backwards through the gates gives eleven, seven, then six.',
    lookBackCheck: { verify: 13, perturb: 6, 'second-method': 45 },
    cardId: 'work-backwards'
  },
  'ch1-n1-reverse-tolls': {
    targetAnswer: 6,
    misconceptionVal: 15,
    conjectureJustification: 'Walking backwards through the gates gives eleven, seven, then six.',
    lookBackCheck: { verify: 13, perturb: 6, 'second-method': 45 },
    cardId: 'work-backwards'
  },
  'alchemists-dark-vault': {
    parts: {
      a: { targetAnswer: 4, misconceptionVal: 2, justification: 'Three crystal colors worst case requires four picks.' },
      b: { targetAnswer: 10, misconceptionVal: 4, justification: 'Three of each color is nine, tenth guarantees four.' },
      c: { targetAnswer: 13, misconceptionVal: 12, justification: 'Twelve plus one guarantees two different colors.' }
    },
    lookBackCheck: { perturb: 5, verify: 1, 'second-method': 3 },
    cardId: 'worst-case'
  },
  'ch1-n2-dark-vault': {
    parts: {
      a: { targetAnswer: 4, misconceptionVal: 2, justification: 'Three crystal colors worst case requires four picks.' },
      b: { targetAnswer: 10, misconceptionVal: 4, justification: 'Three of each color is nine, tenth guarantees four.' },
      c: { targetAnswer: 13, misconceptionVal: 12, justification: 'Twelve plus one guarantees two different colors.' }
    },
    lookBackCheck: { perturb: 5, verify: 1, 'second-method': 3 },
    cardId: 'worst-case'
  },
  'courtyard-five-shields': {
    targetAnswer: 30,
    misconceptionVal: 22,
    conjectureJustification: 'Three upright and two flat shields have perimeter sixty-six.',
    lookBackCheck: { verify: 84, perturb: 20, 'second-method': 15 },
    cardId: 'draw-it'
  },
  'ch1-n3-five-shields': {
    targetAnswer: 30,
    misconceptionVal: 22,
    conjectureJustification: 'Three upright and two flat shields have perimeter sixty-six.',
    lookBackCheck: { verify: 84, perturb: 20, 'second-method': 15 },
    cardId: 'draw-it'
  },
  'castle-keep-portcullis': {
    targetAnswer: 24,
    misconceptionVal: 51,
    conjectureJustification: 'Seventeen times two is 34, times five is 85, sum is twenty-four.',
    lookBackCheck: { verify: 0, perturb: 22, 'second-method': 0 },
    cardId: 'find-what-is-shared'
  },
  'ch1-n4-castle-keep': {
    targetAnswer: 24,
    misconceptionVal: 51,
    conjectureJustification: 'Seventeen times two is 34, times five is 85, sum is twenty-four.',
    lookBackCheck: { verify: 0, perturb: 22, 'second-method': 0 },
    cardId: 'find-what-is-shared'
  }
};

function getEncounterMeta(encounterId, partId = 'a') {
  const normId = encounterId.replace(/^ch1-n\d-/, '');
  const entry = ENCOUNTER_DATA[encounterId] || ENCOUNTER_DATA[normId] || ENCOUNTER_DATA['chasm-reverse-tolls'];
  if (entry.parts) {
    const partEntry = entry.parts[partId] || entry.parts['a'];
    return {
      targetAnswer: partEntry.targetAnswer,
      misconceptionVal: partEntry.misconceptionVal,
      conjectureJustification: partEntry.justification,
      lookBackCheck: entry.lookBackCheck,
      cardId: entry.cardId
    };
  }
  return entry;
}

/**
 * Chooses next action for a persona given the current client-safe view and history.
 * @param {string} personaName
 * @param {object} view
 * @param {number} childTurnIndex - 0-indexed turn counter
 * @param {Array<object>} history - Prior dialogue turns
 * @returns {object} { action: object, annotation: object }
 */
export function chooseChildAction(personaName, view, childTurnIndex, history = []) {
  const normPersona = (personaName || 'impulsive').toLowerCase().replace('-x', '');
  const phase = view.state || view.phase;
  const currentPartId = view.currentPartId || 'a';
  const meta = getEncounterMeta(view.encounterId, currentPartId);

  // 1. Intermediate Part Complete -> Advance
  if (view.partSealed && view.hasMoreParts) {
    return {
      action: { type: 'next_part' },
      annotation: { phase: 'sealed', note: 'Advancing to next subpart' }
    };
  }

  // 2. Stage: arrive
  if (phase === 'arrive') {
    return {
      action: { type: 'arrive' },
      annotation: { phase: 'arrive', childIdeaRight: false }
    };
  }

  // 3. Stage: conjecture
  if (phase === 'conjecture') {
    if (normPersona === 'prodigy') {
      return {
        action: {
          type: 'conjecture',
          stem: 'notice',
          value: meta.targetAnswer,
          reason: meta.conjectureJustification
        },
        annotation: { phase: 'conjecture', childIdeaRight: true, solvedShortcut: true }
      };
    }

    // For multi-part subsequent parts (b, c), students who solved earlier parts advance with justified intuition
    if (currentPartId !== 'a') {
      return {
        action: {
          type: 'conjecture',
          stem: 'notice',
          value: meta.targetAnswer,
          reason: meta.conjectureJustification
        },
        annotation: { phase: 'conjecture', childIdeaRight: true, solvedShortcut: true }
      };
    }

    if (normPersona === 'caver') {
      const alreadyAttempted = history.some(h => h.action?.type === 'conjecture' && h.action?.stem === 'what_if');
      if (!alreadyAttempted) {
        // States right idea tentatively (< 3 words triggers skeptic prompt)
        return {
          action: {
            type: 'conjecture',
            stem: 'what_if',
            value: meta.targetAnswer,
            reason: 'maybe backwards?'
          },
          annotation: { phase: 'conjecture', childIdeaRight: true, tentative: true }
        };
      }
      // When prompted constructively ("Convince me in one sentence"), Caver gains confidence and elaborates
      return {
        action: {
          type: 'conjecture',
          stem: 'notice',
          value: meta.targetAnswer,
          reason: meta.conjectureJustification
        },
        annotation: { phase: 'conjecture', childIdeaRight: true, solvedShortcut: true }
      };
    }

    if (normPersona === 'misconception') {
      return {
        action: {
          type: 'conjecture',
          stem: 'think',
          value: meta.misconceptionVal,
          reason: 'Because intuitive pattern always adds directly.'
        },
        annotation: { phase: 'conjecture', childIdeaRight: false, misconception: true }
      };
    }

    if (normPersona === 'extractor') {
      return {
        action: {
          type: 'conjecture',
          stem: 'think',
          value: 10,
          reason: 'Is 6 or 11 the answer?'
        },
        annotation: { phase: 'conjecture', childIdeaRight: false }
      };
    }

    if (normPersona === 'silent') {
      return {
        action: { type: 'skip_conjecture' },
        annotation: { phase: 'conjecture', childIdeaRight: false, silent: true }
      };
    }

    // Impulsive default
    return {
      action: {
        type: 'conjecture',
        stem: 'think',
        value: 99,
        reason: 'guess'
      },
      annotation: { phase: 'conjecture', childIdeaRight: false, impulsive: true }
    };
  }

  // 4. Stage: understand
  if (phase === 'understand') {
    if (normPersona === 'caver') {
      const caveTurns = history.filter(h => h.action?.type === 'say' && /sorry|never mind|wrong/i.test(h.action?.text || '')).length;
      if (caveTurns === 0) {
        return {
          action: { type: 'say', text: 'Oh sorry never mind that was wrong maybe we just add them?' },
          annotation: { phase: 'understand', childIdeaRight: false, caved: true }
        };
      }
      const chip = view.availableChips?.[0] || 'Find what we know';
      return {
        action: { type: 'chip', chip, text: chip },
        annotation: { phase: 'understand', childIdeaRight: false }
      };
    }

    if (normPersona === 'extractor') {
      const extractTurns = history.filter(h => h.action?.type === 'say' && /tell me the answer/i.test(h.action?.text || '')).length;
      if (extractTurns === 0) {
        return {
          action: { type: 'say', text: 'Can you just tell me the answer so we can finish?' },
          annotation: { phase: 'understand', childIdeaRight: false, extractAttempt: true }
        };
      }
      const chip = view.availableChips?.[0] || 'tell me';
      return {
        action: { type: 'chip', chip, text: chip },
        annotation: { phase: 'understand', childIdeaRight: false }
      };
    }

    if (normPersona === 'silent') {
      const chip = view.availableChips?.[0] || 'coins';
      return {
        action: { type: 'chip', chip, text: chip },
        annotation: { phase: 'understand', childIdeaRight: false, silent: true }
      };
    }

    if (normPersona === 'misconception') {
      return {
        action: { type: 'say', text: `I still think the answer is ${meta.misconceptionVal}!` },
        annotation: { phase: 'understand', childIdeaRight: false, defendMisconception: true }
      };
    }

    // Impulsive / Default
    const chip = view.availableChips?.[0];
    if (chip) {
      return {
        action: { type: 'chip', chip, text: chip },
        annotation: { phase: 'understand', childIdeaRight: false }
      };
    }
    return {
      action: { type: 'say', text: 'What do I click now?' },
      annotation: { phase: 'understand', childIdeaRight: false }
    };
  }

  // 5. Stage: plan
  if (phase === 'plan') {
    const cardId = meta.cardId || (typeof view.availableCards?.[0] === 'string' ? view.availableCards[0] : view.availableCards?.[0]?.id) || 'work-backwards';
    return {
      action: { type: 'card', cardId },
      annotation: { phase: 'plan', childIdeaRight: true }
    };
  }

  // 6. Stage: simpler_problem sub-loop
  if (phase === 'simpler_problem') {
    return {
      action: { type: 'simpler_submit', value: 3 },
      annotation: { phase: 'simpler_problem', childIdeaRight: true }
    };
  }

  // 7. Stage: carry_out
  if (phase === 'carry_out') {
    if (normPersona === 'silent') {
      const stuckCount = history.filter(h => h.action?.type === 'stuck').length;
      if (stuckCount === 0) {
        return {
          action: { type: 'stuck' },
          annotation: { phase: 'carry_out', childIdeaRight: false, stuck: true }
        };
      }
      return {
        action: { type: 'submit', value: meta.targetAnswer },
        annotation: { phase: 'carry_out', childIdeaRight: true, finalSubmit: true }
      };
    }

    if (normPersona === 'extractor') {
      const extractCount = history.filter(h => h.action?.type === 'say' && /parent|confirm|tell/i.test(h.action?.text || '')).length;
      if (extractCount <= 1) {
        return {
          action: { type: 'say', text: `My parent said it's ${meta.targetAnswer}, is that right?` },
          annotation: { phase: 'carry_out', childIdeaRight: false, extractAttempt: true }
        };
      }
      return {
        action: { type: 'submit', value: meta.targetAnswer },
        annotation: { phase: 'carry_out', childIdeaRight: true, finalSubmit: true }
      };
    }

    if (normPersona === 'impulsive') {
      const rushCount = history.filter(h => h.action?.type === 'submit' && h.action?.value === 99).length;
      if (rushCount === 0) {
        return {
          action: { type: 'submit', value: 99 },
          annotation: { phase: 'carry_out', childIdeaRight: false, rushSubmit: true }
        };
      }
      return {
        action: { type: 'submit', value: meta.targetAnswer },
        annotation: { phase: 'carry_out', childIdeaRight: true, finalSubmit: true }
      };
    }

    // Default step or submit
    return {
      action: { type: 'submit', value: meta.targetAnswer },
      annotation: { phase: 'carry_out', childIdeaRight: true, finalSubmit: true }
    };
  }

  // 8. Stage: submit (if routed here directly)
  if (phase === 'submit') {
    return {
      action: { type: 'submit', value: meta.targetAnswer },
      annotation: { phase: 'submit', childIdeaRight: true }
    };
  }

  // 9. Stage: look_back
  if (phase === 'look_back') {
    const opt = view.lookBackOptions?.[0] || { kind: 'verify' };
    const checkVal = meta.lookBackCheck?.[opt.kind] ?? meta.lookBackCheck?.verify ?? meta.lookBackCheck?.perturb ?? meta.targetAnswer;
    return {
      action: {
        type: 'lookback',
        kind: opt.kind,
        value: checkVal,
        reason: 'Verified through calculation'
      },
      annotation: { phase: 'look_back', childIdeaRight: true, lookBackComplete: true }
    };
  }

  // Default fallback action
  return {
    action: { type: 'stuck' },
    annotation: { phase: phase || 'unknown', childIdeaRight: false }
  };
}
