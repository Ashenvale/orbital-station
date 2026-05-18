// ---------------------------------------------------------------------------
// Resistencias por enemigo (numérico aquí; textos/idiomas en i18n).
//   resist[type] < 1  -> RESISTE (recibe menos) ; > 1 -> DÉBIL (recibe más)
// Tipos: kinetic, explosive, laser, energy.  Comportamiento => en.<id>.info
// ---------------------------------------------------------------------------
import { t } from '../i18n.js';

export const DMG_KEYS = ['kinetic', 'explosive', 'laser', 'energy'];

export const RESIST = {
  debris: { kinetic: 0.7 },
  asteroid: { kinetic: 0.55, explosive: 1.4 },
  missile: { laser: 1.3 },
  ship: { laser: 1.25 },
  probe: { kinetic: 1.2 },
  drone: {},
  armored: { kinetic: 0.45, explosive: 0.7, laser: 1.4 },
  interceptor: { explosive: 0.7, laser: 1.3 },
  bomb: { kinetic: 1.3 },
  healer: { laser: 1.4 },
  shielder: { energy: 0.5, laser: 0.7, kinetic: 1.3 },
  stealth: { laser: 0.6, explosive: 1.3 },
  berserker: { explosive: 0.6, laser: 1.3 },
  carrier: { explosive: 0.7, laser: 1.2 },
  boss_core: { kinetic: 0.7, explosive: 0.7, laser: 1.2 }
};

// Multiplicador de daño de `type` sobre el enemigo `id`.
export const resistMul = (id, type) => {
  const r = RESIST[id];
  return r && r[type] != null ? r[type] : 1;
};

// Listas legibles (i18n) para la card: { resiste:[...], debil:[...] }
export function resistSummary(id) {
  const r = RESIST[id] || {};
  const resiste = [];
  const debil = [];
  for (const k of DMG_KEYS) {
    if (r[k] == null) continue;
    if (r[k] < 1) resiste.push(t(`dmg.${k}`));
    else if (r[k] > 1) debil.push(t(`dmg.${k}`));
  }
  return { resiste, debil };
}
