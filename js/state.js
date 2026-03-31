let recoveryLogs = JSON.parse(localStorage.getItem('ironlog_recovery') || '[]');
let workouts = JSON.parse(localStorage.getItem('ironlog_workouts') || '[]');
let restDays = JSON.parse(localStorage.getItem('ironlog_rest_days') || '[]'); // array of date strings
let weeklyTarget = parseInt(localStorage.getItem('ironlog_weekly_target') || '0');

let chartInstance = null;
let strengthChartInstance = null;
let bwChartInstance = null;
let radarInstance = null;

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
const MUSCLE_OPTIONS = ['', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Full Body', 'Cardio'];
const HEAVY_COMPOUNDS = ['bench', 'squat', 'deadlift', 'press', 'row', 'pull up', 'leg press'];


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

function save() {
  try {
    localStorage.setItem('ironlog_workouts', JSON.stringify(workouts));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      toast('Storage full! Please export a backup and clear old data.');
    }
  }
}

function saveExercises() {
  localStorage.setItem('ironlog_exercises', JSON.stringify(exercisesDB));
  renderExerciseDB();
  renderSettingsExerciseList();
}