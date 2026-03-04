import { useEffect, useRef, useCallback, useState } from 'react';
import { useTerminal } from '../../hooks/useTerminal';
import { useTabStore } from '../../store/tabs';

const isMobile = 'ontouchstart' in globalThis;
const inputCache = new Map();

export default function TerminalView({ sessionId, tabId, active }) {
  const containerRef = useRef(null);
  const closeTab = useTabStore((s) => s.closeTab);
  const setTabStatus = useTabStore((s) => s.setTabStatus);
  const tabStatus = useTabStore((s) => s.tabs.find((t) => t.id === tabId)?.status);
  const [selectMode, setSelectMode] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [inputBarHidden, setInputBarHidden] = useState(false);
  const [directInput, setDirectInput] = useState(false);

  // Select 모드 진입/해제 시 히스토리 관리 (뒤로가기 대응)
  const toggleSelectMode = useCallback(() => {
    setSelectMode((v) => {
      if (!v) {
        history.pushState({ selectMode: true }, '');
      } else {
        history.back();
      }
      return !v;
    });
  }, []);

  useEffect(() => {
    if (!selectMode) return;
    const onPopState = () => setSelectMode(false);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [selectMode]);

  const onTerminated = useCallback(() => {
    closeTab(tabId);
  }, [tabId, closeTab]);

  const onStatusChange = useCallback((status) => {
    setTabStatus(tabId, status);
  }, [tabId, setTabStatus]);

  const onAutoScrollChange = useCallback((v) => {
    setAutoScroll(v);
  }, []);

  const onDirectInputChange = useCallback((v) => {
    setDirectInput(v);
  }, []);

  const { attach, fit, dispose, sendInput, termRef, scrollToBottom } = useTerminal(sessionId, { onTerminated, onStatusChange, onAutoScrollChange, onDirectInputChange, mobileReadOnly: isMobile });
  const attachedRef = useRef(false);

  useEffect(() => {
    if (containerRef.current && !attachedRef.current) {
      attach(containerRef.current);
      attachedRef.current = true;
    }
    return () => {
      dispose();
      attachedRef.current = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (active) {
      const id = setTimeout(() => fit(), 50);
      return () => clearTimeout(id);
    }
  }, [active, fit]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: active ? 'flex' : 'none',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {!isMobile && (
        <button
          onClick={() => { if (window.confirm('세션을 닫으시겠습니까?')) closeTab(tabId); }}
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            zIndex: 15,
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 4,
            background: 'none',
            color: 'var(--red)',
            fontWeight: 500,
            opacity: 0.4,
            border: '1px solid var(--red)',
          }}
        >
          Close
        </button>
      )}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', minHeight: 0, position: 'relative' }}>
        <div
          ref={containerRef}
          style={{ minWidth: '100%', height: '100%' }}
        />
        {selectMode && <SelectOverlay termRef={termRef} onClose={toggleSelectMode} />}
      </div>
      {isMobile && !autoScroll && !selectMode && (
        <button
          onClick={scrollToBottom}
          style={{
            position: 'absolute',
            bottom: inputBarHidden ? 10 : 100,
            right: 10,
            zIndex: 15,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(122, 162, 247, 0.5)',
            color: '#fff',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          &#x2193;
        </button>
      )}
      {isMobile && inputBarHidden && !selectMode && (
        <button
          className="special-key"
          onClick={() => setInputBarHidden(false)}
          style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            zIndex: 15,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(122, 162, 247, 0.5)',
            color: '#fff',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          &#x2328;
        </button>
      )}
      {isMobile && !inputBarHidden && <MobileInputBar tabId={tabId} onSend={sendInput} selectMode={selectMode} onToggleSelect={toggleSelectMode} onHide={() => setInputBarHidden(true)} directInput={directInput} disabled={tabStatus === 'disconnected' || tabStatus === 'terminated'} />}
    </div>
  );
}

const specialKeys = [
  { label: 'Esc', data: '\x1b' },
  { label: 'Tab', data: '\t' },
  { label: 'S-Tab', data: '\x1b[Z' },
  { label: 'BSpace', data: '\x7f' },
  { label: 'C-c', data: '\x03' },
  { label: 'C-d', data: '\x04' },
  { label: 'C-e', data: '\x05' },
  { label: 'C-z', data: '\x1a' },
  { label: 'C-l', data: '\x0c' },
  { label: '\u2191', data: '\x1b[A' },
  { label: '\u2193', data: '\x1b[B' },
  { label: '\u2190', data: '\x1b[D' },
  { label: '\u2192', data: '\x1b[C' },
];

function SelectOverlay({ termRef, onClose }) {
  const preRef = useRef(null);
  const [text, setText] = useState('');
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    let cellHeight = 17;
    // xterm 셀 크기, 폰트 정보 추출
    try {
      const dims = term._core._renderService.dimensions.css.cell;
      cellHeight = dims.height;
      const opts = term.options;
      setMetrics({
        fontSize: opts.fontSize,
        fontFamily: opts.fontFamily,
        lineHeight: dims.height,
        charWidth: dims.width,
      });
    } catch {
      setMetrics({
        fontSize: 14,
        fontFamily: "'Meslo LG M for Powerline', 'Fira Code', monospace",
        lineHeight: 17,
        charWidth: 8.4,
      });
    }

    // 버퍼 텍스트 추출
    const buf = term.buffer.active;
    const lines = [];
    for (let i = 0; i < buf.length; i++) {
      const line = buf.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    setText(lines.join('\n').trimEnd());
  }, [termRef]);

  // 텍스트 렌더링 후 맨 밑으로 스크롤
  useEffect(() => {
    if (text && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [text]);

  // xterm 내부 패딩 (기본 xterm padding)
  const padding = 4;

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 20,
      background: 'var(--bg)',
      overflow: 'hidden',
    }}>
      <pre
        ref={preRef}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          overflow: 'auto',
          padding: `${padding}px`,
          margin: 0,
          fontSize: metrics?.fontSize ?? 14,
          fontFamily: metrics?.fontFamily ?? "'Meslo LG M for Powerline', monospace",
          lineHeight: metrics ? `${metrics.lineHeight}px` : '17px',
          letterSpacing: 0,
          color: 'var(--fg)',
          whiteSpace: 'pre',
          userSelect: 'text',
          WebkitUserSelect: 'text',
          tabSize: 8,
        }}
      >{text}</pre>
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 6, right: 6,
          fontSize: 11,
          padding: '4px 10px',
          borderRadius: 4,
          background: 'var(--blue)',
          color: '#fff',
          fontWeight: 600,
          opacity: 0.85,
          zIndex: 1,
        }}
      >
        Done
      </button>
    </div>
  );
}

