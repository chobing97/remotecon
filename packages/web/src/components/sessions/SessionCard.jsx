export default function SessionCard({ session, onConnect }) {
  const age = timeSince(new Date(session.createdAt));
  const isDisconnected = session.status !== 'connected';

  return (
    <div style={styles.card} onClick={() => onConnect(session)}>
      <div style={styles.row}>
        <span
          style={{
            ...styles.dot,
            background: isDisconnected ? 'var(--orange)' : 'var(--green)',
            animation: isDisconnected ? 'blink 1s infinite' : 'none',
          }}
        />
        <span style={styles.name}>{session.name}</span>
      </div>
      <div style={styles.meta}>
        {age} &middot; {session.viewers} viewer{session.viewers !== 1 ? 's' : ''}
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
    flexDirection: 'column',
    gap: 4,
    padding: '12px 16px',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
  },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  name: { fontSize: 14, fontWeight: 600, wordBreak: 'break-all', lineHeight: 1.4 },
  meta: { fontSize: 12, color: 'var(--fg-dim)', marginLeft: 16 },
};
