'use strict';

const LEVELS = { trace: 0, debug: 1, info: 2, warn: 3, error: 4 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL || 'info'];

function fmt(level, tag, msg) {
  const ts = new Date().toISOString();
  console.log(`${ts} [${level.toUpperCase()}] [${tag}] ${msg}`);
}

function createLogger(tag) {
  return {
    trace: (msg) => { if (MIN_LEVEL <= LEVELS.trace) fmt('trace', tag, msg); },
    debug: (msg) => { if (MIN_LEVEL <= LEVELS.debug) fmt('debug', tag, msg); },
    info:  (msg) => { if (MIN_LEVEL <= LEVELS.info)  fmt('info',  tag, msg); },
    warn:  (msg) => { if (MIN_LEVEL <= LEVELS.warn)  fmt('warn',  tag, msg); },
    error: (msg) => { if (MIN_LEVEL <= LEVELS.error) fmt('error', tag, msg); },
  };
}

module.exports = { createLogger };
