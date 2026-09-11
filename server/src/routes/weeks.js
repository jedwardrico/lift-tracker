const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { getProgramState } = require('../program_state');

// Most recent exercise swap logged at the same "spot" (same day_of_week +
// order_num) in an *earlier* week. Lets a swap made in a prior week carry
// forward to this week's session. Returns the swapped-in exercise only when it
// differs (by name) from the current week's programmed exercise, so the caller
// can surface "the changed exercise" without extra comparison.
function carriedSwapFor(
  db,
  dayOfWeek,
  orderNum,
  weekNumber,
  currentExerciseName
) {
  const row = db
    .prepare(
      `SELECT se.id, se.body_part, se.exercise_name, se.exercise_description, se.rpe, se.sets, se.rep_range
       FROM workout_logs wl
       JOIN exercises e ON e.id = wl.exercise_id
       JOIN workout_days wd ON wd.id = e.workout_day_id
       JOIN weeks w ON w.id = wd.week_id
       JOIN exercises se ON se.id = wl.swapped_exercise_id
       WHERE wd.day_of_week = ? AND e.order_num = ? AND w.week_number < ?
         AND wl.completed = 1
         AND wl.swapped_exercise_id IS NOT NULL
       ORDER BY w.week_number DESC, wl.logged_at DESC
       LIMIT 1`
    )
    .get(dayOfWeek, orderNum, weekNumber);
  if (!row || row.exercise_name === currentExerciseName) return null;
  return row;
}

function withCarriedSwaps(db, exercises, dayOfWeek, weekNumber) {
  return exercises.map((ex) => ({
    ...ex,
    carried_exercise: carriedSwapFor(
      db,
      dayOfWeek,
      ex.order_num,
      weekNumber,
      ex.exercise_name
    ),
  }));
}

// GET /weeks - list all weeks for the active program
router.get('/', (req, res) => {
  const db = getDb();
  const { active_program } = getProgramState(db);
  const weeks = db
    .prepare('SELECT * FROM weeks WHERE program = ? ORDER BY week_number')
    .all(active_program);
  res.json(weeks);
});

// GET /weeks/:weekNumber - get a full week with all days and exercises
router.get('/:weekNumber', (req, res) => {
  const db = getDb();
  const { active_program } = getProgramState(db);
  const week = db
    .prepare('SELECT * FROM weeks WHERE program = ? AND week_number = ?')
    .get(active_program, req.params.weekNumber);
  if (!week) return res.status(404).json({ error: 'Week not found' });

  const days = db
    .prepare(
      "SELECT * FROM workout_days WHERE week_id = ? ORDER BY CASE day_of_week WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3 WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6 WHEN 'sunday' THEN 7 END"
    )
    .all(week.id);

  const result = {
    ...week,
    days: days.map((day) => {
      const exercises = day.is_rest_day
        ? []
        : withCarriedSwaps(
            db,
            db
              .prepare(
                'SELECT * FROM exercises WHERE workout_day_id = ? ORDER BY order_num'
              )
              .all(day.id),
            day.day_of_week,
            week.week_number
          );
      return {
        ...day,
        is_rest_day: Boolean(day.is_rest_day),
        exercises,
      };
    }),
  };

  res.json(result);
});

// GET /weeks/:weekNumber/days/:day - get a specific day
router.get('/:weekNumber/days/:day', (req, res) => {
  const db = getDb();
  const { weekNumber, day } = req.params;
  const { active_program } = getProgramState(db);

  const week = db
    .prepare('SELECT * FROM weeks WHERE program = ? AND week_number = ?')
    .get(active_program, weekNumber);
  if (!week) return res.status(404).json({ error: 'Week not found' });

  const workoutDay = db
    .prepare('SELECT * FROM workout_days WHERE week_id = ? AND day_of_week = ?')
    .get(week.id, day.toLowerCase());
  if (!workoutDay) return res.status(404).json({ error: 'Day not found' });

  const exercises = workoutDay.is_rest_day
    ? []
    : withCarriedSwaps(
        db,
        db
          .prepare(
            'SELECT * FROM exercises WHERE workout_day_id = ? ORDER BY order_num'
          )
          .all(workoutDay.id),
        workoutDay.day_of_week,
        week.week_number
      );

  res.json({
    ...workoutDay,
    is_rest_day: Boolean(workoutDay.is_rest_day),
    exercises,
  });
});

module.exports = router;
