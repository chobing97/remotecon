import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { xtermTheme } from '../styles/theme';
import { api } from '../api/client';

export default function RecordingPlayerPage() {
  const { id } = useParams();
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const framesRef = useRef([]);
  const timerRef = useRef(null);
  const frameIdxRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const term = new Terminal({
      theme: xtermTheme,
      fontFamily: "'Fira Code', 'Cascadia Code', Menlo, monospace",
      fontSize: 14,
      disableStdin: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    loadRecording();

    const onResize = () => fitAddon.fit();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(timerRef.current);
      term.dispose();
    };
  }, [id]);

  const loadRecording = async () => {
    try {
      const buf = await api.getRecordingData(id);
      const ds = new DecompressionStream('gzip');
      const reader = new Blob([buf]).stream().pipeThrough(ds).getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      const lines = text.trim().split('\n');
      const header = JSON.parse(lines[0]);
      const frames = lines.slice(1).map((l) => JSON.parse(l));
      framesRef.current = frames;
      const lastFrame = frames[frames.length - 1];
      setDuration(lastFrame ? lastFrame[0] * 1000 : 0);
    } catch (err) {
      console.error('Failed to load recording:', err);
    } finally {
      setLoading(false);
    }
  };

  const play = useCallback(() => {
    setPlaying(true);
    scheduleFrame();
  }, [speed]);

  const pause = useCallback(() => {
    setPlaying(false);
    clearTimeout(timerRef.current);
  }, []);

  const scheduleFrame = useCallback(() => {
    const frames = framesRef.current;
    const idx = frameIdxRef.current;
    if (idx >= frames.length) {
      setPlaying(false);
      return;
    }

    const frame = frames[idx];
    const prevTime = idx > 0 ? frames[idx - 1][0] : 0;
    const delay = Math.max(0, (frame[0] - prevTime) * 1000) / speed;

    timerRef.current = setTimeout(() => {
      if (frame[1] === 'o') {
        termRef.current?.write(frame[2]);
      }
      frameIdxRef.current = idx + 1;
      setProgress(frame[0] * 1000);
      scheduleFrame();
    }, delay);
  }, [speed]);

  const reset = useCallback(() => {
    pause();
    termRef.current?.reset();
    frameIdxRef.current = 0;
    setProgress(0);
  }, [pause]);

  const togglePlay = () => {
    if (playing) pause();
    else play();
  };

  if (loading) return <div style={styles.loading}>Loading recording...</div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <Link to="/recordings" style={styles.back}>&larr; Recordings</Link>
      </div>
      <div ref={containerRef} style={styles.terminal} />
      <div style={styles.controls}>
        <button onClick={togglePlay} style={styles.btn}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button onClick={reset} style={styles.btn}>Reset</button>
        <input
          type="range"
          min={0}
          max={duration}
          value={progress}
          style={styles.slider}
          readOnly
        />
        <span style={styles.time}>{formatMs(progress)} / {formatMs(duration)}</span>
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          style={styles.select}
        >
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>
      </div>
    </div>
  );
}

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: { padding: '8px 16px', flexShrink: 0 },
  back: { fontSize: 13, color: 'var(--blue)' },
  terminal: { flex: 1, overflow: 'hidden' },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    background: 'var(--bg-dark)',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  btn: {
    fontSize: 12,
    padding: '4px 12px',
    borderRadius: 4,
    background: 'var(--bg-highlight)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
  },
  slider: { flex: 1, height: 4 },
  time: { fontSize: 11, color: 'var(--fg-dim)', whiteSpace: 'nowrap' },
  select: {
    fontSize: 12,
    padding: '2px 4px',
    background: 'var(--bg-highlight)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
    borderRadius: 4,
  },
  loading: { padding: 32, textAlign: 'center', color: 'var(--fg-dim)' },
};
