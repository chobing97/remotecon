'use strict';

const https = require('https');
const http = require('http');
const { getIdToken } = require('../auth');
const config = require('../config');

async function listSessions() {
  const idToken = await getIdToken(config.DEVICE_CLIENT_ID, config.DEVICE_CLIENT_SECRET);
  const url = new URL('/api/sessions', config.HUB_URL);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${idToken}` },
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          process.stderr.write(`세션 목록 조회 실패: ${buf}\n`);
          return resolve();
        }
        const sessions = JSON.parse(buf);
        if (sessions.length === 0) {
          process.stderr.write('활성 세션이 없습니다.\n');
          return resolve();
        }
        process.stderr.write('\n활성 세션:\n');
        for (const s of sessions) {
          const status = s.online ? '\x1b[32m●\x1b[0m' : '\x1b[90m○\x1b[0m';
          process.stderr.write(`  ${status} ${s.name}  (${s.id.slice(0, 8)}…)  viewers: ${s.viewers}\n`);
        }
        process.stderr.write('\n');
        resolve();
      });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = listSessions;
