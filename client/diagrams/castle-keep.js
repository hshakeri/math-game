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
  <g class="clue-dial clue-0" transform="translate(170, 110)">
    <circle cx="0" cy="0" r="48" fill="#233140" stroke="#c8963e" stroke-width="3" />
    <text x="0" y="-8" fill="#5dade2" font-size="14" text-anchor="middle">CLUE 1</text>
    <text x="0" y="20" fill="#f8fafc" font-size="28" font-weight="bold" text-anchor="middle">34</text>

    <!-- Factor Leaves -->
    <g class="factor-leaves" transform="translate(0, 75)">
      <circle cx="-32" cy="0" r="22" fill="#1c2631" stroke="#3d5166" stroke-width="2" />
      <text x="-32" y="6" fill="#2ecc71" font-size="16" font-weight="bold" text-anchor="middle">
        ${factored[0] ? factored[0][0] : '?'}
      </text>

      <circle cx="32" cy="0" r="22" fill="#1c2631" stroke="#3d5166" stroke-width="2" />
      <text x="32" y="6" fill="#2ecc71" font-size="16" font-weight="bold" text-anchor="middle">
        ${factored[0] ? factored[0][1] : '?'}
      </text>
    </g>

    <!-- Interactive Factor Deduction Controls for Clue 1 (Touch targets >= 44px) -->
    ${isWorkspace && !factored[0] ? `
    <g class="interactive-factor-0" transform="translate(-75, 108)">
      <!-- Factor 1 Stepper -->
      <g class="btn-f0-1-minus" data-action="delta-f0-1" data-delta="-1" transform="translate(0, 0)" cursor="pointer">
        <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">−</text>
      </g>
      <rect x="48" y="0" width="54" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
      <text x="75" y="28" fill="#f8fafc" font-size="16" font-weight="bold" text-anchor="middle" id="keep-val-f0-1">2</text>
      <g class="btn-f0-1-plus" data-action="delta-f0-1" data-delta="1" transform="translate(106, 0)" cursor="pointer">
        <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">+</text>
      </g>

      <!-- Factor 2 Stepper -->
      <g class="btn-f0-2-minus" data-action="delta-f0-2" data-delta="-1" transform="translate(0, 48)" cursor="pointer">
        <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">−</text>
      </g>
      <rect x="48" y="48" width="54" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
      <text x="75" y="76" fill="#f8fafc" font-size="16" font-weight="bold" text-anchor="middle" id="keep-val-f0-2">2</text>
      <g class="btn-f0-2-plus" data-action="delta-f0-2" data-delta="1" transform="translate(106, 48)" cursor="pointer">
        <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">+</text>
      </g>

      <!-- Neutral Confirmation Button -->
      <g class="btn-factor-confirm-0" data-action="confirm-factor" data-idx="0" transform="translate(0, 96)" cursor="pointer">
        <rect x="0" y="0" width="150" height="44" rx="8" fill="#5dade2" />
        <text x="75" y="27" fill="#1c2631" font-size="14" font-weight="bold" text-anchor="middle">Confirm Factors</text>
      </g>
    </g>` : ''}
  </g>

  <!-- Right Clue Dial: Product 85 (Kimmy × Timmy) -->
  <g class="clue-dial clue-1" transform="translate(630, 110)">
    <circle cx="0" cy="0" r="48" fill="#233140" stroke="#c8963e" stroke-width="3" />
    <text x="0" y="-8" fill="#5dade2" font-size="14" text-anchor="middle">CLUE 2</text>
    <text x="0" y="20" fill="#f8fafc" font-size="28" font-weight="bold" text-anchor="middle">85</text>

    <!-- Factor Leaves -->
    <g class="factor-leaves" transform="translate(0, 75)">
      <circle cx="-32" cy="0" r="22" fill="#1c2631" stroke="#3d5166" stroke-width="2" />
      <text x="-32" y="6" fill="#2ecc71" font-size="16" font-weight="bold" text-anchor="middle">
        ${factored[1] ? factored[1][0] : '?'}
      </text>

      <circle cx="32" cy="0" r="22" fill="#1c2631" stroke="#3d5166" stroke-width="2" />
      <text x="32" y="6" fill="#2ecc71" font-size="16" font-weight="bold" text-anchor="middle">
        ${factored[1] ? factored[1][1] : '?'}
      </text>
    </g>

    <!-- Interactive Factor Deduction Controls for Clue 2 (Touch targets >= 44px) -->
    ${isWorkspace && !factored[1] ? `
    <g class="interactive-factor-1" transform="translate(-75, 108)">
      <!-- Factor 1 Stepper -->
      <g class="btn-f1-1-minus" data-action="delta-f1-1" data-delta="-1" transform="translate(0, 0)" cursor="pointer">
        <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">−</text>
      </g>
      <rect x="48" y="0" width="54" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
      <text x="75" y="28" fill="#f8fafc" font-size="16" font-weight="bold" text-anchor="middle" id="keep-val-f1-1">2</text>
      <g class="btn-f1-1-plus" data-action="delta-f1-1" data-delta="1" transform="translate(106, 0)" cursor="pointer">
        <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">+</text>
      </g>

      <!-- Factor 2 Stepper -->
      <g class="btn-f1-2-minus" data-action="delta-f1-2" data-delta="-1" transform="translate(0, 48)" cursor="pointer">
        <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">−</text>
      </g>
      <rect x="48" y="48" width="54" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
      <text x="75" y="76" fill="#f8fafc" font-size="16" font-weight="bold" text-anchor="middle" id="keep-val-f1-2">2</text>
      <g class="btn-f1-2-plus" data-action="delta-f1-2" data-delta="1" transform="translate(106, 48)" cursor="pointer">
        <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">+</text>
      </g>

      <!-- Neutral Confirmation Button -->
      <g class="btn-factor-confirm-1" data-action="confirm-factor" data-idx="1" transform="translate(0, 96)" cursor="pointer">
        <rect x="0" y="0" width="150" height="44" rx="8" fill="#5dade2" />
        <text x="75" y="27" fill="#1c2631" font-size="14" font-weight="bold" text-anchor="middle">Confirm Factors</text>
      </g>
    </g>` : ''}
  </g>

  <!-- Center Guardian Dials: Jimmy, Kimmy (Bridge), Timmy -->
  <g class="guardians-trio" transform="translate(400, 130)">
    <!-- Kimmy (Center / Shared Bridge) -->
    <g class="guardian-kimmy" transform="translate(0, -30)">
      <circle cx="0" cy="0" r="44" fill="#233140" stroke="#c8963e" stroke-width="${assignments.Kimmy ? 4 : 2}" />
      <text x="0" y="-12" fill="#cbd5e1" font-size="14" font-weight="600" text-anchor="middle">Kimmy (Shared)</text>
      <text x="0" y="18" fill="#c8963e" font-size="24" font-weight="bold" text-anchor="middle">
        ${assignments.Kimmy || '?'}
      </text>
    </g>

    <!-- Jimmy (Left) -->
    <g class="guardian-jimmy" transform="translate(-115, 45)">
      <circle cx="0" cy="0" r="36" fill="#233140" stroke="#3d5166" stroke-width="2" />
      <text x="0" y="-8" fill="#5dade2" font-size="14" text-anchor="middle">Jimmy</text>
      <text x="0" y="18" fill="#f8fafc" font-size="20" font-weight="bold" text-anchor="middle">
        ${assignments.Jimmy || '?'}
      </text>
    </g>

    <!-- Timmy (Right) -->
    <g class="guardian-timmy" transform="translate(115, 45)">
      <circle cx="0" cy="0" r="36" fill="#233140" stroke="#3d5166" stroke-width="2" />
      <text x="0" y="-8" fill="#5dade2" font-size="14" text-anchor="middle">Timmy</text>
      <text x="0" y="18" fill="#f8fafc" font-size="20" font-weight="bold" text-anchor="middle">
        ${assignments.Timmy || '?'}
      </text>
    </g>

    <!-- Interactive Guardian Assignment Controls -->
    ${isWorkspace && factored[0] && factored[1] && (!assignments.Kimmy || !assignments.Jimmy || !assignments.Timmy) ? `
    <g class="guardian-assign-controls" transform="translate(-140, 95)">
      <rect x="0" y="0" width="280" height="110" rx="10" fill="#233140" stroke="#3d5166" stroke-width="2" />
      
      <!-- Guardian Selector Radio/Chips (Jimmy, Kimmy, Timmy) with touch target >= 44px -->
      <g class="btn-pick-guardian" data-action="pick-guardian" data-name="Kimmy" transform="translate(10, 8)" cursor="pointer">
        <rect x="0" y="0" width="80" height="44" rx="6" fill="#c8963e" id="chip-kimmy" />
        <text x="40" y="27" fill="#1c2631" font-size="14" font-weight="bold" text-anchor="middle">Kimmy</text>
      </g>
      <g class="btn-pick-guardian" data-action="pick-guardian" data-name="Jimmy" transform="translate(100, 8)" cursor="pointer">
        <rect x="0" y="0" width="80" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" id="chip-jimmy" />
        <text x="40" y="27" fill="#f8fafc" font-size="14" font-weight="bold" text-anchor="middle">Jimmy</text>
      </g>
      <g class="btn-pick-guardian" data-action="pick-guardian" data-name="Timmy" transform="translate(190, 8)" cursor="pointer">
        <rect x="0" y="0" width="80" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" id="chip-timmy" />
        <text x="40" y="27" fill="#f8fafc" font-size="14" font-weight="bold" text-anchor="middle">Timmy</text>
      </g>

      <!-- Value Stepper & Confirm -->
      <g class="btn-assign-val-minus" data-action="delta-assign-val" data-delta="-1" transform="translate(10, 58)" cursor="pointer">
        <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">−</text>
      </g>
      <rect x="58" y="58" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
      <text x="80" y="86" fill="#c8963e" font-size="18" font-weight="bold" text-anchor="middle" id="keep-val-assign">2</text>
      <g class="btn-assign-val-plus" data-action="delta-assign-val" data-delta="1" transform="translate(106, 58)" cursor="pointer">
        <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">+</text>
      </g>

      <!-- Neutral Button Label: Assign Guardian -->
      <g class="btn-confirm-assign" data-action="confirm-assign" transform="translate(156, 58)" cursor="pointer">
        <rect x="0" y="0" width="114" height="44" rx="6" fill="#c8963e" />
        <text x="57" y="27" fill="#1c2631" font-size="14" font-weight="bold" text-anchor="middle">Assign</text>
      </g>
    </g>` : ''}
  </g>

  <!-- Portcullis Opening Sum Bar -->
  <g class="portcullis-sum" transform="translate(400, 345)">
    <rect x="-360" y="-22" width="720" height="48" rx="8" fill="#233140" stroke="${completed ? '#27ae60' : '#3d5166'}" stroke-width="2" />
    <text x="-340" y="8" fill="#cbd5e1" font-size="14" font-weight="600">
      Portcullis Rune Sum (Jimmy + Kimmy + Timmy):
    </text>

    <!-- Interactive Sum Stepper & Neutral Button -->
    ${assignments.Jimmy && assignments.Kimmy && assignments.Timmy && !completed && isWorkspace ? `
    <g class="interactive-sum-controls" transform="translate(60, -20)">
      <g class="btn-sum-minus" data-action="delta-sum" data-delta="-1" cursor="pointer">
        <rect x="0" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="22" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">−</text>
      </g>
      <rect x="48" y="0" width="54" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
      <text x="75" y="28" fill="#f8fafc" font-size="16" font-weight="bold" text-anchor="middle" id="keep-val-sum">20</text>
      <g class="btn-sum-plus" data-action="delta-sum" data-delta="1" cursor="pointer">
        <rect x="106" y="0" width="44" height="44" rx="6" fill="#1c2631" stroke="#3d5166" stroke-width="1.5" />
        <text x="128" y="28" fill="#ffffff" font-size="20" font-weight="bold" text-anchor="middle">+</text>
      </g>
      <g class="btn-submit-sum" data-action="submit-sum" transform="translate(156, 0)" cursor="pointer">
        <rect x="0" y="0" width="134" height="44" rx="8" fill="#27ae60" />
        <text x="67" y="27" fill="#ffffff" font-size="14" font-weight="bold" text-anchor="middle">Submit Portal Key</text>
      </g>
    </g>` : ''}

    ${completed ? `
    <text x="200" y="8" fill="#2ecc71" font-size="16" font-weight="bold" text-anchor="middle">
      Portal Unlocked!
    </text>` : ''}
  </g>
