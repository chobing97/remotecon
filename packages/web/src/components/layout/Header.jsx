import { useAuth } from '../../hooks/useAuth';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Sessions' },
  { to: '/terminal', label: 'Terminal' },
  { to: '/recordings', label: 'Recordings' },
  { to: '/webhooks', label: 'Webhooks' },
];

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <span style={styles.logo}>RC</span>
        <nav style={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({
                ...styles.link,
                color: isActive ? 'var(--blue)' : 'var(--fg-dim)',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      {user && (
        <div style={styles.right}>
          <span style={styles.name}>{user.name}</span>
          <button onClick={logout} style={styles.logoutBtn}>Logout</button>
        </div>
      )}
    </header>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    height: 48,
    background: 'var(--bg-dark)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  left: { display: 'flex', alignItems: 'center', gap: 16 },
  logo: {
    fontWeight: 700,
    fontSize: 16,
    color: 'var(--blue)',
    letterSpacing: 1,
  },
  nav: { display: 'flex', gap: 12 },
  link: {
    fontSize: 13,
    fontWeight: 500,
    transition: 'color 0.15s',
  },
  right: { display: 'flex', alignItems: 'center', gap: 12 },
  name: { fontSize: 12, color: 'var(--fg-dim)' },
  logoutBtn: {
    fontSize: 12,
    color: 'var(--fg-dim)',
    background: 'none',
    padding: '4px 8px',
    borderRadius: 4,
    border: '1px solid var(--border)',
  },
};
