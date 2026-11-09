# Handoff & Continuation Guide — Castle of Theorems

This guide is written so you (or any coding agent on another account or machine) can pick up `Box/Teaching/math-game/` immediately without losing context.

---

## 1. Current Project Snapshot (Nov 2026)

- **Build Status:** **v1 (Home Edition) Complete** across Milestones M0 → M5; certified `VICTORY CONFIRMED` by independent clean-room audit.
- **Automated Verification:**
  - `npm run validate` → **PASS** (4 encounter files, 0 errors, 1 expected Dark Vault `c/12` given/forbidden collision warning).
  - `npm test` → **734 / 734 tests passing** across 206 suites (~3.7s, zero skips, zero todos).
  - `node eval/run.js --smoke` → **PASS** (24 simulated dialogues across 6 personas: `0.0%` post-gate leaks, `0.0%` praise, `100.0%` length compliance, `100.0%` solve rate, `0.0%` fallback).
  - `npm run eval:ci` → **PASS** (exits `0` cleanly when API keys are absent).
- **Dependencies:** Zero runtime or dev npm packages (`package.json` has `"dependencies": {}` and `"devDependencies": {}`).

---

## 2. Picking Up on Another Account or Machine

### Step 1: Check Node & Python Versions
- **Node.js 20+** is required (built and verified on Node `v24.17.0`).
  - *Tip for non-login shells / agent sandboxes on macOS:* If `node` is managed by `nvm`, prepend `~/.nvm/versions/node/<version>/bin` to `PATH`.
- **Python 3.10+** (stdlib only, zero `pip` packages) is used only when regenerating procedural SVG assets (`npm run assets`).

### Step 2: Run Health Checks First
Before making any changes, confirm the baseline is green:
```bash
npm run validate
npm test
```
*(Note: `test/challenger-m5-security.test.js` test `5.2` includes a strict `< 40 ns` constant-time PIN microbenchmark that can occasionally jitter under heavy parallel CPU/CloudStorage sync; re-running `node --test test/challenger-m5-security.test.js` or `node --test --test-concurrency=4` isolates it cleanly.)*

### Step 3: Configure `.env` & Run Over Home Wi-Fi (Laptop + iPad)
1. Copy `.env.example` to `.env` (`.env` is gitignored):
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` to set `PARENT_PIN` (default `1234`), `PORT=8080`, and optionally `TUTOR_ADAPTER=gemini` + `GEMINI_API_KEY=...` (or `TUTOR_ADAPTER=claude` + `ANTHROPIC_API_KEY=...`).
3. Because the project has zero npm dependencies (no `dotenv` package), pass Node’s native `--env-file-if-exists=.env` flag.
   - **Localhost only (`127.0.0.1`):**
     ```bash
     node --env-file-if-exists=.env server/index.js
     ```
   - **Home LAN (`0.0.0.0:8080`, reachable from an iPad on the same Wi-Fi):**
     ```bash
     node --env-file-if-exists=.env -e "import('./server/index.js').then(m => m.startServer(Number(process.env.PORT)||8080, '0.0.0.0').then(({port}) => console.log('Listening on 0.0.0.0:' + port)))"
     ```
     *(Find your Mac’s LAN IP with `ipconfig getifaddr en0`, then open `http://<mac-ip>:8080` on the iPad and `http://localhost:8080/parent` on your laptop.)*

---

## 3. Switching From Scripted Mode to Live Gemini / Claude Tutoring

By default, `TUTOR_ADAPTER=scripted` serves authored Socratic probes offline with 0 ms latency. To enable live LLM tutoring:

1. Set `TUTOR_ADAPTER=gemini` and `GEMINI_API_KEY=<key>` in `.env` (or `TUTOR_ADAPTER=claude` and `ANTHROPIC_API_KEY=<key>`).
2. Run a live evaluation matrix **before** home play to verify latency, fallback rate, and pre-gate leak rate against the real model:
   ```bash
   # Quick CI matrix (4 encounters x 3 adversarial personas x 3 seeds = 36 dialogues)
   node --env-file-if-exists=.env eval/run.js --ci --adapter=gemini

   # Full matrix (e.g. 5–20 seeds across all 6 personas)
   node --env-file-if-exists=.env eval/run.js --adapter=gemini --seeds=5
   ```
3. Inspect the generated Markdown & JSON reports in `eval/reports/` (`postGateLeakRate` must be `0.0%`; check `fallbackRate <= 10%` and `preGateLeakRate` to see if `server/tutor/prompt.md` needs tuning).

> **Model ID check:** `server/tutor/gemini.js` defaults to `GEMINI_MODEL=gemini-3.8-flash` and `server/tutor/claude.js` defaults to `ANTHROPIC_MODEL=claude-sonnet-4-6-20260320`. You can override either model ID via `.env` (`GEMINI_MODEL=...` or `ANTHROPIC_MODEL=...`) without editing code if provider model IDs advance.

