import { useEffect, useRef, useCallback } from 'react';
import { useTerminal } from '../../hooks/useTerminal';
import { useTabStore } from '../../store/tabs';

export default function TerminalView({ sessionId, tabId, active }) {
  const containerRef = useRef(null);
  const closeTab = useTabStore((s) => s.closeTab);

  const onTerminated = useCallback(() => {
    closeTab(tabId);
  }, [tabId, closeTab]);

  const { attach, fit, dispose } = useTerminal(sessionId, { onTerminated });
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
        overflowX: 'auto',
        display: active ? 'flex' : 'none',
      }}
    >
      <div
        ref={containerRef}
        style={{
          minWidth: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}
