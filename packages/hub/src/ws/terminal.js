'use strict';

const { WebSocket } = require('ws');
const { MSG, encode } = require('./protocol');
const { deleteSession, appendScrollback, writeToHeadless, resizeHeadless } = require('../services/sessions');
const { captureFrame, isRecording, stopRecording } = require('../services/recordings');
const { processOutput } = require('../services/webhooks');

function handleTerminalConnection(ws, session) {
  // 재연결 시 삭제 타이머 취소
  if (session._deleteTimer) {
    clearTimeout(session._deleteTimer);
    session._deleteTimer = null;
  }

  session.terminalWs = ws;
  broadcastText(session, encode(MSG.STATUS, { status: 'connected' }));

  // 세션 정보 전송
  broadcastText(session, encode(MSG.SESSION_INFO, {
    name: session.name,
    recording: session.recording,
  }));

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      appendScrollback(session, data);
      writeToHeadless(session, data);
      session.browserWss.forEach(bws => {
        if (bws.readyState === WebSocket.OPEN) bws.send(data);
      });

      // 녹화 캡처
      if (isRecording(session.id)) {
        captureFrame(session.id, data);
      }

      // 웹훅 매칭
      const text = data.toString();
      processOutput(session.userId, session.id, session.name, text);
    } else {
      // CLI에서 보낸 제어 메시지 (resize 등) → 브라우저에 전파
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'resize') {
          session.cols = msg.cols;
          session.rows = msg.rows;
          resizeHeadless(session, msg.cols, msg.rows);
          broadcastText(session, encode(MSG.RESIZE, { cols: msg.cols, rows: msg.rows }));
        }
      } catch {
        // ignore
      }
    }
  });

  ws.on('close', (code) => {
    session.terminalWs = null;

    // 녹화 중이면 저장
    if (isRecording(session.id)) {
      stopRecording(session.id, session.userId, session.name).catch((err) => {
        console.error(`[ws/terminal] recording save failed:`, err.message);
      });
    }

    if (code === 4000) {
      // CLI가 의도적으로 종료 → 즉시 삭제
      broadcastText(session, encode(MSG.STATUS, { status: 'terminated' }));
      deleteSession(session.id);
      session.browserWss.forEach(bws => bws.close());
    } else {
      // 네트워크 끊김 등 → 재연결 대기
      broadcastText(session, encode(MSG.STATUS, { status: 'reconnecting' }));
      session._deleteTimer = setTimeout(() => {
        deleteSession(session.id);
        session.browserWss.forEach(bws => bws.close());
      }, 60_000);
    }
  });

  ws.on('error', (err) => {
    console.error(`[ws/terminal] error (${session.id}):`, err.message);
  });
}

function broadcastText(session, text) {
  session.browserWss.forEach(bws => {
    if (bws.readyState === WebSocket.OPEN) bws.send(text);
  });
}

module.exports = { handleTerminalConnection };
