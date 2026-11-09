# Architecture & Codebase Reference — Keybreakers

This document maps **every folder, file, module contract, HTTP/SSE endpoint, diagram component, and test suite** in `Box/Teaching/math-game/`, including exact differences between the initial `SPEC.md` layout sketch and the verified v1 codebase.

---

## Presentation revision (2026-11-09)

`client/story.js` owns provisional branding, keeper metadata, HTML escaping and the pure engine-event reaction whitelist. `client/pixel-art.js` emits manifest-gated sprite markup without DOM globals. The client uses native buttons, modal focus containment, reduced motion, guarded device storage, in-flight action exclusion and stale-response checks. Diagram mounts are replaced before reattaching listeners. Seal Continue sends `complete` before refreshing the road catalog.

`server/engine/clientView.js` now constructs an initial workspace diagram from public mechanic givens at low hint rungs, and reveals the tiny statement whenever the engine enters `simpler_problem`. Vault and Castle Keep number controls begin unanswered. Successful nonfinal conjectures seal their chamber; only final-part completion can expose the Codex/unlocked node. All content still passes the same sanitizer and leak gate.

`client/world-map.js` renders catalog-driven links directly on a continuous cloud-edged map. Explicit `unlocked`/`completed` flags govern navigation; the boy sprite is fixed and starts at the beginning. There is no name/choice onboarding or child-facing Codex route. `client/encounter-map.js` turns the public inscription into selectable story captions; Reverse Tolls uses only an explicit `story` projection of `{kind, gates: [{mul, sub}], end}` from `clientView.js`. Static and session views never copy internal solution fields into this projection.

`client/calculation-tools.js` supplies arithmetic, a calculation tape and scratchpad independently of the game engine. It uses child-entered operands, no `eval`, no auto-filled solutions, and local storage scoped by session/encounter/part. The controller mounts it once, so normal tutor replies do not destroy working. A newly selected card, revealed hint or Tiny Case opens both ancestor tool drawers; repeated state views respect manual closure.

Conversation repair: `server/engine/conversationAnswer.js` parses explicit integer claims without doing arithmetic. The engine keeps pending claims server-side, requests a neutral explanation before checking bare chat claims, and routes justified claims through the existing deterministic progression and Look Back. The router handles the input-completeness cue locally. It also withholds the Tiny Case worked step until the engine has earned it.

`server/tutor/dialogue.js` owns the bounded dialogue ledger and two distinct projections: child-visible delivered words, and current-part/current-rung model memory whose prior tutor lines are re-gated. `buildLeakGateContext` is shared with normal output screening. Session views include `dialogue: [{who,text}]`. `GET /api/session/:id/dialogue` can project archived telemetry for inspection but is never called by the game client. Only an initial page route can resume the same tab's live session; navigation from the map always creates a new one. Expired sessions start fresh. There is no device-local dialogue prefix or cross-session merge.

Look Back owns `activeLookBackKind` (verify by default). `lookback_select` changes that task; `lookback` and `say` submit to its deterministic checker. `parseReflectionReply` accepts a stated integer or an exact authored choice/index, never evaluates an equation, and does not treat an x declaration as a final-check result. Safe options include `kind`, `prompt`, `responseType` and choice labels, never the check value or correct index. Local gated guidance distinguishes entry, input-format requests and retries. `sealed` skips new tutor generation, and the client never replays its previous question. The UI renders one task and matches its control to its response type.

Original module inventory follows; current test evidence is in `docs/validation/`.

## 1. Complete Directory & File Map

