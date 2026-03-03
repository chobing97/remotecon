'use strict';

const MSG = {
  INPUT: 'input',
  RESIZE: 'resize',
  STATUS: 'status',
  SESSION_INFO: 'session_info',
};

function encode(type, payload = {}) {
  return JSON.stringify({ type, ...payload });
}

function decode(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

module.exports = { MSG, encode, decode };
