/**
 * Castle of Theorems v1 (Home Edition)
 * Native Node HTTP & Server-Sent Events (SSE) Server (SPEC §3, §4, §9, §12)
 *
 * Zero runtime npm dependencies.
 * Pure node:http, node:fs, node:path, node:url, node:crypto.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

// Engine & Tutor imports
import { createSession, transition, getClientSafeView, LADDER_RUNGS } from './engine/stateMachine.js';
import { getClientSafeEncounter } from './engine/clientView.js';
import { logEvent, readSessionEvents, ensureSessionsDir } from './engine/telemetry.js';
import { generateTurn, getEncounter, buildAllowedContent, buildLeakGateContext } from './tutor/index.js';
import { appendDialogue, childDialogueText, displayDialogue, modelDialogue, historicalDialogue } from './tutor/dialogue.js';
import { DEFAULT_MODEL as AGY_MODEL, cancelAllAgyCalls } from './tutor/agy.js';
import { DEFAULT_MODEL as GEMINI_MODEL } from './tutor/gemini.js';
import { DEFAULT_MODEL as CLAUDE_MODEL } from './tutor/claude.js';

// Diagnostics belong only on the PIN-protected parent stream.
function tutorConfiguration(adapter) {
  const model = adapter === 'agy' ? process.env.AGY_MODEL || AGY_MODEL
    : adapter === 'gemini' ? process.env.GEMINI_MODEL || GEMINI_MODEL
    : adapter === 'claude' ? process.env.ANTHROPIC_MODEL || CLAUDE_MODEL : null;
  return { adapter, model };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base directories
const ROOT_DIR = path.resolve(__dirname, '..');
const CLIENT_DIR = path.resolve(ROOT_DIR, 'client');
const ENCOUNTERS_DIR = path.resolve(ROOT_DIR, 'content/encounters');
const SESSIONS_DIR = path.resolve(ROOT_DIR, 'data/sessions');

// Ensure sessions directory exists
ensureSessionsDir(SESSIONS_DIR);

// MIME type map for static client asset delivery
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

// Encounter cache & aliases
const encountersCache = new Map();

export function loadAllEncounters() {
  if (encountersCache.size > 0) return encountersCache;
  if (!fs.existsSync(ENCOUNTERS_DIR)) return encountersCache;

  const files = fs.readdirSync(ENCOUNTERS_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const fullPath = path.join(ENCOUNTERS_DIR, file);
      const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      if (raw.id) {
        encountersCache.set(raw.id, raw);
        // Also register shorthand aliases for convenience
        if (raw.node) encountersCache.set(String(raw.node), raw);
        if (raw.node) encountersCache.set(`n${raw.node}`, raw);
        if (raw.id.includes('reverse-tolls')) encountersCache.set('reverse-tolls', raw);
        if (raw.id.includes('dark-vault')) encountersCache.set('dark-vault', raw);
        if (raw.id.includes('five-shields')) encountersCache.set('five-shields', raw);
        if (raw.id.includes('castle-keep')) encountersCache.set('castle-keep', raw);
      }
    } catch (err) {
      console.error(`Error loading encounter file ${file}:`, err);
    }
  }
  return encountersCache;
}

export function getEncounterById(id) {
  loadAllEncounters();
  if (!id) return null;
  const key = String(id).trim();
  if (encountersCache.has(key)) return encountersCache.get(key);
  // Fallback to tutor getEncounter
  return getEncounter(key);
}

// In-Memory Session Store
// Map<sessionId, SessionRecord>
export const sessionStore = new Map();
export const chapterWaiversUsed = new Set();
export const globalParentSubscribers = new Set();

/**
 * Checks whether the Look Back waiver has already been used for a chapter.
 * Inspects both chapterWaiversUsed set and all sessions in sessionStore.
 * @param {number|string} chapter
 * @returns {boolean}
 */
