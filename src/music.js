// ---------------------------------------------------------------------------
// Música de fondo (loop) para los modos de juego. HTMLAudio singleton:
// sobrevive cambios de escena, volumen persistido en localStorage.
// El botón de sonido (mute) silencia SFX y música a la vez: compartimos la
// misma clave 'os_muted' que usa sfx.js.
// ---------------------------------------------------------------------------
const VOL_KEY = 'os_music_vol';
const MUTE_KEY = 'os_muted';
const TRACK = 'music/neon-underworld.mp3'; // servido desde public/
// El mp3 trae unos segundos de silencio/intro. Arrancamos (y reloopeamos)
// desde aquí para que no haya hueco mudo. Ajustable a oído.
const MUSIC_START = 2.4;
// Techo: música SIEMPRE por debajo de los SFX. El slider (0..1) es relativo;
// el volumen real del audio = vol * CEIL.
const CEIL = 0.4;

let audio = null;
let wantPlaying = false; // un modo de juego pidió música
let muted = localStorage.getItem(MUTE_KEY) === '1';
let vol = (() => {
  const v = parseFloat(localStorage.getItem(VOL_KEY));
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
})();

function el() {
  if (audio) return audio;
  audio = new Audio(import.meta.env.BASE_URL + TRACK);
  audio.loop = false; // loop manual: reentra en MUSIC_START (sin silencio)
  audio.volume = vol * CEIL;
  audio.preload = 'auto';
  // Reloop saltando el silencio del principio.
  audio.addEventListener('ended', () => {
    if (!wantPlaying || muted) return;
    audio.currentTime = MUSIC_START;
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
  });
  return audio;
}

function start() {
  const a = el();
  a.volume = vol * CEIL;
  // Nunca reproducir el head mudo del track.
  const seek = () => {
    if (a.currentTime < MUSIC_START) {
      try {
        a.currentTime = MUSIC_START;
      } catch (e) {
        /* aún sin metadata: el listener lo reintenta */
      }
    }
  };
  if (a.readyState >= 1) seek();
  else a.addEventListener('loadedmetadata', seek, { once: true });
  if (a.paused) {
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  }
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
  // Lo invoca el botón de sonido: corta/reanuda la música junto con los SFX.
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
