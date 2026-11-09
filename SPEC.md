# Keybreakers — Build Spec v1 (Home Edition)

Nov 8, 2026 · Heman Shakeri

Presentation revision, Nov 9: **Keybreakers: The Goblin’s Gate** is the provisional series/issue title. The **Castle of Theorems** remains the destination. See `docs/NAME-CHECK.md` for the existing adjacent use; this title is not cleared for public release. The design pillars and protected mathematical content remain unchanged.

## 1. Scope

v1 is a home-LAN web game for one child with a parent at the table: four Pólya encounters on the road to the Castle of Theorems, an LLM tutor that probes before it hints, pre-rendered scenes, and a parent log. Every v1 decision must survive the later move to a product, so the engine lives server-side, all content is data, and the LLM sits behind an adapter from day one.

**Player.** An 8–9-year-old working at Beast Academy 3–4 / Math Kangaroo Écolier / MOEMS Division E level. Reads independently; types slowly, so replies are tap-chips plus short free text. One profile; English only.

**Session shape.** 15 minutes, one chapter of 3–4 nodes, parent present and able to act as scribe. No timers, no leaderboards, no streaks — these are permanent exclusions, not deferrals.

**In scope for v1**

- Chapter 1: four encounters (Reverse Tolls, Dark Vault, Five Shields, Castle Keep), each with a Stage 3 mechanic, a five-level hint ladder, one diagram component, a Look Back challenge and a Codex entry.
- Deterministic engine in Node: encounter state machine, answer/step checker, ZPD hint ladder, leak gate, scripted fallback, telemetry.
- Tutor adapter with `gemini-3.8-flash` as default and a Claude implementation for A/B and the eval harness.
- Zero-dependency vanilla HTML/CSS/JS PWA client, served from the same Node process; plays on an iPad or laptop over the home network.
- Pre-rendered scenes (locked/unlocked state per node) and one-time avatar generation with parent approval.
- Eval harness with simulated students; CI fails on any deterministic answer leak.
- Parent dashboard: transcripts, hint usage, manual hint override, scribe mode.

**Out of scope for v1 (deferred to §15)**: accounts and auth, public hosting, COPPA controls, voice (TTS or live audio), live image generation during play, LLM-generated problems, more than one child profile.

**Runtime assumption.** Node 20+ on a laptop, API keys in `.env`, client reached at `http://<laptop>:8080` from the child's device.

## 2. Design pillars

Ten rules override any later convenience; each is testable and §14 cites them as acceptance criteria.

1. **Pólya's stages are the game verbs.** Understand, Plan, Carry Out and Look Back each have their own UI state and their own check. The mathematics is the mechanic the child operates (intrinsic integration in the Habgood–Ainsworth sense), never a quiz between scenes.
2. **Guess first, then earn.** On arrival the child may submit a conjecture with a one-sentence justification. Correct and justified → straight to Look Back. Wrong → the gate locks and Stage 1 begins, and the wrong value selects the starting hint level through the encounter's misconception table. At most two conjectures per part.
3. **The engine judges; the model asks.** Every correctness decision (final answer, intermediate step, worst-case construction, diagram completion) is deterministic code against the authored solution tree. The model never grades an answer and is never told whether a tentative idea is right.
4. **Leakage control is layered.** (a) Information diet: the model receives no solution values and no correctness signal. (b) Template-constrained output at levels l0–l1. (c) The deterministic leak gate on every utterance. (d) Scripted fallback. The model can solve these problems from their text, so (a) lowers salience; (c) is the guarantee. Prompt wording is the weakest layer and is never the only one.
5. **Scripted mode is the floor.** Every (part, stage, level) has authored probes. The game must be fully playable with the LLM disabled; the model adds responsiveness to the child's words, not pedagogy.
6. **The hint ladder follows the ZPD.** l0 metacognitive → l1 strategic → l2 conceptual with diagram → l4 simpler analogous problem → l3 operational step, then fade one level after each correct step. "I'm stuck" advances one level; two consecutive non-progress turns advance one level.
7. **Uniform tutor voice.** 150–300 characters, exactly one question, identical tone for right and wrong ideas, no praise lexicon, no reply-length drift. Enforced in code (length and lexicon checks), not only in the prompt.
8. **Look Back is mandatory.** The Golden Seal requires one of: a verification (parity, estimate, extreme case), a second method, or a prediction under a perturbed condition; then the formal name enters the Codex. The parent may waive it once per chapter.
9. **Never patronize.** Stage 1 ends after at most two probes whatever the child says; routine arithmetic is never required to be shown; scribe mode exists so handwriting and typing never gate thinking.
10. **Pictures are assets, not generation.** Scenes are pre-rendered and parent-reviewed; diagrams are drawn by code from engine parameters; the only runtime image generation is the one-time avatar.

## 3. System architecture

One Node process serves the PWA and exposes a small JSON API; the engine inside it is the only component that knows answers, and every tutor utterance passes through it before the child sees it.

*(Architecture diagram lives in the Claude Doc. In text: the PWA client, the parent dashboard and the eval harness are three thin callers of one local API on the Node server; inside the server sit the Engine (state machine, checker, ZPD ladder, leak gate, scripted probes; sole holder of the solution tree), the Tutor adapter (gemini-3.8-flash default, Claude alternative, 4 s REST timeout / bounded local agy startup → scripted fallback), Content and assets, and Telemetry; the adapter calls the Gemini or Claude API; an offline image model feeds the asset store through the dev-time asset tool.)*

The child's device and the parent's browser are thin views over one local API. The engine decides every transition and screens every utterance; LLM and image providers are adapters, and image generation happens offline through the asset tool.

| Component | Runs where | Responsibility | Talks to |
| --- | --- | --- | --- |
| PWA client | Child's device (browser) | Render map, encounter UI, Scroll workspace, Heuristic Deck, Codex; draw SVG diagrams from engine-supplied parameters; send actions. Never receives answers, intermediate values, or hint text beyond the current level. | `/api/session/*` |
| Parent dashboard | Parent's browser, same PWA at `/parent` | Live transcript, hint-level override, waive Look Back, scribe mode (parent types what the child says), pause, end session. | `/api/parent/*` |
| Engine | Node, `server/engine/` | Encounter state machine, deterministic checker, ZPD ladder, misconception table lookup, leak gate, scripted probe pools, telemetry writer. Pure functions over `(state, action, encounter)`; no I/O inside. | Tutor adapter, content store, telemetry |
| Tutor adapter | Node, `server/tutor/` | One interface `generateTurn(ctx) → TutorTurn`; implementations `scripted.js` (offline default), `gemini.js`, `claude.js` and local `agy.js`. Builds the per-stage context (§6), enforces output schema, and bounds provider calls. | Gemini API, Claude API |
| Content store + validator | `content/encounters/*.json`, `content/validate.js` | Encounter schema (§5), load at boot, fail fast on invalid content, flag given/forbidden number collisions. | Engine |
| Asset tool | `tools/assets/` (dev time, Python or Node) | Generate character sheets and scene states with an image model, write `client/assets/manifest.json`; parent reviews before commit. | Image model API |
| Telemetry | `server/telemetry/`, `data/sessions/*.jsonl` | One event per action and tutor turn: stage, level, raw model output, gate verdict, latency. Source for the parent view and the eval reports. | Parent dashboard, eval |
| Eval harness | `eval/` (dev time) | Simulated students drive the engine through the same API; computes leak, praise, length, solve-rate metrics (§11). | Engine, tutor adapter |

**API surface (v1).** `POST /api/session` starts a session for the single profile and returns the map state. `GET /api/encounter/:id/view` returns the client-safe view (narrative, problem text, parts, chips, scene asset ids) with the solution tree stripped server-side. `POST /api/session/:id/act` takes one action (`conjecture`, `say`, `chip`, `card`, `step`, `stuck`, `submit`, `lookback`) and returns the new UI state plus at most one tutor utterance. `GET /api/parent/sessions/:id` streams events; `POST /api/parent/sessions/:id/override` sets hint level, waives Look Back, or toggles scribe mode.

## 4. Game loop and encounter state machine

Each part of an encounter runs the machine below once; Look Back runs after the last part. The engine owns every transition; the model is only called to phrase a probe inside a state.

*(State diagram lives in the Claude Doc. In text: Arrive → Conjecture → (wrong) Understand → (understood) Plan → (card chosen) Carry out → (answer) Submit check → (right) Look back → (named) Sealed. A right, justified conjecture skips from Conjecture straight to Look back. A wrong submit loops back to Carry out. Reaching rung l4 opens the Simpler problem sub-loop and returns to Carry out.)*

"I'm stuck" or two consecutive non-progress turns move one rung up the ladder l0 → l1 → l2 → l4 → l3; a correct step fades one rung, never below l1 inside Stage 3. The ladder index, not the level name, is what the engine stores.

