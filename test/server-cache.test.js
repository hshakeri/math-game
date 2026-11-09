import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, closeServer } from '../server/index.js';

test('deployable HTML, scripts, styles, and manifest require cache revalidation', async t => {
  const { server, url } = await startServer(0, '127.0.0.1');
  t.after(() => closeServer(server));
  for (const route of ['/', '/index.html', '/parent', '/app.js', '/world-map.js', '/style.css', '/world-map.css', '/adventure.css', '/manifest.webmanifest']) {
    const response = await fetch(url + route);
    await response.arrayBuffer();
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('cache-control') || '', /\bno-cache\b/,
      `${route} must revalidate so older scripts cannot silently run against new HTML`);
  }
});

test('page assets use absolute versioned URLs and still load from a nested bookmark', async t => {
  const { server, url } = await startServer(0, '127.0.0.1');
  t.after(() => closeServer(server));
  const response = await fetch(`${url}/n/first-gate`);
  assert.equal(response.status, 200);
  const html = await response.text();
  const tags = [...html.matchAll(/<(script|link)\b([^>]*)>/g)].map(([, tag, attributes]) => ({
    tag, ...Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]))
  }));
  const assets = tags.filter(tag => tag.type === 'module' || tag.rel === 'stylesheet');
  assert.ok(assets.some(tag => tag.type === 'module'), 'The page needs its real module entrypoint');
  assert.ok(assets.some(tag => tag.rel === 'stylesheet'), 'The page needs its styles');
  for (const tag of assets) {
    const reference = tag.src || tag.href;
    assert.match(reference, /^\/(?!\/)/, 'Root-relative assets must survive nested SPA bookmarks');
    const resolved = new URL(reference, `${url}/n/first-gate`);
    assert.ok(resolved.searchParams.get('v'), `${reference} needs a deployment version to bypass already-fresh browser cache`);
    const asset = await fetch(resolved);
    await asset.arrayBuffer();
    assert.equal(asset.status, 200, reference);
    assert.match(asset.headers.get('content-type') || '', tag.type === 'module' ? /javascript/ : /text\/css/);
  }
});