function MobileInputBar({ tabId, onSend, selectMode, onToggleSelect, onHide, directInput, disabled }) {
  const [value, setValue] = useState(() => inputCache.get(tabId) || '');
  const [kbOffset, setKbOffset] = useState(0);
  const textareaRef = useRef(null);

  // directInput 모드에서 키보드 높이 추적
  useEffect(() => {
    if (!directInput) { setKbOffset(0); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setKbOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [directInput]);

  const submit = () => {
    if (disabled) return;
    if (!value) {
      onSend('\r');
      return;
    }
    const lines = value.split('\n');
    onSend(lines.join('\r'));
    setValue('');
    inputCache.delete(tabId);
    if (textareaRef.current) textareaRef.current.style.height = '36px';
  };

  const handleInput = (e) => {
    const v = e.target.value;
    setValue(v);
    inputCache.set(tabId, v);
    const ta = e.target;
    ta.style.height = '36px';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const disabledOpacity = disabled ? 0.4 : 1;

  const keysRow = (
    <div style={barStyles.keys}>
      {specialKeys.map((k) => (
        <button
          key={k.label}
          className="special-key"
          onClick={() => !disabled && onSend(k.data)}
          style={{ ...barStyles.key, opacity: disabledOpacity }}
          disabled={disabled}
        >
          {k.label}
        </button>
      ))}
      <button
        className="special-key"
        onClick={onToggleSelect}
        style={{ ...barStyles.key, ...(selectMode ? { background: 'var(--blue)', color: '#fff' } : {}) }}
      >
        Select
      </button>
      <button
        className="special-key"
        onClick={onHide}
        style={barStyles.key}
      >
        &#x25BC;
      </button>
    </div>
  );

  if (directInput) {
    return (
      <div style={{
        position: 'fixed',
        bottom: kbOffset,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'var(--bg-dark)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 4,
      }}>
        {keysRow}
      </div>
    );
  }

  return (
    <div style={barStyles.wrapper}>
      {keysRow}
      <div style={barStyles.bar}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          placeholder={disabled ? 'disconnected' : 'command...'}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          rows={1}
          style={{ ...barStyles.input, opacity: disabledOpacity }}
          disabled={disabled}
        />
        <button
          onClick={submit}
          style={{ ...barStyles.sendBtn, opacity: disabledOpacity }}
          disabled={disabled}
        >
          &#x23CE;
        </button>
      </div>
    </div>
  );
}

const barStyles = {
  wrapper: {
    flexShrink: 0,
    background: 'var(--bg-dark)',
    borderTop: '1px solid var(--border)',
  },
  keys: {
    display: 'flex',
    gap: 4,
    padding: '6px 8px 0',
    overflowX: 'auto',
  },
  key: {
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 4,
    background: 'var(--bg-surface)',
    color: 'var(--fg-dim)',
    border: '1px solid var(--border)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: 'background 0.1s, color 0.1s',
    WebkitTapHighlightColor: 'transparent',
  },
  bar: {
    display: 'flex',
    gap: 6,
    padding: '6px 8px',
  },
  input: {
    flex: 1,
    fontSize: 14,
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--fg)',
    minWidth: 0,
    resize: 'none',
    height: 36,
    maxHeight: 120,
    lineHeight: '22px',
    overflowY: 'auto',
  },
  sendBtn: {
    fontSize: 18,
    padding: '4px 12px',
    borderRadius: 6,
    background: 'var(--blue)',
    color: '#fff',
    fontWeight: 600,
    flexShrink: 0,
    alignSelf: 'flex-end',
  },
};
