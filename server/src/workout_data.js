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
    description:
      'A high-volume bodybuilding split built around back, chest and shoulders, with legs and arms filling out the week.',
    workoutData: require('../data/gamma_bomb.json'),
  },
  creeping_death_ii: {
    label: 'Creeping Death II',
    description:
      "John Meadows' hypertrophy program hitting back and chest twice a week alongside dedicated leg and arm days.",
    workoutData: require('../data/creeping_death_ii.json'),
  },
  // Pure Bodybuilding Phase 2 is a Pull/Push/Legs/Arms & Weak Points program.
  // Each PDF week contains two sub-weeks of exercises (A and B), which this
  // JSON splits into 20 separate program weeks, each laid out as:
  // Mon = Pull, Tue = Push, Wed = Cardio, Thu = Legs, Fri = Arms & Weak Points,
  // Sat = Rest, Sun = Rest.
  pure_bodybuilding_phase_2: {
    label: 'Pure Bodybuilding Phase 2',
    description:
      'A 20-week Pull/Push/Legs/Arms & Weak Points program built for steady, sustainable hypertrophy.',
    workoutData: require('../data/pure_bodybuilding_phase_2.json'),
  },
  // The Bodybuilding Transformation System (Intermediate/Advanced) is a 12-week
  // Upper/Lower/Push/Pull/Legs program. The PDF's own rest-day placement is
  // ignored; each week is laid out as: Mon = Upper, Tue = Lower, Wed = Push,
  // Thu = Pull, Fri = Legs, Sat = Rest, Sun = Rest.
  bodybuilding_transformation_system: {
    label: 'The Bodybuilding Transformation System',
    description:
      'A 12-week Upper/Lower/Push/Pull/Legs program for intermediate-to-advanced lifters.',
    workoutData: require('../data/bodybuilding_transformation_system.json'),
  },
  // The Ultimate Push Pull Legs System (5x/week) is a 13-week, 3-phase PPL +
  // Upper/Lower program (Phase 1 Base Hypertrophy: weeks 1-6, Phase 2 Maximum
  // Effort: weeks 7-10, Phase 3 Supercompensation: weeks 11-13). The PDF's own
  // rest-day placement is ignored; each week is laid out as: Mon = Push,
  // Tue = Pull, Wed = Legs, Thu = Upper, Fri = Lower, Sat = Rest, Sun = Rest.
  ultimate_ppl_system_5x: {
    label: 'The Ultimate Push Pull Legs System (5x)',
    description:
      'A 13-week, 3-phase Push/Pull/Legs + Upper/Lower program progressing from base hypertrophy to maximum effort to supercompensation.',
    workoutData: require('../data/ultimate_ppl_system_5x.json'),
  },
};

module.exports = { PROGRAMS, DAYS };
