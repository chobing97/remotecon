'use strict';

const { WebSocket } = require('ws');
const { MSG, encode, decode } = require('./protocol');
const { serializeScreen } = require('../services/sessions');
const { createLogger } = require('../logger');
const log = createLogger('ws/browser');

function handleBrowserConnection(ws, session) {
  session.browserWss.add(ws);
  log.info(`attached sessionId=${session.id} viewers=${session.browserWss.size}`);

  // headless 터미널에서 직렬화된 화면 스냅샷 전송
  if (ws.readyState === WebSocket.OPEN) {
    // RIS (Reset to Initial State) — 웹 xterm 상태 클리어
    ws.send(Buffer.from('\x1bc'));
    const screen = serializeScreen(session);
    if (screen) ws.send(Buffer.from(screen));
  }

  // 현재 상태 전송
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(encode(MSG.STATUS, { status: session.terminalWs ? 'connected' : 'reconnecting' }));
    ws.send(encode(MSG.SESSION_INFO, {
      name: session.name,
      recording: session.recording,
    }));
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

  ws.on('close', () => {
    session.browserWss.delete(ws);
    log.debug(`detached sessionId=${session.id} viewers=${session.browserWss.size}`);
  });
  ws.on('error', (err) => {
    log.error(`error sessionId=${session.id} err=${err.message}`);
  });
}

module.exports = { handleBrowserConnection };