| From | Event | Guard (engine) | To | Side effects |
| --- | --- | --- | --- | --- |
| Arrive | scene shown, inscription read | — | Conjecture | scripted opening line; conjecture window open; `conjectures = 0` |
| Conjecture | `conjecture {value, reason}` | `check(value) = right` and `words(reason) ≥ 3` | Look back | log `shortcut = true` |
| Conjecture | `conjecture {value, reason}` | right, reason empty | Conjecture | one scripted skeptic prompt ("Convince me in one sentence."); no level change |
| Conjecture | `conjecture {value}` | wrong | Understand | `conjectures += 1`; `level = misconceptions[value].startLevel ?? l0`; `misconceptionTag` set |
| Conjecture | second wrong conjecture | `conjectures = 2` | Understand | conjecture window closes for this part |
| Understand | `say` / `chip` | model classifies restatement `{unknown, data, condition}` all true, or `probes = 2` | Plan | Deck opens; `probes` reset |
| Understand | `say` / `chip` | classification incomplete, `probes < 2` | Understand | one more l0 probe targeted at the missing piece |
| Plan | `card {id}` | any card | Carry out | workspace unlocks for the encounter's mechanic; if `card ∉ encounter.cards`, first Stage 3 utterance is an l1 probe about the card |
| Plan | `stuck` or `probes = 2` with no card | — | Plan | ladder +1; at l1 the tutor names the Deck's relevant card; at l2 the diagram renders |
| Carry out | `step {…}` | `checkStep` right | Carry out | ladder −1 (floor l1); `nonProgress = 0` |
| Carry out | `step {…}` | `checkStep` wrong | Carry out | `nonProgress += 1`; at 2 → ladder +1, reset counter |
| Carry out | ladder reaches l2 | — | Carry out | diagram spec sent to client; conceptual hint text allowed to the model |
| Carry out | ladder reaches l4 | — | Simpler problem | sub-loop: simpler statement, own deterministic check, scripted l3 if wrong twice |
| Simpler problem | right answer, or scripted l3 given | — | Carry out | bridge probe ("Now the real chest."); ladder set to l1 |
| Carry out | `submit {value}` | right | Look back | `attempts` logged |
| Carry out | `submit {value}` | wrong | Carry out | `attempts += 1`; at 3 → parent dashboard flag + l3 offered |
| Look back | `lookback {kind, value}` | kind ∈ {verify, second-method, perturb}; deterministic check where the kind has one | Sealed | Codex entry `theorem` added; Golden Seal; `kind` logged |
| Look back | `waive` (parent only) | — | Sealed | logged `waived = true`; max once per chapter |
| Sealed | — | more parts remain | Arrive (next part) | scene stays locked until last part |
| Sealed | — | last part | Map | scene asset switches to `unlocked`; next node enabled |

**Ladder.** Levels are stored as an index into `[l0, l1, l2, l4, l3]`. Each rung changes what the model may see and what the client renders:

| Rung | Child receives | Source of content | Diagram |
| --- | --- | --- | --- |
| l0 metacognitive | one open question about the unknown, the data or the condition | template pool, model may paraphrase | no |
| l1 strategic | a nudge toward a Deck card, no operation named | template pool, model may paraphrase | no |
| l2 conceptual | the governing idea in one sentence, plus the diagram | authored hint text passed to the model verbatim | yes |
| l4 analogous | a tiny version of the same problem to solve first | authored sub-problem, engine-checked | optional |
| l3 operational | the next concrete step for the real problem, no values | authored step text passed to the model verbatim | yes |

**Idle.** No child action for 90 s (never shown as a timer): one scripted l0 question, then silence; the parent dashboard shows an idle flag. **Scribe mode** replaces the child's free-text field with the parent's keyboard; everything else is unchanged.

**Answers in conversation.** An explicit integer conclusion in the child's words (for example, an answer declaration or a final x declaration) is another input to the existing deterministic checker. The parser identifies syntax; it never evaluates arithmetic or searches for a matching solution. A bare chat number first receives the same neutral request for reasoning regardless of its value. A later explanation may complete that claim; uncertainty, retraction, alternatives and replacement language cannot justify a stale claim. Conjecture limits, part boundaries and Look Back still apply. The model receives original child words, never the parser's pending candidate or a correctness flag.

**A finite final check.** Entering Look Back visibly marks the answer lock as set. The engine selects the verify option when available, otherwise the first authored option. The child may select a different option with `lookback_select`; only the selected task is shown. Its result is checked deterministically, whether submitted through its control or chat. A repeated starting-number equation receives a specific input-format explanation, never a generic new probe or an automatic Seal. Choice labels are visible without their answer key. Look Back guidance is local and leak-gated; after sealing, no further tutor question is generated or replayed.

## 5. Content model

An encounter is one JSON file that carries everything the engine needs and nothing the client may see: the solution tree, the misconception table and the hint ladder live beside the problem text, and `content/validate.js` refuses any file that breaks the rules below. Types are given in TypeScript notation for precision; the runtime is plain JSON and plain JS.

```typescript
type Encounter = {
  id: string;
  chapter: number; node: number;
  title: string;
  scene: { locked: AssetId; unlocked: AssetId };
  narrative: { arrival: string; sealed: string };
  inscription: string;
  cards: CardId[];
  givens: number[];
  parts: Part[];
  lookBack: LookBackOption[];
  codex: { theorem: string; childName: string; oneLine: string };
};

type Part = {
  id: string;
  prompt: string;
  answer: Answer;
  intermediates: { id: string; value: number; label: string }[];
  forbidden: number[];
  misconceptions: Misconception[];
  ladder: {
    l0: string[];
    l1: string[];
    l2: { text: string; diagram: DiagramSpec };
    l4: { statement: string; answer: Answer; l3: string };
    l3: { text: string; diagram?: DiagramSpec };
  };
  mechanic: Mechanic;
  chips: { understand: string[]; plan?: string[] };
};

type Misconception = {
  match: number | { min: number; max: number } | 'any-wrong';
  tag: string;
  startLevel: 0 | 1 | 2 | 3 | 4;
  probe: string;
};

type Answer =
  | { type: 'integer'; value: number }
  | { type: 'set'; values: number[] }
  | { type: 'choice'; options: string[]; correct: number };

type DiagramSpec = {
  component: 'pigeonhole-bins' | 'inverse-chain' | 'seam-grid' | 'tape-model' | 'factor-tree' | 'place-value';
  params: Record<string, number | string | number[]>;
};

type Mechanic =
  | { kind: 'goblin-bins'; bins: number; perBin: number; target: { same?: number; different?: true } }
  | { kind: 'inverse-chain'; gates: { mul: number; sub: number }[]; end: number }
  | { kind: 'seam-grid'; relation: { shortCount: number; longCount: number }; outerPerimeter: number }
  | { kind: 'factor-dials'; products: { left: string; right: string; value: number }[] };

type LookBackOption = {
  kind: 'verify' | 'second-method' | 'perturb';
  prompt: string;
  check: Answer;
};
```

**Field notes.** `narrative.*` strings are scripted and never model-written, each at most 300 characters. `givens` lists every number in the inscription and is cross-checked by the validator. `intermediates` is the ordered solution tree; `label` is engine-only. `forbidden` is the answer, the intermediates and anything else that gives the answer away. `ladder.l0` and `ladder.l1` each hold at least three probes with no digits in them; `l2.text` and `l3.text` are passed to the model verbatim; `l4` is the simpler analogous problem with its own engine-checked answer and its own scripted step. `startLevel` is an index into `[l0, l1, l2, l4, l3]`. `chips.understand` are tap answers for Stage 1, and the first chip is never the best one. `DiagramSpec.params` is a flat map of numbers, strings and number arrays and never contains a forbidden value unless the child has already produced it. Every `LookBackOption.check` is engine-checked; nothing in Look Back is judged from free text.

**Validator rules** (`npm run validate`, also run at server boot; errors fail, warnings print):

1. Every probe, hint and narrative string is 40–300 characters; every probe ends with exactly one question mark; no string contains a word from the praise lexicon (§7).
2. `l2.text` and `l3.text` contain no token numerically equal to a value in `forbidden` (error). `l0` and `l1` strings contain no digits at all (error).
3. Any value in both `forbidden` and `givens` is reported with the colliding numbers. The fix is to renumber the problem, not to weaken the gate: Dark Vault uses 12 crystals per colour rather than 10 because 10 is the answer to part b.
4. The validator expands every forbidden value into word forms (four, fourth, 4th, a dozen for 12) up to 100; the gate uses the expanded list.
5. Each `mechanic.kind` needs a module at `server/engine/mechanics/<kind>.js` exporting `init(params)`, `checkStep(state, step)`, `isComplete(state)`, `finalValue(state)`; the validator imports it and replays the encounter's own `intermediates` through it as a self-test.
6. `cards` is a subset of the Deck's card ids; `misconceptions` ends with `match: 'any-wrong'`; `lookBack` has at least 2 options of at least 2 distinct kinds.
7. Inscription and probes at or below US grade-4 reading level by Flesch–Kincaid (warning only).
8. Ids never change after first play; a content change bumps `contentVersion` in the file header, and telemetry records the version used.

## 6. Tutor contract

The model phrases one probe per turn from a context the engine assembles; it never sees solution values and never sees whether the child's tentative idea is right. The adapter exposes one function, `generateTurn(ctx) → TutorTurn`, and the engine treats its output as a candidate until the leak gate (§7) admits it.

**Visibility matrix.** What the engine puts in the model's context, by state and rung. "Pool" means the authored probe strings for that rung, which the model may paraphrase or choose among.

