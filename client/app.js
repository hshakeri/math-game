/**
 * Castle of Theorems v1 (Home Edition)
 * Master Client Application & Controller
 * client/app.js
 *
 * Zero external dependencies.
 * Screen router (#map, #encounter), optional Seal chime,
 * Still illustrations with silent, timed speech bubbles,
 * Heuristic deck drawer and optional Golden Seal chime.
 */

import { mountDiagram } from './diagrams/index.js';
import { sprite } from './pixel-art.js';
import { escapeHTML, gateReaction } from './story.js';
import { TimedSpeech } from './timed-speech.js';
import { illustration, CARD_ILLUSTRATIONS } from './illustrations.js';
import { renderWorldMap } from './world-map.js';
import { renderEncounterMap, storyStops } from './encounter-map.js';
import { mountCalculationTools } from './calculation-tools.js';

// 1. Audio Synthesizer (Pure Web Audio API — No External Sound Files!)
export class SoundSynth {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    try { this.soundEnabled = localStorage.getItem('cot_sound') !== 'false'; } catch {}
  }

  ensureContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Celestial harmonic bell chime upon earning the Golden Seal
  // Major triad arpeggio (E5, G#5, B5, E6) + 2400Hz Low-Pass Filter
  // SPEC §9 line 329: "No sound in v1 except an optional single chime on Seal; no music."
  playGoldenSealChime() {
    if (!this.soundEnabled) return;
    try {
      this.ensureContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [
        { freq: 659.25, time: 0.00, gain: 0.25 }, // E5
        { freq: 830.61, time: 0.15, gain: 0.22 }, // G#5
        { freq: 987.77, time: 0.30, gain: 0.20 }, // B5
        { freq: 1318.5, time: 0.45, gain: 0.15 }  // E6
      ];

      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.8, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now);

      masterGain.connect(filter);
      filter.connect(this.ctx.destination);

      for (const n of notes) {
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        const start = now + n.time;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, start);

        noteGain.gain.setValueAtTime(0.0001, start);
        noteGain.gain.exponentialRampToValueAtTime(n.gain, start + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, start + 2.6);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(start);
        osc.stop(start + 2.7);
      }
    } catch (_) {}
  }

  // Alias for backward compatibility
  playSealChime() {
    this.playGoldenSealChime();
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    try { localStorage.setItem('cot_sound', this.soundEnabled ? 'true' : 'false'); } catch {}
    return this.soundEnabled;
  }
}

// 3. Main Application State & Controller
export class CastleGame {
  constructor() {
    this.synth = new SoundSynth();
    this.speeches = {};
    this.speechTexts = {};
    this.sceneSpeechKey = '';
    this.reactionKey = '';
    this.instantSpeech = false;
    try { this.instantSpeech = localStorage.getItem('keybreakers_instant_speech') === 'true'; } catch {}
    this.activeSessionId = null;
    this.currentView = null;
    this.currentEncounter = null;
    this.allEncounters = [];
    this.sealShown = false;
    this.busy = false;
    this.requestEpoch = 0;
    this.history = [];
    this.lastSpoken = '';
    this.lookBackKey = '';
    this.hero = { name: '', variant: 1 }; // One boy Keybreaker; no setup step.
    this.storyStop = 0;
    this.calculationTools = null;

    // The 6 Heuristic Cards (SPEC §9, §10, validate.js)
    this.deckCards = [
      { id: 'work-backwards', name: 'Work Backwards', desc: 'Start from the finish and undo each step in reverse order.' },
      { id: 'worst-case', name: 'Worst Case', desc: 'Imagine the unluckiest trick or goblin dodging your goal.' },
      { id: 'tiny-case', name: 'Try a Tiny Case', desc: 'Shrink big numbers down to see the pattern clearly.' },
      { id: 'draw-it', name: 'Draw It', desc: 'Sketch shapes, boxes, or lines to see what is hidden.' },
      { id: 'odd-or-even', name: 'Odd or Even', desc: 'Divide numbers into odds and evens to eliminate cases.' },
      { id: 'find-what-is-shared', name: 'Find What is Shared', desc: 'Spot the seam or prime factor that two clues have in common.' }
    ];

    if (typeof window !== 'undefined') {
      this.initDOM();
      this.initRouter();
      this.loadCatalog();
    }
  }

