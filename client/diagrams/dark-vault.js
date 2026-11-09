/**
 * Castle of Theorems — Alchemist's Dark Vault Diagram (Pigeonhole Principle)
 * client/diagrams/dark-vault.js
 */

export function render(spec, mode = 'hint', state = null) {
  const binsCount = spec?.params?.bins || 3;
  const labels = spec?.params?.labels || ['Ruby', 'Sapphire', 'Emerald'];
  const colors = ['#e74c3c', '#3498db', '#2ecc71'];
  const isWorkspace = mode === 'workspace';

  const placedCounts = state?.bins || [0, 0, 0];
  const totalPlaced = state?.totalPlaced || placedCounts.reduce((a, b) => a + b, 0);

  // Derive target dynamically from state or spec (handles null state in hint mode)
  const target = state?.target || (
    spec?.params?.target
      ? spec.params.target
      : (spec?.params?.threshold === 12 || (spec?.params?.perBin === 12 && !spec?.params?.threshold)
          ? { different: true }
          : (spec?.params?.threshold ? { same: spec.params.threshold } : { same: 2 }))
  );
  const completed = Boolean(state?.completed);

  // Compute maximal dodging capacity
  let maxWaste = 0;
  if (target.same) {
    maxWaste = binsCount * (target.same - 1);
  } else if (target.different) {
    maxWaste = state?.perBin || spec?.params?.perBin || 12;
  }
  const isMaximal = totalPlaced === maxWaste;

  let svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 380" role="img"
     aria-label="Alchemist's Dark Vault Crystal Bins" class="diagram-svg dark-vault-svg">
  <rect width="800" height="380" rx="12" fill="#1c2631" />

  <!-- Header Banner: Torch Constraint Derived Dynamically -->
  <g class="vault-banner" transform="translate(400, 35)">
    <text x="0" y="0" fill="#c8963e" font-size="18" font-weight="bold" text-anchor="middle" letter-spacing="0.5">
      ALCHEMIST'S DARK VAULT — GOBLIN WORST-CASE DODGE
    </text>
    <text x="0" y="24" fill="#5dade2" font-size="14" text-anchor="middle">
      Goal: ${target.same ? `Avoid matching ${target.same} of any color` : 'Avoid grabbing 2 different colors'}
    </text>
  </g>

  <!-- 3 Crystal Bins: Ruby, Sapphire, Emerald -->
  <g class="crystal-bins" transform="translate(100, 90)">`;

  const binWidth = 160;
  const binSpacing = 40;
  for (let i = 0; i < binsCount; i++) {
    const bx = i * (binWidth + binSpacing);
    const count = placedCounts[i] || 0;
    const color = colors[i % colors.length];
    const label = labels[i] || `Bin ${i + 1}`;

    svg += `
    <g class="bin-group bin-${i}" transform="translate(${bx}, 0)">
      <!-- Bin Vessel -->
      <rect x="0" y="0" width="${binWidth}" height="180" rx="12" fill="#233140" stroke="${color}" stroke-width="3" />
      <rect x="10" y="10" width="${binWidth - 20}" height="32" rx="6" fill="${color}" opacity="0.2" />
      <text x="${binWidth / 2}" y="32" fill="${color}" font-size="16" font-weight="bold" text-anchor="middle">${label}</text>

      <!-- Crystal Tokens Stack -->
      <g class="crystals-stack" transform="translate(${binWidth / 2}, 140)">`;

    for (let c = 0; c < count; c++) {
      const cy = -c * 24;
      svg += `
        <polygon points="0,${cy - 12} 14,${cy} 0,${cy + 12} -14,${cy}" fill="${color}" stroke="#ffffff" stroke-width="1.5" />`;
    }

    // Dashed outline for next pick in hint mode or empty bin
    if (!isWorkspace && count === 0) {
      svg += `
        <polygon points="0,-12 14,0 0,12 -14,0" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6" />`;
    }

    svg += `
      </g>

      <!-- Bin Counter Display -->
      <text x="${binWidth / 2}" y="170" fill="#f8fafc" font-size="14" font-weight="600" text-anchor="middle">
        Holds: ${count}
      </text>

      <!-- Interactive Tap Drop Button in Workspace Mode (Touch target >= 44px) -->
      ${isWorkspace && !completed && !isMaximal ? `
      <g class="btn-drop-crystal" data-action="place" data-bin="${i}" transform="translate(${binWidth / 2 - 50}, 195)" cursor="pointer">
        <rect x="0" y="0" width="100" height="44" rx="8" fill="${color}" />
        <text x="50" y="27" fill="#ffffff" font-size="14" font-weight="bold" text-anchor="middle">+ Place</text>
      </g>` : ''}
    </g>`;
  }

  svg += `
  </g>`;

  // Dodge Status & Deduction Controls Strip: Rendered ONLY in workspace mode to protect information diet
  if (isWorkspace) {
    svg += `
  <g class="dodge-summary" transform="translate(400, 340)">
    <rect x="-370" y="-25" width="740" height="50" rx="8" fill="#233140" stroke="${isMaximal ? '#27ae60' : '#3d5166'}" stroke-width="2" />
    <text x="-350" y="6" fill="#cbd5e1" font-size="14" font-weight="600">
      Goblin Crystals Wasted: <tspan fill="#c8963e" font-weight="bold">${totalPlaced} / ${maxWaste}</tspan>
    </text>

    ${isMaximal && !completed ? `
    <g class="interactive-grab-controls" transform="translate(100, -22)">
      <!-- Stepper for certain grab deduction -->
      <g class="btn-grab-minus" data-action="grab-delta" data-delta="-1" cursor="pointer">
        <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">−</text>
      </g>
      <rect x="48" y="0" width="48" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
      <text x="72" y="28" fill="#f8fafc" font-size="16" font-weight="bold" text-anchor="middle" id="vault-input-grab">${totalPlaced + 1}</text>
      <g class="btn-grab-plus" data-action="grab-delta" data-delta="1" cursor="pointer">
        <rect x="100" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="122" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">+</text>
      </g>
      <g class="btn-submit-grab" data-action="submit-count" transform="translate(152, 0)" cursor="pointer">
        <rect x="0" y="0" width="130" height="44" rx="8" fill="#27ae60" />
        <text x="65" y="27" fill="#ffffff" font-size="14" font-weight="bold" text-anchor="middle">Confirm Grab</text>
      </g>
    </g>` : ''}

    ${completed ? `
    <text x="200" y="6" fill="#2ecc71" font-size="14" font-weight="bold">
      Torch Satisfied! Guaranteed at ${state?.submittedCount ?? (totalPlaced + 1)}
    </text>` : ''}
  </g>`;
  }

  svg += `
</svg>`;

  return svg;
}

