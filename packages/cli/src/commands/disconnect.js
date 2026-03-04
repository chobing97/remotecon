'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STATUS_FILE = path.join(process.env.HOME || '~', '.remotecon', 'status.json');

function getAncestorPids() {
  const pids = [];
  let pid = process.ppid;
  while (pid > 1) {
    pids.push(pid);
    try {
      pid = parseInt(execSync(`ps -o ppid= -p ${pid}`, { encoding: 'utf8' }).trim(), 10);
    } catch {
      break;
    }
  }
  return pids;
}

function findParentSession(alive) {
  const ancestors = getAncestorPids();
  return alive.find(s => ancestors.includes(s.pid));
}

function showSessionList(alive) {
  const labels = {
    connected: '\x1b[32m● 연결됨\x1b[0m',
    reconnecting: '\x1b[33m○ 재연결 중\x1b[0m',
    connecting: '\x1b[33m○ 연결 중\x1b[0m',
  };
  process.stderr.write(`[remotecon] 세션 ${alive.length}개 실행 중\n`);
  for (const data of alive) {
    process.stderr.write(`\n  세션: ${data.session}\n`);
    process.stderr.write(`  연결: ${labels[data.status] || data.status}\n`);
    process.stderr.write(`  PID:  ${data.pid}\n`);
  }
  process.stderr.write(`\n종료하려면: remotecon disconnect <이름|PID>\n`);
}

function killAndCleanup(targets, alive) {
  for (const data of targets) {
    try {
      process.kill(data.pid, 'SIGTERM');
      process.stderr.write(`[remotecon] 세션 종료: ${data.session} (PID ${data.pid})\n`);
    } catch {
      process.stderr.write(`[remotecon] 이미 종료됨: ${data.session} (PID ${data.pid})\n`);
    }
  }

  const remaining = alive.filter(s => !targets.includes(s));
  try {
    if (remaining.length === 0) {
      fs.unlinkSync(STATUS_FILE);
    } else {
      fs.writeFileSync(STATUS_FILE, JSON.stringify(remaining, null, 2));
    }
  } catch {}
}

function disconnect(target) {
  let list;
  try {
    const parsed = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    list = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    process.stderr.write('[remotecon] 실행 중인 세션이 없습니다.\n');
    return;
  }

  const alive = list.filter(data => {
    try { process.kill(data.pid, 0); return true; } catch { return false; }
  });

  if (alive.length === 0) {
    process.stderr.write('[remotecon] 실행 중인 세션이 없습니다.\n');
    try { fs.unlinkSync(STATUS_FILE); } catch {}
    return;
  }

  if (target) {
    const byPid = alive.filter(s => String(s.pid) === target);
    const matches = byPid.length > 0 ? byPid : alive.filter(s => s.session === target);
    if (matches.length === 0) {
      process.stderr.write(`[remotecon] '${target}' 세션을 찾을 수 없습니다.\n`);
      return;
    }
    killAndCleanup(matches, alive);
    return;
  }

  // 인자 없음: 상위 프로세스에 remotecon 세션이 있으면 그것만 종료
  const parent = findParentSession(alive);
  if (parent) {
    killAndCleanup([parent], alive);
  } else {
    showSessionList(alive);
  }
}

module.exports = disconnect;
