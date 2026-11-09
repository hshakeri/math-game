import { parseIntegerClaim } from './conversationAnswer.js';

// This recognizes the authored toll tree; it is not an arithmetic evaluator.
// Bounded tokens/depth and a closed grammar exclude code, functions and algebra.
function parseTree(source) {
  if (!source || source.length > 256 || /\d\s+\d/.test(source)) return null;
  const compact = source.replace(/\s/g, '').replace(/×/g, '*').replace(/−/g, '-').toLowerCase();
  if (/[^\dx()*-]/.test(compact)) return null;
  const tokens = compact.match(/\d+|x|[()*-]/g) || [];
  if (tokens.length > 64) return null;
  let cursor = 0;
  function primary(depth) {
    if (depth > 16) throw Error('depth');
    const token = tokens[cursor++];
    if (token === '(') {
      const node = expression(depth + 1);
      if (tokens[cursor++] !== ')') throw Error('parenthesis');
      return node;
    }
    if (token === 'x') return { op: 'x' };
    if (/^\d+$/.test(token || '') && Number.isSafeInteger(Number(token))) return { op: 'number', value: Number(token) };
    throw Error('token');
  }
  function product(depth) {
    let node = primary(depth);
    while (tokens[cursor] === '*' || tokens[cursor] === '(' || tokens[cursor] === 'x') {
      if (tokens[cursor] === '*') cursor++;
      node = { op: '*', left: node, right: primary(depth) };
    }
    return node;
  }
  function expression(depth) {
    let node = product(depth);
    while (tokens[cursor] === '-') {
      cursor++;
      node = { op: '-', left: node, right: product(depth) };
    }
    return node;
  }
  try {
    const tree = expression(0);
    return cursor === tokens.length ? tree : null;
  } catch { return null; }
}

function baseOfRoute(node, gates, index = gates.length - 1) {
  if (index < 0) return node?.op === 'x' || node?.op === 'number' ? node : null;
  const gate = gates[index];
  if (node?.op !== '-' || node.right?.op !== 'number' || node.right.value !== gate.sub || node.left?.op !== '*') return null;
  const product = node.left;
  if (product.left?.op === 'number' && product.left.value === gate.mul) return baseOfRoute(product.right, gates, index - 1);
  if (product.right?.op === 'number' && product.right.value === gate.mul) return baseOfRoute(product.left, gates, index - 1);
  return null;
}

function routeTree(source, gates) {
  const direct = parseTree(source);
  if (direct) return baseOfRoute(direct, gates) ? { tree: direct, repairedClose: false } : null;
  // Tolerate one demonstrably unmatched close, never an altered balanced tree,
  // missing close, operator or operand. The remaining tree must match exactly.
  let balance = 0, unmatched = -1;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '(') balance++;
    if (source[i] === ')') {
      if (balance === 0) {
        if (unmatched !== -1) return null;
        unmatched = i;
      } else balance--;
    }
  }
  if (balance !== 0 || unmatched < 0) return null;
  const repaired = parseTree(source.slice(0, unmatched) + source.slice(unmatched + 1));
  return repaired && baseOfRoute(repaired, gates) ? { tree: repaired, repairedClose: true } : null;
}

export function currentActionEvidence(action) {
  return [...new Set([action.text, action.value, action.reason, action.justification]
    .filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))].join('\n');
}

const forwardStep = (value, gate) => value * gate.mul - gate.sub;

function verifyGateList(text, candidate, part, verification) {
  const { gates, end } = part.mechanic;
  if (!Array.isArray(gates) || gates.length === 0 || gates.length > 8) return null;
  let source = text.trim().replace(/×/g, '*').replace(/−/g, '-');
  // A separately entered numeric answer may precede its reason in the action
  // evidence. It must agree with the submitted candidate, never supply a step.
  const separateAnswer = source.match(/^(\d+)\s*\n\s*(?=Gate\b)/i);
  if (separateAnswer) {
    if (Number(separateAnswer[1]) !== candidate) return null;
    source = source.slice(separateAnswer[0].length);
  }
  const step = /Gate[ \t]+(\d+)[ \t]*:[ \t]*(\d+)[ \t]*\*[ \t]*(\d+)[ \t]*-[ \t]*(\d+)[ \t]*=[ \t]*(\d+)/iy;
  let position = 0, previous = null, start = null;
  for (let i = 0; i < gates.length; i++) {
    step.lastIndex = position;
    const match = step.exec(source);
    if (!match) return null;
    const [label, input, mul, sub, output] = match.slice(1).map(Number);
    if (![label, input, mul, sub, output].every(Number.isSafeInteger)
        || label !== i + 1 || mul !== gates[i].mul || sub !== gates[i].sub) return null;
    if (i === 0) start = input;
    if ((previous !== null && input !== previous) || forwardStep(input, gates[i]) !== output) return null;
    previous = output;
    position = step.lastIndex;
    if (i < gates.length - 1) {
      const separator = source.slice(position).match(/^[ \t]*(?:[,;]\s*|\r?\n[ \t]*)/);
      if (!separator) return null;
      position += separator[0].length;
    }
  }
  if (!/^[ \t]*\.?[ \t]*$/.test(source.slice(position))) return null;
  if ((candidate !== null && candidate !== undefined && start !== candidate) || start !== part.answer?.value
      || previous !== end || previous !== verification.check.value) return null;
  return { candidate: start, repairedClose: false, source: 'child-gate-list' };
}

