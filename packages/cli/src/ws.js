'use strict';

const fs = require('fs');
const path = require('path');
const { WebSocket } = require('ws');

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 30000;

const LOG_DIR = path.join(process.env.HOME || '~', '.remotecon');
const LOG_FILE = path.join(LOG_DIR, 'connection.log');

function log(msg) {
  const now = new Date();
  const off = -now.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const absOff = Math.abs(off);
  const tz = sign + String(Math.floor(absOff / 60)).padStart(2, '0') + ':' + String(absOff % 60).padStart(2, '0');
  const ts = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + 'T' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0') + '.' +
    String(now.getMilliseconds()).padStart(3, '0') + tz;
  const line = `[${ts}] ${msg}\n`;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line);
  } catch {}
}

/**
 * Hub 서버의 /ws/terminal 에 연결하고 PTY I/O를 중계합니다.
 */
function connectToHub({ hubUrl, sessionId, sessionName, getToken, pty, onConnected, onDisconnect }) {
  const wsUrl = hubUrl.replace(/^http/, 'ws') + `/ws/terminal?sessionId=${sessionId}`;
  const tag = sessionName || sessionId.slice(0, 8);
  let ws;
  let closed = false;
  let connected = false;
  let delay = RECONNECT_DELAY;

  function slog(msg) { log(`[${tag}] ${msg}`); }

  async function connect() {
    if (closed) return;

    slog(`connect attempt (delay=${delay}ms)`);

    let token;
    try {
      token = await getToken();
    } catch (err) {
      slog(`token refresh failed: ${err.message}`);
      scheduleReconnect();
      return;
    }

    ws = new WebSocket(wsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    ws.on('open', () => {
      connected = true;
      delay = RECONNECT_DELAY;
      slog('connected');
      onConnected?.();
    });

    ws.on('ping', () => {
      slog('ping received');
    });

    ws.on('pong', () => {
      slog('pong received');
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      const text = data.toString('utf8');

      try {
        const msg = JSON.parse(text);
        if (msg.type === 'resize' && msg.cols && msg.rows) {
          pty.resize(msg.cols, msg.rows);
          return;
        }
      } catch {
        // JSON이 아니면 키 입력
      }

      try {
        pty.write(text);
      } catch {
        // PTY 종료 후 메시지 도착 시 무시
      }
    });

    ws.on('close', (code, reason) => {
      const wasConnected = connected;
      connected = false;
      slog(`close code=${code} reason=${reason || ''} wasConnected=${wasConnected}`);

      if (code === 4001) {
        slog('session deleted by server — exiting');
        closed = true;
        pty.kill();
        return;
      }

      if (wasConnected) onDisconnect?.();
      scheduleReconnect();
    });

    ws.on('error', (err) => {
      slog(`error: ${err.message}`);
    });

    ws.on('unexpected-response', (req, res) => {
      slog(`unexpected-response: HTTP ${res.statusCode}`);
    });
  }

  function scheduleReconnect() {
    if (closed) return;
    slog(`reconnect scheduled in ${delay}ms`);
    setTimeout(connect, delay);
    delay = Math.min(delay * 1.5, MAX_RECONNECT_DELAY);
  }

  connect();

  return {
    sendOutput(data) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(Buffer.isBuffer(data) ? data : Buffer.from(data));
      }
    },
    sendResize(cols, rows) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    },
    close() {
      closed = true;
      ws?.close(4000, 'intentional');
    },
    getStatus() {
      if (closed) return 'closed';
      if (connected) return 'connected';
      return 'reconnecting';
    },
  };
}

module.exports = { connectToHub };
