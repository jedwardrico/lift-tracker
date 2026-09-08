// Creeping Death II — Pull/Push/Legs hypertrophy program (12 weeks)
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

const workoutData = require('../data/creeping_death_ii.json');

module.exports = { workoutData, DAYS };
