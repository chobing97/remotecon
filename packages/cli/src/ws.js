'use strict';

const { WebSocket } = require('ws');

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 30000;

/**
 * Hub 서버의 /ws/terminal 에 연결하고 PTY I/O를 중계합니다.
 */
function connectToHub({ hubUrl, sessionId, getToken, pty, onConnected, onDisconnect }) {
  const wsUrl = hubUrl.replace(/^http/, 'ws') + `/ws/terminal?sessionId=${sessionId}`;
  let ws;
  let closed = false;
  let connected = false;
  let delay = RECONNECT_DELAY;

  async function connect() {
    if (closed) return;

    let token;
    try {
      token = await getToken();
    } catch {
      scheduleReconnect();
      return;
    }

    ws = new WebSocket(wsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    ws.on('open', () => {
      connected = true;
      delay = RECONNECT_DELAY;
      onConnected?.();
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

    ws.on('close', (code) => {
      const wasConnected = connected;
      connected = false;

      if (code === 4001) {
        closed = true;
        pty.kill();
        return;
      }

      if (wasConnected) onDisconnect?.();
      scheduleReconnect();
    });

    ws.on('error', () => {
      // 'close' 이벤트가 이어서 발생하므로 여기서는 무시
    });
  }

  function scheduleReconnect() {
    if (closed) return;
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
      ws?.close();
    },
    getStatus() {
      if (closed) return 'closed';
      if (connected) return 'connected';
      return 'reconnecting';
    },
  };
}

module.exports = { connectToHub };
