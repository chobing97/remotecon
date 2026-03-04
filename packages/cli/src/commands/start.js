'use strict';

const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');
const { getIdToken } = require('../auth');
const { connectToHub } = require('../ws');
const { spawnPty } = require('../pty');
const config = require('../config');

const STATUS_DIR = path.join(process.env.HOME || '~', '.remotecon');
const STATUS_FILE = path.join(STATUS_DIR, 'status.json');

function writeStatus(data) {
  try {
    fs.mkdirSync(STATUS_DIR, { recursive: true });
    fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

function clearStatus() {
  try { fs.unlinkSync(STATUS_FILE); } catch {}
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
  const name = sessionName || path.basename(process.cwd());
  const record = !!options.record;

  const idToken = await getIdToken(config.DEVICE_CLIENT_ID, config.DEVICE_CLIENT_SECRET);
  const { sessionId } = await registerSession(config.HUB_URL, name, idToken, record);

  const ptyProcess = spawnPty();

  process.stderr.write(`\x1b[2m[remotecon] 세션: ${name}${record ? ' (녹화 중)' : ''}\x1b[0m\n`);
  process.stderr.write(`\x1b[2m[remotecon] 모바일: ${config.HUB_URL}\x1b[0m\n`);

  const statusBase = { session: name, sessionId, server: config.HUB_URL, pid: process.pid };

  writeStatus({ ...statusBase, status: 'connecting' });

  const hub = connectToHub({
    hubUrl: config.HUB_URL,
    sessionId,
    getToken: () => getIdToken(config.DEVICE_CLIENT_ID, config.DEVICE_CLIENT_SECRET),
    pty: ptyProcess,
    onConnected: () => {
      writeStatus({ ...statusBase, status: 'connected' });
      hub.sendResize(process.stdout.columns || 120, process.stdout.rows || 35);
    },
    onDisconnect: () => {
      writeStatus({ ...statusBase, status: 'reconnecting' });
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
    clearStatus();
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stderr.write(`\r\n\x1b[2m[remotecon] 세션 종료 (exit ${exitCode})\x1b[0m\r\n`);
    process.exit(exitCode);
  });
}

module.exports = start;
