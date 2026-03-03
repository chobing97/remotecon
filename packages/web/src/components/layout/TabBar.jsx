import { useTabStore } from '../../store/tabs';

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabStore();

  if (tabs.length === 0) return null;

  return (
    <div style={styles.bar}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          style={{
            ...styles.tab,
            ...(tab.id === activeTabId ? styles.active : {}),
          }}
          onClick={() => setActiveTab(tab.id)}
        >
          <span style={styles.name}>{tab.name}</span>
          <button
            style={styles.close}
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}

const styles = {
  bar: {
    display: 'flex',
    background: 'var(--bg-dark)',
    borderBottom: '1px solid var(--border)',
    overflowX: 'auto',
    flexShrink: 0,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    fontSize: 12,
    color: 'var(--fg-dim)',
    cursor: 'pointer',
    borderRight: '1px solid var(--border)',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  active: {
    color: 'var(--fg)',
    background: 'var(--bg)',
    borderBottom: '2px solid var(--blue)',
  },
  name: { overflow: 'hidden', textOverflow: 'ellipsis' },
  close: {
    background: 'none',
    color: 'inherit',
    fontSize: 14,
    lineHeight: 1,
    padding: '0 2px',
    opacity: 0.6,
  },
};
