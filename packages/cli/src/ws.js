'use strict';

const { WebSocket } = require('ws');

const RECONNECT_DELAY = 3000;

/**
 * Hub 서버의 /ws/terminal 에 연결하고 PTY I/O를 중계합니다.
 *
 * @param {object} opts
 * @param {string} opts.hubUrl         - Hub 서버 URL (예: https://hub.example.com)
 * @param {string} opts.sessionId      - 세션 ID
 * @param {string} opts.idToken        - Google ID Token
 * @param {object} opts.pty            - node-pty 인스턴스
 * @param {function} opts.onConnected  - 연결 성공 콜백
 * @param {function} opts.onDisconnect - 연결 끊김 콜백
 */
function connectToHub({ hubUrl, sessionId, idToken, pty, onConnected, onDisconnect }) {
  const wsUrl = hubUrl.replace(/^http/, 'ws') + `/ws/terminal?sessionId=${sessionId}`;
  let ws;
  let reconnecting = false;

  function connect() {
    ws = new WebSocket(wsUrl, {
      headers: { Authorization: `Bearer ${idToken}` },
    });

    ws.on('open', () => {
      reconnecting = false;
      onConnected?.();
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      // 브라우저에서 온 키 입력 → PTY에 쓰기
      try {
        pty.write(data.toString('utf8'));
      } catch {
        // PTY 종료 후 메시지 도착 시 무시
      }
    });

    ws.on('close', () => {
      onDisconnect?.();
      if (!reconnecting) {
        reconnecting = true;
        setTimeout(connect, RECONNECT_DELAY);
      }
    });

    ws.on('error', (err) => {
      // 'close' 이벤트가 이어서 발생하므로 여기서는 로그만
      process.stderr.write(`\r\n[remotecon] WS 오류: ${err.message}\r\n`);
    });
  }

  connect();

  return {
    // PTY 출력을 Hub로 전송 (binary 프레임)
    sendOutput(data) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(Buffer.isBuffer(data) ? data : Buffer.from(data, 'binary'));
      }
    },
    close() {
      reconnecting = true; // 재연결 방지
      ws?.close();
    },
  };
}

module.exports = { connectToHub };
