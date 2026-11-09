# chapter1-card — pixel art direction

Issue cover environment: the outer road and castle, with negative space for the HTML title. Composite reusable hero, Rivet and Lemma sprites in the interface.

Canonical implementation: `tools/assets/generate.py`; art direction: `tools/assets/style.md`. Locked/open scenes reuse the same integer-grid environment and swap only door tiles. Runtime art contains no text, numbers, puzzle hints or generated-at-play images. Regenerate with `npm run assets`. Parent visual review is required before commit.
