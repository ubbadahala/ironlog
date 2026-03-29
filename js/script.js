let recoveryLogs = JSON.parse(localStorage.getItem('ironlog_recovery') || '[]');
// ─── STATE ───────────────────────────────────────────────────────────────────

// ─── CUSTOM CONFIRM DIALOG ───────────────────────────────────────────────────
let _confirmCallback = null;
let _cancelCallback = null;

function showConfirm({ icon = '', title, body, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel = null }) {
  document.getElementById('confirmIcon').textContent = icon;
  document.getElementById('confirmIcon').style.display = icon ? 'block' : 'none';
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmBody').textContent = body || '';
  
  const okBtn = document.getElementById('confirmOk');
  okBtn.textContent = confirmLabel;
  okBtn.className = 'confirm-btn confirm-btn-ok' + (danger ? ' danger' : '');
  
  _confirmCallback = onConfirm;
  _cancelCallback = onCancel;
  
  okBtn.onclick = () => { 
    // Save the callback before wiping it
    const cb = _confirmCallback; 
    
    // Wipe callbacks first so dismissConfirm doesn't accidentally cancel
    _confirmCallback = null;
    _cancelCallback = null;
    
    dismissConfirm(); 
    if (cb) cb(); 
  };
  
  document.getElementById('confirmOverlay').classList.add('active');
}

function dismissConfirm() {
  document.getElementById('confirmOverlay').classList.remove('active');
  const cb = _cancelCallback;
  _confirmCallback = null;
  _cancelCallback = null;
  if (cb) cb();
}

// Close on overlay background click
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('confirmOverlay').addEventListener('click', e => {
    if (e.target.id === 'confirmOverlay') dismissConfirm();
  });
});
let workouts = JSON.parse(localStorage.getItem('ironlog_workouts') || '[]');
let chartInstance = null;
let chartRange = '4w';
let weeklyTarget = parseInt(localStorage.getItem('ironlog_weekly_target') || '0');
let restDays = JSON.parse(localStorage.getItem('ironlog_rest_days') || '[]'); // array of date strings
let strengthChartInstance = null;

const defaultExercises = [
  { name: "Barbell Row",                  muscle: "Back" },
  { name: "Bench Press (Barbell)",         muscle: "Chest" },
  { name: "Bicep Curl (Dumbbell)",         muscle: "Arms" },
  { name: "Calf Raise",                    muscle: "Legs" },
  { name: "Chest Fly (Cable)",             muscle: "Chest" },
  { name: "Deadlift (Barbell)",            muscle: "Back" },
  { name: "Incline Bench Press (Dumbbell)",muscle: "Chest" },
  { name: "Lat Pulldown (Cable)",          muscle: "Back" },
  { name: "Lateral Raise (Dumbbell)",      muscle: "Shoulders" },
  { name: "Leg Press",                     muscle: "Legs" },
  { name: "Overhead Press (Dumbbell)",     muscle: "Shoulders" },
  { name: "Pull-up",                       muscle: "Back" },
  { name: "Romanian Deadlift (Barbell)",   muscle: "Legs" },
  { name: "Squat (Barbell)",               muscle: "Legs" },
  { name: "Tricep Pushdown (Cable)",       muscle: "Arms" },
];

// Migrate legacy flat-string arrays saved in localStorage
function migrateExercisesDB(raw) {
  if (!raw) return [...defaultExercises];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...defaultExercises];
    // Already new format
    if (parsed.length > 0 && typeof parsed[0] === 'object') return parsed;
    // Legacy: array of strings
    return parsed.map(name => ({ name, muscle: '' }));
  } catch { return [...defaultExercises]; }
}

let exercisesDB = migrateExercisesDB(localStorage.getItem('ironlog_exercises'));

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  document.getElementById('rDate').value = now.toISOString().split('T')[0];
  document.getElementById('wDate').value = now.toISOString().split('T')[0];
  document.getElementById('dateDisplay').textContent =
    now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Restore light mode preference
  if (localStorage.getItem('ironlog_light_mode') === '1') {
    document.body.classList.add('light-mode');
    const toggle = document.getElementById('lightModeToggle');
    if (toggle) toggle.checked = true;
  }

  // Restore weekly target
  const storedTarget = parseInt(localStorage.getItem('ironlog_weekly_target') || '0');
  weeklyTarget = storedTarget;
  const targetInput = document.getElementById('weeklyTargetInput');
  if (targetInput && storedTarget) targetInput.value = storedTarget;

  renderExerciseDB();
  refreshWorkoutNameDB();
  renderSettingsExerciseList();
  addExerciseBlock();
  updateStats();
});

// ─── TABS ────────────────────────────────────────────────────────────────────
function switchTab(tab, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('view-' + tab).classList.add('active');
  if (btn) btn.classList.add('active');
  
  if (tab === 'history') { renderHistory(); renderRecoveryHistory(); }
  if (tab === 'progress') {
    renderProgress();
    renderNutritionInsights();
    renderHeatmap();
    renderRadarChart();
  }
}

// ─── EXERCISE DATABASE LOGIC ──────────────────────────────────────────────────
function renderExerciseDB() {
  const datalist = document.getElementById('exercise-db');
  datalist.innerHTML = exercisesDB.map(ex => `<option value="${ex.name}">`).join('');
}

