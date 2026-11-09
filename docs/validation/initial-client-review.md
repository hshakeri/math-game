# Local presentation review

Scope: snapshot in `../workspace/`, taken before the Keybreakers UI edits on 2026-11-09. No live files edited. This is a coordinator-family review, not a completed Gemini review.

## External review status

The requested `gemini-4-argon-high` `/boost` run did not start: sandbox denied localhost binding and Antigravity log writes. An escalation was rejected by automatic approval review because sending the repository snapshot and prompt to external Antigravity/Gemini was classified as an unapproved private-source export. No workaround was attempted. Original failure log: `../run/stderr.log`. Do not represent this as an external audit.

## Authoritative visual signals

- `server/engine/clientView.js:154-170`: `view.scene.state === 'unlocked'` and `view.sealed` identify whole-node unlock; scene stays locked through normal `look_back` and intermediate `partSealed`.
- `view.partSealed && view.hasMoreParts` means intermediate chamber completion, not a Golden Seal. Continue with `next_part`.
- `server/engine/stateMachine.js:475-497`: explicit final-submit events are `engine.transition` from `submit` to `look_back` for final-part acceptance, `submit` to `sealed` for intermediate-part acceptance, or `submit` to `carry_out` with `correct:false` for a rejected submitted answer. These can drive brief latch reactions while persistent scene state follows the safe view. Never inspect or infer from tutor prose.
- `server/engine/stateMachine.js:259,313`: conjecture shortcuts enter `look_back`; they are not yet a node Seal.
- `node.sealed` / safe `view.sealed` can trigger hero celebration and optional Seal chime. `simpler_problem` completion cannot.
- `server/index.js:595-605` returns raw engine events alongside sanitized view. Wrong-conjecture transition events contain a misconception `tag`; never render raw event details or put them into tutor inputs. Prefer a whitelisted client-facing reaction enum if changing this interface.

## Verified baseline defects relevant to the redesign

1. **Node completion is never recorded by Seal Continue.** `client/app.js:255-260` only closes the overlay and changes route. `server/index.js:643-657` uses `session.completed` to unlock next node and Codex; only engine `complete` or final `next_part` sets it. Continue must await `{type:'complete'}`, refresh catalog, then route.
2. **Initial workspace is blank.** `server/engine/clientView.js:104-139` builds a diagram only at rung l2+, while card selection at l0 sets workspaceUnlocked. Reproduced with actual engine flow: arrive → skip_conjecture → two says → work-backwards gives carry_out/l0, workspaceUnlocked true, diagram null. Build workspace spec server-side from public mechanic params when workspace is unlocked, independently of hint rung. Keep hint diagram visibility gated.
3. **Tiny-case branch has no answering UI.** `client/app.js:454-461` shows final dial only in submit/carry_out. No rendering of l4 statement or simpler-submit exists. Engine `simpler_problem` accepts `simpler_submit` or `submit` (`stateMachine.js:534`). Add an accessible separate tiny-case statement/value control.
4. **Repeated diagram mounts accumulate handlers.** `client/app.js:585-591` remounts same container. All four `client/diagrams/*.js` mount implementations attach a new container click handler without disposal. Reproduced with actual reverse-tolls mount and a minimal container: two mounts, one logical click, two dispatched actions. Replace the mount container or add disposal before remounting. A busy flag also prevents user double submissions but does not alone repair accumulated listeners.
5. **Map ignores catalog unlock state and keyboard.** `client/app.js:645-652` attaches click to every map node irrespective of catalog; repeat calls attach more listeners. SVG groups have tabindex/role but no Enter/Space handler. Prefer native buttons, check `unlocked`, and bind once.
6. **Deck inaccessible by keyboard.** `client/app.js:549-562` creates clickable divs rather than buttons. Modal lacks focus trapping/restore/Escape. Use native buttons and reusable modal handling.
7. **Session responses can cross routes.** `startEncounter` and `handleAction` have no request identity/cancellation/pending protection; a slow older response can overwrite a newer encounter. Capture session and navigation request id; discard stale responses and disable dispatch while awaiting a turn. Keep retry/error copy visible rather than console-only failures.
8. **Browser zoom disabled.** `client/index.html:5` sets maximum-scale=1 and user-scalable=no. Remove both.
9. **Repeated typewriter/readback and reflection resets.** Every update replays unchanged `lastTutorUtterance`, then action response types `speech` again. `renderLookBack` rebuilds forms on every view update. Track utterance identity and preserve drafts/focus when content is unchanged.

## Focused acceptance checks

- Real scripted browser flow: start → conjecture/skip → understand → card → working diagram at l0 → submit → look-back → Seal → complete → next-node unlocked and Codex saved.
- Multi-part Vault: intermediate part completion does not trigger node scene unlock/Seal; next part starts with reset workspace; final Look Back triggers Seal.
- Tiny Case: statement shown, answer field submits appropriate action, returns to full workspace.
- One diagram click produces one action after several rerenders. Double tapping a chip while Rivet is waiting cannot submit twice.
- No character evaluation on say/chip/stuck/model-generated text. Grubb reactions and gate swaps come from approved deterministic signals only.
- Keyboard: map nodes, deck cards, dialogs, diagram buttons; Escape and restored focus; browser zoom; reduced-motion rendering and instant speech completion.
- Check narrow mobile and iPad portrait layout for clipped inscription/reply controls and persistent access to I'm stuck.
