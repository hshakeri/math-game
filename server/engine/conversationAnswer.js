/** Syntax only: identify a child's explicit integer claim, never solve arithmetic. */
const SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const NUMBER = '(?:[+-]?\\d+|(?:minus )?(?:' + SMALL.join('|') + '|' + TENS.join('|') + ')(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?)';
const CLAIM = new RegExp('\\b(?:(?:(?:my|the|final)\\s+)?answer|x)\\s*(?:is|equals|=|:)\\s*(' + NUMBER + ')(?!\\w|\\.\\d)', 'gi');
const BARE = new RegExp('^(' + NUMBER + ')[.!]?$','i');
const ALTERNATIVES = new RegExp('\\b' + NUMBER + '\\s+(?:or|and)\\s+' + NUMBER + '\\b', 'i');
const REPLACEMENT = new RegExp('\\b(?:(?:it|that|this)\\s+(?:is|equals)|i\\s+(?:get|got))\\s+' + NUMBER + '\\b', 'i');

function integer(token) {
  if (/^[+-]?\d+$/.test(token)) {
    const value = Number(token);
    return Number.isSafeInteger(value) ? value : null;
  }
  const negative = token.startsWith('minus ');
  const words = token.replace(/^minus /, '').split(/[- ]/);
  let value = SMALL.indexOf(words[0]);
  if (value < 0) value = (TENS.indexOf(words[0]) + 2) * 10;
  if (words.length === 2) {
    if (!TENS.includes(words[0])) return null;
    value += SMALL.indexOf(words[1]);
  }
  return negative ? -value : value;
}

export function parseIntegerClaim(input) {
  if (typeof input === 'number') return Number.isSafeInteger(input) ? { value: input, reason: '' } : null;
  if (typeof input !== 'string') return null;
  const text = input.trim().toLowerCase();
  if (!text || text.length > 8000 || /[?]|\b(?:maybe|perhaps|either|not|isn't|isnt|could|might|if|suppose)\b/.test(text)) return null;
  const bare = text.match(BARE);
  if (bare) {
    const value = integer(bare[1]);
    return value === null ? null : { value, reason: '' };
  }
  const matches = [...text.matchAll(CLAIM)];
  // Multiple answer declarations require the child to choose one explicitly.
  if (matches.length !== 1) return null;
  const match = matches[0];
  // These voluntary prefixes announce the same explicit claim; they are not
  // an explanation and cannot satisfy the three-word reason requirement.
  const before = text.slice(0, match.index).trim().replace(/^i (?:think|believe|get)$/, '');
  const after = text.slice(match.index + match[0].length).trim();
  // A claim must finish the thought, or be followed by an explicit explanation.
  // Reject arithmetic, alternatives, decimals, and units instead of guessing.
  if (after && !/^[.!]?$/.test(after) && !/^[,;.]?\s*because\b/.test(after)) return null;
  if (before && !/[,;.!]\s*(?:so\s*)?$|\b(?:so|therefore)\s*$/.test(before)) return null;
  const value = integer(match[1]);
  if (value === null) return null;
  const reason = (before.replace(/[,;.!]?\s*(?:so|therefore)?\s*$/, '') + ' ' + after.replace(/^[,;.!]?\s*because\s*/, '').replace(/[.!]$/, '')).trim();
  return { value, reason };
}

export function isReasonReply(text) {
  // A pending number is never completed by arbitrary three-word chat. Require
  // a recognizable explanation cue, and reject retractions/new alternatives.
  return typeof text === 'string' && text.trim().split(/\s+/).length >= 3 &&
    /\b(?:because|since|by|reason|work|worked|working|undo|undid|reverse|reversed|backwards|check|checked|trace|traced|count|counted|calculate|calculated|calculation|use|used|consider|considered|notice|noticed|divided|multiplied|added|subtracted)\b/i.test(text) &&
    !/[?]/.test(text) && !/\b(?:don't|do not|cannot|can't|can not|unable|unsure|uncertain|changed my mind|change my mind|not sure|nothing|all known|maybe|either|want|help|hint|repeat|forget|cancel|wait)\b/i.test(text) &&
    !/\b(?:answer|x)\s*(?:is|equals|=|:)/i.test(text) && !ALTERNATIVES.test(text) && !REPLACEMENT.test(text);
}

/** Match the selected authored reflection's input shape, without evaluating math. */
export function parseReflectionReply(input, check) {
  if (check?.type === 'integer') {
    // An x declaration restates the starting answer, not the selected final
    // task's result. Never extract a reflection result from that algebra.
    if (typeof input === 'string' && /\bx\b/i.test(input)) return null;
    const claim = parseIntegerClaim(input);
    return claim ? { value: claim.value } : null;
  }
  if (check?.type === 'choice' && Array.isArray(check.options)) {
    const normalize = text => typeof text === 'string' ? text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!]$/, '') : '';
    const text = normalize(input);
    const index = text ? check.options.findIndex(option => normalize(option) === text) : -1;
    if (index >= 0) return { value: index };
    const numeric = typeof input === 'number' ? input : /^\d+$/.test(text) ? Number(text) : null;
    return Number.isInteger(numeric) && numeric >= 0 && numeric < check.options.length ? { value: numeric } : null;
  }
  return null;
}