| State / rung | Problem text | Recent permitted dialogue | Probe pool | Authored hint text | Diagram id | Step verdicts | Correctness of child's idea | Answer or intermediates |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Conjecture (skeptic prompt) | yes | yes | skeptic pool | no | no | no | no | no |
| Understand, l0 | yes | yes | l0 pool + misconception probe | no | no | no | no | no |
| Plan, l1 | yes | yes | l1 pool + card names | no | no | no | no | no |
| Carry out, l1 | yes | yes | l1 pool | no | no | right / wrong per step, no values | no | no |
| Carry out, l2 | yes | yes | — | `l2.text` verbatim | yes | right / wrong per step | no | no |
| Simpler problem, l4 | simpler statement only | yes | l4 bridge pool | `l4.l3` only after two wrong tries | optional | right / wrong | no | no |
| Carry out, l3 | yes | yes | — | `l3.text` verbatim | yes | right / wrong per step | no | no |
| Look back | no model call | — | local selected-task guidance | displayed authored task | optional | — | no model call | no model call |

**Conversation memory.** Keep a separate ledger of explicit child words and delivered tutor lines. Model memory contains at most six plain `{who, text}` entries from the current part and rung; re-screen every earlier tutor line through the current leak gate. Never use engine action history, transitions, step verdicts or parent events as conversational text. The visible conversation contains only the current play. Prior sessions are never merged into the display or sent back to a model.

**Request** (engine → adapter), one object per turn, shown as a JS literal:

```javascript
{
  encounterId: 'ch1-n2-dark-vault',
  partId: 'a',
  state: 'carry_out',
  rung: 'l1',
  inscription: '...',
  partPrompt: '...',
  transcript: [{ who: 'child', text: '...' }, { who: 'tutor', text: '...' }],
  childAction: { type: 'step', summary: 'placed a crystal in a bin' },
  stepVerdict: 'wrong',
  allowedContent: { pool: ['...', '...'], hintText: null, cardNames: ['Worst case', 'Try a tiny case'] },
  style: { minChars: 150, maxChars: 300, persona: 'Rivet the clockwork owl, deadpan engineer' }
}
```

**Response** (adapter → engine), enforced by JSON schema at the API and re-validated in code:

```javascript
{
  speech: 'string, 150 to 300 chars, exactly one question mark, at the end',
  usedPoolIndex: 1,
  understanding: { unknown: true, data: false, condition: true },
  studentSignal: 'engaged | stuck | guessing | off_topic',
  suggestCard: 'Worst case'
}
```

`understanding` is read only in the Understand state and is the one classification the model performs. `studentSignal` is advisory telemetry and never changes a transition. `suggestCard` is honoured only at rung l1 or higher and only if the card is in `encounter.cards`.

**Adapter rules.** Call with the lowest thinking setting the provider offers (for `gemini-3.8-flash`, `thinking_level: low`); hard timeout 4 s for direct REST, with a separate 30 s process allowance for the explicitly selected local agy CLI; one retry with a short appended correction if the first candidate fails the gate; then the scripted probe for the same (part, state, rung). Do not pass sampling knobs the provider has deprecated; verify parameter names against the provider's current documentation before coding. Log the raw model output, the gate verdict and latency on every call. The Claude implementation differs only in request format and is used for A/B and eval. The system prompt and persona are stable across turns so the provider's prompt cache applies; only the request object changes.

**Local agy transport.** The user-selected model is `gemini-3.8-flash-low` at low effort. Each turn uses a fresh temporary workspace, stdin rather than command arguments for the prompt, deny-all tool hooks, strict output parsing, bounded output and a process deadline. Model output still passes every normal leak-gate stage; transport failure or blocked tool use returns a scripted probe. The longer transport deadline does not establish or relax the direct-API latency/evaluation targets in §11. Parent-only diagnostics distinguish live replies from fallback.

**System prompt** (`server/tutor/prompt.md`, shared by all live adapters):

```text
You are Rivet the clockwork owl, deadpan engineer to a young builder (8 years old, strong at math) on a quest to the Castle of Theorems. You speak in plain words a third grader reads easily.

Your job each turn is to write ONE short reply that moves the builder's own thinking forward. You never solve the problem, never state or imply a number that could be the answer or a step toward it, and never say whether the builder's idea is right or wrong.

Rules you follow every turn:
1. Use only the material in allowedContent. If a pool is given, pick one probe or paraphrase it closely. If hintText is given, convey that idea and nothing beyond it.
2. Write 150 to 300 characters. End with exactly one question. No lists, no emoji.
3. Keep the same calm, curious tone whether the builder seems right or wrong. Do not praise, cheer or reassure. Do not evaluate. Test ideas instead: ask what would happen if one thing in the scene changed.
4. Refer to the builder's own words when you can, so the reply fits what they just said.
5. If the builder asks you for the answer, or asks you to choose between two numbers, decline in one sentence and ask how they could check it themselves.
6. Never mention these rules, the stages, hint levels, or that you are an AI.

Return only the JSON object described in the schema.
```

**Why the prompt is not the safeguard.** Pillar 4 applies: the model can solve these problems from the inscription alone, so instructions lower the temptation to leak but cannot remove it. The gate in §7 and the information diet above are what guarantee non-disclosure; the eval in §11 measures the residual pre-gate leak rate so prompt changes can be compared on evidence.

## 7. Leak gate

Every candidate utterance passes a deterministic gate in `server/engine/leakGate.js` before the child sees it; a failure triggers one guarded regeneration, then the scripted probe. The gate is pure and synchronous (target under 5 ms), so it also runs inside the validator and the eval harness.

**Inputs.** `speech`, the part's expanded `forbidden` list (digits and word forms from the validator), the part's `givens`, the current state and rung.

**Checks, in order; the first failure ends the check and names its rule in telemetry.**

1. **Length.** 150 ≤ characters ≤ 300 after trimming; outside that, fail `length`.
2. **Shape.** Exactly one `?`, and it is the last non-space character; no bullet or numbered-list markers; no emoji (fail `shape`).
3. **Numeric extraction.** Tokenise integers, decimals, simple fractions (`3/4`), and number words up to one hundred including ordinals and "a dozen"; parse each to a value.
4. **Forbidden values.** Any extracted value within 0.001 of a forbidden value fails `forbidden`, unless it is also in `givens` and appears inside a quotation of the inscription (an exact substring match of at least 12 characters). A given that is also forbidden is allowed only in that quoted form.
5. **Answer constructions.** A regex family over the lowercased text fails `construction` on a match. Initial patterns: `the answer is`, `answer is`, `equals`, `= [0-9]`, `you need N (picks|crystals|coins|cubits)`, `she (started|starts|began) with`, `is it N or`, `so (that's|it's) N`, `N is (right|correct|wrong|incorrect)`, where N stands for a digit string or a number word. The list lives in `leakGate.rules.json` and grows from residual leaks the harness finds.
6. **Evaluation leakage.** Fail `praise` on any lexicon hit: `great`, `brilliant`, `exactly`, `correct`, `right!`, `well done`, `nice (job|work|thinking)`, `perfect`, `awesome`, `spot on`, `you got it`, `good job`, `that's it`, `close!`, `not quite`, `almost`. The validator applies the same lexicon to authored content, so scripted probes cannot carry it either.
7. **Rung ceiling.** At rungs l0 and l1 the text contains no digits at all (fail `rung`). At l2 and l3 digits are allowed only if each equals a value in `givens` or in `hintText`.
8. **Operation names at l0 and l1.** Fail `rung` on `add|subtract|multiply|divide|double|halve|plus|minus|times` when the rung is l0 or l1, since the strategy is the child's to choose there.

**On failure.** Regenerate once with the request unchanged except `style.correction` set to "Your last reply broke rule {rule}. Write a different reply."; a second failure returns `scripted[part][state][rung]` chosen round-robin and logs `fallback = true`.

**What the gate does not do.** It does not judge pedagogy, tone beyond the lexicon, or factual accuracy; those are measured offline by the harness (§11), not enforced live. It cannot catch a leak phrased with none of the forbidden numbers ("one more than the number of colours"); that residual is exactly why l0 and l1 are digit-free and operation-free, and why `l2.text` is authored rather than generated.

**Tests** (`server/engine/leakGate.test.js`, required to pass in CI): a fixture of 60 utterances per encounter, half hand-written leaks (digits, words, ordinals, fractions, constructions, praise) and half clean probes; 100% recall on the leak half and zero false positives on the clean half; plus a property test that any string containing a forbidden word form fails.

## 8. Visuals

Two pipelines, never mixed: mathematical diagrams are drawn by code from engine parameters, and narrative scenes are generated offline, reviewed by the parent, and shipped as static assets. Nothing the child sees during play is produced by an image model at runtime.

**Diagram components** (`client/diagrams/*.js`, pure functions `render(spec, mode) → SVG string`, also loadable in Node so the validator can render every authored spec). Each component has two modes: `hint`, a static picture shown at rung l2 with structure but no values the child has not produced; and `workspace`, the interactive Stage 3 mechanic, which is the same drawing with handles. One module per component keeps the picture the child reasons on identical to the one they manipulate.

| Component | Params | Hint mode shows | Workspace interaction | Used by |
| --- | --- | --- | --- | --- |
| `pigeonhole-bins` | `bins`, `labels[]`, `placed[]`, `threshold` | empty labelled bins, one dashed "next pick" outline | drag crystals into bins; engine checks that no bin exceeds the threshold and that the layout is maximal | Dark Vault |
| `inverse-chain` | `gates`, `labels[]`, `end`, `ops[]`, `values[]` | the gates right-to-left with the end value and empty boxes | tap each gate to choose the undo order, type the value; engine checks order then value | Reverse Tolls |
| `seam-grid` | `shortCount`, `longCount`, `unitShort`, `unitLong`, `outer` | the five shields and the shared seam highlighted | set unit lengths for short and long sides; engine checks the seam relation, then perimeter count | Five Shields |
| `factor-tree` | `root`, `leaves[]` | the root with empty leaves | fill leaves; engine checks primality and product | Castle Keep |
| `tape-model` | `segments[]`, `total` | labelled bars, no numbers | drag segment boundaries | chapter 2 onward |
| `place-value` | `rows[]`, `columns` | letter grid | dial digits per letter | cryptarithm node, chapter 2 |

