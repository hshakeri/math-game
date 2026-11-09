# avatars — pixel art direction

Original reusable cast: child-named apprentice hero in six variants, Rivet, Grubb, Lemma and gatekeepers. Refer to the full pixel style bible and cast-sheet.svg; do not regenerate different character identities for each scene.

Canonical implementation: `tools/assets/generate.py`; art direction: `tools/assets/style.md`. Locked/open scenes reuse the same integer-grid environment and swap only door tiles. Runtime art contains no text, numbers, puzzle hints or generated-at-play images. Regenerate with `npm run assets`. Parent visual review is required before commit.
