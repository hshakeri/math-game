# ch1-n3 — pixel art direction

Courtyard of Five Shields: weathered flagstones, ivy, timber scaffold and a stone gate. The mathematical shield arrangement belongs only in the engine diagram.

Canonical implementation: `tools/assets/generate.py`; art direction: `tools/assets/style.md`. Locked/open scenes reuse the same integer-grid environment and swap only door tiles. Runtime art contains no text, numbers, puzzle hints or generated-at-play images. Regenerate with `npm run assets`. Parent visual review is required before commit.