export function isChapterWaiverUsed(chapter) {
  if (chapter === undefined || chapter === null) return false;
  const ch = Number(chapter);
  if (chapterWaiversUsed.has(chapter) || chapterWaiversUsed.has(ch)) return true;
  for (const sRec of sessionStore.values()) {
    const sChapter = Number(sRec.encounter?.chapter ?? 1);
    if (sChapter === ch) {
      if (sRec.session?.chapterWaiverUsed || sRec.session?.parentWaiver) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Resets in-memory session and waiver state for test isolation.
 */
export function resetServerState() {
  sessionStore.clear();
  chapterWaiversUsed.clear();
}

/**
 * Validates Parent PIN using constant-time comparison.
 * Default PIN: '1234' (configurable via process.env.PARENT_PIN).
 */
export function verifyParentPin(providedPin, expectedPin = process.env.PARENT_PIN || '1234') {
  if (providedPin === undefined || providedPin === null) return false;
  const provStr = String(providedPin).trim();
  const expStr = String(expectedPin).trim();
  if (!provStr || !expStr) return false;

  const provBuf = Buffer.from(provStr);
  const expBuf = Buffer.from(expStr);

  if (provBuf.length !== expBuf.length) {
    // Constant-time dummy comparison on length mismatch
    crypto.timingSafeEqual(expBuf, expBuf);
    return false;
  }
  return crypto.timingSafeEqual(provBuf, expBuf);
}

/**
 * Extracts and parses JSON body from incoming HTTP request.
 */
export async function parseJsonBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        const err = new Error('Payload Too Large');
        err.statusCode = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          const err = new Error('JSON payload must be a non-null object');
          err.statusCode = 400;
          return reject(err);
        }
        resolve(parsed);
      } catch (e) {
        if (e.statusCode) return reject(e);
        const err = new Error('Invalid JSON payload');
        err.statusCode = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Sends standard JSON HTTP response.
 */
export function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload, 'utf8'),
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(payload);
}

/**
 * Broadcasts an event to all active SSE subscribers of a session.
 */
export function broadcastToSession(sessionRecord, eventType, payload) {
  if (!sessionRecord) return;
  const dataStr = JSON.stringify({
    type: eventType,
    sessionId: sessionRecord.sessionId,
    timestamp: new Date().toISOString(),
    ...payload
  });

  const message = `event: ${eventType}\ndata: ${dataStr}\n\n`;

  if (sessionRecord.subscribers) {
    for (const clientRes of sessionRecord.subscribers) {
      try {
        clientRes.write(message);
      } catch {
        sessionRecord.subscribers.delete(clientRes);
      }
    }
  }

  // Forward to global parent subscribers not already in session subscribers
  for (const clientRes of globalParentSubscribers) {
    if (sessionRecord.subscribers && sessionRecord.subscribers.has(clientRes)) {
      continue;
    }
    try {
      clientRes.write(message);
    } catch {
      globalParentSubscribers.delete(clientRes);
    }
  }
}

let cachedManifest = null;
let cachedManifestMtime = 0;

function getCachedAssetManifest(manifestPath) {
  const stat = fs.statSync(manifestPath);
  if (!cachedManifest || stat.mtimeMs > cachedManifestMtime) {
    cachedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    cachedManifestMtime = stat.mtimeMs;
  }
  return cachedManifest;
}

/**
 * Safe Static File Server with Directory Traversal Prevention.
 */
export function serveStaticFile(req, res, pathname, clientDir = CLIENT_DIR) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Malformed URL' });
  }

  // Null byte injection protection
  if (decoded.includes('\0')) {
    return sendJson(res, 403, { ok: false, error: 'Forbidden' });
  }

  // Explicit directory traversal check: reject if path contains '..' attempting escape
  const rawJoined = path.join(clientDir, decoded);
  const normalizedRaw = path.normalize(rawJoined);
  if (!normalizedRaw.startsWith(clientDir + path.sep) && normalizedRaw !== clientDir) {
    return sendJson(res, 403, { ok: false, error: 'Directory traversal forbidden' });
  }

  // SPA Route mappings
  let fileRel = decoded;
  if (fileRel === '/' || fileRel === '') {
    fileRel = '/index.html';
  } else if (fileRel === '/parent') {
    const parentFile = path.join(clientDir, 'parent.html');
    fileRel = fs.existsSync(parentFile) ? '/parent.html' : '/index.html';
  } else if (fileRel === '/codex' || fileRel.startsWith('/n/')) {
    fileRel = '/index.html';
  }

  const safePath = path.normalize(path.join(clientDir, fileRel));
  if (!safePath.startsWith(clientDir + path.sep) && safePath !== clientDir) {
    return sendJson(res, 403, { ok: false, error: 'Directory traversal forbidden' });
  }

  if (!fs.existsSync(safePath)) {
    // If route has no file extension and client/index.html exists, fallback to SPA index.html
    const ext = path.extname(safePath);
    if (!ext && fs.existsSync(path.join(clientDir, 'index.html'))) {
      return streamFileToResponse(path.join(clientDir, 'index.html'), res, '.html');
    }
    return sendJson(res, 404, { ok: false, error: 'Not Found' });
  }

  const stat = fs.statSync(safePath);
  if (stat.isDirectory()) {
    const indexChild = path.join(safePath, 'index.html');
    if (fs.existsSync(indexChild)) {
      return streamFileToResponse(indexChild, res, '.html');
    }
    return sendJson(res, 403, { ok: false, error: 'Directory listing forbidden' });
  }

  // Strict Asset Manifest Approval Gate (SPEC §8, §14)
  if (fileRel.startsWith('/assets/')) {
    // Allow the manifest itself to be served
    if (fileRel === '/assets/manifest.json') {
      return streamFileToResponse(safePath, res, '.json');
    }

    const manifestPath = path.join(clientDir, 'assets/manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return sendJson(res, 403, { ok: false, error: 'Asset manifest missing' });
    }

    let manifest;
    try {
      manifest = getCachedAssetManifest(manifestPath);
    } catch {
      return sendJson(res, 403, { ok: false, error: 'Asset validation failed' });
    }

    const rawRel = path.relative(path.join(clientDir, 'assets'), safePath);
    const relAsset = rawRel.split(path.sep).join('/');

    const assetMeta = manifest?.assets?.[relAsset];
    if (!assetMeta) {
      return sendJson(res, 404, { ok: false, error: 'Asset not registered in manifest' });
    }

    if (assetMeta.approved !== true) {
      return sendJson(res, 403, { ok: false, error: 'Asset not approved' });
    }
  }

  const ext = path.extname(safePath).toLowerCase();
  streamFileToResponse(safePath, res, ext);
}

