'use strict';

const { getDb } = require('../db');

// 인메모리: WebSocket 객체, scrollback 버퍼
const live = new Map();

const SCROLLBACK_LIMIT = 1000;

function createSession({ id, name, userId, recording = false }) {
  // DB에 메타데이터 저장
  getDb().prepare(
    'INSERT INTO sessions (id, user_id, name, recording) VALUES (?, ?, ?, ?)'
  ).run(id, userId, name, recording ? 1 : 0);

  const runtime = reviveRuntime(id, name, userId, recording);
  return runtime;
}

// 인메모리 런타임 객체 생성 (신규 또는 DB에서 복원)
function reviveRuntime(id, name, userId, recording) {
  const runtime = {
    id,
    name,
    userId,
    recording,
    terminalWs: null,
    browserWss: new Set(),
    scrollback: [],
    _deleteTimer: null,
  };
  live.set(id, runtime);
  return runtime;
}

function getSession(id) {
  const mem = live.get(id);
  if (mem) return mem;

  // 인메모리에 없으면 DB에서 복원 (활성 세션만)
  const row = getDb().prepare(
    'SELECT id, user_id, name, recording FROM sessions WHERE id = ? AND closed_at IS NULL'
  ).get(id);
  if (!row) return null;

  return reviveRuntime(row.id, row.name, row.user_id, !!row.recording);
}

function deleteSession(id) {
  live.delete(id);
  getDb().prepare(
    "UPDATE sessions SET closed_at = datetime('now') WHERE id = ? AND closed_at IS NULL"
  ).run(id);
}

function getSessionsByUser(userId) {
  // DB에서 활성 세션 목록 조회
  const rows = getDb().prepare(
    'SELECT id, user_id, name, recording, created_at FROM sessions WHERE user_id = ? AND closed_at IS NULL ORDER BY created_at DESC'
  ).all(userId);

  return rows.map(row => {
    const mem = live.get(row.id);
    return {
      id: row.id,
      name: row.name,
      userId: row.user_id,
      recording: !!row.recording,
      createdAt: row.created_at,
      terminalWs: mem?.terminalWs ?? null,
      browserWss: mem?.browserWss ?? new Set(),
    };
  });
}

function appendScrollback(session, data) {
  session.scrollback.push(data);
  if (session.scrollback.length > SCROLLBACK_LIMIT) {
    session.scrollback.shift();
  }
}

module.exports = {
  createSession,
  getSession,
  deleteSession,
  getSessionsByUser,
  appendScrollback,
};
