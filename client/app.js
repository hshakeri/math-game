/**
 * Castle of Theorems v1 (Home Edition)
 * Master Client Application & Controller
 * client/app.js
 *
 * Zero external dependencies.
 * Screen router (#map, #encounter, #codex), Web Audio synthesizer,
 * Typewriter speech bubble with instant tap-to-complete,
 * Heuristic deck drawer & overlay, pure SVG Golden Seal animator.
 */

import { renderDiagram, mountDiagram } from './diagrams/index.js';

// 1. Audio Synthesizer (Pure Web Audio API — No External Sound Files!)
export class SoundSynth {
  constructor() {
    this.ctx = null;
    this.soundEnabled = typeof localStorage !== 'undefined' && localStorage.getItem('cot_sound') !== 'false';
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
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cot_sound', this.soundEnabled ? 'true' : 'false');
    }
    return this.soundEnabled;
  }
}

// 2. Typewriter Effect Controller (40 char/s with Instant Tap-to-Complete)
export class Typewriter {
  constructor(element, soundSynth, onComplete) {
    this.el = element;
    this.synth = soundSynth;
    this.onComplete = onComplete;
    this.isTyping = false;
    this.targetText = '';
    this.currentIndex = 0;
    this.intervalId = null;
  }

  type(text) {
    this.targetText = text || '';
    this.currentIndex = 0;
    this.isTyping = true;
    if (this.el) this.el.textContent = '';
    if (this.intervalId) clearInterval(this.intervalId);

    // ~40 characters per second = 25 ms interval (Silent typing per SPEC §9 line 329)
    this.intervalId = setInterval(() => {
      if (this.currentIndex < this.targetText.length) {
        const char = this.targetText[this.currentIndex];
        if (this.el) this.el.textContent += char;
        this.currentIndex++;
      } else {
        this.complete();
      }
    }, 25);
  }

  complete() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.el) this.el.textContent = this.targetText;
    this.isTyping = false;
    if (typeof this.onComplete === 'function') this.onComplete();
  }
}

