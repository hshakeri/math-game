import { checkUtterance } from '../engine/leakGate.js';

export const MAX_DIALOGUE_ENTRIES = 200;
const CHILD_ACTIONS = new Set(['say', 'chip', 'conjecture', 'submit', 'simpler_submit', 'lookback']);
const ROLES = new Set(['child', 'tutor']);
const cleanText = text => typeof text === 'string' ? text.trim().slice(0, 2000) : '';

/** Only words/numbers explicitly supplied by the child, never mechanic results. */
export function childDialogueText(action) {
  if (!action || !CHILD_ACTIONS.has(action.type)) return '';
  if (action.type === 'say' || action.type === 'chip') return cleanText(action.text || action.chip);
  const words = cleanText(action.text);
  if (words) return words;
  const value = typeof action.value === 'string' ? cleanText(action.value)
    : typeof action.value === 'number' && Number.isFinite(action.value) ? String(action.value) : '';
  const reason = cleanText(action.reason || action.justification);
  return (value === reason ? value : [value, reason].filter(Boolean).join(' — ')).slice(0, 2000);
}

/** Return a fresh ledger; the prior session and its entries remain unchanged. */
export function appendDialogue(session, who, text) {
  const entries = Array.isArray(session.dialogue) ? session.dialogue.slice(-MAX_DIALOGUE_ENTRIES) : [];
  const words = cleanText(text);
  if (ROLES.has(who) && words) entries.push({
    who, text: words, partId: session.currentPartId,
    state: session.state || session.phase, rung: session.hintRung
  });
  return entries.slice(-MAX_DIALOGUE_ENTRIES);
}

/** Already-delivered conversation for display only; never return scope/engine data. */
export function displayDialogue(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.filter(entry => entry && ROLES.has(entry.who) && cleanText(entry.text))
    .slice(-MAX_DIALOGUE_ENTRIES).map(entry => ({ who: entry.who, text: cleanText(entry.text) }));
}

/** A prior hint must still be allowed now, even when its stored scope matches. */
export function modelDialogue(session, leakContext) {
  if (!Array.isArray(session.dialogue)) return [];
  return session.dialogue.filter(entry => entry && ROLES.has(entry.who)
    && entry.partId === session.currentPartId && entry.rung === session.hintRung
    && cleanText(entry.text)
    && (entry.who === 'child' || checkUtterance(entry.text, leakContext).allowed))
    .slice(-6).map(entry => ({ who: entry.who, text: cleanText(entry.text) }));
}

/**
 * Recover display text only. Saved telemetry is never a source of model memory.
 * A tutor.say needs the matching, authoritative per-call gate scope; rejected
 * candidates, raw provider output, engine transitions and parent events are ignored.
 */
export function historicalDialogue(events, encounterId, contextForCall) {
  const entries = [];
  let gateContext = null;
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.type === 'tutor.call') {
      gateContext = event.encounterId === encounterId ? contextForCall(event) : null;
    } else if (event?.type === 'tutor.say') {
      if (gateContext && typeof event.speech === 'string' && checkUtterance(event.speech, gateContext).allowed) {
        entries.push({ who: 'tutor', text: event.speech });
      }
      // A call may deliver at most one question; do not adopt unrelated later text.
      gateContext = null;
    } else if (event?.type === 'child.action' || CHILD_ACTIONS.has(event?.type)) {
      const text = childDialogueText(event.payload);
      if (text) entries.push({ who: 'child', text });
    }
  }
  return displayDialogue(entries);
}
