'use strict';

const https = require('https');
const http = require('http');
const { logout: doLogout, getIdTokenIfValid } = require('../auth');
const config = require('../config');

async function logout() {
  // 서버에 모든 세션 종료 요청
  const idToken = getIdTokenIfValid();
  if (idToken) {
    try {
      await closeAllSessions(config.HUB_URL, idToken);
      process.stderr.write('[remotecon] 모든 세션을 종료했습니다.\n');
    } catch (err) {
      process.stderr.write(`[remotecon] 세션 종료 실패: ${err.message}\n`);
    }
  }
  doLogout();
}

function closeAllSessions(hubUrl, idToken) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/sessions', hubUrl);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(buf));
        else reject(new Error(`HTTP ${res.statusCode}`));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = logout;
