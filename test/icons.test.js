import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawModuleIcon } from '../src/ui/icons.js';
import { WEAPON_IDS } from '../src/data/upgrades.js';
import { makeGraphics } from './mocks/graphics.js';

test('drawModuleIcon dibuja para cada arma v0.7 (alias) sin throw', () => {
  for (const wid of WEAPON_IDS) {
    const g = makeGraphics();
    drawModuleIcon(g, wid, 0, 0, 12, 0xffffff);
    assert.ok(g.calls.length > 0, `${wid} no dibujó nada`);
  }
});

test('drawModuleIcon: módulos de nave y fallback (+) no rompen', () => {
  for (const id of ['sh_damage', 'sh_rate', 'sh_atkspd', 'sh_range', 'sh_hp']) {
    const g = makeGraphics();
    drawModuleIcon(g, id, 0, 0, 12, 0x00ff00);
    assert.ok(g.calls.length > 0);
  }
  const g = makeGraphics();
  drawModuleIcon(g, '__repair', 0, 0, 12, 0xffffff); // default: cruz "+"
  assert.equal(g.count('lineBetween'), 2);
});

test('drawModuleIcon: ids con sufijo (#) se normalizan', () => {
  const g = makeGraphics();
  drawModuleIcon(g, 'laser#refraction', 0, 0, 12, 0xffffff);
  assert.ok(g.calls.length > 0);
});
