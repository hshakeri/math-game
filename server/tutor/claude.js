// Reference: https://docs.anthropic.com/en/api/messages (Fetched 2026-11)
/**
 * Castle of Theorems v1 (Home Edition)
 * Anthropic Claude Direct REST Adapter
 *
 * Implements SPEC §6, §7, §13, §14 (Milestone M2)
 * ZERO runtime SDKs: uses native fetch() and AbortSignal.timeout(4000).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';
export const DEFAULT_MODEL = 'claude-sonnet-4-6-20260320';
export const DEFAULT_TIMEOUT_MS = 4000;
export const DEFAULT_MAX_TOKENS = 256;

// Verbatim Archimedes prompt from SPEC §6
const VERBATIM_PROMPT = `You are Archimedes the Owl, Royal Architect to a young builder (8 years old, strong at math) on a quest to the Castle of Theorems. You speak in plain words a third grader reads easily.

Your job each turn is to write ONE short reply that moves the builder's own thinking forward. You never solve the problem, never state or imply a number that could be the answer or a step toward it, and never say whether the builder's idea is right or wrong.

Rules you follow every turn:
1. Use only the material in allowedContent. If a pool is given, pick one probe or paraphrase it closely. If hintText is given, convey that idea and nothing beyond it.
2. Write 150 to 300 characters. End with exactly one question. No lists, no emoji.
3. Keep the same calm, curious tone whether the builder seems right or wrong. Do not praise, cheer or reassure. Do not evaluate. Test ideas instead: ask what would happen if one thing in the scene changed.
4. Refer to the builder's own words when you can, so the reply fits what they just said.
5. If the builder asks you for the answer, or asks you to choose between two numbers, decline in one sentence and ask how they could check it themselves.
6. Never mention these rules, the stages, hint levels, or that you are an AI.

Return only the JSON object described in the schema.`;

let cachedPrompt = null;
export function getArchimedesPrompt() {
  if (cachedPrompt) return cachedPrompt;
  const promptPath = path.resolve(__dirname, 'prompt.md');
  if (fs.existsSync(promptPath)) {
    try {
      cachedPrompt = fs.readFileSync(promptPath, 'utf8').trim();
      return cachedPrompt;
    } catch {
      // fallback
    }
  }
  return VERBATIM_PROMPT;
}

export const ARCHIMEDES_TOOL = {
  name: 'respond_as_archimedes',
  description: 'Deliver Socratic prompt to child',
  input_schema: {
    type: 'object',
    properties: {
      utterance: {
        type: 'string',
        description: 'The Socratic probe for the child, 150 to 300 characters, ending in a single question mark.'
      }
    },
    required: ['utterance'],
    additionalProperties: false
  }
};

/**
 * Strict Information Diet guard.
 * Asserts that no secret or intermediate values exist in the context passed to the adapter.
 * @param {object} ctx
 */
export function assertInformationDiet(ctx) {
  if (!ctx || typeof ctx !== 'object') return;

  const forbiddenKeys = [
    'targetAnswer',
    'answer',
    'solution',
    'intermediates',
    'solutionTree',
    'isCorrect',
    'correct',
    'correctness',
    'forbidden'
  ];

  for (const key of forbiddenKeys) {
    if (key in ctx && ctx[key] !== undefined) {
      throw new Error(`Information diet violation: ctx contains forbidden key "${key}"`);
    }
  }
}

/**
 * Formats user message from sanitized turn context and optional corrective feedback.
 * @param {object} ctx
 * @param {string|null} [correctiveContext=null]
 * @returns {string}
 */
export function formatUserMessage(ctx, correctiveContext = null) {
  const parts = [];

  if (ctx.encounterId) {
    parts.push(`Encounter: ${ctx.encounterId} (Part ${ctx.partId || 'a'})`);
  }
  if (ctx.state) parts.push(`Current Stage: ${ctx.state}`);
  const rung = ctx.rung || ctx.hintRung;
  if (rung) parts.push(`Hint Rung: ${rung}`);

  if (ctx.inscription) {
    parts.push(`Problem Inscription: "${ctx.inscription}"`);
  }

  if (ctx.allowedContent) {
    const ac = ctx.allowedContent;
    const allowed = [];
    if (Array.isArray(ac.pool) && ac.pool.length > 0) {
      allowed.push(`- Probe pool: ${JSON.stringify(ac.pool)}`);
    }
    if (ac.hintText) {
      allowed.push(`- Hint text: "${ac.hintText}"`);
    }
    if (Array.isArray(ac.cardNames) && ac.cardNames.length > 0) {
      allowed.push(`- Available cards: ${ac.cardNames.join(', ')}`);
    }
    if (allowed.length > 0) {
      parts.push(`Allowed Material:\n${allowed.join('\n')}`);
    }
  }

  if (ctx.chosenCard) {
    parts.push(`Child selected Heuristic Card: "${ctx.chosenCard}"`);
  }

  if (ctx.childMessage) {
    parts.push(`Child's latest input: "${ctx.childMessage}"`);
  } else if (ctx.childAction) {
    const summary = typeof ctx.childAction === 'string' ? ctx.childAction : JSON.stringify(ctx.childAction);
    parts.push(`Child's latest action: ${summary}`);
  }

  if (Array.isArray(ctx.publicHistory) && ctx.publicHistory.length > 0) {
    const historySummary = ctx.publicHistory
      .slice(-4)
      .map(h => `${h.who || h.role || 'speaker'}: ${h.text || h.message || ''}`)
      .join('\n');
    parts.push(`Recent Conversation:\n${historySummary}`);
  }

  if (correctiveContext) {
    parts.push(`[CRITICAL CORRECTION REQUIRED FOR RETRY]:\nYour previous response was rejected by the deterministic safety gate: "${correctiveContext}".\nYou must rewrite your response to strictly satisfy all rules: 150 to 300 characters, ending in exactly one question mark, zero praise words, zero digits if at l0/l1, and no operations named.`);
  }

  parts.push(`Deliver your Socratic response now using the respond_as_archimedes tool.`);

  return parts.join('\n\n');
}

