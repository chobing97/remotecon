'use strict';

const os = require('os');
const https = require('https');
const http = require('http');
const path = require('path');
const { getIdToken } = require('../auth');
const { connectToHub } = require('../ws');
const { spawnPty } = require('../pty');
const config = require('../config');
const { upsertSession, updateStatus, removeSession, generateUniqueName } = require('../status-db');

function deleteRemoteSession(hubUrl, sessionId, idToken) {
  return new Promise((resolve) => {
    const url = new URL(`/api/cli/sessions/${sessionId}`, hubUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${idToken}` },
    }, () => resolve());

    req.on('error', () => resolve()); // 실패해도 무시
    req.end();
  });
}

function registerSession(hubUrl, name, idToken, record) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ name, record });
    const url = new URL('/api/sessions', hubUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${idToken}`,
      },
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        const data = JSON.parse(buf);
        if (res.statusCode !== 200) return reject(new Error(data.error || 'Hub 등록 실패'));
        resolve(data);
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function start(sessionName, options = {}) {
  const hostname = os.hostname().replace(/\.local$/, '');
  const label = sessionName || path.basename(process.cwd());
  const baseName = `${hostname}/${label}`;
  const name = generateUniqueName(baseName);
  const record = !!options.record;

  const idToken = await getIdToken(config.DEVICE_CLIENT_ID, config.DEVICE_CLIENT_SECRET);
  const { sessionId } = await registerSession(config.HUB_URL, name, idToken, record);

  const ptyProcess = spawnPty();

  process.stderr.write(`\x1b[2m[remotecon] 세션: ${name}${record ? ' (녹화 중)' : ''}\x1b[0m\n`);
  process.stderr.write(`\x1b[2m[remotecon] 모바일: ${config.HUB_URL}\x1b[0m\n`);

  upsertSession({ pid: process.pid, session: name, sessionId, server: config.HUB_URL, status: 'connecting' });

  let currentSessionId = sessionId;

  const hub = connectToHub({
    hubUrl: config.HUB_URL,
    sessionId,
    sessionName: name,
    getToken: () => getIdToken(config.DEVICE_CLIENT_ID, config.DEVICE_CLIENT_SECRET),
    reRegister: async (oldSessionId) => {
      const token = await getIdToken(config.DEVICE_CLIENT_ID, config.DEVICE_CLIENT_SECRET);
      // 구버전 세션 정리 (실패해도 계속 진행)
      if (oldSessionId) {
        try { await deleteRemoteSession(config.HUB_URL, oldSessionId, token); } catch {}
      }
      const result = await registerSession(config.HUB_URL, name, token, record);
      currentSessionId = result.sessionId;
      upsertSession({ pid: process.pid, session: name, sessionId: currentSessionId, server: config.HUB_URL, status: 'connecting' });
      process.stderr.write(`\x1b[2m[remotecon] 세션 재등록: ${name}\x1b[0m\n`);
      return result;
    },
    pty: ptyProcess,
    onConnected: () => {
      updateStatus(process.pid, 'connected');
      const cols = process.stdout.columns || 120;
      const rows = process.stdout.rows || 35;
      hub.sendResize(cols, rows);
      // 크기를 살짝 바꿨다 복원하여 SIGWINCH 강제 발생
      // (같은 크기로 resize하면 일부 앱이 redraw를 생략함)
      ptyProcess.resize(cols, Math.max(1, rows - 1));
      setTimeout(() => ptyProcess.resize(cols, rows), 50);
    },
    onDisconnect: () => {
      updateStatus(process.pid, 'reconnecting');
    },
  });

  ptyProcess.onData((data) => {
    process.stdout.write(data);
    hub.sendOutput(data);
  });

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (data) => {
      ptyProcess.write(data.toString());
    });
  } else {
    process.stderr.write('\x1b[2m[remotecon] 터미널 입력 비활성 (stdin이 TTY가 아님) — 모바일로만 제어 가능\x1b[0m\r\n');
  }

  process.on('SIGWINCH', () => {
    const cols = process.stdout.columns;
    const rows = process.stdout.rows;
    ptyProcess.resize(cols, rows);
    hub.sendResize(cols, rows);
  });

  ptyProcess.onExit(({ exitCode }) => {
    hub.close();
    removeSession(process.pid);
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stderr.write(`\r\n\x1b[2m[remotecon] 세션 종료 (exit ${exitCode})\x1b[0m\r\n`);
    process.exit(exitCode);
  });
}

module.exports = start;
