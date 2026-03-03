'use strict';

// ── SaaS 기본 설정 ────────────────────────────────────────
// Hub 배포 완료 후 HUB_URL을 실제 URL로 업데이트하세요.
// 환경변수로 오버라이드 가능 (self-hosted 용도).

module.exports = {
  HUB_URL: process.env.REMOTECON_HUB_URL
    || 'https://remotecon-production.up.railway.app',

  DEVICE_CLIENT_ID: process.env.GOOGLE_DEVICE_CLIENT_ID
    || '628264735702-7dsolapboqsn7amtcpkjd8scqs62h56i.apps.googleusercontent.com',

  DEVICE_CLIENT_SECRET: process.env.GOOGLE_DEVICE_CLIENT_SECRET
    || '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',
};
