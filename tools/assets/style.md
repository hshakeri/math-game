# Keybreakers — pixel style bible

The world is a quiet, slightly weathered sixteen-bit adventure: moss on cut stone, brass tools, blue-green shadows, parchment dialogue and a restrained golden Seal. Characters have readable silhouettes and apprentice-adventure proportions. No bright nursery palette, oversized baby heads, soft vector gradients, or emoji substitutes. Every piece of story art is independent of the math diagram; it contains no text, numbers, equations, or puzzle hints.

## Palette and grid

The canonical palette and paint routines live in `tools/assets/generate.py`. Core colors: ink `#202b31`, parchment `#f7f1e3`, sandstone `#d8cca8`, antique gold `#c8963e`; supporting moss, slate, muted rust, and blue-green ramps provide depth. Interface themes live in `client/style.css`.

Characters are painted on an integer 48-by-48 grid; the Three Guardians share a 72-by-48 strip. Scenes are integer 320-by-180 canvases, emitted into 1920-by-1080 SVGs. Pixel runs are merged into rectangles and shown with crisp edges. Assets scale with nearest-neighbor rendering. These dimensions come from the generator's constructors and output registry.

## Cast

- The child-named apprentice: goggles raised, scarf, coat and card satchel. Six palette/skin variants. Idle, walk, thinking and Seal-only celebration poses.
- Rivet: brass clockwork owl with monocle. The selected illustration stays still; a timed speech bubble supplies the conversational rhythm.
- Grubb: green skeptic, broad grin, patched sack. Idle, smirk and fume. Only engine-confirmed final submissions or the opened scene drive reactions; tentative conversation never does.
- Lemma: salamander at the Blueprint, tending blank cards.
- Gatekeepers: abacus-bearing Toll Troll, lantern-bearing Alchemist, chisel-bearing Stonemason, and three identical knights in different colors.
- Deck creatures: backwards crab, Grubb for Worst Case, tiny mouse, brush-bearing chameleon, paired magpies, and shared-tail cats.

## Scenes and state

The generator paints the same environment for each locked/open pair and swaps the door tiles. The canyon, vault, courtyard and keep each have a separate environment. Scenery never illustrates a numerical solution. Intermediate Vault chambers retain the locked node scene. A completed node opens only on the server's safe scene state.

## Sources and review

`npm run assets` regenerates the original code-drawn sprites, scenes, contact sheets and SHA-256 manifest without external packages. Legacy avatar filenames remain for compatibility. Generated SVGs retain the prototype `placeholder: true` marker, and their review metadata explicitly records that Heman's visual review is pending before commit. All runtime art still passes the existing manifest approval gate.

`docs/art/keybreakers-cast-concept.png` is a separate built-in imagegen concept board, with its full request in `docs/art/cast-prompt.txt`. After viewing the detailed endpoint illustrations, the user requested still pictures with timed speech bubbles. `tools/assets/prepare_stills.py` copies those selected PNGs unchanged into `client/assets/illustrations/` and records their review basis, source paths, dimensions and hashes in the manifest. It refuses changed source bytes and preserves `approved: false` revocations. `npm run assets` includes this preparation. Other concept images and unused endpoint poses remain outside runtime assets. No video or character motion is needed; the chosen hero variants remain available as still sprites.
