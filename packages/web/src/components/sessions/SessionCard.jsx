export default function SessionCard({ session, onConnect, onDelete }) {
  const age = timeSince(new Date(session.createdAt));

  return (
    <div style={styles.card}>
      <div style={styles.info}>
        <div style={styles.row}>
          <span
            style={{
              ...styles.dot,
              background: session.status === 'connected' ? 'var(--green)' : 'var(--yellow)',
            }}
          />
          <span style={styles.name}>{session.name}</span>
        </div>
        <div style={styles.meta}>
          {age} &middot; {session.viewers} viewer{session.viewers !== 1 ? 's' : ''}
        </div>
      </div>
      <div style={styles.actions}>
        <button style={styles.connectBtn} onClick={() => onConnect(session)}>
          Connect
        </button>
        <button style={styles.deleteBtn} onClick={() => onDelete(session.id)}>
          &times;
        </button>
      </div>
    </div>
  );
}

function timeSince(date) {
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const styles = {
  card: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
  },
  info: { flex: 1, minWidth: 0 },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  name: { fontSize: 14, fontWeight: 600, wordBreak: 'break-all', lineHeight: 1.4 },
  meta: { fontSize: 12, color: 'var(--fg-dim)', marginTop: 4 },
  actions: { display: 'flex', gap: 8, marginLeft: 12 },
  connectBtn: {
    fontSize: 12,
    padding: '6px 14px',
    borderRadius: 6,
    background: 'var(--blue)',
    color: '#fff',
    fontWeight: 600,
  },
  deleteBtn: {
    fontSize: 16,
    padding: '4px 8px',
    borderRadius: 6,
    background: 'none',
    color: 'var(--fg-dim)',
    border: '1px solid var(--border)',
  },
};
