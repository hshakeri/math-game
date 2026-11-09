# Artwork for review

- `keybreakers-cast-concept.png`: cast concept produced with the built-in imagegen tool on 2026-11-09. The full prompt is `cast-prompt.txt`. This is not a production sprite atlas and is not served during play.
- `runtime-cast-preview.png`: raster preview of the original integer-grid SVG sprites authored in `tools/assets/generate.py`.
- `runtime-scenes-preview.png`: preview of the locked narrative environments from the same generator. Runtime locked/open pairs swap the gate tiles.
- `client/assets/avatars/cast-sheet.svg` in the repository is the regenerable runtime contact sheet.

The user reviewed the detailed illustrations and chose still pictures with timed speech bubbles in place of video animation. Selected endpoint PNGs now appear in encounters and Lemma's Deck; the fixed boy hero remains a compact sprite. `tools/assets/prepare_stills.py` copies the selected files unchanged and verifies their recorded source hashes. `client/assets/manifest.json` records their dimensions, provenance and review basis; explicit approval revocations remain in force. No image is generated during play.

## Earlier animation handoff (retained)

The earlier video-app pack is retained as source artwork and an optional future handoff; the active game direction uses stills and speech bubbles. That pack contains 16 motion briefs and 32 endpoint PNGs, recorded in `animation-pack/manifest.json` and checked in `animation-pack/validation.json`. It includes the original crew actions, all four gatekeeper introductions, and all six creature cards.

- `animation-pack/index.html` previews every first/last pair with its motion prompt.
- `animation-pack/PROMPTS.txt` collects the ready-to-paste video prompts.
- `keybreakers-animation-pack-v2.zip` contains the complete expanded handoff.
- `keybreakers-gatekeepers-and-cards.zip` contains only the ten new pairs.
- `keybreakers-animation-pack.zip` preserves the original crew-only handoff unchanged.

Original PNGs were produced with built-in imagegen. Each pair retains exact image prompts; the manifest records native dimensions, hashes and allowed game triggers. Gatekeepers introduce themselves on arrival; creature motions follow the child's explicit card interaction. They do not evaluate an answer or choose a strategy. Proposed clip durations are creative specifications. No videos have been rendered or integrated into the runtime.

Rebuild the gallery, prompts, manifests and ZIPs from the saved source briefs with `python3 tools/assets/package_animation.py`. This packaging script uses only Python's standard library and never generates or edits image pixels. Unused generation drafts remain in the local working folders but are excluded from the gallery, ZIPs and Git. ZIP archives are rebuildable local exports and are not committed; source PNGs, prompts, manifests and the gallery are committed.
