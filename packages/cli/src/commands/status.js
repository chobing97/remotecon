'use strict';

const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.join(process.env.HOME || '~', '.remotecon', 'status.json');

function status() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch {
    process.stderr.write('[remotecon] 실행 중인 세션이 없습니다.\n');
    return;
  }

  // 프로세스가 살아있는지 확인
  try {
    process.kill(data.pid, 0);
  } catch {
    process.stderr.write('[remotecon] 실행 중인 세션이 없습니다.\n');
    try { fs.unlinkSync(STATUS_FILE); } catch {}
    return;
  }

  const labels = {
    connected: '\x1b[32m● 연결됨\x1b[0m',
    reconnecting: '\x1b[33m○ 재연결 중\x1b[0m',
    connecting: '\x1b[33m○ 연결 중\x1b[0m',
  };

  process.stderr.write(`[remotecon] 상태\n`);
  process.stderr.write(`  세션: ${data.session}\n`);
  process.stderr.write(`  서버: ${data.server}\n`);
  process.stderr.write(`  연결: ${labels[data.status] || data.status}\n`);
  process.stderr.write(`  PID:  ${data.pid}\n`);
}

module.exports = status;
