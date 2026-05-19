import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installBrowser } from './mocks/browser.js';

installBrowser(); // antes de importar sfx.js (usa WebAudio al reproducir)
const { Sfx } = await import('../src/sfx.js');

const SOUNDS = [
  'shoot', 'hit', 'explosion', 'nova', 'shieldbreak', 'damage',
  'levelup', 'win', 'gameover', 'star', 'coin',
  'ui', 'tap', 'hover', 'select', 'back', 'open', 'close', 'error', 'tut'
];

test('toggleMute alterna y persiste en os_muted', () => {
  while (Sfx.isMuted()) Sfx.toggleMute();
  assert.equal(Sfx.isMuted(), false);
  const now = Sfx.toggleMute();
  assert.equal(now, true);
  assert.equal(localStorage.getItem('os_muted'), '1');
  Sfx.toggleMute();
  assert.equal(localStorage.getItem('os_muted'), '0');
});

test('play(): todos los sonidos definidos no lanzan', () => {
  while (Sfx.isMuted()) Sfx.toggleMute();
  for (const s of SOUNDS) assert.doesNotThrow(() => Sfx.play(s));
});

test('play(): sonido inexistente es no-op silencioso', () => {
  assert.doesNotThrow(() => Sfx.play('no_existe_xyz'));
  assert.doesNotThrow(() => Sfx.play(undefined));
});

test('play(): muteado no lanza', () => {
  while (!Sfx.isMuted()) Sfx.toggleMute();
  assert.doesNotThrow(() => Sfx.play('explosion'));
  Sfx.toggleMute(); // restaurar
});
