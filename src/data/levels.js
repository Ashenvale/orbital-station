// ---------------------------------------------------------------------------
// Campaña: 1 enemigo nuevo por nivel (acumulativo).
//   Nv1 = [tipo1] · Nv2 = [tipo1,tipo2] · ... y un nivel final con el JEFE.
// Dificultad escala suave con n. Textos de nombre vienen de i18n.
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

const BOSS_LEVEL = ORDER.length + 1; // último nivel = todos + jefe

function makeLevel(n) {
  const isBoss = n === BOSS_LEVEL;
  const introduced = isBoss ? 'boss_core' : ORDER[n - 1];
  const pool = isBoss ? [...ORDER] : ORDER.slice(0, n);
  return {
    n,
    col: n % 2 === 0 ? 1 : 0, // zigzag del mapa estelar
    introduced,
    pool,
    boss: isBoss ? 'boss_core' : null,
    targetKills: Math.round(16 + n * 7),
    hpMul: +(0.7 + (n - 1) * 0.07).toFixed(3),
    speedMul: +(0.8 + (n - 1) * 0.035).toFixed(3),
    spawnMul: +(0.6 + (n - 1) * 0.06).toFixed(3),
    rampMul: +(0.45 + (n - 1) * 0.06).toFixed(3),
    get name() {
      return isBoss
        ? t('lv.boss', { n })
        : t('lv.tpl', { n, e: enemyName(introduced) });
    }
  };
}

export const LEVELS = [];
for (let n = 1; n <= BOSS_LEVEL; n++) LEVELS.push(makeLevel(n));

export const LEVEL_BY_N = Object.fromEntries(LEVELS.map((l) => [l.n, l]));
