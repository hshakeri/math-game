/**
 * Castle of Theorems — Parent Dashboard Controller
 * client/parent.js
 *
 * Real-time SSE transcript streaming, PIN authentication,
 * hint rung overrides, Scribe mode toggling, Chapter Look Back waiver.
 */

let activePin = typeof localStorage !== 'undefined' ? (localStorage.getItem('cot_parent_pin') || '') : '';
let currentSessionId = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('session') || '') : '';
let eventSource = null;
let scribeEnabled = false;

function setSessionId(id) {
  if (!id) return;
  currentSessionId = id;
  const badge = document.getElementById('session-badge');
  if (badge) badge.textContent = `Session: ${id}`;
  const statSession = document.getElementById('stat-session');
  if (statSession) statSession.textContent = id;
}

if (currentSessionId) {
  setSessionId(currentSessionId);
}

// 1. PIN Authentication
const pinSubmitBtn = document.getElementById('btn-pin-submit');
if (pinSubmitBtn) pinSubmitBtn.addEventListener('click', unlockWithPin);

const pinInput = document.getElementById('pin-input');
if (pinInput) {
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') unlockWithPin();
  });
}

function unlockWithPin() {
  const pinEl = document.getElementById('pin-input');
  const pin = pinEl ? pinEl.value.trim() : '';
  if (pin.length === 4) {
    activePin = pin;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cot_parent_pin', pin);
    }
    const modal = document.getElementById('pin-modal');
    if (modal) modal.classList.add('hidden');
    initSSE();
  } else {
    const err = document.getElementById('pin-error');
    if (err) err.classList.remove('hidden');
  }
}

// 2. Real-time SSE Transcript Connection
function initSSE() {
  const statusEl = document.getElementById('conn-status');
  const sessionParam = currentSessionId ? `&session=${encodeURIComponent(currentSessionId)}` : '';
  const url = `/api/parent/transcript?pin=${encodeURIComponent(activePin)}${sessionParam}`;

  if (eventSource) eventSource.close();
  eventSource = new EventSource(url);

  eventSource.onopen = () => {
    if (statusEl) {
      statusEl.textContent = '● Live Streaming';
      statusEl.style.color = '#27ae60';
    }
  };

  eventSource.onerror = () => {
    if (statusEl) {
      statusEl.textContent = '○ Disconnected / Reconnecting...';
      statusEl.style.color = '#e67e22';
    }
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleSSEEvent(data);
    } catch (_) {}
  };

  // Explicit event listeners for named SSE events
  const eventTypes = ['connected', 'session.start', 'tutor.say', 'child.action', 'state.transition', 'engine.transition', 'update', 'parent.override', 'hint.override', 'node.sealed', 'message'];
  for (const et of eventTypes) {
    eventSource.addEventListener(et, (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent({ ...data, type: data.type || et });
      } catch (_) {}
    });
  }
}

function handleSSEEvent(ev) {
  if (!ev) return;
  if (ev.tutor) {
    const config = document.getElementById('stat-tutor');
    const reply = document.getElementById('stat-tutor-reply');
    if (config) config.textContent = ev.tutor.adapter === 'scripted' ? 'Scripted (offline)'
      : `${ev.tutor.adapter} · ${ev.tutor.model || 'configured model'}`;
    if (reply) reply.textContent = ev.tutor.source
      ? `Last reply: ${ev.tutor.fallback ? 'scripted fallback' : ev.tutor.source}${Number.isFinite(ev.tutor.latencyMs) ? ` · ${(ev.tutor.latencyMs / 1000).toFixed(1)}s` : ''}`
      : 'Waiting for the next reply';
  }
  const transcript = document.getElementById('transcript');
  if (!transcript) return;

  const item = document.createElement('div');
  item.className = 'log-item';
  const time = new Date().toLocaleTimeString();

  const strong = document.createElement('strong');
  let bodyText = '';

  switch (ev.type) {
    case 'connected':
      strong.textContent = `[${time}] System:`;
      bodyText = ' Connected to real-time session monitor';
      if (ev.sessionId) {
        setSessionId(ev.sessionId);
      }
      break;
    case 'session.start':
      item.classList.add('log-state');
      strong.textContent = `[${time}] System:`;
      bodyText = ` Active session started: ${ev.sessionId || ''} (${ev.encounterId || ''})`;
      if (ev.sessionId) {
        setSessionId(ev.sessionId);
      }
      break;
    case 'tutor.say':
      item.classList.add('log-tutor');
      strong.textContent = `[${time}] Rivet:`;
      bodyText = ` ${ev.speech || ev.text || ''}`;
      break;
    case 'child.action':
    case 'child.say':
      item.classList.add('log-child');
      strong.textContent = `[${time}] Child (${ev.action || ev.type || 'say'}):`;
      bodyText = ` ${ev.text || ev.chip || ev.value || (typeof ev.payload === 'object' ? JSON.stringify(ev.payload) : ev.payload || '')}`;
      break;
    case 'state.transition':
    case 'engine.transition':
    case 'update':
      item.classList.add('log-state');
      strong.textContent = `[${time}] State:`;
      bodyText = ` ${ev.from || ''} → ${ev.to || ev.state || ''} (Rung: ${ev.rungAfter || ev.hintRung || 'l0'})`;
      const stateEl = document.getElementById('stat-state');
      const rungEl = document.getElementById('stat-rung');
      if (stateEl) stateEl.textContent = ev.to || ev.state || '--';
      if (rungEl) rungEl.textContent = ev.rungAfter || ev.hintRung || 'l0';
      break;
    case 'parent.override':
    case 'hint.override':
      item.classList.add('log-tutor');
      strong.textContent = `[${time}] Parent Override:`;
      bodyText = ` ${ev.kind || 'rung'} = ${ev.value || ev.rung || ev.text || ''}`;
      break;
    case 'node.sealed':
      item.classList.add('log-state');
      strong.textContent = `[${time}] Milestone:`;
      bodyText = ` Node sealed! (Waived: ${Boolean(ev.waived)})`;
      break;
    default:
      strong.textContent = `[${time}] ${ev.type || 'event'}:`;
      bodyText = ` ${typeof ev === 'object' ? JSON.stringify(ev) : ev}`;
  }

  item.appendChild(strong);
  item.appendChild(document.createTextNode(bodyText));

  if (ev.sessionId && !currentSessionId) {
    setSessionId(ev.sessionId);
  }

  transcript.appendChild(item);
  transcript.scrollTop = transcript.scrollHeight;
}

