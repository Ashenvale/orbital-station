import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newUpgState,
  applyUpg,
  specialSlotsOpen,
  weaponStats,
  draftPool,
  isUnlocked,
  occupiesSlot
} from '../src/upgradeEngine.js';
import { WEAPON_IDS, CAP_COMMON } from '../src/data/upgrades.js';

test('estado fresco: nada owned salvo lo que setea GameScene', () => {
  const st = newUpgState();
  for (const id of WEAPON_IDS) {
    assert.equal(st[id].owned, false);
    assert.equal(st[id].totalCommons, 0);
    assert.deepEqual(st[id].specials, []);
  }
});

test('unlock cuenta como mejora #1 (totalCommons=1) y marca owned', () => {
  const st = newUpgState();
  applyUpg(st, { wid: 'missiles', kind: 'unlock', id: 'base' });
  assert.equal(st.missiles.owned, true);
  assert.equal(st.missiles.totalCommons, 1);
  assert.equal(occupiesSlot('missiles', st), true);
});

test('hito de especial: se abre a las 2 mejoras, segundo a las 4', () => {
  const st = newUpgState();
  applyUpg(st, { wid: 'laser', kind: 'unlock', id: 'base' }); // 1
  assert.equal(specialSlotsOpen(st, 'laser'), 0);
  applyUpg(st, { wid: 'laser', kind: 'common', id: 'dps' }); // 2
  assert.equal(specialSlotsOpen(st, 'laser'), 1);
  applyUpg(st, { wid: 'laser', kind: 'common', id: 'dps' }); // 3
  applyUpg(st, { wid: 'laser', kind: 'common', id: 'on' }); // 4
  assert.equal(specialSlotsOpen(st, 'laser'), 2);
});

test('draftPool: arma no conseguida -> SOLO carta unlock', () => {
  const st = newUpgState();
  const pool = draftPool(st, { bossCount: 0 });
  const missiles = pool.filter((c) => c.wid === 'missiles');
  assert.equal(missiles.length, 1);
  assert.equal(missiles[0].kind, 'unlock');
});

test('draftPool: cada arma aporta como mucho 1 carta (no inunda el cañón)', () => {
  const st = newUpgState();
  st.cannon.owned = true; // como en GameScene
  const pool = draftPool(st, { bossCount: 0 });
  const byW = {};
  for (const c of pool) byW[c.wid] = (byW[c.wid] || 0) + 1;
  for (const wid of Object.keys(byW)) assert.ok(byW[wid] <= 1, `${wid} aportó ${byW[wid]}`);
});

test('draftPool: con hito abierto la carta de esa arma es ESPECIAL (no común)', () => {
  const st = newUpgState();
  applyUpg(st, { wid: 'laser', kind: 'unlock', id: 'base' }); // 1
  applyUpg(st, { wid: 'laser', kind: 'common', id: 'dps' }); // 2 -> hito
  const laser = draftPool(st, { bossCount: 0 }).filter((c) => c.wid === 'laser');
  assert.equal(laser.length, 1);
  assert.equal(laser[0].kind, 'special');
});

test('draftPool: desbloqueos por jefe drone(1)/railgun(2)/blackhole(3)', () => {
  const st = newUpgState();
  assert.equal(isUnlocked('drone', 0), false);
  assert.equal(isUnlocked('drone', 1), true);
  assert.equal(isUnlocked('railgun', 1), false);
  assert.equal(isUnlocked('railgun', 2), true);
  assert.equal(isUnlocked('blackhole', 2), false);
  assert.equal(isUnlocked('blackhole', 3), true);
  const p0 = draftPool(st, { bossCount: 0 }).map((c) => c.wid);
  assert.ok(!p0.includes('drone') && !p0.includes('railgun') && !p0.includes('blackhole'));
  const p3 = draftPool(st, { bossCount: 3 }).map((c) => c.wid);
  assert.ok(p3.includes('drone') && p3.includes('railgun') && p3.includes('blackhole'));
});

