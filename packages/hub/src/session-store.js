'use strict';

const session = require('express-session');
const { getDb } = require('./db');

const TABLE = 'http_sessions';

class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    getDb().exec(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire TEXT NOT NULL
      )
    `);
    // 만료 세션 주기적 정리
    setInterval(() => this._clearExpired(), 15 * 60 * 1000);
  }

  _clearExpired() {
    try {
      getDb().prepare(`DELETE FROM ${TABLE} WHERE datetime('now') > datetime(expire)`).run();
    } catch {}
  }

  get(sid, cb) {
    try {
      const row = getDb().prepare(`SELECT sess FROM ${TABLE} WHERE sid = ? AND datetime('now') < datetime(expire)`).get(sid);
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (err) { cb(err); }
  }

  set(sid, sess, cb) {
    try {
      const maxAge = (sess.cookie && sess.cookie.maxAge) || 86400000;
      const expire = new Date(Date.now() + maxAge).toISOString();
      getDb().prepare(`INSERT OR REPLACE INTO ${TABLE} (sid, sess, expire) VALUES (?, ?, ?)`).run(sid, JSON.stringify(sess), expire);
      cb?.(null);
    } catch (err) { cb?.(err); }
  }

  destroy(sid, cb) {
    try {
      getDb().prepare(`DELETE FROM ${TABLE} WHERE sid = ?`).run(sid);
      cb?.(null);
    } catch (err) { cb?.(err); }
  }

  touch(sid, sess, cb) {
    try {
      const expire = sess.cookie?.expires
        ? new Date(sess.cookie.expires).toISOString()
        : new Date(Date.now() + 86400000).toISOString();
      getDb().prepare(`UPDATE ${TABLE} SET expire = ? WHERE sid = ?`).run(expire, sid);
      cb?.(null);
    } catch (err) { cb?.(err); }
  }
}

module.exports = SqliteSessionStore;
