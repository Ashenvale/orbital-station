import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Progress, STAR_GOLD } from '../src/progress.js';

beforeEach(() => Progress.reset());

test('estado inicial: nada completado, solo Nv1 desbloqueado', () => {
  assert.equal(Progress.completed(), 0);
  assert.equal(Progress.isUnlocked(1), true);
  assert.equal(Progress.isUnlocked(2), false);
  assert.equal(Progress.isCleared(1), false);
});

test('complete: monótono (no retrocede) y desbloquea el siguiente', () => {
  Progress.complete(3);
  assert.equal(Progress.completed(), 3);
  Progress.complete(1); // no retrocede
  assert.equal(Progress.completed(), 3);
  assert.equal(Progress.isUnlocked(4), true);
  assert.equal(Progress.isUnlocked(5), false);
  assert.equal(Progress.isCleared(3), true);
});

test('claimStars: cada estrella paga una sola vez', () => {
  const a = Progress.claimStars(1, 2);
  assert.equal(a.gold, STAR_GOLD[1] + STAR_GOLD[2]);
  const b = Progress.claimStars(1, 2); // ya reclamadas
  assert.equal(b.gold, 0);
  const c = Progress.claimStars(1, 3); // solo la 3ª nueva
  assert.equal(c.gold, STAR_GOLD[3]);
  assert.equal(Progress.stars(1), 3);
});

test('claimStars: bajar estrellas no da oro', () => {
  Progress.claimStars(2, 3);
  const d = Progress.claimStars(2, 1);
  assert.equal(d.gold, 0);
  assert.equal(Progress.stars(2), 3);
});

test('STAR_GOLD progresivo', () => {
  assert.deepEqual(STAR_GOLD, [0, 150, 300, 600]);
});

test('nextLevel: siguiente o null al final de la campaña', () => {
  assert.equal(Progress.nextLevel(1), 2);
  assert.equal(Progress.nextLevel(17), null);
});
