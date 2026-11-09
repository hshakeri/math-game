/**
 * Castle of Theorems — Reverse Tolls Bridge Diagram (Inverse Chain)
 * client/diagrams/reverse-tolls.js
 */

export function render(spec, mode = 'hint', state = null) {
  const gates = spec?.params?.gates || [{ mul: 2, sub: 5 }, { mul: 2, sub: 3 }, { mul: 2, sub: 9 }];
  const endValue = spec?.params?.end ?? 13;
  const isWorkspace = mode === 'workspace';

  const currentGateIdx = state?.currentGateIndex ?? (gates.length - 1);
  const orderVerified = state?.orderVerifiedForGate === currentGateIdx;
  const history = state?.history || [];
  const completed = Boolean(state?.completed);

  let svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 370" role="img"
     aria-label="Chasm of Reverse Tolls Bridge Diagram" class="diagram-svg reverse-tolls-svg">
  <defs>
    <filter id="glow-gold" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <marker id="arrow-left" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 10 0 L 0 5 L 10 10 z" fill="#c8963e" />
    </marker>
  </defs>

  <!-- Background Chasm & Stone Bridge -->
  <rect width="800" height="370" rx="12" fill="#1c2631" />
  <path d="M 40 240 Q 400 280 760 240" stroke="#3d5166" stroke-width="12" fill="none" stroke-linecap="round" />
  <path d="M 40 246 Q 400 286 760 246" stroke="#233140" stroke-width="4" fill="none" />

  <!-- Direction Indicator: Right to Left (Work Backwards) -->
  <g class="flow-indicators" opacity="0.85">
    <line x1="680" y1="290" x2="120" y2="290" stroke="#c8963e" stroke-width="3" stroke-dasharray="8 6" marker-end="url(#arrow-left)" />
    <text x="400" y="320" fill="#c8963e" font-size="16" font-weight="600" text-anchor="middle" letter-spacing="1">
      UNDO ORDER: WORK BACKWARDS (RIGHT TO LEFT)
    </text>
  </g>

  <!-- Castle Door (Right: End Value 13) -->
  <g class="castle-checkpoint" transform="translate(680, 100)">
    <rect x="-40" y="-30" width="80" height="110" rx="8" fill="#233140" stroke="#c8963e" stroke-width="3" />
    <path d="M -30 -30 Q 0 -55 30 -30 Z" fill="#c8963e" />
    <text x="0" y="25" fill="#f8fafc" font-size="14" font-weight="600" text-anchor="middle">Castle</text>
    <circle cx="0" cy="55" r="22" fill="#c8963e" />
    <text x="0" y="61" fill="#1c2631" font-size="18" font-weight="bold" text-anchor="middle">${endValue}</text>
  </g>
`;

  // Render Gates: Index 0, 1, 2 placed left to right
  const gateXCoords = [200, 380, 560];
  gates.forEach((gate, idx) => {
    const cx = gateXCoords[idx];
    const isActive = isWorkspace && idx === currentGateIdx;
    const isPast = history.some(h => h.gateIndex === idx);
    const histEntry = history.find(h => h.gateIndex === idx);
    const displayedVal = histEntry ? histEntry.value : (isActive && orderVerified ? '?' : '—');

    const strokeColor = isActive ? '#c8963e' : (isPast ? '#27ae60' : '#5dade2');
    const filterAttr = isActive ? 'filter="url(#glow-gold)"' : '';

    svg += `
  <g class="toll-gate gate-${idx} ${isActive ? 'active-gate' : ''}" transform="translate(${cx}, 100)" ${filterAttr}>
    <rect x="-60" y="-40" width="120" height="125" rx="10" fill="#233140" stroke="${strokeColor}" stroke-width="${isActive ? 4 : 2}" />
    <text x="0" y="-18" fill="#f8fafc" font-size="15" font-weight="bold" text-anchor="middle">Gate ${idx + 1}</text>
    <text x="0" y="5" fill="#aed6f1" font-size="14" text-anchor="middle">Forward: ×${gate.mul}, −${gate.sub}</text>
    
    <!-- Coin Bag Counter / Slot -->
    <rect x="-40" y="18" width="80" height="46" rx="8" fill="#1c2631" stroke="${strokeColor}" stroke-width="2" />
    <text x="0" y="48" fill="${isPast ? '#2ecc71' : '#f8fafc'}" font-size="20" font-weight="bold" text-anchor="middle">
      ${displayedVal}
    </text>
    <text x="0" y="78" fill="#cbd5e1" font-size="14" text-anchor="middle">coins before gate</text>
  </g>`;

    // Interactive Controls Overlay for Active Gate in Workspace Mode
    if (isActive && isWorkspace && !completed) {
      if (!orderVerified) {
        // Order selection chips (touch targets >= 44px)
        svg += `
  <g class="interactive-order-controls" transform="translate(${cx}, 235)">
    <g class="btn-order-correct" data-action="order" data-gate="${idx}" data-val="add,div" cursor="pointer">
      <rect x="-105" y="0" width="210" height="44" rx="8" fill="#c8963e" />
      <text x="0" y="27" fill="#1c2631" font-size="14" font-weight="bold" text-anchor="middle">+ Add ${gate.sub}, then ÷ ${gate.mul}</text>
    </g>
    <g class="btn-order-wrong" data-action="order" data-gate="${idx}" data-val="div,add" transform="translate(0, 50)" cursor="pointer">
      <rect x="-105" y="0" width="210" height="44" rx="8" fill="#233140" stroke="#5dade2" stroke-width="1.5" />
      <text x="0" y="27" fill="#f8fafc" font-size="14" font-weight="bold" text-anchor="middle">÷ ${gate.mul}, then + Add ${gate.sub}</text>
    </g>
  </g>`;
      } else {
        // Value stepper controls (touch targets >= 44px)
        svg += `
  <g class="interactive-value-controls" transform="translate(${cx}, 240)">
    <rect x="-85" y="0" width="170" height="54" rx="8" fill="#1c2631" stroke="#c8963e" stroke-width="2" />
    <g class="btn-step-minus" data-action="val-delta" data-delta="-1" cursor="pointer">
      <rect x="-78" y="5" width="44" height="44" rx="6" fill="#233140" />
      <text x="-56" y="33" fill="#fff" font-size="22" font-weight="bold" text-anchor="middle">−</text>
    </g>
    <text x="0" y="34" fill="#f8fafc" font-size="18" font-weight="bold" text-anchor="middle" id="gate-input-val">10</text>
    <g class="btn-step-plus" data-action="val-delta" data-delta="1" cursor="pointer">
      <rect x="34" y="5" width="44" height="44" rx="6" fill="#233140" />
      <text x="56" y="33" fill="#fff" font-size="22" font-weight="bold" text-anchor="middle">+</text>
    </g>
    <g class="btn-submit-val" data-action="submit-val" data-gate="${idx}" transform="translate(0, 62)" cursor="pointer">
      <rect x="-75" y="0" width="150" height="44" rx="6" fill="#27ae60" />
      <text x="0" y="27" fill="#fff" font-size="14" font-weight="bold" text-anchor="middle">Confirm Coins</text>
    </g>
  </g>`;
      }
    }
  });

  // Start Platform (Left: Traveler's Start) - strictly dynamic fallback
  const finalStartVal = completed ? (state?.currentValue ?? '?') : '?';
  svg += `
  <g class="traveler-start" transform="translate(60, 100)">
    <circle cx="0" cy="20" r="32" fill="#233140" stroke="${completed ? '#27ae60' : '#5dade2'}" stroke-width="3" />
    <text x="0" y="15" fill="#aed6f1" font-size="14" text-anchor="middle">START</text>
    <text x="0" y="34" fill="${completed ? '#2ecc71' : '#f8fafc'}" font-size="20" font-weight="bold" text-anchor="middle">${finalStartVal}</text>
  </g>
</svg>`;

  return svg;
}

export function mount(container, spec, mode, state, onStep) {
  if (typeof window === 'undefined' || !container) return;
  container.innerHTML = render(spec, mode, state);

  if (mode !== 'workspace' || !onStep) return;

  let currentEnteredVal = 10;
  const updateValDisplay = () => {
    const el = container.querySelector('#gate-input-val');
    if (el) el.textContent = currentEnteredVal;
  };

  container.addEventListener('click', (e) => {
    const orderBtn = e.target.closest('[data-action="order"]');
    if (orderBtn) {
      const gateIndex = Number(orderBtn.dataset.gate);
      const order = orderBtn.dataset.val.split(',');
      onStep({ action: 'order', gateIndex, order });
      return;
    }

    const deltaBtn = e.target.closest('[data-action="val-delta"]');
    if (deltaBtn) {
      const delta = Number(deltaBtn.dataset.delta);
      currentEnteredVal = Math.max(1, currentEnteredVal + delta);
      updateValDisplay();
      return;
    }

    const submitValBtn = e.target.closest('[data-action="submit-val"]');
    if (submitValBtn) {
      const gateIndex = Number(submitValBtn.dataset.gate);
      onStep({ action: 'value', gateIndex, value: currentEnteredVal });
      return;
    }
  });
}
