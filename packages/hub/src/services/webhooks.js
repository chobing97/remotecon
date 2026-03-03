'use strict';

const { getDb } = require('../db');
const crypto = require('crypto');

// 컴파일된 RegExp 캐시: Map<webhookId, { pattern: RegExp, sessionFilter: RegExp|null }>
const regexCache = new Map();

function compileRegex(webhookId, pattern, sessionFilter) {
  try {
    const compiled = {
      pattern: new RegExp(pattern),
      sessionFilter: sessionFilter ? new RegExp(sessionFilter) : null,
    };
    regexCache.set(webhookId, compiled);
    return compiled;
  } catch {
    return null;
  }
}

function getCompiledRegex(webhook) {
  if (regexCache.has(webhook.id)) return regexCache.get(webhook.id);
  return compileRegex(webhook.id, webhook.pattern, webhook.session_filter);
}

function invalidateCache(webhookId) {
  regexCache.delete(webhookId);
}

// CRUD
function getWebhooksByUser(userId) {
  return getDb().prepare('SELECT * FROM webhooks WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

function createWebhook({ userId, name, pattern, url, session_filter }) {
  const id = crypto.randomUUID();
  getDb().prepare(
    'INSERT INTO webhooks (id, user_id, name, pattern, url, session_filter) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, userId, name, pattern, url, session_filter || null);
  const wh = getDb().prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
  compileRegex(id, pattern, session_filter);
  return wh;
}

function updateWebhook(id, userId, data) {
  const sets = [];
  const vals = [];
  for (const key of ['name', 'pattern', 'url', 'session_filter', 'enabled']) {
    if (data[key] !== undefined) {
      sets.push(`${key} = ?`);
      vals.push(data[key]);
    }
  }
  if (sets.length === 0) return null;
  vals.push(id, userId);
  getDb().prepare(`UPDATE webhooks SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...vals);
  invalidateCache(id);
  return getDb().prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
}

function deleteWebhook(id, userId) {
  invalidateCache(id);
  return getDb().prepare('DELETE FROM webhooks WHERE id = ? AND user_id = ?').run(id, userId);
}

// 패턴 매칭 + 전송
async function processOutput(userId, sessionId, sessionName, text) {
  const webhooks = getDb().prepare(
    'SELECT * FROM webhooks WHERE user_id = ? AND enabled = 1'
  ).all(userId);

  for (const wh of webhooks) {
    const compiled = getCompiledRegex(wh);
    if (!compiled) continue;

    // 세션 필터 체크
    if (compiled.sessionFilter && !compiled.sessionFilter.test(sessionName)) continue;

    const match = compiled.pattern.exec(text);
    if (!match) continue;

    // 비동기로 웹훅 전송
    sendWebhook(wh, sessionId, match[0]).catch((err) => {
      console.error(`[webhooks] send failed for ${wh.id}:`, err.message);
    });
  }
}

async function sendWebhook(webhook, sessionId, matchedText) {
  let statusCode = null;
  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhook_name: webhook.name,
        session_id: sessionId,
        matched_text: matchedText,
        pattern: webhook.pattern,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    statusCode = res.status;
  } catch (err) {
    statusCode = 0;
  }

  // 로그 기록
  getDb().prepare(
    'INSERT INTO webhook_logs (webhook_id, session_id, matched_text, status_code) VALUES (?, ?, ?, ?)'
  ).run(webhook.id, sessionId, matchedText, statusCode);
}

function getWebhookLogs(webhookId, userId, limit = 50) {
  return getDb().prepare(`
    SELECT wl.* FROM webhook_logs wl
    JOIN webhooks w ON w.id = wl.webhook_id
    WHERE wl.webhook_id = ? AND w.user_id = ?
    ORDER BY wl.delivered_at DESC LIMIT ?
  `).all(webhookId, userId, limit);
}

module.exports = {
  getWebhooksByUser,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  processOutput,
  getWebhookLogs,
};