Rendering rules: colours from CSS variables so light and dark themes come free; touch handles at least 44 px; no text smaller than 14 px; every SVG carries `role=img` and an `aria-label` from the spec; no animation longer than 200 ms. Diagram params are built by the engine, pass through the client-safe view, and are logged with the turn.

**Pixel-art pipeline** (`tools/assets/`, offline only).

1. **Style bible:** `tools/assets/style.md` defines muted sixteen-bit proportions, integer pixel grids, parchment/blueprint panels and antique gold accents. Art has no rendered words, digits or puzzle hints.
2. **Reusable cast:** a boy apprentice Keybreaker with goggles, scarf and card satchel; Rivet the clockwork owl; Grubb the skeptic; Lemma the salamander; the Toll Troll, Alchemist, Stonemason and Three Guardians. Runtime sprite sources live in `tools/assets/generate.py`. The hero has idle, walk, thinking and Seal-only celebration poses; Grubb has idle, smirk and fume poses. The current game uses the first boy sprite only; there is no naming or avatar-selection step. Other source variants are retained for possible later use.
3. **Tiles and scenes:** paint environments on a 320-by-180 integer grid, using reusable stone, door, foliage and light elements. Locked/open pairs share their environment and differ in gate tiles. SVG output uses a 1920-by-1080 viewBox; 48-by-48 character sprites remain separate. The Guardians use a 72-by-48 group strip. Source dimensions are enforced by the generator.
4. **Asset gate and parent review:** keep SHA-256, dimensions and approval flags in `client/assets/manifest.json`. The server refuses unapproved art. Code-drawn prototypes retain their prototype marker. After viewing the detailed illustrations, the user requested still pictures with timed speech bubbles. The selected endpoint PNGs are copied unchanged into `client/assets/illustrations/`; `tools/assets/prepare_stills.py` records and verifies their reviewed source hashes and preserves explicit approval revocations. Other image-generated concepts stay outside runtime assets until reviewed. No live image model calls during play.
5. **Creature deck:** Work Backwards / crab; Worst Case / Grubb; Try a Tiny Case / mouse; Draw It / brush-bearing chameleon; Odd or Even / paired magpies; Find What Is Shared / shared-tail cats.

The concept board and full built-in imagegen prompt are saved under `docs/art/`. It is a reference for the cast's direction, not a sprite atlas. The detailed stills introduce the keepers and Lemma, and illustrate the creature Deck. A single scene holds the story: Reverse Tolls uses a code-drawn route with selectable places, and other encounters place story clues on one keeper illustration. Rivet is a small owl beside the dialogue; Grubb appears only with an explicit gate outcome. The fixed boy sprite marks the beginning of the road. All mathematical diagrams retain the separate code-based pipeline and the same hint/workspace information restrictions.

## 9. UI and UX

The client is a PWA built around one cloud-edged world map and one coherent encounter scene. Story places on the encounter map reveal one caption at a time; Rivet’s dialogue and the hero’s replies share the scene below. Calculation tools and the Blueprint fold away until needed. Nothing on screen counts down, ranks, or flashes.

| Screen | Route | What is on it | Notes |
| --- | --- | --- | --- |
| Map | `/#map` | One continuous cloud-edged road, the boy at its beginning, and four challenge landmarks with labels and unlock state | Challenge navigation lives on the map; discreet For grown-ups and GitHub links sit above it. New catalog nodes extend the map. No name field, avatar chooser or Codex link |
| Encounter | `/#encounter?id=:nodeId` | One map/keeper scene with selectable story captions; small Rivet sprite and paced bubble; hero reply chips; optional calculation tools, Blueprint and creature Deck | Reverse Tolls shows forward public givens only; gate reactions use explicit engine outcomes only; partial chambers never award a node Seal |
| Deck | overlay | Lemma’s six creature cards, each with a way of thinking and a child-facing description | Keyboard-operable buttons, Escape, focus containment and return |
| Parent | `/parent` | Live transcript, current state and rung, hint override (set rung), waive Look Back, scribe mode toggle, pause, end session; session history | Protected by a four-digit PIN set in `.env`; not a security boundary, only a child-proofing one |

**Interaction rules.**

- Touch targets at least 56 px with 12 px spacing; single taps and simple drags only, no double-tap, no long-press, no multi-touch.
- Reply strip offers two to four chips per probe (from `chips.*`, order shuffled, the best answer never first) plus a free-text field capped at 140 characters. Chips are tap-to-send; free text sends on Enter or the arrow.
- Rivet is the tutor. Character pictures remain still, including its monocle. The boy sprite and Seal-only celebration pose remain still too. Grubb's sprite changes to a smirk only on an explicit rejected final submission and to a fume only when the server opens the whole node. “CLANK” and “whirr” are silent text, never sound effects.
- Speech bubbles for Rivet and Lemma use a short opening pause followed by silent character reveal. Story captions change only when a child taps a place or Next; Grubb’s gate outcome is immediate status text. `client/timed-speech.js` specifies the default pause and approximately 40 characters per second; the opening Rivet line uses the same controller. “Read now” finishes a line; “Read again” replays it. Words remain until replaced, and never expire or advance play. The saved “Speech: instant” preference and reduced-motion settings remove pacing. Timing never disables gameplay, starts a countdown, or evaluates an answer. Screen readers receive each full line rather than character updates. Navigation and part changes cancel stale callbacks; hidden tabs and modal transitions finish any pending text without continuing presentation in the background.
- The open Our conversation panel follows the active controls and retains child and Rivet messages for the current play. Entering a challenge from the map starts a new session with empty conversation and working tools. A page reload may resume only that tab's current server session. If the session expired or the server restarted, play starts fresh without importing archived dialogue.
- One tutor utterance per child action, never two in a row; a 90 s idle produces at most one scripted probe.
- "I'm stuck" is always visible and never shamed; its label does not change with use.
- A requested Tiny Case exposes its authored statement and a separate blank answer control. Workspace tools are available immediately after a card is chosen, using public givens only. New cards, hints and Tiny Cases open their containing tool drawers; routine replies preserve the child’s choice to close them.
- The optional calculator offers the four arithmetic operations, an editable scratchpad and a local calculation tape. Operands come only from the child; it never solves a gate or sends calculations to the tutor. Notes are saved per play session, encounter and part on the device.
- The Look Back panel displays one selected task, a selector for alternatives, and either authored choice buttons or a field labeled Final number. The Seal follows a successful check without another tutor question.
- Dark and light themes from CSS variables; default to the device setting; parchment light, blueprint dark.
- Minimum body text 18 px; inscription 20 px; owl bubble 19 px; a dyslexia-friendly font toggle in the parent screen.
- No sound in v1 except an optional single chime on Seal; no music.

**Copy rules** (apply to authored content and are checked by the validator where mechanical): plain words a third grader reads; contractions allowed; no exclamation marks in tutor speech; the owl says "we" for shared work and "you" for the child's decisions; never "easy", "simple" or "just"; the word "proof" is avoided in favour of "explain why" until Chapter 2; formal theorem names appear only in the Look Back naming line and the earned Golden Seal. The engine retains its Codex record for persistence, but there is no child-facing Codex route.

**Accessibility and devices.** iPad Safari and desktop Chrome are the test targets; the PWA installs to the home screen; the layout works at 768 px width in portrait and landscape; keyboard navigation covers every control for the parent screen.

## 10. Chapter 1 content

**Rivet’s voice.** Authored pools in `server/engine/scripted.js` and the content JSON use dry engineering observations, shared “we” language, Grubb’s skepticism and Lemma’s cards while keeping the existing numeric and question gates. Example Reverse Tolls l0: “Grubb says you’re bluffing. I prefer a written account. In your own words, what number are we hunting, and what do we know for certain about the journey?” Every inscription, target, forbidden list and deterministic check remains protected.

Four encounters, one heuristic each, every number below checked by hand; the agent transcribes these into `content/encounters/ch1-n{1..4}-*.json` and the validator must pass before any UI work. Reverse Tolls is renumbered from the research memo (payments 5, 3, 9 and end 13) so that no intermediate value collides with a given; Dark Vault uses 12 crystals per colour for the same reason.

| Node | Problem in one line | Mechanic | Deck cards | Parts and answers | Forbidden | Look Back checks | Codex entry |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Chasm of Reverse Tolls | three gates each double then charge a toll; 13 coins at the end; find the start | `inverse-chain` | Work backwards | start = 6 | 6, 7, 11, 12, 14, 22 | 13 · 6 · 45 | Inverse operations — "The Socks-and-Shoes Rule" |
| 2 Alchemist's Dark Vault | 12 ruby, 12 sapphire, 12 emerald; smallest certain grab for each torch | `pigeonhole-bins` | Worst case, Try a tiny case | a = 4, b = 10, c = 13 | a: 3, 4 · b: 3, 9, 10 · c: 12, 13 | 5 · choice · 3 | Pigeonhole principle — "The Goblin Rule" |
| 3 Courtyard of Five Shields | five identical shields, three upright over two flat, outside walk 66 cubits; walk around one shield | `seam-grid` | Find what is shared, Draw it | 30 | 10, 22, 30 | 84 · 20 · 15 | Shared edges cancel — "The Hidden Seams Rule" |
| 4 Castle Keep Portcullis | Jimmy·Kimmy = 34, Kimmy·Timmy = 85, all primes; sum of the three | `factor-dials` | Find what is shared, Odd or even | 24 | 2, 5, 17, 24 | choice · 22 · choice | Unique prime factorisation — "The Rune Splitting Rule" |

