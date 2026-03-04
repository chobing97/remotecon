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

  // CLI cols 기준으로 컨테이너 폭 설정 + 화면 높이에 맞춰 rows 계산
  function applyCliCols(term, cols) {
    const el = containerRef.current;
    if (!el) return;
    try {
      const dims = term._core._renderService.dimensions.css.cell;
      const cellWidth = dims.width;
      const cellHeight = dims.height;
      if (cellWidth > 0) {
        const px = Math.ceil(cellWidth * cols) + 20;
        el.style.width = px + 'px';
        el.style.minWidth = px + 'px';
      }
      // rows는 화면(wrapper) 높이에 맞춤
      if (cellHeight > 0) {
        const wrapper = el.parentElement;
        const availableHeight = wrapper ? wrapper.clientHeight : el.clientHeight;
        const rows = Math.max(1, Math.floor(availableHeight / cellHeight));
        term.resize(cols, rows);
      } else {
        term.resize(cols, term.rows);
      }
    } catch {
      // fallback
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
    setupMobileTouchScroll(element);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    connect(term);

    const onResize = () => {
      if (cliSizeRef.current && termRef.current) {
        applyCliCols(termRef.current, cliSizeRef.current.cols);
      } else {
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
            applyCliCols(term, msg.cols);
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
      applyCliCols(termRef.current, cliSizeRef.current.cols);
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

function setupMobileTouchScroll(container) {
  const viewport = container.querySelector('.xterm-viewport');
  const screen = container.querySelector('.xterm-screen');
  if (!viewport || !screen) return;

  let lastY = 0;
  let velocity = 0;
  let lastTime = 0;
  let momentumId = null;

  screen.addEventListener('touchstart', (e) => {
    if (momentumId) {
      cancelAnimationFrame(momentumId);
      momentumId = null;
    }
    lastY = e.touches[0].clientY;
    lastTime = performance.now();
    velocity = 0;
  }, { passive: true });

  screen.addEventListener('touchmove', (e) => {
    const now = performance.now();
    const dt = now - lastTime;
    if (dt > 0) {
      velocity = (lastY - e.touches[0].clientY) / dt;
    }
    lastY = e.touches[0].clientY;
    lastTime = now;
  }, { passive: true });

  screen.addEventListener('touchend', () => {
    const friction = 0.95;
    const stop = 0.05;

    function step() {
      velocity *= friction;
      if (Math.abs(velocity) < stop) return;
      viewport.scrollTop += velocity * 16;
      momentumId = requestAnimationFrame(step);
    }

    if (Math.abs(velocity) > stop) {
      momentumId = requestAnimationFrame(step);
    }
  }, { passive: true });
}
