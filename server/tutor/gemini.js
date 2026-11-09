// Reference: https://ai.google.dev/api/generate-content (Fetched 2026-11)
// Reference: https://ai.google.dev/api/rest/v1beta/models/generateContent (Fetched 2026-11)
/**
 * Castle of Theorems v1 (Home Edition)
 * Gemini 3.8 Flash Direct REST Tutor Adapter
 *
 * Implements SPEC §6, §7, §14 (Milestone M2)
 * ZERO runtime SDKs: uses native fetch() and AbortSignal.timeout(4000).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_MODEL = 'gemini-3.8-flash';
export const DEFAULT_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_TIMEOUT_MS = 4000;

/**
 * Gemini OpenAPI Schema for Socratic Tutor Structured Output
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    utterance: {
      type: 'STRING',
      description: 'The Socratic probe for the child, 150-300 characters, ending with exactly one question mark.'
    },
    speech: {
      type: 'STRING',
      description: 'Alias for utterance to ensure cross-adapter schema compatibility.'
    },
    studentSignal: {
      type: 'STRING',
      enum: ['engaged', 'stuck', 'guessing', 'off_topic'],
      description: 'Advisory telemetry on child engagement.'
    },
    suggestCard: {
      type: 'STRING',
      description: 'Heuristic card name suggested to the child, if any.'
    }
  },
  required: ['utterance']
};

export const DEFAULT_SYSTEM_PROMPT = `You are Archimedes the Owl, Royal Architect to a young builder (8 years old, strong at math) on a quest to the Castle of Theorems. You speak in plain words a third grader reads easily.

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

/**
 * Loads Archimedes system prompt from prompt.md or cached default.
 * @returns {string}
 */
export function getSystemPrompt() {
  if (cachedPrompt) return cachedPrompt;
  const promptPath = path.resolve(__dirname, 'prompt.md');
  if (fs.existsSync(promptPath)) {
    try {
      cachedPrompt = fs.readFileSync(promptPath, 'utf8').trim();
      return cachedPrompt;
    } catch {
      // Fall through to default
    }
  }
  return DEFAULT_SYSTEM_PROMPT;
}

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
 * Strictly purges any secret or forbidden fields from ctx.
 * Enforces Pillar 4 / R2 Information Diet at adapter boundary.
 *
 * @param {object} ctx
 * @returns {object} sanitized copy
 */
export function sanitizeContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return {};
  const copy = { ...ctx };
  delete copy.targetAnswer;
  delete copy.intermediates;
  delete copy.solution;
  delete copy.answer;
  delete copy.forbidden;
  delete copy.secret;
  delete copy.solutionTree;
  delete copy.isCorrect;
  delete copy.correct;
  delete copy.correctness;
  return copy;
}

/**
 * Prepares the user message payload from ctx and optional correctiveContext.
 *
 * @param {object|string} ctx
 * @param {string|null} [correctiveContext=null]
 * @returns {string} JSON-formatted string for user prompt
 */
export function buildUserMessage(ctx, correctiveContext = null) {
  if (typeof ctx === 'string') {
    return correctiveContext ? `${ctx}\n\nCorrection: ${correctiveContext}` : ctx;
  }

  const sanitized = sanitizeContext(ctx);
  const payload = {
    context: sanitized
  };

  if (correctiveContext) {
    payload.correction = `Previous reply broke gate rule: ${correctiveContext}. Write a different reply that strictly adheres to the 150-300 character constraint, ends in exactly one question mark, contains no praise words, and avoids all forbidden digits/operations.`;
  }

  return JSON.stringify(payload, null, 2);
}

/**
 * Constructs the REST request body conforming to Gemini 3.8 Flash specifications.
 *
 * @param {object} ctx
 * @param {object} [options]
 * @returns {object} Gemini REST payload
 */
export function buildGeminiRequestBody(ctx, options = {}) {
  const systemPrompt = options.systemPrompt || getSystemPrompt();
  const userMessage = options.userMessage || buildUserMessage(ctx, options.correctiveContext);

  return {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage }]
      }
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 256,
      responseMimeType: 'application/json',
      responseSchema: options.responseSchema || GEMINI_RESPONSE_SCHEMA,
      thinkingConfig: {
        thinkingLevel: options.thinkingLevel || 'low'
      }
    }
  };
}

/**
 * Parses Gemini API response JSON.
 *
 * @param {object} data - Parsed HTTP response JSON from Gemini endpoint
 * @returns {{ utterance?: string, speech?: string, raw?: any, error?: string, detail?: string }}
 */