const MUSCLE_OPTIONS = ['', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Full Body', 'Cardio'];

function renderSettingsExerciseList() {
  const list = document.getElementById('settingsExerciseList');
  if (exercisesDB.length === 0) {
    list.innerHTML = `<div style="padding:16px;color:var(--text);opacity:0.6;font-size:0.85rem;text-align:center;">No exercises found.</div>`;
    return;
  }

  list.innerHTML = exercisesDB.map((ex, index) => `
    <div style="display:grid;grid-template-columns:1fr 130px 36px;gap:8px;align-items:center;padding:8px 6px;border-bottom:1px solid rgba(255,255,255,0.05);">
      <input type="text" value="${ex.name}"
        style="margin-bottom:0;font-size:0.9rem;padding:9px 12px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:var(--text);font-family:'DM Sans',sans-serif;outline:none;width:100%;"
        onchange="renameExercise(${index}, this.value)"
        onfocus="this.style.borderColor='rgba(232,255,71,0.5)'"
        onblur="this.style.borderColor='rgba(255,255,255,0.08)'">
      <select style="margin-bottom:0;font-size:0.82rem;padding:9px 10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:${ex.muscle?'var(--text)':'var(--muted)'};font-family:'DM Sans',sans-serif;outline:none;width:100%;"
        onchange="setExerciseMuscle(${index}, this.value)"
        onfocus="this.style.borderColor='rgba(232,255,71,0.5)'"
        onblur="this.style.borderColor='rgba(255,255,255,0.08)'">
        ${MUSCLE_OPTIONS.map(m => `<option value="${m}" ${ex.muscle === m ? 'selected' : ''}>${m || '— muscle —'}</option>`).join('')}
      </select>
      <button class="btn-icon" style="width:36px;height:36px;font-size:0.9rem;" onclick="removeCustomExercise(${index})">✕</button>
    </div>
  `).join('');
}

function addCustomExercise() {
  const nameInput = document.getElementById('newExerciseInput');
  const muscleInput = document.getElementById('newExerciseMuscle');
  const val = nameInput.value.trim();
  if (!val) return;

  const exists = exercisesDB.some(ex => ex.name.toLowerCase() === val.toLowerCase());
  if (exists) return toast('Exercise already exists!');

  exercisesDB.push({ name: val, muscle: muscleInput.value });
  exercisesDB.sort((a, b) => a.name.localeCompare(b.name));
  saveExercises();

  nameInput.value = '';
  muscleInput.value = '';
  toast('Exercise added! 💪');
}

function renameExercise(index, newName) {
  newName = newName.trim();
  if (!newName) return renderSettingsExerciseList();
  const dup = exercisesDB.some((ex, i) => i !== index && ex.name.toLowerCase() === newName.toLowerCase());
  if (dup) { toast('Name already exists!'); return renderSettingsExerciseList(); }
  exercisesDB[index].name = newName;
  saveExercises();
  toast('Renamed ✓');
}

function setExerciseMuscle(index, muscle) {
  exercisesDB[index].muscle = muscle;
  saveExercises();
}

function removeCustomExercise(index) {
  showConfirm({
    icon: '🗑️',
    title: 'Delete Exercise',
    body: `Remove "${exercisesDB[index].name}" from the database?`,
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: () => { exercisesDB.splice(index, 1); saveExercises(); }
  });
}

function restoreDefaultExercises() {
  showConfirm({
    icon: '↺',
    title: 'Restore Defaults',
    body: 'This will replace your custom exercise list with the defaults. This cannot be undone.',
    confirmLabel: 'Restore',
    danger: true,
    onConfirm: () => { exercisesDB = [...defaultExercises]; saveExercises(); toast('Default exercises restored!'); }
  });
}

function saveExercises() {
  localStorage.setItem('ironlog_exercises', JSON.stringify(exercisesDB));
  renderExerciseDB();
  renderSettingsExerciseList();
}

// ─── RENDER HEATMAP ──────────────────────────────────────────────────
function renderHeatmap() {
  const container = document.getElementById('volumeHeatmap');
  if (!container) return;

  const now = new Date();
  const heatmapData = {};

  let maxVolume = 0;
  workouts.forEach(w => {
    const vol = w.exercises.reduce((a, e) => a + (e.sets * e.reps * e.weight), 0);
    heatmapData[w.date] = (heatmapData[w.date] || 0) + vol;
    if (vol > maxVolume) maxVolume = vol;
  });

  let html = '';
  for (let w = 0; w < 13; w++) {
    html += '<div class="heatmap-column">';
    for (let d = 0; d < 7; d++) {
      const date = new Date(now);
      const dayOffset = (12 - w) * 7 + (6 - d);
      date.setDate(now.getDate() - dayOffset);
      const dateStr = date.toISOString().split('T')[0];
      
      const dailyVol = heatmapData[dateStr] || 0;
      let level = 0;
      
      if (dailyVol > 0) {
        const ratio = dailyVol / maxVolume;
        if (ratio < 0.25) level = 1;
        else if (ratio < 0.5) level = 2;
        else if (ratio < 0.75) level = 3;
        else level = 4;
      } else if (restDays.includes(dateStr)) {
        level = 'rest'; // Triggers the icy blue CSS class
      }

      const tooltipText = level === 'rest' ? 'Rest Day 🛌' : `${Math.round(dailyVol)}kg`;
      html += `<div class="heatmap-day level-${level}" title="${formatDate(dateStr)}: ${tooltipText}"></div>`;
    }
    html += '</div>';
  }
  container.innerHTML = html;
}

// ─── RENDER NUTRITION ──────────────────────────────────────────────────

function renderNutritionInsights() {
  const statsContainer = document.getElementById('nutritionStats');
  const heatmapContainer = document.getElementById('stackHeatmap');
  if (!statsContainer || !heatmapContainer) return;

  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Days.push(d.toISOString().split('T')[0]);
  }

  // Calculate Totals
  const totalProtein = recoveryLogs.reduce((sum, r) => sum + (r.protein || 0), 0);
  const zincDays = recoveryLogs.filter(r => r.zinc).length;
  const creatineDays = recoveryLogs.filter(r => r.creatine).length;

  // Latest bodyweight
  const latestBW = [...recoveryLogs]
    .filter(r => r.bodyweight > 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  // Calculate Protein Streak (days with > 0g protein)
  let proteinStreak = 0;
  const sortedLogs = [...recoveryLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
  for (let log of sortedLogs) {
    if (log.protein > 0) proteinStreak++;
    else break;
  }

  statsContainer.innerHTML = `
    <div class="nutrient-card glass-panel">
      <span class="streak-badge">STRK: ${proteinStreak}d</span>
      <span class="nutrient-icon">🥩</span>
      <div class="nutrient-count">${totalProtein}g</div>
      <div class="nutrient-label">Total Protein Logged</div>
    </div>
    <div class="nutrient-card glass-panel">
      <span class="nutrient-icon">💊</span>
      <div class="nutrient-count">${zincDays}</div>
      <div class="nutrient-label">Days Zinc Logged</div>
    </div>
    <div class="nutrient-card glass-panel">
      <span class="nutrient-icon">⚡</span>
      <div class="nutrient-count">${creatineDays}</div>
      <div class="nutrient-label">Days Creatine</div>
    </div>
    <div class="nutrient-card glass-panel">
      <span class="nutrient-icon">⚖️</span>
      <div class="nutrient-count">${latestBW ? latestBW.bodyweight + 'kg' : '—'}</div>
      <div class="nutrient-label">Latest Bodyweight</div>
    </div>
  `;

  // Render 7-day Mini Heatmap
  heatmapContainer.innerHTML = last7Days.map(date => {
    const log = recoveryLogs.find(r => r.date === date);
    const active = log && (log.zinc || log.creatine || log.protein > 0);
    return `
      <div style="
        flex: 1; 
        height: 12px; 
        border-radius: 3px; 
        background: ${active ? 'var(--green)' : 'rgba(255,255,255,0.05)'};
        box-shadow: ${active ? '0 0 8px var(--green)' : 'none'};
        opacity: ${active ? '0.8' : '1'};
      " title="${date}"></div>
    `;
  }).join('');
}

// ─── LOGGING EXERCISES (MULTI-LOAD) ──────────────────────────────────────────
let blockCount = 0;
let loadCount = 0;

function addExerciseBlock(ex = {}) {
  blockCount++;
  const bid = blockCount;
  const muscleOptions = ['','Chest','Back','Shoulders','Arms','Legs','Core','Full Body','Cardio']
    .map(m => `<option value="${m}" ${(ex.muscle||'')=== m?'selected':''}>${m||'Muscle…'}</option>`).join('');

  const block = document.createElement('div');
  block.className = 'exercise-block';
  block.id = 'exb-' + bid;
  block.innerHTML = `
    <div class="exercise-block-header">
      <div class="name-wrapper" style="position:relative;">
        <input type="text" placeholder="Exercise name" value="${ex.name || ''}"
          data-block="${bid}" data-field="name" list="exercise-db" autocomplete="off"
          oninput="onBlockNameInput(${bid}, this.value)">
        <button class="history-peek-btn" onclick="peekHistoryBlock(${bid})">LOGS</button>
      </div>
      <div class="muscle-select-wrap">
        <select data-block="${bid}" data-field="muscle" style="font-size:0.78rem;padding:10px 8px;"
          onchange="onBlockMuscleChange(${bid})">
          ${muscleOptions}
        </select>
      </div>
      <button class="btn-remove-block" onclick="removeExerciseBlock(${bid})" title="Remove exercise">✕</button>
    </div>
    <div class="load-row-labels">
      <span>Sets</span><span>Reps</span><span>Kg</span><span></span><span></span>
    </div>
    <div class="load-rows" id="loads-${bid}"></div>
    <button class="btn-add-load" onclick="addLoadRow(${bid})">+ Add load</button>
  `;
  document.getElementById('exercisesList').appendChild(block);

  // Add first load row (pre-filled if editing)
  addLoadRow(bid, ex);

  // Auto-fill muscle if known
  if (ex.name) {
    setTimeout(() => {
      onBlockNameInput(bid, ex.name);
      onBlockMuscleChange(bid);
    }, 50);
  }
}

function addLoadRow(bid, ex = {}) {
  loadCount++;
  const lid = loadCount;
  const container = document.getElementById('loads-' + bid);
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'load-row';
  row.id = `load-${bid}-${lid}`;
  row.innerHTML = `
    <div style="position:relative">
      <input type="number" placeholder="S" data-field="sets" value="${ex.sets || ''}" style="padding:10px;">
    </div>
    <div style="position:relative">
      <input type="number" placeholder="R" data-field="reps" value="${ex.reps || ''}"
        oninput="updateDeltaLoad(${bid},${lid})" style="padding:10px;">
    </div>
    <div class="weight-wrapper" style="position:relative">
      <button class="predict-btn" onclick="predictLoadBlock(${bid},${lid})" style="font-size:0.7rem;">🪄</button>
      <input type="number" placeholder="Kg" data-field="weight" value="${ex.weight || ''}" step="0.5"
        oninput="updateDeltaLoad(${bid},${lid})" style="padding:10px;padding-left:26px;">
    </div>
    <button class="btn-icon btn-confirm" style="margin-bottom:0;" onclick="logSetLoad(${bid},${lid})" title="Log set">✓</button>
    <button class="btn-icon" style="margin-bottom:0;" onclick="removeLoadRow(${bid},${lid})" title="Remove load">✕</button>
  `;
  container.appendChild(row);
}

function removeLoadRow(bid, lid) {
  const row = document.getElementById(`load-${bid}-${lid}`);
  const container = document.getElementById('loads-' + bid);
  // Don't remove if it's the only load row
  if (container && container.querySelectorAll('.load-row').length <= 1) {
    toast('Each exercise needs at least one load row.');
    return;
  }
  if (row) row.remove();
}

function removeExerciseBlock(bid) {
  const block = document.getElementById('exb-' + bid);
  if (block) block.remove();
}

function onBlockNameInput(bid, value) {
  // Auto-fill muscle if exercise is in DB and muscle not set
  const val = value.trim().toLowerCase();
  if (!val) return;
  const match = exercisesDB.find(ex => ex.name.toLowerCase() === val);
  if (!match || !match.muscle) return;
  const sel = document.querySelector(`#exb-${bid} [data-field="muscle"]`);
  if (sel && !sel.value) sel.value = match.muscle;
  // Update deltas on all load rows
  document.querySelectorAll(`#loads-${bid} .load-row`).forEach(row => {
    const lid = row.id.split('-')[2];
    updateDeltaLoad(bid, lid);
  });
}

function onBlockMuscleChange(bid) {
  // Just re-run delta so colour can update
}

function logSetLoad(bid, lid) {
  const block = document.getElementById('exb-' + bid);
  if (!block) return;
  const name = block.querySelector('[data-field="name"]').value.trim();
  const muscle = block.querySelector('[data-field="muscle"]')?.value || '';
  if (name) triggerSmartTimer(name, muscle);
  incrementSetCounterLoad(bid, lid);
  if (navigator.vibrate) navigator.vibrate(50);
  updateSessionVolume();
}

function incrementSetCounterLoad(bid, lid) {
  const btn = document.querySelector(`#load-${bid}-${lid} .btn-confirm`);
  if (!btn) return;
  let badge = btn.querySelector('.set-counter');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'set-counter';
    btn.style.position = 'relative';
    btn.appendChild(badge);
  }
  const current = parseInt(badge.dataset.sets || '0') + 1;
  badge.dataset.sets = current;
  badge.textContent = `S${current}`;
}

function updateDeltaLoad(bid, lid) {
  const block = document.getElementById('exb-' + bid);
  const row = document.getElementById(`load-${bid}-${lid}`);
  if (!block || !row) return;

  const name = block.querySelector('[data-field="name"]').value.trim();
  const reps = parseInt(row.querySelector('[data-field="reps"]').value) || 0;
  const weight = parseFloat(row.querySelector('[data-field="weight"]').value) || 0;
  
  // Helper to cleanly remove deltas and reset margin
  const clearDeltas = () => {
    row.classList.remove('has-deltas');
    row.querySelectorAll('.delta-box').forEach(el => el.remove());
  };

  if (!name || !workouts.length) return clearDeltas();

  const recentWorkout = workouts.find(w => w.exercises.some(e => e.name.toLowerCase() === name.toLowerCase()));
  if (!recentWorkout) return clearDeltas();

  const best = recentWorkout.exercises
    .filter(e => e.name.toLowerCase() === name.toLowerCase())
    .reduce((a, b) => (a.sets * a.reps * a.weight) >= (b.sets * b.reps * b.weight) ? a : b);

  renderDeltaLabel(row.querySelector('[data-field="reps"]').parentElement, reps - best.reps, 'r');
  renderDeltaLabel(row.querySelector('[data-field="weight"]').parentElement, weight - best.weight, 'kg');
  
  // Triggers the CSS to expand the margin
  row.classList.add('has-deltas');
}

function predictLoadBlock(bid, lid) {
  const block = document.getElementById('exb-' + bid);
  const row = document.getElementById(`load-${bid}-${lid}`);
  if (!block || !row) return;

  const name = block.querySelector('[data-field="name"]').value.trim();
  if (!name) return toast('Enter exercise name first!');

  const weightInput = row.querySelector('[data-field="weight"]');
  const history = workouts
    .flatMap(w => w.exercises.map(e => ({ ...e, date: w.date })))
    .filter(e => e.name.toLowerCase() === name.toLowerCase())
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!history.length) return toast('No history found. Set your own baseline!');

  const last = history[0];
  let suggestion = last.weight;
  let statusMsg = '', statusColor = 'var(--accent)';

  const isStagnant = history.length >= 3 &&
    history[0].weight === history[1].weight &&
    history[1].weight === history[2].weight &&
    history[0].reps <= history[1].reps;

  if (isStagnant) {
    suggestion = Math.floor((last.weight * 0.9) * 2) / 2;
    statusMsg = `⚠️ Stagnation detected. Deloading to ${suggestion}kg.`;
    statusColor = '#ffb347';
  } else if (last.reps >= 8) {
    const isLeg = last.muscle === 'Legs' ||
      ['legs','quads','glutes','hamstrings','squat','leg press','calf'].some(m => name.toLowerCase().includes(m));
    suggestion += isLeg ? 5 : 2.5;
    statusMsg = `🔥 Target hit! Increasing to ${suggestion}kg.`;
    statusColor = 'var(--green)';
  } else {
    statusMsg = `Stay at ${suggestion}kg, aim for 8+ reps.`;
    statusColor = 'var(--muted)';
  }

  weightInput.value = suggestion;
  updateDeltaLoad(bid, lid);
  weightInput.animate([
    { boxShadow: `0 0 20px ${statusColor}`, transform: 'scale(1.05)' },
    { boxShadow: 'none', transform: 'scale(1)' }
  ], { duration: 500, easing: 'ease-out' });
  toast(statusMsg);
}

