const { getDb } = require('./db');
const { seedAllPrograms } = require('./seed_program');

// Manual entry point for (re)seeding. Additive/idempotent — safe to run
// anytime; a program already present in the DB is left untouched. getDb()
// already does this automatically on server start, so this script mainly
// exists for explicit `npm run seed` invocations (e.g. after adding a new
// program's JSON file).
seedAllPrograms(getDb());
