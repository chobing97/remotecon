'use strict';

const { getAliveSessions } = require('../status-db');

function status() {
  const alive = getAliveSessions();

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
