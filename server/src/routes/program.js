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
