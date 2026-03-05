import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { xtermTheme } from '../styles/theme';
import { api } from '../api/client';

export function useTerminal(sessionId, { onTerminated, onStatusChange, onAutoScrollChange, onDirectInputChange, mobileReadOnly } = {}) {
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
  const onDirectInputChangeRef = useRef(onDirectInputChange);
  onDirectInputChangeRef.current = onDirectInputChange;
  const directInputRef = useRef(false);

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
    const sendInputDirect = (data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    };
    scrollToBottomRef.current = setupMobileTouchScroll(element, term, () => {
      if (cliSizeRef.current) {
        applyCliCols(term, cliSizeRef.current.cols);
      } else {
        fitAddon.fit();
      }
    }, (v) => onAutoScrollChangeRef.current?.(v), (v) => { directInputRef.current = v; onDirectInputChangeRef.current?.(v); }, sendInputDirect);

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
      // directInput 모드에서 리사이즈 후 커서가 보이도록 스크롤
      if (directInputRef.current && termRef.current) {
        const term = termRef.current;
        const buf = term.buffer.active;
        const cursorLine = buf.baseY + buf.cursorY;
        term.scrollToLine(Math.max(0, cursorLine - term.rows + 1));
        const vp = element.querySelector('.xterm-viewport');
        const px = element.querySelector('.touch-scroll-proxy');
        if (vp && px) px.scrollTop = vp.scrollTop;
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

  const scrollToCursor = useCallback(() => {
    const term = termRef.current;
    if (!term) return;
    // 커서가 보이도록 스크롤 (커서는 보통 버퍼 하단 근처)
    const buf = term.buffer.active;
    const cursorLine = buf.baseY + buf.cursorY;
    term.scrollToLine(Math.max(0, cursorLine - term.rows + 1));
    // 터치 스크롤 프록시를 xterm viewport 위치에 동기화
    const container = containerRef.current;
    if (container) {
      const viewport = container.querySelector('.xterm-viewport');
      const proxy = container.querySelector('.touch-scroll-proxy');
      if (viewport && proxy) {
        proxy.scrollTop = viewport.scrollTop;
      }
    }
  }, []);

  return { attach, fit, dispose, sendInput, termRef, wsRef, scrollToBottom, scrollToCursor };
}

function setupMobileTouchScroll(container, term, onFit, onAutoScrollChange, onDirectInputChange, sendInput) {
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
    top: '0', left: '0', right: '0',
    height: viewport.clientHeight + 'px',
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
    proxy.style.height = viewport.clientHeight + 'px';
    spacer.style.height = scrollArea.offsetHeight + 'px';
    if (autoScroll) {
      proxy.scrollTop = viewport.scrollTop;
    }
  });
  ro.observe(scrollArea);
  ro.observe(viewport);

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
          proxy.style.pointerEvents = 'none';
          lastTapTime = 0;
          onDirectInputChange?.(true);

          // 페이지 스크롤 방지 (Android에서 composition 이벤트 시 브라우저가 페이지를 스크롤시킴)
          document.documentElement.style.overflow = 'hidden';

          // xterm textarea 대신 직접 만든 input으로 키보드 열기
          // xterm의 내부 textarea가 포커스를 가로채지 않도록 blur
          const xtermTextarea = container.querySelector('.xterm-helper-textarea');
          if (xtermTextarea) xtermTextarea.blur();

          const hiddenInput = document.createElement('input');
          hiddenInput.type = 'text';
          hiddenInput.setAttribute('autocomplete', 'off');
          hiddenInput.setAttribute('autocorrect', 'off');
          hiddenInput.setAttribute('autocapitalize', 'none');
          hiddenInput.spellcheck = false;
          hiddenInput.enterKeyHint = 'send';
          Object.assign(hiddenInput.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            opacity: '0',
            width: '1px',
            height: '1px',
            pointerEvents: 'none',
          });
          document.body.appendChild(hiddenInput);

          // 하이브리드 입력: keydown(ASCII 직접 전송) + input(CJK diff 폴백)
          let lastValue = '';
          let handledByKeydown = false;

          hiddenInput.addEventListener('compositionend', () => {
            lastValue = '';
            hiddenInput.value = '';
          });

          hiddenInput.addEventListener('keydown', (e) => {
            handledByKeydown = false;
            if (e.key === 'Enter') {
              e.preventDefault();
              sendInput('\r');
              handledByKeydown = true;
              return;
            }
            if (e.key === 'Backspace') {
              if (!e.isComposing) {
                e.preventDefault();
                sendInput('\x7f');
                handledByKeydown = true;
              }
              return;
            }
            // ASCII 1글자: keydown에서 직접 전송 (iOS/Android 예측입력 우회)
            if (e.key.length === 1 && e.key.charCodeAt(0) >= 32 && e.key.charCodeAt(0) < 127) {
              e.preventDefault();
              sendInput(e.key);
              handledByKeydown = true;
              lastValue = '';
              hiddenInput.value = '';
            }
          });

          hiddenInput.addEventListener('input', (e) => {
            // keydown에서 이미 처리된 경우 스킵
            if (handledByKeydown) {
              handledByKeydown = false;
              return;
            }
            const val = hiddenInput.value;
            if (val === lastValue) return;
            if (val.length > lastValue.length && val.startsWith(lastValue)) {
              sendInput(val.slice(lastValue.length));
            } else if (val.length < lastValue.length) {
              const deleted = lastValue.length - val.length;
              sendInput('\x7f'.repeat(deleted));
            } else {
              sendInput('\x7f'.repeat(lastValue.length));
              if (val) sendInput(val);
            }
            lastValue = val;
            // ASCII-only면 조합 중이라도 즉시 초기화 (Android 예측입력 대응)
            // CJK(한글 등)은 글자가 변형되므로 조합 완료까지 유지
            const isAscii = /^[\x20-\x7e]*$/.test(val);
            if (e.inputType !== 'insertCompositionText' || isAscii) {
              lastValue = '';
              hiddenInput.value = '';
            }
          });

          // xterm 이벤트 핸들러 완료 후 포커스 (포커스 가로채기 방지)
          setTimeout(() => hiddenInput.focus({ preventScroll: true }), 50);

          function cleanup() {
            hiddenInput.remove();
            proxy.style.pointerEvents = '';
            document.documentElement.style.overflow = '';
            onDirectInputChange?.(false);
            lastValue = '';
          }

          const vv = window.visualViewport;
          if (vv) {
            let kbWasOpen = false;
            const onVVResize = () => {
              const kbHeight = window.innerHeight - vv.height;
              if (!kbWasOpen && kbHeight > 100) {
                kbWasOpen = true;
              } else if (kbWasOpen && kbHeight < 50) {
                vv.removeEventListener('resize', onVVResize);
                cleanup();
              }
            };
            vv.addEventListener('resize', onVVResize);
            onVVResize();
          } else {
            hiddenInput.addEventListener('blur', cleanup);
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