```text
math-game/
├── README.md                              # Parent quick-start (3 commands) & documentation index
├── SPEC.md                                # Authoritative Build Spec v1 (Home Edition) by Heman Shakeri
├── AGENTS.md                              # Standing guardrails, invariants & commands for coding agents
├── TEST_READY.md                          # 46-feature matrix & 5-tier verification suite manifest
├── package.json                           # Zero-dependency ESM package definition & npm scripts
├── .env.example                           # Commented template for .env configuration
├── .gitignore                             # Ignores .env, data/sessions/*, eval/reports/*, .agents/
│
├── docs/
│   ├── ARCHITECTURE.md                    # This file: complete file & interface reference
│   └── HANDOFF.md                         # Continuation guide, operational nuances & Chapter 2+ playbook
│
├── content/                               # Authoritative problem data & boot/CI validator
│   ├── schema.json                        # JSON Schema (Draft-07) for Encounter, Part, Ladder, Mechanic
│   ├── validate.js                        # Schema, probe length/shape, digit/forbidden, lexicon & replay checks
│   └── encounters/
│       ├── chasm-reverse-tolls.json       # Node 1 (id: ch1-n1-reverse-tolls) — Inverse operations
│       ├── alchemists-dark-vault.json     # Node 2 (id: ch1-n2-dark-vault, parts a/b/c) — Pigeonhole principle
│       ├── courtyard-five-shields.json    # Node 3 (id: ch1-n3-five-shields) — Shared edges cancel
│       └── castle-keep-portcullis.json    # Node 4 (id: ch1-n4-castle-keep) — Unique prime factorisation
│
├── server/                                # Node.js 20+ backend (zero external npm packages)
│   ├── index.js                           # Native HTTP server, REST API routes, SSE stream & static/asset gate
│   ├── engine/                            # Pure deterministic game logic & safety filters
│   │   ├── stateMachine.js                # 19-transition Pólya state machine, ZPD ladder & immutable state
│   │   ├── leakGate.js                    # Synchronous 8-stage utterance filter (<0.02ms typical, <5ms SLA)
│   │   ├── leakGate.rules.json            # Answer-construction regex patterns & praise lexicon list
│   │   ├── clientView.js                  # Server-side sanitizer stripping answers, trees & unearned hints
│   │   ├── scripted.js                    # Authored offline Socratic probe pools for every (part, state, rung)
│   │   ├── telemetry.js                   # Serialized FIFO async + atomic sync JSONL session event logger
│   │   └── mechanics/                     # Pure Stage-3 mathematical mechanics (`init`, `checkStep`, `isComplete`, `finalValue`)
│   │       ├── inverse-chain.js           # Node 1: backward gate undo order + intermediate coin values
│   │       ├── goblin-bins.js             # Node 2: maximal adversarial crystal placement + worstCase+1 check
│   │       ├── seam-grid.js               # Node 3: 3*short = 2*long unit choice, outer units, cubits/unit, shield walk
│   │       └── factor-dials.js            # Node 4: prime factor leaves for 34 & 85, guardian assignment, sum
│   └── tutor/                             # Pluggable LLM tutor router & direct HTTP REST adapters
│       ├── index.js                       # Visibility-matrix context builder, leak-gate retry loop & fallback
│       ├── prompt.md                      # Rivet the clockwork owl system prompt (SPEC §6)
│       ├── schema.json                    # Structured JSON output schema for tutor turns
│       ├── gemini.js                      # Direct REST adapter for Gemini 3.8 Flash (`thinkingLevel: low`, 4s timeout)
│       ├── claude.js                      # Direct REST adapter for Claude Sonnet 4.6 (tool-use schema, 4s timeout)
│       └── scripted.js                    # Zero-network adapter wrapping `server/engine/scripted.js`
│
├── client/                                # Zero-dependency vanilla ES6 PWA client
│   ├── index.html                         # Map/Encounter child shell with Deck and Seal overlays
│   ├── app.js                             # Client router, state sync, ~40 char/s owl bubble, chips, Look Back & chime
│   ├── style.css                          # Parchment (light) & Blueprint (dark) CSS variables, >=56px touch targets, dyslexia font
│   ├── parent.html                        # PIN-gated Parent Dashboard shell (`/parent`)
│   ├── parent.js                          # Live SSE transcript consumer, rung override, Scribe Mode & Look Back waiver
│   ├── manifest.webmanifest               # Installable iPad/desktop PWA manifest
│   ├── sw.js                              # Offline shell Service Worker
│   ├── diagrams/                          # Isomorphic pure SVG renderers (`hint` static + `workspace` interactive)
│   │   ├── index.js                       # Component registry (`renderDiagram`, `mountDiagram`)
│   │   ├── common.js                      # Shared SVG escaping, styling & touch-handle helpers
│   │   ├── reverse-tolls.js               # Implementation for `inverse-chain`
│   │   ├── dark-vault.js                  # Implementation for `pigeonhole-bins` / `goblin-bins`
│   │   ├── five-shields.js                # Implementation for `seam-grid`
│   │   ├── castle-keep.js                 # Implementation for `factor-tree` / `factor-dials`
│   │   ├── inverse-chain.js               # Re-export alias -> `reverse-tolls.js` (SPEC §8 canonical name)
│   │   ├── pigeonhole-bins.js             # Re-export alias -> `dark-vault.js` (SPEC §8 canonical name)
│   │   ├── seam-grid.js                   # Re-export alias -> `five-shields.js` (SPEC §8 canonical name)
│   │   └── factor-tree.js                 # Re-export alias -> `castle-keep.js` (SPEC §8 canonical name)
│   └── assets/                            # Static art gated by `manifest.json` (`approved: true` required)
│       ├── manifest.json                  # SHA-256 checksums, dimensions, review checklists & approval flags
│       ├── scenes/                        # 10 Chapter 1 SVGs (`ch1-n{1..4}-{locked,unlocked}.svg`, `map-ch1.svg`, `chapter1-card.svg`)
│       └── avatars/                       # `archimedes-sheet.svg`, `hero-sheet.svg`, `hero-{1..6}.svg`
│
├── eval/                                  # Simulated student evaluation harness (SPEC §11)
│   ├── run.js                             # CLI runner (`--smoke`, `--ci`, `--adapter`, `--persona`, `--encounter`, `--seeds`)
│   ├── metrics.js                         # Pure metric aggregators (leak, praise, length drift, cave, solve, fallback, p50/p95)
│   ├── personas/                          # 6 simulated student policies & prompts
│   │   ├── index.js                       # Deterministic child-action policy dispatcher per persona
│   │   ├── impulsive.md                   # Guesses immediately without reading
│   │   ├── extractor.md                   # Social-engineers tutor for direct answers / binary choices
│   │   ├── caver.md                       # Proposes right idea tentatively, abandons if non-neutrally questioned
│   │   ├── silent.md                      # One-word / chip-only replies & stuck escalations
│   │   ├── misconception.md               # Holds authored misconception for 3 turns
│   │   └── prodigy.md                     # Solves on arrival conjecture with >=3-word reason + Look Back
│   └── reports/                           # Generated `.json` and `.md` evaluation reports (gitignored except `.gitkeep`)
│
├── tools/
│   └── assets/                            # Offline scene & character generation pipeline (SPEC §8)
│       ├── generate.py                    # Pure Python 3 stdlib procedural SVG & SHA-256 manifest generator
│       ├── style.md                       # Royal Architect's Guild art direction & 6-color hex palette
│       └── prompts/                       # Reproducible scene/avatar prompt specs (`map-ch1.md`, `ch1-n1.md`..`n4.md`, `avatars.md`, `chapter1-card.md`)
│
├── test/                                  # 28 Node `node:test` suites (734 tests across 206 suites)
│   ├── e2e-tiers.test.js                  # Master consolidated runner for Tiers 1–4
│   ├── e2e-tier1-features.test.js         # Isolated tests for all 46 system features
│   ├── e2e-tier2-boundaries.test.js       # Boundary, cutoff, word-number & state-cap tests
│   ├── e2e-tier3-combinations.test.js     # 10 cross-feature subsystem interaction tests
│   ├── e2e-tier4-scenarios.test.js        # 4 full multi-turn playthrough journeys
│   ├── tier5-adversarial.test.js          # 10 adversarial exploit vectors (NFKC, zero-width, XSS, Host header)
│   └── ...                                # Unit, stress & challenger suites (see §9 below)
│
├── data/
│   └── sessions/                          # Runtime append-only `{sessionId}.jsonl` logs (gitignored except `.gitkeep`)
│
└── .agents/                               # Local multi-agent build/audit transcripts (gitignored; not required at runtime)
```

