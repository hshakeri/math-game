/** Presentation metadata only. No puzzle answers, checks, or hint material. */
export const BRAND = { title: 'Keybreakers', issue: "The Goblin’s Gate", destination: 'Castle of Theorems' };
export const CAST = {
  'ch1-n1-reverse-tolls': { sprite: 'troll', name: 'The Toll Troll', place: 'The broken crossing', line: 'My bridge. My tolls. Bring a plan, traveller.', numeral: 'I' },
  'ch1-n2-dark-vault': { sprite: 'alchemist', name: 'The Alchemist', place: 'A light below the stones', line: 'The vault has its own rules. Read them before you reach inside.', numeral: 'II' },
  'ch1-n3-five-shields': { sprite: 'stonemason', name: 'The Stonemason', place: 'The quiet courtyard', line: 'I built these walls. Let us see what you make of them.', numeral: 'III' },
  'ch1-n4-castle-keep': { sprite: 'guardians', name: 'The Three Guardians', place: 'The last door', line: 'The Castle of Theorems stands beyond this gate. We keep the watch.', numeral: 'IV' }
};
export const CARD_CREATURES = { 'work-backwards': 'crab', 'worst-case': 'grubb', 'tiny-case': 'mouse', 'draw-it': 'chameleon', 'odd-or-even': 'magpies', 'find-what-is-shared': 'cats' };
export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** Only explicit engine outcomes can move Grubb. Conversation and partial steps cannot. */
export function gateReaction(view, events = []) {
  if (view?.sealed && !view?.hasMoreParts && view?.scene?.state === 'unlocked') return { pose: 'fume', word: 'CLANK', text: 'The gate opens. Grubb packs his sack.' };
  if (events.some(e => e.type === 'engine.transition' && e.from === 'submit' && e.to === 'carry_out' && e.correct === false)) {
    return { pose: 'smirk', word: 'clunk', text: 'The gate stays shut. Grubb settles in.' };
  }
  if (view?.partSealed && view?.hasMoreParts) return { pose: 'idle', word: 'whirr', text: 'A chamber opens. The road continues.' };
  return { pose: 'idle', word: '', text: 'Grubb is keeping an eye on the gate.' };
}
