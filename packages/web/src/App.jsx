import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Header from './components/layout/Header';

const isMobile = 'ontouchstart' in globalThis;

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={styles.loading}>
        <span style={styles.spinner}>Loading...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div style={styles.layout}>
      {!isMobile && <Header />}
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

const styles = {
  layout: { display: 'flex', flexDirection: 'column', height: '100%' },
  main: { flex: 1, overflow: 'hidden' },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  spinner: { color: 'var(--fg-dim)', fontSize: 14 },
};
