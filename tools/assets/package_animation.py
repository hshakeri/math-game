#!/usr/bin/env python3
"""Package reviewed video endpoint stills; never generates or edits image pixels."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import html
import json
import struct
import zipfile

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / 'docs/art/animation-pack'
ADDITIONS = [
    'keeper-troll', 'keeper-alchemist', 'keeper-stonemason', 'keeper-guardians',
    'card-backwards-crab', 'card-worst-case-grubb', 'card-tiny-mouse',
    'card-draw-chameleon', 'card-odd-even-magpies', 'card-shared-cats'
]
TITLES = {
    'rivet-thinking-loop': 'Rivet · thinking loop',
    'hero-thinking': 'Hero · a moment to think',
    'lemma-card': 'Lemma · a card for the table',
    'grubb-gate-shut': 'Grubb · the gate stays shut',
    'grubb-gate-open': 'Grubb · the gate opens',
    'hero-seal': 'Hero · the Golden Seal',
    'keeper-troll': 'The Toll Troll · a closer look',
    'keeper-alchemist': 'The Alchemist · lift the lantern',
    'keeper-stonemason': 'The Stonemason · tools at rest',
    'keeper-guardians': 'The Three Guardians · keep watch',
    'card-backwards-crab': 'Work Backwards · the crab',
    'card-worst-case-grubb': 'Worst Case · Grubb’s card',
    'card-tiny-mouse': 'Try a Tiny Case · the mouse',
    'card-draw-chameleon': 'Draw It · the chameleon',
    'card-odd-even-magpies': 'Odd or Even · the magpies',
    'card-shared-cats': 'Find What Is Shared · the twin cats',
}
GROUPS = [
    ('crew', 'The crew', list(TITLES)[:6]),
    ('keepers', 'The gatekeepers', ADDITIONS[:4]),
    ('cards', 'The creature cards', ADDITIONS[4:]),
]


def png_metadata(path):
    data = path.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'Not a PNG: {path}')
    width, height = struct.unpack('>II', data[16:24])
    return {'file': str(path.relative_to(PACK)), 'width': width, 'height': height,
            'sha256': hashlib.sha256(data).hexdigest()}


def archive(path, included_ids, manifest, readme, gallery):
    selected = {clip['id'] for clip in manifest['clips'] if clip['id'] in included_ids}
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as output:
        prefix = 'keybreakers-animation-pack/'
        output.writestr(prefix + 'README.txt', readme)
        output.writestr(prefix + 'index.html', gallery)
        output.writestr(prefix + 'manifest.json', json.dumps(manifest, indent=2) + '\n')
        prompts = []
        for clip in manifest['clips']:
            if clip['id'] not in selected:
                continue
            prompts.append(TITLES[clip['id']].upper() + '\n' + (PACK / clip['id'] / 'prompt.txt').read_text())
            # A strict file list keeps rejected generation drafts out of handoff archives.
            for name in ('first.png', 'last.png', 'prompt.txt', 'image-prompts.json', 'clip.json'):
                source = PACK / clip['id'] / name
                if source.is_file():
                    output.write(source, prefix + clip['id'] + '/' + name)
        output.writestr(prefix + 'PROMPTS.txt', '\n\n'.join(prompts))
    with zipfile.ZipFile(path) as check:
        if check.testzip() is not None:
            raise ValueError(f'ZIP integrity failure: {path}')
        endpoints = [name for name in check.namelist() if name.endswith(('/first.png', '/last.png'))]
        assert len(endpoints) == 2 * len(selected)


STYLE = '''
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#17272b;color:#efe6d1;font:17px/1.6 system-ui,sans-serif}main{max-width:1280px;margin:auto;padding:40px 28px 60px}h1{font:normal clamp(42px,6vw,72px)/1.06 Georgia;margin:15px 0 22px}h2{font:normal 29px Georgia;margin:8px 0}.group-heading{font:normal 42px Georgia;margin:64px 0 24px;padding-top:24px;border-top:1px solid #52625c}.eyebrow{font:12px monospace;letter-spacing:2px;color:#cfad70}p{max-width:860px;color:#c5cec6}nav{display:flex;gap:12px;flex-wrap:wrap;margin:26px 0}a{color:#e9c386;text-underline-offset:5px}nav a{padding:10px 16px;border:1px solid #536565;text-decoration:none;font-size:14px}section.clip{background:#21363b;border:1px solid #4b5c58;padding:24px;margin:30px 0}header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:20px}header a{font-size:14px}.frames{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0;background:#112126}img{width:100%;height:auto;display:block}figcaption{padding:10px 14px;font:12px monospace;letter-spacing:1px;display:flex;justify-content:space-between}details{margin-top:20px}summary{cursor:pointer;min-height:44px;display:flex;align-items:center;color:#e9c386}textarea{width:100%;height:190px;padding:18px;background:#14292e;color:#e8e7da;border:1px solid #607473;font:15px/1.65 system-ui;resize:vertical}.trigger{font-size:14px;color:#aebfb5;border-left:2px solid #bb934f;padding-left:14px}footer{font:13px monospace;color:#9eb2ac}a:focus-visible,summary:focus-visible,textarea:focus-visible{outline:3px solid #e9c386;outline-offset:4px}@media(max-width:700px){main{padding:24px 16px}.frames{grid-template-columns:1fr}header{display:block}header a{display:inline-block;margin-top:12px}section.clip{padding:16px}textarea{height:260px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
'''


def gallery(clips):
    by_id = {clip['id']: clip for clip in clips}
    chunks = []
    for anchor, title, ids in GROUPS:
        group = [by_id[key] for key in ids if key in by_id]
        if not group:
            continue
        chunks.append(f'<h2 id="{anchor}" class="group-heading">{title}</h2>')
        for clip in group:
            slug = clip['id']
            prompt = html.escape((PACK / slug / 'prompt.txt').read_text())
            title_text = html.escape(TITLES[slug])
            kind = 'LOOP' if clip['loop'] else 'SINGLE ACTION'
            figures = ''.join(f'<figure><a href="{slug}/{endpoint}.png" download><img src="{slug}/{endpoint}.png" alt="{title_text} {endpoint} frame" loading="lazy"></a><figcaption>{endpoint.upper()} FRAME <a href="{slug}/{endpoint}.png" download>PNG ↓</a></figcaption></figure>' for endpoint in ('first', 'last'))
            chunks.append(f'<section class="clip" id="{slug}"><header><div><span class="eyebrow">{kind} / {clip["proposed_duration_seconds"]} SECOND TARGET</span><h2>{title_text}</h2></div><a href="{slug}/prompt.txt" download>Download prompt ↗</a></header><div class="frames">{figures}</div><details><summary>Motion prompt</summary><textarea readonly aria-label="Motion prompt for {title_text}">{prompt}</textarea></details><p class="trigger">{html.escape(clip["trigger_restrictions"]["allow"])}</p></section>')
    navigation = ''.join(f'<a href="#{anchor}">{title}</a>' for anchor, title, ids in GROUPS if any(key in by_id for key in ids))
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Keybreakers · Animation Frames</title><style>{STYLE}</style></head><body><main><span class="eyebrow">KEYBREAKERS / DETAILED CONCEPT CAST</span><h1>A little motion.<br>A lot of character.</h1><p>{len(clips)} animation briefs, each with a first frame, a last frame and a ready-to-paste video prompt. Choose a pair, upload both images to your video app, then use the prompt. These are still images; no videos have been rendered.</p><nav>{navigation}<a href="PROMPTS.txt" download>All prompts ↓</a><a href="README.txt">How to use</a></nav>{''.join(chunks)}<footer>Original stills generated with built-in imagegen. Exact image prompts accompany each pair. Durations are creative targets. No runtime game changes.</footer></main></body></html>'''


class LocalLinks(HTMLParser):
    def handle_starttag(self, tag, attributes):
        for name, value in attributes:
            if name in ('src', 'href') and value and not value.startswith(('#', 'http')):
                assert (PACK / value).is_file(), value


def main():
    plan = json.loads((PACK / 'manifest.json').read_text())
    plan['shared_constraints']['content'] = 'No text, letters, digits, equations, puzzle clues, praise, sparkles, extra characters or unplanned props. The hero’s Seal and the card offered by Lemma stay unmarked. Creature cards contain only their intended illustrations; Draw It adds one abstract brushstroke, never a diagram or mathematical symbol.'
    clips = {clip['id']: clip for clip in plan['clips']}
    for slug in ADDITIONS:
        source = PACK / slug / 'clip.json'
        clip = json.loads(source.read_text())
        assert clip['id'] == slug
        clips[slug] = clip
    ordered = []
    assets = []
    for slug in TITLES:
        clip = clips[slug]
        assert isinstance(clip['loop'], bool), slug
        assert 0 < clip['proposed_duration_seconds'] <= 10, slug
        assert clip['motion_prompt'].strip(), slug
        for key in ('allow', 'stop', 'forbid'):
            value = clip['trigger_restrictions'][key]
            if isinstance(value, list):
                assert value and all(isinstance(item, str) and item.strip() for item in value), slug
                clip['trigger_restrictions'][key] = ' '.join(value)
        assert all(clip['trigger_restrictions'][key].strip() for key in ('allow', 'stop', 'forbid')), slug
        clip['title'] = TITLES[slug]
        clip['frames'] = {'first': 'first.png', 'last': 'last.png'}
        folder = PACK / slug
        assert (folder / 'image-prompts.json').is_file()
        json.loads((folder / 'image-prompts.json').read_text())
        shared = ' '.join(plan['shared_constraints'][key] for key in ('camera', 'identity', 'content', 'audio'))
        instruction = (f'Create a {clip["proposed_duration_seconds"]}-second silent animation. Use first.png as the opening frame and last.png as the closing frame.\n\n' + clip['motion_prompt'] + '\n\n' + shared + '\n')
        (folder / 'prompt.txt').write_text(instruction)
        pair = [png_metadata(folder / (endpoint + '.png')) for endpoint in ('first', 'last')]
        assert (pair[0]['width'], pair[0]['height']) == (pair[1]['width'], pair[1]['height']), slug
        for endpoint, metadata in zip(('first', 'last'), pair):
            assets.append({'clip': slug, 'endpoint': endpoint, **metadata})
        ordered.append(clip)
    assert (PACK / 'rivet-thinking-loop/first.png').read_bytes() == (PACK / 'rivet-thinking-loop/last.png').read_bytes()
    plan['version'] = 2
    plan['clips'] = ordered
    plan['assets'] = assets
    plan['image_tool'] = 'built-in imagegen'
    (PACK / 'manifest.json').write_text(json.dumps(plan, indent=2) + '\n')
    (PACK / 'PROMPTS.txt').write_text('\n\n'.join(TITLES[clip['id']].upper() + '\n' + (PACK / clip['id'] / 'prompt.txt').read_text() for clip in ordered))
    readme = f'''KEYBREAKERS — ANIMATION HANDOFF, V2
Detailed concept cast · built-in imagegen · 2026-11-09

{len(ordered)} clips / {len(assets)} endpoint PNGs. Counts and native image dimensions are recorded in manifest.json.

USE
Upload a clip’s first.png and last.png to your video app, then paste its prompt.txt. Use the proposed duration where supported. If the app requires a longer clip, keep one action and use the extra time to hold the endpoints. Disable generated audio. Durations are creative targets, not measured rendered clips.

Rivet’s endpoints are intentionally identical: the prompt supplies the blink and monocle turn between them. Other clips settle into a new pose. Use the images at their native aspect ratio without stretching. Files are untouched imagegen outputs; small generated texture differences can remain. No videos have been rendered or tested in a video app.

FILES
index.html shows every pair and its selectable motion prompt. PROMPTS.txt collects the prompts. Each clip folder has first.png, last.png, prompt.txt and image-prompts.json with exact image-generation prompts. manifest.json records frame hashes, dimensions and game trigger restrictions. The ten new clip folders also contain clip.json source briefs. Unused generation drafts are excluded from ZIP handoffs.

GROUPS
Crew: Rivet, hero thinking, Lemma, Grubb’s two gate reactions, Golden Seal.
Gatekeepers: Toll Troll, Alchemist, Stonemason, Three Guardians.
Creature cards: backwards crab, Grubb, tiny mouse, brush-bearing chameleon, paired magpies, shared-tail cats.

GAME USE
Keeper introductions run once on arrival; gates remain shut. Creature motions run only when the child intentionally inspects or selects a card and never evaluate that choice. No animation chooses a strategy for the child. Grubb’s gate reactions still require explicit deterministic gate outcomes. Hero celebration is reserved for an earned Golden Seal. All clips are silent. The separately controlled optional Seal chime remains the only game audio. Use a still for reduced-motion preferences if integrated later.

This pack uses the user-selected detailed concept cast, not the compact runtime sprites. It adds no video generation or new behavior to the live game. Source art and exact prompts remain in the repository. The original six-clip ZIP remains unchanged; the v2 ZIP includes the full expanded set.
'''
    (PACK / 'README.txt').write_text(readme)
    full_gallery = gallery(ordered)
    (PACK / 'index.html').write_text(full_gallery)
    LocalLinks().feed(full_gallery)
    full_zip = PACK.parent / 'keybreakers-animation-pack-v2.zip'
    archive(full_zip, list(TITLES), plan, readme, full_gallery)
    addon = {**plan, 'clips': [clip for clip in ordered if clip['id'] in ADDITIONS], 'assets': [asset for asset in assets if asset['clip'] in ADDITIONS]}
    addon_readme = readme.replace(f'{len(ordered)} clips / {len(assets)} endpoint PNGs.', f'{len(ADDITIONS)} new clips / {len(ADDITIONS) * 2} endpoint PNGs. This archive contains the gatekeepers and creature cards only.').replace('the v2 ZIP includes the full expanded set.', 'the separate v2 ZIP includes the full expanded set.')
    addon_readme = addon_readme.replace('Crew: Rivet, hero thinking, Lemma, Grubb’s two gate reactions, Golden Seal.\n', '')
    addon_zip = PACK.parent / 'keybreakers-gatekeepers-and-cards.zip'
    archive(addon_zip, ADDITIONS, addon, addon_readme, gallery(addon['clips']))
    report = {'clips': len(ordered), 'endpoint_files': len(assets), 'new_clips': len(ADDITIONS), 'new_endpoint_files': len(ADDITIONS) * 2, 'all_pairs_matching_dimensions': True, 'rivet_loop_byte_identical': True, 'archives': [str(full_zip.relative_to(ROOT)), str(addon_zip.relative_to(ROOT))], 'generation_tool': 'built-in imagegen', 'video_rendered': False}
    (PACK / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