---

## 2. Content Model & Validator (`content/`)

Each encounter in `content/encounters/*.json` contains both public narrative/prompts and server-only grading trees:

| File | Encounter ID | Parts & Answers | Intermediates | Forbidden List | Mechanic |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `chasm-reverse-tolls.json` | `ch1-n1-reverse-tolls` | `main`: `6` | `11, 7, 6` | `[6, 7, 11, 12, 14, 22]` | `inverse-chain` |
| `alchemists-dark-vault.json` | `ch1-n2-dark-vault` | `a`: `4`, `b`: `10`, `c`: `13` | `a`: `3`; `b`: `9`; `c`: `12` | `a`: `[3,4]`, `b`: `[3,9,10]`, `c`: `[12,13]` | `goblin-bins` |
| `courtyard-five-shields.json` | `ch1-n3-five-shields` | `main`: `30` | `22, 3, 10` | `[10, 22, 30]` | `seam-grid` |
| `castle-keep-portcullis.json` | `ch1-n4-castle-keep` | `main`: `24` | `17, 2, 5` | `[2, 5, 17, 24]` | `factor-dials` |

### `content/validate.js` Rules
Run via `npm run validate` (and imported by tests):
- **Errors (exit non-zero):**
  - JSON Schema violations against `content/schema.json`.
  - Narrative, probe, or hint strings outside `40–300` characters.
  - Any probe without **exactly one** question mark (`?`) at the end.
  - Any string hitting the praise/evaluation lexicon (`great`, `correct`, `awesome`, `almost`, `not quite`, etc.).
  - Any digit in `ladder.l0` or `ladder.l1` strings.
  - Any token in `ladder.l2.text` or `ladder.l3.text` numerically equal to a `forbidden` value (including expanded English word/ordinal forms up to 100 and `"a dozen"`). Note: in Node 4 (`castle-keep-portcullis.json`), `2` is forbidden, so rung texts say `"a pair of primes"` rather than `"two primes"`.
  - Missing `'any-wrong'` catch-all at the end of `misconceptions`, fewer than 2 `lookBack` options or fewer than 2 distinct kinds, or mechanics self-test replay failure.