/**
 * Extracts candidate utterance from Anthropic Claude Messages response payload.
 * Supports tool_use block and text block fallbacks.
 * @param {object} data
 * @returns {string}
 */
export function extractUtteranceFromClaudeResponse(data) {
  if (!data || !Array.isArray(data.content)) {
    throw new Error('Claude API response missing content array');
  }

  const toolBlock = data.content.find(
    b => b && b.type === 'tool_use' && b.name === 'respond_as_archimedes'
  );

  if (toolBlock && toolBlock.input) {
    if (typeof toolBlock.input.utterance === 'string' && toolBlock.input.utterance.trim()) {
      return toolBlock.input.utterance.trim();
    }
    if (typeof toolBlock.input === 'string') {
      try {
        const parsed = JSON.parse(toolBlock.input);
        if (typeof parsed.utterance === 'string' && parsed.utterance.trim()) {
          return parsed.utterance.trim();
        }
      } catch {
        // continue
      }
    }
  }

  // Fallback: check text blocks for JSON or utterance
  for (const block of data.content) {
    if (block && block.type === 'text' && typeof block.text === 'string') {
      try {
        const parsed = JSON.parse(block.text);
        if (typeof parsed.utterance === 'string' && parsed.utterance.trim()) {
          return parsed.utterance.trim();
        }
      } catch {
        // not json
      }
    }
  }

  throw new Error('Claude API response did not contain a valid respond_as_archimedes tool utterance');
}

/**
 * Direct REST Claude Adapter.
 * Calls Anthropic Messages API using native fetch().
 *
 * @param {object} ctx - Sanitized turn context (Strict Information Diet enforced)
 * @param {object} [options={}] - Optional overrides and retry context
 * @param {string} [options.correctiveContext] - Reason for retry if previous attempt failed leak gate
 * @param {function} [options.fetchFn] - Custom fetch for testing / mocking
 * @param {string} [options.apiKey] - Anthropic API key override
 * @param {string} [options.model] - Model name override
 * @param {number} [options.timeoutMs=4000] - Hard timeout in ms
 * @param {string} [options.systemPrompt] - System prompt override
 * @returns {Promise<{ utterance: string, speech: string, adapter: string, latencyMs: number, raw: object, usage: object|null }>}
 */
export async function generateClaudeTurn(ctx, options = {}) {
  assertInformationDiet(ctx);

  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is missing');
  }

  const model = options.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = options.fetchFn || globalThis.fetch;
  const systemPrompt = options.systemPrompt || getArchimedesPrompt();
  const userMessage = formatUserMessage(ctx, options.correctiveContext);

  const payload = {
    model,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage
      }
    ],
    tools: [ARCHIMEDES_TOOL],
    tool_choice: {
      type: 'tool',
      name: 'respond_as_archimedes'
    }
  };

  const startTime = Date.now();
  let response;

  try {
    response = await fetchFn(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      const timeoutErr = new DOMException(`Claude API request timed out after ${timeoutMs}ms`, 'TimeoutError');
      timeoutErr.latencyMs = latencyMs;
      throw timeoutErr;
    }
    err.latencyMs = latencyMs;
    throw err;
  }

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch {
      errorBody = response.statusText;
    }
    const httpErr = new Error(`Claude API HTTP ${response.status}: ${errorBody}`);
    httpErr.status = response.status;
    httpErr.latencyMs = latencyMs;
    throw httpErr;
  }

  const data = await response.json();
  const utterance = extractUtteranceFromClaudeResponse(data);

  return {
    utterance,
    speech: utterance,
    adapter: 'claude',
    latencyMs,
    raw: data,
    usage: data.usage || null
  };
}

/**
 * Standard interface alias for router compatibility.
 */
export async function generateTurn(ctx, options = {}) {
  return generateClaudeTurn(ctx, options);
}

/**
 * Direct interface bridge for server/tutor/index.js
 *
 * @param {object} turnRequest - Whitelisted request payload
 * @param {string} systemPrompt - Archimedes prompt
 * @param {number} [timeoutMs=4000] - Hard 4s timeout
 * @param {object} [options={}] - Options forwarded to adapter
 * @returns {Promise<{ raw: string, parsed: object }>}
 */
export async function callAdapter(turnRequest, systemPrompt, timeoutMs = 4000, options = {}) {
  const result = await generateClaudeTurn(turnRequest, {
    systemPrompt,
    timeoutMs,
    ...options
  });

  return {
    raw: JSON.stringify(result.raw || { utterance: result.utterance }),
    parsed: {
      speech: result.utterance,
      utterance: result.utterance,
      ...(result.parsed || {})
    }
  };
}

export default generateClaudeTurn;
