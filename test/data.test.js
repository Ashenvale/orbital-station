import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_CATALOG, ENEMY_IDS, enemyName, enemyInfoText } from '../src/data/enemies.js';
import { SHIP_MODULES, SHIPMOD_BY_ID } from '../src/data/shipmods.js';
import { LEVEL_BY_N } from '../src/data/levels.js';
import { resistSummary, ENEMY_ARCH } from '../src/data/enemyInfo.js';
import { Lang } from '../src/i18n.js';

test('enemies: catálogo no vacío; name/info devuelven texto; shape() da puntos', () => {
  assert.ok(ENEMY_IDS.length > 10);
  for (const id of ENEMY_IDS) {
    assert.equal(typeof enemyName(id), 'string');
    assert.equal(typeof enemyInfoText(id), 'string');
    const def = ENEMY_CATALOG[id];
    assert.ok(def.hp > 0 && def.speed > 0);
    if (typeof def.shape === 'function') {
      const pts = def.shape(10);
      assert.ok(Array.isArray(pts) && pts.length >= 3);
    }
  }
});

test('shipmods: getters name/blurb/effect interpolan el nivel', () => {
  for (const m of SHIP_MODULES) {
    assert.equal(SHIPMOD_BY_ID[m.id], m);
    assert.ok(m.name.length > 0);
    assert.ok(m.blurb.length > 0);
    const e0 = m.effect(0);
    const e3 = m.effect(3);
    assert.equal(typeof e0, 'string');
    assert.notEqual(e0, e3); // el % cambia con el nivel
  }
});

test('levels: getter name (boss vs normal) según idioma', () => {
  Lang.set('es');
  const boss = LEVEL_BY_N[5].name;
  const norm = LEVEL_BY_N[1].name;
  assert.ok(boss.length > 0 && norm.length > 0);
  assert.notEqual(boss, norm);
  Lang.set('en');
  assert.ok(LEVEL_BY_N[10].name.length > 0);
});

test('enemyInfo.resistSummary: listas legibles débil/resiste', () => {
  for (const id of Object.keys(ENEMY_ARCH)) {
    const r = resistSummary(id);
    assert.ok(Array.isArray(r.debil) && r.debil.length >= 1);
    assert.ok(Array.isArray(r.resiste) && r.resiste.length >= 1);
  }
});
