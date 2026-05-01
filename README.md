# 🏋️ IronLog: Cloud-Native Gym Tracker

IronLog is a lightning-fast, Single Page Application (SPA) built for tracking workouts, recovery metrics, and personal records. Originally built as an offline-first `localStorage` app, IronLog v4.0 has been completely re-architected to be a fully cloud-synced platform powered by Supabase.

## 🚀 The v4.0 Cloud Migration Updates

This major release transitions the application from local browser storage to a secure, relational PostgreSQL database with real-time cloud synchronization.

### ☁️ Supabase Authentication & Security
* **Full Auth Flow:** Implemented Email/Password authentication with a custom glassmorphism modal.
* **Email Verification:** Added support for secure email confirmation links with a custom inline "Check Your Email" UI state.
* **Row-Level Security (RLS):** Locked down the entire database. Users can only read, insert, update, and delete their own specific records based on `auth.uid()`.
* **Automated User Triggers:** Deployed a PostgreSQL `SECURITY DEFINER` trigger to automatically mirror authenticated users into the public `users` table for flawless Foreign Key relations.

### 🔄 Data Architecture & Cloud Sync
* **Relational Database Design:** Shifted from flat JSON arrays to normalized SQL tables (`workouts`, `workout_sets`, `recovery_logs`, `rest_days`, `exercises`, `user_settings`).
* **Master Sync Engine:** Replaced synchronous local data fetches with `syncDataFromSupabase()`, an asynchronous engine that fetches and reconstructs the complex relational data (like joining `workout_sets` to `workouts`) into the frontend UI state on login.
* **Asynchronous CRUD Operations:** All save, edit, and delete functions now push directly to the cloud, utilizing `upsert` logic to seamlessly handle data conflicts.

### 💽 Smart Backup & Import Parsing
* **UUID Dictionary Mapping:** Completely rewrote the JSON import engine to handle legacy local backups. The importer now uploads custom exercises to the cloud, retrieves their new UUIDs, builds a local dictionary, and accurately maps those IDs to the relational `workout_sets` during bulk upload.
* **Deduplication:** The import engine automatically filters out duplicate custom exercises to keep the database clean.
* **Secure Data Wipes:** The "Delete All Data" feature now issues cascading delete commands to the cloud database, securely wiping all user-specific rows.

### ⚙️ UI & Settings Synchronization
* **Cloud Settings:** The Light Mode preference and Weekly Volume Target are now saved to the `user_settings` table and sync across devices automatically.
* **Account Display:** Added an active account module in the Settings tab to display the currently logged-in user's email.
* **Gatekeeper UI:** The authentication modal strictly prevents users from accessing the underlying app or closing the modal if a valid session token is not detected.

## 🛠️ Tech Stack

* **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3 (Custom Glassmorphism UI)
* **Backend:** Supabase (PostgreSQL, GoTrue Auth)
* **Data Visualization:** Chart.js
* **Export Generation:** html2canvas