- **Warnings (exit 0):**
  - Given/forbidden number collision (specifically Dark Vault part `c` where `12` is both a given in the inscription and an intermediate/forbidden value).
  - Flesch–Kincaid Grade Level > 4.0 (enabled with `--reading-level` or `CHECK_FKGL=1`).

---

## 3. Deterministic Engine (`server/engine/`)

### 3.1 State Machine (`stateMachine.js`)
Pure functional signature:
- `createSession(encounter, options) -> SessionState` (deep-frozen in strict checks; no I/O)
- `transition(session, action, encounter) -> { session: SessionState, events: Event[] }`
- `getClientSafeView(session, encounter) -> SafeView`

**State lifecycle per part:**
`arrive` → `conjecture` → `understand` → `plan` → `carry_out` (with `simpler_problem` sub-loop when rung reaches `l4`) → `look_back` → `sealed` → (`arrive` for next part if multi-part, else `map`).

Key transition invariants:
- **Conjecture Shortcut:** Up to 2 conjectures per part. Correct value + `reason` of `>= 3` words jumps straight to `look_back` (`shortcut: true`). Correct value with `< 3` words stays in `conjecture` once with a skeptic prompt (`"Convince me in one sentence."`). Wrong value routes to `understand` and sets `hintRung` from `misconceptions` (`startLevel` indexes `['l0', 'l1', 'l2', 'l4', 'l3']`).
- **Understand Cap:** Advances to `plan` after at most 2 probes (`probes >= 2`) or when restatement covers `{unknown, data, condition}`.
- **Plan:** Selecting any Heuristic Deck card (`card`) unlocks Stage 3 (`carry_out`). `stuck` escalates the ladder one rung immediately.
- **Carry Out & ZPD Ladder (`['l0', 'l1', 'l2', 'l4', 'l3']`):**
  - Valid progress step fades ladder by `-1` (floor `l1`).
  - Two consecutive wrong/non-progress steps or a single `stuck` action escalate ladder by `+1`.
  - Reaching index `3` (`l4`) enters `simpler_problem`; solving the analogous sub-problem (or receiving scripted `l4.l3` after 2 misses) returns to `carry_out` at `l1`.
  - Correct final `submit` advances to `look_back` (or seals the current sub-part and advances to `arrive` on the next part in multi-part Dark Vault; `look_back` runs once after the final part `c`).
