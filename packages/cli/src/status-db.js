'use strict';

const { getDb } = require('./db');

function upsertSession({ pid, session, sessionId, server, status }) {
  getDb().prepare(
    'INSERT OR REPLACE INTO local_sessions (pid, session, session_id, server, status) VALUES (?, ?, ?, ?, ?)'
  ).run(pid, session, sessionId, server, status);
}

function updateStatus(pid, status) {
  getDb().prepare(
    'UPDATE local_sessions SET status = ? WHERE pid = ?'
  ).run(status, pid);
}

function removeSession(pid) {
  getDb().prepare('DELETE FROM local_sessions WHERE pid = ?').run(pid);
}

function getAliveSessions() {
  const rows = getDb().prepare('SELECT * FROM local_sessions').all();
  const alive = [];
  const deadPids = [];

  for (const row of rows) {
    try {
      process.kill(row.pid, 0);
      alive.push(row);
    } catch {
      deadPids.push(row.pid);
    }
  }

  if (deadPids.length > 0) {
    const del = getDb().prepare('DELETE FROM local_sessions WHERE pid = ?');
    for (const pid of deadPids) del.run(pid);
  }

  return alive;
}

function generateUniqueName(baseName) {
  const alive = getAliveSessions();
  const taken = new Set(alive.map(s => s.session));

  if (!taken.has(baseName)) return baseName;

  let n = 2;
  while (taken.has(`${baseName}-${n}`)) n++;
  return `${baseName}-${n}`;
}

module.exports = {
  upsertSession,
  updateStatus,
  removeSession,
  getAliveSessions,
  generateUniqueName,
};
