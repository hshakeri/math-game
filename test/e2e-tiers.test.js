/**
 * Castle of Theorems v1 (Home Edition)
 * Master E2E Tiers Runner (Tiers 1–4)
 * Consolidated test entrypoint executing Tiers 1 through 4.
 */

import { describe } from 'node:test';

describe('Castle of Theorems Master E2E Suite (Tiers 1–4)', async () => {
  await import('./e2e-tier1-features.test.js');
  await import('./e2e-tier2-boundaries.test.js');
  await import('./e2e-tier3-combinations.test.js');
  await import('./e2e-tier4-scenarios.test.js');
});