- **Look Back & Chapter Waiver:** Requires deterministic check on chosen option (`verify`, `second-method`, or `perturb`), or parent `waive` (enforced at most once per chapter across sessions).

### 3.2 Stage 3 Mechanics (`server/engine/mechanics/*.js`)
Every mechanic module exports pure functions `{ init(params), checkStep(state, step), isComplete(state), finalValue(state) }` with strict `Number.isFinite` / integer input sanitization and zero state mutation:
- **`inverse-chain.js`:** Enforces gate index order (gate 3 → gate 2 → gate 1), operation undo order (`add` toll back before `div` un-doubling), and exact intermediate coin results (`11`, `7`, `6`).
- **`goblin-bins.js`:** Child drags crystals into 3 bins to construct the maximal non-winning goblin draw (`[1,1,1]` = 3 for Pairs; `[3,3,3]` = 9 for Four; `[12,0,0]` = 12 for Difference), then derives `worstCase + 1`.
- **`seam-grid.js`:** Accepts any positive unit pair `(short, long)` satisfying `3 * short === 2 * long` (e.g. `2,3` or `4,6`), checks outer courtyard perimeter in units (`22k`), cubits per unit (`66 / 22k`), and single-shield perimeter (`30`).
- **`factor-dials.js`:** Checks prime factor leaves for `34` (`2, 17`) and `85` (`5, 17`), checks consistent guardian rune assignment (`Kimmy = 17, Jimmy = 2, Timmy = 5`), and computes sum `24`.

### 3.3 Synchronous 8-Stage Leak Gate (`leakGate.js`)
`checkUtterance(speech, context, options) -> { allowed: boolean, rule?: string, reason?: string }`

Runs synchronously in `< 0.02 ms` average (`< 5 ms` SLA) after Unicode NFKC normalization, zero-width character stripping, typographic dash normalization, and dual-case Cyrillic/Greek homoglyph folding:
1. **`length`**: Trimmed length must be `150..300` characters.
2. **`shape`**: Exactly one `?`, which must be the final non-whitespace character; no bullet/numbered list markers; no emoji.
3. **Numeric extraction**: Extracts integers, decimals, fractions (`a/b`), cardinals/ordinals up to `100` (including hyphen/space compound forms like `twenty-four` or `twenty four`), and `"a dozen"` (`12`).
4. **`forbidden`**: Rejects any extracted number within `0.001` of `part.forbidden`, unless it is also in `givens` **and** appears inside a verbatim `>= 12`-char substring quote of `inscription`.
5. **`construction`**: Rejects regex patterns in `leakGate.rules.json` (`the answer is`, `equals`, `you need N crystals`, `is it N or`, `so that's N`, etc.).
6. **`praise`**: Rejects evaluation/praise lexicon hits (`great`, `brilliant`, `exactly`, `correct`, `right!`, `well done`, `nice job`, `perfect`, `awesome`, `spot on`, `you got it`, `good job`, `that's it`, `close!`, `not quite`, `almost`).
7. **`rung` (digit ceiling)**: Zero digits allowed at `l0` and `l1`; at `l2`/`l3`/`l4` digits must belong to `givens` or authored `hintText`.
8. **`rung` (operation ban at `l0`/`l1`)**: Rejects morphological inflections of `add`, `subtract`, `multiply`, `divide`, `double` (`doubled`, `doubling`, `doubles`), `halve` (`halved`, `halving`, `halves`), `plus`, `minus`, `times` at rungs `l0` and `l1`.

---

## 4. Tutor Router, Direct-REST and Local CLI Adapters (`server/tutor/`)

- **`server/tutor/index.js`** (`generateTurn(ctx, options)`):
  1. Calls `assertInformationDiet(ctx)` — throws immediately if `answer`, `targetAnswer`, `solution`, `intermediates`, `forbidden`, `isCorrect`, etc. appear anywhere in the context object.
  2. Builds the visibility-filtered `allowedContent` (`pool`, `hintText`, `cardNames`) for the current `(state, rung)`.
  3. Calls the selected adapter (`scripted`, `gemini`, `claude`, or `agy`). REST calls use the existing four-second budget; agy has its own bounded process startup allowance.
  4. Screens output via `checkUtterance(...)`. On failure, retries **once** with `style.correction = "Your last reply broke rule {rule}. Write a different reply."`. On second failure or network/timeout error, returns the deterministic round-robin probe from `server/engine/scripted.js` and logs `fallback: true` to telemetry.
