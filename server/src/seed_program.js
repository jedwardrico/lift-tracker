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

// Generates the day's focus summary from its programmed exercises' body
// parts, in first-appearance order (e.g. "Back, Biceps & Abs Day"). Rest
// days get a fixed label instead.
function focusSummaryFor(dayData) {
  if (dayData.isRestDay) return 'Rest Day';

  const bodyParts = [];
  for (const exercise of dayData.exercises) {
    if (!bodyParts.includes(exercise.body_part)) {
      bodyParts.push(exercise.body_part);
    }
  }
  if (bodyParts.length === 0) return null;
  if (bodyParts.length === 1) return `${bodyParts[0]} Day`;

  const last = bodyParts[bodyParts.length - 1];
  const rest = bodyParts.slice(0, -1);
  return `${rest.join(', ')} & ${last} Day`;
}

// Seeds a single program's weeks/days/exercises, upserting on every boot so a
// content fix shipped in a new server version (a corrected description, a
// reordered week, a rest day turned into a training day) actually takes
// effect for an already-running deployment — a prior version of this
// function no-op'd entirely once a program had any weeks, so a JSON change
// after first seed never reached a persisted DB. Rows are matched by their
// program slot (program+week_number, week_id+day_of_week,
// workout_day_id+order_num) and updated in place rather than replaced, so
// exercise ids — and the workout_logs that reference them — stay stable
// across a content fix. Never touches other programs' rows.
function seedProgram(db, programKey) {
  const program = PROGRAMS[programKey];
  if (!program) throw new Error(`Unknown program: ${programKey}`);

  const findWeek = db.prepare(
    'SELECT id FROM weeks WHERE program = ? AND week_number = ?'
  );
  const insertWeek = db.prepare(
    'INSERT INTO weeks (program, week_number) VALUES (?, ?)'
  );
  const findDay = db.prepare(
    'SELECT id, is_rest_day, focus_summary FROM workout_days WHERE week_id = ? AND day_of_week = ?'
  );
  const insertDay = db.prepare(
    'INSERT INTO workout_days (week_id, day_of_week, is_rest_day, focus_summary) VALUES (?, ?, ?, ?)'
  );
  const updateDay = db.prepare(
    'UPDATE workout_days SET is_rest_day = ?, focus_summary = ? WHERE id = ?'
  );
  const findExercise = db.prepare(
    'SELECT id FROM exercises WHERE workout_day_id = ? AND order_num = ?'
  );
  const insertExercise = db.prepare(
    'INSERT INTO exercises (workout_day_id, order_num, body_part, exercise_name, exercise_description, rpe, sets, rep_range) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const updateExercise = db.prepare(
    `UPDATE exercises
     SET body_part = ?, exercise_name = ?, exercise_description = ?, rpe = ?, sets = ?, rep_range = ?
     WHERE id = ?`
  );

  const seedAll = db.transaction(() => {
    for (const weekData of program.workoutData) {
      const existingWeek = findWeek.get(programKey, weekData.week);
      const weekId = existingWeek
        ? existingWeek.id
        : insertWeek.run(programKey, weekData.week).lastInsertRowid;

      for (const day of DAYS) {
        const dayData = weekData.days[day];
        if (!dayData) continue;

        const isRestDay = dayData.isRestDay ? 1 : 0;
        const focusSummary = focusSummaryFor(dayData);
        const existingDay = findDay.get(weekId, day);
        let dayId;
        if (existingDay) {
          dayId = existingDay.id;
          if (
            existingDay.is_rest_day !== isRestDay ||
            existingDay.focus_summary !== focusSummary
          ) {
            updateDay.run(isRestDay, focusSummary, dayId);
          }
        } else {
          dayId = insertDay.run(
            weekId,
            day,
            isRestDay,
            focusSummary
          ).lastInsertRowid;
        }

        for (const exercise of dayData.exercises) {
          const { sets, rep_range } = parseSetsAndReps(
            exercise.exercise_description
          );
          const existingExercise = findExercise.get(dayId, exercise.order);
          if (existingExercise) {
            updateExercise.run(
              exercise.body_part,
              exercise.exercise_name,
              exercise.exercise_description,
              exercise.rpe ?? null,
              sets,
              rep_range,
              existingExercise.id
            );
          } else {
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
    }
  });

  seedAll();
  console.log(`Seeded ${program.workoutData.length} weeks for ${programKey}.`);
}

function seedAllPrograms(db) {
  for (const programKey of Object.keys(PROGRAMS)) {
    seedProgram(db, programKey);
  }
}

module.exports = {
  seedProgram,
  seedAllPrograms,
  parseSetsAndReps,
  focusSummaryFor,
};
