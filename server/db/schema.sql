CREATE TABLE IF NOT EXISTS weeks (
  id INTEGER PRIMARY KEY,
  week_number INTEGER NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS workout_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL REFERENCES weeks(id),
  day_of_week TEXT NOT NULL CHECK(day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  is_rest_day INTEGER NOT NULL DEFAULT 0
);

-- workout_day_id / order_num are nullable: exercises created by the user in-app
-- (a "linked" custom exercise) have no fixed day/slot in the program. They still
-- live in the catalog and can be selected as a swap, but never render as a
-- program slot (the weeks queries only pull exercises attached to a day).
CREATE TABLE IF NOT EXISTS exercises (
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

CREATE TABLE IF NOT EXISTS workout_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  logged_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  -- When the user swaps this slot for another exercise, the log keeps
  -- exercise_id as the programmed slot anchor (preserving day/order for
  -- carry-forward) and records the exercise actually performed here.
  swapped_exercise_id INTEGER REFERENCES exercises(id)
);

CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_log_id INTEGER NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER,
  weight REAL,
  weight_unit TEXT NOT NULL DEFAULT 'lbs'
);

CREATE INDEX IF NOT EXISTS idx_workout_days_week_id ON workout_days(week_id);
CREATE INDEX IF NOT EXISTS idx_exercises_workout_day_id ON exercises(workout_day_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_exercise_id ON workout_logs(exercise_id);
CREATE INDEX IF NOT EXISTS idx_sets_workout_log_id ON sets(workout_log_id);