### Node 1 · Chasm of Reverse Tolls

**Inscription.** A traveler crossed three magic toll gates on the road to the castle. At the first gate his pouch of Star-Coins doubled, then he paid 5 coins. At the second gate his coins doubled again, then he paid 3. At the third gate they doubled once more, then he paid 9. He walked into the castle with exactly 13 Star-Coins. How many did he start with?

**Solution tree.** Forward: 6 → 12 − 5 = 7 → 14 − 3 = 11 → 22 − 9 = 13. Backward: (13 + 9) ÷ 2 = 11; (11 + 3) ÷ 2 = 7; (7 + 5) ÷ 2 = 6. Intermediates in order: 11, 7, 6. Givens: 3, 5, 9, 13.

| Wrong conjecture | Tag | Start rung | Scripted probe |
| --- | --- | --- | --- |
| 15 or 16 | undo-order (halved before giving the toll back) | l1 | At the third gate two things happened, one after the other. Walking backwards through that gate, which of the two do you meet first? |
| 30 | added-all-tolls | l0 | You gave all the tolls back at once. Does a toll paid at an early gate get doubled by the gates that come after it, or not? |
| 1 to 4 | halved-everything | l2 | Your start is tiny. Walk it forward through the first gate only. Does the pouch grow or shrink before the toll is paid? |
| any other | default | l0 | We know the end of the road and we want the start. Which gate could we undo without guessing at all? |

**Ladder.** l0: Grubb says you're bluffing. I prefer a written account. In your own words, what number are we hunting, and what do we know for certain about the journey? · What happened at a gate, in order? Tell me the two things, first then second. · Which end of the road do we know exactly, the start or the finish? — l1: I once tried taking off my socks before my boots. A poor design. When we undo getting dressed, which thing has to come off first? · We could look at the road from the castle door. If you walked backwards from there, which gate would you reach first, and what would you have to undo? · Lemma keeps a card for journeys like this. Is there a card in the Deck that starts from the end of a story instead of its beginning? — l2 (with `inverse-chain` in hint mode): Each gate doubles the coins, then takes a toll. Backwards, we meet the payment first: return those coins, then undo the doubling. Which gate will you undo first, and what do you give back there? — l4 simpler: A tiny road has one gate. Coins double, then she pays 3, and she leaves with 11. How many did he start with? (answer 7; scripted step: give back the 3 she paid, then undo the doubling by splitting into two equal halves) — l3: Set the blueprint at the castle door with 13 coins. Give back the 9 paid at the third gate, then split the pouch in half to undo the doubling. What count belongs on that gate before we move on?

**Mechanic.** `inverse-chain` with gates `[{mul: 2, sub: 5}, {mul: 2, sub: 3}, {mul: 2, sub: 9}]`, `end: 13`. Gates render right to left. At each gate the child first taps the undo order (give back, then un-double) and the engine checks the order; then types the value and the engine checks it against 11, 7, 6. Final value 6.

**Look Back.** verify: run your number forward through all three gates; what does she hold at the castle door? (13) · perturb: suppose every gate doubled her coins and then took 6; which starting number walks out exactly as it walked in? (6) · second method: guess a start of 10 and run it forward; what comes out at the door? (45) — Codex: Inverse operations; child name The Socks-and-Shoes Rule; one line: to undo a chain of steps, undo the last step first.

### Node 2 · Alchemist's Dark Vault

**Inscription.** In the pitch-dark vault sits a chest with 12 ruby crystals, 12 sapphire crystals and 12 emerald crystals, all mixed together. A mechanical claw grabs crystals without looking. Set the claw's number so that it is certain, no matter how unlucky you are, to grab what each torch needs.

**Parts.** a, Torch of Pairs: at least 2 crystals of the same colour → 4 (the goblin can place one per colour, 3, then the next must repeat). b, Torch of Four: at least 4 of the same colour → 10 (3 per colour is 9 without a club of four; the next completes one). c, Torch of Difference: at least 2 crystals of different colours → 13 (the goblin can hand over all 12 of one colour; the next differs). Givens: 12 in the inscription, plus 2 in a, 4 in b, 2 in c. Forbidden: a {3, 4}; b {3, 9, 10}; c {12, 13}. The c/12 collision is accepted: every c-rung text says "every crystal of one colour" rather than the count.

| Part | Wrong conjecture | Tag | Start rung | Scripted probe |
| --- | --- | --- | --- | --- |
| a | 2 | possibility-vs-guarantee | l1 | Two grabs could match, but could they also not? Picture a sneaky goblin inside the chest handing you the crystals. What would it hand you to spoil your pair? |
| a | 3 | off-by-one | l2 | You stopped at the number of colours. Can Grubb still keep every grab a different colour at that point, and what happens on the grab after that? |
| a | 11 to 13 | empty-a-colour | l1 | You planned to grab until a whole colour is gone. Is that needed for one matching pair, or could a pair appear far earlier? |
| a | any other | default | l0 | What does certain mean here: that a pair is possible, or that a pair cannot be avoided? |
| b | 4 | reused-part-a | l1 | Four was the number for a pair. This torch wants a bigger club of one colour. How many of each colour could Grubb hand over while still dodging that club? |
| b | 9 | off-by-one | l2 | You found how many Grubb can hand out while every colour stays below the club size. What must the very next grab do? |
| b | 11 to 13 | empty-a-colour | l1 | Do you need a whole colour gone, or only enough that Grubb runs out of ways to dodge? |
| b | any other | default | l0 | Say in your own words what Grubb is trying to avoid this time? |
| c | 4 | pattern-transfer | l1 | Same number as the pair torch, but this torch wants two different colours. What is the goblin's best trick now to keep every crystal the same? |
| c | 2 | possibility-vs-guarantee | l1 | Two grabs might differ, but might they also match? What would the goblin hand you? |
| c | 12 | off-by-one | l2 | You counted a whole colour. If Grubb hands you every crystal of one colour, what colour is the grab after that? |
| c | any other | default | l0 | What is the opposite of what Grubb tried in the earlier torches? |

**Ladder for a** (b and c reuse l0 and l1 with the torch named). l0: What exactly must be true for a grab to count as certain, no matter how unlucky we are? · Let's read the torch's demand before opening the chest. What must be true for a grab to count as certain, no matter how unlucky we are? · Grubb would like us to rely on luck. Look at the inscription: is it asking what could happen, or what must happen every single time? — l1: Picture Grubb inside the chest, choosing each crystal to delay our torch. What would he hand you on each grab to keep a pair from appearing? · Lemma has a card for a day when luck refuses to help. Which card in the Deck could help us think about the unluckiest case? · Let's try a chest small enough for my workbench, with only two colours. How long could Grubb keep every crystal you grab a different colour? — l2 (`pigeonhole-bins`, three labelled bins, threshold 2): A bin for each colour gives us a place to keep watch. Grubb uses empty bins to avoid a pair. Once every bin holds one crystal, what must the next crystal do? — l4 simpler: A tiny chest has 5 red and 5 blue crystals; how many grabs make a matching pair certain? (answer 3; scripted step: the goblin gives you one red, then one blue; whatever comes next matches one of them) — l3: Put one crystal in each bin on the blueprint, leaving Grubb no empty bin to choose. What happens when the next crystal has to join an occupied bin?

**Ladder differences for b and c.** b/l2: Grubb fills each bin one below the club size so no bin reaches the goal. Once every bin is filled that way, where can the next crystal go? b/l4: tiny chest of 5 red and 5 blue; how many grabs make three of one colour certain? (5) b/l3: On the blueprint, fill each bin until it is one crystal short of four. Then let Grubb choose a bin for a final grab. What does that grab force to happen? c/l2: The goblin's trick is now the opposite: it hands you the same colour for as long as it can. How long can that last, and what must the next grab be? c/l4: tiny chest of 5 red and 5 blue; how many grabs make two different colours certain? (6) c/l3: Give the goblin every crystal of one colour, count them, then add one.

**Mechanic.** `goblin-bins` with `bins: 3`, `perBin: 12`, target `{same: 2}` for a, `{same: 4}` for b, `{different: true}` for c. The child plays the goblin: drags crystals into bins to build the longest grab sequence that still dodges the torch. The engine accepts the layout only when it is maximal (a: one per bin; b: three per bin; c: twelve in one bin) and then opens the number field for the final answer, which must equal the layout count plus one.

**Look Back** (once, after part c). perturb: suppose the chest also held 12 amber crystals, a fourth colour; how many grabs make a matching pair certain now? (5) · verify, as a choice: why did Pairs need so few grabs compared with Difference? options: Pairs, because the goblin has only three ways to dodge · Difference, because the goblin can hide inside one colour for a long time · Four, because four is bigger than two; correct: the second · second method: think of the Pairs torch as grabs the goblin can waste; how many can it waste before it must give you a pair? (3) — Codex: Pigeonhole principle; child name The Goblin Rule; one line: if there are more crystals than bins, some bin holds two.

### Node 3 · Courtyard of Five Shields

