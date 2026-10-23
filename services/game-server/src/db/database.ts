import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS: string[] = [
  `
  CREATE TABLE players (
    id TEXT PRIMARY KEY,
    callsign TEXT NOT NULL UNIQUE COLLATE NOCASE,
    token_hash TEXT NOT NULL UNIQUE,
    credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
    xp INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE player_stats (
    player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    matches INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    kills INTEGER NOT NULL DEFAULT 0,
    deaths INTEGER NOT NULL DEFAULT 0,
    rating INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    salvage_runs INTEGER NOT NULL DEFAULT 0,
    salvage_extractions INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_stats_rating ON player_stats(rating DESC);

  CREATE TABLE owned_items (
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (player_id, item_id)
  );

  CREATE TABLE loadouts (
    player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    primary_weapon TEXT NOT NULL,
    secondary_weapon TEXT NOT NULL,
    design TEXT NOT NULL,
    color TEXT NOT NULL
  );

  CREATE TABLE match_players (
    match_id TEXT NOT NULL,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    arena TEXT NOT NULL,
    kills INTEGER NOT NULL,
    deaths INTEGER NOT NULL,
    won INTEGER NOT NULL,
    credits INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (match_id, player_id)
  );

  CREATE TABLE salvage_missions (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    seed INTEGER NOT NULL,
    zone INTEGER NOT NULL,
    issued_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    rewards_json TEXT
  );
  CREATE INDEX idx_salvage_player ON salvage_missions(player_id);

  CREATE TABLE ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    ref TEXT,
    amount INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_ledger_player ON ledger(player_id);
  `,
];

export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let v = row.user_version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v] as string);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
