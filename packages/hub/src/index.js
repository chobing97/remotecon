'use strict';

require('dotenv').config();

const http = require('http');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { setupPassport, verifyIdToken } = require('./auth');
const { setupWebSocket, issueBrowserToken } = require('./relay');
const { createSession, getSession, deleteSession, getSessionsByUser } = require('./sessions');

const app = express();
const server = http.createServer(app);

setupPassport();

// ── 미들웨어 ──────────────────────────────────────────────
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
app.use(passport.initialize());
app.use(passport.session());

// ── 정적 파일 ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── Google OAuth (모바일 웹) ──────────────────────────────
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=auth' }),
  (req, res) => res.redirect('/')
);

app.post('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.json({ ok: true });
  });
});

// ── 인증 미들웨어 ─────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── API: 현재 로그인 사용자 정보 ──────────────────────────
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, name: req.user.name });
});

// ── API: 세션 목록 (모바일 웹) ────────────────────────────
app.get('/api/sessions', requireAuth, (req, res) => {
  const mySessions = getSessionsByUser(req.user.id).map(s => ({
    id: s.id,
    name: s.name,
    createdAt: s.createdAt,
    online: !!s.terminalWs,
    viewers: s.browserWss.size,
  }));
  res.json(mySessions);
});

// ── API: 세션 등록 (remotecon CLI) ───────────────────────
app.post('/api/sessions', async (req, res) => {
  const idToken = req.headers['authorization']?.replace('Bearer ', '');
  if (!idToken) return res.status(401).json({ error: 'Unauthorized' });

  let user;
  try {
    user = await verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const sessionId = crypto.randomUUID();
  createSession({ id: sessionId, name, userId: user.id });

  res.json({ sessionId, wsUrl: `/ws/terminal?sessionId=${sessionId}` });
});

// ── API: WS 토큰 발급 (모바일 브라우저 WS 인증용) ─────────
app.post('/api/ws-token', requireAuth, (req, res) => {
  const token = issueBrowserToken(req.user.id);
  res.json({ token });
});

// ── WebSocket 설정 ────────────────────────────────────────
setupWebSocket(server);

// ── 서버 시작 ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[hub] Running on port ${PORT}`);
  console.log(`[hub] HUB_URL: ${process.env.HUB_URL || `http://localhost:${PORT}`}`);
});
