/**
 * Castle of Theorems — Milestone M2 Empirical Challenger Stress Suite
 * test/tutor.stress.test.js
 *
 * Adversarial empirical tests verifying tutor router and adapters under adverse conditions:
 * 1. Malformed and edge-case responses: null, empty, non-JSON, truncated JSON, primitives, safety blocks.
 * 2. Latency & timeouts: simulated slow network >4000ms, AbortSignal abort, timeout bounds.
 * 3. HTTP errors: 429 Rate Limit, 500 Internal Server Error, 503 Service Unavailable, 401 Unauthorized.
 * 4. Second gate failure: candidate failing on attempt 1, corrective prompt injection, failing on retry,
 *    strictly falling back to authored probe with full telemetry.
 * 5. Multi-encounter coverage: zero unhandled exceptions across all 4 Chapter 1 encounters.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateTurn } from '../server/tutor/index.js';
import { generateGeminiTurn, parseGeminiResponse } from '../server/tutor/gemini.js';
import { generateClaudeTurn, extractUtteranceFromClaudeResponse } from '../server/tutor/claude.js';
import { checkUtterance } from '../server/engine/leakGate.js';
import { readSessionEvents, clearSessionLog } from '../server/engine/telemetry.js';

const encounters = [
  {
    encounterId: 'ch1-n1-reverse-tolls',
    partId: 'a',
    state: 'carry_out',
    rung: 'l1',
    inscription: 'A traveler crossed three magic toll gates on the road to the castle. At the first gate her pouch of Star-Coins doubled, then she paid 5 coins. At the second gate her coins doubled again, then she paid 3. At the third gate they doubled once more, then she paid 9. She walked into the castle with exactly 13 Star-Coins. How many did she start with?',
    leakContext: { forbidden: [6, 7, 11, 12, 14, 22], givens: [3, 5, 9, 13], rung: 'l1' }
  },
  {
    encounterId: 'ch1-n2-dark-vault',
    partId: 'a',
    state: 'carry_out',
    rung: 'l1',
    inscription: 'A chest holds 12 ruby, 12 sapphire, and 12 emerald crystals in total darkness. The Torch of Pairs requires any matching pair.',
    leakContext: { forbidden: [3, 4], givens: [12], rung: 'l1' }
  },
  {
    encounterId: 'ch1-n3-five-shields',
    partId: 'a',
    state: 'carry_out',
    rung: 'l1',
    inscription: 'Five identical rectangular shields form a courtyard perimeter of 66 cubits.',
    leakContext: { forbidden: [10, 22, 30], givens: [2, 3, 5, 66], rung: 'l1' }
  },
  {
    encounterId: 'ch1-n4-castle-keep',
    partId: 'a',
    state: 'carry_out',
    rung: 'l1',
    inscription: 'Two dials on the portcullis: Jimmy and Kimmy multiply to 34; Kimmy and Timmy multiply to 85.',
    leakContext: { forbidden: [2, 5, 17, 24], givens: [34, 85], rung: 'l1' }
  }
];

describe('Empirical Adversarial Stress Suite — Milestone M2', () => {

  // ==========================================================================
  // 1. Malformed and Edge-Case LLM Responses
  // ==========================================================================
  describe('1. Malformed & Edge-Case Responses', () => {
    const baseCtx = encounters[0];

    it('1.1 handles completely null or primitive response bodies without throwing', async () => {
      const nullBodies = [null, undefined, 42, 'string_body', true];
      for (const body of nullBodies) {
        const fetchFn = async () => ({
          ok: true,
          status: 200,
          json: async () => body
        });

        // Gemini
        const resGemini = await generateTurn(baseCtx, {
          adapter: 'gemini',
          apiKey: 'test-key',
          fetchFn,
          leakContext: baseCtx.leakContext
        });
        assert.equal(resGemini.fallback, true, `Gemini should fallback on null/primitive: ${body}`);
        assert.equal(resGemini.retries, 0);
        assert.equal(typeof resGemini.utterance, 'string');
        assert.ok(checkUtterance(resGemini.utterance, baseCtx.leakContext).allowed);

        // Claude
        const resClaude = await generateTurn(baseCtx, {
          adapter: 'claude',
          apiKey: 'test-key',
          fetchFn,
          leakContext: baseCtx.leakContext
        });
        assert.equal(resClaude.fallback, true, `Claude should fallback on null/primitive: ${body}`);
        assert.equal(resClaude.retries, 0);
        assert.ok(checkUtterance(resClaude.utterance, baseCtx.leakContext).allowed);
      }
    });

    it('1.2 handles empty object, empty candidates, and empty parts', async () => {
      const emptyPayloads = [
        {},
        { candidates: [] },
        { candidates: [{}] },
        { candidates: [{ content: {} }] },
        { candidates: [{ content: { parts: [] } }] },
        { candidates: [{ content: { parts: [{ text: '' }] } }] },
        { candidates: [{ content: { parts: [{ text: '   ' }] } }] }
      ];

      for (const payload of emptyPayloads) {
        const fetchFn = async () => ({
          ok: true,
          status: 200,
          json: async () => payload
        });

        const res = await generateTurn(baseCtx, {
          adapter: 'gemini',
          apiKey: 'test-key',
          fetchFn,
          leakContext: baseCtx.leakContext
        });
        assert.equal(res.fallback, true);
        assert.equal(res.adapter, 'scripted_fallback');
        assert.ok(checkUtterance(res.utterance, baseCtx.leakContext).allowed);
      }
    });

    it('1.3 handles non-JSON plain text, HTML errors, and truncated JSON in Gemini parts', async () => {
      const corruptTexts = [
        'I think you should walk backwards from the castle door?',
        '<html><body>502 Bad Gateway</body></html>',
        '{"utterance": "If you walked this road backwards from the castle door', // truncated JSON
        '{"utterance": 12345}', // numeric utterance instead of string
        '{"wrongField": "some question here?"}', // missing utterance field
        'null', // JSON string literal "null"
        'true', // JSON string literal "true"
        '{"utterance": null}' // explicit null utterance
      ];

      for (const text of corruptTexts) {
        const fetchFn = async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text }] } }]
          })
        });

        const res = await generateTurn(baseCtx, {
          adapter: 'gemini',
          apiKey: 'test-key',
          fetchFn,
          leakContext: baseCtx.leakContext
        });
        assert.equal(res.fallback, true, `Should fallback for text: ${text}`);
        assert.ok(checkUtterance(res.utterance, baseCtx.leakContext).allowed);
      }
    });

    it('1.4 handles Claude missing content, null input, empty tool_use, and non-JSON text', async () => {
      const claudeCorruptCases = [
        { content: [] },
        { content: null },
        { content: [{ type: 'other_type', data: 'unknown' }] },
        { content: [{ type: 'tool_use', name: 'wrong_tool', input: { utterance: 'test' } }] },
        { content: [{ type: 'tool_use', name: 'respond_as_archimedes', input: null }] },
        { content: [{ type: 'tool_use', name: 'respond_as_archimedes', input: {} }] },
        { content: [{ type: 'tool_use', name: 'respond_as_archimedes', input: { utterance: '' } }] },
        { content: [{ type: 'tool_use', name: 'respond_as_archimedes', input: { utterance: 42 } }] },
        { content: [{ type: 'text', text: 'plain text without json' }] },
        { content: [{ type: 'text', text: '{"wrong_property": true}' }] }
      ];

      for (const payload of claudeCorruptCases) {
        const fetchFn = async () => ({
          ok: true,
          status: 200,
          json: async () => payload
        });

        const res = await generateTurn(baseCtx, {
          adapter: 'claude',
          apiKey: 'test-key',
          fetchFn,
          leakContext: baseCtx.leakContext
        });
        assert.equal(res.fallback, true);
        assert.equal(res.retries, 0);
        assert.ok(checkUtterance(res.utterance, baseCtx.leakContext).allowed);
      }
    });

    it('1.5 handles Gemini safety finishReason and promptFeedback block', async () => {
      const safetyCases = [
        { candidates: [{ finishReason: 'SAFETY' }] },
        { candidates: [{ finishReason: 'RECITATION' }] },
        { promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } }
      ];

      for (const payload of safetyCases) {
        const fetchFn = async () => ({
          ok: true,
          status: 200,
          json: async () => payload
        });

        const res = await generateTurn(baseCtx, {
          adapter: 'gemini',
          apiKey: 'test-key',
          fetchFn,
          leakContext: baseCtx.leakContext
        });
        assert.equal(res.fallback, true);
        assert.ok(res.fallbackReason.includes('blocked') || res.fallbackReason.includes('PROHIBITED'));
        assert.ok(checkUtterance(res.utterance, baseCtx.leakContext).allowed);
      }
    });

    it('1.6 handles response.json() syntax error (e.g. proxy HTML 502/504)', async () => {
      const fetchFn = async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        }
      });

      const resGemini = await generateTurn(baseCtx, { adapter: 'gemini', apiKey: 'test', fetchFn });
      assert.equal(resGemini.fallback, true);
      assert.ok(resGemini.fallbackReason.includes('invalid response JSON'));

      const resClaude = await generateTurn(baseCtx, { adapter: 'claude', apiKey: 'test', fetchFn });
      assert.equal(resClaude.fallback, true);
      assert.ok(resClaude.fallbackReason.includes('Unexpected token'));
    });
  });

  // ==========================================================================
  // 2. Latency & Timeouts
  // ==========================================================================
  describe('2. Latency & Timeout Enforcement', () => {
    const baseCtx = encounters[0];

    it('2.1 aborts slow request via AbortSignal and falls back within timeout bounds', async () => {
      const slowFetch = (url, options) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({})
            });
          }, 500);

          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(options.signal.reason || new DOMException('Aborted', 'TimeoutError'));
            });
          }
        });
      };

      const startGemini = Date.now();
      const resGemini = await generateTurn(baseCtx, {
        adapter: 'gemini',
        apiKey: 'test',
        fetchFn: slowFetch,
        timeoutMs: 40,
        leakContext: baseCtx.leakContext
      });
      const elapsedGemini = Date.now() - startGemini;

      assert.equal(resGemini.fallback, true);
      assert.ok(resGemini.fallbackReason.includes('timed out'));
      assert.ok(elapsedGemini < 300, `Gemini turn took ${elapsedGemini}ms, expected abort in ~40ms`);
      assert.ok(checkUtterance(resGemini.utterance, baseCtx.leakContext).allowed);

      const startClaude = Date.now();
      const resClaude = await generateTurn(baseCtx, {
        adapter: 'claude',
        apiKey: 'test',
        fetchFn: slowFetch,
        timeoutMs: 40,
        leakContext: baseCtx.leakContext
      });
      const elapsedClaude = Date.now() - startClaude;

      assert.equal(resClaude.fallback, true);
      assert.ok(resClaude.fallbackReason.includes('timed out'));
      assert.ok(elapsedClaude < 300, `Claude turn took ${elapsedClaude}ms, expected abort in ~40ms`);
      assert.ok(checkUtterance(resClaude.utterance, baseCtx.leakContext).allowed);
    });

    it('2.2 direct adapter generateGeminiTurn / generateClaudeTurn translate abort to TimeoutError', async () => {
      const mockFetchAbort = async (url, options) => {
        assert.ok(options.signal instanceof AbortSignal);
        throw new DOMException('Request aborted', 'AbortError');
      };

      await assert.rejects(
        async () => {
          await generateGeminiTurn(baseCtx, { apiKey: 'test', fetchFn: mockFetchAbort, timeoutMs: 50 });
        },
        (err) => {
          assert.equal(err.name, 'TimeoutError');
          assert.ok(err.message.includes('timed out'));
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await generateClaudeTurn(baseCtx, { apiKey: 'test', fetchFn: mockFetchAbort, timeoutMs: 50 });
        },
        (err) => {
          assert.equal(err.name, 'TimeoutError');
          assert.ok(err.message.includes('timed out'));
          return true;
        }
      );
    });
  });

  // ==========================================================================
  // 3. HTTP Errors (429, 500, 503, 401)
  // ==========================================================================
  describe('3. HTTP Status Errors & Telemetry', () => {
    const baseCtx = encounters[0];
    const testStatuses = [
      { status: 429, text: 'Rate limit exceeded: quota depleted' },
      { status: 500, text: 'Internal Server Error: backend failure' },
      { status: 503, text: 'Service Unavailable: model overloaded' },
      { status: 401, text: 'Unauthorized: invalid API key' }
    ];

    for (const { status, text } of testStatuses) {
      it(`3.1 gracefully handles HTTP ${status} for Gemini with telemetry logging`, async () => {
        const sessionId = `stress-gemini-http-${status}-${Date.now()}`;
        clearSessionLog(sessionId);

        const fetchFn = async () => ({
          ok: false,
          status,
          statusText: text,
          text: async () => text
        });

        const res = await generateTurn({ ...baseCtx, sessionId }, {
          adapter: 'gemini',
          apiKey: 'test-key',
          fetchFn,
          leakContext: baseCtx.leakContext
        });

        assert.equal(res.fallback, true);
        assert.equal(res.retries, 0);
        assert.ok(res.fallbackReason.includes(`HTTP ${status}`));
        assert.ok(checkUtterance(res.utterance, baseCtx.leakContext).allowed);

        const events = readSessionEvents(sessionId);
        assert.equal(events.length, 2);
        const tutorCall = events.find(e => e.type === 'tutor.call');
        assert.equal(tutorCall.fallback, true);
        assert.equal(tutorCall.retries, 0);
        assert.equal(tutorCall.adapter, 'gemini');
        assert.ok(tutorCall.fallbackReason.includes(`HTTP ${status}`));

        const tutorSay = events.find(e => e.type === 'tutor.say');
        assert.equal(tutorSay.source, 'scripted');
        assert.equal(tutorSay.speech, res.utterance);

        clearSessionLog(sessionId);
      });

      it(`3.2 gracefully handles HTTP ${status} for Claude with telemetry logging`, async () => {
        const sessionId = `stress-claude-http-${status}-${Date.now()}`;
        clearSessionLog(sessionId);

        const fetchFn = async () => ({
          ok: false,
          status,
          statusText: text,
          text: async () => text
        });

        const res = await generateTurn({ ...baseCtx, sessionId }, {
          adapter: 'claude',
          apiKey: 'test-key',
          fetchFn,
          leakContext: baseCtx.leakContext
        });

        assert.equal(res.fallback, true);
        assert.equal(res.retries, 0);
        assert.ok(res.fallbackReason.includes(`HTTP ${status}`));
        assert.ok(checkUtterance(res.utterance, baseCtx.leakContext).allowed);

        const events = readSessionEvents(sessionId);
        assert.equal(events.length, 2);
        const tutorCall = events.find(e => e.type === 'tutor.call');
        assert.equal(tutorCall.fallback, true);
        assert.equal(tutorCall.adapter, 'claude');

        const tutorSay = events.find(e => e.type === 'tutor.say');
        assert.equal(tutorSay.source, 'scripted');

        clearSessionLog(sessionId);
      });
    }

    it('3.3 gracefully degrades when API keys are completely missing from environment', async () => {
      const origGeminiKey = process.env.GEMINI_API_KEY;
      const origGoogleKey = process.env.GOOGLE_API_KEY;
      const origClaudeKey = process.env.ANTHROPIC_API_KEY;

      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      try {
        const resGemini = await generateTurn(baseCtx, { adapter: 'gemini', leakContext: baseCtx.leakContext });
        assert.equal(resGemini.fallback, true);
        assert.ok(resGemini.fallbackReason.includes('GEMINI_API_KEY'));

        const resClaude = await generateTurn(baseCtx, { adapter: 'claude', leakContext: baseCtx.leakContext });
        assert.equal(resClaude.fallback, true);
        assert.ok(resClaude.fallbackReason.includes('ANTHROPIC_API_KEY'));
      } finally {
        if (origGeminiKey) process.env.GEMINI_API_KEY = origGeminiKey;
        if (origGoogleKey) process.env.GOOGLE_API_KEY = origGoogleKey;
        if (origClaudeKey) process.env.ANTHROPIC_API_KEY = origClaudeKey;
      }
    });
  });

  // ==========================================================================
  // 4. Second Gate Failure (Double Rejection & Corrective Prompting)
  // ==========================================================================
  describe('4. Second Gate Failure & Corrective Prompting', () => {

    it('4.1 candidate with praise fails attempt 1, receives corrective feedback, candidate with forbidden value fails retry', async () => {
      const enc = encounters[0]; // Chasm of Reverse Tolls: forbidden [6, 7, 11, 12, 14, 22]
      const sessionId = `stress-gate-praise-forbidden-${Date.now()}`;
      clearSessionLog(sessionId);

      // Attempt 1: Praise word "brilliant" (164 chars)
      const attempt1Utterance = "That was a brilliant thought! If you walked this magical road backwards from the castle door, which gate would you reach first on your path towards the start?";
      // Attempt 2: Forbidden intermediate number 11 (160 chars)
      const attempt2Utterance = "If there were 11 coins left inside the pouch right before entering the castle, what was the very last thing that happened to the coins at the final magic gate?";

      let calls = 0;
      let promptSentToRetry = '';

      const fetchFn = async (url, options) => {
        calls++;
        const body = JSON.parse(options.body);
        if (calls === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [{
                content: { parts: [{ text: JSON.stringify({ utterance: attempt1Utterance }) }] }
              }]
            })
          };
        }
        promptSentToRetry = body.contents[0].parts[0].text;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              content: { parts: [{ text: JSON.stringify({ utterance: attempt2Utterance }) }] }
            }]
          })
        };
      };

      const res = await generateTurn({ ...enc, sessionId }, {
        adapter: 'gemini',
        apiKey: 'test-key',
        fetchFn,
        leakContext: enc.leakContext
      });

      assert.equal(calls, 2, 'Should execute exactly 2 attempts');
      assert.ok(
        promptSentToRetry.includes('evaluative praise') || promptSentToRetry.includes('praise'),
        'Retry prompt must include praise rule feedback'
      );
      assert.equal(res.fallback, true, 'Second gate failure must trigger fallback');
      assert.equal(res.retries, 1, 'Retries count must be 1');
      assert.equal(res.adapter, 'scripted_fallback');
      assert.ok(res.fallbackReason.includes('forbidden'), `Fallback reason should cite forbidden: ${res.fallbackReason}`);

      // Verify delivered probe passes leak gate 100%
      const gateCheck = checkUtterance(res.utterance, enc.leakContext);
      assert.equal(gateCheck.allowed, true);

      // Verify telemetry
      const events = readSessionEvents(sessionId);
      const rejectedEvent = events.find(e => e.type === 'utterance_rejected');
      assert.ok(rejectedEvent, 'Must emit utterance_rejected event on first gate rejection');
      assert.equal(rejectedEvent.reason, 'praise');
      assert.equal(rejectedEvent.candidate, attempt1Utterance);

      const tutorCall = events.find(e => e.type === 'tutor.call');
      assert.equal(tutorCall.fallback, true);
      assert.equal(tutorCall.retries, 1);

      const tutorSay = events.find(e => e.type === 'tutor.say');
      assert.equal(tutorSay.source, 'scripted');
      assert.equal(tutorSay.speech, res.utterance);

      clearSessionLog(sessionId);
    });

    it('4.2 candidate with banned op fails attempt 1, candidate with missing question mark fails retry on Claude', async () => {
      const enc = encounters[0];
      const sessionId = `stress-gate-op-shape-${Date.now()}`;
      clearSessionLog(sessionId);

      // Attempt 1: Banned operation "subtract" at l1 (161 chars)
      const attempt1Utterance = "Let us subtract the coins step by step from the final gate backwards. What was the very last thing that happened to the coins in her pouch before entering?";
      // Attempt 2: Missing trailing question mark, strictly between 150-300 chars (168 chars)
      const attempt2Utterance = "If you walked this road backwards from the castle door, you would meet the third gate first and see that coins were added back to her leather pouch before walking on.";

      let calls = 0;
      let promptSentToRetry = '';

      const fetchFn = async (url, options) => {
        calls++;
        const body = JSON.parse(options.body);
        if (calls === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              content: [{
                type: 'tool_use',
                name: 'respond_as_archimedes',
                input: { utterance: attempt1Utterance }
              }]
            })
          };
        }
        promptSentToRetry = body.messages[0].content;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            content: [{
              type: 'tool_use',
              name: 'respond_as_archimedes',
              input: { utterance: attempt2Utterance }
            }]
          })
        };
      };

      const res = await generateTurn({ ...enc, sessionId }, {
        adapter: 'claude',
        apiKey: 'test-key',
        fetchFn,
        leakContext: enc.leakContext
      });

      assert.equal(calls, 2);
      assert.ok(promptSentToRetry.includes('[CRITICAL CORRECTION REQUIRED FOR RETRY]'));
      assert.ok(promptSentToRetry.includes('banned_operation') || promptSentToRetry.includes('subtract'));
      assert.equal(res.fallback, true);
      assert.equal(res.retries, 1);
      assert.ok(res.fallbackReason.includes('shape'));
      assert.ok(checkUtterance(res.utterance, enc.leakContext).allowed);

      clearSessionLog(sessionId);
    });

    it('4.3 double gate failure falls back safely across all four encounters', async () => {
      const praiseCandidate = "Great job working on this puzzle! Can you tell me what you notice about the inscription, and what step makes the most sense to try first on this road?";

      for (const enc of encounters) {
        let calls = 0;
        const fetchFn = async () => {
          calls++;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [{
                content: { parts: [{ text: JSON.stringify({ utterance: praiseCandidate }) }] }
              }]
            })
          };
        };

        const res = await generateTurn(enc, {
          adapter: 'gemini',
          apiKey: 'test-key',
          fetchFn,
          leakContext: enc.leakContext
        });

        assert.equal(calls, 2, `Should attempt 2 calls for ${enc.encounterId}`);
        assert.equal(res.fallback, true, `Should fallback for ${enc.encounterId}`);
        assert.equal(res.retries, 1);
        assert.equal(res.adapter, 'scripted_fallback');
        assert.ok(
          checkUtterance(res.utterance, enc.leakContext).allowed,
          `Delivered scripted fallback for ${enc.encounterId} must pass leak gate`
        );
      }
    });
  });

  // ==========================================================================
  // 5. Information Diet & Schema Boundary Stress
  // ==========================================================================
  describe('5. Information Diet & Schema Stress', () => {
    it('5.1 strictly forbids secret smuggling via nested or prototype properties', async () => {
      const enc = encounters[0];

      // Smuggling targetAnswer in context
      await assert.rejects(async () => {
        await generateTurn({ ...enc, targetAnswer: 6 });
      }, /Information diet violation/);

      // Smuggling intermediates in context
      await assert.rejects(async () => {
        await generateTurn({ ...enc, intermediates: [11, 7] });
      }, /Information diet violation/);

      // Smuggling forbidden in context
      await assert.rejects(async () => {
        await generateTurn({ ...enc, forbidden: [6, 7] });
      }, /Information diet violation/);

      // Smuggling correctness signal
      await assert.rejects(async () => {
        await generateTurn({ ...enc, isCorrect: false });
      }, /Information diet violation/);
    });

    it('5.2 wire audit: retry corrective prompts never leak forbidden secret values', async () => {
      const enc = encounters[0]; // Reverse Tolls secret answer is 6, intermediates 11, 7
      let sentPrompts = [];

      const mockFetch = async (url, options) => {
        const body = JSON.parse(options.body);
        const userPrompt = body.contents?.[0]?.parts?.[0]?.text || body.messages?.[0]?.content || '';
        sentPrompts.push(userPrompt);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              // Length 43 is < 150 (fails length) but avoids character count collision with secret 6
              content: { parts: [{ text: JSON.stringify({ utterance: 'Can you tell me what you notice right now?' }) }] }
            }]
          })
        };
      };

      await generateTurn(enc, {
        adapter: 'gemini',
        apiKey: 'test-key',
        fetchFn: mockFetch,
        leakContext: enc.leakContext
      });

      assert.equal(sentPrompts.length, 2);
      const secretValues = [6, 7, 11, 14, 22];
      for (const promptStr of sentPrompts) {
        for (const secret of secretValues) {
          const regex = new RegExp(`\\b${secret}\\b`);
          assert.equal(
            regex.test(promptStr),
            false,
            `Secret value ${secret} leaked in outgoing prompt: ${promptStr}`
          );
        }
      }
    });
  });

});

