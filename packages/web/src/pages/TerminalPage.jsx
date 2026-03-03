import { useTabStore } from '../store/tabs';
import TabBar from '../components/layout/TabBar';
import TerminalView from '../components/terminal/TerminalView';

export default function TerminalPage() {
  const { tabs, activeTabId } = useTabStore();

  if (tabs.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyText}>No open terminals</p>
        <p style={styles.emptyHint}>Select a session to connect</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <TabBar />
      <div style={styles.terminals}>
        {tabs.map((tab) => (
          <TerminalView
            key={tab.id}
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
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' },
  emptyText: { fontSize: 16, color: 'var(--fg-dim)', marginBottom: 8 },
  emptyHint: { fontSize: 13, color: 'var(--fg-dim)' },
};
