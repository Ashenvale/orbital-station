// ---------------------------------------------------------------------------
// Catálogo de habilidades (stats numéricos aquí; textos en i18n por id).
// Progresión 7 niveles: Nv1 nuevo · Nv2-4 mejoras · Nv5-7 ESPECIALES.
// ---------------------------------------------------------------------------
import { t } from '../i18n.js';

export const MAX_LEVEL = 7;
export const NORMAL_LEVELS = 4;
export const SPECIAL_COUNT = 3;
export const ROMAN = ['I', 'II', 'III'];

export const isSpecial = (lv) => lv >= 5;
export const specialIndex = (lv) => lv - 5;
export const levelLabel = (lv) =>
  lv === 1
    ? t('ui.tag_new')
    : isSpecial(lv)
      ? t('ui.lvl_sp', { r: ROMAN[specialIndex(lv)] })
      : t('ui.lvl_up', { n: lv });

// id, color, levels (stats) y P(s) = params para la plantilla de desc.
const RAW = [
  {
    id: 'dual_cannon',
    color: 0xfff07a,
    levels: [
      { projectiles: 1, damage: 7, cooldownMs: 560, range: 170, pierce: 0 },
      { projectiles: 2, damage: 9, cooldownMs: 520, range: 185, pierce: 0 },
      { projectiles: 2, damage: 12, cooldownMs: 470, range: 200, pierce: 0 },
      { projectiles: 3, damage: 15, cooldownMs: 420, range: 215, pierce: 0 },
      { projectiles: 3, damage: 18, cooldownMs: 400, range: 230, pierce: 2 },
      { projectiles: 5, damage: 22, cooldownMs: 340, range: 230, pierce: 3 },
      { projectiles: 7, damage: 28, cooldownMs: 260, range: 230, pierce: 5 }
    ],
    P: (s) => ({ p: s.projectiles, d: s.damage, cd: (s.cooldownMs / 1000).toFixed(2) })
  },
  {
    id: 'homing_missiles',
    color: 0xff7a59,
    levels: [
      { cooldownMs: 1700, count: 1, damage: 14, splits: 0, range: 260, field: false },
      { cooldownMs: 1450, count: 1, damage: 20, splits: 0, range: 300, field: false },
      { cooldownMs: 1150, count: 2, damage: 26, splits: 0, range: 340, field: false },
      { cooldownMs: 850, count: 2, damage: 34, splits: 0, range: 390, field: false },
      { cooldownMs: 850, count: 2, damage: 40, splits: 0, range: 9999, field: false },
      { cooldownMs: 700, count: 3, damage: 46, splits: 3, range: 9999, field: false },
      { cooldownMs: 600, count: 3, damage: 54, splits: 3, range: 9999, field: true }
    ],
    P: (s) => ({ c: s.count, cd: (s.cooldownMs / 1000).toFixed(2), d: s.damage, r: s.range })
  },
  {
    id: 'orbital_ring',
    color: 0xc792ff,
    levels: [
      { orbs: 2, damage: 7, radius: 64, speed: 2.4, pulse: false, pulseR: 0 },
      { orbs: 3, damage: 9, radius: 70, speed: 2.7, pulse: false, pulseR: 0 },
      { orbs: 4, damage: 12, radius: 76, speed: 3.0, pulse: false, pulseR: 0 },
      { orbs: 5, damage: 16, radius: 84, speed: 3.3, pulse: false, pulseR: 0 },
      { orbs: 5, damage: 18, radius: 88, speed: 3.4, pulse: true, pulseR: 46 },
      { orbs: 7, damage: 22, radius: 98, speed: 3.8, pulse: true, pulseR: 62 },
      { orbs: 8, damage: 28, radius: 108, speed: 4.2, pulse: true, pulseR: 92 }
    ],
    P: (s) => ({ o: s.orbs, d: s.damage, r: s.radius })
  },
  {
    id: 'nova_pulse',
    color: 0x6fe3ff,
    levels: [
      { cooldownMs: 3600, radius: 120, damage: 18, slowMs: 0, double: false },
      { cooldownMs: 3100, radius: 140, damage: 26, slowMs: 0, double: false },
      { cooldownMs: 2600, radius: 160, damage: 36, slowMs: 0, double: false },
      { cooldownMs: 2100, radius: 185, damage: 48, slowMs: 0, double: false },
      { cooldownMs: 1900, radius: 200, damage: 56, slowMs: 1200, double: false },
      { cooldownMs: 1600, radius: 225, damage: 70, slowMs: 1500, double: false },
      { cooldownMs: 1400, radius: 245, damage: 84, slowMs: 1500, double: true }
    ],
    P: (s) => ({ cd: (s.cooldownMs / 1000).toFixed(1), r: s.radius, d: s.damage })
  },
  {
    id: 'laser_beam',
    color: 0xff4f86,
    // Daño MUCHO menor + ciclo de trabajo (onMs activo / offMs apagado).
    levels: [
      { dps: 16, onMs: 1200, offMs: 1500, range: 260, pierceAll: false, beams: 1 },
      { dps: 20, onMs: 1300, offMs: 1300, range: 300, pierceAll: false, beams: 1 },
      { dps: 26, onMs: 1400, offMs: 1200, range: 340, pierceAll: false, beams: 1 },
      { dps: 34, onMs: 1500, offMs: 1100, range: 380, pierceAll: false, beams: 1 },
      { dps: 42, onMs: 1600, offMs: 1000, range: 420, pierceAll: true, beams: 1 },
      { dps: 54, onMs: 1800, offMs: 900, range: 460, pierceAll: true, beams: 2 },
      { dps: 72, onMs: 2200, offMs: 700, range: 9999, pierceAll: true, beams: 3 }
    ],
    P: (s) => ({
      d: s.dps,
      r: s.range,
      on: (s.onMs / 1000).toFixed(1),
      off: (s.offMs / 1000).toFixed(1)
    })
  },
  {
    id: 'regen_shield',
    color: 0x49f2c2,
    levels: [
      { shieldMax: 30, regenPerSec: 4, burst: 0, reflect: false },
      { shieldMax: 50, regenPerSec: 6, burst: 0, reflect: false },
      { shieldMax: 75, regenPerSec: 9, burst: 0, reflect: false },
      { shieldMax: 110, regenPerSec: 13, burst: 0, reflect: false },
      { shieldMax: 140, regenPerSec: 15, burst: 70, reflect: false },
      { shieldMax: 180, regenPerSec: 19, burst: 90, reflect: false },
      { shieldMax: 230, regenPerSec: 24, burst: 110, reflect: true }
    ],
    P: (s) => ({ s: s.shieldMax, rg: s.regenPerSec })
  }
];

function build(a) {
  return {
    id: a.id,
    color: a.color,
    levels: a.levels,
    get name() {
      return t(`ab.${a.id}.name`);
    },
    get short() {
      return t(`ab.${a.id}.short`);
    },
    get blurb() {
      return t(`ab.${a.id}.blurb`);
    },
    get specials() {
      return [t(`ab.${a.id}.s1`), t(`ab.${a.id}.s2`), t(`ab.${a.id}.s3`)];
    },
    desc(lv) {
      if (isSpecial(lv)) return t(`ab.${a.id}.s${specialIndex(lv) + 1}`);
      if (lv === 1) return t(`ab.${a.id}.blurb`);
      return t(`ab.${a.id}.desc`, a.P(a.levels[lv - 1]));
    }
  };
}

export const ABILITIES = RAW.map(build);
export const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
