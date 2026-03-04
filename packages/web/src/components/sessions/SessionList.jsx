import SessionCard from './SessionCard';

export default function SessionList({ sessions, onConnect }) {
  if (sessions.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyText}>No active sessions</p>
        <p style={styles.emptyHint}>
          Run <code style={styles.code}>remotecon</code> in your terminal to start a session
        </p>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {sessions.map((s) => (
        <SessionCard key={s.id} session={s} onConnect={onConnect} />
      ))}
    </div>
  );
}

const styles = {
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  empty: { textAlign: 'center', padding: '48px 16px' },
  emptyText: { fontSize: 16, color: 'var(--fg-dim)', marginBottom: 8 },
  emptyHint: { fontSize: 13, color: 'var(--fg-dim)' },
  code: {
    fontFamily: 'monospace',
    background: 'var(--bg-highlight)',
    padding: '2px 6px',
    borderRadius: 4,
  },
};
