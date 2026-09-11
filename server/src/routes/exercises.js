const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { getProgramState } = require('../program_state');

// GET /exercises - filter exercises by body part or name.
// ?distinct=1 returns the unique exercise catalog (one row per body_part+exercise_name),
// used to populate the in-workout swap picker.
router.get('/', (req, res) => {
  const db = getDb();
  const { body_part, exercise_name, distinct } = req.query;

  if (distinct) {
    // Scoped to the active program's exercises plus program-less custom
    // exercises (workout_day_id IS NULL), so switching programs doesn't
    // surface the other program's exercises in the swap picker. Scoping
    // happens before picking the MIN(id) representative row, so a
    // same-named exercise in the inactive program can't shadow this one.
    const { active_program } = getProgramState(db);
    const catalog = db
      .prepare(
        `WITH scoped AS (
           SELECT e.* FROM exercises e
           LEFT JOIN workout_days wd ON wd.id = e.workout_day_id
           LEFT JOIN weeks w ON w.id = wd.week_id
           WHERE e.workout_day_id IS NULL OR w.program = ?
         )
         SELECT * FROM scoped
         WHERE id IN (SELECT MIN(id) FROM scoped GROUP BY body_part, exercise_name)
         ORDER BY body_part, exercise_name`
      )
      .all(active_program);
    return res.json(catalog);
  }

  let query = 'SELECT * FROM exercises WHERE 1=1';
  const params = [];

  if (body_part) {
    query += ' AND body_part = ?';
    params.push(body_part);
  }
  if (exercise_name) {
    query += ' AND exercise_name LIKE ?';
    params.push(`%${exercise_name}%`);
  }

  query += ' ORDER BY id';
  res.json(db.prepare(query).all(...params));
});

// POST /exercises — create a new user exercise and link it to the program
// catalog (no fixed day/slot). Returned row can then be used as a swap target.
// Body: { body_part, exercise_name, exercise_description?, rpe?, sets?, rep_range? }
router.post('/', (req, res) => {
  const db = getDb();
  const {
    body_part,
    exercise_name,
    exercise_description,
    rpe,
    sets,
    rep_range,
  } = req.body;

  if (!body_part?.trim() || !exercise_name?.trim())
    return res
      .status(400)
      .json({ error: 'body_part and exercise_name are required' });

  const result = db
    .prepare(
      `INSERT INTO exercises (workout_day_id, order_num, body_part, exercise_name, exercise_description, rpe, sets, rep_range)
       VALUES (NULL, NULL, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      body_part.trim(),
      exercise_name.trim(),
      exercise_description?.trim() ?? '',
      rpe ?? null,
      sets ?? null,
      rep_range ?? null
    );

  const created = db
    .prepare('SELECT * FROM exercises WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json(created);
});

// GET /exercises/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const exercise = db
    .prepare('SELECT * FROM exercises WHERE id = ?')
    .get(req.params.id);
  if (!exercise) return res.status(404).json({ error: 'Exercise not found' });
  res.json(exercise);
});

// GET /exercises/:id/logs - all workout logs for this exercise, newest first
router.get('/:id/logs', (req, res) => {
  const db = getDb();
  const exercise = db
    .prepare('SELECT id FROM exercises WHERE id = ?')
    .get(req.params.id);
  if (!exercise) return res.status(404).json({ error: 'Exercise not found' });

  const logs = db
    .prepare(
      'SELECT * FROM workout_logs WHERE exercise_id = ? ORDER BY logged_at DESC'
    )
    .all(req.params.id);

  const result = logs.map((log) => ({
    ...log,
    sets: db
      .prepare(
        'SELECT * FROM sets WHERE workout_log_id = ? ORDER BY set_number'
      )
      .all(log.id),
  }));

  res.json(result);
});

module.exports = router;
