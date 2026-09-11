const { PROGRAMS } = require('./workout_data');

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// The Monday a switch/restart takes effect on: today, if today is already
// Monday, otherwise the coming Monday. Keeps the in-progress week intact.
function effectiveMonday(from = new Date()) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay(); // Sun=0 .. Sat=6
  d.setDate(d.getDate() + ((8 - dayOfWeek) % 7));
  return toDateKey(d);
}

// Reads program_settings, committing a staged switch/restart if its
// effective date has arrived. Called on every read so no scheduler/cron is
// needed — the transition just applies itself the first time anyone asks.
function getProgramState(db) {
  const row = db.prepare('SELECT * FROM program_settings WHERE id = 1').get();
  if (
    row.pending_program &&
    row.pending_start_date &&
    row.pending_start_date <= toDateKey(new Date())
  ) {
    db.prepare(
      `UPDATE program_settings
       SET active_program = ?, program_start_date = ?, pending_program = NULL, pending_start_date = NULL
       WHERE id = 1`
    ).run(row.pending_program, row.pending_start_date);
    return getProgramState(db);
  }
  return row;
}

function stageProgram(db, programKey) {
  if (!PROGRAMS[programKey]) {
    throw new Error(`Unknown program: ${programKey}`);
  }
  getProgramState(db); // commit any switch whose date has already arrived
  const startDate = effectiveMonday();
  db.prepare(
    'UPDATE program_settings SET pending_program = ?, pending_start_date = ? WHERE id = 1'
  ).run(programKey, startDate);
  return getProgramState(db);
}

// Switch to a different program (or restart the current one, if programKey
// isn't given) — both stage the same way, just targeting a different key.
function switchProgram(db, programKey) {
  return stageProgram(db, programKey);
}

function restartProgram(db) {
  const state = getProgramState(db);
  return stageProgram(db, state.active_program);
}

module.exports = {
  PROGRAMS,
  effectiveMonday,
  getProgramState,
  switchProgram,
  restartProgram,
};
