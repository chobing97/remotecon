'use strict';

const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const { verifyIdToken } = require('../passport');
const { getSession } = require('../services/sessions');
const { handleTerminalConnection } = require('./terminal');
const { handleBrowserConnection } = require('./browser');

// 단기 브라우저 WS 토큰
const browserTokens = new Map();

function issueBrowserToken(userId) {
  const token = crypto.randomBytes(16).toString('hex');
  browserTokens.set(token, { userId, expiresAt: Date.now() + 60_000 });
  return token;
}

function consumeBrowserToken(token) {
  const entry = browserTokens.get(token);
  if (!entry) return null;
  browserTokens.delete(token);
  if (Date.now() > entry.expiresAt) return null;
  return entry.userId;
}

// 만료 토큰 정리
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of browserTokens) {
    if (now > entry.expiresAt) browserTokens.delete(token);
  }
}, 60_000);

function setupWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  // Ping every 30s to keep connections alive through Railway proxy
  const pingInterval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  });

  wss.on('close', () => clearInterval(pingInterval));

  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');

    // CLI 터미널 연결
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
        wss.emit('connection', ws, req);
        handleTerminalConnection(ws, session);
      });
      return;
    }

    // 브라우저 세션 연결
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
        wss.emit('connection', ws, req);
        handleBrowserConnection(ws, session);
      });
      return;
    }

    rejectSocket(socket, 404, 'Not found');
  });

  return wss;
}

function rejectSocket(socket, code, message) {
  socket.write(`HTTP/1.1 ${code} ${message}\r\n\r\n`);
  socket.destroy();
}

module.exports = { setupWebSocket, issueBrowserToken };
