import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTabStore } from '../store/tabs';
import TabBar from '../components/layout/TabBar';
import TerminalView from '../components/terminal/TerminalView';

export default function TerminalPage() {
  const { tabs, activeTabId } = useTabStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (tabs.length === 0) {
      navigate('/', { replace: true });
    }
  }, [tabs.length, navigate]);

  if (tabs.length === 0) return null;

  return (
    <div style={styles.page}>
      <TabBar />
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
};
