const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET /weeks - list all weeks
router.get('/', (req, res) => {
  const db = getDb();
  const weeks = db.prepare('SELECT * FROM weeks ORDER BY week_number').all();
  res.json(weeks);
});

// GET /weeks/:weekNumber - get a full week with all days and exercises
router.get('/:weekNumber', (req, res) => {
  const db = getDb();
  const week = db.prepare('SELECT * FROM weeks WHERE week_number = ?').get(req.params.weekNumber);
  if (!week) return res.status(404).json({ error: 'Week not found' });

  const days = db.prepare("SELECT * FROM workout_days WHERE week_id = ? ORDER BY CASE day_of_week WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3 WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6 WHEN 'sunday' THEN 7 END").all(week.id);

  const result = {
    ...week,
    days: days.map(day => {
      const exercises = day.is_rest_day
        ? []
        : db.prepare('SELECT * FROM exercises WHERE workout_day_id = ? ORDER BY order_num').all(day.id);
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

  const week = db.prepare('SELECT * FROM weeks WHERE week_number = ?').get(weekNumber);
  if (!week) return res.status(404).json({ error: 'Week not found' });

  const workoutDay = db.prepare('SELECT * FROM workout_days WHERE week_id = ? AND day_of_week = ?').get(week.id, day.toLowerCase());
  if (!workoutDay) return res.status(404).json({ error: 'Day not found' });

  const exercises = workoutDay.is_rest_day
    ? []
    : db.prepare('SELECT * FROM exercises WHERE workout_day_id = ? ORDER BY order_num').all(workoutDay.id);

  res.json({
    ...workoutDay,
    is_rest_day: Boolean(workoutDay.is_rest_day),
    exercises,
  });
});

module.exports = router;