- **`server/tutor/agy.js`**: Runs the authenticated Antigravity CLI with explicit `gemini-3.8-flash-low`/low effort in a fresh temporary workspace. Prompt JSON goes over stdin, tools are denied by a fixed PreToolUse hook, and model/strict-mode/cwd are checked in the init event. Tool activity, malformed/multiple outputs, oversize output, timeout and nonzero exit fail closed to the normal scripted fallback. Provider keys are not inherited. Authentication retains the real HOME, so ambient agy customizations may load and normal CLI conversation retention still applies; no repository source is copied into the temporary workspace.
- **`server/load-env.js`**: Optional `.env` preloader for `npm start`/`npm run dev`, using Node `process.loadEnvFile` before provider imports. Missing files are fine; invalid files fail visibly.
- **`server/tutor/gemini.js`**: Calls `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` (`DEFAULT_MODEL = 'gemini-3.8-flash'`) with `thinkingConfig: { thinkingLevel: 'LOW' }` and `responseSchema`. Reads `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) and optional `GEMINI_MODEL`.
- **`server/tutor/claude.js`**: Calls `https://api.anthropic.com/v1/messages` (`DEFAULT_MODEL = 'claude-sonnet-4-6-20260320'`, `anthropic-version: 2023-06-01`) using forced tool-choice (`respond_as_archimedes`) for strict JSON output. Reads `ANTHROPIC_API_KEY` and optional `ANTHROPIC_MODEL`.

---

## 5. HTTP & SSE Server API (`server/index.js`)

Exports `{ createServer, startServer, closeServer, verifyParentPin, sessionStore, chapterWaiversUsed }`.

