const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

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
  }
  return db;
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
        title TEXT NOT NULL,
        subtitle TEXT NOT NULL,
        body TEXT NOT NULL,
        rpe TEXT,
        sets INTEGER,
        rep_range TEXT
      );
      INSERT INTO exercises_new
        (id, workout_day_id, order_num, title, subtitle, body, rpe, sets, rep_range)
        SELECT id, workout_day_id, order_num, title, subtitle, body, rpe, sets, rep_range
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

module.exports = { getDb };
