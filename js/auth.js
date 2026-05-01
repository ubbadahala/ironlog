// js/auth.js

// TODO: Replace with your actual Supabase URL and Anon Key
const supabaseUrl = 'https://gmtoubsbfohjvfwgpcul.supabase.co';
const supabaseKey = 'sb_publishable_vFentuyMfMOGoXL-KGj7xA_xj3KkKF_';

// CHANGED: Renamed to supabaseClient to avoid colliding with the CDN library
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;

function updateAccountUI() {
  const emailDisplay = document.getElementById('currentUserEmail');
  if (emailDisplay) {
    if (currentUser) {
      emailDisplay.textContent = currentUser.email;
    } else {
      emailDisplay.textContent = 'Not logged in';
    }
  }
}

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    updateAccountUI();
    document.getElementById('authOverlay').classList.remove('active');
    await syncDataFromSupabase(); 
  } else {
    document.getElementById('authOverlay').classList.add('active');
  }
}

async function handleLogin() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errorEl = document.getElementById('authError');
  
  if (!email || !password) {
    errorEl.textContent = "Please enter both email and password.";
    errorEl.style.display = 'block';
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  
  if (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = 'block';
  } else {
    errorEl.style.display = 'none';
    currentUser = data.user;
    updateAccountUI();
    document.getElementById('authOverlay').classList.remove('active');
    await syncDataFromSupabase();
  }
}

async function handleSignUp() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errorEl = document.getElementById('authError');
  
  if (!email || !password) {
    errorEl.textContent = "Please enter both an email and password.";
    errorEl.style.display = 'block';
    return;
  }

  toast("Creating account... ⏳");
  
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  
  if (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = 'block';
  } else {
    errorEl.style.display = 'none';
    
    if (data.session) {
      // User logged in immediately (Email Confirmation is OFF in Supabase)
      currentUser = data.session.user;
      updateAccountUI();
      document.getElementById('authOverlay').classList.remove('active');
      await syncDataFromSupabase();
      toast("Account created! Welcome to IronLog 🎉");
    } else {
      // User must confirm email (Email Confirmation is ON in Supabase)
      document.getElementById('authPassword').value = ''; // Clear password for security
      
      // Inject the email they typed into the success message
      document.getElementById('sentEmailAddress').textContent = email;
      
      // Swap the UI views
      document.getElementById('authFormContainer').style.display = 'none';
      document.getElementById('authSuccessContainer').style.display = 'block';
    }
  }
}

// Helper to switch the modal back to the login form
function resetAuthView() {
  document.getElementById('authSuccessContainer').style.display = 'none';
  document.getElementById('authFormContainer').style.display = 'block';
  document.getElementById('authError').style.display = 'none';
}

async function handleLogout() {
  // 1. Kill the Supabase session
  await supabaseClient.auth.signOut();
  currentUser = null;
  updateAccountUI();
  
  // 2. Empty the local data arrays
  workouts = [];
  recoveryLogs = [];
  restDays = [];
  exercisesDB = [...defaultExercises];
  
  // 3. Nuke old LocalStorage data so it doesn't "ghost" back in
  localStorage.clear();

  // 4. Force the UI to re-render immediately (This wipes the screen clean)
  updateStats();
  renderHistory();
  renderProgress();
  renderNutritionInsights();
  refreshWorkoutNameDB();
  renderSettingsExerciseList();
  renderExerciseDB();

  // 5. Cancel any active workout session timers
  if (typeof sessionClockInterval !== 'undefined' && sessionClockInterval) {
    clearInterval(sessionClockInterval);
    sessionClockInterval = null;
    sessionStartTime = null;
    document.getElementById('sessionBar').classList.remove('active');
    document.getElementById('sessionClock').textContent = '00:00';
    document.getElementById('sessionToggleBtn').textContent = '▶ Start Session';
    document.getElementById('sessionToggleBtn').classList.remove('running');
    document.getElementById('fabEndSession').style.display = 'none';
  }

  // 6. Show the login modal and clear inputs
  document.getElementById('authOverlay').classList.add('active');
  document.getElementById('authPassword').value = '';
  document.getElementById('authEmail').value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  checkSession();
});