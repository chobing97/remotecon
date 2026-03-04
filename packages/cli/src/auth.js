'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const CONFIG_DIR = path.join(process.env.HOME || '~', '.remotecon');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// ── 설정 파일 저장/로드 ───────────────────────────────────

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

// ── Google Device Flow OAuth ──────────────────────────────

const DEVICE_CODE_URL = 'https://oauth2.googleapis.com/device/code';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(body).toString();
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve(JSON.parse(buf)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function deviceFlowLogin(deviceClientId, deviceClientSecret) {
  // 1. 디바이스 코드 요청
  const codeRes = await post(DEVICE_CODE_URL, {
    client_id: deviceClientId,
    scope: 'openid email profile',
  });

  if (codeRes.error) throw new Error(codeRes.error_description || codeRes.error);

  const { device_code, user_code, verification_url, expires_in, interval } = codeRes;

  // 사용자에게 안내
  process.stderr.write('\n');
  process.stderr.write('Google 인증이 필요합니다.\n');
  process.stderr.write('아래 URL을 브라우저에서 열고 코드를 입력하세요:\n\n');
  process.stderr.write(`  URL : ${verification_url}\n`);
  process.stderr.write(`  코드: ${user_code}\n\n`);
  process.stderr.write('승인 대기 중...\n');

  // 2. 폴링으로 토큰 획득
  const pollInterval = (interval || 5) * 1000;
  const deadline = Date.now() + expires_in * 1000;

  while (Date.now() < deadline) {
    await sleep(pollInterval);
    const tokenRes = await post(TOKEN_URL, {
      client_id: deviceClientId,
      client_secret: deviceClientSecret,
      device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });

    if (tokenRes.error === 'authorization_pending') continue;
    if (tokenRes.error === 'slow_down') { await sleep(5000); continue; }
    if (tokenRes.error) throw new Error(tokenRes.error_description || tokenRes.error);

    // 성공
    return {
      access_token: tokenRes.access_token,
      refresh_token: tokenRes.refresh_token,
      id_token: tokenRes.id_token,
      expires_at: Date.now() + tokenRes.expires_in * 1000,
    };
  }

  throw new Error('인증 시간이 초과되었습니다. 다시 시도해주세요.');
}

async function refreshAccessToken(deviceClientId, deviceClientSecret, refreshToken) {
  const res = await post(TOKEN_URL, {
    client_id: deviceClientId,
    client_secret: deviceClientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  if (res.error) throw new Error(res.error_description || res.error);
  return {
    access_token: res.access_token,
    id_token: res.id_token,
    expires_at: Date.now() + res.expires_in * 1000,
  };
}

// ── 공개 API ─────────────────────────────────────────────

async function getIdToken(deviceClientId, deviceClientSecret) {
  let config = loadConfig();

  // 저장된 토큰이 있고 아직 유효하면 반환
  if (config.id_token && config.expires_at && Date.now() < config.expires_at - 60_000) {
    return config.id_token;
  }

  // refresh token으로 갱신 시도
  if (config.refresh_token) {
    try {
      const refreshed = await refreshAccessToken(deviceClientId, deviceClientSecret, config.refresh_token);
      config = { ...config, ...refreshed };
      saveConfig(config);
      return config.id_token;
    } catch {
      // refresh 실패 시 재로그인
    }
  }

  // Device Flow 로그인
  const tokens = await deviceFlowLogin(deviceClientId, deviceClientSecret);
  saveConfig(tokens);
  return tokens.id_token;
}

function logout() {
  try {
    fs.unlinkSync(CONFIG_FILE);
    process.stderr.write('로그아웃되었습니다.\n');
  } catch {
    process.stderr.write('저장된 인증 정보가 없습니다.\n');
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 저장된 토큰이 있으면 반환 (로그인 플로우 없음)
function getIdTokenIfValid() {
  const config = loadConfig();
  return config.id_token || null;
}

module.exports = { getIdToken, getIdTokenIfValid, logout };