function peekHistoryBlock(bid) {
  document.querySelectorAll('.peek-popover').forEach(p => p.remove());
  const block = document.getElementById('exb-' + bid);
  if (!block) return;
  const name = block.querySelector('[data-field="name"]').value.trim();
  if (!name) return toast('Enter an exercise name first');

  const history = workouts
    .filter(w => w.exercises.some(e => e.name.toLowerCase() === name.toLowerCase()))
    .slice(0, 5)
    .map(w => {
      const best = w.exercises
        .filter(e => e.name.toLowerCase() === name.toLowerCase())
        .reduce((a, b) => (a.sets * a.reps * a.weight) >= (b.sets * b.reps * b.weight) ? a : b);
      return { date: w.date, sets: best.sets, reps: best.reps, weight: best.weight };
    });

  const popover = document.createElement('div');
  popover.className = 'peek-popover';

  if (!history.length) {
    popover.innerHTML = `<div class="peek-popover-title">${name}</div><div class="peek-popover-empty">No history yet</div>`;
  } else {
    const prWeight = Math.max(...history.map(h => h.weight));
    popover.innerHTML = `
      <div class="peek-popover-title">Last ${history.length} · ${name}</div>
      <table>
        ${history.map(h => `<tr${h.weight === prWeight ? ' style="color:var(--accent)"' : ''}>
          <td>${formatDate(h.date)}</td>
          <td>${h.sets}×${h.reps} @ <strong style="color:var(--accent)">${h.weight}kg</strong>${h.weight === prWeight ? ' 🏆' : ''}</td>
        </tr>`).join('')}
      </table>`;
  }

  const closeHandler = (e) => { if (!popover.contains(e.target)) { popover.remove(); document.removeEventListener('click', closeHandler, true); } };
  setTimeout(() => document.addEventListener('click', closeHandler, true), 0);

  const wrapper = block.querySelector('.name-wrapper');
  wrapper.style.position = 'relative';
  wrapper.appendChild(popover);
}
// Cancel a running session without saving
function cancelSession() {
  showConfirm({
    icon: '✕',
    title: 'Cancel Session',
    body: 'Nothing will be saved. Are you sure you want to discard this session?',
    confirmLabel: 'Yes, Cancel',
    danger: true,
    onConfirm: () => {
      clearInterval(sessionClockInterval);
      sessionClockInterval = null;
      sessionStartTime = null;
      document.getElementById('sessionBar').classList.remove('active');
      document.getElementById('sessionClock').textContent = '00:00';
      const btn = document.getElementById('sessionToggleBtn');
      btn.textContent = '▶ Start Session';
      btn.classList.remove('running');
      toast('Session cancelled');
      // Hide the sticky FAB
      document.getElementById('fabEndSession').style.display = 'none';
    }
  });
}

function peekHistory(id) {
  // Close any open popovers first
  document.querySelectorAll('.peek-popover').forEach(p => p.remove());

  const nameInput = document.querySelector(`#ex-${id} [data-field="name"]`);
  const name = nameInput?.value.trim();
  if (!name) return toast("Enter an exercise name first");

  const history = workouts
    .filter(w => w.exercises.some(e => e.name.toLowerCase() === name.toLowerCase()))
    .slice(0, 5)
    .map(w => {
      const best = w.exercises
        .filter(e => e.name.toLowerCase() === name.toLowerCase())
        .reduce((a, b) => (a.sets * a.reps * a.weight) >= (b.sets * b.reps * b.weight) ? a : b);
      return { date: w.date, sets: best.sets, reps: best.reps, weight: best.weight };
    });

  const popover = document.createElement('div');
  popover.className = 'peek-popover';

  if (!history.length) {
    popover.innerHTML = `<div class="peek-popover-title">${name}</div><div class="peek-popover-empty">No history yet</div>`;
  } else {
    // Find the PR weight across all history
    const prWeight = Math.max(...history.map(h => h.weight));
    popover.innerHTML = `
      <div class="peek-popover-title">Last ${history.length} · ${name}</div>
      <table>
        ${history.map(h => `<tr${h.weight === prWeight ? ' style="color:var(--accent)"' : ''}>
          <td>${formatDate(h.date)}</td>
          <td>${h.sets}×${h.reps} @ <strong style="color:var(--accent)">${h.weight}kg</strong>${h.weight === prWeight ? ' 🏆' : ''}</td>
        </tr>`).join('')}
      </table>`;
  }

  // Close on outside click
  const closeHandler = (e) => { if (!popover.contains(e.target)) { popover.remove(); document.removeEventListener('click', closeHandler, true); } };
  setTimeout(() => document.addEventListener('click', closeHandler, true), 0);

  const wrapper = document.getElementById('ex-' + id).querySelector('.name-wrapper');
  wrapper.style.position = 'relative';
  wrapper.appendChild(popover);
}

function collectExercises() {
  // Read all exercise blocks; each block can have multiple load rows
  const blocks = document.querySelectorAll('.exercise-block');
  const result = [];
  blocks.forEach(block => {
    const name = block.querySelector('[data-field="name"]').value.trim();
    const muscle = block.querySelector('[data-field="muscle"]')?.value || '';
    if (!name) return;
    block.querySelectorAll('.load-row').forEach(row => {
      result.push({
        name,
        muscle,
        sets: parseFloat(row.querySelector('[data-field="sets"]').value) || 0,
        reps: parseFloat(row.querySelector('[data-field="reps"]').value) || 0,
        weight: parseFloat(row.querySelector('[data-field="weight"]').value) || 0,
      });
    });
  });
  return result.filter(e => e.name);
}

// ─── RECOVERY & NUTRITION TRACKING ────────────────────────────────────────────
function saveRecovery() {
  const date = document.getElementById('rDate').value;
  if (!date) return toast('Please select a date!');

  const entry = {
    date: date,
    sleep: parseFloat(document.getElementById('rSleep').value) || 0,
    protein: parseFloat(document.getElementById('rProtein').value) || 0,
    bodyweight: parseFloat(document.getElementById('rBodyweight').value) || 0,
    zinc: document.getElementById('rZinc').checked,
    creatine: document.getElementById('rCreatine').checked,
    soreness: parseInt(document.getElementById('rSoreness').value) || 5
  };

  // Check if an entry for this date already exists. 
  // If it does, overwrite it (so you can update it later in the day). If not, add it.
  const existingIndex = recoveryLogs.findIndex(r => r.date === date);
  if (existingIndex >= 0) {
    recoveryLogs[existingIndex] = entry;
  } else {
    recoveryLogs.unshift(entry);
  }

  localStorage.setItem('ironlog_recovery', JSON.stringify(recoveryLogs));
  toast('Recovery metrics saved! 🔋');
  
  // Triggers haptic feedback on mobile devices for confirmation
  if (navigator.vibrate) navigator.vibrate(100);
}

// ─── SESSION TIMER ────────────────────────────────────────────────────────────
let sessionStartTime = null;
let sessionClockInterval = null;

function toggleSession() {
  if (!sessionStartTime) {
    startSession();
  } else {
    confirmEndSession();
  }
}

function startSession() {
  const name = document.getElementById('wName').value.trim();
  if (!name) return toast('Enter a workout name before starting!');

  sessionStartTime = new Date();
  // Always stamp date to the actual start date (handles cross-midnight sessions)
  document.getElementById('wDate').value = sessionStartTime.toISOString().split('T')[0];

  document.getElementById('sessionBar').classList.add('active');
  document.getElementById('sessionStartLabel').textContent =
    sessionStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const btn = document.getElementById('sessionToggleBtn');
  btn.textContent = '■ End Session';
  btn.classList.add('running');

  sessionClockInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('sessionClock').textContent = `${m}:${s}`;
    // Keep date field current if session crosses midnight
    const nowDate = new Date().toISOString().split('T')[0];
    const dateField = document.getElementById('wDate');
    if (dateField.value !== nowDate) dateField.value = nowDate;
    // Update live session volume
    updateSessionVolume();
  }, 1000);

  // Show last time this workout was done
  updateLastSessionInfo(document.getElementById('wName').value.trim());

  // Show the sticky FAB
  document.getElementById('fabEndSession').style.display = 'block';
}

function confirmEndSession() {
  const exercises = collectExercises();
  if (!exercises.length) return toast('Add at least one exercise first!');
  const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
  const mins = Math.round(elapsed / 60);
  showConfirm({
    icon: '💾',
    title: 'End Session',
    body: `Save workout after ${mins} min?`,
    confirmLabel: 'Save & End',
    onConfirm: () => saveWorkout(mins)
  });
}

// ─── SAVE WORKOUT ─────────────────────────────────────────────────────────────
function saveWorkout(durationMins) {
  const name = document.getElementById('wName').value.trim();
  const date = document.getElementById('wDate').value;
  if (!name || !date) return toast('Add a name and date!');
  const exercises = collectExercises();
  if (!exercises.length) return toast('Add at least one exercise!');

  const currentVolume = exercises.reduce((a, e) => a + (e.sets * e.reps * e.weight), 0);

  // Check for Volume PR
  const maxVolume = workouts.reduce((max, w) => {
    const v = w.exercises.reduce((a, e) => a + (e.sets * e.reps * e.weight), 0);
    return v > max ? v : max;
  }, 0);
  const isVolumePR = currentVolume > maxVolume && workouts.length > 0;

  // Derive primary muscle group from exercises (most common non-empty value)
  const muscleCounts = {};
  exercises.forEach(e => { if (e.muscle) muscleCounts[e.muscle] = (muscleCounts[e.muscle] || 0) + 1; });
  const primaryMuscle = Object.keys(muscleCounts).sort((a,b) => muscleCounts[b]-muscleCounts[a])[0] || '';

  const workout = {
    id: Date.now(),
    name,
    date,
    duration: durationMins || 0,
    muscle: primaryMuscle,
    notes: document.getElementById('wNotes').value.trim(),
    exercises,
  };

  workouts.unshift(workout);
  save();
  updateStats();
  refreshWorkoutNameDB();

  if (isVolumePR) { triggerConfetti(); }

  // Stop session clock
  clearInterval(sessionClockInterval);
  sessionClockInterval = null;
  sessionStartTime = null;
  document.getElementById('sessionBar').classList.remove('active');
  document.getElementById('sessionClock').textContent = '00:00';
  const btn = document.getElementById('sessionToggleBtn');
  btn.textContent = '▶ Start Session';
  btn.classList.remove('running');

  // Show recap
  showRecap(workout, isVolumePR);

  // Reset form
  document.getElementById('wName').value = '';
  document.getElementById('wNotes').value = '';
  document.getElementById('exercisesList').innerHTML = '';
  blockCount = 0; loadCount = 0;
  addExerciseBlock();

  // Hide the sticky FAB
  document.getElementById('fabEndSession').style.display = 'none';
}

