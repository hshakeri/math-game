/**
 * Castle of Theorems — Castle Keep Portcullis Diagram (Factor Dials)
 * client/diagrams/castle-keep.js
 */

export function render(spec, mode = 'hint', state = null) {
  const isWorkspace = mode === 'workspace';

  const factored = state?.factored || [null, null];
  const assignments = state?.assignments || {};
  const completed = Boolean(state?.completed);

  let svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 380" role="img"
     aria-label="Castle Keep Portcullis Factor Dials" class="diagram-svg castle-keep-svg">
  <rect width="800" height="380" rx="12" fill="#1c2631" />

  <text x="400" y="32" fill="#c8963e" font-size="18" font-weight="bold" text-anchor="middle">
    CASTLE KEEP PORTCULLIS — THE RUNE SPLITTING RULE
  </text>

  <!-- Left Clue Dial: Product 34 (Jimmy × Kimmy) -->
  <g class="clue-dial clue-0" transform="translate(180, 110)">
    <circle cx="0" cy="0" r="50" fill="#233140" stroke="#c8963e" stroke-width="3" />
    <text x="0" y="-8" fill="#5dade2" font-size="12" text-anchor="middle">CLUE 1</text>
    <text x="0" y="20" fill="#f8fafc" font-size="28" font-weight="bold" text-anchor="middle">34</text>

    <!-- Factor Leaves -->
    <g class="factor-leaves" transform="translate(0, 80)">
      <circle cx="-35" cy="0" r="22" fill="#1c2631" stroke="#3d5166" stroke-width="2" />
      <text x="-35" y="6" fill="#2ecc71" font-size="16" font-weight="bold" text-anchor="middle">
        ${factored[0] ? factored[0][0] : '?'}
      </text>

      <circle cx="35" cy="0" r="22" fill="#1c2631" stroke="#3d5166" stroke-width="2" />
      <text x="35" y="6" fill="#2ecc71" font-size="16" font-weight="bold" text-anchor="middle">
        ${factored[0] ? factored[0][1] : '?'}
      </text>
    </g>

    ${isWorkspace && !factored[0] ? `
    <g class="btn-factor-34" data-action="factor" data-idx="0" data-factors="2,17" transform="translate(-60, 115)" cursor="pointer">
      <rect x="0" y="0" width="120" height="30" rx="6" fill="#5dade2" />
      <text x="60" y="20" fill="#1c2631" font-size="12" font-weight="bold" text-anchor="middle">Split into 2 × 17</text>
    </g>` : ''}
  </g>

  <!-- Right Clue Dial: Product 85 (Kimmy × Timmy) -->
  <g class="clue-dial clue-1" transform="translate(620, 110)">
    <circle cx="0" cy="0" r="50" fill="#233140" stroke="#c8963e" stroke-width="3" />
    <text x="0" y="-8" fill="#5dade2" font-size="12" text-anchor="middle">CLUE 2</text>
    <text x="0" y="20" fill="#f8fafc" font-size="28" font-weight="bold" text-anchor="middle">85</text>

    <!-- Factor Leaves -->
    <g class="factor-leaves" transform="translate(0, 80)">
      <circle cx="-35" cy="0" r="22" fill="#1c2631" stroke="#3d5166" stroke-width="2" />
      <text x="-35" y="6" fill="#2ecc71" font-size="16" font-weight="bold" text-anchor="middle">
        ${factored[1] ? factored[1][0] : '?'}
      </text>

      <circle cx="35" cy="0" r="22" fill="#1c2631" stroke="#3d5166" stroke-width="2" />
      <text x="35" y="6" fill="#2ecc71" font-size="16" font-weight="bold" text-anchor="middle">
        ${factored[1] ? factored[1][1] : '?'}
      </text>
    </g>

    ${isWorkspace && !factored[1] ? `
    <g class="btn-factor-85" data-action="factor" data-idx="1" data-factors="5,17" transform="translate(-60, 115)" cursor="pointer">
      <rect x="0" y="0" width="120" height="30" rx="6" fill="#5dade2" />
      <text x="60" y="20" fill="#1c2631" font-size="12" font-weight="bold" text-anchor="middle">Split into 5 × 17</text>
    </g>` : ''}
  </g>

  <!-- Center Guardian Dials: Jimmy, Kimmy (Bridge), Timmy -->
  <g class="guardians-trio" transform="translate(400, 150)">
    <!-- Kimmy (Center / Shared Bridge) -->
    <g class="guardian-kimmy" transform="translate(0, -30)">
      <circle cx="0" cy="0" r="44" fill="#233140" stroke="#c8963e" stroke-width="${assignments.Kimmy ? 4 : 2}" />
      <text x="0" y="-12" fill="#cbd5e1" font-size="13" font-weight="600" text-anchor="middle">Kimmy (Shared)</text>
      <text x="0" y="18" fill="#c8963e" font-size="24" font-weight="bold" text-anchor="middle">
        ${assignments.Kimmy || '?'}
      </text>
      ${isWorkspace && factored[0] && factored[1] && !assignments.Kimmy ? `
      <g class="btn-assign-kimmy" data-action="assign-shared" data-name="Kimmy" data-val="17" transform="translate(-55, 52)" cursor="pointer">
        <rect x="0" y="0" width="110" height="28" rx="6" fill="#c8963e" />
        <text x="55" y="19" fill="#1c2631" font-size="12" font-weight="bold" text-anchor="middle">Assign Shared 17</text>
      </g>` : ''}
    </g>

    <!-- Jimmy (Left) -->
    <g class="guardian-jimmy" transform="translate(-110, 50)">
      <circle cx="0" cy="0" r="34" fill="#233140" stroke="#3d5166" stroke-width="2" />
      <text x="0" y="-8" fill="#5dade2" font-size="11" text-anchor="middle">Jimmy</text>
      <text x="0" y="16" fill="#f8fafc" font-size="20" font-weight="bold" text-anchor="middle">
        ${assignments.Jimmy || '?'}
      </text>
      ${isWorkspace && assignments.Kimmy && !assignments.Jimmy ? `
      <g class="btn-assign-jimmy" data-action="assign" data-name="Jimmy" data-val="2" transform="translate(-40, 42)" cursor="pointer">
        <rect x="0" y="0" width="80" height="26" rx="4" fill="#5dade2" />
        <text x="40" y="18" fill="#1c2631" font-size="11" font-weight="bold" text-anchor="middle">Assign 2</text>
      </g>` : ''}
    </g>

    <!-- Timmy (Right) -->
    <g class="guardian-timmy" transform="translate(110, 50)">
      <circle cx="0" cy="0" r="34" fill="#233140" stroke="#3d5166" stroke-width="2" />
      <text x="0" y="-8" fill="#5dade2" font-size="11" text-anchor="middle">Timmy</text>
      <text x="0" y="16" fill="#f8fafc" font-size="20" font-weight="bold" text-anchor="middle">
        ${assignments.Timmy || '?'}
      </text>
      ${isWorkspace && assignments.Kimmy && !assignments.Timmy ? `
      <g class="btn-assign-timmy" data-action="assign" data-name="Timmy" data-val="5" transform="translate(-40, 42)" cursor="pointer">
        <rect x="0" y="0" width="80" height="26" rx="4" fill="#5dade2" />
        <text x="40" y="18" fill="#1c2631" font-size="11" font-weight="bold" text-anchor="middle">Assign 5</text>
      </g>` : ''}
    </g>
  </g>

  <!-- Portcullis Opening Sum Bar -->
  <g class="portcullis-sum" transform="translate(400, 335)">
    <rect x="-240" y="-22" width="480" height="44" rx="8" fill="#233140" stroke="${completed ? '#27ae60' : '#3d5166'}" stroke-width="2" />
    <text x="-210" y="6" fill="#cbd5e1" font-size="14" font-weight="600">
      Portcullis Rune Code (Jimmy + Kimmy + Timmy):
    </text>

    ${assignments.Jimmy && assignments.Kimmy && assignments.Timmy && !completed && isWorkspace ? `
    <g class="btn-submit-sum" data-action="submit-sum" data-val="24" transform="translate(120, -14)" cursor="pointer">
      <rect x="0" y="0" width="100" height="28" rx="6" fill="#27ae60" />
      <text x="50" y="19" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">Submit 24</text>
    </g>` : ''}

    ${completed ? `
    <text x="170" y="6" fill="#2ecc71" font-size="16" font-weight="bold" text-anchor="middle">
      Code 24 Accepted!
    </text>` : ''}
  </g>
</svg>`;

  return svg;
}

export function mount(container, spec, mode, state, onStep) {
  if (typeof window === 'undefined' || !container) return;
  container.innerHTML = render(spec, mode, state);

  if (mode !== 'workspace' || !onStep) return;

  container.addEventListener('click', (e) => {
    const factorBtn = e.target.closest('[data-action="factor"]');
    if (factorBtn) {
      const productIndex = Number(factorBtn.dataset.idx);
      const factors = factorBtn.dataset.factors.split(',').map(Number);
      onStep({ action: 'factor', productIndex, factors });
      return;
    }

    const assignSharedBtn = e.target.closest('[data-action="assign-shared"]');
    if (assignSharedBtn) {
      const guardian = assignSharedBtn.dataset.name;
      const value = Number(assignSharedBtn.dataset.val);
      onStep({ action: 'assign_shared', guardian, value });
      return;
    }

    const assignBtn = e.target.closest('[data-action="assign"]');
    if (assignBtn) {
      const guardian = assignBtn.dataset.name;
      const value = Number(assignBtn.dataset.val);
      onStep({ action: 'assign', guardian, value });
      return;
    }

    const submitSumBtn = e.target.closest('[data-action="submit-sum"]');
    if (submitSumBtn) {
      const value = Number(submitSumBtn.dataset.val);
      onStep({ action: 'submit_sum', value });
      return;
    }
  });
}
