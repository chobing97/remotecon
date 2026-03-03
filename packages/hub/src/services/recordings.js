'use strict';

const { getDb } = require('../db');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);

// 진행 중인 녹화: Map<sessionId, { frames[], startTime }>
const activeRecordings = new Map();

function startRecording(sessionId) {
  activeRecordings.set(sessionId, {
    frames: [],
    startTime: Date.now(),
  });
}

function captureFrame(sessionId, data) {
  const rec = activeRecordings.get(sessionId);
  if (!rec) return;
  const elapsed = (Date.now() - rec.startTime) / 1000;
  rec.frames.push([elapsed, 'o', data.toString('base64')]);
}

async function stopRecording(sessionId, userId, name) {
  const rec = activeRecordings.get(sessionId);
  if (!rec) return null;
  activeRecordings.delete(sessionId);

  const durationMs = Date.now() - rec.startTime;

  // asciicast v2 format
  const header = JSON.stringify({ version: 2, width: 120, height: 40 });
  const lines = rec.frames.map(([t, type, b64]) => {
    const text = Buffer.from(b64, 'base64').toString();
    return JSON.stringify([t, type, text]);
  });
  const raw = [header, ...lines].join('\n');
  const compressed = await gzip(Buffer.from(raw));

  const id = crypto.randomUUID();
  getDb().prepare(`
    INSERT INTO recordings (id, session_id, user_id, name, duration_ms, size_bytes, data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, userId, name, durationMs, compressed.length, compressed);

  return { id, session_id: sessionId, name, duration_ms: durationMs, size_bytes: compressed.length };
}

function getRecordingsByUser(userId) {
  return getDb().prepare(
    'SELECT id, session_id, user_id, name, created_at, duration_ms, size_bytes FROM recordings WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId);
}

function getRecordingData(id, userId) {
  const row = getDb().prepare('SELECT data FROM recordings WHERE id = ? AND user_id = ?').get(id, userId);
  return row?.data || null;
}

function deleteRecording(id, userId) {
  return getDb().prepare('DELETE FROM recordings WHERE id = ? AND user_id = ?').run(id, userId);
}

function isRecording(sessionId) {
  return activeRecordings.has(sessionId);
}

module.exports = {
  startRecording,
  captureFrame,
  stopRecording,
  getRecordingsByUser,
  getRecordingData,
  deleteRecording,
  isRecording,
};
