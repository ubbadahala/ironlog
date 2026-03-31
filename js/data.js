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
  dlAnchorElem.setAttribute("download", `ironlog_full_backup_${getLocalDateString()}.json`);
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
  link.setAttribute("download", `ironlog_export_${getLocalDateString()}.csv`);
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

function renderExerciseDB() {
  const datalist = document.getElementById('exercise-db');
  datalist.innerHTML = exercisesDB.map(ex => `<option value="${ex.name}">`).join('');
}

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
  
  // Convert the local weekStart date into a clean YYYY-MM-DD string
  const weekStartStr = getLocalDateString(weekStart);

  const weekVol = workouts
    // FIX: Compare the strings directly! No timezones, no math, just alphabetical order.
    .filter(w => w.date >= weekStartStr)
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