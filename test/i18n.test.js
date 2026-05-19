import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, Lang, LANGS, _STR } from '../src/i18n.js';

test('LANGS = en/es/pt y por defecto en', () => {
  assert.deepEqual(LANGS, ['en', 'es', 'pt']);
});

test('paridad de claves: es y pt tienen EXACTAMENTE las claves de en', () => {
  const en = Object.keys(_STR.en).sort();
  for (const l of ['es', 'pt']) {
    const cur = Object.keys(_STR[l]).sort();
    const missing = en.filter((k) => !(k in _STR[l]));
    const extra = cur.filter((k) => !(k in _STR.en));
    assert.equal(missing.length, 0, `${l} sin: ${missing.join(', ')}`);
    assert.equal(extra.length, 0, `${l} de más: ${extra.join(', ')}`);
  }
});

test('t(): interpola {var} y cae a en y luego a la clave', () => {
  Lang.set('en');
  assert.equal(t('ui.menu_gold', { n: 7 }), '◎ 7 gold');
  assert.equal(t('clave.inexistente.xyz'), 'clave.inexistente.xyz');
});

test('t(): usa el idioma activo', () => {
  Lang.set('es');
  assert.ok(t('ui.btn_levels').length > 0);
  assert.notEqual(t('ui.tut_skip'), 'ui.tut_skip'); // existe en es
  Lang.set('en');
});

test('Lang.cycle: en -> es -> pt -> en y persiste', () => {
  Lang.set('en');
  assert.equal(Lang.cycle(), 'es');
  assert.equal(Lang.cycle(), 'pt');
  assert.equal(Lang.cycle(), 'en');
  assert.equal(localStorage.getItem('os_lang'), 'en');
});

test('Lang.set ignora idiomas inválidos', () => {
  Lang.set('en');
  Lang.set('xx');
  assert.equal(Lang.get(), 'en');
});