export function parseGeminiResponse(data) {
  if (!data || typeof data !== 'object') {
    return { error: 'INVALID_RESPONSE_DATA', detail: 'Response body is not an object' };
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    return { error: 'NO_CANDIDATE', detail: data.promptFeedback ? JSON.stringify(data.promptFeedback) : 'No candidate returned' };
  }

  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
    return { error: `BLOCKED_${candidate.finishReason}`, detail: `Candidate blocked with finishReason ${candidate.finishReason}` };
  }

  const parts = candidate.content?.parts || [];
  const textPart = parts.find(p => !p.thought && typeof p.text === 'string') || parts[0];
  const rawText = textPart?.text;

  if (!rawText || typeof rawText !== 'string') {
    return { error: 'EMPTY_TEXT_PART', detail: 'Candidate content parts contained no valid text' };
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(rawText.trim());
  } catch (err) {
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      parsedJson = JSON.parse(cleaned);
    } catch (err2) {
      return { error: 'MALFORMED_JSON', detail: rawText };
    }
  }

  const utterance = (parsedJson.utterance || parsedJson.speech || parsedJson.probe || '').trim();
  if (!utterance) {
    return { error: 'MISSING_UTTERANCE_FIELD', detail: rawText, raw: parsedJson };
  }

  return {
    utterance,
    speech: utterance,
    studentSignal: parsedJson.studentSignal || 'engaged',
    suggestCard: parsedJson.suggestCard || null,
    raw: parsedJson
  };
}

/**
 * Extracts utterance from Gemini candidate response or throws descriptive error.
 *
 * @param {object} data
 * @returns {string}
 */
export function extractUtteranceFromGeminiResponse(data) {
  const parsed = parseGeminiResponse(data);
  if (parsed.error || !parsed.utterance) {
    throw new Error(parsed.detail || parsed.error || 'Could not extract utterance from Gemini response');
  }
  return parsed.utterance;
}

/**
 * Calls Gemini 3.8 Flash via direct REST.
 *
 * @param {object} ctx - Context object (SPEC §6)
 * @param {object} [options]
 * @param {string} [options.correctiveContext] - Optional feedback from failed leak gate check
 * @param {string} [options.apiKey] - Override GEMINI_API_KEY
 * @param {string} [options.model] - Override model (default 'gemini-3.8-flash')
 * @param {number} [options.timeoutMs=4000] - Timeout in ms (default 4000)
 * @param {Function} [options.fetchFn] - Mockable fetch implementation
 * @returns {Promise<{ utterance: string, speech: string, adapter: string, model: string, latencyMs: number, raw: object, parsed: object, usage: object|null }>}
 */
export async function generateGeminiTurn(ctx, options = {}) {
  assertInformationDiet(ctx);

  const start = Date.now();
  const model = options.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = options.fetchFn || globalThis.fetch;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const endpoint = options.endpoint || `${DEFAULT_ENDPOINT_BASE}/${model}:generateContent?key=${apiKey}`;
  const requestBody = buildGeminiRequestBody(ctx, options);

  let res;
  try {
    res = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (err) {
    const latencyMs = Date.now() - start;
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      const timeoutErr = new DOMException(`Gemini API request timed out after ${timeoutMs}ms`, 'TimeoutError');
      timeoutErr.latencyMs = latencyMs;
      throw timeoutErr;
    }
    err.latencyMs = latencyMs;
    throw err;
  }

  const latencyMs = Date.now() - start;

  if (!res.ok) {
    let errBody = '';
    try {
      errBody = await res.text();
    } catch {
      errBody = res.statusText;
    }
    const httpErr = new Error(`Gemini API HTTP ${res.status}: ${errBody}`);
    httpErr.status = res.status;
    httpErr.latencyMs = latencyMs;
    throw httpErr;
  }

  let data;
  try {
    data = await res.json();
  } catch (jsonErr) {
    const parseErr = new Error(`Gemini API invalid response JSON: ${jsonErr.message}`);
    parseErr.latencyMs = latencyMs;
    throw parseErr;
  }

  const parsed = parseGeminiResponse(data);
  if (parsed.error || !parsed.utterance) {
    const err = new Error(parsed.detail || parsed.error || 'Gemini response missing valid utterance');
    err.latencyMs = latencyMs;
    err.raw = parsed.raw || data;
    throw err;
  }

  return {
    utterance: parsed.utterance,
    speech: parsed.utterance,
    adapter: 'gemini',
    model,
    latencyMs,
    raw: data,
    parsed: parsed.raw || parsed,
    usage: data.usageMetadata || null
  };
}

/**
 * Standard interface alias for router compatibility.
 */
export async function generateTurn(ctx, options = {}) {
  return generateGeminiTurn(ctx, options);
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
  const result = await generateGeminiTurn(turnRequest, {
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

export default generateGeminiTurn;