// 3. Parent Controls
const applyRungBtn = document.getElementById('btn-apply-rung');
if (applyRungBtn) {
  applyRungBtn.addEventListener('click', async () => {
    const rungEl = document.getElementById('select-rung');
    const rung = rungEl ? rungEl.value : 'l1';
    try {
      const res = await fetch('/api/parent/hint-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: currentSessionId, sessionId: currentSessionId, pin: activePin, rung, text: rung, hintRung: rung })
      });
      if (res.ok) alert(`Rung forced to ${rung}`);
    } catch (err) {
      alert('Failed to override rung: ' + err.message);
    }
  });
}

const toggleScribeBtn = document.getElementById('btn-toggle-scribe');
if (toggleScribeBtn) {
  toggleScribeBtn.addEventListener('click', async () => {
    scribeEnabled = !scribeEnabled;
    try {
      const res = await fetch('/api/parent/toggle-scribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: currentSessionId, sessionId: currentSessionId, pin: activePin, enabled: scribeEnabled })
      });
      if (res.ok) {
        const btn = document.getElementById('btn-toggle-scribe');
        const inputArea = document.getElementById('scribe-input-area');
        if (scribeEnabled) {
          if (btn) {
            btn.textContent = 'Disable Scribe Mode';
            btn.style.background = '#27ae60';
          }
          if (inputArea) inputArea.classList.remove('hidden');
        } else {
          if (btn) {
            btn.textContent = 'Enable Scribe Mode';
            btn.style.background = '#e67e22';
          }
          if (inputArea) inputArea.classList.add('hidden');
        }
      }
    } catch (err) {
      alert('Failed to toggle scribe: ' + err.message);
    }
  });
}

const scribeSendBtn = document.getElementById('btn-scribe-send');
if (scribeSendBtn) {
  scribeSendBtn.addEventListener('click', async () => {
    const input = document.getElementById('scribe-text');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    await fetch(`/api/session/${currentSessionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: 'say', text } })
    });
  });
}

const applyWaiverBtn = document.getElementById('btn-apply-waiver');
if (applyWaiverBtn) {
  applyWaiverBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to waive the Look Back phase for this chapter? (Available once only)')) return;
    try {
      const res = await fetch('/api/parent/waiver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: currentSessionId, sessionId: currentSessionId, pin: activePin })
      });
      if (res.ok) {
        const statusEl = document.getElementById('waiver-status');
        if (statusEl) statusEl.textContent = 'Waived and Used';
        applyWaiverBtn.disabled = true;
      }
    } catch (err) {
      alert('Failed to grant waiver: ' + err.message);
    }
  });
}

const dyslexiaBtn = document.getElementById('btn-toggle-dyslexia');
if (dyslexiaBtn) {
  const updateDyslexiaUI = (active) => {
    if (active) {
      document.body.classList.add('dyslexia-font');
    } else {
      document.body.classList.remove('dyslexia-font');
    }
    const status = document.getElementById('dyslexia-status');
    if (status) status.textContent = active ? 'Dyslexia font active' : 'Standard font active';
  };

  const isDyslexia = localStorage.getItem('cot_dyslexia') === 'true';
  updateDyslexiaUI(isDyslexia);

  dyslexiaBtn.addEventListener('click', () => {
    const nextState = !document.body.classList.contains('dyslexia-font');
    localStorage.setItem('cot_dyslexia', String(nextState));
    updateDyslexiaUI(nextState);
  });
}

// Auto-unlock if valid 4-digit PIN is cached
if (activePin && activePin.length === 4) {
  const modal = document.getElementById('pin-modal');
  if (modal) modal.classList.add('hidden');
  initSSE();
}
