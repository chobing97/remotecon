'use strict';

// 세션 레지스트리 - 메모리에 보관
// 구조: Map<sessionId, Session>
const sessions = new Map();

const SCROLLBACK_LIMIT = 1000;

function createSession({ id, name, userId }) {
  const session = {
    id,
    name,
    userId,
    createdAt: new Date(),
    terminalWs: null,      // remotecon CLI WebSocket
    browserWss: new Set(), // 모바일 브라우저 WebSocket들
    scrollback: [],        // PTY 출력 버퍼
  };
  sessions.set(id, session);
  return session;
}

function getSession(id) {
  return sessions.get(id);
}

function deleteSession(id) {
  sessions.delete(id);
}

function getSessionsByUser(userId) {
  return [...sessions.values()].filter(s => s.userId === userId);
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
