const { getDb } = require('./db');
const { workoutData, DAYS } = require('./workout_data');

function parseSetsAndReps(body) {
  if (!body) return { sets: null, rep_range: null };

  // Sets: "X total work set(s)" is the authoritative count
  let sets = null;
  const totalSets = body.match(/(\d+)\s+total\s+work\s+sets?/i);
  if (totalSets) {
    sets = parseInt(totalSets[1]);
  } else {
    // Fallback: "do X sets of Y"
    const doSets = body.match(/\bdo\s+(\d+)\s+sets?\s+of\b/i);
    if (doSets) sets = parseInt(doSets[1]);
  }

  // Rep range: use LAST "sets of X[-Y]" occurrence so warmup sets
  // ("do sets of 15 to warm up ... then go to sets of 8") resolve correctly
  let rep_range = null;
  const allSetsOf = [...body.matchAll(/\bsets?\s+of\s+(\d+)(?:-(\d+))?/gi)];
  if (allSetsOf.length > 0) {
    const last = allSetsOf[allSetsOf.length - 1];
    rep_range = last[2] ? `${last[1]}-${last[2]}` : last[1];
  }

  // Fallback: "X reps" or "X-Y reps" (cap at 100 to skip things like "135 lbs x 8 reps")
  if (!rep_range) {
    const repsMatch = body.match(/\b(\d+)(?:-(\d+))?\s+reps?\b/i);
    if (repsMatch && parseInt(repsMatch[1]) <= 100) {
      rep_range = repsMatch[2] ? `${repsMatch[1]}-${repsMatch[2]}` : repsMatch[1];
    }
  }

  return { sets, rep_range };
}

function seed() {
  const db = getDb();

  const insertWeek = db.prepare('INSERT OR REPLACE INTO weeks (id, week_number) VALUES (?, ?)');
  const insertDay = db.prepare(
    'INSERT INTO workout_days (week_id, day_of_week, is_rest_day) VALUES (?, ?, ?)'
  );
  const insertExercise = db.prepare(
    'INSERT INTO exercises (workout_day_id, order_num, title, subtitle, body, rpe, sets, rep_range) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const seedAll = db.transaction(() => {
    db.exec('DELETE FROM sets; DELETE FROM workout_logs; DELETE FROM exercises; DELETE FROM workout_days; DELETE FROM weeks;');

    for (const weekData of workoutData) {
      insertWeek.run(weekData.week, weekData.week);

      for (const day of DAYS) {
        const dayData = weekData.days[day];
        if (!dayData) continue;

        const dayResult = insertDay.run(weekData.week, day, dayData.isRestDay ? 1 : 0);
        const dayId = dayResult.lastInsertRowid;

        for (const exercise of dayData.exercises) {
          const { sets, rep_range } = parseSetsAndReps(exercise.body);
          insertExercise.run(
            dayId,
            exercise.order,
            exercise.title,
            exercise.subtitle,
            exercise.body,
            exercise.rpe ?? null,
            sets,
            rep_range
          );
        }
      }
    }
  });

  seedAll();
  console.log(`Seeded ${workoutData.length} weeks into the database.`);
}

seed();