export function mount(container, spec, mode, state, onStep) {
  if (typeof window === 'undefined' || !container) return;
  container.innerHTML = render(spec, mode, state);

  if (mode !== 'workspace' || !onStep) return;

  const placedCounts = state?.bins || [0, 0, 0];
  const totalPlaced = state?.totalPlaced || placedCounts.reduce((a, b) => a + b, 0);
  let currentGrabVal = totalPlaced + 1;

  const updateGrabDisplay = () => {
    const el = container.querySelector('#vault-input-grab');
    if (el) el.textContent = currentGrabVal;
  };

  container.addEventListener('click', (e) => {
    const placeBtn = e.target.closest('[data-action="place"]');
    if (placeBtn) {
      const bin = Number(placeBtn.dataset.bin);
      onStep({ action: 'place', bin });
      return;
    }

    const grabDeltaBtn = e.target.closest('[data-action="grab-delta"]');
    if (grabDeltaBtn) {
      const delta = Number(grabDeltaBtn.dataset.delta);
      currentGrabVal = Math.max(1, currentGrabVal + delta);
      updateGrabDisplay();
      return;
    }

    const submitBtn = e.target.closest('[data-action="submit-count"]');
    if (submitBtn) {
      onStep({ action: 'submit_count', value: currentGrabVal });
      return;
    }
  });
}
