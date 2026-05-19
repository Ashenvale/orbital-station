import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_BY_N } from '../src/data/levels.js';

test('16 niveles; jefes en 5 y 10 (y solo ahí)', () => {
  assert.equal(LEVELS.length, 16);
  for (const l of LEVELS) {
    const isBoss = l.n === 5 || l.n === 10;
    assert.equal(!!l.boss, isBoss, `nivel ${l.n}`);
    if (isBoss) assert.equal(l.introduced, 'boss_core');
  }
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
  assert.ok(LEVEL_BY_N[5].spawnMul < LEVEL_BY_N[16].spawnMul);
  assert.ok(LEVEL_BY_N[1].spawnMul < 1); // Nv1 calmado
});

test('pool acumulativo: crece y nunca incluye boss_core', () => {
  let prevLen = 0;
  for (const l of LEVELS) {
    assert.ok(!l.pool.includes('boss_core'));
    assert.ok(l.pool.length >= prevLen);
    prevLen = l.pool.length;
  }
  // Nivel 1 introduce el primer tipo; el último acumula 14 tipos.
  assert.equal(LEVEL_BY_N[1].pool.length, 1);
  assert.equal(LEVEL_BY_N[16].pool.length, 14);
});
