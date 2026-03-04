'use strict';

const { Terminal } = require('@xterm/headless');
const { SerializeAddon } = require('@xterm/addon-serialize');
const { Unicode11Addon } = require('@xterm/addon-unicode11');
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
  const headlessTerm = new Terminal({ allowProposedApi: true, scrollback: 1000 });
  const serializeAddon = new SerializeAddon();
  const unicode11Addon = new Unicode11Addon();
  headlessTerm.loadAddon(serializeAddon);
  headlessTerm.loadAddon(unicode11Addon);
  headlessTerm.unicode.activeVersion = '11';

  const runtime = {
    id,
    name,
    userId,
    recording,
    terminalWs: null,
    browserWss: new Set(),
    scrollback: [],
    headlessTerm,
    serializeAddon,
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
  const session = live.get(id);
  if (session?.headlessTerm) session.headlessTerm.dispose();
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
    let mem = live.get(row.id);

    // DB에만 있고 live에 없으면 복원 + 정리 타이머 설정
    if (!mem) {
      mem = reviveRuntime(row.id, row.name, row.user_id, !!row.recording);
      scheduleCleanup(mem);
    }

    return {
      id: row.id,
      name: row.name,
      userId: row.user_id,
      recording: !!row.recording,
      createdAt: row.created_at,
      terminalWs: mem.terminalWs,
      browserWss: mem.browserWss,
    };
  });
}

// 터미널 연결 없는 세션 정리 예약
function scheduleCleanup(session) {
  if (session.terminalWs || session._deleteTimer) return;
  session._deleteTimer = setTimeout(() => {
    deleteSession(session.id);
    session.browserWss.forEach(bws => bws.close());
  }, 60_000);
}

function appendScrollback(session, data) {
  session.scrollback.push(data);
  if (session.scrollback.length > SCROLLBACK_LIMIT) {
    session.scrollback.shift();
  }
}

function writeToHeadless(session, data) {
  session.headlessTerm.write(
    typeof data === 'string' ? data : new Uint8Array(data)
  );
}

function resizeHeadless(session, cols, rows) {
  session.headlessTerm.resize(cols, rows);
}

function serializeScreen(session) {
  return session.serializeAddon.serialize();
}

module.exports = {
  createSession,
  getSession,
  deleteSession,
  getSessionsByUser,
  appendScrollback,
  writeToHeadless,
  resizeHeadless,
  serializeScreen,
};
