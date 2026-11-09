/**
 * Castle of Theorems — Courtyard of Five Shields Diagram (Seam Grid)
 * client/diagrams/five-shields.js
 */

export function render(spec, mode = 'hint', state = null) {
  const outerPerimeter = spec?.params?.outerPerimeter ?? 66;
  const isWorkspace = mode === 'workspace';

  const units = state?.units || { short: 2, long: 3 };
  const outerUnits = state?.outerUnits;
  const cubitsPerUnit = state?.cubitsPerUnit;
  const shieldPerimeter = state?.shieldPerimeter;
  const completed = Boolean(state?.completed);

  // Layout: Top row 3 upright shields (width s, height l)
  // Bottom row 2 flat shields (width l, height s)
  const scale = 36;
  const totalW = 6 * scale; // 216 px
  const totalH = 5 * scale; // 180 px
  const ox = 290;
  const oy = 60;

  let svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 380" role="img"
     aria-label="Courtyard of Five Shields Seam Grid" class="diagram-svg five-shields-svg">
  <rect width="800" height="380" rx="12" fill="#1c2631" />

  <text x="400" y="32" fill="#c8963e" font-size="17" font-weight="bold" text-anchor="middle">
    COURTYARD OF FIVE SHIELDS — THE HIDDEN SEAMS RULE
  </text>

  <!-- 5 Shields Compound Structure -->
  <g class="shields-courtyard" transform="translate(${ox}, ${oy})">
    <!-- Top Row: 3 Upright Shields (S1, S2, S3) -->
    <g class="top-row">
      <rect x="0" y="0" width="${2 * scale}" height="${3 * scale}" rx="4" fill="#233140" stroke="#3d5166" stroke-width="2" />
      <text x="${1 * scale}" y="${1.5 * scale}" fill="#5dade2" font-size="14" font-weight="bold" text-anchor="middle">S1</text>

      <rect x="${2 * scale}" y="0" width="${2 * scale}" height="${3 * scale}" rx="4" fill="#233140" stroke="#3d5166" stroke-width="2" />
      <text x="${3 * scale}" y="${1.5 * scale}" fill="#5dade2" font-size="14" font-weight="bold" text-anchor="middle">S2</text>

      <rect x="${4 * scale}" y="0" width="${2 * scale}" height="${3 * scale}" rx="4" fill="#233140" stroke="#3d5166" stroke-width="2" />
      <text x="${5 * scale}" y="${1.5 * scale}" fill="#5dade2" font-size="14" font-weight="bold" text-anchor="middle">S3</text>
    </g>

    <!-- Bottom Row: 2 Flat Shields (S4, S5) -->
    <g class="bottom-row" transform="translate(0, ${3 * scale})">
      <rect x="0" y="0" width="${3 * scale}" height="${2 * scale}" rx="4" fill="#233140" stroke="#3d5166" stroke-width="2" />
      <text x="${1.5 * scale}" y="${1 * scale}" fill="#5dade2" font-size="14" font-weight="bold" text-anchor="middle">S4</text>

      <rect x="${3 * scale}" y="0" width="${3 * scale}" height="${2 * scale}" rx="4" fill="#233140" stroke="#3d5166" stroke-width="2" />
      <text x="${4.5 * scale}" y="${1 * scale}" fill="#5dade2" font-size="14" font-weight="bold" text-anchor="middle">S5</text>
    </g>

    <!-- Middle Seam Highlight (3 short = 2 long) -->
    <line x1="0" y1="${3 * scale}" x2="${totalW}" y2="${3 * scale}" stroke="#c8963e" stroke-width="4" stroke-dasharray="6 4" />
    <circle cx="${totalW / 2}" cy="${3 * scale}" r="8" fill="#c8963e" />
    <text x="${totalW / 2}" y="${3 * scale - 10}" fill="#c8963e" font-size="12" font-weight="bold" text-anchor="middle">
      Shared Seam: 3 Short = 2 Long
    </text>

    <!-- Outer Walk Boundary Highlight -->
    <rect x="-4" y="-4" width="${totalW + 8}" height="${totalH + 8}" rx="8" fill="none" stroke="#5dade2" stroke-width="3" stroke-dasharray="8 6" />
  </g>

  <!-- Left Sidebar: Seam Unit Stepper / Status -->
  <g class="unit-controls" transform="translate(40, 70)">
    <rect x="0" y="0" width="210" height="200" rx="10" fill="#233140" stroke="#3d5166" stroke-width="2" />
    <text x="105" y="28" fill="#f8fafc" font-size="15" font-weight="bold" text-anchor="middle">Seam Ratio</text>

    <text x="20" y="65" fill="#cbd5e1" font-size="13">Short Side (s):</text>
    <text x="170" y="65" fill="#c8963e" font-size="16" font-weight="bold">${units.short}</text>

    <text x="20" y="105" fill="#cbd5e1" font-size="13">Long Side (l):</text>
    <text x="170" y="105" fill="#c8963e" font-size="16" font-weight="bold">${units.long}</text>

    <text x="20" y="145" fill="#cbd5e1" font-size="12">3 × ${units.short} = 2 × ${units.long}</text>
    <text x="20" y="165" fill="${3 * units.short === 2 * units.long ? '#2ecc71' : '#e74c3c'}" font-size="13" font-weight="bold">
      ${3 * units.short === 2 * units.long ? '✓ Seam Equation Fits!' : '✗ Ratio Mismatch'}
    </text>

    ${isWorkspace && !state?.units ? `
    <g class="btn-lock-units" data-action="set-units" data-short="${units.short}" data-long="${units.long}" transform="translate(25, 175)" cursor="pointer">
      <rect x="0" y="0" width="160" height="32" rx="6" fill="#27ae60" />
      <text x="80" y="21" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">Lock Units (2, 3)</text>
    </g>` : ''}
  </g>

  <!-- Right Sidebar: Step-by-Step Deduction Workspace -->
  <g class="step-deductions" transform="translate(550, 70)">
    <rect x="0" y="0" width="210" height="260" rx="10" fill="#233140" stroke="#3d5166" stroke-width="2" />
    <text x="105" y="28" fill="#f8fafc" font-size="15" font-weight="bold" text-anchor="middle">Deductions</text>

    <!-- Outer Walk in Units -->
    <text x="16" y="60" fill="#cbd5e1" font-size="12">1. Outer Units Walk:</text>
    <text x="16" y="80" fill="${outerUnits ? '#2ecc71' : '#aed6f1'}" font-size="14" font-weight="bold">
      ${outerUnits ? `${outerUnits} units` : '2×(6+5) = ?'}
    </text>
    ${isWorkspace && state?.units && !outerUnits ? `
    <g class="btn-outer-units" data-action="outer-units" data-val="22" transform="translate(16, 90)" cursor="pointer">
      <rect x="0" y="0" width="178" height="28" rx="4" fill="#5dade2" />
      <text x="89" y="19" fill="#1c2631" font-size="12" font-weight="bold" text-anchor="middle">Submit 22 Units</text>
    </g>` : ''}

    <!-- Cubits per Unit -->
    <text x="16" y="135" fill="#cbd5e1" font-size="12">2. Cubits per Unit:</text>
    <text x="16" y="155" fill="${cubitsPerUnit ? '#2ecc71' : '#aed6f1'}" font-size="14" font-weight="bold">
      ${cubitsPerUnit ? `${cubitsPerUnit} cubits/unit` : `${outerPerimeter} ÷ 22 = ?`}
    </text>
    ${isWorkspace && outerUnits && !cubitsPerUnit ? `
    <g class="btn-cubits-per-unit" data-action="cubits-per-unit" data-val="3" transform="translate(16, 165)" cursor="pointer">
      <rect x="0" y="0" width="178" height="28" rx="4" fill="#5dade2" />
      <text x="89" y="19" fill="#1c2631" font-size="12" font-weight="bold" text-anchor="middle">Submit 3 Cubits/Unit</text>
    </g>` : ''}

    <!-- Single Shield Walk -->
    <text x="16" y="210" fill="#cbd5e1" font-size="12">3. One Shield Walk:</text>
    <text x="16" y="230" fill="${completed ? '#2ecc71' : '#aed6f1'}" font-size="14" font-weight="bold">
      ${completed ? `${shieldPerimeter} cubits ✓` : '10 units × 3 = ?'}
    </text>
    ${isWorkspace && cubitsPerUnit && !completed ? `
    <g class="btn-shield-perimeter" data-action="shield-perimeter" data-val="30" transform="translate(16, 235)" cursor="pointer">
      <rect x="0" y="0" width="178" height="28" rx="4" fill="#27ae60" />
      <text x="89" y="19" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">Confirm 30 Cubits</text>
    </g>` : ''}
  </g>
</svg>`;

  return svg;
}

export function mount(container, spec, mode, state, onStep) {
  if (typeof window === 'undefined' || !container) return;
  container.innerHTML = render(spec, mode, state);

  if (mode !== 'workspace' || !onStep) return;

  container.addEventListener('click', (e) => {
    const lockUnitsBtn = e.target.closest('[data-action="set-units"]');
    if (lockUnitsBtn) {
      const short = Number(lockUnitsBtn.dataset.short);
      const long = Number(lockUnitsBtn.dataset.long);
      onStep({ action: 'set_units', short, long });
      return;
    }

    const outerUnitsBtn = e.target.closest('[data-action="outer-units"]');
    if (outerUnitsBtn) {
      const val = Number(outerUnitsBtn.dataset.val);
      onStep({ action: 'outer_units', value: val });
      return;
    }

    const cubitsBtn = e.target.closest('[data-action="cubits-per-unit"]');
    if (cubitsBtn) {
      const val = Number(cubitsBtn.dataset.val);
      onStep({ action: 'cubits_per_unit', value: val });
      return;
    }

    const shieldBtn = e.target.closest('[data-action="shield-perimeter"]');
    if (shieldBtn) {
      const val = Number(shieldBtn.dataset.val);
      onStep({ action: 'shield_perimeter', value: val });
      return;
    }
  });
}
