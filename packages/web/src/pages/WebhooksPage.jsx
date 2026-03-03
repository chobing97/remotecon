import { useState, useEffect } from 'react';
import { api } from '../api/client';

const PRESETS = [
  { label: 'Error', pattern: '(?i)error|exception|fatal' },
  { label: 'Build done', pattern: '(?:build|compile).*(?:success|done|complete)' },
  { label: 'Test result', pattern: '(?:Tests?|PASS|FAIL).*\\d+' },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', pattern: '', url: '', session_filter: '' });
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    api.getWebhooks()
      .then(setWebhooks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { ...form, session_filter: form.session_filter || null };
    if (editing) {
      const updated = await api.updateWebhook(editing, data);
      setWebhooks((prev) => prev.map((w) => (w.id === editing ? updated : w)));
    } else {
      const created = await api.createWebhook(data);
      setWebhooks((prev) => [...prev, created]);
    }
    resetForm();
  };

  const handleEdit = (wh) => {
    setForm({ name: wh.name, pattern: wh.pattern, url: wh.url, session_filter: wh.session_filter || '' });
    setEditing(wh.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    await api.deleteWebhook(id);
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  const resetForm = () => {
    setForm({ name: '', pattern: '', url: '', session_filter: '' });
    setEditing(null);
    setShowForm(false);
  };

  if (loading) return <div style={styles.loading}>Loading...</div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>Webhooks</h2>
        <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            style={styles.input}
          />
          <div style={styles.patternRow}>
            <input
              placeholder="Regex pattern"
              value={form.pattern}
              onChange={(e) => setForm({ ...form, pattern: e.target.value })}
              required
              style={{ ...styles.input, flex: 1 }}
            />
            <div style={styles.presets}>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setForm({ ...form, pattern: p.pattern, name: form.name || p.label })}
                  style={styles.presetBtn}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <input
            placeholder="Webhook URL"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            required
            style={styles.input}
          />
          <input
            placeholder="Session filter (optional, session name regex)"
            value={form.session_filter}
            onChange={(e) => setForm({ ...form, session_filter: e.target.value })}
            style={styles.input}
          />
          <button type="submit" style={styles.submitBtn}>
            {editing ? 'Update' : 'Create'}
          </button>
        </form>
      )}

      {webhooks.length === 0 && !showForm ? (
        <div style={styles.empty}>No webhooks configured</div>
      ) : (
        <div style={styles.list}>
          {webhooks.map((wh) => (
            <div key={wh.id} style={styles.card}>
              <div style={styles.info}>
                <div style={styles.nameRow}>
                  <span style={{
                    ...styles.dot,
                    background: wh.enabled ? 'var(--green)' : 'var(--fg-dim)',
                  }} />
                  <span style={styles.name}>{wh.name}</span>
                </div>
                <div style={styles.meta}>
                  <code style={styles.code}>{wh.pattern}</code>
                  {wh.session_filter && <span> &middot; filter: {wh.session_filter}</span>}
                </div>
                <div style={styles.url}>{wh.url}</div>
              </div>
              <div style={styles.actions}>
                <button onClick={() => handleEdit(wh)} style={styles.editBtn}>Edit</button>
                <button onClick={() => handleDelete(wh.id)} style={styles.deleteBtn}>&times;</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { padding: 16, overflowY: 'auto', height: '100%' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: 700 },
  addBtn: {
    fontSize: 12, padding: '6px 14px', borderRadius: 6,
    background: 'var(--blue)', color: '#fff', fontWeight: 600,
  },
  loading: { padding: 32, textAlign: 'center', color: 'var(--fg-dim)' },
  empty: { textAlign: 'center', padding: '48px 16px', color: 'var(--fg-dim)' },
  form: {
    display: 'flex', flexDirection: 'column', gap: 8,
    padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', marginBottom: 16,
  },
  input: {
    padding: '8px 12px', fontSize: 13, background: 'var(--bg)',
    color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6,
  },
  patternRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  presets: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  presetBtn: {
    fontSize: 11, padding: '2px 8px', borderRadius: 4,
    background: 'var(--bg-highlight)', color: 'var(--fg-dim)',
    border: '1px solid var(--border)',
  },
  submitBtn: {
    padding: '8px 16px', fontSize: 13, borderRadius: 6,
    background: 'var(--green)', color: '#fff', fontWeight: 600, alignSelf: 'flex-start',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '12px 16px', background: 'var(--bg-surface)',
    borderRadius: 'var(--radius)', border: '1px solid var(--border)',
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  name: { fontSize: 14, fontWeight: 600 },
  meta: { fontSize: 12, color: 'var(--fg-dim)', marginTop: 4 },
  code: { fontFamily: 'monospace', background: 'var(--bg-highlight)', padding: '1px 4px', borderRadius: 3 },
  url: { fontSize: 11, color: 'var(--fg-dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  actions: { display: 'flex', gap: 6, marginLeft: 12 },
  editBtn: {
    fontSize: 12, padding: '4px 10px', borderRadius: 6,
    background: 'none', color: 'var(--fg-dim)', border: '1px solid var(--border)',
  },
  deleteBtn: {
    fontSize: 16, padding: '4px 8px', borderRadius: 6,
    background: 'none', color: 'var(--fg-dim)', border: '1px solid var(--border)', cursor: 'pointer',
  },
};
