# Handoff & Continuation Guide — Keybreakers

This guide is written so you (or any coding agent on another account or machine) can pick up `Box/Teaching/math-game/` immediately without losing context.

---

## 1. Current Project Snapshot (2026-11-09)

The active UI direction is one cloud-edged world map with challenge navigation on its landmarks, a fixed boy Keybreaker at the start, and discreet For grown-ups/GitHub links. Name entry, avatar selection and the child-facing Codex route are removed. The Castle of Theorems remains the destination. `docs/NAME-CHECK.md` records the provisional title screen and adjacent naming conflict.

Encounters now share one coherent scene. Reverse Tolls is a tappable forward story road with the public gate rules and castle count; other nodes place story captions on a single keeper picture. Small Rivet and event-driven Grubb sprites replace separate portrait panels. Rivet and Lemma retain paced/instant speech with Read now/Read again, complete-line accessibility announcements and stale callback cancellation. There is no sound button or inscription transcript wall. Golden Seals still name the learned idea, and the engine retains its historical Codex persistence.

The optional calculator, tape and scratchpad accept only the child's inputs and save locally per encounter/part. Cards, new hints and Tiny Cases open the relevant workspace automatically; equivalent views preserve manual closure. Portrait maps put the first playable gate near the top. `client/world-map.js`, `client/encounter-map.js`, `client/calculation-tools.js` and `client/adventure.css` contain the new presentation.

The repeated tutor line was traced to callers always selecting probe index zero. Scripted and fallback selection now rotate within the authorized phase/rung, with non-evaluative follow-ups for explanations. Previous speech helps local selection only and is not added to model input.

The user selected agy as the local live tutor with Gemini 3.8 Flash. `server/tutor/agy.js` uses the installed authenticated CLI, explicit `gemini-3.8-flash-low`, bounded process lifetimes and output, strict JSON parsing, a deny-all tool hook and the normal leak gate/retry/fallback path. The authenticated CLI may inherit global agy rules, plugin metadata or preferences from the real HOME; it is not an exclusive-context transport. The temporary cwd contains no game source or solution files, and the model cannot use tools to fetch them. Temporary workspace cleanup does not erase agy’s normal local conversation history. `npm start`/`npm run dev` load optional `.env` with Node's native preloader. The PIN-protected parent stream exposes configured model and latest reply source; child views do not contain diagnostics.

Verification: `docs/validation/map-tests-final.txt` records the full suite (834 passing tests); `map-shutdown-tests.txt` records two additional process-shutdown regressions added afterward; `map-validate.txt` records content validation with the single existing Dark Vault warning; `map-smoke.txt` records the offline dialogue matrix; `map-eval-ci.txt` records the API-key CI skip; `agy-cli-synthetic-proof.json` records live CLI guard and router checks; `map-http-live.json` records the enabled local HTTP path. The live samples are smoke checks, not a full provider evaluation matrix. `map-content-invariants.txt` checks puzzle answers, givens, mechanics, forbidden lists and all design pillars against baseline `096064c5f9ee8c7039c29e3d9045f33fa2a5f1c6`. The only inscription change is the user-requested boy/he/his wording. Older `keybreakers-*` and `still-speech-*` logs describe earlier milestones and are retained as history.

Browser-origin permission denied the localhost preview earlier, so live browser visual playtesting remains unverified. No alternate browser automation bypass was used. Automated tests cover engine, HTTP, assets, renderers and client-controller behavior. External development-swarm review could not export private project source; live agy transport checks use public synthetic tutoring only.

The reviewed detailed PNG stills and earlier animation brief/endpoints remain under `docs/art/`. The game uses stills, not videos. `tools/assets/prepare_stills.py` checks the reviewed source hashes and preserves approval revocations. Source art and the gallery are committed; rebuildable ZIP exports and superseded drafts remain local and ignored.

---

## 2. Picking Up on Another Account or Machine

### Step 1: Check Node & Python Versions
- **Node.js 20.12+ or 22+** is required (built and verified on Node `v24.17.0`).
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
3. The project has zero npm dependencies. `npm start` uses `server/load-env.js` to load `.env` with Node’s native parser; explicit shell variables take precedence.
   - **Localhost only (`127.0.0.1`):**
     ```bash
     node --import ./server/load-env.js server/index.js
     ```
   - **Home LAN (`0.0.0.0:8080`, reachable from an iPad on the same Wi-Fi):**
     ```bash
     node --import ./server/load-env.js -e "import('./server/index.js').then(m => m.startServer(Number(process.env.PORT)||8080, '0.0.0.0').then(({port}) => console.log('Listening on 0.0.0.0:' + port)))"
     ```
     *(Find your Mac’s LAN IP with `ipconfig getifaddr en0`, then open `http://<mac-ip>:8080` on the iPad and `http://localhost:8080/parent` on your laptop.)*

