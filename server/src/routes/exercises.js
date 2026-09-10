const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET /exercises - filter exercises by body part or name.
// ?distinct=1 returns the unique exercise catalog (one row per title+subtitle),
// used to populate the in-workout swap picker.
router.get('/', (req, res) => {
  const db = getDb();
  const { title, subtitle, distinct } = req.query;

  if (distinct) {
    // One representative full row per unique title+subtitle, so the swap picker
    // can show and adopt the exercise's details (body, rpe, etc.).
    const catalog = db
      .prepare(
        `SELECT * FROM exercises
         WHERE id IN (SELECT MIN(id) FROM exercises GROUP BY title, subtitle)
         ORDER BY title, subtitle`
      )
      .all();
    return res.json(catalog);
  }

  let query = 'SELECT * FROM exercises WHERE 1=1';
  const params = [];

  if (title) {
    query += ' AND title = ?';
    params.push(title);
  }
  if (subtitle) {
    query += ' AND subtitle LIKE ?';
    params.push(`%${subtitle}%`);
  }

  query += ' ORDER BY id';
  res.json(db.prepare(query).all(...params));
});

// POST /exercises — create a new user exercise and link it to the program
// catalog (no fixed day/slot). Returned row can then be used as a swap target.
// Body: { title, subtitle, body?, rpe?, sets?, rep_range? }
router.post('/', (req, res) => {
  const db = getDb();
  const { title, subtitle, body, rpe, sets, rep_range } = req.body;

  if (!title?.trim() || !subtitle?.trim())
    return res
      .status(400)
      .json({ error: 'title and subtitle are required' });

  const result = db
    .prepare(
      `INSERT INTO exercises (workout_day_id, order_num, title, subtitle, body, rpe, sets, rep_range)
       VALUES (NULL, NULL, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title.trim(),
      subtitle.trim(),
      body?.trim() ?? '',
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
