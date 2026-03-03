'use strict';

const pty = require('node-pty');

function spawnPty() {
  const shell = process.env.SHELL || '/bin/bash';
  return pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: process.stdout.columns || 120,
    rows: process.stdout.rows || 35,
    cwd: process.cwd(),
    env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', PROMPT_EOL_MARK: '' },
  });
}

module.exports = { spawnPty };
