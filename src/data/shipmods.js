// ---------------------------------------------------------------------------
// Módulos de mejora de la NAVE (permanentes). Stats aquí; textos en i18n.
//   per = incremento por nivel. effect(lv) => texto i18n con {v} = % por nivel.
// ---------------------------------------------------------------------------
import { t } from '../i18n.js';

const RAW = [
  { id: 'sh_damage', color: 0xff9d5c, per: 0.12 },
  { id: 'sh_rate', color: 0x49e8ff, per: 0.1 },
  { id: 'sh_atkspd', color: 0xc792ff, per: 0.08 },
  { id: 'sh_range', color: 0x6fe3ff, per: 0.08 },
  { id: 'sh_hp', color: 0x49f2c2, per: 0.12 }
];

function build(m) {
  return {
    id: m.id,
    color: m.color,
    per: m.per,
    get name() {
      return t(`sm.${m.id}.name`);
    },
    get blurb() {
      return t(`sm.${m.id}.blurb`);
    },
    effect(lv) {
      return t(`sm.${m.id}.eff`, { v: Math.round(lv * m.per * 100) });
    }
  };
}

export const SHIP_MODULES = RAW.map(build);
export const SHIPMOD_BY_ID = Object.fromEntries(SHIP_MODULES.map((m) => [m.id, m]));

export const shipDamageMul = (lv) => 1 + lv * SHIPMOD_BY_ID.sh_damage.per;
export const shipRateMul = (lv) => 1 + lv * SHIPMOD_BY_ID.sh_rate.per;
export const shipAtkSpdMul = (lv) => 1 + lv * SHIPMOD_BY_ID.sh_atkspd.per;
export const shipRangeMul = (lv) => 1 + lv * SHIPMOD_BY_ID.sh_range.per;
export const shipHpMul = (lv) => 1 + lv * SHIPMOD_BY_ID.sh_hp.per;
