/**
 * Castle of Theorems — Courtyard of Five Shields Diagram (Seam Grid)
 * client/diagrams/five-shields.js
 */

export function render(spec, mode = 'hint', state = null) {
  const outerPerimeter = spec?.params?.outerPerimeter ?? 66;
  const isWorkspace = mode === 'workspace';

  const units = state?.units || null;
  const outerUnits = state?.outerUnits;
  const cubitsPerUnit = state?.cubitsPerUnit;
  const shieldPerimeter = state?.shieldPerimeter;
  const completed = Boolean(state?.completed);

  // Layout geometry for Courtyard Shields
  const scale = 36;
  const totalW = 6 * scale; // 216 px
  const totalH = 5 * scale; // 180 px
  // When in hint mode, center courtyard; when workspace, place on left/center
  const ox = isWorkspace ? 290 : 292;
  const oy = isWorkspace ? 70 : 80;

  let svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 380" role="img"
     aria-label="Courtyard of Five Shields Seam Grid" class="diagram-svg five-shields-svg">
  <rect width="800" height="380" rx="12" fill="#1c2631" />

  <text x="400" y="32" fill="#c8963e" font-size="18" font-weight="bold" text-anchor="middle">
    COURTYARD OF FIVE SHIELDS — THE HIDDEN SEAMS RULE
  </text>

  <!-- 5 Shields Compound Structure -->
  <g class="shields-courtyard" transform="translate(${ox}, ${oy})">
    <!-- Top Row: 3 Upright Shields (S1, S2, S3) -->
    <g class="top-row">
      <rect x="0" y="0" width="${2 * scale}" height="${3 * scale}" rx="4" fill="#233140" stroke="#3d5166" stroke-width="2" />
      <text x="${1 * scale}" y="${1.5 * scale}" fill="#5dade2" font-size="15" font-weight="bold" text-anchor="middle">S1</text>

      <rect x="${2 * scale}" y="0" width="${2 * scale}" height="${3 * scale}" rx="4" fill="#233140" stroke="#3d5166" stroke-width="2" />
      <text x="${3 * scale}" y="${1.5 * scale}" fill="#5dade2" font-size="15" font-weight="bold" text-anchor="middle">S2</text>

      <rect x="${4 * scale}" y="0" width="${2 * scale}" height="${3 * scale}" rx="4" fill="#233140" stroke="#3d5166" stroke-width="2" />
      <text x="${5 * scale}" y="${1.5 * scale}" fill="#5dade2" font-size="15" font-weight="bold" text-anchor="middle">S3</text>
    </g>

    <!-- Bottom Row: 2 Flat Shields (S4, S5) -->
    <g class="bottom-row" transform="translate(0, ${3 * scale})">
      <rect x="0" y="0" width="${3 * scale}" height="${2 * scale}" rx="4" fill="#233140" stroke="#3d5166" stroke-width="2" />
      <text x="${1.5 * scale}" y="${1 * scale}" fill="#5dade2" font-size="15" font-weight="bold" text-anchor="middle">S4</text>

      <rect x="${3 * scale}" y="0" width="${3 * scale}" height="${2 * scale}" rx="4" fill="#233140" stroke="#3d5166" stroke-width="2" />
      <text x="${4.5 * scale}" y="${1 * scale}" fill="#5dade2" font-size="15" font-weight="bold" text-anchor="middle">S5</text>
    </g>

    <!-- Middle Seam Highlight (3 short = 2 long) -->
    <line x1="0" y1="${3 * scale}" x2="${totalW}" y2="${3 * scale}" stroke="#c8963e" stroke-width="4" stroke-dasharray="6 4" />
    <circle cx="${totalW / 2}" cy="${3 * scale}" r="8" fill="#c8963e" />
    <text x="${totalW / 2}" y="${3 * scale - 12}" fill="#c8963e" font-size="14" font-weight="bold" text-anchor="middle">
      Shared Seam: 3 Short = 2 Long
    </text>

    <!-- Outer Walk Boundary Highlight -->
    <rect x="-4" y="-4" width="${totalW + 8}" height="${totalH + 8}" rx="8" fill="none" stroke="#5dade2" stroke-width="3" stroke-dasharray="8 6" />
  </g>`;

  // In Workspace Mode: Render interactive deduction sidebars
  if (isWorkspace) {
    svg += `
  <!-- Left Sidebar: Seam Unit Stepper & Equation Testing -->
  <g class="unit-controls" transform="translate(25, 60)">
    <rect x="0" y="0" width="230" height="290" rx="10" fill="#233140" stroke="#3d5166" stroke-width="2" />
    <text x="115" y="28" fill="#f8fafc" font-size="16" font-weight="bold" text-anchor="middle">Seam Ratio</text>

    ${!units ? `
    <!-- Short Side Stepper (Touch targets >= 44px) -->
    <text x="16" y="62" fill="#cbd5e1" font-size="14">Short Side (s):</text>
    <g class="btn-step-short-minus" data-action="delta-short" data-delta="-1" transform="translate(16, 72)" cursor="pointer">
      <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
      <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">−</text>
    </g>
    <rect x="66" y="72" width="50" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
    <text x="91" y="100" fill="#c8963e" font-size="18" font-weight="bold" text-anchor="middle" id="shield-val-short">1</text>
    <g class="btn-step-short-plus" data-action="delta-short" data-delta="1" transform="translate(122, 72)" cursor="pointer">
      <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
      <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">+</text>
    </g>

    <!-- Long Side Stepper (Touch targets >= 44px) -->
    <text x="16" y="142" fill="#cbd5e1" font-size="14">Long Side (l):</text>
    <g class="btn-step-long-minus" data-action="delta-long" data-delta="-1" transform="translate(16, 152)" cursor="pointer">
      <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
      <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">−</text>
    </g>
    <rect x="66" y="152" width="50" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
    <text x="91" y="180" fill="#c8963e" font-size="18" font-weight="bold" text-anchor="middle" id="shield-val-long">1</text>
    <g class="btn-step-long-plus" data-action="delta-long" data-delta="1" transform="translate(122, 152)" cursor="pointer">
      <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
      <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">+</text>
    </g>

    <!-- Neutral Confirmation Button -->
    <g class="btn-lock-units" data-action="set-units" transform="translate(16, 222)" cursor="pointer">
      <rect x="0" y="0" width="198" height="44" rx="8" fill="#27ae60" />
      <text x="99" y="27" fill="#ffffff" font-size="14" font-weight="bold" text-anchor="middle">Confirm Units</text>
    </g>` : `
    <text x="20" y="75" fill="#cbd5e1" font-size="14">Short Side (s):</text>
    <text x="180" y="75" fill="#c8963e" font-size="18" font-weight="bold">${units.short}</text>

    <text x="20" y="125" fill="#cbd5e1" font-size="14">Long Side (l):</text>
    <text x="180" y="125" fill="#c8963e" font-size="18" font-weight="bold">${units.long}</text>

    <text x="20" y="175" fill="#2ecc71" font-size="14" font-weight="bold">Seam Match Confirmed ✓</text>
    <text x="20" y="205" fill="#cbd5e1" font-size="14">3 × ${units.short} = 2 × ${units.long}</text>`}
  </g>

  <!-- Right Sidebar: Step-by-Step Deduction Workspace -->
  <g class="step-deductions" transform="translate(545, 60)">
    <rect x="0" y="0" width="230" height="290" rx="10" fill="#233140" stroke="#3d5166" stroke-width="2" />
    <text x="115" y="28" fill="#f8fafc" font-size="16" font-weight="bold" text-anchor="middle">Deductions</text>

    <!-- 1. Outer Units Walk -->
    <text x="16" y="55" fill="#cbd5e1" font-size="14">1. Outer Units Walk:</text>
    ${outerUnits ? `
    <text x="16" y="78" fill="#2ecc71" font-size="15" font-weight="bold">${outerUnits} units ✓</text>` : (state?.units ? `
    <g class="interactive-outer-controls" transform="translate(16, 65)">
      <g class="btn-outer-minus" data-action="delta-outer" data-delta="-1" cursor="pointer">
        <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">−</text>
      </g>
      <rect x="48" y="0" width="48" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
      <text x="72" y="28" fill="#f8fafc" font-size="16" font-weight="bold" text-anchor="middle" id="shield-val-outer">20</text>
      <g class="btn-outer-plus" data-action="delta-outer" data-delta="1" cursor="pointer">
        <rect x="100" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="122" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">+</text>
      </g>
      <g class="btn-outer-units" data-action="outer-units" transform="translate(0, 50)" cursor="pointer">
        <rect x="0" y="0" width="198" height="44" rx="6" fill="#5dade2" />
        <text x="99" y="27" fill="#1c2631" font-size="14" font-weight="bold" text-anchor="middle">Confirm Units</text>
      </g>
    </g>` : `
    <text x="16" y="78" fill="#aed6f1" font-size="14">Set seam units first</text>`)}

    <!-- 2. Cubits per Unit -->
    ${outerUnits ? `
    <text x="16" y="135" fill="#cbd5e1" font-size="14">2. Cubits per Unit:</text>
    ${cubitsPerUnit ? `
    <text x="16" y="158" fill="#2ecc71" font-size="15" font-weight="bold">${cubitsPerUnit} cubits/unit ✓</text>` : `
    <g class="interactive-cubits-controls" transform="translate(16, 145)">
      <g class="btn-cubits-minus" data-action="delta-cubits" data-delta="-1" cursor="pointer">
        <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">−</text>
      </g>
      <rect x="48" y="0" width="48" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
      <text x="72" y="28" fill="#f8fafc" font-size="16" font-weight="bold" text-anchor="middle" id="shield-val-cubits">1</text>
      <g class="btn-cubits-plus" data-action="delta-cubits" data-delta="1" cursor="pointer">
        <rect x="100" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="122" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">+</text>
      </g>
      <g class="btn-cubits-per-unit" data-action="cubits-per-unit" transform="translate(0, 50)" cursor="pointer">
        <rect x="0" y="0" width="198" height="44" rx="6" fill="#5dade2" />
        <text x="99" y="27" fill="#1c2631" font-size="14" font-weight="bold" text-anchor="middle">Confirm Cubits</text>
      </g>
    </g>`}` : ''}

    <!-- 3. One Shield Walk -->
    ${cubitsPerUnit ? `
    <text x="16" y="215" fill="#cbd5e1" font-size="14">3. One Shield Perimeter:</text>
    ${completed ? `
    <text x="16" y="238" fill="#2ecc71" font-size="15" font-weight="bold">${shieldPerimeter} cubits ✓</text>` : `
    <g class="interactive-perimeter-controls" transform="translate(16, 225)">
      <g class="btn-perim-minus" data-action="delta-perim" data-delta="-1" cursor="pointer">
        <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">−</text>
      </g>
      <rect x="48" y="0" width="48" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
      <text x="72" y="28" fill="#f8fafc" font-size="16" font-weight="bold" text-anchor="middle" id="shield-val-perim">25</text>
      <g class="btn-perim-plus" data-action="delta-perim" data-delta="1" cursor="pointer">
        <rect x="100" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="122" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">+</text>
      </g>
      <g class="btn-shield-perimeter" data-action="shield-perimeter" transform="translate(0, 50)" cursor="pointer">
        <rect x="0" y="0" width="198" height="44" rx="6" fill="#27ae60" />
        <text x="99" y="27" fill="#ffffff" font-size="14" font-weight="bold" text-anchor="middle">Confirm Perimeter</text>
      </g>
    </g>`}` : ''}
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

  let currentShort = 1;
  let currentLong = 1;
  let currentOuter = 20;
  let currentCubits = 1;
  let currentPerim = 25;

  const updateDisplays = () => {
    const sEl = container.querySelector('#shield-val-short');
    if (sEl) sEl.textContent = currentShort;
    const lEl = container.querySelector('#shield-val-long');
    if (lEl) lEl.textContent = currentLong;
    const oEl = container.querySelector('#shield-val-outer');
    if (oEl) oEl.textContent = currentOuter;
    const cEl = container.querySelector('#shield-val-cubits');
    if (cEl) cEl.textContent = currentCubits;
    const pEl = container.querySelector('#shield-val-perim');
    if (pEl) pEl.textContent = currentPerim;
  };

  container.addEventListener('click', (e) => {
    // Short / Long Unit Steppers
    const deltaShortBtn = e.target.closest('[data-action="delta-short"]');
    if (deltaShortBtn) {
      const delta = Number(deltaShortBtn.dataset.delta);
      currentShort = Math.max(1, currentShort + delta);
      updateDisplays();
      return;
    }

    const deltaLongBtn = e.target.closest('[data-action="delta-long"]');
    if (deltaLongBtn) {
      const delta = Number(deltaLongBtn.dataset.delta);
      currentLong = Math.max(1, currentLong + delta);
      updateDisplays();
      return;
    }

    // Outer Units Stepper
    const deltaOuterBtn = e.target.closest('[data-action="delta-outer"]');
    if (deltaOuterBtn) {
      const delta = Number(deltaOuterBtn.dataset.delta);
      currentOuter = Math.max(1, currentOuter + delta);
      updateDisplays();
      return;
    }

    // Cubits per Unit Stepper
    const deltaCubitsBtn = e.target.closest('[data-action="delta-cubits"]');
    if (deltaCubitsBtn) {
      const delta = Number(deltaCubitsBtn.dataset.delta);
      currentCubits = Math.max(1, currentCubits + delta);
      updateDisplays();
      return;
    }

    // Perimeter Stepper
    const deltaPerimBtn = e.target.closest('[data-action="delta-perim"]');
    if (deltaPerimBtn) {
      const delta = Number(deltaPerimBtn.dataset.delta);
      currentPerim = Math.max(1, currentPerim + delta);
      updateDisplays();
      return;
    }

    // Submissions
    const lockUnitsBtn = e.target.closest('[data-action="set-units"]');
    if (lockUnitsBtn) {
      onStep({ action: 'set_units', short: currentShort, long: currentLong });
      return;
    }

    const outerUnitsBtn = e.target.closest('[data-action="outer-units"]');
    if (outerUnitsBtn) {
      onStep({ action: 'outer_units', value: currentOuter });
      return;
    }

    const cubitsBtn = e.target.closest('[data-action="cubits-per-unit"]');
    if (cubitsBtn) {
      onStep({ action: 'cubits_per_unit', value: currentCubits });
      return;
    }

    const shieldBtn = e.target.closest('[data-action="shield-perimeter"]');
    if (shieldBtn) {
      onStep({ action: 'shield_perimeter', value: currentPerim });
      return;
    }
  });
}
