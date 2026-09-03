const { getDb } = require('./db');
const { workoutData, DAYS } = require('./workout_data');

function seed() {
  const db = getDb();

  const insertWeek = db.prepare('INSERT OR REPLACE INTO weeks (id, week_number) VALUES (?, ?)');
  const insertDay = db.prepare(
    'INSERT INTO workout_days (week_id, day_of_week, is_rest_day) VALUES (?, ?, ?)'
  );
  const insertExercise = db.prepare(
    'INSERT INTO exercises (workout_day_id, order_num, title, subtitle, body, rpe) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const seedAll = db.transaction(() => {
    db.exec('DELETE FROM exercises; DELETE FROM workout_days; DELETE FROM weeks;');

    for (const weekData of workoutData) {
      insertWeek.run(weekData.week, weekData.week);

      for (const day of DAYS) {
        const dayData = weekData.days[day];
        if (!dayData) continue;

        const dayResult = insertDay.run(weekData.week, day, dayData.isRestDay ? 1 : 0);
        const dayId = dayResult.lastInsertRowid;

        for (const exercise of dayData.exercises) {
          insertExercise.run(
            dayId,
            exercise.order,
            exercise.title,
            exercise.subtitle,
            exercise.body,
            exercise.rpe ?? null
          );
        }
      }
    }
  });

  seedAll();
  console.log(`Seeded ${workoutData.length} weeks into the database.`);
}

seed();