// ─── SESSION RECAP ─────────────────────────────────────────────────────────────
function showRecap(workout, isVolumePR) {
  const vol = workout.exercises.reduce((a, e) => a + e.sets * e.reps * e.weight, 0);
  const totalSets = workout.exercises.reduce((a, e) => a + e.sets, 0);
  const uniqueMuscles = [...new Set(workout.exercises.map(e => e.muscle).filter(Boolean))];

  // Hero
  document.getElementById('recapWorkoutName').textContent = workout.name;
  const muscleStr = uniqueMuscles.length ? ` · ${uniqueMuscles.join(' + ')}` : '';
  document.getElementById('recapDate').textContent = formatDate(workout.date) + muscleStr;

  // Stat cards
  document.getElementById('recapStats').innerHTML = `
    <div class="recap-stat">
      <div class="recap-stat-val">${workout.duration || '—'}</div>
      <div class="recap-stat-label">Minutes</div>
    </div>
    <div class="recap-stat">
      <div class="recap-stat-val">${Math.round(vol).toLocaleString()}</div>
      <div class="recap-stat-label">Total Volume (kg)</div>
    </div>
    <div class="recap-stat">
      <div class="recap-stat-val">${totalSets}</div>
      <div class="recap-stat-label">Total Sets</div>
    </div>
  `;

  // Build PRs map to detect new PRs in this session
  const prevPRs = {};
  workouts.slice(1).forEach(w => {
    w.exercises.forEach(e => {
      const key = e.name.toLowerCase();
      if (!prevPRs[key] || e.weight > prevPRs[key]) prevPRs[key] = e.weight;
    });
  });

  // Exercise table — grouped by muscle
  const grouped = {};
  workout.exercises.forEach(e => {
    const m = e.muscle || 'Other';
    if (!grouped[m]) grouped[m] = [];
    grouped[m].push(e);
  });

  let tableRows = '';
  Object.entries(grouped).forEach(([muscle, exs]) => {
    tableRows += `<tr><td colspan="6" style="padding:10px 0 4px;font-family:'DM Mono',monospace;font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid rgba(255,255,255,0.06);">${muscle}</td></tr>`;
    exs.forEach(e => {
      const oneRM = Math.round(calculate1RM(e.weight, e.reps));
      const isPR = e.weight > (prevPRs[e.name.toLowerCase()] || 0);
      tableRows += `<tr>
        <td>${e.name}${isPR ? '<span class="recap-pr-badge">NEW PR</span>' : ''}</td>
        <td>${e.sets}</td><td>${e.reps}</td>
        <td>${e.weight}</td>
        <td>${Math.round(e.sets * e.reps * e.weight)}</td>
        <td style="color:var(--accent);">${oneRM}</td>
      </tr>`;
    });
  });
  document.getElementById('recapTableBody').innerHTML = tableRows;

  // Notes
  const notesEl = document.getElementById('recapNotes');
  const notesText = document.getElementById('recapNotesText');
  if (workout.notes) {
    notesText.textContent = `"${workout.notes}"`;
    notesEl.style.display = 'block';
  } else {
    notesEl.style.display = 'none';
  }

  if (isVolumePR) toast('🔥 NEW ALL-TIME VOLUME PR!');

  document.getElementById('recapOverlay').classList.add('active');
}

function closeRecap() {
  document.getElementById('recapOverlay').classList.remove('active');
}

function closeRecapAndGoHistory() {
  closeRecap();
  switchTab('history', document.querySelector('.tab:nth-child(2)'));
}

function triggerConfetti() {
  for (let i = 0; i < 50; i++) {
    const div = document.createElement('div');
    div.className = 'confetti';
    div.style.left = Math.random() * 100 + 'vw';
    div.style.backgroundColor = Math.random() > 0.5 ? 'var(--accent)' : 'var(--green)';
    div.style.animationDelay = Math.random() * 2 + 's';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  }
}

// ─── LIVE DIFFERENCE (handled per load row via updateDeltaLoad) ──────────────
function updateDelta(id) { /* no-op: use updateDeltaLoad for new block system */ }

function renderDeltaLabel(parent, val, unit) {
  let el = parent.querySelector('.delta-box');
  if (!el) {
    el = document.createElement('span');
    el.className = 'delta-box';
    parent.appendChild(el);
  }
  
  if (val === 0) {
    el.innerHTML = `<span class="delta-neutral">= last</span>`;
  } else {
    const cls = val > 0 ? 'delta-pos' : 'delta-neg';
    const sign = val > 0 ? '+' : '';
    el.innerHTML = `<span class="${cls}">${sign}${val}${unit}</span>`;
  }
}

// ─── ADAPTIVE REST TIMER ────────────────────────────────────────────────────────

const HEAVY_COMPOUNDS = ['bench', 'squat', 'deadlift', 'press', 'row', 'pull up', 'leg press'];

function triggerSmartTimer(exerciseName, exerciseMuscle) {
  if (!exerciseName) return;
  const isLeg = (exerciseMuscle || '').toLowerCase() === 'legs';
  const isHeavy = isLeg || HEAVY_COMPOUNDS.some(c => exerciseName.toLowerCase().includes(c));
  const seconds = isHeavy ? 180 : 60;
  startTimer(seconds);
  toast(`Rest: ${seconds}s started`);
}

// ─── STATS ────────────────────────────────────────────────────────────────────
function updateStats() {
  document.getElementById('statTotal').textContent = workouts.length;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0,0,0,0);
  const weekCount = workouts.filter(w => new Date(w.date) >= weekStart).length;
  document.getElementById('statWeek').textContent = weekCount;

  const totalVol = workouts.reduce((acc, w) => {
    return acc + w.exercises.reduce((a, e) => a + (e.sets * e.reps * e.weight), 0);
  }, 0);
  document.getElementById('statVolume').textContent = Math.round(totalVol).toLocaleString();

  // Compute current streak — workouts OR intentional rest days both count
  const activeDates = new Set([...workouts.map(w => w.date), ...restDays]);
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (activeDates.has(ds)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  document.getElementById('statStreak').textContent = streak;
  updateWeeklyTargetBar();
}

// ─── MUSCLE RADAR ─────────────────────────────────────────────────────────────

let radarInstance = null;

function renderRadarChart() {
  const canvas = document.getElementById('muscleRadarChart');
  if (!canvas) return;

  const distribution = { 'Chest': 0, 'Back': 0, 'Shoulders': 0, 'Arms': 0, 'Legs': 0, 'Core': 0 };

  // Count volume (not sessions) per muscle group across all exercises
  workouts.forEach(w => {
    w.exercises.forEach(e => {
      if (e.muscle && distribution[e.muscle] !== undefined) {
        distribution[e.muscle] += e.sets * e.reps * e.weight;
      }
    });
  });

  if (radarInstance) radarInstance.destroy();

  radarInstance = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: Object.keys(distribution),
      datasets: [{
        label: 'Workout Frequency',
        data: Object.values(distribution),
        backgroundColor: 'rgba(232,255,71,0.2)',
        borderColor: '#e8ff47',
        pointBackgroundColor: '#e8ff47',
        borderWidth: 2
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        r: {
          angleLines: { color: 'rgba(255,255,255,0.1)' },
          grid: { color: 'rgba(255,255,255,0.1)' },
          pointLabels: { color: '#888', font: { family: 'DM Mono' } },
          ticks: { display: false }
        }
      }
    }
  });
}

// ─── EDIT MODAL HELPERS ──────────────────────────────────────────────────────
let editingWorkoutId = null;
let editExerciseCount = 0;

