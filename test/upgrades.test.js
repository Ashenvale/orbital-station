import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEAPONS,
  WEAPON_IDS,
  CAP_COMMON,
  specialMilestone,
  cardMeta,
  wname,
  tx
} from '../src/data/upgrades.js';
import { Lang } from '../src/i18n.js';

const TYPES = ['kinetic', 'explosive', 'energy', 'elemental', 'gravity', 'defense'];

test('catálogo: 8 armas con estructura consistente', () => {
  assert.equal(WEAPON_IDS.length, 8);
  for (const id of WEAPON_IDS) {
    const W = WEAPONS[id];
    assert.ok(W.name && W.name.es && W.name.en, `${id} name`);
    assert.ok(TYPES.includes(W.type), `${id} type ${W.type}`);
    assert.equal(typeof W.color, 'number');
    assert.ok(W.base && typeof W.base === 'object');
    assert.ok(Array.isArray(W.commons) && W.commons.length >= 1);
    assert.equal(W.specials.length, 2);
    const cids = W.commons.map((c) => c.id);
    assert.equal(new Set(cids).size, cids.length, `${id} comunes únicos`);
    for (const c of W.commons) assert.ok(c.max >= 1);
    const sids = W.specials.map((s) => s.id);
    assert.equal(new Set(sids).size, sids.length, `${id} especiales únicos`);
  }
});

test('unlock por jefe: drone=boss1, blackhole=boss2, resto libre', () => {
  assert.equal(WEAPONS.drone.unlock, 'boss1');
  assert.equal(WEAPONS.blackhole.unlock, 'boss2');
  assert.equal(WEAPONS.cannon.unlock, null);
  assert.equal(WEAPONS.cannon.baseSlotFree, true);
});

test('hitos: especial i tras i*2 comunes', () => {
  assert.equal(specialMilestone(1), 2);
  assert.equal(specialMilestone(2), 4);
  assert.equal(CAP_COMMON, 6);
});

test('cardMeta: unlock / common / special', () => {
  const u = cardMeta('missiles', 'unlock', 'base');
  assert.equal(u.unlock, true);
  assert.equal(u.special, false);
  assert.ok(u.desc.length > 0);

  const c = cardMeta('cannon', 'common', 'dmg');
  assert.equal(c.special, false);
  assert.ok(c.title.length > 0 && c.desc.length > 0);

  const s = cardMeta('laser', 'special', 'pierceall');
  assert.equal(s.special, true);
});

test('wname / tx respetan el idioma', () => {
  Lang.set('en');
  assert.equal(wname('cannon'), 'Cannon');
  assert.equal(tx({ es: 'Hola', en: 'Hi' }), 'Hi');
  Lang.set('es');
  assert.equal(wname('cannon'), 'Cañón');
  assert.equal(tx({ es: 'Hola', en: 'Hi' }), 'Hola');
  Lang.set('en');
});
