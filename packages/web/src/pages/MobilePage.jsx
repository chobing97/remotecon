export default function MobilePage() {
  const url = window.location.origin;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Mobile Access</h2>
        <p style={styles.desc}>Scan QR code with your phone to control terminals remotely</p>
        <div style={styles.qr}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`}
            alt="QR Code"
            width={200}
            height={200}
          />
        </div>
        <p style={styles.url}>{url}</p>
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
    padding: '36px 32px',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    maxWidth: 360,
    width: '100%',
  },
  title: { fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 },
  desc: { fontSize: 13, color: 'var(--fg-dim)', marginBottom: 24 },
  qr: { marginBottom: 16 },
  url: { fontSize: 12, color: 'var(--fg-dim)', wordBreak: 'break-all' },
};
