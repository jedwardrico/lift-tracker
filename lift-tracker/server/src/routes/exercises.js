const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET /exercises - filter exercises by body part or name
router.get('/', (req, res) => {
  const db = getDb();
  const { title, subtitle } = req.query;

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

// GET /exercises/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const exercise = db.prepare('SELECT * FROM exercises WHERE id = ?').get(req.params.id);
  if (!exercise) return res.status(404).json({ error: 'Exercise not found' });
  res.json(exercise);
});

// GET /exercises/:id/logs - all workout logs for this exercise, newest first
router.get('/:id/logs', (req, res) => {
  const db = getDb();
  const exercise = db.prepare('SELECT id FROM exercises WHERE id = ?').get(req.params.id);
  if (!exercise) return res.status(404).json({ error: 'Exercise not found' });

  const logs = db
    .prepare('SELECT * FROM workout_logs WHERE exercise_id = ? ORDER BY logged_at DESC')
    .all(req.params.id);

  const result = logs.map(log => ({
    ...log,
    sets: db.prepare('SELECT * FROM sets WHERE workout_log_id = ? ORDER BY set_number').all(log.id),
  }));

  res.json(result);
});

module.exports = router;
