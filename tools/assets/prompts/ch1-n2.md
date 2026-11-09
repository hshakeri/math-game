# ch1-n2 — pixel art direction

Alchemist’s Dark Vault: stone chamber, empty chest, brass lanterns and a side gate. Do not render crystals or clue-bearing groups.

Canonical implementation: `tools/assets/generate.py`; art direction: `tools/assets/style.md`. Locked/open scenes reuse the same integer-grid environment and swap only door tiles. Runtime art contains no text, numbers, puzzle hints or generated-at-play images. Regenerate with `npm run assets`. Parent visual review is required before commit.
