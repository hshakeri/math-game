#!/usr/bin/env python3
"""Copy the user-selected illustrated stills into the manifest-gated asset tree.

Original PNG bytes are retained: no resize, crop, conversion or recompression.
The source hashes below bind the user's review to these exact selected pictures.
Changing a source requires a new visual review and an explicit hash update here.
Running this script never overrides an existing approved:false revocation.
"""
import hashlib
import json
import shutil
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
ASSETS = ROOT / "client" / "assets"
MANIFEST = ASSETS / "manifest.json"
SOURCE_ROOT = "docs/art/animation-pack"

# Key, reviewed source file, SHA-256 of that exact source file.
STILLS = (
    ("keeper-troll", "keeper-troll/first.png", "7a1dd842d027bb0b9f9b2fc63ca16c1e3869040def2a067a08860240fdb431c9"),
    ("keeper-alchemist", "keeper-alchemist/first.png", "613bb60b65f87a10f1c8463ff35162559218f4ee40035348b079d34c8f45f6e3"),
    ("keeper-stonemason", "keeper-stonemason/first.png", "dbe5ebd55b779409dfb201c117ba7f47d3b7effc0965aedede6a6826000dc0dd"),
    ("keeper-guardians", "keeper-guardians/first.png", "c537fce43e2c7ccfac57a36fdae02c613e4d132d60ae41aabacfe4b5fcbba053"),
    ("rivet", "rivet-thinking-loop/first.png", "d9bfb57ff171069535710e73ecdfb9b98fc32628dfe56357a1346f6f9fa82018"),
    ("lemma", "lemma-card/first.png", "0068582fa86e2f0f32afa9d88cd6e2f247999b53472ad8fd823aa94382db6c75"),
    ("card-backwards-crab", "card-backwards-crab/first.png", "ffab265eae3c5a13c4eea869d4ad6f10f40f584de3b340181c26c116a8dfa747"),
    ("card-worst-case-grubb", "card-worst-case-grubb/first.png", "ddcfea9df32837bef4f48e6871a8b74b4782cb4ef3484de5d92cdc1fde3d1277"),
    ("card-tiny-mouse", "card-tiny-mouse/first.png", "bfc19e3d09dd8a88d8b60a4c150eb821f708e0a5b29ca2f1f6c0263b917a8cd2"),
    ("card-draw-chameleon", "card-draw-chameleon/first.png", "2d2583066a8c01e76f15e998e77091c579323e2cf62cf172d06a39cedacf61d2"),
    ("card-odd-even-magpies", "card-odd-even-magpies/first.png", "b067388fc883b17098b1fc2fff2be58859a6969c6de4149c8271fb17d9dc90c8"),
    ("card-shared-cats", "card-shared-cats/first.png", "0d4e87cfde2152c85a8274069c1271b8771cf9ffa93fbeedecd77675ccebc6f3"),
    ("grubb-neutral", "grubb-gate-shut/first.png", "95f2b1ff2c98c60658411b06a08173e02af3565179926931e50e38f9d1f10072"),
    ("grubb-smirk", "grubb-gate-shut/last.png", "b77c5036978ec34cea01f39dd31fa0bfcae1efed35663b1470dc292a6d440f55"),
    ("grubb-fume", "grubb-gate-open/last.png", "7c1fd33ed2e9d08349be5bc5da90002cbf7a0075a1eb595778bc47bcd9d194cd"),
)

REVIEW_BASIS = (
    "The user selected the reviewed detailed illustrations and requested their use "
    "as still pictures with timed speech bubbles in the game, in this chat on 2026-11-09."
)


def png_dimensions(data):
    """Read the PNG IHDR without decoding or changing any image pixels."""
    if len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError("Selected still is not a PNG with an IHDR header")
    width, height = struct.unpack(">II", data[16:24])
    if width < 1 or height < 1:
        raise ValueError("Selected PNG has invalid dimensions")
    return {"width": width, "height": height}


def prepare_stills(manifest, previous=None):
    """Restore reviewed copies and add metadata to a caller-owned manifest dict.

    All sources are checked before any copy is written. Previous approval state
    survives regeneration; explicit revocation is never reset by this utility.
    """
    previous = previous if previous is not None else manifest
    old_entries = previous.get("assets", {})
    prepared = []
    for key, relative_source, expected_hash in STILLS:
        source_path = f"{SOURCE_ROOT}/{relative_source}"
        source = ROOT / source_path
        data = source.read_bytes()
        actual_hash = hashlib.sha256(data).hexdigest()
        if actual_hash != expected_hash:
            raise ValueError(f"Reviewed source changed; a new visual review is required: {source_path}")
        prepared.append((key, source_path, source, actual_hash, png_dimensions(data), len(data)))

    (ASSETS / "illustrations").mkdir(parents=True, exist_ok=True)
    manifest.setdefault("assets", {})
    manifest.setdefault("byAssetId", {})
    for key, source_path, source, digest, dimensions, size in prepared:
        relative_output = f"illustrations/{key}.png"
        destination = ASSETS / relative_output
        if not destination.exists() or hashlib.sha256(destination.read_bytes()).hexdigest() != digest:
            shutil.copyfile(source, destination)
        # Only an explicit true value is an approval. Existing false/malformed
        # entries stay blocked; a new known, reviewed source starts approved.
        old = old_entries.get(relative_output)
        approved = old is None or old.get("approved") is True
        asset_id = f"illustration-{key}"
        manifest["assets"][relative_output] = {
            "id": asset_id,
            "type": "illustration",
            "file": relative_output,
            "format": "image/png",
            "dimensions": dimensions,
            "bytes": size,
            "sha256": digest,
            "placeholder": False,
            "approved": approved,
            "source": {
                "file": source_path,
                "sha256": digest,
                "dimensions": dimensions,
                "bytes": size,
                "operation": "byte-for-byte copy of selected original PNG; no conversion",
                "preparedBy": "tools/assets/prepare_stills.py",
            },
            "review": {
                "heroOwlMatch": True,
                "noTextInImage": True,
                "nothingFrightening": True,
                "noPuzzleHints": True,
                "plausibleAnatomy": True,
                "basis": REVIEW_BASIS,
                "scope": "These exact source hashes only; no external approval claimed.",
            },
        }
        manifest["byAssetId"][asset_id] = relative_output
    return len(prepared), sum(row[5] for row in prepared)


def main():
    if not MANIFEST.exists():
        raise SystemExit("Run npm run assets to create the base asset manifest first.")
    manifest = json.loads(MANIFEST.read_text())
    count, size = prepare_stills(manifest)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Prepared {count} reviewed stills ({size} bytes), copied without conversion.")


if __name__ == "__main__":
    main()
