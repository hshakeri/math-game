/**
 * A single, explorable map. Presentation only: the server catalog owns access.
 * Node-safe, deterministic, and dependency-free; no browser globals at import.
 */
import { spritePath } from './pixel-art.js';

const PLACES = Object.freeze({
  'ch1-n1-reverse-tolls': { label: 'The Toll Troll', landmark: 'bridge' },
  'ch1-n2-dark-vault': { label: 'The Alchemist', landmark: 'vault' },
  'ch1-n3-five-shields': { label: 'The Stonemason', landmark: 'courtyard' },
  'ch1-n4-castle-keep': { label: 'Three Guardians', landmark: 'castle' }
});

const escape = value => String(value ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function catalogNodes(encounters) {
  const found = new Set();
  const entries = Array.isArray(encounters) ? encounters.filter(entry => {
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim() || found.has(entry.id)) return false;
    found.add(entry.id);
    return true;
  }) : [];
  // An absent catalog must never manufacture permission to enter a gate.
  const source = entries.length ? entries : Object.keys(PLACES).map(id => ({ id }));
  return source.map((entry, i) => ({
    id: entry.id,
    label: PLACES[entry.id]?.label || (typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : 'A further gate'),
    landmark: PLACES[entry.id]?.landmark || 'gate',
    completed: entry.completed === true,
    available: entry.unlocked === true || entry.completed === true,
    index: i
  }));
}

function layout(count, portrait = false) {
  const extra = Math.max(0, count - 4);
  const extension = extra * (portrait ? 220 : 180);
  const width = portrait ? 600 : 1200;
  const height = (portrait ? 1200 : 740) + extension;
  // Portrait starts near the top so the boy and first playable gate are visible
  // immediately. Later gates and future chapters continue down the same road.
  const base = portrait ? [[366, 370], [174, 590], [414, 810], [280, 1030]] : [[305, 500], [505, 250], [790, 465], [1010, 210]];
  const nodes = Array.from({ length: count }, (_, i) => i < 4
    ? [base[i][0], base[i][1] + (portrait ? 0 : extension)]
    : portrait
      ? [i % 2 ? 410 : 190, 1250 + (i - 4) * 220]
      : [i % 2 ? 990 : 665, 145 + (extra - 1 - (i - 4)) * 180]);
  return { width, height, nodes, start: portrait ? [150, 210] : [114, 635 + extension], extension };
}

function routePath(points) {
  return points.reduce((d, [x, y], i) => {
    if (!i) return `M${x} ${y}`;
    const [px, py] = points[i - 1];
    const direction = y >= py ? 1 : -1;
    return `${d} C${px} ${py + direction * 80},${x} ${y - direction * 85},${x} ${y}`;
  }, '');
}

function tree(x, y, scale = 1, dark = false) {
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M-3 0h6v-30h-6z" fill="#68735a"/><path d="M0-62-20-30h8l-17 23h58L12-30h8Z" fill="${dark ? '#53725d' : '#719071'}"/><path d="M0-62-20-30h8l-17 23H0Z" fill="${dark ? '#668368' : '#8ca17c'}"/><path d="M-12-30H7M-17-16H4" stroke="${dark ? '#53725d' : '#719071'}" stroke-width="3"/></g>`;
}

