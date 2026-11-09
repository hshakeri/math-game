#!/usr/bin/env node
/**
 * Castle of Theorems v1 (Home Edition)
 * Content Validation Pipeline & Mechanics Replay Simulator
 *
 * Implements SPEC §5, §7, §10:
 * - JSON Schema validation against content/schema.json
 * - String length (40-300 chars) on all probes, hints, and narratives; inscription 40-600 chars
 * - Punctuation check (probes end with exactly one '?')
 * - Praise lexicon ban (no eval leakage words in authored dialogue/probes/hints/narrative)
 * - Rung l0/l1 digit ban
 * - Rung l2/l3 forbidden tokens check (expanded 1-100 word forms)
 * - Flesch-Kincaid reading level (warning only, enabled via options.checkReadingLevel or --reading-level)
 * - Dark Vault c/12 collision detection (warning only)
 * - Mechanics replay self-test against server/engine/mechanics/*.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// 1. Lexicons & Expander Constants
// ---------------------------------------------------------------------------

const PRAISE_PATTERNS = [
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

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ONES_ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth',
  'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth'];
const TENS_ORD = ['', '', 'twentieth', 'thirtieth', 'fortieth', 'fiftieth', 'sixtieth', 'seventieth', 'eightieth', 'ninetieth'];

function getOrdinalSuffix(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export function expandForbiddenNumber(num) {
  const tokens = new Set();
  const n = Math.floor(num);
  tokens.add(String(n));
  tokens.add(`${n}${getOrdinalSuffix(n)}`);

  if (n === 12) {
    tokens.add('a dozen');
    tokens.add('dozen');
    tokens.add('dozens');
  }

  if (n >= 1 && n <= 19) {
    tokens.add(ONES[n]);
    tokens.add(ONES_ORD[n]);
  } else if (n >= 20 && n <= 99) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    if (ones === 0) {
      tokens.add(TENS[tens]);
      tokens.add(TENS_ORD[tens]);
    } else {
      tokens.add(`${TENS[tens]}-${ONES[ones]}`);
      tokens.add(`${TENS[tens]} ${ONES[ones]}`);
      tokens.add(`${TENS[tens]}-${ONES_ORD[ones]}`);
      tokens.add(`${TENS[tens]} ${ONES_ORD[ones]}`);
    }
  } else if (n === 100) {
    tokens.add('hundred');
    tokens.add('one hundred');
    tokens.add('hundredth');
    tokens.add('one hundredth');
  }

  return Array.from(tokens);
}

// ---------------------------------------------------------------------------
// 2. Flesch-Kincaid Reading Level Calculator
// ---------------------------------------------------------------------------

export function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;

  let clean = w;
  if (clean.endsWith('e') && !clean.endsWith('le')) {
    clean = clean.slice(0, -1);
  }
  if (clean.endsWith('ed') && !/(?:[td])ed$/.test(clean)) {
    clean = clean.slice(0, -2);
  }
  if (clean.endsWith('es') && !/(?:[szx]|ch|sh)es$/.test(clean)) {
    clean = clean.slice(0, -2);
  }

  const vowelGroups = clean.match(/[aeiouy]+/g);
  return Math.max(1, vowelGroups ? vowelGroups.length : 1);
}

export function calculateFleschKincaid(text) {
  if (!text || typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;

  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);

  const words = trimmed.match(/\b[a-zA-Z]+(?:'[a-zA-Z]+)?\b/g) || [];
  if (words.length === 0) return 0;
  const wordCount = words.length;

  let totalSyllables = 0;
  for (const word of words) {
    totalSyllables += countSyllables(word);
  }

  const fkgl = 0.39 * (wordCount / sentenceCount) + 11.8 * (totalSyllables / wordCount) - 15.59;
  return Math.max(0, fkgl);
}

// ---------------------------------------------------------------------------
// 3. Lightweight Zero-Dependency JSON Schema Validator
// ---------------------------------------------------------------------------

export function validateSchema(data, schema, rootSchema = schema, path = '$') {
  const errors = [];

  if (schema.$ref) {
    const refKey = schema.$ref.replace(/^#\/(?:\$defs|definitions)\//, '');
    const targetSchema = (rootSchema.$defs && rootSchema.$defs[refKey]) ||
                         (rootSchema.definitions && rootSchema.definitions[refKey]);
    if (!targetSchema) {
      errors.push({ path, message: `Unresolved schema $ref: ${schema.$ref}` });
      return errors;
    }
    return validateSchema(data, targetSchema, rootSchema, path);
  }

  if (schema.oneOf) {
    let matchCount = 0;
    for (const subSchema of schema.oneOf) {
      const subErrors = validateSchema(data, subSchema, rootSchema, path);
      if (subErrors.length === 0) matchCount++;
    }
    if (matchCount !== 1) {
      errors.push({ path, message: `Expected exactly oneOf matching variant, found ${matchCount}` });
    }
    return errors;
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data;
    const typeMatches = types.some(t => {
      if (t === 'integer') return typeof data === 'number' && Number.isInteger(data);
      if (t === 'number') return typeof data === 'number';
      return t === actualType;
    });

    if (!typeMatches) {
      errors.push({ path, message: `Expected type ${types.join('|')}, got ${actualType}` });
      return errors;
    }
  }

  if (schema.enum && !schema.enum.includes(data)) {
    errors.push({ path, message: `Value must be one of enum [${schema.enum.join(', ')}], got ${JSON.stringify(data)}` });
  }

  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({ path, message: `Number ${data} is less than minimum ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({ path, message: `Number ${data} is greater than maximum ${schema.maximum}` });
    }
  }

  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({ path, message: `String length ${data.length} is less than minLength ${schema.minLength}` });
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({ path, message: `String length ${data.length} exceeds maxLength ${schema.maxLength}` });
    }
  }

  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push({ path, message: `Array items count ${data.length} is less than minItems ${schema.minItems}` });
    }
    if (schema.items) {
      data.forEach((item, index) => {
        errors.push(...validateSchema(item, schema.items, rootSchema, `${path}[${index}]`));
      });
    }
  }

  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    if (schema.required) {
      for (const reqKey of schema.required) {
        if (!(reqKey in data)) {
          errors.push({ path, message: `Missing required property '${reqKey}'` });
        }
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          errors.push(...validateSchema(data[key], propSchema, rootSchema, `${path}.${key}`));
        }
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(data)) {
        if (!allowed.has(key)) {
          errors.push({ path, message: `Property '${key}' is not allowed by schema` });
        }
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// 4. Semantic Validation Engine
// ---------------------------------------------------------------------------

export async function validateEncounter(encounter, options = {}) {
  const errors = [];
  const warnings = [];

  const addError = (field, message) => errors.push({ field, message });
  const addWarning = (field, message) => warnings.push({ field, message });

  // 1. JSON Schema validation
  if (options.schema) {
    const schemaErrors = validateSchema(encounter, options.schema);
    for (const err of schemaErrors) {
      addError(err.path, `Schema error: ${err.message}`);
    }
  }

  // 2. Deck cards subset check
  const validCards = options.deckCards || ['work-backwards', 'worst-case', 'tiny-case', 'draw-it', 'odd-or-even', 'find-what-is-shared', 'odd-even', 'find-shared'];
  if (Array.isArray(encounter.cards)) {
    for (const card of encounter.cards) {
      if (!validCards.includes(card)) {
        addError('cards', `Card '${card}' is not in the Deck cards list [${validCards.join(', ')}]`);
      }
    }
  }

  // 3. Look Back structure
  if (Array.isArray(encounter.lookBack)) {
    if (encounter.lookBack.length < 2) {
      addError('lookBack', `Look Back must have at least 2 options, found ${encounter.lookBack.length}`);
    }
    const kinds = new Set(encounter.lookBack.map(opt => opt.kind));
    if (kinds.size < 2) {
      addError('lookBack', `Look Back options must cover at least 2 distinct kinds, found ${kinds.size}`);
    }
    encounter.lookBack.forEach((opt, idx) => {
      checkString(opt.prompt, `lookBack[${idx}].prompt`, { min: 40, max: 300, isProbe: true });
    });
  }

  // Helper string validation runner
  function checkString(text, fieldName, { min = 40, max = 300, isProbe = false, allowDigits = true, forbiddenNumbers = [], checkPraise = true } = {}) {
    if (typeof text !== 'string') return;
    const trimmed = text.trim();

    // Length check
    if (trimmed.length < min) {
      addError(fieldName, `Length (${trimmed.length}) is below minimum of ${min} chars: "${trimmed}"`);
    } else if (trimmed.length > max) {
      addError(fieldName, `Length (${trimmed.length}) exceeds maximum of ${max} chars: "${trimmed}"`);
    }

    // Punctuation check for probes
    if (isProbe) {
      if (!trimmed.endsWith('?')) {
        addError(fieldName, `Probe must end with a single '?': "${trimmed.slice(-30)}"`);
      } else if (trimmed.endsWith('??')) {
        addError(fieldName, `Probe must not end with multiple '?': "${trimmed.slice(-30)}"`);
      }
    }

    // Praise lexicon ban
    if (checkPraise) {
      for (const { pattern, name } of PRAISE_PATTERNS) {
        if (pattern.test(trimmed)) {
          addError(fieldName, `Contains forbidden praise lexicon word/phrase '${name}': "${trimmed}"`);
        }
      }
    }

    // Digit ban (l0/l1)
    if (!allowDigits) {
      const digitMatch = trimmed.match(/[0-9]/);
      if (digitMatch) {
        addError(fieldName, `Forbidden digit '${digitMatch[0]}' at l0/l1: "${trimmed}"`);
      }
    }

    // Forbidden tokens (l2/l3)
    if (forbiddenNumbers && forbiddenNumbers.length > 0) {
      for (const num of forbiddenNumbers) {
        const tokens = expandForbiddenNumber(num);
        for (const token of tokens) {
          let escaped = token.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
          let regex;
          if (/^[0-9]+[a-z]*$/i.test(token)) {
            regex = new RegExp(`(?:^|[^0-9a-zA-Z])${escaped}(?:$|[^0-9a-zA-Z])`, 'i');
          } else if (token.includes(' ')) {
            regex = new RegExp(`\\b${escaped.replace(/\\s\+/g, '\\s+')}\\b`, 'i');
          } else {
            regex = new RegExp(`\\b${escaped}\\b`, 'i');
          }

          if (regex.test(trimmed)) {
            addError(fieldName, `Contains forbidden token '${token}' for value ${num}: "${trimmed}"`);
          }
        }
      }
    }

    // Flesch-Kincaid warning (when requested)
    if (options.checkReadingLevel) {
      const fkgl = calculateFleschKincaid(trimmed);
      if (fkgl > 4.0) {
        addWarning(fieldName, `Flesch-Kincaid grade level ${fkgl.toFixed(1)} exceeds target 4.0: "${trimmed.slice(0, 40)}..."`);
      }
    }
  }

  // 4. Narrative & Inscription
  if (encounter.narrative) {
    checkString(encounter.narrative.arrival, 'narrative.arrival', { min: 40, max: 300 });
    checkString(encounter.narrative.sealed, 'narrative.sealed', { min: 40, max: 300 });
  }
  checkString(encounter.inscription, 'inscription', { min: 40, max: 600, checkPraise: false });
  if (encounter.id === 'ch1-n2-dark-vault' && typeof encounter.inscription === 'string') {
    const paragraphs = encounter.inscription.split(/\r?\n\s*\r?\n/).map(text => text.trim());
    if (paragraphs.length !== 2 || paragraphs.some(text => !text)) {
      addError('inscription', 'Dark Vault must have exactly two public story paragraphs: the chest, then the draw rules.');
    }
  }

  // 5. Parts validation
  if (Array.isArray(encounter.parts)) {
    encounter.parts.forEach((part, pIdx) => {
      const pPath = `parts[${part.id || pIdx}]`;
      checkString(part.prompt, `${pPath}.prompt`, { min: 40, max: 300 });

      // Collision checks
      if (Array.isArray(part.forbidden) && Array.isArray(encounter.givens)) {
        for (const num of part.forbidden) {
          if (encounter.givens.includes(num)) {
            if (encounter.id === 'ch1-n2-dark-vault' && part.id === 'c' && num === 12) {
              addWarning(`${pPath}.forbidden`, `Documented collision: value 12 is in both givens and forbidden for Dark Vault part c (verified text avoids '12'/'twelve').`);
            } else {
              addWarning(`${pPath}.forbidden`, `Collision detected: value ${num} is in both givens and forbidden for part ${part.id}.`);
            }
          }
        }
      }

      // Misconceptions
      if (Array.isArray(part.misconceptions)) {
        const last = part.misconceptions[part.misconceptions.length - 1];
        if (!last || last.match !== 'any-wrong') {
          addError(`${pPath}.misconceptions`, `Misconceptions table must end with match: 'any-wrong'`);
        }
        part.misconceptions.forEach((m, mIdx) => {
          checkString(m.probe, `${pPath}.misconceptions[${mIdx}].probe`, {
            min: 40,
            max: 300,
            isProbe: true,
            allowDigits: m.startLevel > 1
          });
        });
      }

      // Ladder checks
      if (part.ladder) {
        if (Array.isArray(part.ladder.l0)) {
          if (part.ladder.l0.length < 3) addError(`${pPath}.ladder.l0`, `l0 must contain at least 3 probes`);
          part.ladder.l0.forEach((p, idx) => checkString(p, `${pPath}.ladder.l0[${idx}]`, { min: 40, max: 300, isProbe: true, allowDigits: false }));
        }
        if (Array.isArray(part.ladder.l1)) {
          if (part.ladder.l1.length < 3) addError(`${pPath}.ladder.l1`, `l1 must contain at least 3 probes`);
          part.ladder.l1.forEach((p, idx) => checkString(p, `${pPath}.ladder.l1[${idx}]`, { min: 40, max: 300, isProbe: true, allowDigits: false }));
        }
        if (part.ladder.l2) {
          checkString(part.ladder.l2.text, `${pPath}.ladder.l2.text`, { min: 40, max: 300, forbiddenNumbers: part.forbidden });
        }
        if (part.ladder.l3) {
          checkString(part.ladder.l3.text, `${pPath}.ladder.l3.text`, { min: 40, max: 300, forbiddenNumbers: part.forbidden });
        }
        if (part.ladder.l4) {
          checkString(part.ladder.l4.statement, `${pPath}.ladder.l4.statement`, { min: 40, max: 300, isProbe: true });
          checkString(part.ladder.l4.l3, `${pPath}.ladder.l4.l3`, { min: 40, max: 300 });
        }
      }

      // Chips check
      if (part.chips && Array.isArray(part.chips.understand)) {
        part.chips.understand.forEach((chip, cIdx) => checkString(chip, `${pPath}.chips.understand[${cIdx}]`, { min: 10, max: 150 }));
      }
    });
  }

  // 6. Mechanics Replay Self-Test
  if (options.runMechanics && Array.isArray(encounter.parts)) {
    for (const part of encounter.parts) {
      if (part.mechanic && part.mechanic.kind) {
        const replayResult = await replayMechanic(part.mechanic, part, encounter);
        if (!replayResult.success) {
          addError(`parts[${part.id}].mechanic`, `Mechanics replay failed: ${replayResult.error}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// 5. Mechanics Replay Simulator
// ---------------------------------------------------------------------------

export async function replayMechanic(mechanicSpec, part, encounter) {
  const kind = mechanicSpec.kind;
  const modulePath = path.resolve(PROJECT_ROOT, `server/engine/mechanics/${kind}.js`);

  if (!fs.existsSync(modulePath)) {
    return { success: false, error: `Mechanic module not found at server/engine/mechanics/${kind}.js` };
  }

  try {
    const mod = await import(pathToFileURL(modulePath).href);
    if (typeof mod.init !== 'function' || typeof mod.checkStep !== 'function' ||
        typeof mod.isComplete !== 'function' || typeof mod.finalValue !== 'function') {
      return { success: false, error: `Module ${kind}.js does not export required functions init, checkStep, isComplete, finalValue` };
    }

    let state = mod.init(mechanicSpec);

    if (kind === 'inverse-chain') {
      const intermediates = part.intermediates.map(i => i.value); // [11, 7, 6]
      const gates = mechanicSpec.gates;
      for (let i = gates.length - 1; i >= 0; i--) {
        const stepOrder = mod.checkStep(state, { action: 'order', gateIndex: i, order: ['add', 'div'] });
        if (!stepOrder.valid) return { success: false, error: `Invalid order step at gate ${i}` };
        state = stepOrder.state;

        const val = intermediates[gates.length - 1 - i];
        const stepVal = mod.checkStep(state, { action: 'value', gateIndex: i, value: val });
        if (!stepVal.valid) return { success: false, error: `Invalid value step at gate ${i} for value ${val}` };
        state = stepVal.state;
      }
    } else if (kind === 'goblin-bins') {
      if (part.id === 'a') {
        for (let b = 0; b < 3; b++) {
          const step = mod.checkStep(state, { action: 'place', bin: b });
          if (!step.valid) return { success: false, error: `Failed placement in bin ${b}` };
          state = step.state;
        }
      } else if (part.id === 'b') {
        for (let b = 0; b < 3; b++) {
          for (let count = 0; count < 3; count++) {
            const step = mod.checkStep(state, { action: 'place', bin: b });
            if (!step.valid) return { success: false, error: `Failed placement in bin ${b}` };
            state = step.state;
          }
        }
      } else if (part.id === 'c') {
        for (let count = 0; count < 12; count++) {
          const step = mod.checkStep(state, { action: 'place', bin: 0 });
          if (!step.valid) return { success: false, error: `Failed placement in bin 0` };
          state = step.state;
        }
      }
      const submitStep = mod.checkStep(state, { action: 'submit_count', value: part.answer.value });
      if (!submitStep.valid) return { success: false, error: `Failed count submit ${part.answer.value}` };
      state = submitStep.state;
    } else if (kind === 'seam-grid') {
      const step1 = mod.checkStep(state, { action: 'set_units', short: 2, long: 3 });
      if (!step1.valid) return { success: false, error: `Failed set_units` };
      state = step1.state;

      const step2 = mod.checkStep(state, { action: 'outer_units', value: 22 });
      if (!step2.valid) return { success: false, error: `Failed outer_units` };
      state = step2.state;

      const step3 = mod.checkStep(state, { action: 'cubits_per_unit', value: 3 });
      if (!step3.valid) return { success: false, error: `Failed cubits_per_unit` };
      state = step3.state;

      const step4 = mod.checkStep(state, { action: 'shield_perimeter', value: 30 });
      if (!step4.valid) return { success: false, error: `Failed shield_perimeter` };
      state = step4.state;
    } else if (kind === 'factor-dials') {
      const step1 = mod.checkStep(state, { action: 'factor', productIndex: 0, factors: [2, 17] });
      if (!step1.valid) return { success: false, error: `Failed factoring clue 0` };
      state = step1.state;

      const step2 = mod.checkStep(state, { action: 'factor', productIndex: 1, factors: [5, 17] });
      if (!step2.valid) return { success: false, error: `Failed factoring clue 1` };
      state = step2.state;

      const step3 = mod.checkStep(state, { action: 'assign_shared', guardian: 'Kimmy', value: 17 });
      if (!step3.valid) return { success: false, error: `Failed assign_shared Kimmy` };
      state = step3.state;

      const step4 = mod.checkStep(state, { action: 'assign', guardian: 'Jimmy', value: 2 });
      if (!step4.valid) return { success: false, error: `Failed assign Jimmy` };
      state = step4.state;

      const step5 = mod.checkStep(state, { action: 'assign', guardian: 'Timmy', value: 5 });
      if (!step5.valid) return { success: false, error: `Failed assign Timmy` };
      state = step5.state;

      const step6 = mod.checkStep(state, { action: 'submit_sum', value: 24 });
      if (!step6.valid) return { success: false, error: `Failed submit_sum 24` };
      state = step6.state;
    }

    if (!mod.isComplete(state)) {
      return { success: false, error: `Mechanic isComplete returned false after replay` };
    }

    const finalVal = mod.finalValue(state);
    if (finalVal !== part.answer.value) {
      return { success: false, error: `finalValue ${finalVal} did not match expected answer ${part.answer.value}` };
    }

    return { success: true, finalValue: finalVal };
  } catch (err) {
    return { success: false, error: `Exception during mechanics replay: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// 6. CLI Execution
// ---------------------------------------------------------------------------

async function runCli() {
  console.log('======================================================================');
  console.log('Castle of Theorems — Content Validation Pipeline');
  console.log('======================================================================\n');

  const schemaPath = path.resolve(PROJECT_ROOT, 'content/schema.json');
  let schema = null;
  if (fs.existsSync(schemaPath)) {
    try {
      schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    } catch (e) {
      console.error(`[ERROR] Failed to parse schema at ${schemaPath}: ${e.message}`);
      process.exit(1);
    }
  }

  const deckPath = path.resolve(PROJECT_ROOT, 'content/deck.json');
  let deckCards = null;
  if (fs.existsSync(deckPath)) {
    try {
      const deck = JSON.parse(fs.readFileSync(deckPath, 'utf8'));
      deckCards = deck.cards ? deck.cards.map(c => c.id) : null;
    } catch (e) {
      console.warn(`[WARNING] Could not read deck.json: ${e.message}`);
    }
  }

  const checkReadingLevel = process.argv.includes('--reading-level') || process.env.CHECK_FKGL === '1';

  const encountersDir = path.resolve(PROJECT_ROOT, 'content/encounters');
  const cliArgs = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  let targetFiles = cliArgs;

  if (targetFiles.length === 0) {
    if (!fs.existsSync(encountersDir)) {
      console.error(`[ERROR] Encounters directory ${encountersDir} does not exist.`);
      process.exit(1);
    }
    targetFiles = fs.readdirSync(encountersDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .map(f => path.join(encountersDir, f));
  }

  if (targetFiles.length === 0) {
    console.log('No encounter JSON files found to validate.');
    process.exit(0);
  }

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const filePath of targetFiles) {
    const relPath = path.relative(PROJECT_ROOT, filePath);
    console.log(`Checking ${relPath}...`);

    let encounter;
    try {
      encounter = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error(`  [ERROR] JSON parse failed: ${err.message}`);
      totalErrors++;
      continue;
    }

    const { valid, errors, warnings } = await validateEncounter(encounter, {
      schema,
      deckCards,
      runMechanics: true,
      checkReadingLevel
    });

    for (const warn of warnings) {
      console.warn(`  [WARNING] ${warn.field}: ${warn.message}`);
      totalWarnings++;
    }

    for (const err of errors) {
      console.error(`  [ERROR] ${err.field}: ${err.message}`);
      totalErrors++;
    }

    if (valid) {
      console.log(`  [OK] Passed validation (${warnings.length} warning(s))\n`);
    } else {
      console.log(`  [FAIL] ${errors.length} error(s), ${warnings.length} warning(s)\n`);
    }
  }

  console.log('======================================================================');
  console.log(`Validation Summary:`);
  console.log(`  Files checked: ${targetFiles.length}`);
  console.log(`  Total errors:  ${totalErrors}`);
  console.log(`  Total warnings: ${totalWarnings}`);
  console.log('======================================================================');

  if (totalErrors > 0) {
    console.error('\nFAIL: Content validation encountered hard errors.');
    process.exit(1);
  } else {
    console.log('\nPASS: All content validated successfully.');
    process.exit(0);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCli().catch(err => {
    console.error('Fatal validation runner error:', err);
    process.exit(1);
  });
}
