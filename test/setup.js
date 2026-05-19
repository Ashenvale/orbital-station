// Stubs mínimos para correr módulos puros del juego en Node (sin navegador).
// i18n.js usa localStorage al cargar; nada más toca el DOM en lo que testeamos.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};
