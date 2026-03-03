export default function LoginScreen() {
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>RemoteCon</h1>
        <p style={styles.subtitle}>Remote terminal control</p>
        {isMobile ? (
          <a href="/auth/google" style={styles.btn}>
            Sign in with Google
          </a>
        ) : (
          <div style={styles.desktop}>
            <p style={styles.hint}>Scan QR code with your phone to sign in</p>
            <div style={styles.qr}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}`}
                alt="QR Code"
                width={200}
                height={200}
              />
            </div>
            <p style={styles.or}>or</p>
            <a href="/auth/google" style={styles.btnSmall}>
              Sign in on this device
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: 24,
  },
  card: {
    textAlign: 'center',
    padding: '48px 32px',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    maxWidth: 360,
    width: '100%',
  },
  title: { fontSize: 28, fontWeight: 700, color: 'var(--blue)', marginBottom: 4 },
  subtitle: { fontSize: 14, color: 'var(--fg-dim)', marginBottom: 32 },
  btn: {
    display: 'inline-block',
    padding: '12px 32px',
    background: 'var(--blue)',
    color: '#fff',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    textDecoration: 'none',
  },
  desktop: {},
  hint: { fontSize: 13, color: 'var(--fg-dim)', marginBottom: 16 },
  qr: { marginBottom: 16 },
  or: { fontSize: 12, color: 'var(--fg-dim)', margin: '12px 0' },
  btnSmall: {
    display: 'inline-block',
    padding: '8px 20px',
    border: '1px solid var(--border)',
    color: 'var(--fg)',
    borderRadius: 6,
    fontSize: 13,
    textDecoration: 'none',
  },
};
