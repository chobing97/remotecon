'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, '../data/remotecon.db');

let db;

function getDb() {
  if (db) return db;

  // Ensure directory exists
  const dir = path.dirname(SQLITE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(SQLITE_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL,
      name          TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now')),
      last_login_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id),
      name          TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now')),
      closed_at     TEXT,
      recording     INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recordings (
      id            TEXT PRIMARY KEY,
      session_id    TEXT NOT NULL REFERENCES sessions(id),
      user_id       TEXT NOT NULL REFERENCES users(id),
      name          TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now')),
      duration_ms   INTEGER DEFAULT 0,
      size_bytes    INTEGER DEFAULT 0,
      data          BLOB
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id),
      name          TEXT NOT NULL,
      pattern       TEXT NOT NULL,
      url           TEXT NOT NULL,
      session_filter TEXT,
      enabled       INTEGER DEFAULT 1,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS webhook_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_id    TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
      session_id    TEXT NOT NULL,
      matched_text  TEXT NOT NULL,
      status_code   INTEGER,
      delivered_at  TEXT DEFAULT (datetime('now'))
    );
  `);
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, close };
