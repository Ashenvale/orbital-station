// ---------------------------------------------------------------------------
// Música de fondo para los modos de juego. HTMLAudio singleton: sobrevive
// cambios de escena, volumen persistido. El botón de sonido (mute) silencia
// SFX + música (clave compartida 'os_muted').
//
// Robustez:
//  - El mp3 tiene silencio al principio: arrancamos/reloopeamos en MUSIC_START.
//  - Loop manual fiable: 'timeupdate' reentra un poco antes del final (sin
//    cola muda) y 'ended' como respaldo.
//  - Autoplay: si play() es bloqueado, se reintenta en el primer gesto del
//    usuario (pointer/keydown/touch) mientras se quiera reproducir.
// ---------------------------------------------------------------------------
const VOL_KEY = 'os_music_vol';
const MUTE_KEY = 'os_muted';
const TRACK = 'music/neon-underworld.mp3'; // servido desde public/
const MUSIC_START = 2.4; // salta el intro mudo
const CEIL = 0.4; // techo: música por debajo de los SFX

let audio = null;
let wantPlaying = false;
let muted = localStorage.getItem(MUTE_KEY) === '1';
let retryArmed = false;
let vol = (() => {
  const v = parseFloat(localStorage.getItem(VOL_KEY));
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
})();

function tryPlay() {
  if (!audio) return;
  const p = audio.play();
  if (p && p.catch) p.catch(() => armRetry());
}

// Reintenta arrancar en el primer gesto si el navegador bloqueó autoplay.
function armRetry() {
  if (retryArmed) return;
  retryArmed = true;
  const onGesture = () => {
    if (wantPlaying && !muted && audio && audio.paused) tryPlay();
  };
  window.addEventListener('pointerdown', onGesture);
  window.addEventListener('keydown', onGesture);
  window.addEventListener('touchstart', onGesture);
}

// Coloca el cabezal en una posición válida [MUSIC_START, fin).
function fixPos() {
  if (!audio) return;
  const d = audio.duration;
  if (audio.currentTime < MUSIC_START || (d && audio.currentTime >= d - 0.25)) {
    try {
      audio.currentTime = MUSIC_START;
    } catch (e) {
      /* sin metadata todavía: lo reintenta loadedmetadata */
    }
  }
}

function el() {
  if (audio) return audio;
  audio = new Audio(import.meta.env.BASE_URL + TRACK);
  audio.loop = false; // loop manual (saltando el intro mudo)
  audio.preload = 'auto';
  audio.volume = vol * CEIL;
  // Loop fiable: reentra ~0.2s antes del final.
  audio.addEventListener('timeupdate', () => {
    if (!wantPlaying || muted) return;
    const d = audio.duration;
    if (d && audio.currentTime >= d - 0.2) {
      audio.currentTime = MUSIC_START;
      if (audio.paused) tryPlay();
    }
  });
  // Respaldo por si 'timeupdate' no llega al final.
  audio.addEventListener('ended', () => {
    if (!wantPlaying || muted) return;
    audio.currentTime = MUSIC_START;
    tryPlay();
  });
  return audio;
}

function start() {
  const a = el();
  a.volume = vol * CEIL;
  if (a.readyState >= 1) fixPos();
  else a.addEventListener('loadedmetadata', fixPos, { once: true });
  if (a.paused) tryPlay();
  armRetry(); // siempre disponible por si un play() futuro es bloqueado
}

export const Music = {
  play() {
    wantPlaying = true;
    if (!muted) start();
  },
  stop() {
    wantPlaying = false;
    if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  },
  setMuted(m) {
    muted = !!m;
    if (muted) {
      if (audio && !audio.paused) audio.pause();
    } else if (wantPlaying) {
      start();
    }
  },
  isMuted() {
    return muted;
  },
  volume() {
    return vol;
  },
  setVolume(v) {
    vol = Math.min(1, Math.max(0, v));
    localStorage.setItem(VOL_KEY, String(vol));
    if (audio) audio.volume = vol * CEIL;
  }
};
