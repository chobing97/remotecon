import { useNavigate } from 'react-router-dom';
import { useSessions } from '../hooks/useSessions';
import { useTabStore } from '../store/tabs';
import SessionList from '../components/sessions/SessionList';

export default function SessionsPage() {
  const { sessions, loading } = useSessions();
  const openTab = useTabStore((s) => s.openTab);
  const navigate = useNavigate();

  const handleConnect = (session) => {
    openTab(session);
    navigate('/terminal');
  };

  if (loading) {
    return <div style={styles.loading}>Loading sessions...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>Sessions</h2>
        <span style={styles.count}>{sessions.length} active</span>
      </div>
      <SessionList sessions={sessions} onConnect={handleConnect} />
    </div>
  );
}

const styles = {
  page: { padding: 16, overflowY: 'auto', height: '100%' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: 700 },
  count: { fontSize: 12, color: 'var(--fg-dim)' },
  loading: { padding: 32, textAlign: 'center', color: 'var(--fg-dim)' },
};
