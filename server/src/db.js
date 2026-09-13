const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { seedAllPrograms } = require('./seed_program');
const { effectiveMonday } = require('./program_state');

const DB_PATH = path.join(__dirname, '..', 'db', 'gamma_bomb.sqlite');
const SCHEMA_PATH =
  process.env.SCHEMA_PATH || path.join(__dirname, '..', 'db', 'schema.sql');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);

    const cols = db.prepare('PRAGMA table_info(workout_logs)').all();
    if (!cols.find((c) => c.name === 'completed')) {
      db.exec(
        'ALTER TABLE workout_logs ADD COLUMN completed INTEGER NOT NULL DEFAULT 0'
      );
    }
    if (!cols.find((c) => c.name === 'duration_seconds')) {
      db.exec('ALTER TABLE workout_logs ADD COLUMN duration_seconds INTEGER');
    }
    if (!cols.find((c) => c.name === 'swapped_exercise_id')) {
      db.exec(
        'ALTER TABLE workout_logs ADD COLUMN swapped_exercise_id INTEGER REFERENCES exercises(id)'
      );
    }

    relaxExerciseSlotColumns(db);
    renameExerciseColumns(db);
    addProgramColumnToWeeks(db);
    addCycleStartedAtColumn(db);
    addFocusSummaryColumnToWorkoutDays(db);
    seedDefaultProgramSettings(db);
    seedAllPrograms(db);
  }
  return db;
}

// Older databases created weeks with a single-program UNIQUE(week_number).
// Multiple programs now coexist (so switching programs never wipes history),
// so week_number alone is no longer unique — rebuild with a `program` column
// and UNIQUE(program, week_number). Existing rows are assumed to belong to
// creeping_death_ii, the program that was hardcoded before this migration.
// No-op on fresh or already-migrated databases.
function addProgramColumnToWeeks(db) {
  const weekCols = db.prepare('PRAGMA table_info(weeks)').all();
  if (weekCols.find((c) => c.name === 'program')) return;

  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE weeks_new (
        id INTEGER PRIMARY KEY,
        program TEXT NOT NULL DEFAULT 'creeping_death_ii',
        week_number INTEGER NOT NULL,
        UNIQUE(program, week_number)
      );
      INSERT INTO weeks_new (id, program, week_number)
        SELECT id, 'creeping_death_ii', week_number FROM weeks;
      DROP TABLE weeks;
      ALTER TABLE weeks_new RENAME TO weeks;
    `);
    const violations = db.prepare('PRAGMA foreign_key_check').all();
    if (violations.length > 0) {
      throw new Error(
        `weeks rebuild left ${violations.length} foreign key violation(s)`
      );
    }
  })();
  db.pragma('foreign_keys = ON');
}

// Seeds the singleton program_settings row on first boot, defaulting to
// creeping_death_ii starting this coming Monday (today, if today already is
// one). No-op once the row exists.
function seedDefaultProgramSettings(db) {
  const existing = db
    .prepare('SELECT COUNT(*) AS c FROM program_settings')
    .get();
  if (existing.c > 0) return;

  const startDate = effectiveMonday();
  db.prepare(
    `INSERT INTO program_settings (id, active_program, program_start_date, cycle_started_at, pending_program, pending_start_date)
     VALUES (1, 'creeping_death_ii', ?, ?, NULL, NULL)`
  ).run(startDate, `${startDate} 00:00:00`);
}

// Older databases predate cycle_started_at. Backfill it from
// program_start_date (midnight on that date) — an approximation, but only
// matters for telling apart same-day logs, which can't happen for data that
// already predates this column. No-op once the column exists.
function addCycleStartedAtColumn(db) {
  const cols = db.prepare('PRAGMA table_info(program_settings)').all();
  if (cols.find((c) => c.name === 'cycle_started_at')) return;

  db.exec(
    "ALTER TABLE program_settings ADD COLUMN cycle_started_at TEXT NOT NULL DEFAULT (datetime('now'))"
  );
  db.prepare(
    "UPDATE program_settings SET cycle_started_at = program_start_date || ' 00:00:00' WHERE id = 1"
  ).run();
}

// Older databases created exercises.workout_day_id / order_num as NOT NULL.
// User-created exercises need them nullable (they have no fixed program slot).
// SQLite can't drop NOT NULL via ALTER, so rebuild the table when it's still
// constrained. Row ids are preserved, so workout_logs references stay valid.
// No-op on fresh or already-migrated databases.
function relaxExerciseSlotColumns(db) {
  const exCols = db.prepare('PRAGMA table_info(exercises)').all();
  const dayCol = exCols.find((c) => c.name === 'workout_day_id');
  if (!dayCol || dayCol.notnull === 0) return;

  // FK pragma must be toggled outside a transaction (SQLite ignores it inside).
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE exercises_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_day_id INTEGER REFERENCES workout_days(id),
        order_num INTEGER,
        body_part TEXT NOT NULL,
        exercise_name TEXT NOT NULL,
        exercise_description TEXT NOT NULL,
        rpe TEXT,
        sets INTEGER,
        rep_range TEXT
      );
      INSERT INTO exercises_new
        (id, workout_day_id, order_num, body_part, exercise_name, exercise_description, rpe, sets, rep_range)
        SELECT id, workout_day_id, order_num, body_part, exercise_name, exercise_description, rpe, sets, rep_range
        FROM exercises;
      DROP TABLE exercises;
      ALTER TABLE exercises_new RENAME TO exercises;
      CREATE INDEX IF NOT EXISTS idx_exercises_workout_day_id ON exercises(workout_day_id);
    `);
    const violations = db.prepare('PRAGMA foreign_key_check').all();
    if (violations.length > 0) {
      throw new Error(
        `exercises rebuild left ${violations.length} foreign key violation(s)`
      );
    }
  })();
  db.pragma('foreign_keys = ON');
}

// Older databases predate focus_summary. seedAllPrograms backfills the actual
// values for every program day right after this runs, so the column just
// needs to exist. No-op once the column exists.
function addFocusSummaryColumnToWorkoutDays(db) {
  const cols = db.prepare('PRAGMA table_info(workout_days)').all();
  if (cols.find((c) => c.name === 'focus_summary')) return;

  db.exec('ALTER TABLE workout_days ADD COLUMN focus_summary TEXT');
}

// Renames title→body_part, subtitle→exercise_name, body→exercise_description
// on the exercises table. No-op if the columns are already renamed.
function renameExerciseColumns(db) {
  const exCols = db
    .prepare('PRAGMA table_info(exercises)')
    .all()
    .map((c) => c.name);
  if (exCols.includes('title')) {
    db.exec('ALTER TABLE exercises RENAME COLUMN title TO body_part');
  }
  if (exCols.includes('subtitle')) {
    db.exec('ALTER TABLE exercises RENAME COLUMN subtitle TO exercise_name');
  }
  if (exCols.includes('body')) {
    db.exec('ALTER TABLE exercises RENAME COLUMN body TO exercise_description');
  }
}

module.exports = { getDb };
