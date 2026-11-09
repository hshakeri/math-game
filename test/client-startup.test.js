import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const markup = readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');

// A small DOM surface, parsed from the real page and from generated innerHTML.
// Missing elements stay missing: this must exercise startup, not fabricate the
// IDs or calculator controls that app.js expects to find.
function pageDocument(html) {
  const listeners = () => ({
    handlers: new Map(),
    addEventListener(type, callback) {
      const entries = this.handlers.get(type) || [];
      this.handlers.set(type, [...entries, callback]);
    },
    removeEventListener(type, callback) {
      this.handlers.set(type, (this.handlers.get(type) || []).filter(item => item !== callback));
    },
    dispatch(type, event = {}) {
      for (const callback of this.handlers.get(type) || []) callback(event);
    }
  });
  const document = { ...listeners(), hidden: false, activeElement: null };
  function node(tagName = 'div', attributes = {}) {
    let innerHTML = '';
    const classes = new Set((attributes.class || '').split(/\s+/).filter(Boolean));
    const element = {
      ...listeners(), tagName: tagName.toUpperCase(), attributes,
      id: attributes.id || '', value: attributes.value || '', textContent: '',
      ownerDocument: document, children: [], parentElement: null,
      disabled: 'disabled' in attributes, hidden: 'hidden' in attributes, open: 'open' in attributes,
      style: {}, inert: false,
      classList: {
        add(value) { classes.add(value); }, remove(value) { classes.delete(value); },
        contains(value) { return classes.has(value); },
        toggle(value, force = !classes.has(value)) {
          if (force) classes.add(value); else classes.delete(value);
          return force;
        }
      },
      get innerHTML() { return innerHTML; },
      set innerHTML(value) { innerHTML = String(value); this.children = []; parse(innerHTML, this); },
      getAttribute(name) { return attributes[name] ?? null; },
      setAttribute(name, value) { attributes[name] = String(value); },
      appendChild(child) { child.parentElement = this; this.children.push(child); return child; },
      replaceChildren(...children) { this.children = []; children.forEach(child => this.appendChild(child)); },
      contains(target) { return target === this || this.children.some(child => child.contains(target)); },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      querySelectorAll(selector) {
        const found = [];
        for (const child of this.children) {
          if (matches(child, selector)) found.push(child);
          found.push(...child.querySelectorAll(selector));
        }
        return found;
      },
      focus() { document.activeElement = this; }
    };
    return element;
  }
  function matches(element, selector) {
    const exclusion = selector.match(/:not\(([^)]+)\)$/);
    if (exclusion) return matches(element, selector.slice(0, exclusion.index)) && !matches(element, exclusion[1]);
    if (selector.startsWith('#')) return element.id === selector.slice(1);
    if (selector.startsWith('.')) return element.classList.contains(selector.slice(1));
    const attribute = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    if (attribute) return attribute[1] in element.attributes
      && (attribute[2] === undefined || element.attributes[attribute[1]] === attribute[2]);
    return element.tagName.toLowerCase() === selector.toLowerCase();
  }
  function parse(source, parent) {
    const stack = [parent];
    const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    for (const match of source.matchAll(/<\/?([a-z][\w:-]*)\b([^>]*)>/gi)) {
      const tag = match[1].toLowerCase();
      if (match[0].startsWith('</')) {
        const index = stack.findLastIndex(item => item.tagName.toLowerCase() === tag);
        if (index > 0) stack.length = index;
      } else {
        const attributes = {};
        for (const attribute of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
          attributes[attribute[1]] = attribute[2] ?? attribute[3] ?? attribute[4] ?? '';
        }
        const child = stack.at(-1).appendChild(node(tag, attributes));
        if (!voids.has(tag) && !match[0].endsWith('/>')) stack.push(child);
      }
    }
  }
  const root = node('document');
  parse(html, root);
  document.getElementById = id => root.querySelector(`#${id}`);
  document.querySelector = selector => root.querySelector(selector);
  document.querySelectorAll = selector => root.querySelectorAll(selector);
  document.createElement = tag => node(tag);
  document.body = root.querySelector('body');
  const window = { ...listeners(), location: { hash: '#map' } };
  return { document, window };
}

const catalog = [
  { id: 'ch1-n1-reverse-tolls', node: 1, unlocked: true },
  { id: 'ch1-n2-dark-vault', node: 2, unlocked: false },
  { id: 'ch1-n3-five-shields', node: 3, unlocked: false },
  { id: 'ch1-n4-castle-keep', node: 4, unlocked: false }
];
const catalogResponse = () => ({ ok: true, json: async () => ({ ok: true, encounters: catalog }) });
let bootstrapCount = 0;

