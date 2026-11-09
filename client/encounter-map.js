/** Comic story built only from the public inscription and explicit public givens. */
import { escapeHTML, CAST } from './story.js';
import { sprite } from './pixel-art.js';
import { illustration, KEEPER_ILLUSTRATIONS } from './illustrations.js';

function narrator(view, kind) {
  if (kind === 'rivet') return { speaker: 'Rivet', role: 'Owl guide', art: 'rivet' };
  if (kind === 'grubb') return { speaker: 'Grubb', role: 'Goblin challenger', art: 'grubb-neutral' };
  return { speaker: CAST[view.encounterId]?.name || 'The gatekeeper', role: 'Keeper', art: KEEPER_ILLUSTRATIONS[view.encounterId] };
}

export function storyStops(view) {
  if (view.story?.kind === 'dark-vault') {
    const beats = Array.isArray(view.story.beats) ? view.story.beats : [];
    return [
      ['chest', 'The chest', 'keeper'],
      ['rules', 'The rules', 'rivet'],
      ['goal', 'This torch', 'grubb']
    ].map(([id, name, speaker]) => ({
      id, name, words: beats.find(beat => beat.id === id)?.text || '', ...narrator(view, speaker)
    }));
  }
  if (view.story?.kind === 'toll-road') {
    const gates = view.story.gates || [];
    return [
      { name: 'The beginning', icon: 'start', words: 'A boy sets out for the castle with a pouch of Star-Coins. How many coins did he start with?', ...narrator(view, 'rivet') },
      ...gates.map((gate, i) => ({ name: `Gate ${i + 1}`, icon: 'gate', words: `His coins ${gate.mul === 2 ? 'double' : `become ${gate.mul} times as many`}. Then he pays ${gate.sub} Star-Coins.`, rule: `× ${gate.mul} → − ${gate.sub}`, ...narrator(view, 'keeper') })),
      { name: 'The castle', icon: 'castle', words: `He reaches the castle with exactly ${view.story.end} Star-Coins.`, rule: `${view.story.end} coins left`, ...narrator(view, 'rivet') }
    ];
  }
  const sentences = String(view.inscription || '').split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean);
  return sentences.map((words, i) => ({
    name: i === 0 ? 'The story' : i === sentences.length - 1 ? 'Your challenge' : `Clue ${i}`,
    words, ...narrator(view, ['keeper', 'rivet', 'grubb'][i % 3])
  }));
}

const road = `<svg class="story-landscape" viewBox="0 0 1100 420" preserveAspectRatio="none" aria-hidden="true">
<defs><linearGradient id="story-mist" x2="0" y2="1"><stop stop-color="#809a8f"/><stop offset="1" stop-color="#d2d5b8"/></linearGradient></defs>
<rect width="1100" height="420" fill="url(#story-mist)"/>
<path d="M0 190 110 65 200 140 320 40 420 155 550 85 700 160 850 70 970 130 1100 30V420H0Z" fill="#506d62" opacity=".55"/>
<path d="M0 310Q140 190 310 260T610 240T880 270T1100 205V420H0" fill="#648271"/>
<path d="M0 370Q160 290 350 330T720 310T1100 340V420H0" fill="#425f52"/>
<g class="story-road-wide"><path d="M60 330C200 330 180 170 350 190S520 330 650 240S790 130 1030 170" fill="none" stroke="#304b44" stroke-width="46"/>
<path d="M60 321C200 321 180 161 350 181S520 321 650 231S790 121 1030 161" fill="none" stroke="#c5b18a" stroke-width="32"/>
<path d="M60 321C200 321 180 161 350 181S520 321 650 231S790 121 1030 161" fill="none" stroke="#e4d3aa" stroke-width="3" stroke-dasharray="5 13"/>
</g>
<g class="story-road-narrow"><path d="M264 345V80Q264 15 440 65L680 105Q836 130 836 180V285" fill="none" stroke="#304b44" stroke-width="90"/><path d="M264 345V80Q264 15 440 65L680 105Q836 130 836 180V285" fill="none" stroke="#c5b18a" stroke-width="68"/><path d="M264 345V80Q264 15 440 65L680 105Q836 130 836 180V285" fill="none" stroke="#e4d3aa" stroke-width="5" stroke-dasharray="7 14"/></g>
<g fill="#284c40"><path d="m90 195 24-55 24 55h-14l20 36H84l20-36Z"/><path d="m390 110 20-51 20 51h-12l16 32h-48l16-32Z"/><path d="m735 335 24-60 24 60h-14l20 36h-60l20-36Z"/></g>
<g fill="#dce0c7" opacity=".5"><ellipse cx="60" cy="405" rx="170" ry="30"/><ellipse cx="410" cy="410" rx="230" ry="25"/><ellipse cx="1030" cy="390" rx="200" ry="40"/></g></svg>`;

