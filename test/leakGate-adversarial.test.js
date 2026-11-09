/**
 * Castle of Theorems v1 (Home Edition)
 * Adversarial Leak Gate & Scripted Probes Stress Suite
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dns from 'node:dns';

import { checkUtterance, extractNumbers, PRAISE_PATTERNS } from '../server/engine/leakGate.js';
import { SCRIPTED_PROBES, getScriptedProbe } from '../server/engine/scripted.js';
import { createSession, transition } from '../server/engine/stateMachine.js';

test('1. Obfuscated numbers and word boundaries', async (t) => {
  await t.test('standard obfuscations and word forms are correctly extracted and rejected', () => {
    // 1. "twenty-four" in Castle Keep (target 24, forbidden)
    const u24 = 'Could the answer be twenty-four runes carved into the high archway above?';
    const res24 = checkUtterance(u24, { rung: 'l0', forbidden: [2, 5, 17, 24], givens: [34, 85] });
    assert.strictEqual(res24.allowed, false, 'twenty-four should be rejected');
    assert.strictEqual(res24.reason, 'forbidden');

    // 2. "twenty four" (single space) in Castle Keep
    const u24_space = 'Could the answer be twenty four runes carved into the high archway above?';
    const res24_space = checkUtterance(u24_space, { rung: 'l0', forbidden: [2, 5, 17, 24], givens: [34, 85] });
    assert.strictEqual(res24_space.allowed, false, 'twenty four should be rejected');
    assert.strictEqual(res24_space.reason, 'forbidden');

    // 3. "17th" ordinal in Castle Keep (intermediate 17, forbidden)
    const u17th = 'Does Kimmy match the 17th mark along the stone column of the keep?';
    const res17th = checkUtterance(u17th, { rung: 'l0', forbidden: [2, 5, 17, 24], givens: [34, 85] });
    assert.strictEqual(res17th.allowed, false, '17th should be rejected');

    // 4. "seventeenth" word ordinal in Castle Keep
    const u17_word = 'Does Kimmy match the seventeenth mark along the stone column of the keep?';
    const res17_word = checkUtterance(u17_word, { rung: 'l0', forbidden: [2, 5, 17, 24], givens: [34, 85] });
    assert.strictEqual(res17_word.allowed, false, 'seventeenth should be rejected');
    assert.strictEqual(res17_word.reason, 'forbidden');

    // 5. "a dozen" in Reverse Tolls (12 is forbidden)
    const u_dozen = 'Could she carry a dozen coins into the castle at the end of the road?';
    const res_dozen = checkUtterance(u_dozen, { rung: 'l0', forbidden: [6, 7, 11, 12, 14, 22], givens: [3, 5, 9, 13] });
    assert.strictEqual(res_dozen.allowed, false, 'a dozen should be rejected');
    assert.strictEqual(res_dozen.reason, 'forbidden');

    // 6. "06" leading zero in Reverse Tolls (6 is start/forbidden)
    const u06 = 'Could she have started with 06 coins in the pouch before the gates?';
    const res06 = checkUtterance(u06, { rung: 'l0', forbidden: [6, 7, 11, 12, 14, 22], givens: [3, 5, 9, 13] });
    assert.strictEqual(res06.allowed, false, '06 should be rejected');

    // 7. "3/4" fraction at rung l2 (where 3 or 4 are forbidden)
    const u_frac = 'Could we take 3/4 of the crystals from the chest to make our torches?';
    const res_frac = checkUtterance(u_frac, { rung: 'l2', forbidden: [3, 4], givens: [12] });
    assert.strictEqual(res_frac.allowed, false, '3/4 should be rejected at l2');
  });

  await t.test('hyphenation spacing variations (twenty - four) bypass compound regex', () => {
    // In Castle Keep, 24 is the answer. Neither 20 nor 4 is in forbidden [2, 5, 17, 24].
    const u_hyphen_space = 'Could the starting number of runes be twenty - four in total across the ancient stone arch?';
    const res = checkUtterance(u_hyphen_space, { rung: 'l0', forbidden: [2, 5, 17, 24], givens: [34, 85] });
    assert.strictEqual(res.allowed, false, 'twenty - four MUST be rejected as forbidden value 24');
  });

  await t.test('multi-space compound number (twenty  four) bypass compound regex', () => {
    const u_multi_space = 'Could the starting number of runes be twenty  four in total across the ancient stone arch?';
    const res = checkUtterance(u_multi_space, { rung: 'l0', forbidden: [2, 5, 17, 24], givens: [34, 85] });
    assert.strictEqual(res.allowed, false, 'twenty  four MUST be rejected as forbidden value 24');
  });

  await t.test('cardinal number word "hundred" missing from numeric dictionaries', () => {
    const nums = extractNumbers('one hundred coins');
    assert.ok(nums.some(n => n.value === 100), 'extractNumbers must extract 100 for "one hundred"');
  });
});

test('2. Forbidden token collisions in Castle Keep', () => {
  const baseCtx = { rung: 'l0', forbidden: [2, 5, 17, 24], givens: [34, 85] };

  const variations = [
    { text: 'Look at the two runes on the ancient archway and consider what they share in common?', token: 'two' },
    { text: 'Look at the second rune on the ancient archway and consider what they share in common?', token: 'second' },
    { text: 'Two runes stand upon the archway ready for you to unlock their secrets today?', token: 'Two' },
    { text: 'Look at the SECOND rune on the ancient archway and consider what they share in common?', token: 'SECOND' },
    { text: 'Look at the 2 runes on the ancient archway and consider what they share in common?', token: '2' },
    { text: 'Look at the 2nd rune on the ancient archway and consider what they share in common?', token: '2nd' }
  ];

  for (const { text, token } of variations) {
    const res = checkUtterance(text, baseCtx);
    assert.strictEqual(res.allowed, false, `Failed to reject token "${token}"`);
    assert.ok(res.reason === 'forbidden' || res.reason === 'rung', `Wrong rejection reason for "${token}": ${res.reason}`);
  }
});

test('3. Quoted Inscription Exception boundary testing', () => {
  const inscription = 'There are 12 ruby crystals in the dark vault chest.';
  const baseCtx = {
    rung: 'l2',
    forbidden: [12, 13],
    givens: [12],
    inscription,
    hintText: '12 ruby crystals'
  };

  // 11 chars verbatim match: MUST BE REJECTED
  // Inscription substring: ' 12 ruby cr' (11 chars)
  const text11 = 'Can we examine XYZ 12 ruby crABC on the floor of the room today?';
  const res11 = checkUtterance(text11, baseCtx);
  assert.strictEqual(res11.allowed, false, '11 chars verbatim quote must be rejected');
  assert.strictEqual(res11.reason, 'forbidden');

  // 12 chars verbatim match: MUST BE ALLOWED
  // Inscription substring: ' 12 ruby cry' (12 chars)
  const text12 = 'Can we examine XYZ 12 ruby cryABC on the floor of the room today?';
  const res12 = checkUtterance(text12, baseCtx);
  assert.strictEqual(res12.allowed, true, '12 chars verbatim quote must be allowed');

  // 13 chars verbatim match: MUST BE ALLOWED
  const text13 = 'Can we examine XYZ 12 ruby crysABC on the floor of the room today?';
  const res13 = checkUtterance(text13, baseCtx);
  assert.strictEqual(res13.allowed, true, '13 chars verbatim quote must be allowed');

  // Forbidden number NOT in givens, even if quoted 20+ chars from inscription: MUST BE REJECTED
  const inscWith13 = 'There are 13 emerald crystals in the dark vault chest.';
  const quote20 = 'There are 13 emerald';
  const textNotGiven = `Do you remember that "${quote20}" appears on the chest in the dark vault?`;
  const resNotGiven = checkUtterance(textNotGiven, {
    rung: 'l2',
    forbidden: [12, 13],
    givens: [12], // 13 is NOT in givens
    inscription: inscWith13,
    hintText: '13 emerald crystals'
  });
  assert.strictEqual(resNotGiven.allowed, false, 'Forbidden value not in givens must be rejected even if quoted');
  assert.strictEqual(resNotGiven.reason, 'forbidden');
});

test('4. Praise lexicon bypasses with casing, punctuation, and whitespace', () => {
  const praisePhrases = [
    'Well done! How will you proceed to find the next stone along the road?',
    'Great job on finding that clue, but what happens next in the courtyard?',
    'You are almost! there, but what clue remains to be unlocked on the wall?',
    'That is nice thinking about the shields, so what do you plan to do next?',
    'Brilliant! What do you notice about the clue on the wall of the keep?',
    'Exactly, that is one way to look at it, but what else might happen here?',
    'Your step is correct, so what is the next step you would like to take now?',
    'You have that right ! What do you think Kimmy will do with the dials?',
    'You did a nice job with those tokens, so how can we check them together?',
    'You did nice work with those tokens, so how can we check them together?',
    'That looks PERFECT in every way, so what question should we ask next?',
    'Awesome! How do you want to test your hypothesis on the ancient gate?',
    'That is Spot on. What clue does the third gate hold for the traveler?',
    'You got it! What is the final calculation we must perform on the arch?',
    'Good job with that rune, but how do we know which dial belongs to Timmy?',
    "That's it, you have reached the entrance, but what key will open it?",
    "Thats it, you have reached the entrance, but what key will open it?",
    "That’s it, you have reached the entrance, but what key will open it?",
    'You are close ! What else is needed to balance the scale in the room?',
    'You are close! What else is needed to balance the scale in the room?',
    'That is Not quite what the inscription says, so how can we check again?',
    'Almost. What happens when you test that value against the first gate?'
  ];

  for (const phrase of praisePhrases) {
    const res = checkUtterance(phrase, { rung: 'l2', forbidden: [], givens: [] });
    assert.strictEqual(res.allowed, false, `Failed to reject praise phrase: "${phrase}"`);
    assert.strictEqual(res.reason, 'praise', `Expected reason "praise" for "${phrase}", got "${res.reason}"`);
  }
});

test('5. Rung ceiling enforcement on innocuous phrases', () => {
  const phrases = [
    'Look at step 1 on your paper before we try another idea together?',
    'Can we look at page 2 of the ancient builder handbook to find clues?',
    'What if we were 100% certain about the order of the three toll gates?',
    'Could you build a 3D model of the standing shields to see the shared seam?',
    'Do you think this riddle could last 4ever if the goblin keeps hiding gems?',
    'What if the traveler had 0 coins left in her pouch after the journey?'
  ];

  for (const rung of ['l0', 'l1']) {
    for (const p of phrases) {
      const res = checkUtterance(p, { rung, forbidden: [], givens: [] });
      assert.strictEqual(res.allowed, false, `Rung ceiling at ${rung} should reject digits in: "${p}"`);
      assert.strictEqual(res.reason, 'rung');
    }
  }
});

test('6. Banned operations at rungs l0 and l1', () => {
  const ops = ['add', 'subtract', 'multiply', 'divide', 'double', 'halve', 'plus', 'minus', 'times'];

  for (const op of ops) {
    const text = `What happens when we ${op} the items in our collection to find a pattern?`;

    // Must be rejected at l0
    const resL0 = checkUtterance(text, { rung: 'l0', forbidden: [], givens: [] });
    assert.strictEqual(resL0.allowed, false, `Operation "${op}" should be banned at l0`);
    assert.strictEqual(resL0.reason, 'banned_operation');

    // Must be rejected at l1
    const resL1 = checkUtterance(text, { rung: 'l1', forbidden: [], givens: [] });
    assert.strictEqual(resL1.allowed, false, `Operation "${op}" should be banned at l1`);
    assert.strictEqual(resL1.reason, 'banned_operation');

    // Must be permitted at l2
    const resL2 = checkUtterance(text, { rung: 'l2', forbidden: [], givens: [] });
    assert.strictEqual(resL2.allowed, true, `Operation "${op}" should be allowed at l2`);
  }
});

test('7. Timing benchmark across 5,000 synthetic adversarial checks (< 5ms limit)', () => {
  const corpus = [
    'What do you notice about the clue, and what can we try next in this room?',
    'Could Kimmy be holding an odd rune or an even rune according to the clues?',
    'Look at where the standing shields meet the flat shields along the middle?',
    'Say the goal in your own words: what count are we hunting for on the road?',
    'Look at the two runes on the ancient archway and consider what they share?',
    'Look at the 2 runes on the ancient archway and consider what they share?',
    'What happens when we multiply the items in our collection to find a pattern?',
    'Well done! How will you proceed to find the next stone along the road?',
    'Notice that the count equals twenty four before you enter through the gate?',
    'Could the pouch hold twenty-four coins before reaching the final toll gate?'
  ];

  const contexts = [
    { rung: 'l0', forbidden: [2, 5, 17, 24], givens: [34, 85] },
    { rung: 'l1', forbidden: [6, 7, 11, 12, 14, 22], givens: [3, 5, 9, 13] },
    { rung: 'l2', forbidden: [3, 4], givens: [12], hintText: '12 ruby crystals' },
    { rung: 'l3', forbidden: [10, 22, 30], givens: [2, 3, 5, 66], hintText: 'match 2 units' }
  ];

  const N = 5000;
  const start = performance.now();
  for (let i = 0; i < N; i++) {
    const text = corpus[i % corpus.length];
    const ctx = contexts[i % contexts.length];
    checkUtterance(text, ctx);
  }
  const duration = performance.now() - start;
  const avg = duration / N;

  assert.ok(avg < 5.0, `Average latency ${avg}ms exceeded 5ms limit`);
  assert.ok(avg < 0.1, `Average latency ${avg}ms exceeded target 0.1ms`);
});

test('8. Scripted Probes Exhaustive Audit (All 78 probes pass gate)', () => {
  const encDir = path.resolve('content/encounters');
  const encFiles = fs.readdirSync(encDir).filter(f => f.endsWith('.json'));
  const encMap = {};
  for (const f of encFiles) {
    const enc = JSON.parse(fs.readFileSync(path.join(encDir, f), 'utf8'));
    encMap[enc.id] = enc;
  }

  let count = 0;
  for (const [encId, parts] of Object.entries(SCRIPTED_PROBES)) {
    const enc = encMap[encId];
    assert.ok(enc, `Encounter ${encId} must exist`);

    for (const [partId, stateMap] of Object.entries(parts)) {
      const partDef = enc.parts.find(p => p.id === partId);
      assert.ok(partDef, `Part ${partId} must exist in ${encId}`);

      const forbidden = partDef.forbidden || [];
      const givens = enc.givens || partDef.givens || [];
      const inscription = typeof enc.inscription === 'string' ? enc.inscription : enc.inscription.text;
      const answer = partDef.answer;

      for (const [state, stateContent] of Object.entries(stateMap)) {
        if (Array.isArray(stateContent)) {
          for (const probe of stateContent) {
            count++;
            verifyProbe(probe, { rung: 'l0', forbidden, givens, inscription, hintText: '', answer, encId, partId, state });
          }
        } else {
          for (const [rung, probeList] of Object.entries(stateContent)) {
            const hintDef = partDef.hints?.[rung];
            const hintText = hintDef?.text || '';
            for (const probe of probeList) {
              count++;
              verifyProbe(probe, { rung, forbidden, givens, inscription, hintText, answer, encId, partId, state });
            }
          }
        }
      }
    }
  }

  assert.strictEqual(count, 78, `Expected exactly 78 scripted probes, found ${count}`);

  function verifyProbe(probe, ctx) {
    // Exactly one trailing '?'
    const qMarks = (probe.match(/\?/g) || []).length;
    assert.strictEqual(probe.trim().endsWith('?'), true, `Probe must end in '?': "${probe}"`);
    assert.strictEqual(qMarks, 1, `Probe must have exactly 1 '?', found ${qMarks}: "${probe}"`);

    // No praise
    for (const { pattern, name } of PRAISE_PATTERNS) {
      assert.strictEqual(pattern.test(probe), false, `Probe contains praise "${name}": "${probe}"`);
    }

    // No digits at l0/l1
    if (ctx.rung === 'l0' || ctx.rung === 'l1') {
      assert.strictEqual(/[0-9]/.test(probe), false, `Probe contains digit at ${ctx.rung}: "${probe}"`);
    }

    // checkUtterance passes
    const gateRes = checkUtterance(probe, {
      rung: ctx.rung,
      forbidden: ctx.forbidden,
      givens: ctx.givens,
      inscription: ctx.inscription,
      hintText: ctx.hintText,
      targetAnswer: ctx.answer
    }, { minLen: 40, maxLen: 300 });

    assert.strictEqual(gateRes.allowed, true, `Probe rejected by gate (${gateRes.stage} - ${gateRes.reason}): "${probe}"`);
  }
});

test('9. Deep Network Isolation Verification (fetch, http, https, net, dns)', () => {
  let violations = 0;
  const hookViolation = (msg) => { violations++; throw new Error('Network violation: ' + msg); };

  const origFetch = globalThis.fetch;
  const origHttp = http.request;
  const origHttps = https.request;
  const origConnect = net.Socket.prototype.connect;
  const origLookup = dns.lookup;

  globalThis.fetch = () => hookViolation('fetch');
  http.request = () => hookViolation('http.request');
  https.request = () => hookViolation('https.request');
  net.Socket.prototype.connect = () => hookViolation('net.connect');
  dns.lookup = () => hookViolation('dns.lookup');

  try {
    const encFiles = ['chasm-reverse-tolls.json', 'alchemists-dark-vault.json', 'courtyard-five-shields.json', 'castle-keep-portcullis.json'];

    for (const f of encFiles) {
      const enc = JSON.parse(fs.readFileSync(path.resolve('content/encounters', f), 'utf8'));
      let state = createSession(enc, 'net-isolation-' + enc.id);
      let res = transition(state, { type: 'read_inscription' }, enc);
      state = res.state;

      for (const part of enc.parts) {
        const probe = getScriptedProbe(enc.id, part.id, 'conjecture', 'l0');
        const gateRes = checkUtterance(probe, {
          rung: 'l0',
          forbidden: part.forbidden || [],
          givens: enc.givens || [],
          inscription: typeof enc.inscription === 'string' ? enc.inscription : enc.inscription.text
        });
        assert.strictEqual(gateRes.allowed, true);
      }
    }
  } finally {
    globalThis.fetch = origFetch;
    http.request = origHttp;
    https.request = origHttps;
    net.Socket.prototype.connect = origConnect;
    dns.lookup = origLookup;
  }

  assert.strictEqual(violations, 0, 'Zero network calls permitted across entire engine run');
});
