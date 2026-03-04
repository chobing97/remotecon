'use strict';

const { WebSocket } = require('ws');

const RECONNECT_DELAY = 3000;

/**
 * Hub 서버의 /ws/terminal 에 연결하고 PTY I/O를 중계합니다.
 *
 * @param {object} opts
 * @param {string} opts.hubUrl         - Hub 서버 URL (예: https://hub.example.com)
 * @param {string} opts.sessionId      - 세션 ID
 * @param {function} opts.getToken     - ID Token을 반환하는 async 함수
 * @param {object} opts.pty            - node-pty 인스턴스
 * @param {function} opts.onConnected  - 연결 성공 콜백
 * @param {function} opts.onDisconnect - 연결 끊김 콜백
 */
function connectToHub({ hubUrl, sessionId, getToken, pty, onConnected, onDisconnect }) {
  const wsUrl = hubUrl.replace(/^http/, 'ws') + `/ws/terminal?sessionId=${sessionId}`;
  let ws;
  let closed = false;
  let failCount = 0;
  const MAX_FAILURES = 10;

  async function connect() {
    let token;
    try {
      token = await getToken();
    } catch (err) {
      process.stderr.write(`\x1b[2m[remotecon] 토큰 갱신 실패: ${err.message}\x1b[0m\r\n`);
      failCount++;
      if (failCount >= MAX_FAILURES) {
        closed = true;
        pty.kill();
        return;
      }
      setTimeout(connect, RECONNECT_DELAY);
      return;
    }

    ws = new WebSocket(wsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    ws.on('open', () => {
      failCount = 0;
      onConnected?.();
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      const text = data.toString('utf8');

      // JSON 제어 메시지 (resize 등)
      try {
        const msg = JSON.parse(text);
        if (msg.type === 'resize' && msg.cols && msg.rows) {
          pty.resize(msg.cols, msg.rows);
          return;
        }
      } catch {
        // JSON이 아니면 키 입력
      }

      // 브라우저에서 온 키 입력 → PTY에 쓰기
      try {
        pty.write(text);
      } catch {
        // PTY 종료 후 메시지 도착 시 무시
      }
    });

    ws.on('close', (code) => {
      if (code === 4001) {
        // 서버에서 세션이 삭제됨 — 재연결 중단
        closed = true;
        process.stderr.write('\x1b[2m[remotecon] 세션이 서버에서 삭제되었습니다.\x1b[0m\r\n');
        pty.kill();
        return;
      }
      onDisconnect?.();
      if (!closed) {
        failCount++;
        if (failCount >= MAX_FAILURES) {
          process.stderr.write(`\x1b[2m[remotecon] 재연결 ${MAX_FAILURES}회 실패 — 중단합니다.\x1b[0m\r\n`);
          closed = true;
          pty.kill();
          return;
        }
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
        ws.send(Buffer.isBuffer(data) ? data : Buffer.from(data));
      }
    },
    // 터미널 크기를 Hub에 전송
    sendResize(cols, rows) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    },
    close() {
      closed = true;
      ws?.close();
    },
  };
}

module.exports = { connectToHub };
