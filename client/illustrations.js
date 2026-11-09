/**
 * User-selected illustrated stills. Pure, browser-independent presentation data.
 * Each URL is local and served only through the existing manifest approval gate.
 * State/event decisions belong to the caller; this module never judges an idea.
 */
const ids = [
  'keeper-troll', 'keeper-alchemist', 'keeper-stonemason', 'keeper-guardians',
  'rivet', 'lemma', 'grubb-neutral', 'grubb-smirk', 'grubb-fume',
  'card-backwards-crab', 'card-worst-case-grubb', 'card-tiny-mouse',
  'card-draw-chameleon', 'card-odd-even-magpies', 'card-shared-cats'
];

export const ILLUSTRATIONS = Object.freeze(Object.fromEntries(
  ids.map(id => [id, `/assets/illustrations/${id}.png`])
));

export const ILLUSTRATION_DIMENSIONS = Object.freeze(Object.fromEntries(
  ids.map(id => [id, Object.freeze({
    width: ['card-odd-even-magpies', 'card-shared-cats'].includes(id) ? 1671 : 1672,
    height: 941
  })])
));

export const KEEPER_ILLUSTRATIONS = Object.freeze({
  'ch1-n1-reverse-tolls': 'keeper-troll',
  'ch1-n2-dark-vault': 'keeper-alchemist',
  'ch1-n3-five-shields': 'keeper-stonemason',
  'ch1-n4-castle-keep': 'keeper-guardians'
});

export const CARD_ILLUSTRATIONS = Object.freeze({
  'work-backwards': 'card-backwards-crab',
  'worst-case': 'card-worst-case-grubb',
  'tiny-case': 'card-tiny-mouse',
  'draw-it': 'card-draw-chameleon',
  'odd-or-even': 'card-odd-even-magpies',
  'find-what-is-shared': 'card-shared-cats'
});

export const GRUBB_ILLUSTRATIONS = Object.freeze({
  idle: 'grubb-neutral', smirk: 'grubb-smirk', fume: 'grubb-fume'
});

const escape = value => String(value ?? '').replace(/[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

/** Unknown IDs fail closed rather than selecting a potentially misleading image. */
export function illustrationPath(id) {
  return Object.hasOwn(ILLUSTRATIONS, id) ? ILLUSTRATIONS[id] : '';
}

/** Lazy loading is the default; callers opt in to eager loading for visible art. */
export function illustration(id, { className = '', label = '', loading = 'lazy', priority = false } = {}) {
  const src = illustrationPath(id);
  if (!src) return '';
  const { width, height } = ILLUSTRATION_DIMENSIONS[id];
  const load = loading === 'eager' || priority ? 'eager' : 'lazy';
  return `<img class="story-illustration ${escape(className)}" src="${src}" width="${width}" height="${height}" alt="${escape(label)}" loading="${load}" decoding="async" fetchpriority="${priority ? 'high' : 'auto'}" draggable="false"${label ? '' : ' aria-hidden="true"'}>`;
}
