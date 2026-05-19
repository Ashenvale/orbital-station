// ---------------------------------------------------------------------------
// Motor de upgrades v0.7 (puro, sin Phaser). Estado por partida + resolver de
// stats efectivos + armado del pool del draft. GameScene lo consume.
// ---------------------------------------------------------------------------
import { WEAPONS, WEAPON_IDS, CAP_COMMON, specialMilestone } from './data/upgrades.js';

// Estado fresco por run.
export function newUpgState() {
  const w = {};
  for (const id of WEAPON_IDS) {
    w[id] = { owned: false, commons: {}, specials: [], totalCommons: 0 };
  }
  return w;
}

export function isUnlocked(weaponId, bossCount) {
  const u = WEAPONS[weaponId].unlock;
  if (!u) return true;
  if (u === 'boss1') return bossCount >= 1;
  if (u === 'boss2') return bossCount >= 2;
  return true;
}

// ¿El arma ocupa slot? cannon solo tras su 1er upgrade.
export function occupiesSlot(weaponId, st) {
  const s = st[weaponId];
  if (!s || !s.owned) return false;
  if (WEAPONS[weaponId].baseSlotFree) return s.totalCommons + s.specials.length > 0;
  return true;
}

export function commonStacks(st, wid, cid) {
  return (st[wid].commons && st[wid].commons[cid]) || 0;
}
export function hasSpecial(st, wid, sid) {
  return st[wid].specials.includes(sid);
}

// Especiales disponibles: tras i*2 comunes se abre el hueco de especial i.
export function specialSlotsOpen(st, wid) {
  const c = st[wid].totalCommons;
  let open = 0;
  for (let i = 1; i <= WEAPONS[wid].specials.length; i++)
    if (c >= specialMilestone(i)) open++;
  return open; // cuántos especiales puede tener ya
}

// Aplica una carta. card = {wid, kind:'unlock'|'common'|'special', id}
//  - 'unlock' : conseguir el arma (forma base). Cuenta como mejora #1.
//  - 'common' : mejora apilable.
//  - 'special': mejora especial (única).
export function applyUpg(st, card) {
  const s = st[card.wid];
  s.owned = true;
  if (card.kind === 'unlock') {
    s.acquired = true;
    s.totalCommons++; // la adquisición ya cuenta como una mejora
  } else if (card.kind === 'common') {
    s.commons[card.id] = (s.commons[card.id] || 0) + 1;
    s.totalCommons++;
  } else {
    if (!s.specials.includes(card.id)) s.specials.push(card.id);
  }
}

// -- Resolver: números efectivos por arma ---------------------------------
// qtyPenalty: cada stack de un común con qty reduce daño global.
function qtyMul(st, wid) {
  const W = WEAPONS[wid];
  let m = 1;
  for (const c of W.commons) {
    if (!c.qty) continue;
    const stacks = commonStacks(st, wid, c.id);
    const per = wid === 'orbital' ? 0.1 : wid === 'missiles' ? 0.15 : 0.2;
    m *= Math.pow(1 - per, stacks);
  }
  return m;
}

