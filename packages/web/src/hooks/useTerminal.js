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
  if (!('ontouchstart' in window)) return;

  const viewport = container.querySelector('.xterm-viewport');
  const scrollArea = container.querySelector('.xterm-scroll-area');
  if (!viewport || !scrollArea) return;

  // 투명 스크롤 프록시 — 브라우저 네이티브 관성 스크롤 사용
  const proxy = document.createElement('div');
  const spacer = document.createElement('div');

  proxy.className = 'touch-scroll-proxy';
  Object.assign(proxy.style, {
    position: 'absolute',
    top: '0', left: '0', right: '0', bottom: '0',
    overflowY: 'auto',
    zIndex: '10',
    touchAction: 'pan-y',
  });
  spacer.style.cssText = `height:${scrollArea.offsetHeight}px;width:1px;pointer-events:none`;
  proxy.appendChild(spacer);

  container.style.position = 'relative';
  container.appendChild(proxy);

  // 스크롤 동기화: proxy → viewport
  let isUserScrolling = false;
  proxy.addEventListener('scroll', () => {
    isUserScrolling = true;
    viewport.scrollTop = proxy.scrollTop;
    requestAnimationFrame(() => { isUserScrolling = false; });
  }, { passive: true });

  // 스크롤 동기화: viewport → proxy (새 출력으로 자동 스크롤 시)
  viewport.addEventListener('scroll', () => {
    if (isUserScrolling) return;
    proxy.scrollTop = viewport.scrollTop;
  }, { passive: true });

  // scroll-area 높이 변경 감시 (새 출력 도착 시)
  const ro = new ResizeObserver(() => {
    spacer.style.height = scrollArea.offsetHeight + 'px';
    if (!isUserScrolling) proxy.scrollTop = viewport.scrollTop;
  });
  ro.observe(scrollArea);

  // 탭 → xterm 포커스 (키보드 열기)
  let touchY = 0;
  proxy.addEventListener('touchstart', (e) => {
    touchY = e.touches[0].clientY;
  }, { passive: true });
  proxy.addEventListener('touchend', (e) => {
    if (Math.abs(e.changedTouches[0].clientY - touchY) < 10) {
      container.querySelector('.xterm-helper-textarea')?.focus();
    }
  }, { passive: true });
}
