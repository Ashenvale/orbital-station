// ---------------------------------------------------------------------------
// Constantes de balance del prototipo. Todo lo "tuneable" vive aqui para que
// iterar el game-feel no obligue a tocar la logica.
// ---------------------------------------------------------------------------

// Resolucion logica en retrato (9:16 aprox de telefono). Phaser escala con FIT
// para que se vea igual en cualquier pantalla.
export const GAME_W = 480;
export const GAME_H = 854;

// Tope GLOBAL de alcance de cualquier arma: el círculo de rango cabe entero
// en pantalla (no "rango infinito" ni objetivos fuera de cuadro). Ninguna
// habilidad ni upgrade puede superar esto.
export const MAX_RANGE = Math.round(Math.min(GAME_W, GAME_H) / 2) - 10; // 230

// Paleta holografica: cian/teal dominante, acentos de neon.
export const COLORS = {
  bg: 0x02030a,
  grid: 0x0e3a52,
  nebula: 0x123a6b,
  station: 0x49e8ff,
  stationCore: 0xeaffff,
  shield: 0x49f2c2,
  bullet: 0x9ff6ff,
  missile: 0xff9d5c,
  orb: 0xc792ff,
  laser: 0xff4f86,
  nova: 0x6fe3ff,
  xp: 0x7affc4,
  enemyAsteroid: 0x7fd0c0,
  enemyMissile: 0xff6b6b,
  enemyShip: 0x6fb3ff
};

export const STATION = {
  radius: 24,
  maxHp: 100,
  // Arma base, siempre activa (no ocupa slot de habilidad).
  // Solo adquiere blancos DENTRO de `range` (anillo holografico visible).
  baseWeapon: {
    damage: 8,
    cooldownMs: 620,
    projectiles: 1,
    projectileSpeed: 420,
    range: 150 // alcance inicial acotado; Cañón Múltiple lo sube hasta MAX_RANGE
  }
};

export const ABILITY_SLOTS = 4; // habilidades drafteables por partida

// Curva de XP: XP para pasar de nivel N a N+1. Empinada a propósito para que
// subir de nivel cueste ~10+ bajas (no 2-3) y se sienta ganado.
// Calibrado: ~3 escombros (4 xp c/u = 12) suben el primer nivel.
export const xpToNext = (level) => Math.round(6 + level * level * 2 + level * 4);

// Enemigos. speed en px/s hacia el centro. xp = experiencia al destruirlo.
export const ENEMIES = {
  asteroid: { hp: 40, speed: 26, contactDmg: 12, xp: 4, radius: 23 },
  missile: { hp: 10, speed: 78, contactDmg: 18, xp: 2, radius: 12 },
  ship: { hp: 24, speed: 44, contactDmg: 15, xp: 6, radius: 17 }
};

// Dificultad: cada STEP segundos el juego se endurece un escalon.
export const DIFFICULTY = {
  stepSeconds: 14,
  spawnIntervalStartMs: 1150,
  spawnIntervalMinMs: 320,
  spawnIntervalDecay: 0.9, // se multiplica por escalon
  enemyHpGrowth: 1.13, // se multiplica por escalon
  // Pesos de aparicion por tipo, segun el escalon de dificultad alcanzado.
  weights: [
    { until: 1, asteroid: 0.8, missile: 0.2, ship: 0.0 },
    { until: 3, asteroid: 0.6, missile: 0.3, ship: 0.1 },
    { until: 6, asteroid: 0.45, missile: 0.35, ship: 0.2 },
    { until: 999, asteroid: 0.35, missile: 0.35, ship: 0.3 }
  ]
};