function openModal(id) {
  document.getElementById(id).classList.add('active');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// ── OPEN WORKOUT VIEW MODAL ──
function openViewWorkout(id) {
  const w = workouts.find(x => x.id === id);
  if (!w) return;

  const vol = w.exercises.reduce((a, e) => a + (e.sets * e.reps * e.weight), 0);

  document.getElementById('viewWName').textContent = w.name;
  document.getElementById('viewWDate').textContent = formatDate(w.date);
  document.getElementById('viewWDuration').textContent = w.duration || '0';
  document.getElementById('viewWVolume').textContent = Math.round(vol).toLocaleString();

  // Group the flat exercises back together by Name + Muscle for the UI
  const grouped = {};
  w.exercises.forEach(e => {
    const key = e.name.toLowerCase();
    if (!grouped[key]) grouped[key] = { name: e.name, muscle: e.muscle, setsData: [] };
    grouped[key].setsData.push({ s: e.sets, r: e.reps, w: e.weight });
  });

  const tbody = document.getElementById('viewWExercises');
  tbody.innerHTML = Object.values(grouped).map(group => {
    const totalVol = group.setsData.reduce((a, e) => a + (e.s * e.r * e.w), 0);
    const max1RM = Math.max(...group.setsData.map(e => calculate1RM(e.w, e.r)));
    
    // Stack the load entries visually using line breaks
    const setsHtml = group.setsData.map(e => e.s).join('<br>');
    const repsHtml = group.setsData.map(e => e.r).join('<br>');
    const weightHtml = group.setsData.map(e => e.w).join('<br>');

    return `
    <tr>
      <td style="vertical-align:top; padding-top:10px;">${group.name}</td>
      <td style="color:var(--muted);font-size:0.72rem; vertical-align:top; padding-top:10px;">${group.muscle || '—'}</td>
      <td style="vertical-align:top; padding-top:10px; line-height:1.5;">${setsHtml}</td>
      <td style="vertical-align:top; padding-top:10px; line-height:1.5;">${repsHtml}</td>
      <td style="vertical-align:top; padding-top:10px; line-height:1.5;">${weightHtml}</td>
      <td style="vertical-align:top; padding-top:10px;">${Math.round(totalVol)}</td>
      <td style="color: var(--accent); font-weight: 500; vertical-align:top; padding-top:10px;">${Math.round(max1RM)}</td>
    </tr>`;
  }).join('');

  const notesContainer = document.getElementById('viewWNotesContainer');
  if (w.notes) {
    document.getElementById('viewWNotes').textContent = w.notes;
    notesContainer.style.display = 'block';
  } else {
    notesContainer.style.display = 'none';
  }

  document.getElementById('viewBtnEdit').onclick = () => { closeModal('viewWorkoutModal'); openEditWorkout(w.id); };
  document.getElementById('viewBtnShare').onclick = () => shareWorkout(w.id);
  document.getElementById('viewBtnDelete').onclick = () => { closeModal('viewWorkoutModal'); deleteWorkout(w.id); };

  openModal('viewWorkoutModal');
}

// Close modal when clicking overlay background
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// ── OPEN WORKOUT EDIT ──
// ── OPEN WORKOUT EDIT ──
let editBlockCount = 0;
let editLoadCount = 0;

function openEditWorkout(id) {
  const w = workouts.find(x => x.id === id);
  if (!w) return;
  editingWorkoutId = id;

  document.getElementById('editWName').value = w.name || '';
  document.getElementById('editWDate').value = w.date || '';
  document.getElementById('editWDuration').value = w.duration || '';
  document.getElementById('editWNotes').value = w.notes || '';

  const list = document.getElementById('editExercisesList');
  list.innerHTML = '';
  editBlockCount = 0;
  editLoadCount = 0;

  // Group flat data into blocks for the UI
  const grouped = {};
  w.exercises.forEach(e => {
    const key = e.name.toLowerCase();
    if (!grouped[key]) grouped[key] = { name: e.name, muscle: e.muscle, loads: [] };
    grouped[key].loads.push({ sets: e.sets, reps: e.reps, weight: e.weight });
  });

  Object.values(grouped).forEach(group => addEditExerciseBlock(group));

  openModal('editWorkoutModal');
}

function addEditExerciseBlock(group = {}) {
  editBlockCount++;
  const bid = editBlockCount;
  const muscleOptions = ['','Chest','Back','Shoulders','Arms','Legs','Core','Full Body','Cardio']
    .map(m => `<option value="${m}" ${(group.muscle||'')=== m?'selected':''}>${m||'Muscle…'}</option>`).join('');

  const block = document.createElement('div');
  block.className = 'exercise-block';
  block.id = 'edit-exb-' + bid;
  block.innerHTML = `
    <div class="exercise-block-header">
      <div class="name-wrapper" style="position:relative;">
        <input type="text" placeholder="Exercise name" value="${group.name || ''}"
          data-field="name" list="exercise-db" autocomplete="off" style="margin-bottom:0;">
      </div>
      <div class="muscle-select-wrap">
        <select data-field="muscle" style="font-size:0.78rem;padding:10px 8px;margin-bottom:0;">
          ${muscleOptions}
        </select>
      </div>
      <button class="btn-remove-block" onclick="document.getElementById('edit-exb-${bid}').remove()" title="Remove block">✕</button>
    </div>
    <div class="load-row-labels">
      <span>Sets</span><span>Reps</span><span>Kg</span><span></span><span></span>
    </div>
    <div class="load-rows" id="edit-loads-${bid}"></div>
    <button class="btn-add-load" onclick="addEditLoadRow(${bid})">+ Add load</button>
  `;
  document.getElementById('editExercisesList').appendChild(block);

  if (group.loads && group.loads.length > 0) {
    group.loads.forEach(load => addEditLoadRow(bid, load));
  } else {
    addEditLoadRow(bid, {}); // Initialize empty row for new block
  }
}

function addEditLoadRow(bid, loadData = {}) {
  editLoadCount++;
  const lid = editLoadCount;
  const container = document.getElementById('edit-loads-' + bid);
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'load-row';
  row.id = `edit-load-${bid}-${lid}`;
  
  // We use an empty div as a spacer so the "✕" button sits cleanly on the right
  row.innerHTML = `
    <div><input type="number" placeholder="S" data-field="sets" value="${loadData.sets || ''}" style="padding:10px;margin-bottom:0;"></div>
    <div><input type="number" placeholder="R" data-field="reps" value="${loadData.reps || ''}" style="padding:10px;margin-bottom:0;"></div>
    <div><input type="number" placeholder="Kg" data-field="weight" value="${loadData.weight || ''}" step="0.5" style="padding:10px;margin-bottom:0;"></div>
    <div></div> 
    <button class="btn-icon" style="margin-bottom:0;" onclick="document.getElementById('edit-load-${bid}-${lid}').remove()" title="Remove load">✕</button>
  `;
  container.appendChild(row);
}

function saveEditedWorkout() {
  const name = document.getElementById('editWName').value.trim();
  const date = document.getElementById('editWDate').value;
  if (!name || !date) return toast('Name and date are required!');

  // Flatten the blocks back into the normal array structure
  const exercises = [];
  document.querySelectorAll('#editExercisesList .exercise-block').forEach(block => {
    const exName = block.querySelector('[data-field="name"]').value.trim();
    const muscle = block.querySelector('[data-field="muscle"]')?.value || '';
    if (!exName) return;

    block.querySelectorAll('.load-row').forEach(row => {
      const sets = parseFloat(row.querySelector('[data-field="sets"]').value) || 0;
      const reps = parseFloat(row.querySelector('[data-field="reps"]').value) || 0;
      const weight = parseFloat(row.querySelector('[data-field="weight"]').value) || 0;
      
      if (sets > 0 || reps > 0 || weight > 0) {
        exercises.push({ name: exName, muscle, sets, reps, weight });
      }
    });
  });

  if (!exercises.length) return toast('Add at least one valid load entry!');

  const muscleCounts = {};
  exercises.forEach(e => { if (e.muscle) muscleCounts[e.muscle] = (muscleCounts[e.muscle] || 0) + 1; });
  const primaryMuscle = Object.keys(muscleCounts).sort((a,b) => muscleCounts[b]-muscleCounts[a])[0] || workouts.find(w=>w.id===editingWorkoutId)?.muscle || '';

  const idx = workouts.findIndex(w => w.id === editingWorkoutId);
  if (idx === -1) return toast('Workout not found!');

  workouts[idx] = {
    ...workouts[idx],
    name,
    date,
    duration: parseInt(document.getElementById('editWDuration').value) || 0,
    muscle: primaryMuscle,
    notes: document.getElementById('editWNotes').value.trim(),
    exercises,
  };

  save();
  updateStats();
  renderHistory();
  closeModal('editWorkoutModal');
  toast('Workout updated! ✅');
}

// ── OPEN RECOVERY EDIT ──
let editingRecoveryDate = null;

function openEditRecovery(date) {
  const r = recoveryLogs.find(x => x.date === date);
  if (!r) return;
  editingRecoveryDate = date;

  document.getElementById('editRDate').value = r.date;
  document.getElementById('editRSleep').value = r.sleep || '';
  document.getElementById('editRProtein').value = r.protein || '';
  document.getElementById('editRBodyweight').value = r.bodyweight || '';
  document.getElementById('editRZinc').checked = r.zinc || false;
  document.getElementById('editRCreatine').checked = r.creatine || false;
  const soreness = r.soreness || 5;
  document.getElementById('editRSoreness').value = soreness;
  document.getElementById('editSorenessVal').textContent = soreness;

  openModal('editRecoveryModal');
}

function saveEditedRecovery() {
  const date = document.getElementById('editRDate').value;
  if (!date) return toast('Date is required!');

  const idx = recoveryLogs.findIndex(r => r.date === editingRecoveryDate);
  if (idx === -1) return toast('Entry not found!');

  recoveryLogs[idx] = {
    date,
    sleep: parseFloat(document.getElementById('editRSleep').value) || 0,
    protein: parseFloat(document.getElementById('editRProtein').value) || 0,
    bodyweight: parseFloat(document.getElementById('editRBodyweight').value) || 0,
    zinc: document.getElementById('editRZinc').checked,
    creatine: document.getElementById('editRCreatine').checked,
    soreness: parseInt(document.getElementById('editRSoreness').value) || 5,
  };

  localStorage.setItem('ironlog_recovery', JSON.stringify(recoveryLogs));
  renderHistory();
  closeModal('editRecoveryModal');
  toast('Recovery log updated! ✅');
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────
function renderHistory() {
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const muscleFilter = document.getElementById('historyMuscleFilter')?.value || '';
  const sortOrder = document.getElementById('historySortOrder')?.value || 'newest';
  const list = document.getElementById('historyList');

  // 1. Filter Workouts
  let filteredWorkouts = workouts.filter(w =>
    (w.name.toLowerCase().includes(q) ||
    w.exercises.some(e => e.name.toLowerCase().includes(q)) ||
    w.exercises.some(e => (e.muscle || '').toLowerCase().includes(q))) &&
    (!muscleFilter || w.exercises.some(e => e.muscle === muscleFilter))
  ).map(w => ({ type: 'workout', data: w }));

  // 2. Filter Rest Days (Hide them if a specific muscle filter is applied, but keep them for search)
  let filteredRestDays = [];
  if (!muscleFilter && (!q || 'rest day'.includes(q))) {
    filteredRestDays = restDays.map(d => ({ type: 'rest', date: d }));
  }

  // 3. Combine and Sort
  let combined = [...filteredWorkouts, ...filteredRestDays];
  
  if (sortOrder === 'oldest') {
    combined.sort((a, b) => new Date(a.type === 'rest' ? a.date : a.data.date) - new Date(b.type === 'rest' ? b.date : b.data.date));
  } else if (sortOrder === 'volume') {
    combined.sort((a, b) => {
      const va = a.type === 'rest' ? -1 : a.data.exercises.reduce((s, e) => s + e.sets * e.reps * e.weight, 0);
      const vb = b.type === 'rest' ? -1 : b.data.exercises.reduce((s, e) => s + e.sets * e.reps * e.weight, 0);
      return vb - va; // Rest days get pushed to the bottom
    });
  } else {
    // Default: Newest first
    combined.sort((a, b) => new Date(b.type === 'rest' ? b.date : b.data.date) - new Date(a.type === 'rest' ? a.date : a.data.date));
  }

  if (!combined.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🏋️</div>No activity found.</div>`;
    return;
  }

  // 4. Render HTML
  list.innerHTML = combined.map(item => {
    // ── RENDER REST DAY ──
    if (item.type === 'rest') {
      return `
      <div class="rest-entry glass-panel">
        <div class="rest-entry-title">🛌 Rest Day</div>
        <div style="display:flex; align-items:center; gap:16px;">
          <span style="font-family:'DM Mono',monospace;font-size:0.75rem;color:var(--muted);">${formatDate(item.date)}</span>
          <button class="btn-icon" style="width:32px; height:32px; margin-bottom:0; font-size:0.85rem;" onclick="removeRestDay('${item.date}')" title="Delete Rest Day">✕</button>
        </div>
      </div>`;
    }

    // ── RENDER WORKOUT ──
    const w = item.data;
    const vol = w.exercises.reduce((a, e) => a + (e.sets * e.reps * e.weight), 0);
    const density = w.duration ? (vol / w.duration).toFixed(1) : 0;
    const chips = [...new Set(w.exercises.map(e => e.name))].map(name => `<span class="chip">${name}</span>`).join('');
    const musclePills = [...new Set(w.exercises.map(e => e.muscle).filter(Boolean))]
      .map(m => `<span class="meta-pill">${m}</span>`).join('');

    return `
    <div class="workout-entry-wrap">
      <div class="swipe-delete-bg">Delete ✕</div>
      <div class="workout-entry glass-panel" id="we-${w.id}" onclick="openViewWorkout(${w.id})">
        <div class="workout-entry-header">
          <div class="workout-entry-name">${w.name}</div>
          <div class="workout-meta">
            ${musclePills}
            ${w.duration ? `<span class="meta-pill"><strong>${w.duration}</strong> min</span>` : ''}
            <span class="meta-pill"><strong>${Math.round(vol).toLocaleString()}</strong> vol</span>
            <span class="meta-pill">⚡ <strong>${density}</strong> /min</span>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="exercise-chips">${chips}</div>
          <span style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--text);opacity:0.6;">${formatDate(w.date)}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  // Re-attach swipe-to-delete for the workouts
  combined.forEach(item => {
    if (item.type === 'workout') {
      const el = document.getElementById('we-' + item.data.id);
      if (el) attachSwipeDelete(el, item.data.id);
    }
  });
}

// Remove a logged rest day
function removeRestDay(date) {
  showConfirm({
    icon: '🗑️',
    title: 'Remove Rest Day',
    body: `Delete the rest day logged on ${formatDate(date)}?`,
    confirmLabel: 'Remove',
    danger: true,
    onConfirm: () => {
      restDays = restDays.filter(d => d !== date);
      localStorage.setItem('ironlog_rest_days', JSON.stringify(restDays));
      updateStats();
      renderHistory();
      renderProgress(); // Updates the heatmap immediately
      toast('Rest day removed');
    }
  });
}

function renderRecoveryHistory() {
  const card = document.getElementById('recoveryHistoryCard');
  const list = document.getElementById('recoveryHistoryList');
  if (!list) return;
  const sorted = [...recoveryLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!sorted.length) {
    if (card) card.style.display = 'none';
    return;
  }
  if (card) card.style.display = '';
  list.innerHTML = sorted.map(r => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
      <div>
        <div style="font-family:'DM Mono',monospace;font-size:0.7rem;color:var(--muted);margin-bottom:4px;">${formatDate(r.date)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${r.sleep ? `<span class="chip">😴 ${r.sleep}h sleep</span>` : ''}
          ${r.protein ? `<span class="chip">🥩 ${r.protein}g protein</span>` : ''}
          ${r.bodyweight ? `<span class="chip">⚖️ ${r.bodyweight}kg</span>` : ''}
          ${r.zinc ? `<span class="chip" style="color:var(--green)">💊 Zinc</span>` : ''}
          ${r.creatine ? `<span class="chip" style="color:var(--green)">⚡ Creatine</span>` : ''}
          ${r.soreness ? `<span class="chip">😤 Soreness ${r.soreness}/10</span>` : ''}
        </div>
      </div>
      <button class="btn-share" style="flex-shrink:0;margin-left:12px;" onclick="openEditRecovery('${r.date}')">✏️ Edit</button>
    </div>
  `).join('');
}

function deleteWorkout(id) {
  showConfirm({
    icon: '🗑️',
    title: 'Delete Workout',
    body: 'This workout will be permanently removed. This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: () => {
      workouts = workouts.filter(w => w.id !== id);
      save();
      updateStats();
      renderHistory();
      toast('Workout deleted');
    }
  });
}

// ─── SHARE WORKOUT AS IMAGE ───────────────────────────────────────────────────
function shareWorkout(id) {
  const w = workouts.find(x => x.id === id);
  if (!w) return;
  
  toast('Generating poster... ⏳');
  
  const vol = w.exercises.reduce((a, e) => a + (e.sets * e.reps * e.weight), 0);
  const node = document.getElementById('share-node');
  
  // Group flat data into blocks for a cleaner poster
  const grouped = {};
  w.exercises.forEach(e => {
    const key = e.name.toLowerCase();
    if (!grouped[key]) grouped[key] = { name: e.name, muscle: e.muscle, loads: [] };
    grouped[key].loads.push({ s: e.sets, r: e.reps, w: e.weight });
  });

  // Adapt colors based on Light/Dark mode for the poster output
  const isLight = document.body.classList.contains('light-mode');
  const bgGrid = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)';
  const bgColor = isLight ? '#f2f2f0' : '#050505';
  const cardBg = isLight ? 'rgba(255,255,255,0.8)' : 'rgba(20,20,20,0.8)';
  const textColor = isLight ? '#111' : '#f0f0f0';
  const mutedColor = isLight ? '#777' : '#888';
  const borderColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';

  node.innerHTML = `
    <div class="share-content" style="background-color: ${bgColor}; background-image: radial-gradient(circle at 15% 50%, rgba(232,255,71,0.08), transparent 40%), radial-gradient(circle at 85% 30%, rgba(255,107,53,0.08), transparent 40%), linear-gradient(${bgGrid} 1px, transparent 1px), linear-gradient(90deg, ${bgGrid} 1px, transparent 1px); background-size: 100% 100%, 100% 100%, 40px 40px, 40px 40px; padding: 40px; border-radius: 20px;">
      
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 30px;">
        <div>
          <div style="font-family:'Bebas Neue', sans-serif; font-size:3.5rem; letter-spacing:0.08em; color:var(--accent); margin-bottom:5px; line-height:1; text-shadow: 0 0 20px rgba(232,255,71,0.2);">
            Iron<span style="color:${textColor}">Log</span>
          </div>
          <div style="font-family:'DM Mono', monospace; font-size:0.85rem; letter-spacing:0.1em; color:${mutedColor}; text-transform:uppercase;">
            ${formatDate(w.date)}
          </div>
        </div>
      </div>

      <div style="font-family:'Bebas Neue', sans-serif; font-size:2.8rem; letter-spacing:0.05em; color:${textColor}; margin-bottom:24px; line-height:1.1;">
        ${w.name}
      </div>

      <div style="display:flex; gap:16px; margin-bottom:30px;">
        <div style="background:${cardBg}; border:1px solid ${borderColor}; border-radius:16px; padding:20px; flex:1; position:relative; overflow:hidden;">
          <div style="position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg, var(--accent), transparent);"></div>
          <div style="font-family:'DM Mono', monospace; font-size:0.75rem; letter-spacing:0.12em; color:${mutedColor}; margin-bottom:8px;">TOTAL VOLUME</div>
          <div style="font-family:'Bebas Neue', sans-serif; font-size:2.4rem; color:var(--accent); line-height:1;">${Math.round(vol).toLocaleString()} KG</div>
        </div>
        ${w.duration ? `
        <div style="background:${cardBg}; border:1px solid ${borderColor}; border-radius:16px; padding:20px; flex:1; position:relative; overflow:hidden;">
          <div style="position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg, var(--accent), transparent);"></div>
          <div style="font-family:'DM Mono', monospace; font-size:0.75rem; letter-spacing:0.12em; color:${mutedColor}; margin-bottom:8px;">DURATION</div>
          <div style="font-family:'Bebas Neue', sans-serif; font-size:2.4rem; color:${textColor}; line-height:1;">${w.duration} MIN</div>
        </div>` : ''}
      </div>

      <div style="background:${cardBg}; border:1px solid ${borderColor}; border-radius:20px; padding:24px;">
        <div style="font-family:'DM Mono', monospace; font-size:0.75rem; letter-spacing:0.1em; color:${mutedColor}; margin-bottom:20px; border-bottom:1px solid ${borderColor}; padding-bottom:12px;">EXERCISES</div>
        
        ${Object.values(grouped).map((group, i, arr) => `
          <div style="margin-bottom:${i === arr.length - 1 ? '0' : '20px'};">
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
              <span style="font-size:1.2rem; font-weight:500; color:${textColor}; font-family:'Bebas Neue', sans-serif; letter-spacing:0.04em;">${group.name}</span>
              ${group.muscle ? `<span style="font-family:'DM Mono', monospace; font-size:0.65rem; color:${mutedColor}; text-transform:uppercase;">${group.muscle}</span>` : ''}
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${group.loads.map(l => `
                <span style="font-family:'DM Mono', monospace; font-size:0.85rem; color:var(--accent); background:rgba(232,255,71,0.1); padding:4px 10px; border-radius:6px; border:1px solid rgba(232,255,71,0.2);">
                  ${l.s} × ${l.r} @ <strong style="font-weight:600;">${l.w}kg</strong>
                </span>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  setTimeout(() => {
    // Target the specific inner content so background styling stays perfectly bound
    html2canvas(node.querySelector('.share-content'), {
      backgroundColor: null,
      scale: 2,
      logging: false,
      useCORS: true
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = `ironlog-${w.date.replace(/-/g, '')}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
      toast('Poster saved! Ready for Instagram. 📸');
      node.innerHTML = ''; // Clean up invisible DOM
    }).catch(err => {
      console.error(err);
      toast('Failed to generate image.');
    });
  }, 150); // slight delay to ensure fonts render before snapping
}

let bwChartInstance = null;

function renderBodyweightChart() {
  const canvas = document.getElementById('bwChart');
  const card = canvas?.closest('.card');
  if (!canvas) return;

  // Collect bodyweight entries sorted oldest → newest
  const entries = [...recoveryLogs]
    .filter(r => r.bodyweight > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (bwChartInstance) { bwChartInstance.destroy(); bwChartInstance = null; }

  if (!entries.length) {
    if (card) card.style.display = 'none';
    return;
  }
  if (card) card.style.display = '';

  const labels = entries.map(r => formatDate(r.date));
  const data   = entries.map(r => r.bodyweight);
  const minBW  = Math.min(...data) - 2;
  const maxBW  = Math.max(...data) + 2;

  bwChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Bodyweight (kg)',
        data,
        borderColor: '#44ff88',
        backgroundColor: 'rgba(68,255,136,0.08)',
        borderWidth: 2.5,
        pointBackgroundColor: '#44ff88',
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111',
          borderColor: '#2a2a2a',
          borderWidth: 1,
          titleColor: '#44ff88',
          bodyColor: '#f0f0f0',
          titleFont: { family: 'DM Mono' },
          bodyFont: { family: 'DM Mono' },
          callbacks: { label: ctx => `${ctx.raw} kg` }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(255,255,255,0.4)', font: { family: 'DM Mono', size: 9 } }
        },
        y: {
          min: minBW,
          max: maxBW,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#44ff88', font: { family: 'DM Mono', size: 9 }, callback: v => v + ' kg' }
        }
      }
    }
  });
}

// ─── PROGRESS CHART & PRs ───────────────────────────────────────────────────
function renderProgress() {
  renderPRs();
  renderChart();
  renderBodyweightChart();
  populateStrengthPicker();
  renderStrengthChart();
}

let activePRMuscle = 'All';

function renderPRs() {
  // Build PRs map: exercise name → best entry (with muscle group from the workout)
  const prs = {};
  workouts.forEach(w => {
    w.exercises.forEach(e => {
      if (!e.name) return;
      const key = e.name.toLowerCase();
      if (!prs[key] || e.weight > prs[key].weight) {
        prs[key] = { name: e.name, weight: e.weight, sets: e.sets, reps: e.reps, date: w.date, muscle: e.muscle || 'Other' };
      }
    });
  });

  const allEntries = Object.values(prs).sort((a, b) => b.weight - a.weight);
  const grid = document.getElementById('prGrid');
  const tabsEl = document.getElementById('prMuscleTabs');

  if (!allEntries.length) {
    tabsEl.innerHTML = '';
    grid.innerHTML = `<div class="empty-state" style="grid-column:span 2"><div class="empty-icon">🏆</div>Log workouts to see your PRs.</div>`;
    return;
  }

  // Build muscle group list
  const muscles = ['All', ...new Set(allEntries.map(e => e.muscle))];

  // Render tabs
  tabsEl.innerHTML = muscles.map(m => `
    <button class="muscle-tab-btn ${m === activePRMuscle ? 'active' : ''}" onclick="setPRMuscle('${m}')">${m}</button>
  `).join('');

  // Filter entries
  const filtered = activePRMuscle === 'All' ? allEntries : allEntries.filter(e => e.muscle === activePRMuscle);

  grid.innerHTML = filtered.slice(0, 10).map(pr => {
    const oneRM = Math.round(calculate1RM(pr.weight, pr.reps));
    return `
    <div class="pr-card glass-panel">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <div class="pr-exercise">${pr.name}</div>
        <span style="font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--muted);background:rgba(255,255,255,0.05);padding:2px 7px;border-radius:10px;white-space:nowrap;">${pr.muscle}</span>
      </div>
      <div class="pr-weight">${pr.weight} <span style="font-size:1rem;color:var(--text);opacity:0.5;">kg</span></div>
      <div class="pr-detail">${pr.sets}×${pr.reps} · ${formatDate(pr.date)}</div>
      <div style="margin-top:12px;display:inline-block;background:rgba(232,255,71,0.1);border:1px solid rgba(232,255,71,0.2);color:var(--accent);padding:4px 8px;border-radius:6px;font-family:'DM Mono',monospace;font-size:0.7rem;letter-spacing:0.05em;">
        EST 1RM: <strong>${oneRM} KG</strong>
      </div>
    </div>`;
  }).join('');
}

function setPRMuscle(muscle) {
  activePRMuscle = muscle;
  renderPRs();
}

let activeChartMuscle = 'All';

function setChartMuscle(muscle, btn) {
  activeChartMuscle = muscle;
  document.querySelectorAll('.chart-muscle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderChart();
}

function renderChart() {
  const canvas = document.getElementById('volumeChart');
  const wrap = document.querySelector('.chart-wrap');
  if (!canvas || !wrap) return;

  const now = new Date();
  let cutoff = new Date(0);
  if (chartRange === '4w') { cutoff = new Date(now); cutoff.setDate(now.getDate() - 28); }
  if (chartRange === '3m') { cutoff = new Date(now); cutoff.setMonth(now.getMonth() - 3); }

  const filtered = workouts.filter(w => new Date(w.date) >= cutoff);

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  const existingEmpty = wrap.querySelector('.empty-state');
  if (existingEmpty) existingEmpty.remove();

  // Rebuild muscle filter tabs from exercises in range
  const allMusclesInRange = [...new Set(
    filtered.flatMap(w => w.exercises.map(e => e.muscle).filter(Boolean))
  )].sort();
  const filterContainer = document.getElementById('chartMuscleFilter');
  if (filterContainer) {
    filterContainer.innerHTML = ['All', ...allMusclesInRange].map(m => `
      <button class="chart-btn chart-muscle-btn ${m === activeChartMuscle ? 'active' : ''}"
        onclick="setChartMuscle('${m}', this)">${m}</button>
    `).join('');
  }

  // Filter workouts by active muscle (exercise-level)
  const displayData = activeChartMuscle === 'All'
    ? filtered
    : filtered.map(w => ({
        ...w,
        exercises: w.exercises.filter(e => e.muscle === activeChartMuscle)
      })).filter(w => w.exercises.length > 0);

  if (!displayData.length) {
    canvas.style.display = 'none';
    wrap.insertAdjacentHTML('beforeend', '<div class="empty-state">No data for this period.</div>');
    document.getElementById('chartLegend').innerHTML = '';
    return;
  }
  canvas.style.display = 'block';

  // Unique sorted dates
  const allDates = [...new Set(displayData.map(w => w.date))].sort((a, b) => new Date(a) - new Date(b));

  // Muscle groups from exercises (not sessions)
  const muscleGroups = activeChartMuscle === 'All'
    ? [...new Set(displayData.flatMap(w => w.exercises.map(e => e.muscle || 'Other')))]
    : [activeChartMuscle];

  const palette = {
    'Chest':      { bg: 'rgba(232,255,71,0.7)',   border: '#e8ff47' },
    'Back':       { bg: 'rgba(255,107,53,0.7)',   border: '#ff6b35' },
    'Shoulders':  { bg: 'rgba(68,255,136,0.7)',   border: '#44ff88' },
    'Arms':       { bg: 'rgba(100,180,255,0.7)',  border: '#64b4ff' },
    'Legs':       { bg: 'rgba(200,100,255,0.7)',  border: '#c864ff' },
    'Core':       { bg: 'rgba(255,200,50,0.7)',   border: '#ffc832' },
    'Full Body':  { bg: 'rgba(255,255,255,0.5)',  border: '#ffffff' },
    'Cardio':     { bg: 'rgba(255,80,80,0.7)',    border: '#ff5050' },
    'Other':      { bg: 'rgba(120,120,120,0.5)',  border: '#888888' },
  };

  // Volume per muscle group per date — from exercise.muscle
  const datasets = muscleGroups.map(muscle => {
    const c = palette[muscle] || { bg: 'rgba(200,200,200,0.5)', border: '#ccc' };
    return {
      label: muscle,
      data: allDates.map(date => {
        const vol = displayData
          .filter(w => w.date === date)
          .reduce((sum, w) => sum + w.exercises
            .filter(e => (e.muscle || 'Other') === muscle)
            .reduce((a, e) => a + e.sets * e.reps * e.weight, 0), 0);
        return vol || null;
      }),
      backgroundColor: c.bg,
      borderColor: c.border,
      borderWidth: 1.5,
      borderRadius: 4,
      stack: 'volume',
    };
  });

  // Legend
  document.getElementById('chartLegend').innerHTML = muscleGroups.map(m => {
    const c = palette[m] || { border: '#ccc' };
    return `<div class="legend-item"><span style="width:10px;height:10px;border-radius:50%;background:${c.border};box-shadow:0 0 8px ${c.border};display:inline-block;"></span> ${m}</div>`;
  }).join('');

  chartInstance = new Chart(canvas, {
    type: 'bar',
    data: { labels: allDates.map(d => formatDate(d)), datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111', borderColor: '#2a2a2a', borderWidth: 1,
          titleColor: '#e8ff47', bodyColor: '#f0f0f0',
          titleFont: { family: 'DM Mono' }, bodyFont: { family: 'DM Mono' },
          callbacks: { label: ctx => `${ctx.dataset.label}: ${Math.round(ctx.raw || 0).toLocaleString()} kg` }
        }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.4)', font: { family: 'DM Mono', size: 9 } } },
        y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#e8ff47', font: { family: 'DM Mono', size: 9 }, callback: v => v.toLocaleString() + ' kg' } }
      }
    }
  });
}

function setChartRange(range, btn) {
  chartRange = range;
  document.querySelectorAll('.chart-btn:not(.chart-muscle-btn)').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderChart();
}

// ─── BACKUP & DATA FUNCTIONS ──────────────────────────────────────────────────
// ─── BACKUP & DATA FUNCTIONS ──────────────────────────────────────────────────
function exportJSON() {
  if (!workouts.length && !recoveryLogs.length && !restDays.length) {
    return toast('No data to export!');
  }

  // Create a bundle of all user data including the latest features
  const backupData = {
    version: "4.0", // v4: added restDays, weeklyTarget, and lightMode
    workouts: workouts,
    recovery: recoveryLogs,
    exercises: exercisesDB,
    restDays: restDays,
    weeklyTarget: weeklyTarget,
    lightMode: localStorage.getItem('ironlog_light_mode') || '0'
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `ironlog_full_backup_${new Date().toISOString().split('T')[0]}.json`);
  dlAnchorElem.click();
  toast('Full backup exported! 💾');
}

function importJSON() {
  const fileInput = document.getElementById('importFile');
  const file = fileInput.files[0];
  if (!file) return toast('Please select a JSON file first');

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      
      const doImport = () => {
        // Handle New Full Backup Format (Object)
        if (imported.workouts && imported.recovery) {
          workouts = imported.workouts;
          recoveryLogs = imported.recovery;
          
          if (imported.exercises) exercisesDB = migrateExercisesDB(JSON.stringify(imported.exercises));
          if (imported.restDays) restDays = imported.restDays;
          if (imported.weeklyTarget !== undefined) weeklyTarget = imported.weeklyTarget;
          
          const isLight = imported.lightMode === '1';
          localStorage.setItem('ironlog_light_mode', imported.lightMode || '0');
          toggleLightMode(isLight);
          
          const toggleEl = document.getElementById('lightModeToggle');
          if (toggleEl) toggleEl.checked = isLight;

          localStorage.setItem('ironlog_exercises', JSON.stringify(exercisesDB));
          localStorage.setItem('ironlog_recovery', JSON.stringify(recoveryLogs));
          localStorage.setItem('ironlog_rest_days', JSON.stringify(restDays));
          localStorage.setItem('ironlog_weekly_target', weeklyTarget);
        }
        // Handle Legacy Backup Format (Simple Array)
        else if (Array.isArray(imported)) {
          workouts = imported;
        }
        
        save();
        updateStats();
        renderHistory();
        renderProgress();
        renderNutritionInsights();
        toast('Data restored successfully! ✅');
        fileInput.value = '';
      };

      showConfirm({
        icon: '⬆️',
        title: 'Import Backup',
        body: 'This will merge/replace your current data with the backup file. Continue?',
        confirmLabel: 'Import',
        onConfirm: doImport
      });
    } catch (err) {
      console.error(err);
      toast('Error: Invalid backup file.');
    }
  };
  reader.readAsText(file);
}

function exportCSV() {
  if (!workouts.length && !recoveryLogs.length && !restDays.length) return toast('No data to export!');

  let csvContent = "data:text/csv;charset=utf-8,";

  // ── WORKOUTS SECTION ──
  if (workouts.length) {
    csvContent += "WORKOUTS\n";
    csvContent += "Date,Workout Name,Duration (min),Exercise,Muscle,Sets,Reps,Weight (kg),Est. 1RM (kg),Volume (kg),Notes\n";

    workouts.forEach(w => {
      const date = w.date;
      const wName = `"${w.name || ''}"`;
      const dur = w.duration || '';
      const notes = `"${(w.notes || '').replace(/"/g, '""')}"`;

      w.exercises.forEach(e => {
        const eName = `"${e.name || ''}"`;
        const eMuscle = e.muscle || '';
        const oneRM = Math.round(calculate1RM(e.weight, e.reps));
        const volume = Math.round(e.sets * e.reps * e.weight);
        const row = [date, wName, dur, eName, eMuscle, e.sets, e.reps, e.weight, oneRM, volume, notes].join(",");
        csvContent += row + "\n";
      });
    });
  }

  // ── RECOVERY LOG SECTION ──
  if (recoveryLogs.length) {
    csvContent += "\nRECOVERY LOG\n";
    csvContent += "Date,Sleep (hrs),Protein (g),Bodyweight (kg),Zinc,Creatine,Soreness (1-10)\n";

    [...recoveryLogs]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(r => {
        const row = [
          r.date,
          r.sleep || 0,
          r.protein || 0,
          r.bodyweight || '',
          r.zinc ? 'Yes' : 'No',
          r.creatine ? 'Yes' : 'No',
          r.soreness || ''
        ].join(",");
        csvContent += row + "\n";
      });
  }

  // ── REST DAYS SECTION ──
  if (restDays.length) {
    csvContent += "\nREST DAYS\nDate\n";
    [...restDays].sort().forEach(d => { csvContent += `${d}\n`; });
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `ironlog_export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast('Full CSV exported! 📊');
}

function clearAllData() {
  showConfirm({
    icon: '⚠️',
    title: 'Delete All Data',
    body: 'This permanently deletes all workouts, recovery logs, and custom exercises. Make sure you have exported a backup first.',
    confirmLabel: 'Delete Everything',
    danger: true,
    onConfirm: () => {
      workouts = [];
      recoveryLogs = [];
      exercisesDB = [...defaultExercises];
      save();
      localStorage.setItem('ironlog_recovery', JSON.stringify(recoveryLogs));
      localStorage.setItem('ironlog_exercises', JSON.stringify(exercisesDB));
      updateStats();
      renderHistory();
      renderRecoveryHistory();
      renderProgress();
      renderNutritionInsights();
      renderSettingsExerciseList();
      renderExerciseDB();
      toast('All data wiped.');
    }
  });
}

// ─── FULL PAGE REST TIMER LOGIC ───────────────────────────────────────────────
let timerInterval = null;
let timerSeconds = 0;

function startTimer(seconds) {
  timerSeconds = seconds;
  updateTimerDisplay();
  
  const widget = document.getElementById('restTimerWidget');
  widget.classList.add('active');
  widget.classList.remove('blinking');
  
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    if (timerSeconds > 0) {
      timerSeconds--;
      updateTimerDisplay();
    }
    
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      widget.classList.add('blinking');
      toast('⏰ Rest time is up!');
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  const widget = document.getElementById('restTimerWidget');
  widget.classList.remove('active');
  widget.classList.remove('blinking');
}

function adjustTimer(sec) {
  timerSeconds += sec;
  if (timerSeconds < 0) timerSeconds = 0;
  updateTimerDisplay();
  
  const widget = document.getElementById('restTimerWidget');
  if (timerSeconds > 0 && widget.classList.contains('blinking')) {
    widget.classList.remove('blinking');
    startTimer(timerSeconds); 
  }
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  document.getElementById('timerDisplay').textContent = 
    `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ─── 1RM CALCULATOR ───────────────────────────────────────────────────────────
function calculate1RM(weight, reps) {
  if (reps <= 1) return weight;
  // Epley Formula
  return weight * (1 + (reps / 30));
}

// ─── #12 LIGHT MODE ───────────────────────────────────────────────────────────
function toggleLightMode(on) {
  document.body.classList.toggle('light-mode', on);
  localStorage.setItem('ironlog_light_mode', on ? '1' : '0');
}

// ─── #5 WEEKLY VOLUME TARGET ──────────────────────────────────────────────────
function saveWeeklyTarget() {
  const val = parseInt(document.getElementById('weeklyTargetInput').value) || 0;
  weeklyTarget = val;
  localStorage.setItem('ironlog_weekly_target', val);
  updateWeeklyTargetBar();
  toast(val > 0 ? `Target set: ${val.toLocaleString()} kg/week 🎯` : 'Target cleared');
}

function updateWeeklyTargetBar() {
  const wrap = document.getElementById('weeklyTargetWrap');
  const hint = document.getElementById('weeklyTargetHint');
  if (!wrap) return;
  if (!weeklyTarget) { wrap.style.display = 'none'; if (hint) hint.textContent = 'No target set.'; return; }

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekVol = workouts
    .filter(w => new Date(w.date) >= weekStart)
    .reduce((sum, w) => sum + w.exercises.reduce((a, e) => a + e.sets * e.reps * e.weight, 0), 0);

  const pct = Math.min(100, (weekVol / weeklyTarget) * 100);
  wrap.style.display = '';
  document.getElementById('weeklyVolDisplay').textContent =
    `${Math.round(weekVol).toLocaleString()} / ${weeklyTarget.toLocaleString()} kg`;
  document.getElementById('weeklyBarFill').style.width = pct + '%';
  if (hint) hint.textContent = weeklyTarget > 0
    ? `Current: ${Math.round(weekVol).toLocaleString()} kg this week (${Math.round(pct)}%)`
    : 'No target set.';
}

// ─── #6 REST DAY ──────────────────────────────────────────────────────────────
function logRestDay() {
  const todayStr = new Date().toISOString().split('T')[0];
  let selectedDate = document.getElementById('wDate').value;
  
  if (!selectedDate) {
    selectedDate = todayStr;
  }

  // Determine the friendly name for the toast
  const dateLabel = (selectedDate === todayStr) ? 'today' : formatDate(selectedDate);

  if (restDays.includes(selectedDate)) {
    return toast(`Rest day already logged for ${dateLabel}.`);
  }

  restDays.push(selectedDate);
  localStorage.setItem('ironlog_rest_days', JSON.stringify(restDays));
  updateStats();
  
  toast(`Rest day logged for ${dateLabel} 🛌`);
}

// ─── #9 LAST SESSION INFO ─────────────────────────────────────────────────────
function updateLastSessionInfo(workoutName) {
  const bar = document.getElementById('lastSessionBar');
  if (!bar) return;
  if (!workoutName) { bar.classList.remove('visible'); return; }
  const prev = workouts.find(w => w.name.toLowerCase() === workoutName.toLowerCase());
  if (!prev) { bar.classList.remove('visible'); return; }
  const vol = prev.exercises.reduce((a, e) => a + e.sets * e.reps * e.weight, 0);
  const daysAgo = Math.round((Date.now() - new Date(prev.date + 'T00:00:00')) / 86400000);
  const daysStr = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`;
  bar.innerHTML = `Last: <strong>${daysStr}</strong> · <strong>${Math.round(vol).toLocaleString()} kg</strong>`;
  bar.classList.add('visible');
}

// ─── #2 LIVE SESSION VOLUME ───────────────────────────────────────────────────
function updateSessionVolume() {
  const el = document.getElementById('sessionVolDisplay');
  if (!el || !sessionStartTime) return;
  const exercises = collectExercises();
  const vol = exercises.reduce((a, e) => a + e.sets * e.reps * e.weight, 0);
  el.textContent = `${Math.round(vol).toLocaleString()} kg`;
}

// ─── #3 SET COUNTER (handled per load row via incrementSetCounterLoad) ────────
function incrementSetCounter(id) { /* no-op: use incrementSetCounterLoad for new block system */ }

// ─── #4 STRENGTH OVER TIME CHART ─────────────────────────────────────────────
function populateStrengthPicker() {
  const picker = document.getElementById('strengthExercisePicker');
  if (!picker) return;
  const names = [...new Set(workouts.flatMap(w => w.exercises.map(e => e.name)))].sort();
  const current = picker.value;
  picker.innerHTML = '<option value="">Pick an exercise…</option>' +
    names.map(n => `<option value="${n}" ${n === current ? 'selected' : ''}>${n}</option>`).join('');
}

function renderStrengthChart() {
  const picker = document.getElementById('strengthExercisePicker');
  const canvas = document.getElementById('strengthChart');
  if (!canvas || !picker) return;

  const name = picker.value;
  if (!name) { if (strengthChartInstance) { strengthChartInstance.destroy(); strengthChartInstance = null; } return; }

  // Best weight per session date
  const points = workouts
    .filter(w => w.exercises.some(e => e.name.toLowerCase() === name.toLowerCase()))
    .map(w => {
      const best = w.exercises
        .filter(e => e.name.toLowerCase() === name.toLowerCase())
        .reduce((a, b) => b.weight > a.weight ? b : a);
      return { date: w.date, weight: best.weight, reps: best.reps };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (strengthChartInstance) { strengthChartInstance.destroy(); strengthChartInstance = null; }
  if (!points.length) return;

  // Mark PRs
  let maxW = 0;
  const isPR = points.map(p => { const pr = p.weight > maxW; if (pr) maxW = p.weight; return pr; });

  strengthChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: points.map(p => formatDate(p.date)),
      datasets: [{
        label: name,
        data: points.map(p => p.weight),
        borderColor: '#e8ff47',
        backgroundColor: 'rgba(232,255,71,0.07)',
        borderWidth: 2.5,
        pointBackgroundColor: points.map((_, i) => isPR[i] ? '#e8ff47' : 'rgba(232,255,71,0.4)'),
        pointRadius: points.map((_, i) => isPR[i] ? 6 : 4),
        pointHoverRadius: 7,
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111', borderColor: '#2a2a2a', borderWidth: 1,
          titleColor: '#e8ff47', bodyColor: '#f0f0f0',
          titleFont: { family: 'DM Mono' }, bodyFont: { family: 'DM Mono' },
          callbacks: {
            label: ctx => {
              const p = points[ctx.dataIndex];
              return `${p.weight} kg × ${p.reps} reps${isPR[ctx.dataIndex] ? ' 🏆 PR' : ''}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.4)', font: { family: 'DM Mono', size: 9 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#e8ff47', font: { family: 'DM Mono', size: 9 }, callback: v => v + ' kg' } }
      }
    }
  });
}

