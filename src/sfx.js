// ---------------------------------------------------------------------------
// Efectos de sonido procedurales (WebAudio). Sin archivos: todo sintetizado.
// Singleton compartido por todas las escenas. Mute persistido en localStorage.
// ---------------------------------------------------------------------------

let ctx = null;
let master = null;
let muted = localStorage.getItem('os_muted') === '1';

function ac() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  // Reanuda tras el primer gesto (políticas de autoplay).
  const resume = () => ctx && ctx.state === 'suspended' && ctx.resume();
  document.addEventListener('pointerdown', resume);
  document.addEventListener('keydown', resume);
  return ctx;
}

function tone({ type = 'sine', f0, f1, t = 0.12, vol = 0.3, delay = 0 }) {
  const c = ac();
  if (!c) return;
  const start = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, start);
  if (f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), start + t);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + t);
  o.connect(g).connect(master);
  o.start(start);
  o.stop(start + t + 0.02);
}

function noise({ t = 0.2, vol = 0.3, hp = 300, delay = 0 }) {
  const c = ac();
  if (!c) return;
  const start = c.currentTime + delay;
  const n = Math.floor(c.sampleRate * t);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + t);
  src.connect(f).connect(g).connect(master);
  src.start(start);
  src.stop(start + t);
}

const SOUNDS = {
  shoot: () => tone({ type: 'triangle', f0: 880, f1: 360, t: 0.07, vol: 0.16 }),
  hit: () => tone({ type: 'square', f0: 620, f1: 420, t: 0.04, vol: 0.12 }),
  explosion: () => {
    noise({ t: 0.22, vol: 0.32, hp: 250 });
    tone({ type: 'sine', f0: 180, f1: 50, t: 0.22, vol: 0.22 });
  },
  levelup: () => {
    tone({ type: 'square', f0: 520, t: 0.09, vol: 0.18 });
    tone({ type: 'square', f0: 700, t: 0.09, vol: 0.18, delay: 0.09 });
    tone({ type: 'square', f0: 940, t: 0.14, vol: 0.2, delay: 0.18 });
  },
  nova: () => tone({ type: 'sine', f0: 520, f1: 90, t: 0.4, vol: 0.26 }),
  shieldbreak: () => {
    noise({ t: 0.3, vol: 0.34, hp: 180 });
    tone({ type: 'sawtooth', f0: 240, f1: 60, t: 0.3, vol: 0.2 });
  },
  damage: () => tone({ type: 'square', f0: 150, f1: 70, t: 0.12, vol: 0.22 }),
  gameover: () => {
    tone({ type: 'sawtooth', f0: 400, f1: 70, t: 0.7, vol: 0.28 });
    tone({ type: 'sine', f0: 200, f1: 40, t: 0.9, vol: 0.2, delay: 0.05 });
  },
  ui: () => tone({ type: 'triangle', f0: 660, f1: 880, t: 0.06, vol: 0.16 }),
  win: () => {
    tone({ type: 'square', f0: 600, t: 0.1, vol: 0.2 });
    tone({ type: 'square', f0: 800, t: 0.1, vol: 0.2, delay: 0.1 });
    tone({ type: 'square', f0: 1100, t: 0.2, vol: 0.22, delay: 0.2 });
  }
};

export const Sfx = {
  play(name) {
    if (muted) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    try {
      fn();
    } catch (e) {
      /* audio no disponible: silencioso */
    }
  },
  toggleMute() {
    muted = !muted;
    localStorage.setItem('os_muted', muted ? '1' : '0');
    return muted;
  },
  isMuted() {
    return muted;
  }
};
