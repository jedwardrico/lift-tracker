const { getDb } = require('./db');
const { seedAllPrograms } = require('./seed_program');

// Manual entry point for (re)seeding. Idempotent and safe to run anytime —
// existing weeks/days/exercises are updated in place rather than duplicated,
// so it also picks up content fixes to an already-seeded program. getDb()
// already does this automatically on server start, so this script mainly
// exists for explicit `npm run seed` invocations (e.g. after adding a new
// program's JSON file).
seedAllPrograms(getDb());