function streamFileToResponse(filePath, res, ext) {
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);
  // HTML and its modules must update together. Reusing a fresh, hour-old app.js
  // with a new DOM can silently leave the homepage empty after a local update.
  const revalidate = ['.html', '.js', '.css', '.json', '.webmanifest'].includes(ext);

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': revalidate ? 'no-cache' : 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*'
  });

  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'Stream error' });
  });
  stream.pipe(res);
}

/**
 * Creates the native Node HTTP server.
 */
export function createServer(options = {}) {
  const clientDir = options.clientDir || CLIENT_DIR;
  const parentPin = options.parentPin || process.env.PARENT_PIN || '1234';

  loadAllEncounters();

  const activeSockets = new Set();
  const activeSseResponses = new Set();

  const server = http.createServer(async (req, res) => {
    // Enable CORS for development
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Parent-PIN, x-parent-pin'
      });
      return res.end();
    }

    let reqUrl;
    try {
      reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Malformed request URL or Host header' }));
    }
    const pathname = reqUrl.pathname;
    const searchParams = reqUrl.searchParams;

    try {
      // =======================================================================
      // 1. POST /api/session/start (and alias /api/session)
      // =======================================================================
      if (req.method === 'POST' && (pathname === '/api/session/start' || pathname === '/api/session')) {
        const body = await parseJsonBody(req);
        const encounterId = body.encounterId || body.id;
        const encounter = getEncounterById(encounterId);

        if (!encounter) {
          return sendJson(res, 404, { ok: false, error: `Encounter not found: "${encounterId}"` });
        }

        const chapter = encounter.chapter ?? 1;
        const waiverUsed = isChapterWaiverUsed(chapter);

        const tutorAdapter = body.tutorAdapter || process.env.TUTOR_ADAPTER || 'scripted';
        const session = createSession(encounter, {
          sessionId: body.sessionId,
          tutorAdapter,
          chapterWaiverUsed: waiverUsed
        });

        const sessionRecord = {
          sessionId: session.sessionId,
          session,
          encounter,
          tutorAdapter,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          subscribers: new Set(),
          queuedHintOverride: null,
          parentScribe: false
        };

        sessionStore.set(session.sessionId, sessionRecord);

        // Broadcast session.start event to globalParentSubscribers and bind them
        const startPayload = JSON.stringify({
          type: 'session.start',
          sessionId: session.sessionId,
          encounterId: encounter.id,
          tutor: tutorConfiguration(tutorAdapter),
          timestamp: new Date().toISOString()
        });
        const startMsg = `event: session.start\ndata: ${startPayload}\n\n`;

        for (const clientRes of globalParentSubscribers) {
          try {
            clientRes.write(startMsg);
            sessionRecord.subscribers.add(clientRes);
          } catch {
            globalParentSubscribers.delete(clientRes);
          }
        }

        // Telemetry logging (defensively wrapped)
        try {
          await logEvent(session.sessionId, 'session.start', {
            encounterId: encounter.id,
            adapter: tutorAdapter
          });
        } catch (telemetryErr) {
          console.warn(`[Telemetry Warning] Failed to log "session.start" for session ${session.sessionId}:`, telemetryErr.message);
        }

        try {
          await logEvent(session.sessionId, 'node.enter', {
            encounterId: encounter.id,
            partId: session.currentPartId,
            sceneState: 'locked'
          });
        } catch (telemetryErr) {
          console.warn(`[Telemetry Warning] Failed to log "node.enter" for session ${session.sessionId}:`, telemetryErr.message);
        }

        const view = getClientSafeView(session, encounter);
        return sendJson(res, 200, {
          ok: true,
          sessionId: session.sessionId,
          encounterId: encounter.id,
          state: session.state,
          view
        });
      }

      // =======================================================================
      // 2. POST /api/session/:id/action (and alias /act)
      // =======================================================================
      const actionMatch = pathname.match(/^\/api\/session\/([^/]+)\/(action|act)$/);
      if (req.method === 'POST' && actionMatch) {
        const sessionId = actionMatch[1];
        const sessionRecord = sessionStore.get(sessionId);

        if (!sessionRecord) {
          return sendJson(res, 404, { ok: false, error: 'Session not found' });
        }

        const body = await parseJsonBody(req);
        const action = body.action || body;

        if (!action || typeof action !== 'object' || !action.type) {
          return sendJson(res, 400, { ok: false, error: 'Action object with type is required' });
        }

        // Defensively normalize wire properties across client and server
        if (action.step && !action.payload) {
          action.payload = action.step;
        }
        if (action.card && !action.cardId) {
          action.cardId = action.card;
        }
        if (action.justification && !action.reason) {
          action.reason = action.justification;
        }
        if (action.type === 'waiver') {
          action.type = 'waive';
        }
        if (action.type === 'lookback' && !action.kind && typeof action.index === 'number' && sessionRecord.encounter?.lookBack?.[action.index]) {
          action.kind = sessionRecord.encounter.lookBack[action.index].kind;
        }

        // Apply queued parent hint override if present
        if (sessionRecord.queuedHintOverride && action.type !== 'parent_override') {
          const overrideVal = sessionRecord.queuedHintOverride;
          sessionRecord.queuedHintOverride = null;
          if (LADDER_RUNGS.includes(overrideVal)) {
            const ovRes = transition(sessionRecord.session, { type: 'parent_override', hintRung: overrideVal }, sessionRecord.encounter);
            sessionRecord.session = ovRes.session;
          }
        }

        // Deterministic transition
        const inputSession = {
          ...sessionRecord.session,
          dialogue: appendDialogue(sessionRecord.session, 'child', childDialogueText(action))
        };
        const { session: nextSession, events } = transition(inputSession, action, sessionRecord.encounter);
        sessionRecord.session = nextSession;
        sessionRecord.updatedAt = Date.now();

        // Log child action (defensively wrapped)
        try {
          await logEvent(sessionId, 'child.action', {
            type: action.type,
            payload: action,
            state: nextSession.state,
            hintRung: nextSession.hintRung
          });
        } catch (telemetryErr) {
          console.warn(`[Telemetry Warning] Failed to log "child.action" for session ${sessionId}:`, telemetryErr.message);
        }

        // Broadcast events to SSE subscribers & log telemetry
        for (const ev of events) {
          try {
            await logEvent(sessionId, ev.type, ev);
          } catch (telemetryErr) {
            console.warn(`[Telemetry Warning] Failed to log event "${ev.type}" for session ${sessionId}:`, telemetryErr.message);
          }
          broadcastToSession(sessionRecord, ev.type, ev);
        }

        // Broadcast general update event for dashboard
        broadcastToSession(sessionRecord, 'update', {
          action,
          state: nextSession.state,
          hintRung: nextSession.hintRung,
          events
        });

        // Generate tutor turn if appropriate
        let speech = null;
        const nonTutorActions = ['parent_override', 'parent_scribe'];
        if (!nextSession.completed && nextSession.state !== 'sealed' && !nonTutorActions.includes(action.type)) {
          try {
            const currentPart = sessionRecord.encounter.parts.find(part => part.id === nextSession.currentPartId);
            const historyGate = buildLeakGateContext(sessionRecord.encounter, currentPart, {
              state: nextSession.state, rung: nextSession.hintRung,
              allowedContent: buildAllowedContent(sessionRecord.encounter, currentPart, nextSession.state, nextSession.hintRung)
            });
            const tutorCtx = {
              encounterId: sessionRecord.encounter.id,
              partId: nextSession.currentPartId,
              state: nextSession.state,
              hintRung: nextSession.hintRung,
              publicHistory: modelDialogue(nextSession, historyGate),
              childMessage: action.text || action.reason || (action.value !== undefined ? String(action.value) : ''),
              childAction: action.type,
              previousSpeech: nextSession.lastTutorUtterance || '',
              chosenCard: nextSession.activeCard,
              reflectionKind: nextSession.activeLookBackKind,
              conversationCue: events.some(event => event.type === 'conversation.reason_requested') ? 'reason'
                : events.some(event => event.type === 'lookback.input_requested') ? 'reflection_format'
                : events.some(event => event.type === 'lookback.retry') ? 'reflection_retry' : undefined,
              sessionId
            };

            const turnRes = await generateTurn(tutorCtx, {
              adapter: sessionRecord.tutorAdapter
            });

            speech = turnRes.utterance || turnRes.speech || null;
            sessionRecord.lastTutorStatus = {
              ...tutorConfiguration(sessionRecord.tutorAdapter),
              source: turnRes.adapter,
              fallback: Boolean(turnRes.fallback),
              latencyMs: turnRes.latencyMs
            };
            if (speech) {
              nextSession.lastTutorUtterance = speech;
              nextSession.dialogue = appendDialogue(nextSession, 'tutor', speech);
              broadcastToSession(sessionRecord, 'tutor.say', {
                speech,
                source: turnRes.adapter,
                tutor: sessionRecord.lastTutorStatus
              });
            }
          } catch (tutorErr) {
            console.error(`Tutor turn generation error for session ${sessionId}:`, tutorErr);
          }
        }

        const view = getClientSafeView(nextSession, sessionRecord.encounter);
        return sendJson(res, 200, {
          ok: true,
          state: nextSession.state,
          view,
          speech,
          finished: Boolean(nextSession.completed || nextSession.state === 'map'),
          status: nextSession.state,
          events
        });
      }

      // =======================================================================
      // Display-only saved dialogue. It never restores or replays game state.
      const dialogueMatch = pathname.match(/^\/api\/session\/([^/]+)\/dialogue$/);
      if (req.method === 'GET' && dialogueMatch) {
        const sessionId = dialogueMatch[1];
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(sessionId)) {
          return sendJson(res, 400, { ok: false, error: 'Invalid session ID' });
        }
        const active = sessionStore.get(sessionId);
        if (active?.session.dialogue?.length) {
          return sendJson(res, 200, { ok: true, encounterId: active.encounter.id, dialogue: displayDialogue(active.session.dialogue) });
        }
        let events;
        try { events = readSessionEvents(sessionId, SESSIONS_DIR); }
        catch { return sendJson(res, 500, { ok: false, error: 'Saved dialogue could not be read' }); }
        const encounterId = active?.encounter.id || events.find(event => event.type === 'session.start')?.encounterId;
        const encounter = getEncounterById(encounterId);
        if (!encounter) return sendJson(res, 404, { ok: false, error: 'Saved dialogue not found' });
        const dialogue = historicalDialogue(events, encounter.id, call => {
          const part = encounter.parts.find(item => item.id === call.partId);
          if (!part || !LADDER_RUNGS.includes(call.rung)
              || !['arrive', 'conjecture', 'understand', 'plan', 'carry_out', 'simpler_problem', 'look_back', 'sealed', 'map'].includes(call.state)) return null;
          return buildLeakGateContext(encounter, part, {
            state: call.state, rung: call.rung,
            allowedContent: buildAllowedContent(encounter, part, call.state, call.rung)
          });
        });
        return sendJson(res, 200, { ok: true, encounterId: encounter.id, dialogue });
      }

      // 3. GET /api/session/:id/state
      // =======================================================================
      const stateMatch = pathname.match(/^\/api\/session\/([^/]+)\/state$/);
      if (req.method === 'GET' && stateMatch) {
        const sessionId = stateMatch[1];
        const sessionRecord = sessionStore.get(sessionId);

        if (!sessionRecord) {
          return sendJson(res, 404, { ok: false, error: 'Session not found' });
        }

        const view = getClientSafeView(sessionRecord.session, sessionRecord.encounter);
        return sendJson(res, 200, {
          ok: true,
          state: sessionRecord.session.state,
          view
        });
      }

      // =======================================================================
      // 4. GET /api/encounters (Catalog with unlock status)
      // =======================================================================
      if (req.method === 'GET' && pathname === '/api/encounters') {
        loadAllEncounters();
        const list = [
          getEncounterById('ch1-n1-reverse-tolls'),
          getEncounterById('ch1-n2-dark-vault'),
          getEncounterById('ch1-n3-five-shields'),
          getEncounterById('ch1-n4-castle-keep')
        ].filter(Boolean);

        const catalog = list.map((enc, idx) => {
          let unlocked = idx === 0;
          let completed = false;

          for (const sRec of sessionStore.values()) {
            if (sRec.encounter.id === enc.id && sRec.session.completed) {
              completed = true;
              break;
            }
          }

          if (idx > 0) {
            const prev = list[idx - 1];
            for (const sRec of sessionStore.values()) {
              if (sRec.encounter.id === prev.id && sRec.session.completed) {
                unlocked = true;
                break;
              }
            }
          }

          return {
            id: enc.id,
            chapter: enc.chapter,
            node: enc.node,
            title: enc.title,
            unlocked,
            completed,
            sceneAsset: completed ? enc.scene.unlocked : enc.scene.locked
          };
        });

        return sendJson(res, 200, { ok: true, encounters: catalog });
      }

      // =======================================================================
      // 5. GET /api/encounter/:id/view (Static client-safe encounter definition)
      // =======================================================================
      const encounterViewMatch = pathname.match(/^\/api\/encounter(?:s)?\/([^/]+)\/view$/);
      if (req.method === 'GET' && encounterViewMatch) {
        const encounter = getEncounterById(encounterViewMatch[1]);
        if (!encounter) {
          return sendJson(res, 404, { ok: false, error: 'Encounter not found' });
        }
        const safeEncounter = getClientSafeEncounter(encounter);
        return sendJson(res, 200, safeEncounter);
      }

      // =======================================================================
      // 6. GET /api/parent/transcript (Server-Sent Events streaming)
      // =======================================================================
      if (req.method === 'GET' && pathname === '/api/parent/transcript') {
        const pin = searchParams.get('pin') || req.headers['x-parent-pin'];
        if (!verifyParentPin(pin, parentPin)) {
          return sendJson(res, 401, { ok: false, error: 'Unauthorized: Invalid parent PIN' });
        }

        let sessionId = searchParams.get('session') || searchParams.get('sessionId');
        let sessionRecord = null;

        // If sessionId is missing, resolve latest active session from sessionStore
        if (!sessionId && sessionStore.size > 0) {
          for (const sRec of sessionStore.values()) {
            if (!sessionRecord || sRec.updatedAt >= sessionRecord.updatedAt) {
              sessionRecord = sRec;
              sessionId = sRec.sessionId;
            }
          }
        } else if (sessionId) {
          sessionRecord = sessionStore.get(sessionId);
        }

        // Establish SSE connection
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });

        res.write(`event: connected\ndata: ${JSON.stringify({
          status: 'connected', sessionId: sessionId || null,
          tutor: sessionRecord?.lastTutorStatus || tutorConfiguration(sessionRecord?.tutorAdapter || process.env.TUTOR_ADAPTER || 'scripted')
        })}\n\n`);
        activeSseResponses.add(res);

        // If no explicit session requested, register with globalParentSubscribers
        if (!searchParams.get('session') && !searchParams.get('sessionId')) {
          globalParentSubscribers.add(res);
        }

        if (sessionRecord) {
          sessionRecord.subscribers.add(res);
          // Replay historical events if available
          try {
            const pastEvents = readSessionEvents(sessionId, SESSIONS_DIR);
            for (const ev of pastEvents) {
              res.write(`event: ${ev.type || 'message'}\ndata: ${JSON.stringify(ev)}\n\n`);
            }
          } catch {}
        }

        // Heartbeat interval (keep-alive every 20 seconds)
        const heartbeatTimer = setInterval(() => {
          try {
            res.write(': heartbeat\n\n');
          } catch {
            clearInterval(heartbeatTimer);
          }
        }, 20000);

        req.on('close', () => {
          clearInterval(heartbeatTimer);
          activeSseResponses.delete(res);
          globalParentSubscribers.delete(res);
          if (sessionRecord) {
            sessionRecord.subscribers.delete(res);
          }
        });

        return;
      }

      // =======================================================================
      // 7. POST /api/parent/hint-override (and alias /override)
      // =======================================================================
      if (req.method === 'POST' && (pathname === '/api/parent/hint-override' || pathname === '/api/parent/override')) {
        const body = await parseJsonBody(req);
        const pin = body.pin || req.headers['x-parent-pin'];

        if (!verifyParentPin(pin, parentPin)) {
          return sendJson(res, 401, { ok: false, error: 'Unauthorized: Invalid parent PIN' });
        }

        const sessionId = body.session || body.sessionId;
        const sessionRecord = sessionStore.get(sessionId);

        if (!sessionRecord) {
          return sendJson(res, 404, { ok: false, error: 'Session not found' });
        }

        const overrideVal = body.rung || body.hintRung || body.text;
        if (!overrideVal) {
          return sendJson(res, 400, { ok: false, error: 'Missing hint override value' });
        }

        if (LADDER_RUNGS.includes(overrideVal)) {
          const transRes = transition(sessionRecord.session, { type: 'parent_override', hintRung: overrideVal }, sessionRecord.encounter);
          sessionRecord.session = transRes.session;
          broadcastToSession(sessionRecord, 'parent.override', { kind: 'rung', value: overrideVal });
          broadcastToSession(sessionRecord, 'hint.override', { rung: overrideVal });
        } else {
          sessionRecord.queuedHintOverride = overrideVal;
          broadcastToSession(sessionRecord, 'parent.override', { kind: 'rung', value: overrideVal });
          broadcastToSession(sessionRecord, 'hint.override', { text: overrideVal });
        }

        await logEvent(sessionId, 'parent.override', { kind: 'rung', value: overrideVal });
        return sendJson(res, 200, {
          ok: true,
          success: true,
          session: sessionId,
          hintRung: sessionRecord.session.hintRung,
          queuedOverride: sessionRecord.queuedHintOverride
        });
      }

      // =======================================================================
      // 8. POST /api/parent/toggle-scribe (and alias /scribe)
      // =======================================================================
      if (req.method === 'POST' && (pathname === '/api/parent/toggle-scribe' || pathname === '/api/parent/scribe')) {
        const body = await parseJsonBody(req);
        const pin = body.pin || req.headers['x-parent-pin'];

        if (!verifyParentPin(pin, parentPin)) {
          return sendJson(res, 401, { ok: false, error: 'Unauthorized: Invalid parent PIN' });
        }

        const sessionId = body.session || body.sessionId;
        const sessionRecord = sessionStore.get(sessionId);

        if (!sessionRecord) {
          return sendJson(res, 404, { ok: false, error: 'Session not found' });
        }

        const enabled = Boolean(body.enabled);
        const transRes = transition(sessionRecord.session, { type: 'parent_scribe', enabled }, sessionRecord.encounter);
        sessionRecord.session = transRes.session;
        sessionRecord.parentScribe = enabled;

        await logEvent(sessionId, 'parent.override', { kind: 'scribe', value: enabled });
        broadcastToSession(sessionRecord, 'parent.override', { kind: 'scribe', value: enabled });

        return sendJson(res, 200, {
          ok: true,
          success: true,
          session: sessionId,
          parentScribe: sessionRecord.parentScribe,
          scribeEnabled: sessionRecord.parentScribe
        });
      }

      // =======================================================================
      // 9. POST /api/parent/waiver
      // =======================================================================
      if (req.method === 'POST' && pathname === '/api/parent/waiver') {
        const body = await parseJsonBody(req);
        const pin = body.pin || req.headers['x-parent-pin'];

        if (!verifyParentPin(pin, parentPin)) {
          return sendJson(res, 401, { ok: false, error: 'Unauthorized: Invalid parent PIN' });
        }

        const sessionId = body.session || body.sessionId;
        const sessionRecord = sessionStore.get(sessionId);

        if (!sessionRecord) {
          return sendJson(res, 404, { ok: false, error: 'Session not found' });
        }

        const chapter = sessionRecord.encounter?.chapter ?? 1;
        if (
          isChapterWaiverUsed(chapter) ||
          sessionRecord.session.chapterWaiverUsed ||
          sessionRecord.session.parentWaiver
        ) {
          return sendJson(res, 400, { ok: false, error: 'Look Back waiver already used this chapter' });
        }

        if (sessionRecord.session.state !== 'look_back') {
          return sendJson(res, 400, { ok: false, error: 'Look Back waiver can only be used during Look Back stage' });
        }

        const transRes = transition(sessionRecord.session, { type: 'waive' }, sessionRecord.encounter);
        sessionRecord.session = transRes.session;
        sessionRecord.updatedAt = Date.now();

        // Mark chapter waiver globally and update all existing sessions in this chapter
        chapterWaiversUsed.add(chapter);
        chapterWaiversUsed.add(Number(chapter));
        for (const sRec of sessionStore.values()) {
          const sChapter = Number(sRec.encounter?.chapter ?? 1);
          if (sChapter === Number(chapter) && sRec.session) {
            sRec.session.chapterWaiverUsed = true;
            sRec.session.parentWaiver = true;
          }
        }

        try {
          await logEvent(sessionId, 'parent.override', {
            kind: 'waive',
            encounterId: sessionRecord.encounter.id
          });
        } catch (telemetryErr) {
          console.warn(`[Telemetry Warning] Failed to log waiver event for session ${sessionId}:`, telemetryErr.message);
        }

        for (const ev of (transRes.events || [])) {
          try {
            await logEvent(sessionId, ev.type, ev);
          } catch (telemetryErr) {
            console.warn(`[Telemetry Warning] Failed to log event "${ev.type}" for session ${sessionId}:`, telemetryErr.message);
          }
          broadcastToSession(sessionRecord, ev.type, ev);
        }

        broadcastToSession(sessionRecord, 'parent.override', { kind: 'waive', value: true });
        broadcastToSession(sessionRecord, 'update', {
          state: sessionRecord.session.state,
          sealed: Boolean(sessionRecord.session.isSealed)
        });

        return sendJson(res, 200, {
          ok: true,
          success: true,
          session: sessionId,
          waived: true,
          state: sessionRecord.session.state,
          sealed: Boolean(sessionRecord.session.isSealed)
        });
      }

      // =======================================================================
      // 10. Static Client Asset Delivery (Fallback for all GET requests)
      // =======================================================================
      if (req.method === 'GET') {
        return serveStaticFile(req, res, pathname, clientDir);
      }

      return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      if (statusCode >= 500) {
        console.error('Unhandled server error:', err);
      }
      return sendJson(res, statusCode, { ok: false, error: err.message || 'Internal Server Error' });
    }
  });

  // Track active sockets for programmatic teardown in tests
  server.on('connection', socket => {
    activeSockets.add(socket);
    socket.on('close', () => activeSockets.delete(socket));
  });

  server._activeSockets = activeSockets;
  server._activeSseResponses = activeSseResponses;

  return server;
}