function cloud(x, y, scale = 1, tint = '#f4f4e8') {
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="${tint}"><ellipse cx="0" cy="0" rx="85" ry="29"/><ellipse cx="-44" cy="-17" rx="33" ry="24"/><ellipse cx="3" cy="-27" rx="47" ry="36"/><ellipse cx="50" cy="-10" rx="36" ry="29"/></g>`;
}

function terrain(view, portrait) {
  const { width: w, height: h, nodes, start, extension } = view;
  const scale = portrait ? 0.8 : 1;
  const route = routePath([start, ...nodes]);
  const hills = portrait
    ? `<path d="M45 ${h * .52} 125 ${h * .39} 210 ${h * .48} 300 ${h * .32} 395 ${h * .46} 555 ${h * .36}V${h - 60}H45Z" fill="#a9b999"/><path d="M45 ${h * .73} 175 ${h * .57} 280 ${h * .66} 405 ${h * .51} 555 ${h * .63}V${h - 60}H45Z" fill="#97ae8b"/>`
    : `<path d="M64 ${h * .62} 190 ${h * .35} 355 ${h * .48} 530 ${h * .25} 710 ${h * .48} 900 ${h * .32} 1135 ${h * .48}V${h - 60}H64Z" fill="#a9b999"/><path d="M65 ${h * .8} 245 ${h * .59} 390 ${h * .7} 610 ${h * .53} 835 ${h * .68} 1065 ${h * .5} 1138 ${h * .63}V${h - 60}H65Z" fill="#97ae8b"/>`;
  const trees = portrait
    ? [[75, 280], [105, 320], [500, 530], [535, 572], [80, 760], [100, 800], [475, 930]]
    : [[100, 390], [130, 420], [195, 360], [365, 375], [405, 398], [615, 565], [655, 590], [895, 560], [935, 590], [1100, 390], [1125, 430]];
  const treeArt = trees.map(([x, y], i) => tree(x, y + (portrait ? 0 : extension), scale * (i % 3 === 0 ? 1.2 : .9), i % 3 === 0)).join('');
  const extensionTrees = Array.from({ length: Math.max(0, nodes.length - 4) }, (_, i) => tree(portrait ? (i % 2 ? 90 : 500) : (i % 2 ? 430 : 1085), (portrait ? 1200 : 185) + i * (portrait ? 220 : 180), scale)).join('');
  const lake = portrait
    ? `<path d="M399 ${h - 205}q90-68 149-9l-9 76-58 43-78-29-35-41Z" fill="#8aaea7"/><path d="m400 ${h - 170} 45-19 61 4m-91 34 52 8 45-17" stroke="#c5d5bf" stroke-width="4" fill="none"/>`
    : `<path d="M710 ${h - 118}q42-59 120-41l89-5 87 31 65 48-63 31-146-7-112-11Z" fill="#8aaea7"/><path d="m770 ${h - 115} 74-14 57 7m-91 29 78 6 42-10m27-3 46 16" stroke="#c5d5bf" stroke-width="4" fill="none"/>`;
  const land = `M${w * .1} 140Q${w * .2} 65 ${w * .34} 110Q${w * .47} 58 ${w * .61} 94Q${w * .77} 54 ${w * .91} 146L${w * .96} ${h * .56}Q${w} ${h * .79} ${w * .88} ${h - 73}Q${w * .7} ${h + 8} ${w * .51} ${h - 53}Q${w * .32} ${h + 4} ${w * .12} ${h - 73}Q${w * .01} ${h - 101} ${w * .05} ${h * .57}Z`;
  const cloudArt = [cloud(w * .08, 156, portrait ? .8 : 1.1), cloud(w * .9, 140, portrait ? .8 : 1.25), cloud(w * .11, h - 36, portrait ? .85 : 1.4), cloud(w * .87, h - 26, portrait ? .9 : 1.35), cloud(w * .55, h - 4, portrait ? 1 : 1.5)].join('');
  return `<svg class="world-map-terrain ${portrait ? 'world-map-terrain-portrait' : 'world-map-terrain-landscape'}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs><clipPath id="wm-land-${portrait ? 'p' : 'l'}"><path d="${land}"/></clipPath></defs>
    <path d="${land}" fill="#b5c5ae" transform="translate(0 18)"/>
    <path d="${land}" fill="#c3cdae"/>
    <g clip-path="url(#wm-land-${portrait ? 'p' : 'l'})">${hills}
      <path d="M${w * .13} ${h * .38}q${w * .15}-${h * .11} ${w * .31} 0m${w * .1} ${h * .15}q${w * .16}-${h * .1} ${w * .3} 0" stroke="#d6dbc2" stroke-width="2" opacity=".5" fill="none"/>
      ${lake}
      <path d="${route}" fill="none" stroke="#839578" stroke-width="24" stroke-linecap="round"/>
      <path d="${route}" fill="none" stroke="#d7c69b" stroke-width="17" stroke-linecap="round"/>
      <path d="${route}" fill="none" stroke="#f2e0b3" stroke-width="2" stroke-dasharray="2 18" stroke-linecap="round"/>
      ${treeArt}${extensionTrees}
      ${nodes.map(([x, y]) => `<ellipse cx="${x}" cy="${y + 13}" rx="57" ry="20" fill="#b5be97"/><ellipse cx="${x}" cy="${y + 13}" rx="40" ry="12" fill="#c9cca7"/>`).join('')}
    </g>${cloudArt}
    ${cloud(w * .43, 65, portrait ? .55 : .75, '#edf1e1')}
  </svg>`;
}

function landmark(kind) {
  const common = 'fill="#adad91" stroke="#566d5e" stroke-width="2" stroke-linejoin="round"';
  const gate = `<path d="M55 79V47q15-22 30 0v32Z" fill="#485e51"/><path d="M59 77V48q11-16 22 0v29Z" fill="#767a5c"/><path d="M64 45v32m7-35v35m7-31v31M59 58h22" stroke="#b4a777" stroke-width="2"/>`;
  let art;
  if (kind === 'bridge') {
    art = `<path d="M8 91q22-13 45 0t44 0 37 0" fill="none" stroke="#8eafa6" stroke-width="10"/><path d="M15 82 28 64h87l13 18v8H15Z" ${common}/><path d="M30 79q12-18 24 0v11H30m27-11q12-18 24 0v11H57m27-11q12-18 24 0v11H84" fill="#738b77" stroke="#566d5e" stroke-width="2"/><path d="M34 64V30h26v34m28 0V30h26v34" ${common}/><path d="M30 30h34v8H30m54-8h34v8H84" fill="#d4c6a0" stroke="#566d5e" stroke-width="2"/><path d="M45 30V16l18 4-18 8" fill="#ad8352" stroke="#566d5e" stroke-width="2"/><path d="M39 48h16m38 0h16" stroke="#d9d0ac" stroke-width="3"/>`;
  } else if (kind === 'vault') {
    art = `<path d="M22 84V44l21-12 28-12 27 12 20 12v40Z" ${common}/><path d="M17 45 41 30l30-17 29 17 23 15-8 6-44-25-45 25Z" fill="#627c6a" stroke="#465f53" stroke-width="2"/>${gate}<path d="M36 53h10v14H36m62-14h10v14H98" fill="#bf9a57" stroke="#566d5e" stroke-width="2"/><path d="M16 85h110v5H16" fill="#d0c4a1" stroke="#566d5e" stroke-width="2"/><path d="M32 77h17m44 0h17M27 42l10-6m64-1 12 8" stroke="#d3cfac" stroke-width="2"/>`;
  } else if (kind === 'courtyard') {
    art = `<path d="m15 79 52-17 63 16-49 20Z" fill="#c6bea0" stroke="#6a7b65" stroke-width="2"/><path d="M25 78V38h13v36m68 2V38h13v43" ${common}/><path d="M21 32h21v9H21m81-9h21v9h-21M30 33q40-48 83 0" fill="none" stroke="#9fa98a" stroke-width="10"/><path d="M33 28q37-32 76 0" fill="none" stroke="#d3c8a5" stroke-width="3"/><path d="M58 76V51h26v29" ${common}/><path d="m53 50 18-8 19 8-6 5H57Z" fill="#d1c6a5" stroke="#566d5e" stroke-width="2"/><path d="m27 85 20-7m8 15 19-7m15 4 14-8" stroke="#929e81" stroke-width="2"/><path d="m22 49 10 8 6-5m65 8 9-9" stroke="#719269" stroke-width="5"/>`;
  } else if (kind === 'castle') {
    art = `<path d="M23 81V35h24v46m49 0V35h24v46M46 80V45h51v35" ${common}/><path d="M20 27h8v9h6v-9h8v9h8v9H20m73-18h8v9h6v-9h8v9h8v9H93" fill="#c4bea0" stroke="#566d5e" stroke-width="2"/><path d="M56 47V20h30v27" ${common}/><path d="m52 20 19-16 19 16Z" fill="#627b69" stroke="#465f53" stroke-width="2"/><path d="M71 4V-6l18 4-18 6" fill="#b18b50" stroke="#566d5e" stroke-width="2"/>${gate}<path d="M34 50v10m74-10v10M69 27v10" stroke="#506758" stroke-width="5"/><path d="M18 81h109v8H18" fill="#d0c4a1" stroke="#566d5e" stroke-width="2"/>`;
  } else {
    art = `<path d="M39 81V31h64v50Z" ${common}/><path d="M34 24h74v10H34" fill="#d0c4a1" stroke="#566d5e" stroke-width="2"/>${gate}<path d="M33 82h76v7H33" fill="#d0c4a1" stroke="#566d5e" stroke-width="2"/>`;
  }
  return `<svg class="world-map-landmark" viewBox="0 -10 142 115" aria-hidden="true" focusable="false"><ellipse cx="71" cy="88" rx="58" ry="10" fill="#5c7657" opacity=".16"/>${art}</svg>`;
}

/** Catalog order defines the road; future nodes extend the same island. */
export function renderWorldMap(encounters = []) {
  const nodes = catalogNodes(encounters);
  const landscape = layout(nodes.length);
  const portrait = layout(nodes.length, true);
  const extra = Math.max(0, nodes.length - 4);
  const placements = (a, b) => `--wm-x:${a[0] / landscape.width * 100}%;--wm-y:${a[1] / landscape.height * 100}%;--wm-px:${b[0] / portrait.width * 100}%;--wm-py:${b[1] / portrait.height * 100}%`;
  const sites = nodes.map((node, i) => {
    const labelId = `world-map-label-${i}`;
    const noteId = `world-map-note-${i}`;
    const previous = i ? nodes[i - 1].label : '';
    const stateText = node.completed ? 'Gate open · revisit' : node.available ? 'Enter the gate →' : previous ? `After ${previous}` : 'The road is being prepared';
    const state = node.completed ? 'complete' : node.available ? 'available' : 'locked';
    const content = `${landmark(node.landmark)}<span class="world-map-place-label"><span id="${labelId}" class="world-map-place-name">${escape(node.label)}</span><span id="${noteId}" class="world-map-place-note">${!node.available ? '<span class="world-map-lock" aria-hidden="true">◇</span> ' : ''}${escape(stateText)}</span></span>${node.completed ? '<span class="world-map-seal" aria-label="Golden Seal">◆</span>' : ''}`;
    const location = node.available
      ? `<a class="world-map-place" href="#encounter?id=${encodeURIComponent(node.id)}" aria-labelledby="${labelId}" aria-describedby="${noteId}">${content}</a>`
      : `<div class="world-map-place" role="group" aria-disabled="true" aria-labelledby="${labelId}" aria-describedby="${noteId}">${content}<span class="world-map-sr-only">This gate is locked. ${previous ? `Open ${escape(previous)} first.` : 'Wait for the encounter catalog to load.'}</span></div>`;
    return `<li class="world-map-site is-${state}" style="${placements(landscape.nodes[i], portrait.nodes[i])}" data-encounter="${escape(node.id)}">${location}</li>`;
  }).join('');
  return `<section class="world-map" aria-label="The road to the Castle of Theorems">
    <div class="world-map-canvas" style="--wm-extra:${extra}">
      ${terrain(landscape, false)}${terrain(portrait, true)}
      <div class="world-map-heading"><p>Your road to the castle</p><span>Tap the first gate to begin.</span></div>
      <ol class="world-map-sites" aria-label="Gates along the road">${sites}</ol>
      <div class="world-map-start" style="${placements(landscape.start, portrait.start)}"><img src="${spritePath('hero', { variant: 1, pose: 'idle' })}" width="96" height="96" alt="Your Keybreaker, a boy with goggles, a scarf and a card satchel" draggable="false"><span>Your Keybreaker</span><small>He’s ready when you are.</small></div>
      <p class="world-map-destination">THE CASTLE OF THEOREMS<span>A little further, a little more to discover.</span></p>
    </div>
  </section>`;
}