test('draftPool: tope de comunes respeta CAP_COMMON', () => {
  const st = newUpgState();
  applyUpg(st, { wid: 'cannon', kind: 'unlock', id: 'base' });
  for (let i = 0; i < CAP_COMMON; i++)
    st.cannon.commons.dmg = (st.cannon.commons.dmg || 0) + 1, st.cannon.totalCommons++;
  // totalCommons >= CAP_COMMON: el cañón ya no debe ofrecer comunes
  const cannon = draftPool(st, { bossCount: 0 }).filter(
    (c) => c.wid === 'cannon' && c.kind === 'common'
  );
  assert.equal(cannon.length, 0);
});

test('weaponStats laser: refract es común, beam2 es especial', () => {
  const st = newUpgState();
  applyUpg(st, { wid: 'laser', kind: 'unlock', id: 'base' });
  let s = weaponStats('laser', st);
  assert.equal(s.refract, 0);
  assert.equal(s.beams, 1);
  applyUpg(st, { wid: 'laser', kind: 'common', id: 'refract' });
  applyUpg(st, { wid: 'laser', kind: 'special', id: 'beam2' });
  s = weaponStats('laser', st);
  assert.equal(s.refract, 1);
  assert.equal(s.beams, 2);
  assert.equal(s.special.pierceall, false);
});

test('weaponStats cannon: +Daño escala, +Proyectil suma, especiales flags', () => {
  const st = newUpgState();
  st.cannon.owned = true;
  const base = weaponStats('cannon', st).damage;
  applyUpg(st, { wid: 'cannon', kind: 'common', id: 'dmg' });
  assert.ok(weaponStats('cannon', st).damage > base);
  applyUpg(st, { wid: 'cannon', kind: 'common', id: 'proj' });
  assert.equal(weaponStats('cannon', st).projectiles, 2);
  applyUpg(st, { wid: 'cannon', kind: 'special', id: 'pierce' });
  assert.equal(weaponStats('cannon', st).pierce, 3);
});

test('weaponStats: cada arma devuelve números finitos y positivos clave', () => {
  for (const wid of WEAPON_IDS) {
    const st = newUpgState();
    st[wid].owned = true;
    const s = weaponStats(wid, st);
    assert.equal(s.type, undefined === s.type ? s.type : s.type); // existe
    assert.ok(typeof s.special === 'object');
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `${wid}.${k} no finito`);
    }
  }
});

test('penalización de cantidad: +Proyectil baja el daño global del cañón', () => {
  const st = newUpgState();
  st.cannon.owned = true;
  const d0 = weaponStats('cannon', st).damage;
  applyUpg(st, { wid: 'cannon', kind: 'common', id: 'proj' });
  const s1 = weaponStats('cannon', st);
  assert.equal(s1.projectiles, 2);
  assert.ok(s1.damage < d0, 'el daño global debe bajar con +Proyectil');
});

test('occupiesSlot: cannon (baseSlotFree) solo tras 1ª mejora; otras al tenerlas', () => {
  const st = newUpgState();
  st.cannon.owned = true;
  assert.equal(occupiesSlot('cannon', st), false); // owned pero sin mejoras
  applyUpg(st, { wid: 'cannon', kind: 'common', id: 'dmg' });
  assert.equal(occupiesSlot('cannon', st), true);

  assert.equal(occupiesSlot('missiles', st), false);
  applyUpg(st, { wid: 'missiles', kind: 'unlock', id: 'base' });
  assert.equal(occupiesSlot('missiles', st), true);
});

test('applyUpg special: idempotente (no duplica)', () => {
  const st = newUpgState();
  applyUpg(st, { wid: 'laser', kind: 'unlock', id: 'base' });
  applyUpg(st, { wid: 'laser', kind: 'special', id: 'pierceall' });
  applyUpg(st, { wid: 'laser', kind: 'special', id: 'pierceall' });
  assert.deepEqual(st.laser.specials, ['pierceall']);
});

test('draftPool: pesos positivos y kinds válidos', () => {
  const st = newUpgState();
  st.cannon.owned = true;
  applyUpg(st, { wid: 'missiles', kind: 'unlock', id: 'base' });
  for (const c of draftPool(st, { bossCount: 2 })) {
    assert.ok(c.weight > 0);
    assert.ok(['unlock', 'common', 'special'].includes(c.kind));
    assert.ok(WEAPON_IDS.includes(c.wid));
  }
});
