import { useEffect, useRef, useCallback, useState } from 'react';
import { useTerminal } from '../../hooks/useTerminal';
import { useTabStore } from '../../store/tabs';

const isMobile = 'ontouchstart' in globalThis;

export default function TerminalView({ sessionId, tabId, active }) {
  const containerRef = useRef(null);
  const closeTab = useTabStore((s) => s.closeTab);

  const onTerminated = useCallback(() => {
    closeTab(tabId);
  }, [tabId, closeTab]);

  const { attach, fit, dispose, sendInput } = useTerminal(sessionId, { onTerminated });
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
      {isMobile && <MobileInputBar onSend={sendInput} />}
    </div>
  );
}

function MobileInputBar({ onSend }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  const submit = () => {
    if (!value) return;
    onSend(value + '\r');
    setValue('');
  };

  return (
    <div style={barStyles.bar}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        placeholder="command..."
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        style={barStyles.input}
      />
      <button onClick={submit} style={barStyles.btn}>
        &#x23CE;
      </button>
    </div>
  );
}

const barStyles = {
  bar: {
    display: 'flex',
    gap: 6,
    padding: '6px 8px',
    background: 'var(--bg-dark)',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
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
  },
  btn: {
    fontSize: 18,
    padding: '4px 12px',
    borderRadius: 6,
    background: 'var(--blue)',
    color: '#fff',
    fontWeight: 600,
    flexShrink: 0,
  },
};
