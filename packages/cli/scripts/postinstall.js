#!/usr/bin/env node
'use strict';

// node-pty의 spawn-helper 바이너리에 실행 권한을 부여합니다.
// macOS에서 npm install 시 권한이 누락되는 경우가 있어 필요합니다.

const fs = require('fs');
const path = require('path');

const ptyDir = path.dirname(require.resolve('node-pty'));
const helpers = [
  path.join(ptyDir, '../prebuilds/darwin-arm64/spawn-helper'),
  path.join(ptyDir, '../prebuilds/darwin-x64/spawn-helper'),
];

for (const f of helpers) {
  try {
    fs.chmodSync(f, 0o755);
  } catch {
    // 파일이 없거나 권한 변경 불필요한 경우 무시
  }
}
