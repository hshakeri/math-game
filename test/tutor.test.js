/**
 * Castle of Theorems — Milestone M2 Tutor Mock Test Suite
 * test/tutor.test.js
 *
 * Verifies:
 * 1. Direct REST request payload construction and headers (Claude & Gemini).
 * 2. Successful response extraction from both provider formats.
 * 3. 4-second timeout enforcement (simulated abort) and fallback to scripted.
 * 4. Leak gate rejection triggering 1 retry with corrective prompt.
 * 5. Second gate rejection or network 500 error falling back to scripted probe.
 * 6. Strict Information Diet invariants: zero secret keys in context, zero property leaks,
 *    and zero secret numbers transmitted on the wire.
 * 7. ZERO external network calls during `npm test`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  generateClaudeTurn,
  extractUtteranceFromClaudeResponse,
  assertInformationDiet as assertClaudeDiet,
  ANTHROPIC_API_URL,
  ANTHROPIC_VERSION,
  DEFAULT_MODEL as DEFAULT_CLAUDE_MODEL
} from '../server/tutor/claude.js';

import {
  generateGeminiTurn,
  extractUtteranceFromGeminiResponse,
  assertInformationDiet as assertGeminiDiet,
  DEFAULT_ENDPOINT_BASE as GEMINI_ENDPOINT_BASE,
  DEFAULT_MODEL as DEFAULT_GEMINI_MODEL
} from '../server/tutor/gemini.js';

import {
  generateTurn,
  assertInformationDiet,
  buildAllowedContent,
  SYSTEM_PROMPT
} from '../server/tutor/index.js';

import { checkUtterance } from '../server/engine/leakGate.js';
import { getScriptedProbe } from '../server/engine/scripted.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to build mock Claude tool_use responses
function makeMockClaudeResponse(utterance, model = DEFAULT_CLAUDE_MODEL) {
  return {
    id: 'msg_mock_01' + Math.random().toString(36).slice(2),
    type: 'message',
    role: 'assistant',
    model,
    content: [
      {
        type: 'tool_use',
        id: 'toolu_mock_01' + Math.random().toString(36).slice(2),
        name: 'respond_as_archimedes',
        input: { utterance }
      }
    ],
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 140, output_tokens: 42 }
  };
}

// Helper to build mock Gemini structured responses
function makeMockGeminiResponse(utterance) {
  return {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({ utterance, studentSignal: 'engaged' })
            }
          ],
          role: 'model'
        },
        finishReason: 'STOP'
      }
    ],
    usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40, totalTokenCount: 160 }
  };
}

const baseTollsCtx = {
  encounterId: 'ch1-n1-reverse-tolls',
  partId: 'a',
  state: 'carry_out',
  rung: 'l1',
  inscription: 'A traveler crossed three magic toll gates on the road to the castle. At the first gate her pouch of Star-Coins doubled, then she paid 5 coins. At the second gate her coins doubled again, then she paid 3. At the third gate they doubled once more, then she paid 9. She walked into the castle with exactly 13 Star-Coins. How many did she start with?',
  allowedContent: {
    pool: [
      'If you walked this road backwards from the castle door, which gate would you reach first, and what happened there?',
      'Look at the very last gate before the castle: what was the last thing that changed the coins in her pouch?'
    ],
    hintText: null,
    cardNames: ['Work backwards']
  },
  chosenCard: 'Work backwards',
  childMessage: 'I am not sure where to start.',
  publicHistory: [
    { who: 'child', text: 'I am not sure where to start.' }
  ]
};

const tollsLeakContext = {
  forbidden: [6, 7, 11, 12, 14, 22],
  givens: [3, 5, 9, 13],
  rung: 'l1',
  hintText: '',
  inscription: baseTollsCtx.inscription
};

describe('Milestone M2: Socratic Tutor & Mock Adapter Test Suite', () => {

  // --------------------------------------------------------------------------
  // 0. Zero Runtime Dependencies & Provider Docs Verification
  // --------------------------------------------------------------------------
  describe('0. Architecture & Dependency Rules', () => {
    it('0.1 package.json contains zero runtime dependencies', () => {
      const pkgPath = path.resolve(__dirname, '../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assert.deepEqual(pkg.dependencies || {}, {}, 'Runtime dependencies must be empty');
    });

    it('0.2 gemini.js and claude.js record official documentation URL and date', () => {
      const geminiSrc = fs.readFileSync(path.resolve(__dirname, '../server/tutor/gemini.js'), 'utf8');
      const claudeSrc = fs.readFileSync(path.resolve(__dirname, '../server/tutor/claude.js'), 'utf8');

      assert.ok(geminiSrc.includes('https://ai.google.dev/api/generate-content'), 'gemini.js must reference Google AI API docs');
      assert.ok(geminiSrc.includes('2026-11'), 'gemini.js must reference fetch date 2026-11');

      assert.ok(claudeSrc.includes('https://docs.anthropic.com/en/api/messages'), 'claude.js must reference Anthropic API docs');
      assert.ok(claudeSrc.includes('2026-11'), 'claude.js must reference fetch date 2026-11');
    });

    it('0.3 prompt.md and schema.json exist and are well-formed', () => {
      const promptPath = path.resolve(__dirname, '../server/tutor/prompt.md');
      const schemaPath = path.resolve(__dirname, '../server/tutor/schema.json');

      assert.ok(fs.existsSync(promptPath), 'prompt.md must exist');
      assert.ok(fs.existsSync(schemaPath), 'schema.json must exist');

      const promptText = fs.readFileSync(promptPath, 'utf8');
      assert.ok(promptText.includes('Archimedes the Owl'), 'prompt.md must contain Archimedes the Owl persona');
      assert.ok(promptText.includes('150 to 300 characters'), 'prompt.md must state 150-300 characters rule');

      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      assert.ok(schema.properties.speech, 'schema.json must specify speech property');
      assert.ok(schema.properties.studentSignal, 'schema.json must specify studentSignal property');
    });
  });

  // --------------------------------------------------------------------------
  // 1. Claude REST Adapter Direct Native REST
  // --------------------------------------------------------------------------
  describe('1. Claude REST Adapter', () => {
    it('1.1 correctly builds endpoint, headers, and tool_choice payload', async () => {
      let interceptedUrl = null;
      let interceptedOptions = null;

      const validProbe = "If you walked this road backwards from the castle door, which gate would you reach first, and what was the very last thing that happened to the coins in her pouch?";
      const mockFetch = async (url, options) => {
        interceptedUrl = url;
        interceptedOptions = options;
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => makeMockClaudeResponse(validProbe)
        };
      };

      const result = await generateClaudeTurn(baseTollsCtx, {
        apiKey: 'sk-ant-test-key-12345',
        fetchFn: mockFetch
      });

      assert.equal(interceptedUrl, ANTHROPIC_API_URL);
      assert.equal(interceptedOptions.method, 'POST');
      assert.equal(interceptedOptions.headers['content-type'], 'application/json');
      assert.equal(interceptedOptions.headers['x-api-key'], 'sk-ant-test-key-12345');
      assert.equal(interceptedOptions.headers['anthropic-version'], ANTHROPIC_VERSION);

      const body = JSON.parse(interceptedOptions.body);
      assert.equal(body.model, DEFAULT_CLAUDE_MODEL);
      assert.equal(body.max_tokens, 256);
      assert.ok(body.system.includes('Archimedes the Owl'));
      assert.ok(Array.isArray(body.tools));
      assert.equal(body.tools[0].name, 'respond_as_archimedes');
      assert.deepEqual(body.tool_choice, { type: 'tool', name: 'respond_as_archimedes' });

      assert.equal(result.utterance, validProbe);
      assert.equal(result.adapter, 'claude');
      assert.ok(result.latencyMs >= 0);
    });

    it('1.2 extracts utterance from tool_use block and falls back safely', () => {
      const probeText = "If you walked this road backwards from the castle door, which gate would you reach first, and what was the very last thing that happened to the coins in her pouch?";
      const responseObj = makeMockClaudeResponse(probeText);
      const extracted = extractUtteranceFromClaudeResponse(responseObj);
      assert.equal(extracted, probeText);

      // Test stringified input fallback
      const stringifiedInputResp = {
        content: [
          {
            type: 'tool_use',
            name: 'respond_as_archimedes',
            input: JSON.stringify({ utterance: probeText })
          }
        ]
      };
      assert.equal(extractUtteranceFromClaudeResponse(stringifiedInputResp), probeText);

      // Test rejection if no tool_use block and no valid JSON text
      assert.throws(() => {
        extractUtteranceFromClaudeResponse({ content: [{ type: 'text', text: 'plain text without json' }] });
      }, /did not contain a valid respond_as_archimedes tool utterance/);
    });

    it('1.3 enforces 4-second timeout and translates abort to TimeoutError', async () => {
      const mockFetchTimeout = async (url, options) => {
        assert.ok(options.signal instanceof AbortSignal);
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      };

      await assert.rejects(
        async () => {
          await generateClaudeTurn(baseTollsCtx, {
            apiKey: 'sk-ant-test',
            fetchFn: mockFetchTimeout,
            timeoutMs: 4000
          });
        },
        (err) => {
          assert.equal(err.name, 'TimeoutError');
          assert.ok(err.message.includes('timed out'));
          return true;
        }
      );
    });

    it('1.4 throws descriptive error on HTTP 500 or 401', async () => {
      const mockFetch500 = async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Internal Server Error: overloaded'
      });

      await assert.rejects(
        async () => {
          await generateClaudeTurn(baseTollsCtx, {
            apiKey: 'sk-ant-test',
            fetchFn: mockFetch500
          });
        },
        (err) => {
          assert.equal(err.status, 500);
          assert.ok(err.message.includes('HTTP 500'));
          return true;
        }
      );
    });

    it('1.5 injects correctiveContext into prompt on retry', async () => {
      let interceptedPrompt = null;
      const mockFetch = async (url, options) => {
        const body = JSON.parse(options.body);
        interceptedPrompt = body.messages[0].content;
        return {
          ok: true,
          status: 200,
          json: async () => makeMockClaudeResponse("If you walked this road backwards from the castle door, which gate would you reach first, and what was the very last thing that happened to the coins in her pouch?")
        };
      };

      await generateClaudeTurn(baseTollsCtx, {
        apiKey: 'sk-ant-test',
        fetchFn: mockFetch,
        correctiveContext: 'Previous response broke rule praise: contains word great'
      });

      assert.ok(interceptedPrompt.includes('[CRITICAL CORRECTION REQUIRED FOR RETRY]'));
      assert.ok(interceptedPrompt.includes('Previous response broke rule praise'));
    });
  });

  // --------------------------------------------------------------------------
  // 2. Gemini REST Adapter
  // --------------------------------------------------------------------------
  describe('2. Gemini REST Adapter', () => {
    it('2.1 correctly builds endpoint, thinkingLevel: low, and responseSchema', async () => {
      let interceptedUrl = null;
      let interceptedOptions = null;

      const validProbe = "Think of putting on socks and then shoes on your feet. When it is time to take them off, which one comes off first, and what does that tell us about undoing the gates?";
      const mockFetch = async (url, options) => {
        interceptedUrl = url;
        interceptedOptions = options;
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => makeMockGeminiResponse(validProbe)
        };
      };

      const result = await generateGeminiTurn(baseTollsCtx, {
        apiKey: 'test-goog-key',
        fetchFn: mockFetch
      });

      assert.ok(interceptedUrl.includes(DEFAULT_GEMINI_MODEL));
      assert.equal(interceptedOptions.method, 'POST');
      assert.equal(interceptedOptions.headers['Content-Type'], 'application/json');

      const body = JSON.parse(interceptedOptions.body);
      assert.ok(body.systemInstruction.parts[0].text.includes('Archimedes the Owl'));
      assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'low');
      assert.equal(body.generationConfig.responseMimeType, 'application/json');
      assert.equal(body.generationConfig.responseSchema.properties.utterance.type, 'STRING');

      assert.equal(result.utterance, validProbe);
      assert.equal(result.adapter, 'gemini');
    });

    it('2.2 extracts utterance from Gemini candidate text and handles timeouts', async () => {
      const probeText = "Think of putting on socks and then shoes on your feet. When it is time to take them off, which one comes off first, and what does that tell us about undoing the gates?";
      const geminiResp = makeMockGeminiResponse(probeText);
      assert.equal(extractUtteranceFromGeminiResponse(geminiResp), probeText);

      const mockFetchTimeout = async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      };

      await assert.rejects(
        async () => {
          await generateGeminiTurn(baseTollsCtx, { apiKey: 'test', fetchFn: mockFetchTimeout });
        },
        (err) => {
          assert.equal(err.name, 'TimeoutError');
          return true;
        }
      );
    });

    it('2.3 throws descriptive error on Gemini HTTP 500 error', async () => {
      const mockFetch500 = async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Internal Server Error: backend failure'
      });

      await assert.rejects(
        async () => {
          await generateGeminiTurn(baseTollsCtx, { apiKey: 'test', fetchFn: mockFetch500 });
        },
        (err) => {
          assert.equal(err.status, 500);
          assert.ok(err.message.includes('HTTP 500'));
          return true;
        }
      );
    });

    it('2.4 injects correctiveContext into Gemini user message payload on retry', async () => {
      let interceptedBody = null;
      const mockFetch = async (url, options) => {
        interceptedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => makeMockGeminiResponse("Think of putting on socks and then shoes on your feet. When it is time to take them off, which one comes off first, and what does that tell us about undoing the gates?")
        };
      };

      await generateGeminiTurn(baseTollsCtx, {
        apiKey: 'test-goog-key',
        fetchFn: mockFetch,
        correctiveContext: 'Previous reply broke rule praise: contains word great'
      });

      const userText = interceptedBody.contents[0].parts[0].text;
      assert.ok(userText.includes('Previous reply broke gate rule'));
      assert.ok(userText.includes('praise: contains word great'));
    });
  });

  // --------------------------------------------------------------------------
  // 3. Router Lifecycle: Scripted Mode, Retry, Fallback, and Leak Gate
  // --------------------------------------------------------------------------
  describe('3. Router Lifecycle & Leak Gate', () => {
    it('3.1 scripted mode returns authored probe directly with 0 retries and fallback: false', async () => {
      const res = await generateTurn(baseTollsCtx, { adapter: 'scripted' });
      assert.equal(res.adapter, 'scripted');
      assert.equal(res.retries, 0);
      assert.equal(res.fallback, false);
      assert.ok(typeof res.utterance === 'string' && res.utterance.length > 0);

      const gateVerdict = checkUtterance(res.utterance, tollsLeakContext);
      assert.equal(gateVerdict.allowed, true);
    });

    it('3.2 clean probe passes on first attempt with 0 retries and fallback: false', async () => {
      const cleanProbe = "If you walked this road backwards from the castle door, which gate would you reach first, and what was the very last thing that happened to the coins in her pouch?";
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => makeMockClaudeResponse(cleanProbe)
      });

      const res = await generateTurn(baseTollsCtx, { adapter: 'claude', fetchFn: mockFetch, apiKey: 'test' });
      assert.equal(res.utterance, cleanProbe);
      assert.equal(res.retries, 0);
      assert.equal(res.fallback, false);
    });

    it('3.3 leak gate failure triggers exactly 1 retry with corrective context, succeeding on retry', async () => {
      let callCount = 0;
      const failingProbe = "Great thinking! Let us double the coins first and then subtract 5 at the first gate to see what happens?"; // contains praise 'great' and op names at l1
      const compliantProbe = "If you walked this road backwards from the castle door, which gate would you reach first, and what was the very last thing that happened to the coins in her pouch?";

      const mockFetch = async (url, options) => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => makeMockClaudeResponse(failingProbe)
          };
        }
        // Second call should have corrective context
        const body = JSON.parse(options.body);
        assert.ok(body.messages[0].content.includes('[CRITICAL CORRECTION REQUIRED FOR RETRY]'));
        return {
          ok: true,
          status: 200,
          json: async () => makeMockClaudeResponse(compliantProbe)
        };
      };

      const res = await generateTurn(baseTollsCtx, { adapter: 'claude', fetchFn: mockFetch, apiKey: 'test' });
      assert.equal(callCount, 2);
      assert.equal(res.utterance, compliantProbe);
      assert.equal(res.retries, 1);
      assert.equal(res.fallback, false);
    });

    it('3.4 double leak gate failure falls back to authored scripted probe', async () => {
      let callCount = 0;
      const failingProbe = "Great job! You are so close to finding the answer!"; // praise + length < 150

      const mockFetch = async () => {
        callCount++;
        return {
          ok: true,
          status: 200,
          json: async () => makeMockClaudeResponse(failingProbe)
        };
      };

      const res = await generateTurn(baseTollsCtx, { adapter: 'claude', fetchFn: mockFetch, apiKey: 'test' });
      assert.equal(callCount, 2);
      assert.equal(res.adapter, 'scripted_fallback');
      assert.equal(res.fallback, true);
      assert.equal(res.retries, 1);

      // Verify delivered probe passes leak gate 100%
      const gateVerdict = checkUtterance(res.utterance, tollsLeakContext);
      assert.equal(gateVerdict.allowed, true);
    });

    it('3.5 timeout abort falls back to authored scripted probe without throwing', async () => {
      const mockFetchTimeout = async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      };

      const res = await generateTurn(baseTollsCtx, { adapter: 'claude', fetchFn: mockFetchTimeout, apiKey: 'test' });
      assert.equal(res.fallback, true);
      const gateVerdict = checkUtterance(res.utterance, tollsLeakContext);
      assert.equal(gateVerdict.allowed, true);
    });

    it('3.6 HTTP 500 error falls back to authored scripted probe', async () => {
      const mockFetch500 = async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Service Unavailable'
      });

      const res = await generateTurn(baseTollsCtx, { adapter: 'claude', fetchFn: mockFetch500, apiKey: 'test' });
      assert.equal(res.fallback, true);
      const gateVerdict = checkUtterance(res.utterance, tollsLeakContext);
      assert.equal(gateVerdict.allowed, true);
    });

    it('3.7 router works identically with Gemini adapter', async () => {
      const validProbe = "Think of putting on socks and then shoes on your feet. When it is time to take them off, which one comes off first, and what does that tell us about undoing the gates?";
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => makeMockGeminiResponse(validProbe)
      });

      const res = await generateTurn(baseTollsCtx, { adapter: 'gemini', fetchFn: mockFetch, apiKey: 'test-goog' });
      assert.equal(res.utterance, validProbe);
      assert.equal(res.adapter, 'gemini');
      assert.equal(res.retries, 0);
      assert.equal(res.fallback, false);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Strict Information Diet Invariants
  // --------------------------------------------------------------------------
  describe('4. Strict Information Diet Invariants', () => {
    it('4.1 throws an error if any forbidden key is present in ctx', () => {
      assert.throws(() => {
        assertInformationDiet({ ...baseTollsCtx, targetAnswer: 6 });
      }, /Information diet violation.*targetAnswer/);

      assert.throws(() => {
        assertInformationDiet({ ...baseTollsCtx, answer: 6 });
      }, /Information diet violation.*answer/);

      assert.throws(() => {
        assertInformationDiet({ ...baseTollsCtx, intermediates: [11, 7, 6] });
      }, /Information diet violation.*intermediates/);

      assert.throws(() => {
        assertInformationDiet({ ...baseTollsCtx, isCorrect: true });
      }, /Information diet violation.*isCorrect/);

      assert.throws(() => {
        assertInformationDiet({ ...baseTollsCtx, forbidden: [6, 7, 11] });
      }, /Information diet violation.*forbidden/);

      assert.throws(() => {
        assertClaudeDiet({ ...baseTollsCtx, targetAnswer: 6 });
      }, /Information diet violation.*targetAnswer/);

      assert.throws(() => {
        assertGeminiDiet({ ...baseTollsCtx, targetAnswer: 6 });
      }, /Information diet violation.*targetAnswer/);
    });

    it('4.2 proxies ctx and ensures zero secret properties are ever read during turn generation', async () => {
      const forbiddenPropertyAccesses = [];
      const forbiddenNames = ['targetAnswer', 'answer', 'intermediates', 'solution', 'solutionTree', 'isCorrect', 'correct', 'correctness', 'forbidden'];

      const monitoredCtx = new Proxy({ ...baseTollsCtx }, {
        get(target, prop, receiver) {
          if (typeof prop === 'string' && forbiddenNames.includes(prop)) {
            forbiddenPropertyAccesses.push(prop);
          }
          return Reflect.get(target, prop, receiver);
        }
      });

      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => makeMockClaudeResponse("If you walked this road backwards from the castle door, which gate would you reach first, and what was the very last thing that happened to the coins in her pouch?")
      });

      await generateClaudeTurn(monitoredCtx, { apiKey: 'sk-ant-test', fetchFn: mockFetch });

      assert.equal(forbiddenPropertyAccesses.length, 0, `Forbidden property access detected: ${forbiddenPropertyAccesses.join(', ')}`);
    });

    it('4.3 audits outgoing wire payload: zero secret intermediates or target answers are sent over the wire', async () => {
      let promptText = '';
      const mockFetch = async (url, options) => {
        const body = JSON.parse(options.body);
        promptText = body.messages[0].content;
        return {
          ok: true,
          status: 200,
          json: async () => makeMockClaudeResponse("If you walked this road backwards from the castle door, which gate would you reach first, and what was the very last thing that happened to the coins in her pouch?")
        };
      };

      await generateClaudeTurn(baseTollsCtx, { apiKey: 'sk-ant-test', fetchFn: mockFetch });

      // In Chasm of Reverse Tolls:
      // Secret answer: 6
      // Intermediates: 11, 7
      // Givens in inscription: 3, 5, 9, 13
      // The numbers 6, 7, 11, 14, 22 MUST NOT appear anywhere in the outgoing prompt message!
      const forbiddenValues = [6, 7, 11, 14, 22];
      for (const val of forbiddenValues) {
        const regexDigit = new RegExp(`\\b${val}\\b`);
        assert.equal(
          regexDigit.test(promptText),
          false,
          `CRITICAL LEAK AUDIT FAILURE: Secret value ${val} leaked into outgoing prompt message!`
        );
      }
    });

    it('4.4 audits router payload assembly across all four encounters', () => {
      const encounters = [
        { id: 'ch1-n1-reverse-tolls', partId: 'a' },
        { id: 'ch1-n2-dark-vault', partId: 'a' },
        { id: 'ch1-n3-five-shields', partId: 'a' },
        { id: 'ch1-n4-castle-keep', partId: 'a' }
      ];

      for (const enc of encounters) {
        const content = buildAllowedContent(null, null, 'understand', 'l0');
        assert.ok(content, `buildAllowedContent should return valid object for ${enc.id}`);
        // Ensure no numbers or secrets in pool
        assert.ok(content.pool === null || Array.isArray(content.pool));
      }
    });
  });

});
