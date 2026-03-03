'use strict';

const { getDb } = require('../db');

function upsertUser({ id, email, name }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO users (id, email, name)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      last_login_at = datetime('now')
  `).run(id, email, name);
}

function getUser(id) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
}

module.exports = { upsertUser, getUser };
