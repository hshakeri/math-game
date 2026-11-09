/**
 * Castle of Theorems v1 (Home Edition)
 * Pure Synchronous 8-Stage Leak Gate (< 5ms)
 * Implements SPEC §7
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pre-load rules
const rulesPath = path.resolve(__dirname, 'leakGate.rules.json');
let CONSTRUCTION_RULES = [];
if (fs.existsSync(rulesPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    CONSTRUCTION_RULES = (raw.rules || []).map(r => ({
      name: r.name,
      regex: new RegExp(r.pattern, 'i')
    }));
  } catch (e) {
    // fallback if JSON unreadable
  }
}

// Stage 6: Praise Lexicon (16 forbidden words/phrases)
export const PRAISE_PATTERNS = [
  { pattern: /\bgreat\b/i, name: 'great' },
  { pattern: /\bbrilliant\b/i, name: 'brilliant' },
  { pattern: /\bexactly\b/i, name: 'exactly' },
  { pattern: /\bcorrect\b/i, name: 'correct' },
  { pattern: /\bright\s*!/i, name: 'right!' },
  { pattern: /\bwell\s+done\b/i, name: 'well done' },
  { pattern: /\bnice\s+(?:job|work|thinking)\b/i, name: 'nice job/work/thinking' },
  { pattern: /\bperfect\b/i, name: 'perfect' },
  { pattern: /\bawesome\b/i, name: 'awesome' },
  { pattern: /\bspot\s+on\b/i, name: 'spot on' },
  { pattern: /\byou\s+got\s+it\b/i, name: 'you got it' },
  { pattern: /\bgood\s+job\b/i, name: 'good job' },
  { pattern: /\bthat['’]?s\s+it\b/i, name: "that's it" },
  { pattern: /\bclose\s*!/i, name: 'close!' },
  { pattern: /\bnot\s+quite\b/i, name: 'not quite' },
  { pattern: /\balmost\b/i, name: 'almost' }
];

// Stage 8: Banned operations at l0/l1
export const BANNED_OPS_L0_L1 = /\b(?:add|subtract|multiply|divide|double|halve|plus|minus|times)\b/i;

// Number dictionaries
export const ONES_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19
};

export const TENS_WORDS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
};

export const HUNDREDS_WORDS = {
  hundred: 100, hundreds: 100
};

export const CARDINAL_WORDS = {
  ...ONES_WORDS,
  ...TENS_WORDS,
  ...HUNDREDS_WORDS
};

export const ORDINALS = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9,
  tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
  sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19,
  twentieth: 20, thirtieth: 30, fortieth: 40, fiftieth: 50, sixtieth: 60, seventieth: 70,
  eightieth: 80, ninetieth: 90, hundredth: 100
};

export const FRACTIONS = {
  half: 0.5, halves: 0.5, quarter: 0.25, quarters: 0.25
};

/**
 * Extracts all numeric values from text without overlapping span errors.
 * @param {string} text
 * @returns {Array<{ value: number, raw: string, start: number, end: number }>}
 */
