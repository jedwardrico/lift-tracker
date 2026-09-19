const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const {
  PROGRAMS,
  getProgramState,
  switchProgram,
  restartProgram,
  cancelPending,
  rescheduleStart,
} = require('../program_state');

function serialize(state) {
  return {
    active_program: state.active_program,
    program_start_date: state.program_start_date,
    pending_program: state.pending_program,
    pending_start_date: state.pending_start_date,
    program_complete: state.program_complete,
    available_programs: Object.entries(PROGRAMS).map(([key, p]) => ({
      key,
      label: p.label,
    })),
  };
}

// GET /program - current program state (committing a staged switch/restart
// whose effective date has arrived).
router.get('/', (req, res) => {
  res.json(serialize(getProgramState(getDb())));
});

// GET /program/:key/preview - a program's description plus its week 1
// day-by-day split (focus + exercise count per day), so the app can show an
// overview before staging a switch to it.
router.get('/:key/preview', (req, res) => {
  const { key } = req.params;
  const program = PROGRAMS[key];
  if (!program) return res.status(400).json({ error: 'Unknown program' });

  const db = getDb();
  const { n: totalWeeks } = db
    .prepare('SELECT COUNT(*) AS n FROM weeks WHERE program = ?')
    .get(key);
  const week1 = db
    .prepare('SELECT id FROM weeks WHERE program = ? AND week_number = 1')
    .get(key);
  const days = week1
    ? db
        .prepare(
          `SELECT wd.day_of_week, wd.is_rest_day, wd.focus_summary,
                  (SELECT COUNT(*) FROM exercises e WHERE e.workout_day_id = wd.id) AS exercise_count
           FROM workout_days wd
           WHERE wd.week_id = ?
           ORDER BY CASE wd.day_of_week WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3 WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6 WHEN 'sunday' THEN 7 END`
        )
        .all(week1.id)
        .map((d) => ({ ...d, is_rest_day: Boolean(d.is_rest_day) }))
    : [];

  res.json({
    key,
    label: program.label,
    description: program.description,
    total_weeks: totalWeeks,
    days,
  });
});

// POST /program/switch - stage a switch to a different program, effective
// the coming Monday (or today, if today is one).
// Body: { program }
router.post('/switch', (req, res) => {
  const { program } = req.body;
  if (!program || !PROGRAMS[program]) {
    return res.status(400).json({ error: 'Unknown program' });
  }
  res.json(serialize(switchProgram(getDb(), program)));
});

// POST /program/restart - stage a restart of the current program back to
// week 1, effective the coming Monday (or today, if today is one).
router.post('/restart', (req, res) => {
  res.json(serialize(restartProgram(getDb())));
});

// POST /program/cancel - clear a staged switch/restart; the active program
// keeps running unchanged.
router.post('/cancel', (req, res) => {
  res.json(serialize(cancelPending(getDb())));
});

// POST /program/reschedule - change the start date of whichever program
// hasn't started counting yet: a staged switch/restart if one is pending,
// otherwise the active program's own start date.
// Body: { start_date } (must be a Monday, YYYY-MM-DD)
router.post('/reschedule', (req, res) => {
  const { start_date } = req.body;
  try {
    res.json(serialize(rescheduleStart(getDb(), start_date)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
