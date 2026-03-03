#!/usr/bin/env node
'use strict';

const https = require('https');
const http = require('http');
const pty = require('node-pty');
const { getIdToken, logout } = require('../src/auth');
const { connectToHub } = require('../src/ws');
const config = require('../src/config');

// ── 설정 (config.js의 기본값, 환경변수로 오버라이드 가능) ──
const HUB_URL = config.HUB_URL;
const DEVICE_CLIENT_ID = config.DEVICE_CLIENT_ID;
const DEVICE_CLIENT_SECRET = config.DEVICE_CLIENT_SECRET;

// 아직 config.js가 설정되지 않은 경우 안내
if (DEVICE_CLIENT_ID.includes('YOUR_DEVICE_CLIENT_ID') || !DEVICE_CLIENT_SECRET) {
  process.stderr.write('[remotecon] 오류: 아직 서버 설정이 완료되지 않았습니다.\n');
  process.stderr.write('  packages/cli/src/config.js 에서 HUB_URL과 DEVICE_CLIENT_ID를 설정하세요.\n');
  process.exit(1);
}

// ── 인자 파싱 ─────────────────────────────────────────────
const [,, subcommand, ...rest] = process.argv;

if (subcommand === 'login') {
  (async () => {
    await getIdToken(DEVICE_CLIENT_ID, DEVICE_CLIENT_SECRET);
    process.stderr.write('로그인 성공!\n');
  })().catch(err => { process.stderr.write(`오류: ${err.message}\n`); process.exit(1); });
  return;
}

if (subcommand === 'logout') {
  logout();
  return;
}

// 세션명 결정: 인자가 있으면 사용, 없으면 현재 경로의 basename
const sessionName = (subcommand && !subcommand.startsWith('-'))
  ? subcommand
  : require('path').basename(process.cwd());

// ── 메인 실행 ─────────────────────────────────────────────
(async () => {
  // 1. Google 인증
  const idToken = await getIdToken(DEVICE_CLIENT_ID, DEVICE_CLIENT_SECRET);

  // 2. Hub에 세션 등록
  const { sessionId } = await registerSession(HUB_URL, sessionName, idToken);

  // 3. PTY 생성
  const shell = process.env.SHELL || '/bin/bash';
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: process.stdout.columns || 120,
    rows: process.stdout.rows || 35,
    cwd: process.cwd(),
    env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3' },
  });

  // 4. 시작 메시지 (stderr)
  process.stderr.write(`\x1b[2m[remotecon] 세션: ${sessionName}\x1b[0m\n`);
  process.stderr.write(`\x1b[2m[remotecon] 모바일: ${HUB_URL}\x1b[0m\n`);

  // 5. Hub WebSocket 연결
  const hub = connectToHub({
    hubUrl: HUB_URL,
    sessionId,
    idToken,
    pty: ptyProcess,
    onConnected: () => {
      process.stderr.write('\x1b[2m[remotecon] 연결됨\x1b[0m\r\n');
    },
    onDisconnect: () => {
      process.stderr.write('\x1b[2m[remotecon] 재연결 중...\x1b[0m\r\n');
    },
  });

  // 6. PTY 출력 → process.stdout (터미널) + Hub WebSocket
  ptyProcess.onData((data) => {
    process.stdout.write(data);
    hub.sendOutput(data);
  });

  // 7. 터미널 stdin → PTY (raw mode)
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (data) => {
    ptyProcess.write(data.toString('binary'));
  });

  // 8. 터미널 리사이즈 → PTY
  process.on('SIGWINCH', () => {
    ptyProcess.resize(process.stdout.columns, process.stdout.rows);
  });

  // 9. PTY 종료 시 정리
  ptyProcess.onExit(({ exitCode }) => {
    hub.close();
    process.stdin.setRawMode(false);
    process.stderr.write(`\r\n\x1b[2m[remotecon] 세션 종료 (exit ${exitCode})\x1b[0m\r\n`);
    process.exit(exitCode);
  });

})().catch(err => {
  process.stderr.write(`[remotecon] 오류: ${err.message}\n`);
  process.exit(1);
});

// ── Hub 세션 등록 헬퍼 ────────────────────────────────────
function registerSession(hubUrl, name, idToken) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ name });
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