export function verifyForwardEvidence(text, candidate, part, verification) {
  if (typeof text !== 'string' || text.length > 8000 || part?.mechanic?.kind !== 'inverse-chain'
      || verification?.kind !== 'verify' || verification.check?.type !== 'integer') return null;
  text = text.replace(/[‘’]/g, "'");
  if (/[?]|\b(?:not|don't|didn't|haven't|hasn't|never|cannot|can't|maybe|perhaps|probably|guess|either|or|might|could|if|suppose|unsure|uncertain|ignore|cancel|retract)\b/i.test(text)) return null;
  const gateList = verifyGateList(text, candidate, part, verification);
  if (gateList) return gateList;
  const declarations = [...text.matchAll(/\b(?:(?:my|the|final)\s+)?(?:answer|x)\s*(?:is|equals|=|:)\s*/gi)];
  const stated = parseIntegerClaim(text);
  if (declarations.length > 1 || (declarations.length && !stated)) return null;
  if (stated && candidate !== null && candidate !== undefined && stated.value !== candidate) return null;
  const supplied = stated?.value ?? candidate;
  const declaration = declarations[0];
  const equals = [...text.matchAll(/=/g)].filter(match => !declaration || match.index < declaration.index || match.index >= declaration.index + declaration[0].length);
  if (equals.length !== 1) return null;
  const equality = equals[0].index;
  let boundary = equality - 1;
  while (boundary >= 0 && /[\dx()*\s×−-]/i.test(text[boundary])) boundary--;
  const rawLeft = text.slice(boundary + 1, equality);
  const left = rawLeft.trim();
  const prefix = text.slice(0, boundary + 1);
  // Closed equation boundaries: ordinary prose may introduce the route, but
  // never discard an adjacent arithmetic/code operator before its first token.
  if (prefix && !/[,;:]$/.test(prefix) && !(/^\s/.test(rawLeft) && /\b(?:have|gives|wrote|equation|route|check|journey|get|obtain|means|is|as|this|that|equals)$/i.test(prefix))) return null;
  if (!/[()*×-]/.test(left)) return null;
  const right = text.slice(equality + 1).match(/^\s*(\d+)/);
  if (!right) return null;
  const resultEnd = equality + 1 + right[0].length;
  const tailEnd = declaration && declaration.index > equality ? declaration.index : text.length;
  const tail = text.slice(resultEnd, tailEnd);
  // Consume the whole RHS. Modulo, powers, Unicode operators, comparisons,
  // calls and a second equality cannot masquerade as a bare declared total.
  if (tailEnd < text.length ? !/^[\s;,.]*(?:(?:so|therefore)\s*)?$/i.test(tail) : !/^[\s;,.]*$/.test(tail)) return null;
  const { gates, end } = part.mechanic;
  if (!Array.isArray(gates) || gates.length === 0 || gates.length > 8) return null;
  const route = routeTree(left, gates);
  if (!route) return null;
  const base = baseOfRoute(route.tree, gates);
  const start = supplied ?? (base.op === 'number' ? base.value : null);
  if (!Number.isSafeInteger(start) || (base.op === 'number' && base.value !== start)) return null;
  // Replay only the authored public gate rules, not the parsed expression.
  let endFromChildStart = start;
  for (const gate of gates) {
    endFromChildStart = forwardStep(endFromChildStart, gate);
    if (!Number.isSafeInteger(endFromChildStart)) return null;
  }
  if (start !== part.answer?.value || endFromChildStart !== end || Number(right[1]) !== end
      || endFromChildStart !== verification.check.value) return null;
  return { candidate: start, repairedClose: route.repairedClose, source: 'child-forward-equation' };
}