---

## 4. Next Work Streams & How to Execute Them

### A. Replacing Procedural SVG Scenes With Final Pre-Rendered Art (SPEC §8, M5)
Currently, `client/assets/scenes/*.svg` and `client/assets/avatars/*.svg` are crisp procedural Royal Architect’s Guild vector placeholders (`placeholder: true, approved: true`). To replace them with image-model renders:
1. Review art direction in `tools/assets/style.md` and per-scene prompt specs in `tools/assets/prompts/*.md`.
2. Generate character reference sheets first (Archimedes + Hero front/back/left/right on white background) and approve one reference image before batching the 10 Chapter 1 scene states (`locked`/`unlocked` per node, `map-ch1`, `chapter1-card`).
3. Save outputs under `client/assets/scenes/` (and `avatars/`), compute SHA-256 hashes, and update `client/assets/manifest.json` with `approved: false` until parent review passes:
   - Hero and owl match sheets
   - Zero rendered text inside images
   - Nothing frightening
   - Nothing that acts as a puzzle hint
   - Plausible hands/anatomy
4. Set `approved: true` (and `placeholder: false`) in `client/assets/manifest.json`, update scene extensions in `client/app.js` if switching `.svg` → `.webp`, and run `npm test` (`test/assets.test.js` verifies manifest integrity and HTTP 403 blocking of unapproved assets).

### B. Implementing the Optional Weekly Digest & Eval Rubric Judge
Two small convenience scripts mentioned in `SPEC.md` were deferred during v1 core hardening:
1. **`server/telemetry/digest.js` (`npm run digest` in `package.json`):**
   - Read `data/sessions/*.jsonl` from the past 7 days and output a Markdown summary of nodes sealed, median child turns, rung histogram, shortcut rate, and the 10 most recent `tutor.call` candidates rejected by `leakGate.js`.
2. **`eval/judge.js` & `eval/golden/`:**
   - Optional 10% dialogue rubric scorer (scoring question quality, fit to child’s words, neutrality, grade-3/4 reading level 1–5) and golden replay transcripts.

### C. Authoring Chapter 2 Encounters
To add a new chapter or encounter cleanly:
1. **Design the math & check collisions first:** Verify `givens` and `forbidden` (answer + all intermediates) do not collide; if they collide, renumber the problem rather than weakening `leakGate.js`. Remember any number in `forbidden` also bans its English word/ordinal form (`two`, `second`, `a dozen`, etc.) in `l2.text` and `l3.text`!
2. **Create the pure mechanic** in `server/engine/mechanics/<kind>.js` exporting `{ init, checkStep, isComplete, finalValue }`, and register `<kind>` in `MECHANICS` inside `server/engine/stateMachine.js` and `content/schema.json` + `content/validate.js`.
3. **Create the dual-mode SVG diagram** in `client/diagrams/<kind>.js` exporting `{ render, mount }` (`hint` mode with zero unproduced numbers; `workspace` mode with `>= 44 px` handles and no hardcoded answer shortcuts) and register it in `client/diagrams/index.js` (`tape-model` and `place-value` are planned in SPEC §8/§15 for Chapter 2).
4. **Author `content/encounters/<slug>.json`** and authored fallback probes in `server/engine/scripted.js`, then run `npm run validate`.
5. **Add 60 leak-gate fixture utterances** (30 leaks, 30 clean) for the new encounter in `test/leakGate.test.js` and add persona policy data in `eval/personas/index.js`.
6. **Register the encounter in `/api/encounters`** (`server/index.js`) and run `npm test` + `node eval/run.js --smoke`.

### D. Open Decisions Before Public / Multi-Family Productization (SPEC §15)
- **Game & Hero Final Title:** Working title is *Castle of Theorems*.
- **LAN Host Convenience Flag:** Consider letting `server/index.js` read `process.env.HOST || '127.0.0.1'` at CLI startup (line 1022) so `HOST=0.0.0.0 PORT=8080 npm start` binds LAN directly without `-e`.
- **Product-Later Seams (SPEC §15):** Multi-child profiles (`profileId` seam already present), TLS + DB session store, COPPA verifiable parental consent & log retention policy, and post-gate TTS voice output.

---

## 5. Housekeeping Notes on Local Untracked Directories

- **`data/sessions/*.jsonl`** (gitignored): Contains telemetry logs generated during local test runs and live play. Safe to clear at any time (`rm -f data/sessions/*.jsonl`) if you want a clean slate before a playtest session with your child.
- **`eval/reports/*`** (gitignored): Contains local evaluation harness `.md` and `.json` reports.
- **`.agents/`** (gitignored): Contains internal multi-agent build logs from the initial v1 Teamwork run. Not used by the application and safe to archive or delete at any time; all architectural knowledge from it has been distilled into `docs/ARCHITECTURE.md`, `AGENTS.md`, `TEST_READY.md`, and this file.
