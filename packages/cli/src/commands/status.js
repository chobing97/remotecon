'use strict';

const start = require('./start');
const config = require('../config');

function status() {
  const hub = start._hub;

  if (!hub) {
    process.stderr.write('[remotecon] 실행 중인 세션이 없습니다.\n');
    return;
  }

  const state = hub.getStatus();
  const labels = {
    connected: '\x1b[32m연결됨\x1b[0m',
    reconnecting: '\x1b[33m재연결 중\x1b[0m',
    closed: '\x1b[31m종료됨\x1b[0m',
  };

  process.stderr.write(`[remotecon] 상태\n`);
  process.stderr.write(`  세션: ${start._sessionName || '-'}\n`);
  process.stderr.write(`  ID:   ${start._sessionId || '-'}\n`);
  process.stderr.write(`  서버: ${config.HUB_URL}\n`);
  process.stderr.write(`  연결: ${labels[state] || state}\n`);
}

module.exports = status;
