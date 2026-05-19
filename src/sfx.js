// ---------------------------------------------------------------------------
// Efectos de sonido procedurales (WebAudio). Sin archivos: todo sintetizado.
// Estética arcade / synthwave-neon: osciladores detuneados, sweeps brillantes
// y clicks con cuerpo. Singleton compartido por todas las escenas.
// Mute persistido en localStorage ('os_muted', compartido con la música).
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
  master.gain.value = 0.55; // SFX por encima de la música de fondo
  // Un toque de "glue" arcade: leve saturación suave en el bus maestro.
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1024) * 2 - 1;
    curve[i] = Math.tanh(x * 1.6);
  }
  shaper.curve = curve;
  master.connect(shaper).connect(ctx.destination);
  // Reanuda tras el primer gesto (políticas de autoplay).
  const resume = () => ctx && ctx.state === 'suspended' && ctx.resume();
  document.addEventListener('pointerdown', resume);
  document.addEventListener('keydown', resume);
  return ctx;
}

// Oscilador con envolvente percusiva. `detune` apila una 2ª voz desafinada
// para el brillo neón.
function tone({ type = 'sine', f0, f1, t = 0.12, vol = 0.3, delay = 0, detune = 0 }) {
  const c = ac();
  if (!c) return;
  const start = c.currentTime + delay;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, start + t);
  g.connect(master);
  const voices = detune ? [-detune, detune] : [0];
  for (const dt of voices) {
    const o = c.createOscillator();
    o.type = type;
    o.detune.value = dt;
    o.frequency.setValueAtTime(f0, start);
    if (f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), start + t);
    o.connect(g);
    o.start(start);
    o.stop(start + t + 0.02);
  }
}

function noise({ t = 0.2, vol = 0.3, hp = 300, lp = 0, delay = 0 }) {
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
  let node = src.connect(f);
  if (lp) {
    const f2 = c.createBiquadFilter();
    f2.type = 'lowpass';
    f2.frequency.value = lp;
    node = node.connect(f2);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + t);
  node.connect(g).connect(master);
  src.start(start);
  src.stop(start + t);
}

// Arpegio rápido (notas en Hz) — usado para confirmaciones/estrellas.
function arp(freqs, { type = 'square', step = 0.06, t = 0.1, vol = 0.18, detune = 6 } = {}) {
  freqs.forEach((f, i) => tone({ type, f0: f, t, vol, delay: i * step, detune }));
}

const SOUNDS = {
  // -- Combate ---------------------------------------------------------------
  shoot: () => tone({ type: 'sawtooth', f0: 920, f1: 320, t: 0.07, vol: 0.14, detune: 8 }),
  hit: () => tone({ type: 'square', f0: 680, f1: 440, t: 0.04, vol: 0.11 }),
  explosion: () => {
    noise({ t: 0.26, vol: 0.34, hp: 220, lp: 3200 });
    tone({ type: 'sine', f0: 190, f1: 44, t: 0.26, vol: 0.24 });
    tone({ type: 'sawtooth', f0: 320, f1: 70, t: 0.16, vol: 0.12, detune: 10 });
  },
  nova: () => {
    tone({ type: 'sine', f0: 560, f1: 90, t: 0.42, vol: 0.24 });
    tone({ type: 'sawtooth', f0: 1120, f1: 220, t: 0.3, vol: 0.1, detune: 14 });
  },
  shieldbreak: () => {
    noise({ t: 0.32, vol: 0.34, hp: 160 });
    tone({ type: 'sawtooth', f0: 260, f1: 56, t: 0.32, vol: 0.2, detune: 12 });
  },
  damage: () => tone({ type: 'square', f0: 165, f1: 66, t: 0.13, vol: 0.22 }),

  // -- Progresión ------------------------------------------------------------
  levelup: () => arp([523, 659, 784, 1047], { step: 0.07, t: 0.13, vol: 0.19 }),
  win: () => arp([659, 880, 1047, 1319, 1568], { step: 0.09, t: 0.18, vol: 0.2 }),
  gameover: () => {
    tone({ type: 'sawtooth', f0: 420, f1: 70, t: 0.7, vol: 0.26, detune: 10 });
    tone({ type: 'sine', f0: 210, f1: 38, t: 0.95, vol: 0.2, delay: 0.05 });
  },
  star: () => arp([784, 1047, 1319], { type: 'triangle', step: 0.08, t: 0.16, vol: 0.2, detune: 4 }),
  coin: () => {
    tone({ type: 'square', f0: 988, t: 0.05, vol: 0.18 });
    tone({ type: 'square', f0: 1319, t: 0.12, vol: 0.18, delay: 0.05 });
  },

  // -- UI / navegación (arcade/neon) ----------------------------------------
  ui: () => tone({ type: 'sawtooth', f0: 540, f1: 1040, t: 0.07, vol: 0.16, detune: 10 }),
  tap: () => tone({ type: 'square', f0: 1200, f1: 1500, t: 0.035, vol: 0.12 }),
  hover: () => tone({ type: 'triangle', f0: 760, f1: 900, t: 0.035, vol: 0.07 }),
  select: () => arp([700, 1050], { type: 'sawtooth', step: 0.05, t: 0.09, vol: 0.16, detune: 10 }),
  back: () => tone({ type: 'sawtooth', f0: 720, f1: 360, t: 0.09, vol: 0.15, detune: 8 }),
  open: () => arp([480, 760], { type: 'triangle', step: 0.05, t: 0.1, vol: 0.15, detune: 6 }),
  close: () => {
    tone({ type: 'triangle', f0: 760, f1: 520, t: 0.06, vol: 0.13 });
    tone({ type: 'triangle', f0: 520, f1: 360, t: 0.08, vol: 0.13, delay: 0.05 });
  },
  error: () => {
    tone({ type: 'square', f0: 200, f1: 150, t: 0.16, vol: 0.2 });
    tone({ type: 'square', f0: 150, f1: 110, t: 0.18, vol: 0.18, delay: 0.08 });
  },
  tut: () => arp([880, 1175], { type: 'triangle', step: 0.07, t: 0.12, vol: 0.15, detune: 4 })
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