---

## 3. Switching From Scripted Mode to Live Tutoring

By default, `TUTOR_ADAPTER=scripted` serves authored Socratic probes offline with 0 ms latency. To enable live LLM tutoring:

For the requested local CLI route, set `TUTOR_ADAPTER=agy`, `AGY_MODEL=gemini-3.8-flash-low`, `AGY_EFFORT=low`, and `AGY_TIMEOUT_MS=30000`. The CLI must already be installed and signed in. Restart `npm start`, then check the parent dashboard for the configured model and actual last-reply source. The offline scripted floor remains available.

For direct REST adapters:

1. Set `TUTOR_ADAPTER=gemini` and `GEMINI_API_KEY=<key>` in `.env` (or `TUTOR_ADAPTER=claude` and `ANTHROPIC_API_KEY=<key>`).
2. Run a live evaluation matrix **before** home play to verify latency, fallback rate, and pre-gate leak rate against the real model:
   ```bash
   # Quick CI matrix (4 encounters x 3 adversarial personas x 3 seeds = 36 dialogues)
   node --import ./server/load-env.js eval/run.js --ci --adapter=gemini

   # Full matrix (e.g. 5–20 seeds across all 6 personas)
   node --import ./server/load-env.js eval/run.js --adapter=gemini --seeds=5
   ```
3. Inspect the generated Markdown & JSON reports in `eval/reports/` (`postGateLeakRate` must be `0.0%`; check `fallbackRate <= 10%` and `preGateLeakRate` to see if `server/tutor/prompt.md` needs tuning).

> **Model ID check:** `server/tutor/gemini.js` defaults to `GEMINI_MODEL=gemini-3.8-flash` and `server/tutor/claude.js` defaults to `ANTHROPIC_MODEL=claude-sonnet-4-6-20260320`. You can override either model ID via `.env` (`GEMINI_MODEL=...` or `ANTHROPIC_MODEL=...`) without editing code if provider model IDs advance.

---

## 4. Next Work Streams & How to Execute Them

### A. Pixel Art and Visual Playtest

`npm run assets` regenerates the integer-grid sprites, scene tile swaps, contact sheets and integrity manifest from `tools/assets/generate.py`, then restores the reviewed PNG stills. `tools/assets/style.md` is the current bible; obsolete per-scene vector prompts have been replaced by pixel environment directions. `client/pixel-art.js` and `client/illustrations.js` are the pure artwork markup APIs. `client/story.js` owns presentation metadata and the safe gate-reaction whitelist.

Inspect the world map, encounter story maps, creature Deck and Golden Seal on desktop and iPad after browser permission is granted. Check text wrapping, modal focus, touch targets, reduced motion and dark mode. Runtime assets remain prototype-marked; the manifest records parent visual review pending before commit. The imagegen concept board is outside runtime assets and has its prompt saved alongside it.

Functional repairs included: initial workspace at low rungs; listener disposal on diagram remount; stale/pending network protection; local storage failure handling; Plan chips opening the Deck; Tiny Case statement and earned worked step; chamber-only conjecture shortcuts; final completion before map unlock; and removal of hidden/pre-filled Vault and Castle Keep values. Regressions live in `test/keybreakers-client.test.js` and `test/keybreakers-workspace.test.js`.

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
- **Game title:** *Keybreakers* is provisional because of the adjacent use documented in `docs/NAME-CHECK.md`. The destination remains the Castle of Theorems.
- **LAN Host Convenience Flag:** Consider letting `server/index.js` read `process.env.HOST || '127.0.0.1'` at CLI startup (line 1022) so `HOST=0.0.0.0 PORT=8080 npm start` binds LAN directly without `-e`.
- **Product-Later Seams (SPEC §15):** Multi-child profiles (`profileId` seam already present), TLS + DB session store, COPPA verifiable parental consent & log retention policy, and post-gate TTS voice output.

---

## 5. Housekeeping Notes on Local Untracked Directories

- **`data/sessions/*.jsonl`** (gitignored): Contains telemetry logs generated during local test runs and live play. Safe to clear at any time (`rm -f data/sessions/*.jsonl`) if you want a clean slate before a playtest session with your child.
- **`eval/reports/*`** (gitignored): Contains local evaluation harness `.md` and `.json` reports.
- **`.agents/`** (gitignored): Contains internal multi-agent build logs from the initial v1 Teamwork run. Not used by the application and safe to archive or delete at any time; all architectural knowledge from it has been distilled into `docs/ARCHITECTURE.md`, `AGENTS.md`, `TEST_READY.md`, and this file.
