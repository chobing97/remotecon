import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTabStore } from '../store/tabs';
import TabBar from '../components/layout/TabBar';
import TerminalView from '../components/terminal/TerminalView';

const isMobile = 'ontouchstart' in globalThis;

export default function TerminalPage() {
  const { tabs, activeTabId, closeTab } = useTabStore();
  const navigate = useNavigate();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    if (tabs.length === 0) {
      navigate('/', { replace: true });
    }
  }, [tabs.length, navigate]);

  if (tabs.length === 0) return null;

  return (
    <div style={styles.page}>
      {isMobile ? (
        activeTab && (
          <div style={styles.mobileTitle}>
            <span style={{
              ...styles.dot,
              background: activeTab.status === 'terminated' ? 'var(--red)'
                : activeTab.status === 'disconnected' ? 'var(--orange)'
                : 'var(--green)',
              animation: activeTab.status === 'disconnected' ? 'blink 1s infinite' : 'none',
            }} />
            <span style={styles.titleText}>{activeTab.name}</span>
            <button
              onClick={() => closeTab(activeTab.id)}
              style={styles.closeBtn}
            >
              Close
            </button>
          </div>
        )
      ) : (
        <TabBar />
      )}
      <div style={styles.terminals}>
        {tabs.map((tab) => (
          <TerminalView
            key={tab.id}
            tabId={tab.id}
            sessionId={tab.sessionId}
            active={tab.id === activeTabId}
          />
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', height: '100%' },
  terminals: { flex: 1, position: 'relative', overflow: 'hidden' },
  mobileTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    fontSize: 12,
    color: 'var(--fg)',
    background: 'var(--bg-dark)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  titleText: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  closeBtn: {
    fontSize: 11,
    color: 'var(--green)',
    background: 'none',
    padding: '3px 8px',
    marginLeft: 'auto',
    borderRadius: 4,
    fontWeight: 500,
    border: '1px solid var(--green)',
    opacity: 0.6,
  },
};
