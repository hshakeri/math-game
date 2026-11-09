# map-ch1 — pixel art direction

The outer road: winding path through the hills toward the Castle of Theorems. No words or numeric node labels in the art; the UI owns those labels.

Canonical implementation: `tools/assets/generate.py`; art direction: `tools/assets/style.md`. Locked/open scenes reuse the same integer-grid environment and swap only door tiles. Runtime art contains no text, numbers, puzzle hints or generated-at-play images. Regenerate with `npm run assets`. Parent visual review is required before commit.
