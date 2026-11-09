# ch1-n4 — pixel art direction

Castle Keep: quiet fortified walls, a brass-set portcullis and distant watchtowers. No runes, numbers or factor patterns.

Canonical implementation: `tools/assets/generate.py`; art direction: `tools/assets/style.md`. Locked/open scenes reuse the same integer-grid environment and swap only door tiles. Runtime art contains no text, numbers, puzzle hints or generated-at-play images. Regenerate with `npm run assets`. Parent visual review is required before commit.
