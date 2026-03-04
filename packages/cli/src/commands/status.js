'use strict';

const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.join(process.env.HOME || '~', '.remotecon', 'status.json');

function status() {
  let list;
  try {
    const parsed = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    list = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    process.stderr.write('[remotecon] 실행 중인 세션이 없습니다.\n');
    return;
  }

  // 살아있는 프로세스만 필터링
  const alive = list.filter(data => {
    try { process.kill(data.pid, 0); return true; } catch { return false; }
  });

  // 죽은 프로세스가 있으면 파일 정리
  if (alive.length !== list.length) {
    try {
      if (alive.length === 0) {
        fs.unlinkSync(STATUS_FILE);
      } else {
        fs.writeFileSync(STATUS_FILE, JSON.stringify(alive, null, 2));
      }
    } catch {}
  }

  if (alive.length === 0) {
    process.stderr.write('[remotecon] 실행 중인 세션이 없습니다.\n');
    return;
  }

  const labels = {
    connected: '\x1b[32m● 연결됨\x1b[0m',
    reconnecting: '\x1b[33m○ 재연결 중\x1b[0m',
    connecting: '\x1b[33m○ 연결 중\x1b[0m',
  };

  process.stderr.write(`[remotecon] 세션 ${alive.length}개 실행 중\n`);
  for (const data of alive) {
    process.stderr.write(`\n  세션: ${data.session}\n`);
    process.stderr.write(`  서버: ${data.server}\n`);
    process.stderr.write(`  연결: ${labels[data.status] || data.status}\n`);
    process.stderr.write(`  PID:  ${data.pid}\n`);
  }
}

module.exports = status;
