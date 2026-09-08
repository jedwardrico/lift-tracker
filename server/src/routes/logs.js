const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

function getLogWithSets(db, logId) {
  const log = db.prepare('SELECT * FROM workout_logs WHERE id = ?').get(logId);
  if (!log) return null;
  const sets = db
    .prepare('SELECT * FROM sets WHERE workout_log_id = ? ORDER BY set_number')
    .all(logId);
  return { ...log, sets };
}

// GET /logs — list completed logs with exercise info and sets
// Optional query param: ?date=YYYY-MM-DD
router.get('/', (req, res) => {
  const db = getDb();
  const { date } = req.query;

  let query = `
    SELECT wl.id, wl.exercise_id, wl.logged_at, wl.completed, wl.duration_seconds,
           e.title, e.subtitle
    FROM workout_logs wl
    JOIN exercises e ON e.id = wl.exercise_id
    WHERE wl.completed = 1
  `;
  const params = [];

  if (date) {
    query += ` AND date(wl.logged_at) = date(?)`;
    params.push(date);
  }

  query += ` ORDER BY wl.logged_at DESC`;

  const logs = db.prepare(query).all(...params);
  const result = logs.map((log) => {
    const sets = db
      .prepare(
        'SELECT * FROM sets WHERE workout_log_id = ? ORDER BY set_number'
      )
      .all(log.id);
    return { ...log, sets };
  });

  res.json(result);
});

// POST /logs — create a log with sets inline
// Body: { exercise_id, logged_at?, completed?, duration_seconds?, sets: [{ set_number, reps, weight, weight_unit? }] }
router.post('/', (req, res) => {
  const db = getDb();
  const {
    exercise_id,
    logged_at,
    completed = 0,
    duration_seconds,
    sets = [],
  } = req.body;

  if (!exercise_id)
    return res.status(400).json({ error: 'exercise_id is required' });

  const exercise = db
    .prepare('SELECT id FROM exercises WHERE id = ?')
    .get(exercise_id);
  if (!exercise) return res.status(404).json({ error: 'Exercise not found' });

  const insertLog = db.prepare(
    'INSERT INTO workout_logs (exercise_id, logged_at, completed, duration_seconds) VALUES (?, ?, ?, ?)'
  );
  const insertSet = db.prepare(
    'INSERT INTO sets (workout_log_id, set_number, reps, weight, weight_unit) VALUES (?, ?, ?, ?, ?)'
  );

  const create = db.transaction(() => {
    const result = insertLog.run(
      exercise_id,
      logged_at ?? new Date().toISOString(),
      completed ? 1 : 0,
      duration_seconds ?? null
    );
    const logId = result.lastInsertRowid;
    for (const s of sets) {
      insertSet.run(
        logId,
        s.set_number,
        s.reps ?? null,
        s.weight ?? null,
        s.weight_unit ?? 'lbs'
      );
    }
    return logId;
  });

  const logId = create();
  res.status(201).json(getLogWithSets(db, logId));
});

// GET /logs/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const log = getLogWithSets(db, req.params.id);
  if (!log) return res.status(404).json({ error: 'Log not found' });
  res.json(log);
});

// PUT /logs/:id — update logged_at or replace sets
// Body: { logged_at?, completed?, duration_seconds?, sets? }
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM workout_logs WHERE id = ?')
    .get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Log not found' });

  const { logged_at, completed, duration_seconds, sets } = req.body;

  const update = db.transaction(() => {
    if (logged_at !== undefined) {
      db.prepare('UPDATE workout_logs SET logged_at = ? WHERE id = ?').run(
        logged_at,
        req.params.id
      );
    }
    if (completed !== undefined) {
      db.prepare('UPDATE workout_logs SET completed = ? WHERE id = ?').run(
        completed ? 1 : 0,
        req.params.id
      );
    }
    if (duration_seconds !== undefined) {
      db.prepare(
        'UPDATE workout_logs SET duration_seconds = ? WHERE id = ?'
      ).run(duration_seconds ?? null, req.params.id);
    }
    if (sets !== undefined) {
      db.prepare('DELETE FROM sets WHERE workout_log_id = ?').run(
        req.params.id
      );
      const insertSet = db.prepare(
        'INSERT INTO sets (workout_log_id, set_number, reps, weight, weight_unit) VALUES (?, ?, ?, ?, ?)'
      );
      for (const s of sets) {
        insertSet.run(
          req.params.id,
          s.set_number,
          s.reps ?? null,
          s.weight ?? null,
          s.weight_unit ?? 'lbs'
        );
      }
    }
  });

  update();
  res.json(getLogWithSets(db, req.params.id));
});

// DELETE /logs/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db
    .prepare('DELETE FROM workout_logs WHERE id = ?')
    .run(req.params.id);
  if (result.changes === 0)
    return res.status(404).json({ error: 'Log not found' });
  res.status(204).end();
});

// PATCH /logs/:id/sets/:setId — update a single set
router.patch('/:id/sets/:setId', (req, res) => {
  const db = getDb();
  const set = db
    .prepare('SELECT * FROM sets WHERE id = ? AND workout_log_id = ?')
    .get(req.params.setId, req.params.id);
  if (!set) return res.status(404).json({ error: 'Set not found' });

  const { reps, weight, weight_unit } = req.body;
  db.prepare(
    'UPDATE sets SET reps = COALESCE(?, reps), weight = COALESCE(?, weight), weight_unit = COALESCE(?, weight_unit) WHERE id = ?'
  ).run(reps ?? null, weight ?? null, weight_unit ?? null, req.params.setId);

  res.json(db.prepare('SELECT * FROM sets WHERE id = ?').get(req.params.setId));
});

module.exports = router;
