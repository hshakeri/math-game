/**
 * Castle of Theorems v1 (Home Edition)
 * Synchronous Scripted Adapter (Default for M1, Playable Offline)
 * server/tutor/scripted.js
 */

import { getScriptedProbe } from '../engine/scripted.js';

/**
 * Adapter call wrapper compatible with the router's callAdapter interface.
 *
 * @param {object} turnRequest - Whitelisted request payload
 * @returns {Promise<{ raw: string, parsed: object }>}
 */
export async function callAdapter(turnRequest) {
  const { encounterId, partId = 'a', state = 'understand', rung = 'l0' } = turnRequest;
  const probe = getScriptedProbe(encounterId, partId, state, rung);
  const parsed = {
    speech: probe,
    utterance: probe,
    usedPoolIndex: 0,
    studentSignal: 'engaged',
    suggestCard: null
  };
  return {
    raw: JSON.stringify(parsed),
    parsed
  };
}

/**
 * Direct generateTurn implementation for scripted mode.
 *
 * @param {object} ctx
 * @returns {Promise<{ utterance: string, speech: string, adapter: string, latencyMs: number, retries: number, fallback: boolean, parsed: object }>}
 */
export async function generateTurn(ctx) {
  const { encounterId, partId = 'a', state = 'understand', rung = 'l0' } = ctx;
  const probe = getScriptedProbe(encounterId, partId, state, rung);
  return {
    utterance: probe,
    speech: probe,
    adapter: 'scripted',
    latencyMs: 0,
    retries: 0,
    fallback: false,
    parsed: {
      speech: probe,
      utterance: probe,
      usedPoolIndex: 0,
      studentSignal: 'engaged',
      suggestCard: null
    }
  };
}

export default { callAdapter, generateTurn };