export function extractNumbers(text) {
  const results = [];
  if (!text || typeof text !== 'string') return results;

  const lower = text.toLowerCase();
  const coveredRanges = [];

  function isCovered(start, end) {
    return coveredRanges.some(r => (start >= r.start && start < r.end) || (end > r.start && end <= r.end));
  }

  function addMatch(value, raw, start, end) {
    if (!isCovered(start, end)) {
      results.push({ value, raw, start, end });
      coveredRanges.push({ start, end });
    }
  }

  // 1. Fractions like 3/4
  const fractionRegex = /\b(\d+)\s*\/\s*(\d+)\b/g;
  let match;
  while ((match = fractionRegex.exec(lower)) !== null) {
    const den = parseInt(match[2], 10);
    if (den !== 0) {
      addMatch(parseInt(match[1], 10) / den, match[0], match.index, match.index + match[0].length);
    }
  }

  // 2. Digit ordinals (1st, 2nd, 3rd, 4th, 24th, etc.)
  const ordDigitRegex = /\b(\d+)(?:st|nd|rd|th)\b/g;
  while ((match = ordDigitRegex.exec(lower)) !== null) {
    addMatch(parseInt(match[1], 10), match[0], match.index, match.index + match[0].length);
  }

  // 3. Digits and decimals (e.g. 13, 6, 2.5)
  const digitRegex = /\b(\d+(?:\.\d+)?)\b/g;
  while ((match = digitRegex.exec(lower)) !== null) {
    addMatch(parseFloat(match[1]), match[1], match.index, match.index + match[1].length);
  }

  // 4. "a dozen" / "dozen"
  const dozenRegex = /\b(?:a\s+)?dozens?\b/g;
  while ((match = dozenRegex.exec(lower)) !== null) {
    addMatch(12, match[0], match.index, match.index + match[0].length);
  }

  // 4b. Cardinal "hundred", "hundreds", "one hundred", "a hundred", "one hundredth"
  const hundredRegex = /\b(?:(?:one|a)[\s-]+)?(?:hundreds?|hundredth)\b/gi;
  while ((match = hundredRegex.exec(lower)) !== null) {
    addMatch(100, match[0], match.index, match.index + match[0].length);
  }

  // 5. Compound word numbers (e.g. twenty-four, thirty-four, eighty-five, twenty-fourth)
  // Handles variable whitespace, hyphens, and combinations like 'twenty - four', 'twenty  four'
  const compoundRegex = /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-]+)(one|two|three|four|five|six|seven|eight|nine|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)\b/gi;
  while ((match = compoundRegex.exec(lower)) !== null) {
    const tens = TENS_WORDS[match[1].toLowerCase()] ?? TENS_WORDS[match[1]];
    const unitKey = match[2].toLowerCase();
    const unit = ONES_WORDS[unitKey] ?? ORDINALS[unitKey] ?? 0;
    addMatch(tens + unit, match[0], match.index, match.index + match[0].length);
  }

  // 6. Single-word numbers and ordinals
  for (const [word, val] of Object.entries(ONES_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    while ((match = regex.exec(lower)) !== null) {
      addMatch(val, match[0], match.index, match.index + match[0].length);
    }
  }

  for (const [word, val] of Object.entries(TENS_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    while ((match = regex.exec(lower)) !== null) {
      addMatch(val, match[0], match.index, match.index + match[0].length);
    }
  }

  for (const [word, val] of Object.entries(HUNDREDS_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    while ((match = regex.exec(lower)) !== null) {
      addMatch(val, match[0], match.index, match.index + match[0].length);
    }
  }

  for (const [word, val] of Object.entries(ORDINALS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    while ((match = regex.exec(lower)) !== null) {
      addMatch(val, match[0], match.index, match.index + match[0].length);
    }
  }

  for (const [word, val] of Object.entries(FRACTIONS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    while ((match = regex.exec(lower)) !== null) {
      addMatch(val, match[0], match.index, match.index + match[0].length);
    }
  }

  return results;
}

/**
 * Checks if a token at [numStart, numEnd] in trimmed text is inside an exact verbatim quote of inscription >= 12 chars.
 */
export function isInsideQuotedInscription(trimmed, numStart, numEnd, inscription) {
  if (!inscription || inscription.length < 12) return false;
  const tokenLen = numEnd - numStart;
  const minLen = Math.max(12, tokenLen);
  for (let len = minLen; len <= Math.min(trimmed.length, 120); len++) {
    const minI = Math.max(0, numEnd - len);
    const maxI = Math.min(numStart, trimmed.length - len);
    for (let i = minI; i <= maxI; i++) {
      const slice = trimmed.slice(i, i + len);
      if (inscription.includes(slice)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks an utterance against all 8 stages of the leak gate.
 * Synchronous and pure, guaranteed execution < 5ms.
 *
 * @param {string} text - Candidate utterance
 * @param {object} context - { rung, forbidden, givens, inscription, hintText, targetAnswer }
 * @param {object} [options] - { minLen: 40, maxLen: 300 }
 * @returns {{ allowed: boolean, stage?: number, reason?: string, detail?: string }}
 */
export function checkUtterance(text, context = {}, options = {}) {
  if (typeof text !== 'string') {
    return { allowed: false, stage: 1, reason: 'length', detail: 'Utterance is not a string' };
  }

  const trimmed = text.trim();
  const minLen = options.minLen ?? 40;
  const maxLen = options.maxLen ?? 300;

  // -------------------------------------------------------------------------
  // STAGE 1: Length check (40-300 characters, or 150-300 if strict tutor mode)
  // -------------------------------------------------------------------------
  if (trimmed.length < minLen || trimmed.length > maxLen) {
    return {
      allowed: false,
      stage: 1,
      reason: 'length',
      detail: `Length ${trimmed.length} is outside allowed bounds [${minLen}, ${maxLen}]`
    };
  }

  // -------------------------------------------------------------------------
  // STAGE 2: Shape check (must end with single '?', no lists, no emoji)
  // -------------------------------------------------------------------------
  if (!trimmed.endsWith('?')) {
    return {
      allowed: false,
      stage: 2,
      reason: 'shape',
      detail: `Must end with a question mark: "${trimmed.slice(-30)}"`
    };
  }

  const qMarks = (trimmed.match(/\?/g) || []).length;
  if (qMarks !== 1) {
    return {
      allowed: false,
      stage: 2,
      reason: 'shape',
      detail: `Must contain exactly one question mark, found ${qMarks}`
    };
  }

  // Bullet or numbered list markers
  if (/^\s*[-*•]\s+/m.test(trimmed) || /^\s*\d+[\.\)]\s+/m.test(trimmed)) {
    return {
      allowed: false,
      stage: 2,
      reason: 'shape',
      detail: 'Utterance contains list markers'
    };
  }

  // Emoji check
  if (/\p{Extended_Pictographic}/u.test(trimmed)) {
    return {
      allowed: false,
      stage: 2,
      reason: 'shape',
      detail: 'Utterance contains emoji'
    };
  }

  // -------------------------------------------------------------------------
  // STAGE 3: Numeric extraction
  // -------------------------------------------------------------------------
  const extracted = extractNumbers(trimmed);

  // -------------------------------------------------------------------------
  // STAGE 4: Forbidden check (forbidden list + target answer)
  // -------------------------------------------------------------------------
  const forbiddenList = [...(context.forbidden || [])];
  if (context.targetAnswer !== undefined) {
    const tVal = typeof context.targetAnswer === 'object' && context.targetAnswer !== null && context.targetAnswer.value !== undefined
      ? context.targetAnswer.value
      : context.targetAnswer;
    if (typeof tVal === 'number' && !forbiddenList.includes(tVal)) {
      forbiddenList.push(tVal);
    }
  }

  const givens = context.givens || [];
  const inscription = context.inscription || '';

  for (const num of extracted) {
    for (const fVal of forbiddenList) {
      if (Math.abs(num.value - fVal) < 0.001) {
        // Quoted Inscription Exception:
        // Allowed ONLY if in givens AND appears inside an exact verbatim quote of the inscription >= 12 chars
        let allowedByQuote = false;
        if (givens.includes(fVal)) {
          allowedByQuote = isInsideQuotedInscription(trimmed, num.start, num.end, inscription);
        }

        if (!allowedByQuote) {
          return {
            allowed: false,
            stage: 4,
            reason: 'forbidden',
            detail: `Contains forbidden value ${fVal} ('${num.raw}')`
          };
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // STAGE 5: Regex rules (Answer constructions, equations, answer reveals)
  // -------------------------------------------------------------------------
  for (const rule of CONSTRUCTION_RULES) {
    if (rule.regex.test(trimmed)) {
      return {
        allowed: false,
        stage: 5,
        reason: 'construction',
        detail: `Matched construction rule '${rule.name}'`
      };
    }
  }

  // -------------------------------------------------------------------------
  // STAGE 6: Praise lexicon check (Evaluation leakage)
  // -------------------------------------------------------------------------
  for (const { pattern, name } of PRAISE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        stage: 6,
        reason: 'praise',
        detail: `Contains praise word/phrase '${name}'`
      };
    }
  }

  // -------------------------------------------------------------------------
  // STAGE 7: Rung ceiling
  // -------------------------------------------------------------------------
  const rung = context.rung || 'l0';
  if (rung === 'l0' || rung === 'l1') {
    // Zero digits allowed at l0 and l1
    const digitMatch = trimmed.match(/[0-9]/);
    if (digitMatch) {
      return {
        allowed: false,
        stage: 7,
        reason: 'rung',
        detail: `Forbidden digit '${digitMatch[0]}' at rung ${rung}`
      };
    }
  } else if (rung === 'l2' || rung === 'l3') {
    // At l2 and l3, digits allowed only if in givens or hintText
    const hintText = context.hintText || '';
    for (const num of extracted) {
      if (/\d/.test(num.raw)) {
        const inGivens = givens.includes(num.value);
        const inHint = hintText.includes(num.raw);
        if (!inGivens && !inHint) {
          return {
            allowed: false,
            stage: 7,
            reason: 'rung',
            detail: `Digit '${num.raw}' not permitted in givens or hintText at rung ${rung}`
          };
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // STAGE 8: Banned operations at l0/l1
  // -------------------------------------------------------------------------
  if (rung === 'l0' || rung === 'l1') {
    const opMatch = trimmed.match(BANNED_OPS_L0_L1);
    if (opMatch) {
      return {
        allowed: false,
        stage: 8,
        reason: 'banned_operation',
        detail: `Operation '${opMatch[0]}' is banned at rung ${rung}`
      };
    }
  }

  return { allowed: true };
}
