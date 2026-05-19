// ---------------------------------------------------------------------------
// Sistema de tipos v0.7: cada enemigo tiene un ARQUETIPO con tipos a los que es
// DÉBIL (recibe ×1.5) y a los que RESISTE (recibe ×0.5). Rompe el combo único.
// Tipos de daño: kinetic, explosive, energy, elemental, gravity.
// (compat: 'laser' del código viejo se trata como 'energy').
// ---------------------------------------------------------------------------
import { t } from '../i18n.js';

const TYPE_NORM = { laser: 'energy' };
const norm = (ty) => TYPE_NORM[ty] || ty;

export const TYPE_COLOR = {
  kinetic: 0xfff07a,
  explosive: 0xff7a59,
  energy: 0xff4f86,
  elemental: 0x6fe3ff,
  gravity: 0xb36bff
};

// Arquetipo: weak[] recibe ×1.5 ; resist[] recibe ×0.5.
const ARCH = {
  caza: { weak: ['kinetic', 'explosive'], resist: ['elemental'] },
  blindado: { weak: ['energy', 'gravity'], resist: ['kinetic'] },
  enjambre: { weak: ['explosive', 'elemental'], resist: ['energy'] },
  volador: { weak: ['kinetic', 'energy'], resist: ['explosive'] },
  fase: { weak: ['elemental', 'gravity'], resist: ['kinetic', 'energy'] },
  jefe: { weak: ['energy'], resist: ['kinetic'] }
};

export const ENEMY_ARCH = {
  debris: 'caza',
  asteroid: 'blindado',
  missile: 'volador',
  ship: 'caza',
  probe: 'volador',
  drone: 'enjambre',
  swarm: 'enjambre',
  armored: 'blindado',
  interceptor: 'volador',
  bomb: 'caza',
  healer: 'enjambre',
  shielder: 'fase',
  stealth: 'fase',
  berserker: 'blindado',
  carrier: 'blindado',
  boss_core: 'jefe'
};

const archOf = (id) => ARCH[ENEMY_ARCH[id]] || ARCH.caza;

// Multiplicador de daño de `type` sobre el enemigo `id`. ±50%.
export function resistMul(id, type) {
  const ty = norm(type);
  const a = archOf(id);
  if (a.weak.includes(ty)) return 1.5;
  if (a.resist.includes(ty)) return 0.5;
  return 1;
}

// Color del aura = primer tipo débil del enemigo (para leerlo sin tabla).
export function weaknessColor(id) {
  const a = archOf(id);
  return TYPE_COLOR[a.weak[0]] || 0xffffff;
}

// Listas legibles (i18n) para la card de enemigo nuevo.
export function resistSummary(id) {
  const a = archOf(id);
  return {
    resiste: a.resist.map((k) => t(`dmg.${k}`)),
    debil: a.weak.map((k) => t(`dmg.${k}`))
  };
}
