'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('./logger');
const log = createLogger('db');

const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, '../data/remotecon.db');

let db;

function getDb() {
  if (db) return db;

  // Ensure directory exists
  const dir = path.dirname(SQLITE_PATH);
  const dirExists = fs.existsSync(dir);
  const fileExists = fs.existsSync(SQLITE_PATH);
  log.info(`open path=${SQLITE_PATH} dirExists=${dirExists} fileExists=${fileExists}`);

  if (!dirExists) fs.mkdirSync(dir, { recursive: true });

  db = new Database(SQLITE_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);
  logDbSummary(db);
  return db;
}

function logDbSummary(db) {
  try {
    const users = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    const activeSessions = db.prepare("SELECT COUNT(*) as cnt FROM sessions WHERE closed_at IS NULL").get().cnt;
    const closedSessions = db.prepare("SELECT COUNT(*) as cnt FROM sessions WHERE closed_at IS NOT NULL").get().cnt;
    const recordings = db.prepare('SELECT COUNT(*) as cnt FROM recordings').get().cnt;
    const webhooks = db.prepare('SELECT COUNT(*) as cnt FROM webhooks').get().cnt;
    log.info(`DB summary: users=${users} activeSessions=${activeSessions} closedSessions=${closedSessions} recordings=${recordings} webhooks=${webhooks}`);

    if (activeSessions > 0) {
      const rows = db.prepare("SELECT id, user_id, name, created_at FROM sessions WHERE closed_at IS NULL").all();
      rows.forEach(r => log.info(`  active session: id=${r.id} userId=${r.user_id} name=${r.name} created=${r.created_at}`));
    }
  } catch (err) {
    log.error(`DB summary failed: ${err.message}`);
  }
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
