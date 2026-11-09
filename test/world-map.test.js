import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderWorldMap } from '../client/world-map.js';

const ids = ['ch1-n1-reverse-tolls', 'ch1-n2-dark-vault', 'ch1-n3-five-shields', 'ch1-n4-castle-keep'];

describe('World map catalog access and presentation', () => {
  it('creates encounter links only for explicit server access or completion', () => {
    const html = renderWorldMap([
      { id: ids[0], unlocked: true },
      { id: ids[1], unlocked: false },
      { id: ids[2], unlocked: 'true', completed: 'true' },
      { id: ids[3], unlocked: false, completed: true }
    ]);
    assert.match(html, new RegExp(`href="#encounter\\?id=${ids[0]}"`));
    assert.match(html, new RegExp(`href="#encounter\\?id=${ids[3]}"`));
    assert.doesNotMatch(html, new RegExp(`href="#encounter\\?id=${ids[1]}"`));
    assert.doesNotMatch(html, new RegExp(`href="#encounter\\?id=${ids[2]}"`));
    assert.match(html, /This gate is locked\. Open The Toll Troll first\./);
    assert.match(html, /Gate open · revisit/);
  });

  it('does not invent access when the catalog is missing or malformed', () => {
    for (const input of [undefined, [], null, {}, [null, {}, { id: '' }]]) {
      const html = renderWorldMap(input);
      assert.equal((html.match(/class="world-map-site is-/g) || []).length, 4);
      assert.doesNotMatch(html, /href="#encounter/);
    }
  });

  it('escapes titles and IDs while encoding encounter URLs', () => {
    const id = 'chapter?"<script>&';
    const html = renderWorldMap([{ id, title: '<img src=x onerror="bad">', unlocked: true }]);
    assert.ok(html.includes(`href="#encounter?id=${encodeURIComponent(id)}"`));
    assert.match(html, /&lt;img src=x onerror=&quot;bad&quot;&gt;/);
    assert.doesNotMatch(html, /<script>|<img src=x/);
  });

  it('extends the same map for future catalog entries and ignores duplicate IDs', () => {
    const catalog = [...ids.map(id => ({ id })), { id: 'ch2-n1', title: 'The next island', unlocked: true }];
    const html = renderWorldMap([...catalog, catalog[0]]);
    assert.equal((html.match(/class="world-map-site is-/g) || []).length, 5);
    assert.match(html, /--wm-extra:1/);
    assert.match(html, /href="#encounter\?id=ch2-n1"/);
    assert.match(html, /The next island/);
    assert.doesNotMatch(html, /NaN|undefined/);
  });

  it('keeps the boy hero fixed at the start and supplies both responsive map layouts', () => {
    const html = renderWorldMap([{ id: ids[0], unlocked: true }]);
    assert.match(html, /src="\/assets\/sprites\/hero-1-idle\.svg"/);
    assert.match(html, /He’s ready when you are/);
    assert.match(html, /world-map-terrain-landscape/);
    assert.match(html, /world-map-terrain-portrait/);
    assert.doesNotMatch(html, /<input|<select|hero-options|begin-adventure/);
  });

  it('places the boy and first playable gate above later locked gates in portrait', () => {
    const html = renderWorldMap(ids.map((id, index) => ({ id, unlocked: index === 0 })));
    const sites = [...html.matchAll(/<li class="world-map-site[^>]*style="([^"]+)"/g)];
    const y = sites.map(match => Number(match[1].match(/--wm-py:([\d.]+)%/)[1]));
    const heroStyle = html.match(/<div class="world-map-start" style="([^"]+)"/)[1];
    const heroY = Number(heroStyle.match(/--wm-py:([\d.]+)%/)[1]);
    assert.ok(heroY < y[0]);
    assert.deepEqual([...y].sort((a, b) => a - b), y, 'Portrait reading order follows the road');
    assert.ok(y[0] * 1200 / 100 < 420, 'The first playable gate must be in the initial viewport');
    const heroX = Number(heroStyle.match(/--wm-px:([\d.]+)%/)[1]);
    assert.ok(heroX * 312 / 100 >= 145 / 2, 'The fixed hero label fits a 320px phone layout');
  });

  it('appends future portrait gates without pushing the first gate below the fold', () => {
    function positions(catalog) {
      const html = renderWorldMap(catalog);
      const height = Number(html.match(/world-map-terrain-portrait" viewBox="0 0 600 (\d+)"/)[1]);
      return [...html.matchAll(/<li class="world-map-site[^>]*style="([^"]+)"/g)]
        .map(match => Number(match[1].match(/--wm-py:([\d.]+)%/)[1]) * height / 100);
    }
    const original = ids.map((id, index) => ({ id, unlocked: index === 0 }));
    const originalY = positions(original);
    const extendedY = positions([...original, { id: 'ch2-n1' }, { id: 'ch2-n2' }]);
    for (let i = 0; i < original.length; i++) assert.ok(Math.abs(originalY[i] - extendedY[i]) < 1e-8);
    assert.ok(extendedY[4] > extendedY[3] && extendedY[5] > extendedY[4]);
  });
});
