import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Economy, MAX_POWER } from '../src/economy.js';
import {
  shipDamageMul,
  shipRateMul,
  shipHpMul,
  shipAtkSpdMul,
  shipRangeMul,
  SHIP_MODULES
} from '../src/data/shipmods.js';

beforeEach(() => Economy.reset());

test('oro: arranca en 0, addGold redondea y acumula, no acepta negativos', () => {
  assert.equal(Economy.gold(), 0);
  Economy.addGold(10.6);
  assert.equal(Economy.gold(), 11);
  Economy.addGold(-5);
  assert.equal(Economy.gold(), 11);
});

test('costo crece exponencial con el nivel (90·1.7^lv)', () => {
  assert.equal(Economy.cost('sh_damage'), 90);
  Economy.addGold(1000);
  Economy.buyPower('sh_damage');
  assert.equal(Economy.cost('sh_damage'), Math.round(90 * 1.7));
});

test('buyPower falla sin oro y descuenta al comprar', () => {
  assert.equal(Economy.buyPower('sh_hp'), false); // 0 oro
  Economy.addGold(90);
  assert.equal(Economy.buyPower('sh_hp'), true);
  assert.equal(Economy.powerLevel('sh_hp'), 1);
  assert.equal(Economy.gold(), 0);
});

test('tope MAX_POWER: no se puede pasar', () => {
  Economy.addGold(10_000_000);
  for (let i = 0; i < MAX_POWER + 3; i++) Economy.buyPower('sh_rate');
  assert.equal(Economy.powerLevel('sh_rate'), MAX_POWER);
  assert.equal(Economy.isMax('sh_rate'), true);
  assert.equal(Economy.buyPower('sh_rate'), false);
});

test('canUpgrade: depende de oro y de no estar al máximo', () => {
  assert.equal(Economy.canUpgrade('sh_damage'), false); // sin oro
  Economy.addGold(90);
  assert.equal(Economy.canUpgrade('sh_damage'), true);
  Economy.buyPower('sh_damage');
  assert.equal(Economy.canUpgrade('sh_damage'), false); // gastó el oro
});

test('powerMul = 1 + 0.12·nivel', () => {
  assert.equal(Economy.powerMul('sh_damage'), 1);
  Economy.addGold(1000);
  Economy.buyPower('sh_damage');
  assert.ok(Math.abs(Economy.powerMul('sh_damage') - 1.12) < 1e-9);
});

test('multiplicadores de nave coherentes con SHIP_MODULES.per', () => {
  assert.equal(SHIP_MODULES.length, 5);
  assert.ok(Math.abs(shipDamageMul(2) - (1 + 2 * 0.12)) < 1e-9);
  assert.ok(Math.abs(shipRateMul(3) - (1 + 3 * 0.1)) < 1e-9);
  assert.ok(Math.abs(shipAtkSpdMul(1) - (1 + 0.08)) < 1e-9);
  assert.ok(Math.abs(shipRangeMul(4) - (1 + 4 * 0.08)) < 1e-9);
  assert.ok(Math.abs(shipHpMul(5) - (1 + 5 * 0.12)) < 1e-9);
  assert.equal(shipDamageMul(0), 1);
});