export function weaponStats(wid, st) {
  const W = WEAPONS[wid];
  const b = W.base;
  const S = (id) => commonStacks(st, wid, id);
  const sp = (id) => hasSpecial(st, wid, id);
  const out = { type: W.type, special: {} };
  for (const s of W.specials) out.special[s.id] = sp(s.id);
  const qm = qtyMul(st, wid);

  switch (wid) {
    case 'cannon':
      out.damage = b.damage * (1 + 0.15 * S('dmg')) * qm;
      out.cooldownMs = b.cooldownMs * Math.pow(0.88, S('rate'));
      out.projectiles = b.projectiles + S('proj');
      out.bulletSpeed = b.bulletSpeed;
      out.range = b.range;
      out.crit = 0.08 * S('crit');
      out.pierce = sp('pierce') ? 3 : 0;
      break;
    case 'missiles':
      out.damage = b.damage * (1 + 0.18 * S('dmg')) * qm;
      out.cooldownMs = b.cooldownMs * Math.pow(0.85, S('rate'));
      out.count = b.count + S('count');
      out.range = b.range * (1 + 0.25 * S('range'));
      out.turn = b.turn;
      out.speed = b.speed;
      break;
    case 'orbital':
      out.damage = b.damage * (1 + 0.2 * S('dmg')) * qm;
      out.orbs = b.orbs + S('orb');
      out.radius = b.radius * (1 + 0.15 * S('radius'));
      out.speed = b.speed * (1 + 0.2 * S('ospeed'));
      out.orbSize = b.orbSize;
      break;
    case 'nova':
      out.damage = b.damage * (1 + 0.22 * S('dmg')) * qm;
      out.radius = b.radius * (1 + 0.18 * S('radius'));
      out.cooldownMs = b.cooldownMs * Math.pow(0.88, S('cd'));
      out.waves = 1 + S('extra');
      break;
    case 'laser':
      out.dps = b.dps * (1 + 0.2 * S('dps')) * qm;
      out.onMs = b.onMs + 200 * S('on');
      out.offMs = Math.max(280, b.offMs - 150 * S('off'));
      out.range = b.range;
      out.beams = b.beams + (sp('beam2') ? 1 : 0); // especial: 2º láser pleno
      out.refract = S('refract'); // común: saltos a daño reducido
      break;
    case 'shield':
      out.shieldMax = Math.round(b.shieldMax * (1 + 0.25 * S('cap')));
      out.regenPerSec = b.regenPerSec * (1 + 0.2 * S('regen'));
      out.resist = Math.min(0.6, 0.05 * S('resist'));
      out.recharge = 0.1 * S('recharge');
      break;
    case 'drone':
      out.damage = b.damage * (1 + 0.18 * S('dmg')) * qm;
      out.count = 1 + S('count');
      out.hp = Math.round(b.hp * (1 + 0.3 * S('hp')));
      out.cooldownMs = b.cooldownMs * Math.pow(0.85, S('rate'));
      out.range = b.range;
      out.respawnMs = b.respawnMs;
      break;
    case 'blackhole':
      out.dps = b.dps * (1 + 0.25 * S('dmg'));
      out.durationMs = b.durationMs + 500 * S('dur');
      out.radius = b.radius * (1 + 0.2 * S('radius'));
      out.cooldownMs = b.cooldownMs * Math.pow(0.85, S('cd'));
      out.pull = b.pull;
      break;
  }
  return out;
}

// -- Pool del draft -------------------------------------------------------
// Devuelve lista de cartas candidatas {wid, kind, id, weight}. ctx:{bossCount}
// CLAVE: cada arma aporta COMO MUCHO 1 candidato por draft. Así ningún arma
// (p. ej. el cañón con sus 4 comunes) inunda las opciones.
// Reglas:
//  · Arma NO conseguida  -> 'unlock' (conseguir el arma base). Cuenta como
//    mejora #1. Peso alto: en el early se arma el kit.
//  · Arma conseguida con hueco de especial abierto -> 1 especial (obligatorio).
//  · En otro caso -> 1 común aleatorio elegible (cap restante).
export function draftPool(st, ctx) {
  const pool = [];
  for (const wid of WEAPON_IDS) {
    if (!isUnlocked(wid, ctx.bossCount)) continue;
    const s = st[wid];
    const W = WEAPONS[wid];

    // 1) Aún no la tengo: conseguir el arma (peso alto = priorizar el kit).
    if (!s.owned) {
      pool.push({ wid, kind: 'unlock', id: 'base', weight: 6 });
      continue;
    }

    // 2) ¿Toca especial obligatorio? (hito abierto y sin llenar)
    const open = specialSlotsOpen(st, wid);
    const taken = s.specials.length;
    const pendingSpecial = W.specials.filter((sp) => !s.specials.includes(sp.id));
    if (taken < open && pendingSpecial.length) {
      // Especial pendiente AL AZAR (no siempre la #1 del catálogo).
      const sp = pendingSpecial[Math.floor(Math.random() * pendingSpecial.length)];
      pool.push({ wid, kind: 'special', id: sp.id, weight: 7 });
      continue; // sin comunes de esta arma hasta tomar el especial
    }

    // 3) Un único común aleatorio con cap restante.
    if (s.totalCommons < CAP_COMMON) {
      const elig = W.commons.filter((c) => (s.commons[c.id] || 0) < c.max);
      if (elig.length) {
        const c = elig[Math.floor(Math.random() * elig.length)];
        pool.push({ wid, kind: 'common', id: c.id, weight: 4 });
      }
    }
  }
  return pool;
}
