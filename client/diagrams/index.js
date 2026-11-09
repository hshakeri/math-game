/**
 * Castle of Theorems — Diagrams Registry Index
 * client/diagrams/index.js
 */

import * as reverseTolls from './reverse-tolls.js';
import * as darkVault from './dark-vault.js';
import * as fiveShields from './five-shields.js';
import * as castleKeep from './castle-keep.js';

export const DIAGRAM_COMPONENTS = {
  // Encounter-based names
  'reverse-tolls': reverseTolls,
  'dark-vault': darkVault,
  'five-shields': fiveShields,
  'castle-keep': castleKeep,

  // SPEC §8 Canonical names
  'inverse-chain': reverseTolls,
  'pigeonhole-bins': darkVault,
  'goblin-bins': darkVault,
  'seam-grid': fiveShields,
  'factor-tree': castleKeep,
  'factor-dials': castleKeep
};

export function getDiagramComponent(name) {
  if (!name) return null;
  return DIAGRAM_COMPONENTS[name] || null;
}

export function renderDiagram(spec, mode, state) {
  const component = getDiagramComponent(spec?.component);
  if (!component) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" role="img" aria-label="Diagram placeholder"><rect width="400" height="100" fill="#1c2631"/><text x="200" y="55" text-anchor="middle" fill="#5dade2" font-size="16">Diagram Component Not Found</text></svg>`;
  }
  return component.render(spec, mode, state);
}

export function mountDiagram(container, spec, mode, state, onStep) {
  const component = getDiagramComponent(spec?.component);
  if (!component) {
    if (container) {
      container.innerHTML = renderDiagram(spec, mode, state);
    }
    return;
  }
  return component.mount(container, spec, mode, state, onStep);
}