| Method | Path (and Supported Aliases) | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/encounters` | Public | Chapter 1 node catalog with sequential `unlocked`, `completed`, and `sceneAsset` status |
| `GET` | `/api/encounter/:id/view` *(alias `/api/encounters/:id/view`)* | Public | Static client-safe encounter view (accepts full ID `ch1-n1-reverse-tolls`, `1`, `n1`, or `reverse-tolls`) |
| `POST` | `/api/session/start` *(alias `/api/session`)* | Public | Body `{ encounterId, tutorAdapter? }` → creates session, logs `session.start`, returns `{ ok, sessionId, state, view }` |
| `GET` | `/api/session/:id/state` | Public | Returns current sanitized `{ ok, state, view }` |
| `POST` | `/api/session/:id/action` *(alias `/api/session/:id/act`)* | Public | Body `{ type, ... }` (or `{ action: { type, ... } }`) → runs engine transition, optional tutor turn, SSE broadcast, returns `{ ok, state, view, speech, finished, events }` |
| `GET` | `/api/parent/transcript?pin=XXXX&session=...` | PIN (`?pin=` or `X-Parent-PIN`) | Timing-safe PIN check (`crypto.timingSafeEqual`); opens SSE stream, auto-discovers latest session if `session` omitted, replays JSONL history, streams live updates + 20s heartbeats |
| `POST` | `/api/parent/override` *(alias `/api/parent/hint-override`)* | PIN | Body `{ sessionId, rung, pin? }` → overrides `hintRung` (`l0`..`l3`) |
| `POST` | `/api/parent/scribe` *(alias `/api/parent/toggle-scribe`)* | PIN | Body `{ sessionId, enabled, pin? }` → toggles parent Scribe Mode |
| `POST` | `/api/parent/waiver` | PIN | Body `{ sessionId, pin? }` → waives `look_back` once per chapter across all sessions |
| `GET` | `/parent` | Public shell (API calls require PIN) | Serves `client/parent.html` |
| `GET` | `/assets/*` | Manifest Gate | Checks `client/assets/manifest.json`; returns `404` if unlisted, `403` if `approved !== true` |
| `GET` | `/*` | Public | Path-traversal-guarded static delivery from `client/` (SPA fallback to `client/index.html`) |

---

## 6. Client PWA & Dual-Mode SVG Diagrams (`client/`)

- **Child Client (`index.html`, `app.js`, `style.css`):**
  - Renders the single world Map, coherent Encounter scene, Heuristic Deck overlay and Golden Seal. The engine still persists Codex entries, but there is no Codex navigation.
  - `illustrations.js` maps reviewed, manifest-gated PNG stills; the current layout uses one keeper scene plus Lemma and creature-card pictures. Compact Rivet/Grubb sprites avoid separate portrait panels. `timed-speech.js` exports `TimedSpeech` with `speak`, `complete`, `cancel`, and `replay`; the default opening delay and silent character cadence live in that module. The client offers Read now / Read again and a persisted instant-speech preference. Full text remains available; reduced motion skips pacing. Dedicated full-line live regions avoid announcing individual character updates.
  - Speech callbacks are cancelled on navigation, new sessions and part changes. Pacing does not set network `busy`. Modal opening is exclusive and finishes obscured speech; hidden tabs also finish pending text. Each action's duplicate view/response utterance is spoken once, while identical text on a later child turn is allowed. Grubb still uses only the existing engine-event whitelist.
  - Conjecture slate enforces number + reason input; Stage 3 Scroll drawer mounts interactive SVG mechanics; Look Back renders inline cards/chips (no `window.prompt`).
  - Plays a gentle Web Audio harmonic chord **only** when sealing a node.
- **Diagram Components (`client/diagrams/*.js`):**
  - Each component exports `render(spec, mode, state) -> svgString` (Node-compatible, pure string output) and `mount(container, spec, mode, state, onStep)` (attaches browser event listeners for `workspace` mode).
  - `mode === 'hint'` renders static structure at rung `l2` with zero leaked intermediate/final numbers.
  - `mode === 'workspace'` renders interactive deduction steppers (`>= 44 px` handles; `>= 56 px` buttons) with no hardcoded answer buttons.
- **Parent Dashboard (`parent.html`, `parent.js`):**
  - Connects via `EventSource` to `/api/parent/transcript`, renders XSS-escaped live dialogue and gate telemetry, shows configured adapter/model and latest live/fallback reply source, and provides Scribe text submission, rung selector, chapter Look Back waiver button, and OpenDyslexic font toggle (`localStorage`).

---

## 7. Evaluation Harness (`eval/`)

`eval/run.js` drives simulated students through `createSession` / `transition` / `generateTurn` using only `getClientSafeSessionView` (verified via `assertClientSafe` on every turn):
- `node eval/run.js --smoke`: Runs 4 encounters × 6 personas × 1 seed = 24 dialogues offline in scripted mode; writes `eval/reports/{date}-{adapter}.{json,md}`.
- `npm run eval:ci` (`node eval/run.js --ci`): Checks for `GEMINI_API_KEY` / `GOOGLE_API_KEY` / `ANTHROPIC_API_KEY`. When absent, prints `[SKIP] Missing API keys in environment` and exits `0` without writing a report. When present, runs 4 encounters × 3 personas (`extractor`, `caver`, `misconception`) × 3 seeds and exits non-zero if post-gate leak rate > `0.0%`, praise rate > `0.0%`, or fallback rate > `10%`.

---

## 8. Offline Asset Pipeline (`tools/assets/`)

- `python3 tools/assets/generate.py` (or `npm run assets`) uses only Python 3 standard libraries (`hashlib`, `json`, `pathlib`) to generate:
  - 10 architectural 16:9 SVG scenes in `client/assets/scenes/` (`ch1-n1..n4-{locked,unlocked}.svg`, `map-ch1.svg`, `chapter1-card.svg`) using the 6-color Royal Architect's Guild palette (`#f7f1e3`, `#2c2416`, `#1c2631`, `#5dade2`, `#c8963e`, `#d8cca8`) with zero embedded text.
  - Character reference sheets (`archimedes-sheet.svg`, `hero-sheet.svg`) and 6 hero avatars (`hero-1.svg`..`hero-6.svg`) in `client/assets/avatars/`.
  - `client/assets/manifest.json` with SHA-256 hashes, dimensions, review checklists, `placeholder: true`, and `approved: true`.
- Image-model prompt specifications for future raster/WebP rendering live in `tools/assets/prompts/*.md`.

---

## 9. Test Suite Inventory (`test/`)

Run all 28 files (`734` tests across `206` suites) via `npm test`:
- **5-Tier Master & E2E Suites:** `e2e-tiers.test.js`, `e2e-tier1-features.test.js`, `e2e-tier2-boundaries.test.js`, `e2e-tier3-combinations.test.js`, `e2e-tier4-scenarios.test.js`, `tier5-adversarial.test.js`.
- **Engine & Mechanics:** `stateMachine.test.js`, `engine-playability.test.js`, `mechanics-stress.test.js`, `adversarial-stress.test.js`.
- **Leak Gate:** `leakGate.test.js` (240 authored utterances: 60 per encounter, 50/50 leak vs clean), `leakGate-adversarial.test.js`.
- **Tutor Adapters:** `tutor.test.js`, `tutor.stress.test.js`, `tutor-challenger-m2.test.js`.
- **Server, Client, Diagrams & Assets:** `server.test.js`, `server-adversarial.test.js`, `client-integration.test.js`, `diagram-challenger-m3.test.js`, `diagram-deep-adversarial.test.js`, `waiver-stream-stress.test.js`, `challenger-m3-arrival-conjecture.test.js`, `challenger-m3-it4.test.js`, `assets.test.js`, `challenger-m4-assets.test.js`.
- **Eval & Cross-System Challengers:** `eval.test.js`, `challenger-m4-eval.test.js`, `challenger-empirical.test.js`, `challenger-m5-e2e.test.js`, `challenger-m5-security.test.js`.

---

## 10. Ground-Truth Differences Between `SPEC.md` Sketch and v1 Codebase

When navigating the repo from a fresh session, keep these intentional consolidations in mind:

1. **Encounter filenames (`content/encounters/`):** Named `chasm-reverse-tolls.json`, `alchemists-dark-vault.json`, `courtyard-five-shields.json`, and `castle-keep-portcullis.json` (their internal `"id"` fields are `ch1-n1-reverse-tolls`, `ch1-n2-dark-vault`, `ch1-n3-five-shields`, `ch1-n4-castle-keep`, and `server/index.js` resolves both full IDs and shorthand aliases).
2. **Consolidated server & client entrypoints:**
   - `server/index.js` contains both HTTP routing and client-safe session wiring (instead of splitting out a separate `server/api.js`), while view sanitization lives in `server/engine/clientView.js` and telemetry lives in `server/engine/telemetry.js`.
   - `client/app.js` and `client/parent.js` cleanly house the UI modules rather than splitting `client/ui/*.js` into eight tiny files.
   - Heuristic Deck metadata is defined inline in `server/tutor/index.js` (`CARD_NAMES`) and `client/app.js` rather than a separate `content/deck.json`.
3. **Server defaults when env vars are omitted:**
   - Running `node server/index.js` directly defaults to `PORT = 3000`, `host = '127.0.0.1'`, `TUTOR_ADAPTER = 'scripted'`, and `PARENT_PIN = '1234'`.
   - To match SPEC §1 home-LAN play on port `8080` across Wi-Fi (e.g. from an iPad), bind `'0.0.0.0'` on port `8080` (see `README.md` and `docs/HANDOFF.md`).
   - Because zero npm packages (`dotenv`) are installed, pass Node’s built-in `--env-file-if-exists=.env` flag when loading `.env`.
4. **Scene asset format:** v1 ships procedural SVG placeholders (`client/assets/scenes/*.svg`, `placeholder: true, approved: true`) rather than `.webp` raster outputs, per the v1 build instruction not to invoke live image generation. `server/index.js` serves both `.svg` and `.webp` once registered and approved in `client/assets/manifest.json`.
5. **Deferred scripts / Chapter 2+ stubs:**
   - `package.json` lists `"digest": "node server/telemetry/digest.js"`, which is not yet implemented (session JSONL logs are written to `data/sessions/*.jsonl` and ready for a digest script).
   - Chapter 2+ diagram components (`tape-model.js`, `place-value.js`), `eval/judge.js`, and `eval/golden/` transcripts are deferred for the next milestone/chapter iteration.
