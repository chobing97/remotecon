import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { xtermTheme } from '../styles/theme';
import { api } from '../api/client';

export function useTerminal(sessionId, { onTerminated, onStatusChange, onAutoScrollChange, mobileReadOnly } = {}) {
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const fitAddonRef = useRef(null);
  const containerRef = useRef(null);
  // CLI에서 보낸 크기가 있으면 fitAddon.fit() 사용하지 않음
  const cliSizeRef = useRef(null);
  const terminatedTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const disposedRef = useRef(false);
  const statusRef = useRef(null);
  const scrollToBottomRef = useRef(null);
  const onAutoScrollChangeRef = useRef(onAutoScrollChange);
  onAutoScrollChangeRef.current = onAutoScrollChange;
  const onTerminatedRef = useRef(onTerminated);
  onTerminatedRef.current = onTerminated;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

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
    scrollToBottomRef.current = setupMobileTouchScroll(element, term, () => {
      if (cliSizeRef.current) {
        applyCliCols(term, cliSizeRef.current.cols);
      } else {
        fitAddon.fit();
      }
    }, (v) => onAutoScrollChangeRef.current?.(v));

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    disposedRef.current = false;

    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    connect(term);

    const onResize = () => {
      if (cliSizeRef.current && termRef.current) {
        applyCliCols(termRef.current, cliSizeRef.current.cols);
      } else {
        fitAddon.fit();
      }
    };

    // ResizeObserver로 컨테이너 크기 변화 감지 (모바일 URL 바, 키보드 등)
    const ro = new ResizeObserver(onResize);
    // 부모 wrapper(flex:1 영역)를 감시해야 정확한 가용 높이 반영
    const wrapper = element.parentElement;
    if (wrapper) ro.observe(wrapper);
    ro.observe(element);

    return () => {
      ro.disconnect();
    };
  }, [sessionId]);

  function setStatus(status) {
    statusRef.current = status;
    onStatusChangeRef.current?.(status);
  }

  const connect = useCallback(async (term) => {
    let ws;
    try {
      const { token } = await api.getWsToken();
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws/session/${sessionId}?token=${token}`);
    } catch {
      // 토큰 발급 실패 시 재시도
      if (!disposedRef.current && statusRef.current !== 'terminated') {
        reconnectTimerRef.current = setTimeout(() => {
          if (!disposedRef.current && termRef.current) connect(termRef.current);
        }, 3000);
      }
      return;
    }
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mobileReadOnly) term.focus();
      // 상태는 Hub가 보내는 status 메시지로 결정 (여기서 설정하지 않음)
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
          } else if (msg.type === 'status' && msg.status === 'terminated') {
            setStatus('terminated');
            term.write('\r\n\x1b[91m[CLI terminated]\x1b[0m\r\n');
            terminatedTimerRef.current = setTimeout(() => {
              onTerminatedRef.current?.();
            }, 10_000);
          } else if (msg.type === 'status' && msg.status === 'connected') {
            setStatus('connected');
            if (terminatedTimerRef.current) {
              clearTimeout(terminatedTimerRef.current);
              terminatedTimerRef.current = null;
            }
          } else if (msg.type === 'status' && msg.status === 'reconnecting') {
            setStatus('disconnected');
          }
        } catch {
          // ignore
        }
      }
    };

    ws.onclose = () => {
      // terminated 상태를 덮어쓰지 않음
      if (statusRef.current !== 'terminated') {
        setStatus('disconnected');
      }
      // terminated가 아닌 경우에만 재접속 시도
      if (!disposedRef.current && statusRef.current !== 'terminated') {
        reconnectTimerRef.current = setTimeout(() => {
          if (!disposedRef.current && termRef.current && statusRef.current !== 'terminated') {
            connect(termRef.current);
          }
        }, 3000);
      }
    };

  }, [sessionId]);

  const fit = useCallback(() => {
    if (cliSizeRef.current && termRef.current) {
      applyCliCols(termRef.current, cliSizeRef.current.cols);
    } else {
      fitAddonRef.current?.fit();
    }
  }, []);

  const sendInput = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data }));
    }
  }, []);

  const dispose = useCallback(() => {
    disposedRef.current = true;
    if (terminatedTimerRef.current) {
      clearTimeout(terminatedTimerRef.current);
      terminatedTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    termRef.current?.dispose();
    termRef.current = null;
    cliSizeRef.current = null;
  }, []);

  useEffect(() => {
    return () => dispose();
  }, [dispose]);

  const scrollToBottom = useCallback(() => {
    scrollToBottomRef.current?.();
  }, []);

  return { attach, fit, dispose, sendInput, termRef, wsRef, scrollToBottom };
}

function setupMobileTouchScroll(container, term, onFit, onAutoScrollChange) {
  if (!('ontouchstart' in window)) return null;

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
    touchAction: 'pan-x pan-y',
    overscrollBehaviorY: 'contain',
  });
  spacer.style.cssText = `height:${scrollArea.offsetHeight}px;width:1px;pointer-events:none`;
  proxy.appendChild(spacer);

  container.style.position = 'relative';
  container.appendChild(proxy);

  // 오토스크롤: 사용자가 맨 밑에 있으면 활성, 위로 스크롤하면 비활성
  let isUserScrolling = false;
  let autoScroll = true;

  function isAtBottom(el) {
    return el.scrollHeight - el.scrollTop - el.clientHeight < 10;
  }

  function setAutoScroll(v) {
    if (autoScroll !== v) {
      autoScroll = v;
      onAutoScrollChange?.(v);
    }
  }

  // 스크롤 동기화: proxy → viewport
  proxy.addEventListener('scroll', () => {
    isUserScrolling = true;
    viewport.scrollTop = proxy.scrollTop;
    setAutoScroll(isAtBottom(proxy));
    requestAnimationFrame(() => { isUserScrolling = false; });
  }, { passive: true });

  // 스크롤 동기화: viewport → proxy (오토스크롤 활성 시에만)
  viewport.addEventListener('scroll', () => {
    if (isUserScrolling) return;
    if (autoScroll) {
      proxy.scrollTop = viewport.scrollTop;
    }
  }, { passive: true });

  // scroll-area 높이 변경 감시 (새 출력 도착 시)
  const ro = new ResizeObserver(() => {
    spacer.style.height = scrollArea.offsetHeight + 'px';
    if (autoScroll) {
      proxy.scrollTop = viewport.scrollTop;
    }
  });
  ro.observe(scrollArea);

  // Pinch-to-zoom: fontSize 동적 변경
  let pinching = false;
  let pinchStartDist = 0;
  let pinchBaseFontSize = 14;
  let pinchFitTimer = null;

  function getTouchDist(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // 더블탭 → xterm 직접 포커스 (키보드 열림)
  let lastTapTime = 0;
  let tapStartX = 0;
  let tapStartY = 0;

  proxy.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      tapStartX = e.touches[0].clientX;
      tapStartY = e.touches[0].clientY;
    }
    if (e.touches.length === 2) {
      pinching = true;
      pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
      pinchBaseFontSize = term.options.fontSize || 14;
    }
  }, { passive: true });

  proxy.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinching) {
      e.preventDefault();
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      const scale = dist / pinchStartDist;
      const newSize = Math.round(pinchBaseFontSize * scale);
      const clamped = Math.max(8, Math.min(32, newSize));
      if (clamped !== term.options.fontSize) {
        term.options.fontSize = clamped;
        clearTimeout(pinchFitTimer);
        pinchFitTimer = setTimeout(() => onFit(), 50);
      }
    }
  }, { passive: false });

  proxy.addEventListener('touchend', (e) => {
    // 더블탭 감지 (스크롤이 아닌 짧은 탭만)
    if (e.changedTouches.length === 1 && e.touches.length === 0 && !pinching) {
      const t = e.changedTouches[0];
      const dx = Math.abs(t.clientX - tapStartX);
      const dy = Math.abs(t.clientY - tapStartY);
      if (dx < 300 && dy < 300) {
        const now = Date.now();
        if (now - lastTapTime < 300) {
          // 프록시를 비활성화해야 xterm textarea가 포커스를 유지함
          proxy.style.pointerEvents = 'none';
          term.focus();
          lastTapTime = 0;
          const textarea = term.textarea;
          if (textarea) {
            const onBlur = () => {
              proxy.style.pointerEvents = '';
              textarea.removeEventListener('blur', onBlur);
            };
            textarea.addEventListener('blur', onBlur);
          }
        } else {
          lastTapTime = now;
        }
      }
    }
    if (pinching) {
      pinching = false;
      pinchStartDist = 0;
      clearTimeout(pinchFitTimer);
      onFit();
      spacer.style.height = scrollArea.offsetHeight + 'px';
    }
  }, { passive: true });

  // scrollToBottom 함수 반환
  return () => {
    proxy.scrollTop = proxy.scrollHeight;
    viewport.scrollTop = viewport.scrollHeight;
    setAutoScroll(true);
  };
}
