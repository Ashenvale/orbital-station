import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resistMul, ENEMY_ARCH, TYPE_COLOR, weaknessColor } from '../src/data/enemyInfo.js';

test('resistMul: débil ×1.5, resistente ×0.5, neutro ×1', () => {
  // debris = arquetipo "caza": débil a kinetic/explosive, resiste elemental.
  assert.equal(resistMul('debris', 'kinetic'), 1.5);
  assert.equal(resistMul('debris', 'elemental'), 0.5);
  assert.equal(resistMul('debris', 'gravity'), 1);
});

test("compat: tipo 'laser' se normaliza a 'energy'", () => {
  // blindado resiste kinetic; energy lo daña ×1.5 -> 'laser' igual que energy.
  assert.equal(resistMul('asteroid', 'laser'), resistMul('asteroid', 'energy'));
});

test('todo enemigo del catálogo tiene arquetipo y color de aura', () => {
  for (const id of Object.keys(ENEMY_ARCH)) {
    const c = weaknessColor(id);
    assert.ok(Object.values(TYPE_COLOR).includes(c) || c === 0xffffff, id);
  }
});
