const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'db', 'gamma_bomb.sqlite');
const SCHEMA_PATH =
  process.env.SCHEMA_PATH || path.join(__dirname, '..', 'db', 'schema.sql');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);

    const cols = db.prepare('PRAGMA table_info(workout_logs)').all();
    if (!cols.find((c) => c.name === 'completed')) {
      db.exec(
        'ALTER TABLE workout_logs ADD COLUMN completed INTEGER NOT NULL DEFAULT 0'
      );
    }
    if (!cols.find((c) => c.name === 'duration_seconds')) {
      db.exec('ALTER TABLE workout_logs ADD COLUMN duration_seconds INTEGER');
    }
  }
  return db;
}

module.exports = { getDb };