function landmark(icon) {
  if (icon === 'start') return sprite('hero', { variant: 1, label: 'The boy at the beginning of his journey' });
  if (icon === 'castle') return `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M10 70V20h12v10h12V12h12v18h12V20h12v50Z" fill="#cfbd98" stroke="#394b43" stroke-width="3"/><path d="M29 70V50a11 11 0 0 1 22 0v20" fill="#384e44"/><path d="M37 12V3h22l-7 8H37" fill="#b57d3f"/></svg>`;
  return `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M15 74V30a25 25 0 0 1 50 0v44H54V30a14 14 0 0 0-28 0v44Z" fill="#c6b898" stroke="#3a4d43" stroke-width="3"/><path d="M26 74V30a14 14 0 0 1 28 0v44" fill="#695744"/><path d="M28 42h24M28 60h24" stroke="#c59d55" stroke-width="4"/></svg>`;
}

export function renderEncounterMap(view, selected = 0) {
  const stops = storyStops(view);
  const active = Math.max(0, Math.min(Number.isFinite(selected) ? Math.trunc(selected) : 0, stops.length - 1));
  const tolls = view.story?.kind === 'toll-road';
  const current = stops[active] || { name: 'The story', words: view.inscription || '', ...narrator(view, 'keeper') };
  const positions = [[8,70],[28,36],[49,62],[70,30],[91,42]];
  const nodes = stops.map((stop, i) => {
    const [x,y] = tolls ? positions[i] || [10 + i * 80 / Math.max(1, stops.length - 1), 50]
      : [100 * (i + .5) / Math.max(1, stops.length), 82];
    return `<button class="story-stop ${i === active ? 'is-current' : ''}" type="button" data-story-stop="${i}" aria-pressed="${i === active}" aria-controls="story-active-caption" aria-label="${escapeHTML(stop.name)} — ${escapeHTML(stop.speaker)}, ${escapeHTML(stop.role)}: ${escapeHTML(stop.words)}" style="--story-x:${x}%;--story-y:${y}%">
      ${tolls ? `<span class="story-landmark${i === active ? ' story-landmark-selected' : ''}">${landmark(stop.icon)}</span>` : ''}<strong>${escapeHTML(stop.name)}</strong>${stop.rule ? `<span class="story-rule">${escapeHTML(stop.rule)}</span>` : ''}</button>`;
  }).join('');
  const scene = tolls ? road : illustration(current.art, { priority: true });
  const controls = `<div class="story-stops" aria-label="Explore the story">${nodes}</div>`;
  return `<div class="comic-map ${tolls ? 'comic-map-tolls' : 'comic-map-keeper'}">
    <div class="story-frame">
      <div class="story-map-art" data-story-art="${escapeHTML(tolls ? 'toll-road' : current.art)}">${scene}${tolls ? `<span class="map-keeper" aria-hidden="true">${sprite('troll')}</span>` : ''}</div>
      ${tolls ? controls : ''}
      <div id="story-active-caption" class="story-caption" aria-live="polite" aria-atomic="true"><span class="story-speaker"><strong>${escapeHTML(current.speaker)}</strong><span>${escapeHTML(current.role)}</span></span><p>${escapeHTML(current.words)}</p></div>
    </div>
    ${tolls ? '' : controls}
    <div class="story-reading-controls"><button type="button" class="story-next" data-story-next>${active < stops.length - 1 ? 'Next part of the story →' : 'Read the story again ↺'}</button><span>Tap a place to read it again.</span></div>
  </div>`;
}