/**
 * Starts the server asynchronously on a given port.
 * Ephemeral port 0 binds to any free OS port.
 *
 * Supports signatures:
 *   startServer(port, options)
 *   startServer(port, host, options)
 */
export async function startServer(port = (process.env.PORT ? Number(process.env.PORT) : 3000), hostOrOptions = '127.0.0.1', maybeOptions = {}) {
  let host = '127.0.0.1';
  let options = {};

  if (typeof hostOrOptions === 'string') {
    host = hostOrOptions;
    options = maybeOptions || {};
  } else if (typeof hostOrOptions === 'object' && hostOrOptions !== null) {
    options = hostOrOptions;
    host = options.host || '127.0.0.1';
  }

  const server = createServer(options);

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr !== null ? addr.port : port;
      const url = `http://${host}:${actualPort}`;
      resolve({
        server,
        port: actualPort,
        host,
        url,
        close: () => closeServer(server)
      });
    });
  });
}

/**
 * Gracefully stops the server, terminating open sockets and SSE streams.
 */
export async function closeServer(server) {
  if (!server) return;
  cancelAllAgyCalls();

  if (server._activeSseResponses) {
    for (const sseRes of server._activeSseResponses) {
      try { sseRes.end(); } catch {}
      globalParentSubscribers.delete(sseRes);
    }
    server._activeSseResponses.clear();
  }
  globalParentSubscribers.clear();

  if (server._activeSockets) {
    for (const socket of server._activeSockets) {
      socket.destroy();
    }
    server._activeSockets.clear();
  }

  sessionStore.clear();
  chapterWaiversUsed.clear();

  return new Promise((resolve, reject) => {
    server.close(err => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// Auto-run if executed directly as entrypoint: node server/index.js
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  startServer(port).then(({ server, url, port }) => {
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      try { await closeServer(server); } finally { process.exit(0); }
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    console.log(`🏰 Keybreakers server listening at ${url} (port ${port})`);
    console.log(`🦉 Tutor adapter: ${process.env.TUTOR_ADAPTER || 'scripted'}`);
    console.log(`👨‍👩‍👧 Parent dashboard: ${url}/parent (PIN: ${process.env.PARENT_PIN ? 'configured' : 'default 1234'})`);
  }).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