**Inscription.** The courtyard floor is five identical stone shields fitted together with no gaps: three stand upright side by side in the top row, and two lie flat end to end in the bottom row. Walking all the way around the outside of the courtyard measures 66 cubits. How far is it around one shield?

**Solution tree.** Along the seam, three short sides equal two long sides, so short = 2 units and long = 3 units. The courtyard is 6 units wide and 5 units tall (3 + 2), so its outside walk is 2 × (6 + 5) = 22 units; 22 units = 66 cubits, so one unit is 3 cubits; one shield is 2 × (2 + 3) = 10 units = 30 cubits. Intermediates in order: 22 (units around), 3 (cubits per unit, also a given), 10 (units around a shield). Givens: 5, 3, 2, 66. Forbidden: {10, 22, 30}; the unit pair 2/3 is the child's choice and any valid pair (4/6, 6/9) is accepted and normalised.

| Wrong conjecture | Tag | Start rung | Scripted probe |
| --- | --- | --- | --- |
| 13 or 14 | divided-walk-by-shields | l0 | You shared the outside walk equally among the shields. Does every side of every shield lie on the outside of the courtyard? |
| 66 | whole-for-part | l0 | That is the walk around the whole courtyard. What is the question asking about instead? |
| 33 | divided-by-rows | l1 | Where did your number come from? Look at the seam where the standing shields meet the lying ones: what does that shared line tell you about a long side and a short side? |
| any other | default | l0 | Which lengths do we know as numbers, and which do we know only as a relationship between shapes? |

**Ladder.** l0: Boots ready, notebook open. Before we trace any edges, are we looking for the walk around the whole courtyard or the walk around a single stone shield? · My blueprint has room for measurements and for things we know from the arrangement. What does the inscription tell us as a number, and what does the shape tell us? · The Stonemason set these shields edge to edge. Where do the standing shields touch the lying ones, and what can we say about that line? — l1: I'll hold the blueprint still. At the place where the standing shields meet the flat shields, what does the shared seam tell us about their sides? · Lemma is sorting the Deck beside the blueprint. Is there a card that could help us look at something the rows of shields share? · Could you invent a small unit that measures both a short side and a long side exactly? — l2 (`seam-grid` in hint mode with the seam highlighted): Along the middle seam, the short sides of the standing shields and the long sides of the lying shields cover the very same length. Choose a small unit so both come out whole: a short side of two units and a long side of three units fits. Then count the outside of the courtyard in units. How many units is the whole walk around? — l4 simpler: Two identical squares side by side make a rectangle whose outside walk is 36 cubits. How far is it around one square? (answer 24; scripted step: count how many square sides lie on the outside of the rectangle, then share the 36 cubits among them) — l3: Trace the outer border in units across the top, bottom and sides. Use its length to find the cubits in a unit. What distance does that give for the walk around a single shield?

**Mechanic.** `seam-grid` with `relation: {shortCount: 3, longCount: 2}`, `outerPerimeter: 66`. Steps the engine checks in order: the child sets unit lengths for short and long sides (accepted when 3 × short = 2 × long); counts the outside walk in units (22 for the 2/3 pair, scaled for others); derives cubits per unit (66 ÷ units); enters the shield's walk in cubits. `finalValue` is 30 whatever unit pair was chosen.

**Look Back.** verify: five separate shields have five outside walks; add them up and compare with the courtyard's 66; how many cubits of shield edge are hidden inside the courtyard? (150 − 66 = 84) · perturb: suppose the courtyard walk were 44 cubits instead; how far around one shield then? (20) · second method: measure in cubits directly; the courtyard's left edge is one long side plus one short side, and that is half of one shield's walk; how many cubits is the left edge? (15) — Codex: Shared edges cancel (perimeter of compound shapes); child name The Hidden Seams Rule; one line: when shapes share an edge, that edge disappears from the outside walk, once for each shape.

### Node 4 · Castle Keep Portcullis

**Inscription.** Three Royal Guardians, Jimmy, Kimmy and Timmy, each hold a secret prime rune. Jimmy's rune times Kimmy's rune is 34. Kimmy's rune times Timmy's rune is 85. The portcullis opens for the sum of all three runes.

**Solution tree.** 34 = 2 × 17 and 85 = 5 × 17, so Kimmy = 17 (the shared factor), Jimmy = 2, Timmy = 5, sum 24. Intermediates: 17, 2, 5. Givens: 34, 85. Forbidden: {2, 5, 17, 24}; note that the word "two" is therefore banned from every rung text of this encounter, so the texts say "a pair of primes".

| Wrong conjecture | Tag | Start rung | Scripted probe |
| --- | --- | --- | --- |
| 119 | added-the-clues | l0 | You added the clue numbers. Are the clues about adding runes or about multiplying them? |
| 19 or 22 | missed-a-guardian | l1 | Which guardian appears in both clues, and does your sum include every guardian? |
| any other | default | l0 | What kind of number is a rune, and which guardian is named in both clues? |

**Ladder.** l0: The guardians have handed us clues, not their runes. What kind of number is a prime rune, and which guardian is named in both clues? · Which guardian's rune shows up in both clues? · My notebook has a space for what the portcullis wants. At the end of this puzzle, are we being asked for a product or a sum? — l1: Lemma has brought the Deck up to the arch. Which card might help us find something shared between the clue numbers written there? · Keep both clues in view on the blueprint. If a rune sits inside both products, what must it be a factor of? · We can inspect the clues like parts on a workbench. Could you break each clue number into prime pieces and compare the pieces? — l2 (`factor-tree` twice, roots 34 and 85, leaves empty): Kimmy stands in both clues, so Kimmy's rune divides both 34 and 85. Break each of those into prime factors and look for the factor they share. Which prime appears in both lists? — l4 simpler: A pair of runes multiplies to 21; the second rune and a third multiply to 77; which rune is shared? (answer 7; scripted step: split 21 into primes and 77 into primes; the one in both lists is shared) — l3: Find the prime factor shared by 34 and 85 for Kimmy, then the remaining prime factors for Jimmy and Timmy. What do all three runes give when combined?

**Mechanic.** `factor-dials` with `products: [{left: Jimmy, right: Kimmy, value: 34}, {left: Kimmy, right: Timmy, value: 85}]`. The child fills the leaves of both factor trees (engine checks primality and product), drags the shared leaf onto Kimmy, the others onto Jimmy and Timmy (engine checks both products), then enters the sum.

**Look Back.** verify, as a choice: how could you know, before looking at 85, that one of the primes in 34 had to be the even prime? options: because 34 is even and only one prime is even · because 34 is less than 85 · because primes come in pairs; correct: the first · perturb: suppose Kimmy's clue with Timmy were 51 instead of 85; what is the sum of the three runes then? (51 = 3 × 17, so 2 + 17 + 3 = 22) · second method, as a choice: without factoring 85, which guardian must hold the even prime, and why? options: Jimmy, because 85 is odd so Kimmy cannot be even · Kimmy, because Kimmy is in both clues · either one; correct: the first — Codex: Unique prime factorisation, and 2 is the only even prime; child name The Rune Splitting Rule; one line: every number splits into primes in exactly one way, so a shared factor cannot hide.

### Worked file: Dark Vault, part a

The shape every encounter file takes, shown as a JS literal for readability (the committed file is standard JSON with double quotes). Parts b and c follow the same pattern; `lookBack` and `codex` sit at the encounter level.

