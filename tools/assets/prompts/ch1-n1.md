# ch1-n1 — pixel art direction

Chasm of Reverse Tolls: mossy canyon crossing, cut stone gateway and distant hills. Do not illustrate toll arithmetic or render coin counts.

Canonical implementation: `tools/assets/generate.py`; art direction: `tools/assets/style.md`. Locked/open scenes reuse the same integer-grid environment and swap only door tiles. Runtime art contains no text, numbers, puzzle hints or generated-at-play images. Regenerate with `npm run assets`. Parent visual review is required before commit.
