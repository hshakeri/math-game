# Castle of Theorems — Home Edition (v1)

![Chapter 1 — Road to the Castle of Theorems](client/assets/scenes/chapter1-card.svg)

**Castle of Theorems** is a calm, home-network math adventure for an 8–9-year-old builder and a parent at the table. Guided by **Archimedes the Owl**, your child works through four mathematical puzzles on the road to the Castle of Theorems using George Pólya’s four stages—**Understand**, **Plan**, **Carry Out**, and **Look Back**—discovering a named theorem for their **Codex** at every gate.

There are **no timers, no scores, no streaks, and no leaderboards**—ever.

---

## Play at Home in Three Commands

Requires **Node.js 20+** on your laptop (no `npm install` packages are needed—the game has zero external dependencies).

```bash
# 1. Optional: copy .env.example to .env if you want live AI tutoring or a custom Parent PIN
cp .env.example .env

# 2. Start the server on port 8080 across your home Wi-Fi (works offline out of the box)
PORT=8080 node --env-file-if-exists=.env -e "import('./server/index.js').then(m => m.startServer(8080, '0.0.0.0').then(() => console.log('Ready on port 8080')))"

# 3. Open the game in Safari or Chrome (or visit http://<your-laptop-ip>:8080 on an iPad)
open http://localhost:8080
```

> **Quick localhost shortcut:** If you are playing on the same laptop and do not need iPad LAN access, `PORT=8080 npm start` starts the server on `http://127.0.0.1:8080`.

---

## For the Parent at the Table

Open **`http://localhost:8080/parent`** (or `http://<your-laptop-ip>:8080/parent`) in your browser and enter the 4-digit PIN (default **`1234`**, configurable via `PARENT_PIN` in `.env`):

- **Live Transcript:** Watch every child action, current Pólya stage, hint rung (`l0` → `l1` → `l2` → `l4` → `l3`), and tutor reply in real time.
- **Scribe Mode:** Toggle Scribe Mode so you can type what your child says out loud while your child keeps tapping chips and manipulating diagrams on the iPad.
- **Nudge Hint Rung:** Manually adjust the hint ladder level for the next turn if your child needs a gentler or more concrete nudge.
- **Waive Look Back:** Once per chapter, award the Golden Seal directly if your child has already explained the idea aloud and is ready to rest.
- **Dyslexia-Friendly Font:** Toggle OpenDyslexic-style accessible spacing and typography across the interface.

---

## Chapter 1 Encounters

| Node | Encounter | Interactive Mechanic | Core Theorem (Codex Entry) |
| :--- | :--- | :--- | :--- |
| **1** | **Chasm of Reverse Tolls** | `inverse-chain` (undo gate operations right-to-left) | Inverse operations — *"The Socks-and-Shoes Rule"* |
| **2** | **The Alchemist’s Dark Vault** | `goblin-bins` (play the worst-case goblin across parts a, b, c) | Pigeonhole principle — *"The Goblin Rule"* |
| **3** | **Courtyard of Five Shields** | `seam-grid` (shared-seam unit ratios & perimeter walk) | Shared edges cancel — *"The Hidden Seams Rule"* |
| **4** | **Castle Keep Portcullis** | `factor-dials` (prime factor trees & shared guardian rune) | Unique prime factorisation — *"The Rune Splitting Rule"* |

---

## Repository Documentation Map

If you are picking up this project from another machine, account, or coding agent session, start here:

- **[SPEC.md](SPEC.md)** — Authoritative v1 design & engineering specification (10 design pillars, Pólya state machine, visibility matrix, 8-stage leak gate, Chapter 1 math content, eval thresholds, and §15 product-later seams).
- **[AGENTS.md](AGENTS.md)** — Standing engineering rules, invariants, non-negotiable guardrails, and verification commands for AI coding agents and contributors.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Complete file-by-file codebase reference, module interfaces, HTTP/SSE wire contracts, SVG diagram architecture, test inventory, and spec-vs-implementation notes.
- **[docs/HANDOFF.md](docs/HANDOFF.md)** — Continuation guide for picking up work from another account: current build state (`734/734` tests green), operational nuances, live Gemini/Claude configuration, replacing placeholder SVG scenes with reviewed art, and authoring Chapter 2+.
- **[TEST_READY.md](TEST_READY.md)** — 46-feature coverage table and 5-tier verification suite manifest.
