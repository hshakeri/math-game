# AGENTS.md — Standing Instructions & Invariants

Read this file first whenever resuming work on **Castle of Theorems** from any account, machine, or coding agent (Claude Code, Codex, or Antigravity).

---

## 1. Authoritative Hierarchy

1. **[SPEC.md](SPEC.md)** in the repository root is authoritative on pedagogy, mathematical content, state transitions, leak-gate rules, UX rules, and design pillars (§2).
2. Where `SPEC.md` and an LLM provider’s current HTTP REST documentation disagree on **API wire details**, the provider’s live documentation wins (record the reference URL and fetch date at the top of `server/tutor/gemini.js` and `server/tutor/claude.js`). Where they disagree on **game or tutor behavior**, `SPEC.md` wins.
3. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** documents the exact as-built module layout, exported signatures, HTTP/SSE routes, and subtle implementation details in v1.
4. **[docs/HANDOFF.md](docs/HANDOFF.md)** tracks current status, operational nuances, and continuation steps.

---

## 2. Non-Negotiable Engineering Guardrails

1. **Zero NPM Dependencies:** Keep `"dependencies": {}` and `"devDependencies": {}` in `package.json`.
   - Server uses Node 20+ built-ins (`node:http`, `node:fs`, `node:path`, `node:crypto`, `node:test`, global `fetch`, `AbortSignal.timeout`).
   - Tutor adapters call Gemini and Anthropic HTTP REST endpoints directly—never install provider SDKs.
   - Client (`client/`) uses vanilla ES modules, HTML5, and CSS custom properties with no build step, bundler, or framework.
   - Diagram modules (`client/diagrams/*.js`) must import cleanly in Node (never touch `document` or `window` at module top level) so server tests and validators can render them.
2. **Strict Socratic Information Diet (Pillar 3 & 4):**
   - Never pass an answer, an intermediate value, a forbidden list, or a correctness signal for a tentative idea to any tutor model—in production **or** in tests (`assertInformationDiet` in `server/tutor/` enforces this).
   - Every correctness check runs deterministically inside `server/engine/`.
3. **8-Stage Synchronous Leak Gate (`server/engine/leakGate.js`):**
   - Every candidate tutor utterance must pass `checkUtterance` (`< 5 ms` synchronous budget) before reaching the client.
   - Never add bypass flags (`bypassGate`, `isTestEnv`, etc.). On gate failure: 1 corrective retry, then deterministic fallback to `server/engine/scripted.js`.
4. **Scripted Mode Is the Floor (Pillar 5):**
   - Every encounter and part must remain 100% playable end-to-end with `TUTOR_ADAPTER=scripted` and zero network access at every commit.
5. **Permanent UX Exclusions (Pillar 1, 7, 9):**
   - Never add countdowns, timers, points, scores, streaks, or leaderboards—not even for debugging. Put diagnostic state on `/parent`.
   - Never add praise/evaluation words (`great`, `correct`, `awesome`, `almost`, `not quite`, etc.) to probes or UI copy.
   - Never add typewriter pips, background music, or sound effects; the **only** audio permitted in v1 is the optional single Web Audio harmonic chime when earning a Golden Seal.
6. **Client-Safe View Strictness:**
   - `/api/encounter/:id/view`, `/api/session/start`, `/api/session/:id/state`, and `/api/session/:id/action` must pass through `server/engine/clientView.js` so solution trees, answers, intermediates, misconception tables, and higher-rung hints are stripped server-side.
   - SVG diagrams in `hint` mode (rung `l2`) must never leak unproduced intermediate or target values.
   - Static `/assets/*` requests must pass the `client/assets/manifest.json` check (`approved: true`), returning HTTP `403` otherwise.
7. **Content & Git Hygiene:**
   - Ask Heman before changing any inscription, target answer, forbidden list, or design pillar. Probe wording may be tuned freely provided `npm run validate` and `npm test` pass.
   - Commit under `Heman Shakeri <hshakeri@users.noreply.github.com>` with **zero AI attribution** (`Co-authored-by`, "Generated with...", etc.) in commit messages, PR descriptions, or release notes.

---

## 3. Standard Verification Commands

> **Shell PATH note on macOS:** Non-login shells may not load `nvm`. Ensure Node 20+ (e.g. `~/.nvm/versions/node/v24.17.0/bin` or `/opt/homebrew/bin`) is on `PATH`.

```bash
# 1. Validate all encounter JSON schemas, probe rules, forbidden collisions, and mechanics replays
npm run validate

# 2. Run the full automated test suite (734 tests across 206 suites, ~3.7s)
npm test

# 3. Run the 6-persona simulated student evaluation smoke matrix (offline scripted mode)
node eval/run.js --smoke

# 4. Verify CI evaluation contract (exits 0 cleanly with skip message when API keys are absent)
npm run eval:ci

# 5. Regenerate procedural SVG scene & avatar placeholders + SHA-256 manifest
npm run assets
```
