'use strict';

require('dotenv').config();

const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const SqliteSessionStore = require('./session-store');
const passport = require('passport');
const { setupPassport } = require('./passport');
const { setupWebSocket } = require('./ws');
const { getDb, close: closeDb } = require('./db');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

// DB 초기화
getDb();

const app = express();
const server = http.createServer(app);

setupPassport();

// ── 미들웨어 ──────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(express.json());
app.use(session({
  store: new SqliteSessionStore(),
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
app.use(passport.initialize());
app.use(passport.session());

// ── 헬스체크 ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true }));

// ── 라우트 ────────────────────────────────────────────────
app.use(authRoutes);
app.use(apiRoutes);

// ── 정적 파일 (React 프로덕션 빌드) ──────────────────────
// __dirname 기준 상대경로 + cwd 기준 절대경로 모두 시도
const webDistCandidates = [
  path.join(__dirname, '../web-dist'),           // Railway: 빌드 시 hub 안에 복사됨
  path.join(__dirname, '../../web/dist'),         // 로컬 개발
  path.join(process.cwd(), 'packages/web/dist'),
];
const webDist = webDistCandidates.find(p => fs.existsSync(p)) || webDistCandidates[0];
app.use(express.static(webDist));
// SPA 폴백: API/auth 이외의 GET 요청은 index.html로
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || req.path.startsWith('/ws/')) {
    return next();
  }
  res.sendFile(path.join(webDist, 'index.html'));
});

// ── WebSocket ─────────────────────────────────────────────
setupWebSocket(server);

// ── 서버 시작 ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[hub] Running on port ${PORT}`);
  console.log(`[hub] webDist: ${webDist} (exists: ${fs.existsSync(webDist)})`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[hub] SIGTERM received, shutting down...');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});
