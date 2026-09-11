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
};

module.exports = { PROGRAMS, DAYS };
