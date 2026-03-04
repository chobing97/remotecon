'use strict';

const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.join(process.env.HOME || '~', '.remotecon', 'status.json');

function disconnect() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch {
    process.stderr.write('[remotecon] 실행 중인 세션이 없습니다.\n');
    return;
  }

  try {
    process.kill(data.pid, 'SIGTERM');
    process.stderr.write(`[remotecon] 세션 종료 (PID ${data.pid})\n`);
  } catch {
    process.stderr.write('[remotecon] 실행 중인 세션이 없습니다.\n');
    try { fs.unlinkSync(STATUS_FILE); } catch {}
  }
}

module.exports = disconnect;