  initDOM() {
    // Check dyslexia-friendly font setting
    try {
      if (localStorage.getItem('cot_dyslexia') === 'true') document.body.classList.add('dyslexia-font');
    } catch {}

    this.initHero();
    this.initModalKeys();
    document.getElementById('tiny-case-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const value = document.getElementById('tiny-case-answer').value;
      if (value !== '') this.handleAction({ type: 'simpler_submit', value: Number(value) });
    });
    this.initSpeech();

    this.calculationTools = mountCalculationTools(document.getElementById('calculation-mount'));
    document.getElementById('encounter-map-mount')?.addEventListener('click', event => {
      const stop = event.target.closest?.('[data-story-stop]');
      const next = event.target.closest?.('[data-story-next]');
      if (!this.currentView || (!stop && !next)) return;
      this.storyStop = stop ? Number(stop.dataset.storyStop)
        : (this.storyStop + 1) % Math.max(1, storyStops(this.currentView).length);
      this.renderStoryMap();
      // Restore the activating map control after replacing its scene markup.
      const selector = next ? '[data-story-next]' : `[data-story-stop="${this.storyStop}"]`;
      document.querySelector(`#encounter-map-mount ${selector}`)?.focus({ preventScroll: true });
    });
    const tools = document.getElementById('tools-drawer');
    document.getElementById('btn-my-tools')?.addEventListener('click', () => {
      tools.open = !tools.open;
    });
    tools?.addEventListener('toggle', () => {
      document.getElementById('btn-my-tools')?.setAttribute('aria-expanded', String(tools.open));
    });

    // User Gesture Audio Unlock
    window.addEventListener('pointerdown', () => this.synth.ensureContext(), { once: true });

    // Deck Drawer Button
    const deckToggle = document.getElementById('btn-toggle-deck');
    if (deckToggle) deckToggle.addEventListener('click', () => this.openDeck());

    const deckClose = document.getElementById('btn-close-deck');
    if (deckClose) deckClose.addEventListener('click', () => this.closeDeck());

    // Reply Strip Controls
    const sendBtn = document.getElementById('btn-send-reply');
    if (sendBtn) sendBtn.addEventListener('click', () => this.handleSendReply());

