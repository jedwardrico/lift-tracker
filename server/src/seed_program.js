const { PROGRAMS, DAYS } = require('./workout_data');

function parseSetsAndReps(exercise_description) {
  if (!exercise_description) return { sets: null, rep_range: null };

  // Sets: "X total work set(s)" is the authoritative count
  let sets = null;
  const totalSets = exercise_description.match(/(\d+)\s+total\s+work\s+sets?/i);
  if (totalSets) {
    sets = parseInt(totalSets[1]);
  } else {
    // Fallback: "do X sets of Y"
    const doSets = exercise_description.match(/\bdo\s+(\d+)\s+sets?\s+of\b/i);
    if (doSets) sets = parseInt(doSets[1]);
  }

  // Rep range: use LAST "sets of X[-Y]" occurrence so warmup sets
  // ("do sets of 15 to warm up ... then go to sets of 8") resolve correctly
  let rep_range = null;
  const allSetsOf = [
    ...exercise_description.matchAll(/\bsets?\s+of\s+(\d+)(?:-(\d+))?/gi),
  ];
  if (allSetsOf.length > 0) {
    const last = allSetsOf[allSetsOf.length - 1];
    rep_range = last[2] ? `${last[1]}-${last[2]}` : last[1];
  }

  // Fallback: "X reps" or "X-Y reps" (cap at 100 to skip things like "135 lbs x 8 reps")
  if (!rep_range) {
    const repsMatch = exercise_description.match(
      /\b(\d+)(?:-(\d+))?\s+reps?\b/i
    );
    if (repsMatch && parseInt(repsMatch[1]) <= 100) {
      rep_range = repsMatch[2]
        ? `${repsMatch[1]}-${repsMatch[2]}`
        : repsMatch[1];
    }
  }

  return { sets, rep_range };
}

// Seeds a single program's weeks/days/exercises. Additive only — never
// touches other programs' rows or any workout_logs, so switching the active
// program never loses history. No-op if this program already has weeks.
function seedProgram(db, programKey) {
  const program = PROGRAMS[programKey];
  if (!program) throw new Error(`Unknown program: ${programKey}`);

  const already = db
    .prepare('SELECT COUNT(*) AS c FROM weeks WHERE program = ?')
    .get(programKey);
  if (already.c > 0) return false;

  const insertWeek = db.prepare(
    'INSERT INTO weeks (program, week_number) VALUES (?, ?)'
  );
  const insertDay = db.prepare(
    'INSERT INTO workout_days (week_id, day_of_week, is_rest_day) VALUES (?, ?, ?)'
  );
  const insertExercise = db.prepare(
    'INSERT INTO exercises (workout_day_id, order_num, body_part, exercise_name, exercise_description, rpe, sets, rep_range) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const seedAll = db.transaction(() => {
    for (const weekData of program.workoutData) {
      const weekResult = insertWeek.run(programKey, weekData.week);
      const weekId = weekResult.lastInsertRowid;

      for (const day of DAYS) {
        const dayData = weekData.days[day];
        if (!dayData) continue;

        const dayResult = insertDay.run(weekId, day, dayData.isRestDay ? 1 : 0);
        const dayId = dayResult.lastInsertRowid;

        for (const exercise of dayData.exercises) {
          const { sets, rep_range } = parseSetsAndReps(
            exercise.exercise_description
          );
          insertExercise.run(
            dayId,
            exercise.order,
            exercise.body_part,
            exercise.exercise_name,
            exercise.exercise_description,
            exercise.rpe ?? null,
            sets,
            rep_range
          );
        }
      }
    }
  });

  seedAll();
  console.log(`Seeded ${program.workoutData.length} weeks for ${programKey}.`);
  return true;
}

function seedAllPrograms(db) {
  for (const programKey of Object.keys(PROGRAMS)) {
    seedProgram(db, programKey);
  }
}

module.exports = { seedProgram, seedAllPrograms, parseSetsAndReps };