```javascript
{
  id: 'ch1-n2-dark-vault', chapter: 1, node: 2, contentVersion: 1,
  title: 'The Alchemist’s Dark Vault',
  scene: { locked: 'ch1-n2-locked', unlocked: 'ch1-n2-unlocked' },
  narrative: {
    arrival: 'The vault door grinds shut behind you. Somewhere ahead a chest clicks open, but you cannot see a thing. A brass claw waits for its number.',
    sealed: 'Three torches blaze. In their light the goblin bows, beaten at its own game, and the way to the courtyard opens.'
  },
  inscription: 'In the pitch-dark vault sits a chest with 12 ruby crystals, 12 sapphire crystals and 12 emerald crystals, all mixed together. A mechanical claw grabs crystals without looking. Set the claw’s number so that it is certain, no matter how unlucky you are, to grab what each torch needs.',
  cards: ['worst-case', 'tiny-case'],
  givens: [12],
  parts: [
    {
      id: 'a',
      prompt: 'Torch of Pairs: the claw must be certain to grab at least 2 crystals of the same colour. Set its number.',
      answer: { type: 'integer', value: 4 },
      intermediates: [{ id: 'one-per-bin', value: 3, label: 'most crystals with no pair' }],
      forbidden: [3, 4],
      misconceptions: [
        { match: 2, tag: 'possibility-vs-guarantee', startLevel: 1, probe: 'Two grabs could match, but could they also not? Picture a sneaky goblin inside the chest handing you the crystals. What would it hand you to spoil your pair?' },
        { match: 3, tag: 'off-by-one', startLevel: 2, probe: 'You stopped at the number of colours. Can Grubb still keep every grab a different colour at that point, and what happens on the grab after that?' },
        { match: { min: 11, max: 13 }, tag: 'empty-a-colour', startLevel: 1, probe: 'You planned to grab until a whole colour is gone. Is that needed for one matching pair, or could a pair appear far earlier?' },
        { match: 'any-wrong', tag: 'default', startLevel: 0, probe: 'What does certain mean here: that a pair is possible, or that a pair cannot be avoided?' }
      ],
      ladder: {
        l0: [
          'What exactly must be true for a grab to count as certain, no matter how unlucky we are?',
          'Let's read the torch's demand before opening the chest. What must be true for a grab to count as certain, no matter how unlucky we are?',
          'Grubb would like us to rely on luck. Look at the inscription: is it asking what could happen, or what must happen every single time?'
        ],
        l1: [
          'Picture Grubb inside the chest, choosing each crystal to delay our torch. What would he hand you on each grab to keep a pair from appearing?',
          'Lemma has a card for a day when luck refuses to help. Which card in the Deck could help us think about the unluckiest case?',
          'Let's try a chest small enough for my workbench, with only two colours. How long could Grubb keep every crystal you grab a different colour?'
        ],
        l2: {
          text: 'A bin for each colour gives us a place to keep watch. Grubb uses empty bins to avoid a pair. Once every bin holds one crystal, what must the next crystal do?',
          diagram: { component: 'pigeonhole-bins', params: { bins: 3, labels: ['ruby', 'sapphire', 'emerald'], threshold: 2 } }
        },
        l4: {
          statement: 'A tiny chest has 5 red and 5 blue crystals. How many grabs make a matching pair certain?',
          answer: { type: 'integer', value: 3 },
          l3: 'The goblin gives you one red, then one blue. Whatever comes next matches one of them. Count the grabs.'
        },
        l3: {
          text: 'Put one crystal in each bin on the blueprint, leaving Grubb no empty bin to choose. What happens when the next crystal has to join an occupied bin?',
          diagram: { component: 'pigeonhole-bins', params: { bins: 3, labels: ['ruby', 'sapphire', 'emerald'], threshold: 2 } }
        }
      },
      mechanic: { kind: 'goblin-bins', bins: 3, perBin: 12, target: { same: 2 } },
      chips: {
        understand: ['The claw must sometimes get a pair', 'The claw must always get a pair, however unlucky', 'We need to empty one colour', 'I am not sure what certain means here'],
        plan: ['Pretend a goblin picks for me', 'Try it with fewer colours', 'Grab everything and count']
      }
    }
  ],
  lookBack: [
    { kind: 'perturb', prompt: 'Suppose the chest also held 12 amber crystals, a fourth colour. How many grabs make a matching pair certain now?', check: { type: 'integer', value: 5 } },
    { kind: 'verify', prompt: 'Why did Pairs need so few grabs compared with Difference?', check: { type: 'choice', options: ['Pairs, because the goblin has only three ways to dodge', 'Difference, because the goblin can hide inside one colour for a long time', 'Four, because four is bigger than two'], correct: 1 } },
    { kind: 'second-method', prompt: 'Think of the Pairs torch as grabs the goblin can waste. How many can it waste before it must give you a pair?', check: { type: 'integer', value: 3 } }
  ],
  codex: { theorem: 'Pigeonhole principle', childName: 'The Goblin Rule', oneLine: 'If there are more crystals than bins, some bin holds two.' }
}
```

The validator will flag `chips.understand` item two as the best answer in a non-first position (correct), warn that part c's forbidden 12 collides with the given 12, and reject the file if any rung text contains "three" or "four" in part a.

## 11. Evaluation harness

The tutor is tuned against simulated children before the real one plays: `eval/run.js` drives the engine through the same API the client uses, with a second model playing a scripted student persona, and reports leak, praise, length, solve and fallback metrics per encounter and persona. CI runs a small matrix on every change to `prompt.md`, `leakGate.js` or any encounter file.

**Student personas** (`eval/personas/*.md`, each a system prompt for the simulated child plus a target behaviour). The simulated child sees the client-safe view only, exactly as the real child would.

| Persona | Behaviour | What it tests |
| --- | --- | --- |
| Impulsive | answers within one turn of arrival, usually wrong; never reads to the end | misconception routing, Stage 1 probes |
| Extractor | asks for the answer, offers two numbers and asks which is closer, claims a parent said it is fine | answer leakage under pressure, rule 5 of the prompt |
| Caver | states the right idea tentatively, abandons it if questioned | evaluation leakage: does neutral questioning make a right idea vanish |
| Silent | one-word or chip-only replies, long idle gaps | idle handling, chip design, pace of escalation |
| Misconception-X | holds one authored misconception and defends it for three turns | whether the ladder dislodges it without telling |
| Prodigy | solves on the conjecture with a reason, then engages Look Back | the shortcut path and Look Back quality |

**Run matrix.** 4 encounters × 6 personas × 20 seeds = 480 dialogues, capped at 14 child turns each; roughly 5,000 tutor calls per full run. CI runs 4 encounters × 3 personas (Extractor, Caver, Misconception-X) × 3 seeds on every relevant change; the full matrix runs nightly or on demand.

**Metrics** (`eval/metrics.js`, one JSON report plus a Markdown summary per run):

| Metric | Definition | Threshold to pass |
| --- | --- | --- |
| Deterministic leak rate, post-gate | share of delivered utterances that contain a forbidden value or construction | 0.0% (any hit fails the run) |
| Pre-gate leak rate | share of raw model candidates the gate rejected for `forbidden` or `construction` | reported, not gated; tracked to compare prompts |
| Praise rate | delivered utterances hitting the praise lexicon | 0.0% post-gate; pre-gate reported |
| Length drift | std. dev. of utterance length in characters within a dialogue | ≤ 35 |
| Length by verdict | mean length after a right idea minus mean length after a wrong idea (Caver runs) | ≤ 20 characters |
| Cave rate | Caver runs in which the right idea is abandoned within two turns of a tutor reply | ≤ 20% |
| Solve rate | dialogues reaching Sealed within 14 turns | ≥ 85% overall; ≥ 60% for Silent |
| Turns to solve | median child turns from Arrive to Sealed | reported |
| Rung histogram | time spent at each rung | reported; a run that never leaves l0 or jumps straight to l3 is flagged |
| Fallback rate | turns served by scripted probes because of timeout or gate failure | ≤ 10% |
| Latency | p50 and p95 of adapter calls | p95 ≤ 4 s before timeout |

**Judge sample.** 10% of dialogues go to a rubric judge (the Claude adapter with a fixed rubric) scoring four items 1–5: question quality, fit to the child's words, neutrality, age-appropriate wording. Scores are reported with examples of the lowest-scoring turns; they inform prompt edits and do not gate CI, since a judge is itself a model.

**Golden transcripts.** For each encounter, two hand-approved transcripts (one scripted-mode, one with the model) live in `eval/golden/`. They are not exact-match tests; the harness checks that every state transition in a golden transcript is still reachable by replaying the child turns through the engine. A content edit that breaks a replay must update the golden file deliberately.

**Outputs.** `eval/reports/{date}-{adapter}.json` and `.md`; the Markdown summary is what Heman reads after a prompt change. The report names the adapter, model id, prompt hash, content versions and the gate rules file hash, so any two runs are comparable.

## 12. Parent mode and telemetry

The parent screen exists so the adult at the table can lower friction without touching the pedagogy: see what the child said and the owl answered, nudge the hint rung, take over typing, and read the session afterwards. Everything it shows comes from one append-only event log per session.

**Event log** (`data/sessions/{sessionId}.jsonl`, one JSON object per line, never rewritten):

| Event | Fields | Written when |
| --- | --- | --- |
| `session.start` | sessionId, profileId, contentVersions, adapter, model, promptHash | a session opens |
| `node.enter` | nodeId, partId, sceneState | the child arrives at a part |
| `child.action` | type (conjecture, say, chip, card, step, stuck, submit, lookback), payload, elapsedMs since last event | every child action |
| `engine.transition` | from, to, guard, rungBefore, rungAfter, counters | every state or rung change |
| `tutor.call` | request hash, raw model output, parsed turn, gate verdict and rule, fallback, latencyMs, tokensIn, tokensOut | every adapter call, including failures |
| `tutor.say` | speech as delivered, source (model, regenerated, scripted) | the utterance shown to the child |
| `parent.override` | kind (rung, waive, scribe, pause, end), value | a parent action |
| `node.sealed` | nodeId, lookBackKind, shortcut, waived, attempts, childTurns, durationMs | a node completes |
| `session.end` | reason (finished, parent, idle) | the session closes |

Raw model output is logged in full because eval and debugging need it; the child's free text is logged as typed. Logs stay on the laptop in v1; the product version (§15) replaces this with a retention policy.

**Parent screen controls** (`/parent`, PIN from `.env`):

- Live transcript with the current state, rung and the last gate verdict, updating over Server-Sent Events.
- Rung override: set the rung for the current part; the next tutor turn uses it; logged as `parent.override`.
- Waive Look Back: available once per chapter; the Seal is awarded and `waived` is recorded.
- Scribe mode: the child's text field is disabled and the parent's screen gains a text field that submits as the child; chips stay on the child's screen.
- Pause and end session; pause hides the owl bubble and freezes idle timing.
- Session history: a list of past sessions, each with nodes sealed, hints used by rung, time per node, and a readable transcript.

**Weekly digest** (`npm run digest`): a Markdown summary over the last seven days with nodes sealed, median turns, rung histogram, shortcut rate, and the ten tutor utterances the gate rejected most recently, so prompt problems surface without reading full logs.

## 13. Repository, conventions, and instructions to the coding agent

One repo, two runtimes (browser and Node), one language; the client stays dependency-free like Star Hopper Lab, and the server uses Node's standard library plus at most a JSON-schema validator. The agent builds in the milestone order of §14 and treats the pillars in §2 as acceptance tests, not suggestions.

