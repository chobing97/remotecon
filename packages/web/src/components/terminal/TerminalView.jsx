import { useEffect, useRef } from 'react';
import { useTerminal } from '../../hooks/useTerminal';

export default function TerminalView({ sessionId, active }) {
  const containerRef = useRef(null);
  const { attach, fit, dispose } = useTerminal(sessionId);
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
