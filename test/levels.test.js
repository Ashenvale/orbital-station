import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_BY_N } from '../src/data/levels.js';

const BOSS_IDS = ['boss_orbital', 'boss_siege', 'boss_warp'];

test('17 niveles; jefes cada 5 (5/10/15) y solo ahí', () => {
  assert.equal(LEVELS.length, 17);
  for (const l of LEVELS) {
    const isBoss = l.n === 5 || l.n === 10 || l.n === 15;
    assert.equal(!!l.boss, isBoss, `nivel ${l.n}`);
    if (isBoss) {
      assert.ok(BOSS_IDS.includes(l.boss), `boss ${l.boss}`);
      assert.equal(l.introduced, l.boss);
    }
  }
});

test('cada nivel de jefe usa un jefe DISTINTO en orden', () => {
  assert.equal(LEVEL_BY_N[5].boss, 'boss_orbital');
  assert.equal(LEVEL_BY_N[10].boss, 'boss_siege');
  assert.equal(LEVEL_BY_N[15].boss, 'boss_warp');
});

test('targetKills = 40 + n*16 y crece monótono', () => {
  let prev = 0;
  for (const l of LEVELS) {
    assert.equal(l.targetKills, Math.round(40 + l.n * 16));
    assert.ok(l.targetKills > prev);
    prev = l.targetKills;
  }
});

test('densidad (spawnMul) arranca baja y sube por stage', () => {
  assert.ok(LEVEL_BY_N[1].spawnMul < LEVEL_BY_N[5].spawnMul);
  assert.ok(LEVEL_BY_N[5].spawnMul < LEVEL_BY_N[17].spawnMul);
  assert.ok(LEVEL_BY_N[1].spawnMul < 1); // Nv1 calmado
});

test('pool acumulativo: crece y nunca incluye un jefe', () => {
  let prevLen = 0;
  for (const l of LEVELS) {
    for (const b of BOSS_IDS) assert.ok(!l.pool.includes(b));
    assert.ok(l.pool.length >= prevLen);
    prevLen = l.pool.length;
  }
  assert.equal(LEVEL_BY_N[1].pool.length, 1);
  assert.equal(LEVEL_BY_N[17].pool.length, 14); // 14 tipos al final
});