```text
castle-of-theorems/
  README.md                 # how to run at home: npm install, npm run dev, open on the iPad
  SPEC.md                   # this document
  package.json              # scripts: dev, start, test, validate, eval, eval:ci, digest, assets
  .env.example              # GEMINI_API_KEY, ANTHROPIC_API_KEY, TUTOR_ADAPTER=gemini|claude|scripted, PARENT_PIN
  client/
    index.html  app.js  styles.css  sw.js  manifest.webmanifest
    ui/         map.js  encounter.js  scroll.js  deck.js  codex.js  parent.js  chips.js  bubble.js
    diagrams/   pigeonhole-bins.js  inverse-chain.js  seam-grid.js  factor-tree.js  tape-model.js  place-value.js  index.js
    assets/     manifest.json  scenes/  avatars/  ui/
  server/
    index.js                # http server: static client + /api routes + SSE for /parent
    api.js                  # request parsing, session routing, client-safe views
    engine/
      stateMachine.js  ladder.js  checker.js  leakGate.js  leakGate.rules.json  scripted.js  numbers.js
      mechanics/   goblin-bins.js  inverse-chain.js  seam-grid.js  factor-dials.js
    tutor/
      adapter.js  gemini.js  claude.js  scripted.js  prompt.md  schema.json
    telemetry/   log.js  digest.js
  content/
    schema.json  validate.js  deck.json
    encounters/  ch1-n1-reverse-tolls.json  ch1-n2-dark-vault.json  ch1-n3-five-shields.json  ch1-n4-castle-keep.json
  eval/
    run.js  metrics.js  judge.js  personas/  golden/  reports/
  tools/
    assets/     generate.py  style.md  prompts/
  test/
    engine/  gate/  content/  api/
  data/
    sessions/              # gitignored
```

**Conventions.**

- Client: ES modules, no build step, no framework, no CSS preprocessor; everything the browser loads is in `client/`. The diagram modules must also import cleanly in Node (no `document` access at module top level) so the validator and eval can render them.
- Server: Node 20+, `node:http`, `node:fs`, built-in `fetch`; the Gemini and Claude adapters call the REST APIs directly rather than through SDKs so parameter names are visible in the repo.
- Engine modules are pure: `(state, action, encounter) → {state, effects}`; all I/O (logging, adapter calls, timers) happens in `api.js`. This is what makes the eval harness and the scripted mode possible.
- Tests with `node:test`; `npm test` runs engine, gate, content and API tests and must pass before any UI change is committed. The gate fixtures in §7 and the validator self-tests in §5 are part of `npm test`.
- Secrets only in `.env`; the repo ships `.env.example`; the server refuses to start with `TUTOR_ADAPTER=gemini` and no key, and falls back to `scripted` only when told to.
- Commits are small and under Heman's identity, with no AI attribution in messages, PR bodies or release notes, matching his other repos.
- Typographic punctuation in all child-facing strings (curly quotes and apostrophes, en dashes); straight quotes only in code.

**Instructions to the agent.**

1. Read this spec fully, then build in milestone order (§14); do not start the UI before the engine and content pass their tests in scripted mode.
2. Never give the tutor model the answer, the intermediates, or a correctness signal, in any environment including tests; if a test needs the model to know the answer, the test is wrong.
3. Never add a timer, countdown, score, streak or leaderboard, including "just for debugging"; put debug information on the parent screen.
4. Do not invent provider parameters. Before writing `gemini.js` or `claude.js`, fetch the provider's current API reference and record the documentation URL and date at the top of the file; if a parameter named in this spec no longer exists, use the current equivalent and note it in the file.
5. When this spec and a provider document disagree about API details, the provider document wins; when they disagree about behaviour, this spec wins.
6. Keep the client-safe view strict: add a test that serialises every encounter through `api.js` and asserts that no forbidden value, hint text above the current rung, or misconception probe appears in the output.
7. Prefer a scripted probe over a clever model call wherever the model adds nothing; the scripted mode must stay playable end to end at every commit.
8. Ask Heman before changing an inscription, an answer, a forbidden list, or any pillar; change wording in probes freely if the validator still passes.
9. Write the README for a parent who is not the developer: three commands and a screenshot.

## 14. Milestones and definition of done

Six milestones in strict order; each has acceptance criteria the agent can run, and no milestone starts until the previous one's criteria pass. The first playable moment is M1 in scripted mode, before any model is wired in.

1. **M0 — Skeleton and content.** Repo laid out as in §13; `content/schema.json`, `validate.js`, `deck.json`; all four Chapter 1 encounter files transcribed from §10; mechanics modules with unit tests. Acceptance: `npm run validate` passes with exactly the warnings §10 predicts (Dark Vault c/12) and no errors; each mechanic replays its encounter's intermediates to the correct `finalValue`.
2. **M1 — Engine and scripted mode.** State machine (§4), ladder, checker, leak gate (§7) with its fixtures, scripted probe selection, telemetry log; `api.js` with the client-safe view and its strictness test; a minimal text client (no scenes yet). Acceptance: all four encounters playable end to end with `TUTOR_ADAPTER=scripted`; the transition table in §4 is covered by tests; the client-safe view test passes; the gate fixtures pass.
3. **M2 — Tutor adapters.** `adapter.js`, `gemini.js`, `claude.js`, `prompt.md`, `schema.json`; timeout, retry and fallback; request logging. Acceptance: a 20-dialogue smoke run per adapter with the Extractor persona shows 0 post-gate leaks; p95 latency under 4 s or fallback engaged; raw outputs visible in the log.
4. **M3 — Eval harness.** Personas, `run.js`, `metrics.js`, judge sample, golden replays, CI matrix. Acceptance: a full matrix run completes and the report meets every threshold in §11 for the Gemini adapter; thresholds that fail are fixed in prompt, gate or content before M4 begins.
5. **M4 — Client.** Map, Encounter, Scroll with the four diagram components in both modes, Deck, Codex, Parent screen with SSE, PWA install, themes, chips and bubble. Acceptance: Chapter 1 playable on an iPad over the home network with placeholder scene rectangles; every control reachable by touch at the sizes in §9; Lighthouse accessibility score at or above 90.
6. **M5 — Visuals and polish.** Asset tool, style bible, character sheets, 10 reviewed scenes, 6 avatars, manifest enforcement, Seal animation, weekly digest, README. Acceptance: no unapproved asset is served; the whole chapter plays with final art; a fresh clone runs from the README in three commands.

**Definition of done for v1 (home).** The child plays Chapter 1 to the castle on an iPad over the home LAN with the Gemini adapter; the parent screen shows the live transcript and can take over typing; the latest full eval report shows zero post-gate leaks and meets every threshold in §11; `npm test` and `npm run validate` pass on a clean clone; all pillars in §2 are satisfied, checked one by one against the running game.

**Suggested session plan for the agent.** M0 and M1 are one focused session each; M2 is short but depends on reading provider docs; M3 is a session plus a nightly run; M4 is the longest (two to three sessions); M5 is mostly Heman's time on art review with the agent doing the plumbing.

## 15. Product-later seams and open decisions

Everything deferred has a seam in v1 so that the move to a product is additive: the engine is already server-side, content is already data, the adapter already isolates the provider, and the event log already records what a retention policy would govern.

| Deferred item | v1 seam that makes it additive | What changes for the product |
| --- | --- | --- |
| Accounts and profiles | `profileId` on every session; one hard-coded profile | Auth provider, per-child profiles, family accounts |
| Hosting | server is stateless apart from `data/`; static client | Deploy behind TLS; move sessions to a database; rate limits per profile |
| COPPA (US) | no PII in content; raw voice never recorded; logs local | Verifiable parental consent before any chat; written retention schedule with fixed deletion windows; written security program; vendor assurances; separate consent for any third-party disclosure; parent data dashboard. Confirm the current rule text and deadlines with counsel before launch |
| Voice | tutor speech is already a string that a TTS stage can take after the gate | Directed TTS first (gate-then-speak); live speech-to-speech only with pause-tolerant turn detection and a push-to-talk control |
| Custom avatar generation | avatar is an asset id in the manifest | Parent-approved generation at onboarding with the same review checklist |
| LLM-generated encounters | validator and mechanics self-test exist | Generation behind the validator plus a human review step; never served unreviewed |
| Chapters 2+ | `tape-model` and `place-value` components stubbed | Cryptarithms, parity invariants (gears, knight tours), graph degree-sum, locker problem, sums of odd numbers |
| Multiple languages | all child-facing strings live in content files | Translated content files; the gate's number-word tables per language |
| Cost control | thinking level low, prompt caching, scripted fallback | Budget per session, batch pre-generation of scenes, cheaper adapter for l0/l1 turns |

**Open decisions for Heman** (the agent should not start M2 before the first two are settled):

- [ ] Default adapter for home play: Gemini 3.8 Flash as specified, or Claude for the first weeks while the Gemini adapter is validated?
- [ ] Conjecture policy: allow the first guess with a reason on every part (as specified), or only on parts flagged `allowConjecture` in content?
- [ ] Stage 1 cap: two probes maximum before moving on (as specified), or one for a child who clearly restates the problem?
- [ ] Look Back waiver: once per chapter by the parent (as specified), or never?
- [ ] Owl voice: text only in v1 (as specified), or parent-read-aloud mode with larger type?
- [ ] Art direction sign-off: the Royal Architect's Guild style bible needs one approved reference image before the asset tool runs.
- [ ] Name of the game and of the hero; the working title is Castle of Theorems.
