# Test Readiness Manifest — Castle of Theorems v1 (Home Edition)

**Milestone**: M5 — Release Polish, E2E Verification & Adversarial Hardening  
**Target Release**: Castle of Theorems v1 (Home Edition)  
**Author**: Heman Shakeri  
**Date**: November 2026  

---

## 1. System Requirements & Environment

- **Runtime**: Node.js v20.0.0+ (Verified on Node v24.17.0, macOS darwin-arm64)
- **Zero NPM Dependencies**: `"dependencies": {}` and `"devDependencies": {}` in `package.json`. No external packages, bundlers, or transpilers required.
- **Python**: Python 3.10+ (for `tools/assets/generate.py`)
- **Web APIs**: Native `fetch()`, `crypto.randomUUID()`, `AbortSignal.timeout(4000)`, `EventSource` (SSE).

---

## 2. Test Suite Architecture & Tiers

The test harness provides comprehensive layered verification across 5 distinct tiers:

| Tier | File | Purpose | Test Count |
| :--- | :--- | :--- | :--- |
| **Tier 1: Features** | `test/e2e-tier1-features.test.js` | Isolated happy-path coverage of all 46 architectural features | 40 |
| **Tier 2: Boundaries** | `test/e2e-tier2-boundaries.test.js` | Limits, cutoffs, word number parsing, malformed payloads, state caps | 22 |
| **Tier 3: Combinations** | `test/e2e-tier3-combinations.test.js` | 10 cross-feature interacting pairs (e.g. waiver + multi-part, scribe + SSE) | 10 |
| **Tier 4: Scenarios** | `test/e2e-tier4-scenarios.test.js` | 4 end-to-end user journeys (Golden Path, Struggling, Prodigy, Adversarial) | 4 |
| **Master Runner** | `test/e2e-tiers.test.js` | Consolidated execution runner covering Tiers 1–4 | 76 |
| **Tier 5: Adversarial** | `test/tier5-adversarial.test.js` | 10 adversarial exploit scenarios (homoglyphs, dashes, XSS, bursts, DoS) | 17 |

---

## 3. Complete 46-Feature Coverage Mapping

