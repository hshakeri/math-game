/**
 * Castle of Theorems — Diagram Graphics Common Utilities
 * client/diagrams/common.js
 */

export const THEME_VARS = {
  bgSurface: 'var(--parchment-card, #fdfaf2)',
  bgCanvas: 'var(--blueprint-bg, #1c2631)',
  textPrimary: 'var(--ink-primary, #2c2416)',
  textSecondary: 'var(--ink-secondary, #594a34)',
  accentGold: 'var(--gold-accent, #c8963e)',
  accentBlue: 'var(--blueprint-line, #5dade2)',
  accentEmerald: '#27ae60',
  accentRuby: '#e74c3c',
  borderStone: 'var(--parchment-border, #d8cca8)',
  borderBlueprint: 'var(--blueprint-border, #3d5166)',
  blueprintGrid: 'var(--blueprint-grid, rgba(93, 173, 226, 0.12))'
};

export function createSvgElement(tag, attrs = {}) {
  if (typeof document === 'undefined') return null;
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}
