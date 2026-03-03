import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRecordings()
      .then(setRecordings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    await api.deleteRecording(id);
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  };

  if (loading) return <div style={styles.loading}>Loading...</div>;

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>Recordings</h2>
      {recordings.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>No recordings yet</p>
          <p style={styles.emptyHint}>
            Start a session with <code style={styles.code}>remotecon --record</code>
          </p>
        </div>
      ) : (
        <div style={styles.list}>
          {recordings.map((r) => (
            <div key={r.id} style={styles.card}>
              <div style={styles.info}>
                <span style={styles.name}>{r.name}</span>
                <span style={styles.meta}>
                  {new Date(r.created_at).toLocaleDateString()} &middot;{' '}
                  {formatDuration(r.duration_ms)} &middot;{' '}
                  {formatBytes(r.size_bytes)}
                </span>
              </div>
              <div style={styles.actions}>
                <a href={`/recordings/${r.id}`} style={styles.playBtn}>Play</a>
                <button onClick={() => handleDelete(r.id)} style={styles.deleteBtn}>&times;</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(ms) {
  if (!ms) return '0s';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = {
  page: { padding: 16, overflowY: 'auto', height: '100%' },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 16 },
  loading: { padding: 32, textAlign: 'center', color: 'var(--fg-dim)' },
  empty: { textAlign: 'center', padding: '48px 16px' },
  emptyText: { fontSize: 16, color: 'var(--fg-dim)', marginBottom: 8 },
  emptyHint: { fontSize: 13, color: 'var(--fg-dim)' },
  code: { fontFamily: 'monospace', background: 'var(--bg-highlight)', padding: '2px 6px', borderRadius: 4 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
  },
  info: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  name: { fontSize: 14, fontWeight: 600 },
  meta: { fontSize: 12, color: 'var(--fg-dim)' },
  actions: { display: 'flex', gap: 8, marginLeft: 12 },
  playBtn: {
    fontSize: 12,
    padding: '6px 14px',
    borderRadius: 6,
    background: 'var(--green)',
    color: '#fff',
    fontWeight: 600,
    textDecoration: 'none',
  },
  deleteBtn: {
    fontSize: 16,
    padding: '4px 8px',
    borderRadius: 6,
    background: 'none',
    color: 'var(--fg-dim)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
  },
};