// 3. Main Application State & Controller
export class CastleGame {
  constructor() {
    this.synth = new SoundSynth();
    this.typewriter = null;
    this.activeSessionId = null;
    this.currentView = null;
    this.currentEncounter = null;
    this.allEncounters = [];
    this.sealShown = false;

    // The 6 Heuristic Cards (SPEC §9, §10, validate.js)
    this.deckCards = [
      { id: 'work-backwards', name: 'Work Backwards', desc: 'Start from the finish and undo each step in reverse order.' },
      { id: 'worst-case', name: 'Worst Case', desc: 'Imagine the unluckiest trick or goblin dodging your goal.' },
      { id: 'tiny-case', name: 'Try a Tiny Case', desc: 'Shrink big numbers down to see the pattern clearly.' },
      { id: 'draw-it', name: 'Draw a Diagram', desc: 'Sketch shapes, boxes, or lines to see what is hidden.' },
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
    const speechEl = document.getElementById('owl-speech-text');
    this.typewriter = new Typewriter(speechEl, this.synth);

    // Tap on owl bubble completes instantly
    const owlBubble = document.getElementById('owl-bubble');
    if (owlBubble) {
      owlBubble.addEventListener('click', () => {
        if (this.typewriter && this.typewriter.isTyping) {
          this.typewriter.complete();
        }
      });
    }

    // Seal Chime Audio Toggle
    const audioBtn = document.getElementById('btn-audio-toggle');
    if (audioBtn) {
      const updateAudioBtn = (enabled) => {
        audioBtn.textContent = enabled ? '🔔' : '🔕';
        audioBtn.setAttribute('aria-label', enabled ? 'Golden Seal chime enabled' : 'Golden Seal chime muted');
        audioBtn.setAttribute('title', enabled ? 'Seal chime enabled (tap to mute)' : 'Seal chime muted (tap to enable)');
      };
      updateAudioBtn(this.synth.soundEnabled);

      audioBtn.addEventListener('click', () => {
        const enabled = this.synth.toggleSound();
        updateAudioBtn(enabled);
      });
    }

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
    if (stuckBtn) stuckBtn.addEventListener('click', () => this.handleAction({ type: 'stuck' }));

    // Conjecture Slate
    const conjSubmit = document.getElementById('btn-conjecture-submit');
    if (conjSubmit) conjSubmit.addEventListener('click', () => this.handleConjecture());

    const conjSkip = document.getElementById('btn-conjecture-skip');
    if (conjSkip) conjSkip.addEventListener('click', () => this.handleAction({ type: 'skip_conjecture' }));

    // Stone Dial Submit
    const stoneSubmit = document.getElementById('btn-stone-submit');
    if (stoneSubmit) stoneSubmit.addEventListener('click', () => this.handleFinalSubmit());

    // Golden Seal Modal Continue
    const sealContinue = document.getElementById('btn-seal-continue');
    if (sealContinue) {
      sealContinue.addEventListener('click', () => {
        const sealOverlay = document.getElementById('golden-seal-overlay');
        if (sealOverlay) sealOverlay.classList.add('hidden');
        window.location.hash = '#map';
      });
    }
  }

  initRouter() {
    const handleRoute = () => {
      const hash = window.location.hash || '#map';
      if (hash.startsWith('#encounter')) {
        this.showScreen('screen-encounter');
        const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
        const encId = urlParams.get('id') || 'ch1-n1-reverse-tolls';
        if (encId && (!this.currentView || this.currentView.encounterId !== encId)) {
          this.startEncounter(encId);
        }
      } else if (hash.startsWith('#codex')) {
        this.showScreen('screen-codex');
        this.renderCodex();
      } else {
        this.showScreen('screen-map');
        this.renderMap();
      }
    };

    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  showScreen(screenId) {
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
    this.sealShown = false;
    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId })
      });
      if (res.ok) {
        const data = await res.json();
        this.activeSessionId = data.sessionId;
        this.updateView(data.view || data);
      }
    } catch (err) {
      console.error('Failed to start session', err);
    }
  }

  async handleAction(action) {
    if (!this.activeSessionId) return;
    try {
      const res = await fetch(`/api/session/${this.activeSessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        const data = await res.json();
        this.updateView(data.view || data);
        if (data.speech && this.typewriter) {
          this.typewriter.type(data.speech);
        }
      }
    } catch (err) {
      console.error('Action failed', err);
    }
  }

  updateView(view) {
    if (!view) return;
    this.currentView = view;
    const phase = view.state || view.phase;

    // 1. Update Title and Inscription
    const titleEl = document.getElementById('encounter-title');
    if (titleEl) titleEl.textContent = view.title || 'Encounter';

    const inscEl = document.getElementById('inscription-text');
    if (inscEl) inscEl.textContent = view.inscription || '';

    const bannerEl = document.getElementById('part-prompt-banner');
    if (bannerEl) {
      if (view.partPrompt) {
        bannerEl.textContent = view.partPrompt;
        bannerEl.classList.remove('hidden');
      } else {
        bannerEl.classList.add('hidden');
      }
    }

    // 2. Deck Button lock status (Unlocked only in 'plan' and forward)
    const deckBtn = document.getElementById('btn-toggle-deck');
    const lockBadge = document.getElementById('deck-lock-badge');
    const isPlanOrLater = ['plan', 'carry_out', 'simpler_problem', 'submit', 'look_back'].includes(phase);
    if (deckBtn) {
      if (isPlanOrLater) {
        deckBtn.classList.remove('locked');
        deckBtn.setAttribute('aria-label', 'Open Heuristic Deck');
        if (lockBadge) lockBadge.textContent = '✨';
      } else {
        deckBtn.classList.add('locked');
        deckBtn.setAttribute('aria-label', 'Heuristic Deck (Locked during Understand)');
        if (lockBadge) lockBadge.textContent = '🔒';
      }
    }

    // 3. Owl Utterance
    if (view.lastTutorUtterance && this.typewriter) {
      this.typewriter.type(view.lastTutorUtterance);
    }

    // 4. Conjecture Slate visibility
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
      this.mountDiagramComponent(view.diagram);
    } else {
      if (placeholder) placeholder.classList.remove('hidden');
      if (activeCardPill) activeCardPill.classList.add('hidden');
    }

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
        textInput.placeholder = 'Your thought or question (up to 140 chars)...';
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

    // 10. Golden Seal Trigger
    if (view.sealed && !this.sealShown) {
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
        this.handleAction({ type: 'chip', chip: chipText, text: chipText });
      });
      container.appendChild(btn);
    });
  }

  handleSendReply() {
    const input = document.getElementById('child-text-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this.handleAction({ type: 'say', text });
  }

  handleConjecture() {
    const stemEl = document.getElementById('conjecture-stem');
    const valEl = document.getElementById('conjecture-value');
    const reasonEl = document.getElementById('conjecture-reason');
    if (!stemEl || !valEl || !reasonEl) return;

    const stem = stemEl.value;
    const value = valEl.value.trim();
    const reason = reasonEl.value.trim();
    if (!value || !reason) return;
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
      alert('Archimedes advises: Understand what we are hunting before choosing a tool!');
      return;
    }
    const grid = document.getElementById('deck-card-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const recommended = this.currentView.availableCards || [];

    this.deckCards.forEach(card => {
      const el = document.createElement('div');
      el.className = `deck-card btn-touch ${recommended.includes(card.id) ? 'recommended' : ''}`;
      el.innerHTML = `
        <strong>${card.name}</strong>
        <p style="font-size:0.85rem;margin-top:4px;">${card.desc}</p>
        ${recommended.includes(card.id) ? '<span style="font-size:0.75rem;color:#8c6014;margin-top:6px;">Compass recommended</span>' : ''}
      `;
      el.addEventListener('click', () => {
        this.closeDeck();
        this.handleAction({ type: 'card', cardId: card.id });
      });
      grid.appendChild(el);
    });

    const overlay = document.getElementById('deck-overlay');
    if (overlay) overlay.classList.remove('hidden');
  }

  closeDeck() {
    const overlay = document.getElementById('deck-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  showGoldenSeal(codex) {
    this.sealShown = true;
    this.synth.playGoldenSealChime();
    if (codex) {
      const nameEl = document.getElementById('seal-theorem-name');
      const ruleEl = document.getElementById('seal-theorem-rule');
      if (nameEl) nameEl.textContent = codex.childName || codex.theorem || 'Theorem Proven';
      if (ruleEl) ruleEl.textContent = codex.oneLine || '';
    }
    const overlay = document.getElementById('golden-seal-overlay');
    if (overlay) overlay.classList.remove('hidden');
  }

  mountDiagramComponent(diagramSpec) {
    const mount = document.getElementById('diagram-mount');
    if (!mount || !diagramSpec) return;

    mountDiagram(mount, diagramSpec, diagramSpec.mode || 'workspace', this.currentView.mechanicState, (step) => {
      this.handleAction({ type: 'step', step });
    });
  }

  renderLookBack(options) {
    const container = document.getElementById('look-back-options');
    if (!container) return;
    container.innerHTML = '';
    options.forEach((opt, idx) => {
      const card = document.createElement('div');
      card.className = 'btn-touch chip';
      card.style.display = 'block';
      card.style.textAlign = 'left';
      card.innerHTML = `<strong>Option ${idx + 1} (${opt.kind}):</strong><p>${opt.prompt}</p>`;
      card.addEventListener('click', () => {
        const val = prompt(`Your answer for ${opt.kind}:`);
        if (val !== null) {
          this.handleAction({ type: 'lookback', index: idx, value: val });
        }
      });
      container.appendChild(card);
    });
  }

  renderMap() {
    const nodes = document.querySelectorAll('.map-node');
    nodes.forEach(nodeEl => {
      const nodeId = nodeEl.dataset.node;
      nodeEl.addEventListener('click', () => {
        window.location.hash = `#encounter?id=${nodeId}`;
      });
    });
  }

  renderCodex() {
    const grid = document.getElementById('codex-grid');
    if (!grid) return;
    grid.innerHTML = `
      <article class="codex-card">
        <h3>The Socks-and-Shoes Rule</h3>
        <p>To undo a chain of steps, undo the last step first.</p>
      </article>
      <article class="codex-card">
        <h3>The Goblin Rule</h3>
        <p>To guarantee a match, prepare for the worst luck first.</p>
      </article>
      <article class="codex-card">
        <h3>The Hidden Seams Rule</h3>
        <p>When boundaries touch, internal seams reveal unit ratios.</p>
      </article>
      <article class="codex-card">
        <h3>The Rune Splitting Rule</h3>
        <p>Break numbers into prime runes to spot what is shared.</p>
      </article>
    `;
  }
}

// Bootstrap
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.game = new CastleGame();
  });
}
