const { PROGRAMS, DAYS } = require('./workout_data');

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

// The last non-rest workout day (by program order) in a program's final
// week — "the last workout" a user finishes to complete the program.
function lastWorkoutDay(db, programKey) {
  const lastWeek = db
    .prepare(
      'SELECT id FROM weeks WHERE program = ? ORDER BY week_number DESC LIMIT 1'
    )
    .get(programKey);
  if (!lastWeek) return null;

  const days = db
    .prepare(
      'SELECT id, day_of_week, is_rest_day FROM workout_days WHERE week_id = ?'
    )
    .all(lastWeek.id);
  const byDay = Object.fromEntries(days.map((d) => [d.day_of_week, d]));

  for (const day of [...DAYS].reverse()) {
    if (byDay[day] && !byDay[day].is_rest_day) return byDay[day];
  }
  return null;
}

// True once the active program's last workout has a completed log timestamped
// on or after the current cycle's start — scoped to cycle_started_at (an
// exact moment, not just a calendar date) so a same-day restart doesn't
// immediately count the previous cycle's final log as completing this one.
function isProgramComplete(db, programKey, cycleStartedAt) {
  const day = lastWorkoutDay(db, programKey);
  if (!day) return false;

  const completed = db
    .prepare(
      `SELECT COUNT(*) AS c FROM workout_logs wl
       JOIN exercises e ON e.id = wl.exercise_id
       WHERE e.workout_day_id = ? AND wl.completed = 1 AND wl.logged_at >= ?`
    )
    .get(day.id, cycleStartedAt);
  return completed.c > 0;
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
       SET active_program = ?, program_start_date = ?, cycle_started_at = datetime('now'), pending_program = NULL, pending_start_date = NULL
       WHERE id = 1`
    ).run(row.pending_program, row.pending_start_date);
    return getProgramState(db);
  }
  return {
    ...row,
    program_complete: isProgramComplete(
      db,
      row.active_program,
      row.cycle_started_at
    ),
  };
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

// Clears a staged switch/restart, leaving the active program running as-is.
function cancelPending(db) {
  getProgramState(db); // commit any switch whose date has already arrived
  db.prepare(
    'UPDATE program_settings SET pending_program = NULL, pending_start_date = NULL WHERE id = 1'
  ).run();
  return getProgramState(db);
}

function isMondayDateKey(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const d = new Date(`${dateStr}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.getDay() === 1;
}

// Changes the start date of whichever program hasn't started counting yet:
// a staged switch/restart's pending_start_date if one exists, otherwise the
// active program's own program_start_date. Both must land on a Monday, the
// only day a program is ever allowed to start.
function rescheduleStart(db, newDate) {
  if (!isMondayDateKey(newDate)) {
    throw new Error('Start date must be a Monday (YYYY-MM-DD)');
  }
  const state = getProgramState(db); // commit any switch whose date has already arrived
  if (state.pending_program) {
    db.prepare(
      'UPDATE program_settings SET pending_start_date = ? WHERE id = 1'
    ).run(newDate);
  } else {
    db.prepare(
      'UPDATE program_settings SET program_start_date = ? WHERE id = 1'
    ).run(newDate);
  }
  return getProgramState(db);
}

module.exports = {
  PROGRAMS,
  effectiveMonday,
  getProgramState,
  switchProgram,
  restartProgram,
  cancelPending,
  rescheduleStart,
};
