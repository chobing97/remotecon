'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(process.env.HOME || '~', '.remotecon');
const DB_PATH = path.join(DB_DIR, 'status.db');

let db;

function getDb() {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS local_sessions (
      pid        INTEGER PRIMARY KEY,
      session    TEXT NOT NULL,
      session_id TEXT NOT NULL,
      server     TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'connecting'
    )
  `);

  return db;
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

process.on('exit', close);

module.exports = { getDb, close };
