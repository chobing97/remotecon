'use strict';

const { WebSocketServer, WebSocket } = require('ws');
const crypto = require('crypto');
const { verifyIdToken } = require('./auth');
const { getSession, deleteSession, appendScrollback } = require('./sessions');

// 단기 브라우저 WS 토큰: Map<token, { userId, expiresAt }>
// GET /api/ws-token 으로 발급 → WS 연결 시 쿼리 파라미터로 전달
const browserTokens = new Map();

function issueBrowserToken(userId) {
  const token = crypto.randomBytes(16).toString('hex');
  browserTokens.set(token, { userId, expiresAt: Date.now() + 60_000 }); // 1분 유효
  return token;
}

function consumeBrowserToken(token) {
  const entry = browserTokens.get(token);
  if (!entry) return null;
  browserTokens.delete(token);
  if (Date.now() > entry.expiresAt) return null;
  return entry.userId;
}

// 만료된 토큰 주기적 정리
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of browserTokens) {
    if (now > entry.expiresAt) browserTokens.delete(token);
  }
}, 60_000);

function setupWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');

    // /ws/terminal?sessionId=<id>  ← remotecon CLI
    if (url.pathname === '/ws/terminal') {
      const idToken = req.headers['authorization']?.replace('Bearer ', '');
      if (!idToken) return rejectSocket(socket, 401, 'Unauthorized');

      let user;
      try {
        user = await verifyIdToken(idToken);
      } catch {
        return rejectSocket(socket, 401, 'Invalid token');
      }

      const sessionId = url.searchParams.get('sessionId');
      const session = getSession(sessionId);
      if (!session || session.userId !== user.id) {
        return rejectSocket(socket, 403, 'Forbidden');
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        handleTerminalConnection(ws, session);
      });
      return;
    }

    // /ws/session/<sessionId>?token=<browserToken>  ← 모바일 브라우저
    const browserMatch = url.pathname.match(/^\/ws\/session\/([^/]+)$/);
    if (browserMatch) {
      const sessionId = browserMatch[1];
      const wsToken = url.searchParams.get('token');
      if (!wsToken) return rejectSocket(socket, 401, 'Unauthorized');

      const userId = consumeBrowserToken(wsToken);
      if (!userId) return rejectSocket(socket, 401, 'Invalid or expired token');

      const session = getSession(sessionId);
      if (!session) return rejectSocket(socket, 404, 'Session not found');
      if (session.userId !== userId) return rejectSocket(socket, 403, 'Forbidden');

      wss.handleUpgrade(req, socket, head, (ws) => {
        handleBrowserConnection(ws, session);
      });
      return;
    }

    rejectSocket(socket, 404, 'Not found');
  });

  return wss;
}

function handleTerminalConnection(ws, session) {
  // 재연결 시 대기 중인 삭제 타이머 취소
  if (session._deleteTimer) {
    clearTimeout(session._deleteTimer);
    session._deleteTimer = null;
  }

  session.terminalWs = ws;
  broadcastText(session, JSON.stringify({ type: 'status', online: true }));

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      // PTY 출력: 스크롤백 저장 + 브라우저 전달
      appendScrollback(session, data);
      session.browserWss.forEach(bws => {
        if (bws.readyState === WebSocket.OPEN) bws.send(data);
      });
    }
    // text 프레임은 향후 제어 메시지 확장용
  });

  ws.on('close', () => {
    session.terminalWs = null;
    broadcastText(session, JSON.stringify({ type: 'status', online: false }));

    // 60초 후 세션 삭제 — remotecon 재연결 window 허용
    // 재연결 시 clearTimeout으로 취소됨
    session._deleteTimer = setTimeout(() => {
      deleteSession(session.id);
      session.browserWss.forEach(bws => bws.close());
    }, 60_000);
  });

  ws.on('error', (err) => {
    console.error(`[relay] terminal ws error (${session.id}):`, err.message);
  });
}

function handleBrowserConnection(ws, session) {
  session.browserWss.add(ws);

  // 이전 출력 재생
  session.scrollback.forEach(data => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });

  // 현재 terminal 연결 상태 전송
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'status', online: !!session.terminalWs }));
  }

  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    // 브라우저 키 입력 → terminal 전달
    if (session.terminalWs?.readyState === WebSocket.OPEN) {
      session.terminalWs.send(data);
    }
  });

  ws.on('close', () => session.browserWss.delete(ws));
  ws.on('error', (err) => {
    console.error(`[relay] browser ws error (${session.id}):`, err.message);
  });
}

function broadcastText(session, text) {
  session.browserWss.forEach(bws => {
    if (bws.readyState === WebSocket.OPEN) bws.send(text);
  });
}

function rejectSocket(socket, code, message) {
  socket.write(`HTTP/1.1 ${code} ${message}\r\n\r\n`);
  socket.destroy();
}

module.exports = { setupWebSocket, issueBrowserToken };
