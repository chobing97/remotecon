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

  const onTerminated = useCallback(() => {
    closeTab(tabId);
  }, [tabId, closeTab]);

  const onStatusChange = useCallback((status) => {
    setTabStatus(tabId, status);
  }, [tabId, setTabStatus]);

  const { attach, fit, dispose, sendInput } = useTerminal(sessionId, { onTerminated, onStatusChange, mobileReadOnly: isMobile });
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
      }}
    >
      <div style={{ flex: 1, overflowX: 'auto', minHeight: 0 }}>
        <div
          ref={containerRef}
          style={{ minWidth: '100%', height: '100%' }}
        />
      </div>
      {isMobile && <MobileInputBar tabId={tabId} onSend={sendInput} disabled={tabStatus === 'disconnected' || tabStatus === 'terminated'} />}
    </div>
  );
}

const specialKeys = [
  { label: 'Esc', data: '\x1b' },
  { label: 'Tab', data: '\t' },
  { label: 'S-Tab', data: '\x1b[Z' },
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

function MobileInputBar({ tabId, onSend, disabled }) {
  const [value, setValue] = useState(() => inputCache.get(tabId) || '');
  const textareaRef = useRef(null);

  const submit = () => {
    if (disabled) return;
    if (!value) {
      onSend('\r');
      return;
    }
    const lines = value.split('\n');
    onSend(lines.join('\r') + '\r');
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

  return (
    <div style={barStyles.wrapper}>
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
      </div>
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