async function bootstrap(t, respond = catalogResponse) {
  const { document, window } = pageDocument(markup);
  const stored = new Map(), requests = [];
  const globals = {
    document, window,
    localStorage: {
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, String(value)),
      removeItem: key => stored.delete(key)
    },
    fetch: async url => {
      requests.push(url);
      assert.equal(url, '/api/encounters', 'Home startup must request the encounter catalog');
      return respond();
    }
  };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => {
    window.game?.cancelSpeech?.();
    window.game?.calculationTools?.dispose();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  assert.equal(document.getElementById('world-map-mount').innerHTML, '');
  const entry = document.querySelectorAll('script').find(script => script.getAttribute('type') === 'module');
  assert.ok(entry, 'The actual page must load a module entrypoint');
  const route = new URL(entry.getAttribute('src'), 'http://keybreakers.test/');
  const moduleUrl = new URL(`../client${route.pathname}`, import.meta.url);
  moduleUrl.search = route.search;
  moduleUrl.searchParams.set('startup-regression', String(++bootstrapCount));
  const { CastleGame } = await import(moduleUrl.href);
  assert.equal(window.handlers.get('DOMContentLoaded')?.length, 1);
  // No prototype replacements: initHero, speech, calculator, router and catalog
  // loading all run through the exact production constructor and bootstrap.
  window.dispatch('DOMContentLoaded');
  await new Promise(resolve => setImmediate(resolve));

  assert.ok(window.game instanceof CastleGame);
  assert.ok(requests.length > 0, 'Startup must reach catalog loading');
  return { document, window, requests };
}

test('page module bootstrap builds the playable home map from index.html', async t => {
  const { document, window } = await bootstrap(t);
  assert.deepEqual(window.game.allEncounters, catalog);
  assert.equal(document.getElementById('screen-map').classList.contains('hidden'), false);
  assert.equal(document.getElementById('screen-encounter').classList.contains('hidden'), true);
  const map = document.getElementById('world-map-mount').innerHTML;
  assert.match(map, /class="world-map"/);
  assert.match(map, /href="#encounter\?id=ch1-n1-reverse-tolls"/);
  assert.equal((map.match(/class="world-map-site /g) || []).length, catalog.length);
  assert.equal((map.match(/href="#encounter\?id=/g) || []).length, 1, 'Only the unlocked gate is playable');
  assert.ok(window.handlers.get('hashchange')?.length, 'Router must be bound');
  assert.ok(window.game.calculationTools, 'Optional tools must mount without stopping the map');
  assert.ok(document.getElementById('calculation-mount').querySelector('[data-calc-entry]'));
});

for (const failure of ['HTTP failure', 'network failure']) {
  test(`home startup exposes ${failure} and retry loads the playable road`, async t => {
    let recovered = false;
    const { document, window, requests } = await bootstrap(t, () => {
      if (recovered) return catalogResponse();
      if (failure === 'network failure') throw new TypeError('Network unavailable');
      return { ok: false, status: 503 };
    });
    const status = document.getElementById('map-load-status');
    const retry = document.getElementById('map-load-retry');
    assert.ok(status, 'The real page needs a visible catalog status');
    assert.ok(retry, 'The real page needs a retry control');
    assert.equal(status.classList.contains('hidden'), false);
    assert.match(status.textContent, /couldn.t load|could not load|try again/i);
    assert.equal(retry.classList.contains('hidden'), false);
    assert.equal(retry.disabled, false);
    assert.equal(document.getElementById('screen-map').classList.contains('hidden'), false);
    assert.doesNotMatch(document.getElementById('world-map-mount').innerHTML, /href="#encounter\?id=/,
      'A failed catalog must not manufacture gate access');

    const requestsBeforeRetry = requests.length;
    recovered = true;
    retry.dispatch('click', { target: retry });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, requestsBeforeRetry + 1, 'The actual retry listener must reload the catalog once');
    assert.deepEqual(window.game.allEncounters, catalog);
    const map = document.getElementById('world-map-mount').innerHTML;
    assert.equal((map.match(/class="world-map-site /g) || []).length, 4);
    assert.match(map, /href="#encounter\?id=ch1-n1-reverse-tolls"/);
    assert.equal((map.match(/href="#encounter\?id=/g) || []).length, 1);
    assert.equal(status.classList.contains('hidden'), true);
    assert.equal(retry.classList.contains('hidden'), true);
  });
}
