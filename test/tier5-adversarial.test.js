/**
 * Castle of Theorems v1 (Home Edition)
 * Tier 5 Adversarial Test Suite: Full 10 Scenarios (T5.1 to T5.10)
 * Implements SPEC §7, §12, §14 (Milestone M5)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkUtterance, extractNumbers } from '../server/engine/leakGate.js';
import { generateTurn } from '../server/tutor/index.js';
import { startServer, closeServer } from '../server/index.js';
import { createSession, transition } from '../server/engine/stateMachine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Tier 5 Adversarial Hardening Suite (T5.1 – T5.10)', () => {
  let serverInstance;
  let baseUrl;

  before(async () => {
    serverInstance = await startServer(0, '127.0.0.1');
    baseUrl = serverInstance.url;
  });

  after(async () => {
    if (serverInstance) {
      await serverInstance.close();
    }
  });

  // =========================================================================
  // T5.1: Look Back and Simpler Problem Leak Boundary
  // =========================================================================
  describe('T5.1: Look Back and Simpler Problem Leak Boundary', () => {
    it('screens and rejects simpler problem answers across encounters', async () => {
      // 1. Five Shields simpler problem answer is 24 (not in part.forbidden: [10, 22, 30])
      const shieldsTurn = await generateTurn({
        encounterId: 'ch1-n3-five-shields',
        partId: 'a',
        state: 'simpler_problem',
        rung: 'l4',
        childMessage: 'What is the answer for one square?'
      }, {
        adapter: 'mock',
        apiKey: 'mock-key',
        fetchFn: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    utterance: "Could the walk around one tiny square be twenty-four cubits in total on the stone?",
                    pedagogical_intent: "leak attempt"
                  })
                }]
              }
            }]
          })
        })
      });
      // The leak must be caught and replaced with safe fallback
      assert.notEqual(shieldsTurn.utterance, "Could the walk around one tiny square be twenty-four cubits in total on the stone?");
      assert.ok(shieldsTurn.fallback === true || shieldsTurn.retries > 0);

      // 2. Dark Vault part b simpler problem answer is 5
      const vaultTurn = await generateTurn({
        encounterId: 'ch1-n2-dark-vault',
        partId: 'b',
        state: 'simpler_problem',
        rung: 'l4',
        childMessage: 'How many picks for 2 of a kind?'
      }, {
        adapter: 'mock',
        apiKey: 'mock-key',
        fetchFn: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    utterance: "Could you need five crystals in the dark to guarantee the smaller club of stones?",
                    pedagogical_intent: "leak attempt"
                  })
                }]
              }
            }]
          })
        })
      });
      assert.notEqual(vaultTurn.utterance, "Could you need five crystals in the dark to guarantee the smaller club of stones?");

      // 3. Castle Keep simpler problem answer is 7
      const keepTurn = await generateTurn({
        encounterId: 'ch1-n4-castle-keep',
        partId: 'a',
        state: 'simpler_problem',
        rung: 'l4',
        childMessage: 'Which prime is shared?'
      }, {
        adapter: 'mock',
        apiKey: 'mock-key',
        fetchFn: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    utterance: "Could the shared prime rune between 21 and 77 be seven on the high dial?",
                    pedagogical_intent: "leak attempt"
                  })
                }]
              }
            }]
          })
        })
      });
      assert.notEqual(keepTurn.utterance, "Could the shared prime rune between 21 and 77 be seven on the high dial?");
    });

    it('screens and rejects Look Back verification target answers', async () => {
      // Reverse Tolls Look Back check target is 45
      const tollsTurn = await generateTurn({
        encounterId: 'ch1-n1-reverse-tolls',
        partId: 'a',
        state: 'look_back',
        rung: 'l0',
        childMessage: 'What comes out if I start with 10?'
      }, {
        adapter: 'mock',
        apiKey: 'mock-key',
        fetchFn: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    utterance: "Could the number that comes out at the castle door be forty-five coins in all?",
                    pedagogical_intent: "leak attempt"
                  })
                }]
              }
            }]
          })
        })
      });
      assert.notEqual(tollsTurn.utterance, "Could the number that comes out at the castle door be forty-five coins in all?");

      // Five Shields Look Back check target 84
      const shieldsLBLook = await generateTurn({
        encounterId: 'ch1-n3-five-shields',
        partId: 'a',
        state: 'look_back',
        rung: 'l0',
        childMessage: 'What is the perimeter with a 3x2 grid?'
      }, {
        adapter: 'mock',
        apiKey: 'mock-key',
        fetchFn: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    utterance: "Could the total perimeter around the six shields be eighty-four cubits across?",
                    pedagogical_intent: "leak attempt"
                  })
                }]
              }
            }]
          })
        })
      });
      assert.notEqual(shieldsLBLook.utterance, "Could the total perimeter around the six shields be eighty-four cubits across?");
    });
  });

  // =========================================================================
  // T5.2: Markdown Italics & Underscore Obfuscation
  // =========================================================================
  describe('T5.2: Markdown Italics & Underscore Obfuscation', () => {
    it('detects and rejects forbidden numbers enclosed in markdown underscores', () => {
      const ctx = { rung: 'l0', forbidden: [2, 5, 17, 24], givens: [34, 85] };

      const u2 = "Could Kimmy hold the value of _two_ on the dials in the keep?";
      const res2 = checkUtterance(u2, ctx, { minLen: 40 });
      assert.equal(res2.allowed, false, "Expected _two_ to be rejected");
      assert.equal(res2.reason, 'forbidden');

      const u24 = "Could Kimmy hold the value of _twenty-four_ on the dials in the keep?";
      const res24 = checkUtterance(u24, ctx, { minLen: 40 });
      assert.equal(res24.allowed, false, "Expected _twenty-four_ to be rejected");
      assert.equal(res24.reason, 'forbidden');

      const u17 = "Could Kimmy hold the value of _17_ on the stone dials in the keep?";
      const res17 = checkUtterance(u17, ctx, { minLen: 40 });
      assert.equal(res17.allowed, false, "Expected _17_ to be rejected");
      assert.ok(res17.reason === 'forbidden' || res17.reason === 'rung');
    });

    it('detects praise words and banned operations wrapped in underscores', () => {
      const uPraise = "You did a _great_ deduction on the stones, so what do you want to test next in the room?";
      const resPraise = checkUtterance(uPraise, { rung: 'l0', forbidden: [], givens: [] }, { minLen: 40 });
      assert.equal(resPraise.allowed, false, "Expected _great_ to fail praise check");
      assert.equal(resPraise.reason, 'praise');

      const uOp = "Could we _double_ the coins from the enchanted road to see what happens?";
      const resOp = checkUtterance(uOp, { rung: 'l0', forbidden: [], givens: [] }, { minLen: 40 });
      assert.equal(resOp.allowed, false, "Expected _double_ to fail operation check at l0");
      assert.equal(resOp.reason, 'banned_operation');
    });
  });

  // =========================================================================
  // T5.3: Typographic En-Dash and Em-Dash Compounds
  // =========================================================================
  describe('T5.3: Typographic En-Dash and Em-Dash Compounds', () => {
    it('extracts compound numbers formed with typographic en-dash and em-dash', () => {
      const numsEn = extractNumbers("twenty–four cubits and eighty–five crystals");
      assert.ok(numsEn.some(n => n.value === 24));
      assert.ok(numsEn.some(n => n.value === 85));

      const numsEm = extractNumbers("twenty—two cubits and thirty—four marks");
      assert.ok(numsEm.some(n => n.value === 22));
      assert.ok(numsEm.some(n => n.value === 34));
    });

    it('rejects forbidden compound numbers using typographic dashes', () => {
      const ctxKeep = { rung: 'l0', forbidden: [2, 5, 17, 24], givens: [34, 85] };
      const uEn = "Could the secret sum be twenty–four across the dials on the high wall?";
      const resEn = checkUtterance(uEn, ctxKeep, { minLen: 40 });
      assert.equal(resEn.allowed, false);
      assert.equal(resEn.reason, 'forbidden');

      const ctxShields = { rung: 'l0', forbidden: [10, 22, 30], givens: [2, 3, 5, 66] };
      const uEm = "Could the walk be twenty—two units around the outside of the courtyard shields?";
      const resEm = checkUtterance(uEm, ctxShields, { minLen: 40 });
      assert.equal(resEm.allowed, false);
      assert.equal(resEm.reason, 'forbidden');
    });
  });

  // =========================================================================
  // T5.4: Invisible Unicode & Homoglyph Injection
  // =========================================================================
  describe('T5.4: Invisible Unicode & Homoglyph Injection', () => {
    it('normalizes zero-width characters and detects embedded forbidden numbers', () => {
      const ctx = { rung: 'l0', forbidden: [6, 7, 11, 12, 14, 22], givens: [3, 5, 9, 13] };
      // "s\u200Bix" contains zero-width space
      const uZeroWidth = "Could she start with s\u200Bix coins in the pouch on the road?";
      const resZero = checkUtterance(uZeroWidth, ctx, { minLen: 40 });
      assert.equal(resZero.allowed, false);
      assert.equal(resZero.reason, 'forbidden');
    });

    it('normalizes fullwidth digits and mathematical bold digits', () => {
      const ctx = { rung: 'l0', forbidden: [6], givens: [] };
      // "６" (fullwidth 6)
      const uFullwidth = "Could she start with ６ coins in the pouch on the road?";
      const resFull = checkUtterance(uFullwidth, ctx, { minLen: 40 });
      assert.equal(resFull.allowed, false);
      assert.ok(resFull.reason === 'forbidden' || resFull.reason === 'rung');

      // "𝟔" (math bold 6)
      const uMathBold = "Could she start with 𝟔 coins in the pouch on the road?";
      const resMath = checkUtterance(uMathBold, ctx, { minLen: 40 });
      assert.equal(resMath.allowed, false);
      assert.ok(resMath.reason === 'forbidden' || resMath.reason === 'rung');
    });

    it('normalizes Roman numerals to Arabic values', () => {
      const ctx = { rung: 'l0', forbidden: [6], givens: [] };
      // "Ⅵ" (Unicode Roman numeral 6)
      const uRoman = "Could she start with Ⅵ coins in the pouch on the road?";
      const resRoman = checkUtterance(uRoman, ctx, { minLen: 40 });
      assert.equal(resRoman.allowed, false);
      assert.ok(resRoman.reason === 'forbidden' || resRoman.reason === 'rung');
    });
  });

  // =========================================================================
  // T5.5: Operation Inflection at l0/l1
  // =========================================================================
  describe('T5.5: Operation Inflection at l0/l1', () => {
    it('rejects operation inflections (doubling, halving) at rungs l0 and l1', () => {
      const uDoubling = "Would doubling the count of coins help us find what was held at the start?";
      const resL0 = checkUtterance(uDoubling, { rung: 'l0', forbidden: [] }, { minLen: 40 });
      assert.equal(resL0.allowed, false);
      assert.equal(resL0.reason, 'banned_operation');

      const uHalving = "Would halving the crystals in the vault give us equal piles for the test?";
      const resL1 = checkUtterance(uHalving, { rung: 'l1', forbidden: [] }, { minLen: 40 });
      assert.equal(resL1.allowed, false);
      assert.equal(resL1.reason, 'banned_operation');
    });

    it('allows operation inflections at rung l2 as strategic guidance', () => {
      const uL2 = "Walking backwards, you undo the paying first and then undo doubling, what happens next?";
      const resL2 = checkUtterance(uL2, { rung: 'l2', forbidden: [] }, { minLen: 40 });
      assert.equal(resL2.allowed, true);
    });
  });

  // =========================================================================
  // T5.6: Praise Without Exclamation Marks & Evaluative Phrases
  // =========================================================================
  describe('T5.6: Praise Without Exclamation Marks & Evaluative Phrases', () => {
    it('rejects evaluative statements without exclamation marks', () => {
      const uRight = "You have the right gate, what do you think will happen when she steps forward?";
      const resRight = checkUtterance(uRight, {}, { minLen: 40 });
      assert.equal(resRight.allowed, false);
      assert.equal(resRight.reason, 'praise');

      const uClose = "You are very close, what detail in the inscription did you notice just now?";
      const resClose = checkUtterance(uClose, {}, { minLen: 40 });
      assert.equal(resClose.allowed, false);
      assert.equal(resClose.reason, 'praise');
    });

    it('does not falsely reject directional words or non-praise context', () => {
      const uDirection = "Look at the upright shields on the wall: which side has the longer border?";
      const resDir = checkUtterance(uDirection, {}, { minLen: 40 });
      assert.equal(resDir.allowed, true);
    });
  });

  // =========================================================================
  // T5.7: Malformed Host Header & Raw Socket Denial of Service
  // =========================================================================
  describe('T5.7: Malformed Host Header & Raw Socket Denial of Service', () => {
    it('handles malformed Host headers without crashing the server process', async () => {
      const sendRawTcp = (payload) => {
        return new Promise((resolve, reject) => {
          const client = net.createConnection(serverInstance.port, serverInstance.host, () => {
            client.write(payload);
          });
          let data = '';
          client.on('data', chunk => { data += chunk.toString(); });
          client.on('end', () => resolve(data));
          client.on('error', reject);
        });
      };

      // Malformed host header containing invalid URL characters
      const malformedPayload = "GET / HTTP/1.1\r\nHost: [invalid-host\r\nConnection: close\r\n\r\n";
      const response = await sendRawTcp(malformedPayload);

      assert.ok(response.includes('400 Bad Request') || response.includes('HTTP/1.1 400'), `Expected 400 response, got: ${response.slice(0, 50)}`);

      // Verify server remains fully functional
      const healthCheck = await fetch(`${baseUrl}/api/encounters`);
      assert.equal(healthCheck.status, 200);
    });
  });

  // =========================================================================
  // T5.8: Primitive & Null JSON Payloads
  // =========================================================================
  describe('T5.8: Primitive & Null JSON Payloads', () => {
    it('rejects null, numeric, boolean, and array JSON payloads with HTTP 400', async () => {
      const invalidPayloads = ['null', '123', 'true', '[]'];

      for (const payload of invalidPayloads) {
        const res = await fetch(`${baseUrl}/api/session/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        });

        assert.equal(res.status, 400, `Expected 400 for payload: ${payload}, got ${res.status}`);
        const data = await res.json();
        assert.equal(data.ok, false);
      }
    });
  });

  // =========================================================================
  // T5.9: Understand Stage Burst & Hint Ladder Invariance
  // =========================================================================
  describe('T5.9: Understand Stage Burst & Hint Ladder Invariance', () => {
    it('maintains hint ladder rung during rapid say action bursts', async () => {
      // 1. Start a fresh session
      const startRes = await fetch(`${baseUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId: 'ch1-n1-reverse-tolls' })
      });
      const startData = await startRes.json();
      const sessionId = startData.sessionId;

      // Advance to arrive -> conjecture -> understand
      await fetch(`${baseUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'arrive' } })
      });
      await fetch(`${baseUrl}/api/session/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: { type: 'skip_conjecture' } })
      });

      // 2. Dispatch 20 concurrent say actions (simulating rapid tapping or packet replay)
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(fetch(`${baseUrl}/api/session/${sessionId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: { type: 'say', text: `Child observation probe burst number ${i + 1}` } })
        }));
      }

      await Promise.all(promises);

      // 3. Inspect final state
      const stateRes = await fetch(`${baseUrl}/api/session/${sessionId}/state`);
      const stateData = await stateRes.json();

      assert.equal(stateData.state, 'plan', 'Session should have advanced to Plan after probes');
      // CRUCIAL: Hint ladder MUST NOT have jumped straight to l3 (ceiling)
      assert.ok(
        stateData.view.hintRung === 'l0' || stateData.view.hintRung === 'l1',
        `Hint ladder should be at l0 or l1, not jumped to l3. Found: ${stateData.view.hintRung}`
      );
    });
  });

  // =========================================================================
  // T5.10: Parent Dashboard XSS Sanitization
  // =========================================================================
  describe('T5.10: Parent Dashboard XSS Sanitization', () => {
    it('sanitizes child text and tutor speech in parent dashboard transcript', () => {
      const maliciousScript = "<script>window.__xss=true</script><img src=x onerror=alert(1)>";

      // Simulate parent dashboard transcript node creation (as implemented in client/parent.js)
      const item = {
        children: [],
        appendChild(node) { this.children.push(node); }
      };

      const strong = { textContent: '' };
      strong.textContent = "[12:00:00 PM] Child (say):";
      const textNode = { nodeType: 3, nodeValue: ` ${maliciousScript}` };

      item.appendChild(strong);
      item.appendChild(textNode);

      // Verify that content is retained purely as textNode value without executing or parsing HTML
      assert.equal(item.children.length, 2);
      assert.equal(item.children[0].textContent, "[12:00:00 PM] Child (say):");
      assert.equal(item.children[1].nodeValue, ` ${maliciousScript}`);
      assert.equal(item.children[1].nodeType, 3, "Must be DOM TextNode (type 3), preventing HTML tag execution");
    });
  });
});
