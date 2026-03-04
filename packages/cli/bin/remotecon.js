#!/usr/bin/env node
'use strict';

const config = require('../src/config');

// 설정 검증
if (config.DEVICE_CLIENT_ID.includes('YOUR_DEVICE_CLIENT_ID') || !config.DEVICE_CLIENT_SECRET) {
  process.stderr.write('[remotecon] 오류: 아직 서버 설정이 완료되지 않았습니다.\n');
  process.stderr.write('  packages/cli/src/config.js 에서 HUB_URL과 DEVICE_CLIENT_ID를 설정하세요.\n');
  process.exit(1);
}

const [,, subcommand, ...rest] = process.argv;

// --record 플래그 파싱
const hasRecord = [subcommand, ...rest].includes('--record');
const args = [subcommand, ...rest].filter(a => a !== '--record');

function printHelp() {
  const help = `
Usage: remotecon [command] [options]

Commands:
  remotecon [name]          Start a remote terminal session (default: cwd name)
  remotecon login           Authenticate with Google (Device Flow)
  remotecon logout          Clear saved credentials
  remotecon status          Show connection status
  remotecon ls              List active sessions
  remotecon webhooks        List webhooks
  remotecon webhooks add    Add a webhook
  remotecon webhooks rm <id>  Remove a webhook

Options:
  --record    Record the session (asciicast v2)
  --help, -h  Show this help message
`;
  process.stdout.write(help.trimStart());
}

function run() {
  if (args[0] === '--help' || args[0] === '-h') {
    printHelp();
    return;
  }

  switch (args[0]) {
    case 'login':
      return require('../src/commands/login')();
    case 'logout':
      return require('../src/commands/logout')();
    case 'status':
      return require('../src/commands/status')();
    case 'ls':
      return require('../src/commands/sessions')();
    case 'webhooks':
      return require('../src/commands/webhooks')(args[1], args.slice(2));
    default: {
      // 세션 시작: remotecon [name] [--record]
      const sessionName = args[0] && !args[0].startsWith('-') ? args[0] : undefined;
      return require('../src/commands/start')(sessionName, { record: hasRecord });
    }
  }
}

Promise.resolve(run()).catch(err => {
  process.stderr.write(`[remotecon] 오류: ${err.message}\n`);
  process.exit(1);
});
