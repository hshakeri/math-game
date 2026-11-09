/**
 * Castle of Theorems — Telemetry Logging Engine
 * server/engine/telemetry.js
 *
 * Append-only JSONL event logging to data/sessions/{sessionId}.jsonl.
 * Guarantees zero race conditions via per-session serialized FIFO promise queues
 * and atomic synchronous fallback.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_SESSIONS_DIR = path.resolve(__dirname, '../../data/sessions');

// Per-session async FIFO queue map to prevent out-of-order write interleaving
const sessionQueues = new Map();

export const MANDATORY_EVENT_TYPES = new Set([
  'session_start',
  'phase_transition',
  'conjecture_selected',
  'card_activated',
  'probe_delivered',
  'utterance_rejected',
  'mechanic_step',
  'submission_attempt',
  'submission_result',
  'lookback_completed',
  'lookback_waived',
  'sealed',
  // SPEC §12 category aliases
  'session.start',
  'session.end',
  'node.enter',
  'node.sealed',
  'child.action',
  'engine.transition',
  'tutor.call',
  'tutor.say',
  'parent.override',
  'parent.flag',
  'shortcut',
  // State machine transition event types
  'step.success',
  'step.failure',
  'conjecture.skeptic_prompt',
  'conversation.reason_requested',
  'ladder.escalate',
  'child.say',
  'simpler_problem.wrong',
  'lookback.retry',
  'lookback.selected',
  'lookback.input_requested',
  'lookback.verified',
  'hint.override'
]);

/**
 * Ensures the target sessions directory exists.
 * @param {string} dirPath
 */
export function ensureSessionsDir(dirPath = DEFAULT_SESSIONS_DIR) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Resolves the absolute path for a session's JSONL file.
 * @param {string} sessionId
 * @param {string} [dirPath]
 * @returns {string}
 */
export function getSessionLogPath(sessionId, dirPath = DEFAULT_SESSIONS_DIR) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Valid sessionId string is required');
  }
  // Sanitize sessionId against directory traversal
  const cleanId = path.basename(sessionId);
  return path.join(dirPath, `${cleanId}.jsonl`);
}

/**
 * Normalizes an event payload into a standard JSONL line.
 * @param {string} sessionId
 * @param {string} type - One of the required event types
 * @param {object} payload - Additional event fields
 * @returns {object} Formatted event object
 */
export function createEvent(sessionId, type, payload = {}) {
  if (!MANDATORY_EVENT_TYPES.has(type)) {
    throw new Error(`Unknown telemetry event type: "${type}"`);
  }

  return {
    sessionId,
    type,
    timestamp: new Date().toISOString(),
    ...payload
  };
}

/**
 * Appends an event to the session log asynchronously with serialized ordering.
 * @param {string} sessionId
 * @param {string} type
 * @param {object} [payload]
 * @param {string} [dirPath]
 * @returns {Promise<object>} The logged event
 */
export async function logEvent(sessionId, type, payload = {}, dirPath = DEFAULT_SESSIONS_DIR) {
  ensureSessionsDir(dirPath);
  const filePath = getSessionLogPath(sessionId, dirPath);
  const event = createEvent(sessionId, type, payload);
  const line = JSON.stringify(event) + '\n';

  // Queue write sequentially for this session
  const previousPromise = sessionQueues.get(sessionId) || Promise.resolve();
  const writePromise = previousPromise
    .then(() => fs.promises.appendFile(filePath, line, 'utf8'))
    .catch(err => {
      console.error(`Telemetry write error for session ${sessionId}:`, err);
      throw err;
    });

  sessionQueues.set(sessionId, writePromise);
  await writePromise;
  return event;
}

/**
 * Appends an event to the session log synchronously.
 * Atomic under PIPE_BUF on POSIX filesystems.
 * @param {string} sessionId
 * @param {string} type
 * @param {object} [payload]
 * @param {string} [dirPath]
 * @returns {object} The logged event
 */
export function logEventSync(sessionId, type, payload = {}, dirPath = DEFAULT_SESSIONS_DIR) {
  ensureSessionsDir(dirPath);
  const filePath = getSessionLogPath(sessionId, dirPath);
  const event = createEvent(sessionId, type, payload);
  const line = JSON.stringify(event) + '\n';
  fs.appendFileSync(filePath, line, 'utf8');
  return event;
}

/**
 * Flushes any pending async writes for a given session.
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
export async function flushSession(sessionId) {
  const queue = sessionQueues.get(sessionId);
  if (queue) {
    await queue;
  }
}

/**
 * Reads all parsed events for a session.
 * @param {string} sessionId
 * @param {string} [dirPath]
 * @returns {Array<object>}
 */
export function readSessionEvents(sessionId, dirPath = DEFAULT_SESSIONS_DIR) {
  const filePath = getSessionLogPath(sessionId, dirPath);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.trim()) return [];
  return content
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line));
}

/**
 * Clears or deletes a session log (useful in testing).
 * @param {string} sessionId
 * @param {string} [dirPath]
 */
export function clearSessionLog(sessionId, dirPath = DEFAULT_SESSIONS_DIR) {
  const filePath = getSessionLogPath(sessionId, dirPath);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  sessionQueues.delete(sessionId);
}
