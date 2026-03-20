'use strict';

const { Router } = require('express');
const crypto = require('crypto');
const { requireAuth, requireApiAuth } = require('../middleware/auth');
const { createSession, getSessionsByUser, deleteSession, getSession } = require('../services/sessions');
const { startRecording } = require('../services/recordings');
const { getRecordingsByUser, getRecordingData, deleteRecording } = require('../services/recordings');
const { getWebhooksByUser, createWebhook, updateWebhook, deleteWebhook } = require('../services/webhooks');
const { issueBrowserToken } = require('../ws');
const { upsertUser } = require('../services/users');

const router = Router();

// ── 사용자 정보 ─────────────────────────────
router.get('/api/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, name: req.user.name });
});

// ── 세션 ────────────────────────────────────
router.get('/api/sessions', requireAuth, (req, res) => {
  const userId = req.user.id;
  const sessions = getSessionsByUser(userId).map(s => ({
    id: s.id,
    name: s.name,
    createdAt: s.createdAt,
    status: s.terminalWs ? 'connected' : 'reconnecting',
    viewers: s.browserWss?.size ?? 0,
    recording: s.recording,
  }));
  res.json(sessions);
});

router.post('/api/sessions', requireApiAuth, (req, res) => {
  const { name, record } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  upsertUser(req.apiUser);

  const sessionId = crypto.randomUUID();
  createSession({ id: sessionId, name, userId: req.apiUser.id, recording: !!record });

  if (record) {
    startRecording(sessionId);
  }

  res.json({ sessionId, wsUrl: `/ws/terminal?sessionId=${sessionId}` });
});

// CLI logout → 모든 세션 종료
router.delete('/api/sessions', requireApiAuth, (req, res) => {
  const sessions = getSessionsByUser(req.apiUser.id);
  for (const s of sessions) {
    if (s.terminalWs) s.terminalWs.close(4001, 'Logout');
    s.browserWss?.forEach(ws => ws.close(4001, 'Logout'));
    deleteSession(s.id);
  }
  res.json({ ok: true, closed: sessions.length });
});

router.delete('/api/sessions/:id', requireAuth, (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  if (session.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  // 터미널 WS 닫기 (4001 = 세션 삭제됨)
  if (session.terminalWs) session.terminalWs.close(4001, 'Session terminated');
  session.browserWss.forEach(ws => ws.close(4001, 'Session terminated'));
  deleteSession(req.params.id);
  res.json({ ok: true });
});

// CLI에서 Bearer 토큰으로 구버전 세션 정리
router.delete('/api/cli/sessions/:id', requireApiAuth, (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.json({ ok: true }); // 이미 없으면 성공 처리
  if (session.userId !== req.apiUser.id) return res.status(403).json({ error: 'Forbidden' });

  if (session.terminalWs) session.terminalWs.close(4001, 'Session replaced');
  session.browserWss.forEach(ws => ws.close(4001, 'Session replaced'));
  deleteSession(req.params.id);
  res.json({ ok: true });
});

// ── WS 토큰 ────────────────────────────────
router.post('/api/ws-token', requireAuth, (req, res) => {
  const token = issueBrowserToken(req.user.id);
  res.json({ token });
});

// ── 녹화 ────────────────────────────────────
router.get('/api/recordings', requireAuth, (req, res) => {
  res.json(getRecordingsByUser(req.user.id));
});

router.get('/api/recordings/:id/data', requireAuth, (req, res) => {
  const data = getRecordingData(req.params.id, req.user.id);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Encoding', 'gzip');
  res.send(data);
});

router.delete('/api/recordings/:id', requireAuth, (req, res) => {
  deleteRecording(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── 웹훅 ────────────────────────────────────
router.get('/api/webhooks', requireAuth, (req, res) => {
  res.json(getWebhooksByUser(req.user.id));
});

router.post('/api/webhooks', requireAuth, (req, res) => {
  const { name, pattern, url, session_filter } = req.body;
  if (!name || !pattern || !url) {
    return res.status(400).json({ error: 'name, pattern, and url are required' });
  }
  // regex 유효성 검사
  try { new RegExp(pattern); } catch {
    return res.status(400).json({ error: 'Invalid regex pattern' });
  }
  const wh = createWebhook({ userId: req.user.id, name, pattern, url, session_filter });
  res.json(wh);
});

router.put('/api/webhooks/:id', requireAuth, (req, res) => {
  if (req.body.pattern) {
    try { new RegExp(req.body.pattern); } catch {
      return res.status(400).json({ error: 'Invalid regex pattern' });
    }
  }
  const wh = updateWebhook(req.params.id, req.user.id, req.body);
  if (!wh) return res.status(404).json({ error: 'Not found' });
  res.json(wh);
});

router.delete('/api/webhooks/:id', requireAuth, (req, res) => {
  deleteWebhook(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
