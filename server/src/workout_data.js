// Monday = Pull, Tuesday = Push, Wednesday = Legs
// Thursday = Pull (pump), Friday = Push (pump), Saturday = Legs (pump)
// Sunday is a rest day
const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

// Registry of every program the app knows how to seed/run. Adding a new
// program means adding a JSON file under ../data and an entry here.
const PROGRAMS = {
  gamma_bomb: {
    label: 'Gamma Bomb',
    workoutData: require('../data/gamma_bomb.json'),
  },
  creeping_death_ii: {
    label: 'Creeping Death II',
    workoutData: require('../data/creeping_death_ii.json'),
  },
  // Pure Bodybuilding Phase 2 is an asynchronous Push/Pull/Legs/Arms program
  // that runs on a 10-slot cycle per program-week (not a real calendar week),
  // which doesn't fit this app's fixed 7-day (Mon-Sun) week model. To store
  // it, the entire 10-week program (100 day-slots total) was flattened into
  // one continuous sequence and re-chunked into 7-slot groups here — so a
  // JSON week's "monday" is just the next slot in that sequence, not the
  // program's actual Monday, and JSON week boundaries don't line up with the
  // PDF's own week boundaries.
  pure_bodybuilding_phase_2: {
    label: 'Pure Bodybuilding Phase 2',
    workoutData: require('../data/pure_bodybuilding_phase_2.json'),
  },
};

module.exports = { PROGRAMS, DAYS };
