'use strict';

const https = require('https');
const http = require('http');
const { getIdToken } = require('../auth');
const config = require('../config');

function apiRequest(method, path, body) {
  return new Promise(async (resolve, reject) => {
    const idToken = await getIdToken(config.DEVICE_CLIENT_ID, config.DEVICE_CLIENT_SECRET);
    const url = new URL(path, config.HUB_URL);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const bodyStr = body ? JSON.stringify(body) : null;

    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method,
      headers: {
        'Authorization': `Bearer ${idToken}`,
        ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(buf) }));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function listWebhooks() {
  const { data } = await apiRequest('GET', '/api/webhooks');
  if (!Array.isArray(data) || data.length === 0) {
    process.stderr.write('등록된 웹훅이 없습니다.\n');
    return;
  }
  process.stderr.write('\n웹훅 목록:\n');
  for (const wh of data) {
    const status = wh.enabled ? '\x1b[32m●\x1b[0m' : '\x1b[90m○\x1b[0m';
    process.stderr.write(`  ${status} ${wh.name}  pattern: ${wh.pattern}  → ${wh.url}\n`);
    process.stderr.write(`    id: ${wh.id}\n`);
  }
  process.stderr.write('\n');
}

async function addWebhook(args) {
  const name = args[0];
  const pattern = args[1];
  const url = args[2];
  if (!name || !pattern || !url) {
    process.stderr.write('사용법: remotecon webhooks add <name> <pattern> <url>\n');
    return;
  }
  const { status, data } = await apiRequest('POST', '/api/webhooks', { name, pattern, url });
  if (status === 200) {
    process.stderr.write(`웹훅 생성됨: ${data.id}\n`);
  } else {
    process.stderr.write(`오류: ${data.error}\n`);
  }
}

async function removeWebhook(args) {
  const id = args[0];
  if (!id) {
    process.stderr.write('사용법: remotecon webhooks rm <id>\n');
    return;
  }
  await apiRequest('DELETE', `/api/webhooks/${id}`);
  process.stderr.write('웹훅 삭제됨.\n');
}

async function webhooksCommand(subCmd, args) {
  if (subCmd === 'add') return addWebhook(args);
  if (subCmd === 'rm') return removeWebhook(args);
  return listWebhooks();
}

module.exports = webhooksCommand;
