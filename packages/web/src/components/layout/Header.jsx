import { useAuth } from '../../hooks/useAuth';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Sessions' },
  { to: '/terminal', label: 'Terminal' },
  { to: '/recordings', label: 'Rec' },
  { to: '/webhooks', label: 'Hooks' },
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
          <button onClick={() => { if (window.confirm('로그아웃 하시겠습니까?')) logout(); }} style={styles.logoutBtn}>Logout</button>
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
    padding: '0 12px',
    height: 40,
    background: 'var(--bg-dark)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  left: { display: 'flex', alignItems: 'center', gap: 10 },
  logo: {
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--blue)',
    letterSpacing: 1,
  },
  nav: { display: 'flex', gap: 10 },
  link: {
    fontSize: 12,
    fontWeight: 500,
    transition: 'color 0.15s',
  },
  right: { display: 'flex', alignItems: 'center' },
  logoutBtn: {
    fontSize: 11,
    color: 'var(--fg-dim)',
    background: 'none',
    padding: '3px 6px',
    borderRadius: 4,
    border: '1px solid var(--border)',
  },
};
