import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { xtermTheme } from '../styles/theme';
import { api } from '../api/client';

export function useTerminal(sessionId) {
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const fitAddonRef = useRef(null);
  const containerRef = useRef(null);
  // CLI에서 보낸 크기가 있으면 fitAddon.fit() 사용하지 않음
  const cliSizeRef = useRef(null);

  // 터미널 픽셀 폭에 맞춰 컨테이너 크기 조정
  function syncContainerWidth(term, cols) {
    const el = containerRef.current;
    if (!el) return;
    try {
      const cellWidth = term._core._renderService.dimensions.css.cell.width;
      if (cellWidth > 0) {
        const px = Math.ceil(cellWidth * cols) + 20; // 약간 여유
        el.style.width = px + 'px';
        el.style.minWidth = px + 'px';
      }
    } catch {
      // fallback: 안전하게 무시
    }
  }

  const attach = useCallback((element) => {
    if (!element || !sessionId) return;
    containerRef.current = element;

    const term = new Terminal({
      theme: xtermTheme,
      fontFamily: "'Meslo LG M for Powerline', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      fontSize: 14,
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    const unicode11 = new Unicode11Addon();
    term.loadAddon(unicode11);
    term.unicode.activeVersion = '11';
    term.open(element);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    connect(term);

    const onResize = () => {
      if (!cliSizeRef.current) {
        fitAddon.fit();
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [sessionId]);

  const connect = useCallback(async (term) => {
    const { token } = await api.getWsToken();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/session/${sessionId}?token=${token}`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      term.focus();
    };

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(e.data));
      } else {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'resize' && msg.cols && msg.rows) {
            cliSizeRef.current = { cols: msg.cols, rows: msg.rows };
            term.resize(msg.cols, msg.rows);
            syncContainerWidth(term, msg.cols);
          }
        } catch {
          // ignore
        }
      }
    };

    ws.onclose = () => {
      term.write('\r\n\x1b[90m[disconnected]\x1b[0m\r\n');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });
  }, [sessionId]);

  const fit = useCallback(() => {
    if (cliSizeRef.current && termRef.current) {
      const { cols, rows } = cliSizeRef.current;
      termRef.current.resize(cols, rows);
      syncContainerWidth(termRef.current, cols);
    } else {
      fitAddonRef.current?.fit();
    }
  }, []);

  const dispose = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    termRef.current?.dispose();
    termRef.current = null;
    cliSizeRef.current = null;
  }, []);

  useEffect(() => {
    return () => dispose();
  }, [dispose]);

  return { attach, fit, dispose, termRef, wsRef };
}
