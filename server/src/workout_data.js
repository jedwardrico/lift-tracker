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
  // Pure Bodybuilding Phase 2 is a Pull/Push/Legs/Arms & Weak Points program.
  // Each PDF week contains two sub-weeks of exercises (A and B), which this
  // JSON splits into 20 separate program weeks, each laid out as:
  // Mon = Pull, Tue = Push, Wed = Cardio, Thu = Legs, Fri = Arms & Weak Points,
  // Sat = Rest, Sun = Rest.
  pure_bodybuilding_phase_2: {
    label: 'Pure Bodybuilding Phase 2',
    workoutData: require('../data/pure_bodybuilding_phase_2.json'),
  },
};

module.exports = { PROGRAMS, DAYS };
