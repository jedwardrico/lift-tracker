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
  // Pure Bodybuilding Phase 2 (Upper/Lower) is the Upper/Lower variant of the
  // program above: 10 weeks, laid out as Mon = Upper #1, Tue = Lower #1,
  // Wed = Upper #2, Thu = Lower #2, Fri = Arms & Weak Points, Sat = Rest,
  // Sun = Rest.
  pure_bodybuilding_phase_2_upper_lower: {
    label: 'Pure Bodybuilding Phase 2 (Upper/Lower)',
    description:
      'A 10-week Upper/Lower program with a dedicated Arms & Weak Points day, the upper/lower variant of Pure Bodybuilding Phase 2.',
    workoutData: require('../data/pure_bodybuilding_phase_2_upper_lower.json'),
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
