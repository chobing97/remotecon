'use strict';

const { WebSocket } = require('ws');
const { MSG, encode, decode } = require('./protocol');

function handleBrowserConnection(ws, session) {
  session.browserWss.add(ws);

  // 이전 출력 재생
  session.scrollback.forEach(data => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });

  // 현재 상태 전송
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(encode(MSG.STATUS, { online: !!session.terminalWs }));
    ws.send(encode(MSG.SESSION_INFO, {
      name: session.name,
      recording: session.recording,
    }));
    // CLI 터미널 크기 전송 → 웹 xterm.js가 맞춤
    if (session.cols && session.rows) {
      ws.send(encode(MSG.RESIZE, { cols: session.cols, rows: session.rows }));
    }
  }

  ws.on('message', (data, isBinary) => {
    if (isBinary) return;

    const msg = decode(data.toString());
    if (!msg) return;

    if (msg.type === MSG.INPUT) {
      if (session.terminalWs?.readyState === WebSocket.OPEN) {
        session.terminalWs.send(msg.data);
      }
    }
    // resize는 무시 — CLI 데스크탑 터미널이 마스터
  });

  ws.on('close', () => session.browserWss.delete(ws));
  ws.on('error', (err) => {
    console.error(`[ws/browser] error (${session.id}):`, err.message);
  });
}

module.exports = { handleBrowserConnection };