// ─── #8 SWIPE TO DELETE ───────────────────────────────────────────────────────
function attachSwipeDelete(el, workoutId) {
  let startX = 0, currentX = 0, isDragging = false;
  const THRESHOLD = 80;

  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    isDragging = true;
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (!isDragging) return;
    currentX = e.touches[0].clientX - startX;
    if (currentX < 0) el.style.transform = `translateX(${Math.max(currentX, -120)}px)`;
  }, { passive: true });

  el.addEventListener('touchend', () => {
    isDragging = false;
    if (currentX < -THRESHOLD) {
      el.style.transform = 'translateX(-120px)';
      showConfirm({
        icon: '🗑️',
        title: 'Delete Workout',
        body: 'This workout will be permanently removed.',
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: () => deleteWorkout(workoutId),
        onCancel: () => { el.style.transform = ''; }
      });
    } else {
      el.style.transform = '';
    }
    currentX = 0;
  });
}

// ─── #14 PR HIGHLIGHT IN PEEK HISTORY ────────────────────────────────────────
// (integrated into peekHistory below — see updated function)

// ─── #7 WORKOUT NAME AUTOCOMPLETE ────────────────────────────────────────────
function refreshWorkoutNameDB() {
  const dl = document.getElementById('workout-name-db');
  if (!dl) return;
  const names = [...new Set(workouts.map(w => w.name))];
  dl.innerHTML = names.map(n => `<option value="${n}">`).join('');
}


function save() {
  localStorage.setItem('ironlog_workouts', JSON.stringify(workouts));
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}