    const textInput = document.getElementById('child-text-input');
    if (textInput) {
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleSendReply();
      });
    }

    const stuckBtn = document.getElementById('btn-im-stuck');
    if (stuckBtn) {
      stuckBtn.addEventListener('click', () => {
        if (this.currentView && (this.currentView.state === 'arrive' || this.currentView.phase === 'arrive')) {
          this.handleAction({ type: 'arrive' });
          return;
        }
        this.handleAction({ type: 'stuck' });
      });
    }

    // Arrival Controls
    const arriveBtn = document.getElementById('btn-approach-inscription');
    if (arriveBtn) {
      arriveBtn.addEventListener('click', () => this.handleAction({ type: 'arrive' }));
    }

    // Conjecture Slate
    const conjSubmit = document.getElementById('btn-conjecture-submit');
    if (conjSubmit) conjSubmit.addEventListener('click', () => this.handleConjecture());

    const conjSkip = document.getElementById('btn-conjecture-skip');
    if (conjSkip) conjSkip.addEventListener('click', () => this.handleAction({ type: 'skip_conjecture' }));

    // Stone Dial Submit
    const stoneSubmit = document.getElementById('btn-stone-submit');
    if (stoneSubmit) stoneSubmit.addEventListener('click', () => this.handleFinalSubmit());

    // Multi-Part Next Part Button
    const btnNextPart = document.getElementById('btn-next-part');
    if (btnNextPart) {
      btnNextPart.addEventListener('click', () => {
        this.handleAction({ type: 'next_part' });
      });
    }

    // Golden Seal Modal Continue
    const sealContinue = document.getElementById('btn-seal-continue');
    if (sealContinue) {
      sealContinue.addEventListener('click', () => this.finishEncounter());
    }
  }

  initRouter() {
    const handleRoute = () => {
      const hash = window.location.hash || '#map';
      if (hash.startsWith('#encounter')) {
        this.showScreen('screen-encounter');
        const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
        const encId = urlParams.get('id') || 'ch1-n1-reverse-tolls';
        if (encId) this.startEncounter(encId);

      } else {
        this.showScreen('screen-map');
        this.loadCatalog();
      }
    };

    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  showScreen(screenId) {
    if (screenId !== 'screen-encounter') {
      this.requestEpoch++;
      this.setBusy(false);
      this.cancelSpeech({ clear: true });
      this.currentView = null;
      this.dismissModals();
    }
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
  }

  // API Methods
  async loadCatalog() {
    try {
      const res = await fetch('/api/encounters');
      if (res.ok) {
        const data = await res.json();
        this.allEncounters = data.encounters || [];
        this.renderMap();
      }
    } catch (_) {}
  }

  async startEncounter(encounterId) {
    const epoch = ++this.requestEpoch;
    this.setBusy(false);
    this.cancelSpeech({ clear: true });
    this.dismissModals();
    this.sceneSpeechKey = '';
    this.reactionKey = '';
    this.sealShown = false;
    this.lastSpoken = '';
    this.lookBackKey = '';
    this.history = [];
    this.currentView = null;
    this.activeSessionId = null;
    this.setBusy(true);
    this.notice('');
    try {
      let data = null;
      let savedId = null;
      try { savedId = sessionStorage.getItem(`keybreakers_session_${encounterId}`); } catch {}
      if (savedId) {
        const restored = await fetch(`/api/session/${encodeURIComponent(savedId)}/state`);
        if (restored.ok) {
          const candidate = await restored.json();
          if (candidate.view?.encounterId === encounterId && !candidate.view.completed) data = { ...candidate, sessionId: savedId };
        }
      }
      if (!data) {
        const res = await fetch('/api/session/start', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encounterId })
        });
        if (!res.ok) throw new Error('The road could not be loaded. Try opening this gate again.');
        data = await res.json();
      }
      if (epoch !== this.requestEpoch) return;
      this.activeSessionId = data.sessionId;
      try { sessionStorage.setItem(`keybreakers_session_${encounterId}`, data.sessionId); } catch {}
      this.updateView(data.view || data);
      this.renderReaction(data.view || data, []);
    } catch (err) {
      if (epoch === this.requestEpoch) this.notice(err.message || 'The road could not be loaded. Try again.');
    } finally {
      if (epoch === this.requestEpoch) this.setBusy(false);
    }
  }

  async handleAction(action) {
    if (!this.activeSessionId || this.busy) return false;
    const epoch = this.requestEpoch;
    const sessionId = this.activeSessionId;
    this.setBusy(true);
    this.notice('');
    try {
      const res = await fetch(`/api/session/${sessionId}/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action })
      });
      if (!res.ok) throw new Error('That message did not reach Rivet. Your work is here; try again.');
      const data = await res.json();
      if (epoch !== this.requestEpoch || sessionId !== this.activeSessionId) return false;
      const words = action.text || (action.type === 'conjecture' ? `I think ${action.value}, because ${action.reason}` : '');
      if (words) this.appendHistory(this.hero.name || 'You', words);
      this.updateView(data.view || data, { speak: false });
      this.renderReaction(data.view || data, data.events || []);
      // One response carries the same utterance in both places. A new child turn
      // may legitimately receive the same scripted sentence as the previous turn.
      if (data.speech) this.speak(data.speech, { repeat: true });
      else if (data.view?.lastTutorUtterance) this.speak(data.view.lastTutorUtterance);
      if (action.type === 'lookback' && (data.view?.sealed || data.view?.completed)) {
        try { localStorage.setItem(`keybreakers_note_${this.currentView.encounterId}`, String(action.value)); } catch {}
      }
      return true;
    } catch (err) {
      if (epoch === this.requestEpoch) this.notice(err.message || 'Rivet could not hear that. Try again.');
      return false;
    } finally {
      if (epoch === this.requestEpoch) this.setBusy(false);
    }
  }

  async finishEncounter() {
    const epoch = this.requestEpoch;
    const session = this.activeSessionId;
    if (await this.handleAction({ type: 'complete' })) {
      this.hideModal('golden-seal-overlay');
      await this.loadCatalog();
      if (epoch === this.requestEpoch && session === this.activeSessionId) window.location.hash = '#map';
    }
  }

  setBusy(value) {
    this.busy = value;
    const screen = document.getElementById('screen-encounter');
    screen?.classList.toggle('is-busy', value);
    screen?.setAttribute('aria-busy', String(value));
    document.getElementById('rivet-thinking')?.classList.toggle('hidden', !value);
    const input = document.getElementById('child-text-input');
    if (input) input.disabled = value || Boolean(this.currentView?.parentScribe);
  }

  notice(message) {
    const el = document.getElementById('game-notice');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('hidden', !message);
  }

  initSpeech() {
    const textIds = { rivet: 'owl-speech-text', lemma: 'lemma-speech-text' };
    for (const [name, id] of Object.entries(textIds)) {
      const button = document.querySelector(`[data-speech="${name}"]`);
      const accessible = document.getElementById(`${name}-speech-accessible`);
      this.speeches[name] = new TimedSpeech(document.getElementById(id), {
        reducedMotion: () => this.instantSpeech || document.hidden || this.speechObscured(name)
          || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches),
        onStart: text => {
          // Announce the complete line once; visual character updates are aria-hidden.
          if (accessible) {
            accessible.setAttribute('aria-live', this.speechObscured(name) ? 'off' : 'polite');
            accessible.textContent = text;
          }
          if (button) button.textContent = 'Read now';
        },
        onComplete: () => { if (button) button.textContent = 'Read again'; }
      });
      button?.addEventListener('click', () => {
        const speech = this.speeches[name];
        if (!this.speechTexts[name]) return;
        if (speech.pending || speech.isTyping) speech.complete();
        else speech.replay();
      });
      document.getElementById(id)?.addEventListener('click', () => this.speeches[name].complete());
    }
    const mode = document.getElementById('btn-speech-mode');
    const renderMode = () => {
      if (!mode) return;
      mode.textContent = this.instantSpeech ? 'Speech: instant' : 'Speech: paced';
      mode.setAttribute('aria-pressed', String(this.instantSpeech));
    };
    renderMode();
    mode?.addEventListener('click', () => {
      this.instantSpeech = !this.instantSpeech;
      try { localStorage.setItem('keybreakers_instant_speech', String(this.instantSpeech)); } catch {}
      if (this.instantSpeech) this.completeSpeech();
      renderMode();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.completeSpeech();
    });
    if (typeof matchMedia === 'function') {
      matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', event => {
        if (event.matches) this.completeSpeech();
      });
    }
  }

  speechObscured(name) {
    if (typeof document === 'undefined') return false;
    const modal = document.querySelector('.modal-overlay:not(.hidden)');
    return name === 'lemma' ? modal?.id !== 'deck-overlay' : Boolean(modal);
  }

  playSpeech(name, text, { delay = 450, repeat = false } = {}) {
    if (!text || (!repeat && this.speechTexts[name] === text)) return;
    this.speechTexts[name] = text;
    this.speeches[name]?.speak(text, { delay, instant: this.speechObscured(name) });
  }

  completeSpeech() {
    Object.values(this.speeches).forEach(speech => speech.complete());
  }

  cancelSpeech({ clear = false } = {}) {
    Object.values(this.speeches).forEach(speech => speech.cancel({ clear }));
    if (clear) {
      this.speechTexts = {};
      if (typeof document !== 'undefined') {
        for (const name of ['keeper', 'rivet', 'grubb', 'lemma']) {
          const text = document.getElementById(`${name}-speech-accessible`);
          if (text) text.textContent = '';
        }
      }
    }
  }

  speak(text, { repeat = false, delay = 450 } = {}) {
    if (!text || (!repeat && text === this.lastSpoken)) return;
    this.lastSpoken = text;
    this.appendHistory('Rivet', text);
    this.playSpeech('rivet', text, { delay, repeat: true });
  }

  appendHistory(who, words) {
    this.history.push({ who, words });
    const log = document.getElementById('dialogue-history-log');
    if (log) log.innerHTML = this.history.map(h => `<p><strong>${escapeHTML(h.who)}</strong>${escapeHTML(h.words)}</p>`).join('');
  }

  renderReaction(view, events) {
    const reaction = gateReaction(view, events);
    const key = `${reaction.pose}:${reaction.word}`;
    const el = document.getElementById('scene-grubb');
    if (el && key !== this.reactionKey) el.innerHTML = sprite('grubb', { pose: reaction.pose });
    document.getElementById('gate-word').textContent = reaction.word;
    document.getElementById('gate-reaction').textContent = reaction.word ? reaction.text : '';
    document.getElementById('gate-event')?.classList.toggle('hidden', !reaction.word);
    this.reactionKey = key;
  }

  renderStoryMap() {
    const mount = document.getElementById('encounter-map-mount');
    if (mount && this.currentView) mount.innerHTML = renderEncounterMap(this.currentView, this.storyStop);
  }

  updateView(view, { speak = true } = {}) {
    if (!view) return;
    const previousView = this.currentView;
    const sceneKey = `${view.encounterId}:${view.currentPartId || view.partId || ''}`;
    const newScene = this.sceneSpeechKey !== sceneKey;
    if (newScene) {
      this.cancelSpeech({ clear: true });
      this.sceneSpeechKey = sceneKey;
      this.reactionKey = '';
      this.lastSpoken = '';
      this.storyStop = 0;
      this.calculationTools?.setStorageKey(`keybreakers_work_${sceneKey}`);
    }
    this.currentView = view;
    const phase = view.state || view.phase;
    if (newScene) this.renderStoryMap();
    const titleEl = document.getElementById('encounter-title');
    if (titleEl) titleEl.textContent = view.story?.kind === 'toll-road' ? 'The three toll gates' : view.title || 'The gate';
    const goal = document.getElementById('challenge-goal');
    if (goal) goal.textContent = view.story?.kind === 'toll-road'
      ? 'How many Star-Coins were in his pouch at the beginning?' : view.partPrompt || view.prompt || '';

    // 2. Deck Button lock status (Unlocked only in 'plan' and forward)
    const deckBtn = document.getElementById('btn-toggle-deck');
    const lockBadge = document.getElementById('deck-lock-badge');
    const isPlanOrLater = ['plan', 'carry_out', 'simpler_problem', 'submit', 'look_back'].includes(phase);
    if (deckBtn) {
      deckBtn.classList.toggle('hidden', !isPlanOrLater);
      if (isPlanOrLater) {
        deckBtn.classList.remove('locked');
        deckBtn.setAttribute('aria-label', 'Open Heuristic Deck');
        if (lockBadge) lockBadge.textContent = '↗';
      } else {
        deckBtn.classList.add('locked');
        deckBtn.setAttribute('aria-label', 'Heuristic Deck (Locked during Understand)');
        if (lockBadge) lockBadge.textContent = '◇';
      }
    }

    // 3. Owl Utterance
    if (speak && view.lastTutorUtterance) {
      this.speak(view.lastTutorUtterance);
    } else if (speak && phase === 'arrive') {
      this.speak('Let’s explore the story. Tap the places on the map, then tell me what we are trying to find.', { delay: 450 });
    }

    // 4. Arrival Panel visibility
    const arrivalPanel = document.getElementById('arrival-panel');
    if (arrivalPanel) {
      if (phase === 'arrive') {
        arrivalPanel.classList.remove('hidden');
      } else {
        arrivalPanel.classList.add('hidden');
      }
    }

    // 5. Conjecture Slate visibility
    const slate = document.getElementById('conjecture-slate');
    if (slate) {
      if (phase === 'conjecture') {
        slate.classList.remove('hidden');
      } else {
        slate.classList.add('hidden');
      }
    }

    // 5. Workspace / Scroll unlock
    const placeholder = document.getElementById('workspace-placeholder-text');
    const activeCardPill = document.getElementById('active-card-pill');
    const activeCardName = document.getElementById('active-card-name');

    if (view.workspaceUnlocked) {
      if (placeholder) placeholder.classList.add('hidden');
      if (view.activeCard && activeCardPill && activeCardName) {
        activeCardPill.classList.remove('hidden');
        const c = this.deckCards.find(cd => cd.id === view.activeCard);
        activeCardName.textContent = c ? c.name : view.activeCard;
      }
      if (phase !== 'simpler_problem') this.mountDiagramComponent(view.diagram);
    } else {
      if (placeholder) placeholder.classList.remove('hidden');
      if (activeCardPill) activeCardPill.classList.add('hidden');
      const mount = document.getElementById('diagram-mount');
      if (view.diagram?.mode === 'hint') this.mountDiagramComponent(view.diagram);
      else if (mount) mount.innerHTML = `<p class="workspace-placeholder">${phase === 'plan' ? 'Lemma has the deck ready. Choose a creature to bring your tools to the table.' : 'Lemma is sorting the cards. Explore the story and talk it through with Rivet.'}</p>`;
    }
    document.getElementById('diagram-mount')?.classList.toggle('hidden', phase === 'simpler_problem');
    document.getElementById('tiny-case-form')?.classList.toggle('hidden', phase !== 'simpler_problem');
    const hints = document.getElementById('hint-notes');
    if (hints) hints.innerHTML = (view.revealedHints || []).filter(h => phase === 'simpler_problem' ? h.rung === 'l4' : (h.rung !== 'l4' || Boolean(h.l3))).map(h => `<p class="hint-note">${escapeHTML(h.statement || h.text || '')}${h.l3 ? '<br>' + escapeHTML(h.l3) : ''}</p>`).join('');

    // Show a newly requested learning tool; otherwise respect the child's drawer choice.
    const newTinyCase = phase === 'simpler_problem' && (newScene || previousView?.state !== 'simpler_problem');
    const newCard = Boolean(view.activeCard) && (newScene || view.activeCard !== previousView?.activeCard);
    const newHint = (view.revealedHints || []).some(h => !(newScene ? [] : previousView?.revealedHints || [])
      .some(old => JSON.stringify(old) === JSON.stringify(h)));
    if (newTinyCase || newCard || newHint) {
      const tools = document.getElementById('tools-drawer');
      const workspace = document.getElementById('workspace-details');
      if (tools) tools.open = true;
      if (workspace) workspace.open = true;
      document.getElementById('btn-my-tools')?.setAttribute('aria-expanded', 'true');
    }

    // One place to act: show dialogue controls only when the phase uses them.
    document.querySelector('.reply-strip')?.classList.toggle('hidden', ['arrive', 'conjecture', 'look_back', 'sealed', 'map'].includes(phase));

    // 6. Chips
    this.renderChips(view.availableChips || []);

    // 7. Scribe Mode reflection
    const textInput = document.getElementById('child-text-input');
    if (textInput) {
      if (view.parentScribe) {
        textInput.disabled = true;
        textInput.placeholder = 'Parent is typing on the parent tablet...';
      } else {
        textInput.disabled = false;
        textInput.placeholder = 'I’m thinking…';
      }
    }

    // 8. Submit Dial visibility
    const dialContainer = document.getElementById('submit-dial-container');
    if (dialContainer) {
      if (phase === 'submit' || (phase === 'carry_out' && view.workspaceUnlocked)) {
        dialContainer.classList.remove('hidden');
      } else {
        dialContainer.classList.add('hidden');
      }
    }

    // 9. Look Back Panel
    const lbPanel = document.getElementById('look-back-panel');
    if (lbPanel) {
      if (phase === 'look_back' && view.lookBackOptions) {
        lbPanel.classList.remove('hidden');
        this.renderLookBack(view.lookBackOptions);
      } else {
        lbPanel.classList.add('hidden');
      }
    }

    // 9.5 Intermediate Part Complete Panel
    const partPanel = document.getElementById('part-complete-panel');
    if (partPanel) {
      if (view.partSealed && view.hasMoreParts) {
        partPanel.classList.remove('hidden');
        const title = document.getElementById('part-complete-title');
        if (title) title.textContent = 'A chamber opens.';
      } else {
        partPanel.classList.add('hidden');
      }
    }

    // 10. Golden Seal Trigger
    if (view.sealed && !view.hasMoreParts && !this.sealShown) {
      this.showGoldenSeal(view.codex);
    }
  }

  renderChips(chips) {
    const container = document.getElementById('chip-container');
    if (!container) return;
    container.innerHTML = '';
    chips.forEach(chipText => {
      const btn = document.createElement('button');
      btn.className = 'chip btn-touch';
      btn.textContent = chipText;
      btn.addEventListener('click', () => {
        this.handleChip(chipText);
      });
      container.appendChild(btn);
    });
  }

  async handleChip(text) {
    const planning = this.currentView?.state === 'plan';
    const sent = await this.handleAction(planning ? { type: 'say', text } : { type: 'chip', chip: text, text });
    if (sent && planning && this.currentView?.state === 'plan') this.openDeck();
    return sent;
  }

  handleSendReply() {
    const input = document.getElementById('child-text-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text || this.busy) return;
    if (this.currentView && (this.currentView.state === 'arrive' || this.currentView.phase === 'arrive')) {
      this.handleAction({ type: 'arrive', text });
      return;
    }
    this.handleAction({ type: 'say', text }).then(sent => { if (sent && input.value.trim() === text) input.value = ''; });
  }

  handleConjecture() {
    const stemEl = document.getElementById('conjecture-stem');
    const valEl = document.getElementById('conjecture-value');
    const reasonEl = document.getElementById('conjecture-reason');
    if (!stemEl || !valEl || !reasonEl) return;

    const stem = stemEl.value;
    const value = valEl.value.trim();
    const reason = reasonEl.value.trim();
    if (!value || !reason) { this.notice('Give Grubb your idea and a few words about why you think it.'); return; }
    this.handleAction({ type: 'conjecture', stem, value, justification: reason, reason });
  }

  handleFinalSubmit() {
    const input = document.getElementById('final-answer-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    this.handleAction({ type: 'submit', value: Number(val) });
  }

  openDeck() {
    if (!this.currentView || !['plan', 'carry_out', 'simpler_problem', 'submit', 'look_back'].includes(this.currentView.state)) {
      this.notice('Lemma keeps the cards ready. First, read the inscription and talk it through with Rivet.');
      return;
    }
    const grid = document.getElementById('deck-card-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const recommended = this.currentView.availableCards || [];

    this.deckCards.forEach(card => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `deck-card btn-touch ${recommended.includes(card.id) ? 'recommended' : ''}`;
      el.innerHTML = `
        ${illustration(CARD_ILLUSTRATIONS[card.id])}
        <strong>${card.name}</strong>
        <p>${card.desc}</p>
        ${recommended.includes(card.id) ? '<small>A TOOL FOR THIS GATE</small>' : ''}
      `;
      el.addEventListener('click', () => {
        this.closeDeck();
        this.handleAction({ type: 'card', cardId: card.id });
      });
      grid.appendChild(el);
    });

    document.getElementById('lemma-portrait').innerHTML = illustration('lemma');
    this.showModal('deck-overlay');
    const line = 'Choose a creature. Borrow its way of thinking. The next move is yours.';
    this.playSpeech('lemma', line, { repeat: true });
  }

  closeDeck() {
    this.speeches.lemma?.cancel();
    this.hideModal('deck-overlay');
  }

  showGoldenSeal(codex) {
    this.sealShown = true;
    this.synth.playGoldenSealChime();
    if (codex) {
      const nameEl = document.getElementById('seal-theorem-name');
      const ruleEl = document.getElementById('seal-theorem-rule');
      if (nameEl) nameEl.textContent = codex.childName || codex.theorem || 'A way to remember';
      if (ruleEl) ruleEl.textContent = codex.oneLine || '';
    }
    document.getElementById('seal-hero').innerHTML = sprite('hero', { variant: this.hero.variant, pose: 'celebrate' });
    this.showModal('golden-seal-overlay');
  }

  mountDiagramComponent(diagramSpec) {
    const mount = document.getElementById('diagram-mount');
    if (!mount || !diagramSpec) return;

    // Each renderer attaches listeners to its mount; use a fresh node to dispose them.
    const freshMount = mount.cloneNode(false);
    mount.replaceWith(freshMount);
    freshMount.addEventListener('keydown', e => {
      const button = e.target.closest?.('[role="button"]');
      if (button && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    mountDiagram(freshMount, diagramSpec, diagramSpec.mode || 'workspace', this.currentView.mechanicState, (step) => {
      this.handleAction({ type: 'step', payload: step, step });
    });
    freshMount.querySelectorAll('[data-action]').forEach(control => {
      control.setAttribute('role', 'button');
      control.setAttribute('tabindex', '0');
      if (!control.hasAttribute('aria-label')) control.setAttribute('aria-label', control.textContent.trim() || 'Adjust blueprint');
    });
  }

  renderLookBack(options) {
    const container = document.getElementById('look-back-options');
    if (!container) return;
    const key = JSON.stringify(options);
    if (key === this.lookBackKey) return;
    this.lookBackKey = key;
    container.innerHTML = '';
    options.forEach((opt, idx) => {
      const card = document.createElement('div');
      card.className = 'lookback-card';
      card.style.display = 'block';
      card.style.textAlign = 'left';
      card.style.padding = '12px';
      card.style.marginBottom = '12px';

      const title = document.createElement('strong');
      title.textContent = ['Explain your way through', 'Try another way', 'Change the story'][idx] || 'Leave your note';
      const promptP = document.createElement('p');
      promptP.style.margin = '6px 0 10px 0';
      promptP.textContent = opt.prompt;

      const form = document.createElement('form');
      form.style.display = 'flex';
      form.style.gap = '8px';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'input-touch';
      input.placeholder = 'Here is how I see it…';
      input.setAttribute('aria-label', opt.prompt);
      input.maxLength = 140;
      input.style.flex = '1';

      const submitBtn = document.createElement('button');
      submitBtn.type = 'submit';
      submitBtn.className = 'btn-touch btn-primary';
      submitBtn.textContent = 'Leave my note';

      form.appendChild(input);
      form.appendChild(submitBtn);

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = input.value.trim();
        if (val) {
          this.handleAction({ type: 'lookback', kind: opt.kind, index: idx, value: val });
        }
      });

      card.appendChild(title);
      card.appendChild(promptP);
      card.appendChild(form);
      container.appendChild(card);
    });
  }

  renderMap() {
    const container = document.getElementById('world-map-mount');
    if (container) container.innerHTML = renderWorldMap(this.allEncounters);
  }

  initHero() {
    this.hero = { name: '', variant: 1 };
    const hero = document.getElementById('reply-hero');
    if (hero) hero.innerHTML = sprite('hero', { variant: 1 });
    const label = document.getElementById('hero-speaker-name');
    if (label) label.textContent = 'YOU';
    const rivet = document.getElementById('rivet-avatar');
    if (rivet) rivet.innerHTML = sprite('rivet');
  }

  showModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    this.completeSpeech();
    if (!document.querySelector('.modal-overlay:not(.hidden)')) this.modalReturnFocus = document.activeElement;
    document.querySelectorAll('.modal-overlay').forEach(other => {
      if (other !== overlay) other.classList.add('hidden');
    });
    if (id !== 'deck-overlay') this.speeches.lemma?.cancel();
    overlay.classList.remove('hidden');
    document.getElementById('app-root').inert = true;
    overlay.querySelector('button')?.focus();
  }

  hideModal(id) {
    document.getElementById(id)?.classList.add('hidden');
    const remaining = document.querySelector('.modal-overlay:not(.hidden)');
    document.getElementById('app-root').inert = Boolean(remaining);
    if (remaining) remaining.querySelector('button')?.focus();
    else if (this.modalReturnFocus?.isConnected !== false) this.modalReturnFocus?.focus();
    for (const name of ['keeper', 'rivet', 'grubb']) {
      document.getElementById(`${name}-speech-accessible`)?.setAttribute('aria-live', 'polite');
    }
  }

  dismissModals() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
    const root = document.getElementById('app-root');
    if (root) root.inert = false;
    this.modalReturnFocus = null;
  }

  initModalKeys() {
    document.addEventListener('keydown', e => {
      const modal = document.querySelector('.modal-overlay:not(.hidden)');
      if (!modal) return;
      if (e.key === 'Escape' && modal.id === 'deck-overlay') { e.preventDefault(); this.closeDeck(); }
      if (e.key !== 'Tab') return;
      const focusable = [...modal.querySelectorAll('button:not(:disabled), input, a[href], select, [tabindex="0"]')];
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    });
  }


}

// Bootstrap
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.game = new CastleGame();
  });
}
