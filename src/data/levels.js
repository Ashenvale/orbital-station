// ---------------------------------------------------------------------------
// Campaña: 1 enemigo nuevo por nivel (acumulativo). Dos JEFES fijos:
//   · Nivel 5  = Jefe 1 (al vencerlo se desbloquea el Drone).
//   · Nivel 10 = Jefe 2 (al vencerlo se desbloquea el Agujero Negro).
// Los niveles de jefe NO presentan enemigo nuevo. El resto introduce un tipo
// en orden. Total = 14 tipos + 2 niveles de jefe = 16 niveles.
// La cuota X = exactamente X enemigos aparecen (sin spawn infinito).
// ---------------------------------------------------------------------------
import { t } from '../i18n.js';
import { enemyName } from './enemies.js';

// Orden de introducción (de más débil a más fuerte).
const ORDER = [
  'debris',
  'asteroid',
  'probe',
  'missile',
  'ship',
  'interceptor',
  'swarm',
  'bomb',
  'armored',
  'stealth',
  'berserker',
  'healer',
  'shielder',
  'carrier'
];

// Niveles de jefe (1-based): un jefe cada 5. Cada uno es un jefe DISTINTO.
const BOSS_LEVELS = new Set([5, 10, 15]);
const BOSS_IDS = ['boss_orbital', 'boss_siege', 'boss_warp'];
const TOTAL_LEVELS = ORDER.length + BOSS_LEVELS.size; // 14 + 3 = 17

function bossForLevel(n) {
  let i = 0;
  for (let k = 1; k <= n; k++) if (BOSS_LEVELS.has(k)) i++;
  return BOSS_IDS[(i - 1) % BOSS_IDS.length];
}

function makeLevel(n) {
  const isBoss = BOSS_LEVELS.has(n);
  const bossId = isBoss ? bossForLevel(n) : null;
  // Índice del tipo nuevo: cuenta solo niveles que NO son de jefe.
  let introIdx = 0;
  for (let k = 1; k < n; k++) if (!BOSS_LEVELS.has(k)) introIdx++;
  const introduced = isBoss ? bossId : ORDER[introIdx];
  // Pool acumulado: todos los tipos introducidos hasta aquí.
  const pool = [];
  for (let k = 1; k <= n; k++) {
    if (BOSS_LEVELS.has(k)) continue;
    let idx = 0;
    for (let j = 1; j < k; j++) if (!BOSS_LEVELS.has(j)) idx++;
    if (ORDER[idx] && !pool.includes(ORDER[idx])) pool.push(ORDER[idx]);
  }
  return {
    n,
    col: n % 2 === 0 ? 1 : 0, // zigzag del mapa estelar
    introduced,
    pool,
    boss: bossId,
    // Cuota = enemigos que aparecen en total (exacta). Crece con el stage.
    targetKills: Math.round(40 + n * 16),
    hpMul: +(0.7 + (n - 1) * 0.07).toFixed(3),
    speedMul: +(0.8 + (n - 1) * 0.035).toFixed(3),
    // Densidad: ARRANCA baja en Nv1 y sube claramente por stage.
    spawnMul: +(0.8 + (n - 1) * 0.13).toFixed(3),
    rampMul: +(0.45 + (n - 1) * 0.06).toFixed(3),
    get name() {
      return isBoss
        ? t('lv.boss', { n })
        : t('lv.tpl', { n, e: enemyName(introduced) });
    }
  };
}

export const LEVELS = [];
for (let n = 1; n <= TOTAL_LEVELS; n++) LEVELS.push(makeLevel(n));

export const LEVEL_BY_N = Object.fromEntries(LEVELS.map((l) => [l.n, l]));
