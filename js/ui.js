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

function toast(msg) {
  const el = document.getElementById('toast');
  const fab = document.getElementById('fabEndSession');
  
  // Check if the End Session button is currently visible
  if (fab && fab.style.display !== 'none') {
    el.classList.add('lifted');
  } else {
    el.classList.remove('lifted');
  }

  el.textContent = msg;
  el.classList.add('show');
  
  // Clean up after it fades out
  setTimeout(() => {
    el.classList.remove('show');
    // Optional: wait for fade animation to finish before removing the lift
    setTimeout(() => el.classList.remove('lifted'), 400); 
  }, 2800);
}

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

let editingWorkoutId = null;
let editExerciseCount = 0;

function openModal(id) {
  document.getElementById(id).classList.add('active');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

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

function toggleLightMode(isLight) {
  const toggleEl = document.getElementById('lightModeToggle');
  if (toggleEl) toggleEl.checked = isLight;
  
  if (isLight) {
    document.body.classList.add('light-mode');
    // Inject dark gridlines and text for Light Mode charts
    Chart.defaults.color = '#6b7280';
    Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.08)';
  } else {
    document.body.classList.remove('light-mode');
    // Revert to light gridlines and text for Dark Mode charts
    Chart.defaults.color = 'rgba(255, 255, 255, 0.6)';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
  }
  
  localStorage.setItem('ironlog_light_mode', isLight ? '1' : '0');
  
  // If the user is looking at the Progress tab, re-draw the charts immediately
  if (document.getElementById('view-progress').classList.contains('active')) {
    renderProgress();
  }
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