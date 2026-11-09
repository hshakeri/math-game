import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CastleGame } from '../client/app.js';

const markup = readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');

function historyHarness(t) {
  const game = new CastleGame();
  const elements = new Map([...markup.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, { innerHTML: '', scrollTop: 0, scrollHeight: 0, clientHeight: 0 }]));
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById: id => elements.get(id) || null } });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'document', original); else delete globalThis.document; });
  return { game, log: elements.get('dialogue-history-log') };
}

test('delivered child and Rivet messages remain visible in the actual encounter history', t => {
  const { game, log } = historyHarness(t);
  game.appendHistory('You', 'I would work from the end.');
  game.appendHistory('Rivet', 'Which part of your plan would you try next?');
  assert.ok(log, 'Encounter markup must contain the conversation history');
  assert.match(log.innerHTML, /I would work from the end/);
  assert.match(log.innerHTML, /Which part of your plan/);
  assert.match(markup, /<details[^>]*\bid="dialogue-history-details"[^>]*\bopen\b/);
});