| Feature ID | Feature Name | Test File | Test Suite & Assertion |
| :--- | :--- | :--- | :--- |
| **F1** | Repo & Environment Setup | `test/e2e-tier1-features.test.js` | Sub-suite 1: Zero runtime and dev npm dependencies |
| **F2** | Verbatim SPEC.md | `test/e2e-tier1-features.test.js` | Sub-suite 1: Authoritative spec size (~75KB) & sections intact |
| **F3** | Encounter Schema | `test/e2e-tier1-features.test.js` | Sub-suite 1: Valid Draft-07 schema with Part and Encounter definitions |
| **F4** | Encounter 1: Reverse Tolls | `test/e2e-tier1-features.test.js` | Sub-suite 2: JSON schema compliance, answer 6, forbidden list |
| **F5** | Encounter 2: Dark Vault | `test/e2e-tier1-features.test.js` | Sub-suite 2: Multi-part structure (a, b, c), answers 4, 10, 13 |
| **F6** | Encounter 3: Five Shields | `test/e2e-tier1-features.test.js` | Sub-suite 2: Seam grid params, answer 30, hidden seams rule |
| **F7** | Encounter 4: Castle Keep | `test/e2e-tier1-features.test.js` | Sub-suite 2: Factor dial products 34 & 85, answer 24, rune splitting |
| **F8** | Content Validator | `test/e2e-tier1-features.test.js` | Sub-suite 2: `content/validate.js` executes and passes cleanly |
| **F9** | Mechanics: Inverse Chain | `test/e2e-tier1-features.test.js` | Sub-suite 3: Pure function backward replay through 3 gates |
| **F10** | Mechanics: Goblin Bins | `test/e2e-tier1-features.test.js` | Sub-suite 3: Pure function pigeonhole placement and count verification |
| **F11** | Mechanics: Seam Grid | `test/e2e-tier1-features.test.js` | Sub-suite 3: Pure function seam unit ratio and perimeter deduction |
| **F12** | Mechanics: Factor Dials | `test/e2e-tier1-features.test.js` | Sub-suite 3: Pure function prime factor assignment and sum unlocking |
| **F13** | State Machine & Loop | `test/e2e-tier1-features.test.js` | Sub-suite 4: Deterministic transition arrive -> conjecture -> understand |
| **F14** | Conjecture Logic | `test/e2e-tier1-features.test.js` | Sub-suite 4: Justified correct guess shortcuts directly to Look Back |
| **F15** | ZPD Hint Ladder | `test/e2e-tier1-features.test.js` | Sub-suite 4: Ladder fades on success (floor l1), escalates on misses |
| **F16** | Look Back & Waiver | `test/e2e-tier1-features.test.js` | Sub-suite 4: Look Back verification and single parent waiver per chapter |
| **F17** | Synchronous Leak Gate | `test/e2e-tier1-features.test.js` | Sub-suite 5: 8-stage gate screens utterances synchronously in < 5ms |
| **F18** | Authored Scripted Probes | `test/e2e-tier1-features.test.js` | Sub-suite 5: Scripted probes exist for every part, stage, and rung |
| **F19** | Client-Safe View Filter | `test/e2e-tier1-features.test.js` | Sub-suite 6: Strips answers, intermediates, and unearned hints |
| **F20** | Telemetry Logger | `test/e2e-tier1-features.test.js` | Sub-suite 6: Valid JSONL event stream written to session logs |
| **F21** | Scripted Mode Playability | `test/e2e-tier1-features.test.js` | Sub-suite 6: 100% end-to-end playable with LLM adapter disabled |
| **F22** | Tutor Adapter Interface | `test/e2e-tier1-features.test.js` | Sub-suite 5: Uniform interface returning structured utterance payload |
| **F23** | Archimedes System Prompt | `test/e2e-tier1-features.test.js` | Sub-suite 5: prompt.md enforces 150-300 chars, 1 question, no praise |
| **F24** | Gemini REST Adapter | `test/e2e-tier1-features.test.js` | Sub-suite 5: Official REST endpoint, zero SDKs, 4s timeout |
| **F25** | Claude REST Adapter | `test/e2e-tier1-features.test.js` | Sub-suite 5: Official REST endpoint, tool calling, 4s timeout |
| **F26** | Tutor Retry & Fallback | `test/e2e-tier1-features.test.js` | Sub-suite 5: Gate failure retries once with corrective prompt, then falls back |
| **F27** | HTTP & SSE Server | `test/e2e-tier1-features.test.js` | Sub-suite 7: Static file serving, 404 fallback, REST endpoints |
| **F28** | PWA Client Shell | `test/e2e-tier1-features.test.js` | Sub-suite 7: Vanilla HTML/CSS/JS shell, responsive viewport |
| **F29** | Heuristic Deck Overlay | `test/e2e-tier1-features.test.js` | Sub-suite 7: 6 Pólya heuristic cards with SVG icons |
| **F30** | Owl Speech Bubble | `test/e2e-tier1-features.test.js` | Sub-suite 7: Typewriter effect with single celestial chime on seal |
| **F31** | Diagram: Inverse Chain | `test/e2e-tier1-features.test.js` | Sub-suite 7: Pure SVG gate sequence diagram |
| **F32** | Diagram: Goblin Bins | `test/e2e-tier1-features.test.js` | Sub-suite 7: Pure SVG bins and crystal placement diagram |
| **F33** | Diagram: Seam Grid | `test/e2e-tier1-features.test.js` | Sub-suite 7: Pure SVG interlocking shields grid diagram |
| **F34** | Diagram: Factor Tree | `test/e2e-tier1-features.test.js` | Sub-suite 7: Pure SVG prime dial and factor tree diagram |
| **F35** | Parent Dashboard | `test/e2e-tier1-features.test.js` | Sub-suite 8: Protected by 4-digit PIN authentication |
| **F36** | UI Ergonomics & Anti-Patterns | `test/e2e-tier1-features.test.js` | Sub-suite 8: Touch targets >= 56px; zero timers, streaks, or leaderboards |
| **F37** | Golden Seal & Audio Chime | `test/e2e-tier1-features.test.js` | Sub-suite 8: Web Audio API sine harmonic chime on completion |
| **F38** | Asset Manifest & Approval | `test/e2e-tier1-features.test.js` | Sub-suite 2: 100% of registered assets have `approved: true` |
| **F39** | Procedural Asset Generator | `test/e2e-tier1-features.test.js` | Sub-suite 2: `tools/assets/generate.py` generates valid SVGs |
| **F40** | Simulated Student Personas | `test/e2e-tier1-features.test.js` | Sub-suite 9: 6 student personas covering varied engagement |
| **F41** | Evaluation Runner | `test/e2e-tier1-features.test.js` | Sub-suite 9: `eval/run.js` benchmarks leakage and latency |
| **F42** | CI Evaluation Smoke Script | `test/e2e-tier1-features.test.js` | Sub-suite 9: `npm run eval:ci` exits 0 cleanly in keyless environments |
| **F43** | Dyslexia Font Toggle | `client/parent.js`, `client/app.js` | Tier 1/5: OpenDyslexic accessibility toggle persists in localStorage |
| **F44** | Inline Look Back Form | `client/app.js` | Tier 1/4: In-page card/chip input replaces `window.prompt` |
| **F45** | Forensic Integrity Audit | `test/e2e-tier1-features.test.js` | Sub-suite 1: Zero cheat tokens, fake verifications, or backdoors |
| **F46** | Release & Deployment Readiness | `test/e2e-tier1-features.test.js` | Sub-suite 1: Zero runtime dependencies, standalone operation |

---

## 4. Execution Commands

### Run Master E2E Suite (Tiers 1–4)
```bash
node --test test/e2e-tiers.test.js
```

### Run Individual Tiers
```bash
# Tier 1: 46 Isolated Feature Tests
node --test test/e2e-tier1-features.test.js

# Tier 2: Boundary & Edge Case Suite
node --test test/e2e-tier2-boundaries.test.js

# Tier 3: Cross-Feature Integration Suite
node --test test/e2e-tier3-combinations.test.js

# Tier 4: Comprehensive Real-World User Scenarios
node --test test/e2e-tier4-scenarios.test.js

# Tier 5: Adversarial Hardening Suite
node --test test/tier5-adversarial.test.js
```

### Run Entire Repository Test Suite
```bash
node --test $(git ls-files test/)
```

### Run Content Validation & CI Evaluation
```bash
npm run validate
npm run eval:ci
```

---

## 5. Invariants & Acceptance Gates

1. **Deterministic Socratic Diet**: The tutor model is never passed final answers, intermediate values, or correctness indicators.
2. **Synchronous Leak Screening**: The leak gate evaluates candidate probes in < 5ms synchronously before client delivery.
3. **Graceful Degradation**: Dual leak gate rejection triggers immediate fallback to authored scripted probes with zero user interruption.
4. **Pólya Phase Invariance**: State transitions follow Arrive -> Conjecture -> Understand -> Plan -> Carry Out -> Look Back -> Sealed.
5. **No Gambling or Anxiety Mechanics**: Zero countdown timers, streaks, points, scores, or public leaderboards.
