/**
 * Pure sprite markup for the original 48px Keybreakers cast.
 * Runtime artwork is static, local, deterministic and manifest-gated.
 * This module is safe to import in Node: no DOM or browser globals.
 */
const NAMES = new Set(['hero', 'rivet', 'grubb', 'lemma', 'troll', 'alchemist', 'stonemason', 'guardians', 'crab', 'mouse', 'chameleon', 'magpies', 'cats']);
const HERO_POSES = new Set(['idle', 'walk', 'think', 'celebrate']);
const GRUBB_POSES = new Set(['idle', 'smirk', 'fume']);
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function spritePath(name, { variant = 1, pose = 'idle' } = {}) {
  if (!NAMES.has(name)) name = 'rivet';
  if (name === 'hero') {
    const selected = Number.isInteger(Number(variant)) && Number(variant) >= 1 && Number(variant) <= 6 ? Number(variant) : 1;
    return `/assets/sprites/hero-${selected}-${HERO_POSES.has(pose) ? pose : 'idle'}.svg`;
  }
  if (name === 'grubb') return `/assets/sprites/grubb-${GRUBB_POSES.has(pose) ? pose : 'idle'}.svg`;
  return `/assets/sprites/${name}.svg`;
}

/** An empty label makes repeated scene sprites decorative to screen readers. */
export function sprite(name, { className = '', label = '', variant = 1, pose = 'idle' } = {}) {
  return `<img class="pixel-sprite ${escape(className)}" src="${spritePath(name, { variant, pose })}" width="${name === 'guardians' ? 72 : 48}" height="48" alt="${escape(label)}" draggable="false"${label ? '' : ' aria-hidden="true"'}>`;
}
