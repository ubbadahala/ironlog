function updateStats() {
  document.getElementById('statTotal').textContent = workouts.length;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  
  // 1. Convert local weekStart to a YYYY-MM-DD string
  const weekStartStr = getLocalDateString(weekStart);
  
  // 2. Compare strings directly!
  const weekCount = workouts.filter(w => w.date >= weekStartStr).length;
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
    const ds = getLocalDateString(d); // This part you already fixed beautifully!
    if (activeDates.has(ds)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  document.getElementById('statStreak').textContent = streak;
  updateWeeklyTargetBar();
}

function refreshWorkoutNameDB() {
  const dl = document.getElementById('workout-name-db');
  if (!dl) return;
  const names = [...new Set(workouts.map(w => w.name))];
  dl.innerHTML = names.map(n => `<option value="${n}">`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();

  document.getElementById('rDate').value = getLocalDateString();
  document.getElementById('wDate').value = getLocalDateString();
  
  // This uses local time automatically, so it's perfectly safe:
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
  checkAndRestoreDraft();

  document.getElementById('confirmOverlay').addEventListener('click', e => {
    if (e.target.id === 'confirmOverlay') dismissConfirm();
  });

  checkAndRestoreDraft();
});