</svg>`;

  return svg;
}

export function mount(container, spec, mode, state, onStep) {
  if (typeof window === 'undefined' || !container) return;
  container.innerHTML = render(spec, mode, state);

  if (mode !== 'workspace' || !onStep) return;

  let f0_1 = 2;
  let f0_2 = 2;
  let f1_1 = 2;
  let f1_2 = 2;
  let selectedGuardian = 'Kimmy';
  let assignVal = 2;
  let sumVal = 20;

  const updateDisplays = () => {
    const el_f0_1 = container.querySelector('#keep-val-f0-1');
    if (el_f0_1) el_f0_1.textContent = f0_1;
    const el_f0_2 = container.querySelector('#keep-val-f0-2');
    if (el_f0_2) el_f0_2.textContent = f0_2;

    const el_f1_1 = container.querySelector('#keep-val-f1-1');
    if (el_f1_1) el_f1_1.textContent = f1_1;
    const el_f1_2 = container.querySelector('#keep-val-f1-2');
    if (el_f1_2) el_f1_2.textContent = f1_2;

    const el_assign = container.querySelector('#keep-val-assign');
    if (el_assign) el_assign.textContent = assignVal;

    const el_sum = container.querySelector('#keep-val-sum');
    if (el_sum) el_sum.textContent = sumVal;

    // Update guardian chip styling
    ['Kimmy', 'Jimmy', 'Timmy'].forEach(name => {
      const chip = container.querySelector(`#chip-${name.toLowerCase()}`);
      if (chip) {
        if (name === selectedGuardian) {
          chip.setAttribute('fill', '#c8963e');
          chip.removeAttribute('stroke');
        } else {
          chip.setAttribute('fill', '#1c2631');
          chip.setAttribute('stroke', '#3d5166');
        }
      }
    });
  };

  container.addEventListener('click', (e) => {
    // Clue 0 factor steppers
    const deltaF0_1 = e.target.closest('[data-action="delta-f0-1"]');
    if (deltaF0_1) {
      f0_1 = Math.max(2, f0_1 + Number(deltaF0_1.dataset.delta));
      updateDisplays();
      return;
    }
    const deltaF0_2 = e.target.closest('[data-action="delta-f0-2"]');
    if (deltaF0_2) {
      f0_2 = Math.max(2, f0_2 + Number(deltaF0_2.dataset.delta));
      updateDisplays();
      return;
    }

    // Clue 1 factor steppers
    const deltaF1_1 = e.target.closest('[data-action="delta-f1-1"]');
    if (deltaF1_1) {
      f1_1 = Math.max(2, f1_1 + Number(deltaF1_1.dataset.delta));
      updateDisplays();
      return;
    }
    const deltaF1_2 = e.target.closest('[data-action="delta-f1-2"]');
    if (deltaF1_2) {
      f1_2 = Math.max(2, f1_2 + Number(deltaF1_2.dataset.delta));
      updateDisplays();
      return;
    }

    // Confirm factor buttons
    const confirmFactorBtn = e.target.closest('[data-action="confirm-factor"]');
    if (confirmFactorBtn) {
      const idx = Number(confirmFactorBtn.dataset.idx);
      const factors = idx === 0 ? [f0_1, f0_2] : [f1_1, f1_2];
      onStep({ action: 'factor', productIndex: idx, factors });
      return;
    }

    // Guardian picker chip
    const pickGuardianBtn = e.target.closest('[data-action="pick-guardian"]');
    if (pickGuardianBtn) {
      selectedGuardian = pickGuardianBtn.dataset.name;
      updateDisplays();
      return;
    }

    // Guardian value stepper
    const deltaAssignBtn = e.target.closest('[data-action="delta-assign-val"]');
    if (deltaAssignBtn) {
      assignVal = Math.max(2, assignVal + Number(deltaAssignBtn.dataset.delta));
      updateDisplays();
      return;
    }

    // Confirm assignment
    const confirmAssignBtn = e.target.closest('[data-action="confirm-assign"]');
    if (confirmAssignBtn) {
      if (selectedGuardian === 'Kimmy') {
        onStep({ action: 'assign_shared', guardian: 'Kimmy', value: assignVal });
      } else {
        onStep({ action: 'assign', guardian: selectedGuardian, value: assignVal });
      }
      return;
    }

    // Sum stepper
    const deltaSumBtn = e.target.closest('[data-action="delta-sum"]');
    if (deltaSumBtn) {
      sumVal = Math.max(2, sumVal + Number(deltaSumBtn.dataset.delta));
      updateDisplays();
      return;
    }

    // Submit sum
    const submitSumBtn = e.target.closest('[data-action="submit-sum"]');
    if (submitSumBtn) {
      onStep({ action: 'submit_sum', value: sumVal });
      return;
    }
  });
}
