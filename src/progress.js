// Progreso de campaña persistido en localStorage.
//  - os_progress : número del nivel más alto COMPLETADO (0 = ninguno).
//  - os_stars    : { levelNum: estrellas (1-3) reclamadas } — cada estrella
//                  otorga su oro UNA sola vez.
import { LEVELS } from './data/levels.js';

const KEY = 'os_progress';
const KEY_STARS = 'os_stars';

// Oro por estrella (índice = nº de estrella). Acumulativo y una sola vez.
export const STAR_GOLD = [0, 150, 300, 600];

function loadStars() {
  try {
    return JSON.parse(localStorage.getItem(KEY_STARS) || '{}') || {};
  } catch (e) {
    return {};
  }
}
let stars = loadStars();

export const Progress = {
  completed() {
    return parseInt(localStorage.getItem(KEY) || '0', 10) || 0;
  },
  complete(n) {
    if (n > this.completed()) localStorage.setItem(KEY, String(n));
  },
  isUnlocked(n) {
    return n === 1 || n <= this.completed() + 1;
  },
  isCleared(n) {
    return n <= this.completed();
  },
  nextLevel(n) {
    const next = n + 1;
    return next <= LEVELS.length ? next : null;
  },

  // Estrellas ya reclamadas de un nivel (0..3).
  stars(n) {
    return stars[n] || 0;
  },

  // Registra `s` estrellas para el nivel `n`. Devuelve el oro ganado por las
  // estrellas NUEVAS (cada estrella se cobra una sola vez).
  claimStars(n, s) {
    const cur = stars[n] || 0;
    if (s <= cur) return { gained: 0, gold: 0, total: cur, best: cur };
    let gold = 0;
    for (let i = cur + 1; i <= s; i++) gold += STAR_GOLD[i] || 0;
    stars[n] = s;
    localStorage.setItem(KEY_STARS, JSON.stringify(stars));
    return { gained: s - cur, gold, total: s, best: s };
  },

  reset() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_STARS);
    stars = {};
  }
};
