// ---------------------------------------------------------------------------
// Economía: oro persistente + mejoras PERMANENTES de daño por habilidad.
// El oro se gana matando enemigos (se "bancan" al terminar la partida) y se
// gasta en la pantalla Habilidades para subir la potencia de cada módulo.
// ---------------------------------------------------------------------------
const GOLD_KEY = 'os_gold';
const POWER_KEY = 'os_power';

export const MAX_POWER = 8; // niveles de potencia comprables por habilidad
const DMG_PER_LEVEL = 0.12; // +12% daño por nivel

function loadPower() {
  try {
    return JSON.parse(localStorage.getItem(POWER_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}
let power = loadPower();

export const Economy = {
  gold() {
    return parseInt(localStorage.getItem(GOLD_KEY) || '0', 10) || 0;
  },
  addGold(n) {
    if (n > 0) localStorage.setItem(GOLD_KEY, String(this.gold() + Math.round(n)));
  },
  powerLevel(id) {
    return power[id] || 0;
  },
  // Multiplicador de daño permanente para la habilidad `id`.
  powerMul(id) {
    return 1 + (power[id] || 0) * DMG_PER_LEVEL;
  },
  cost(id) {
    const lv = power[id] || 0;
    return Math.round(90 * Math.pow(1.7, lv));
  },
  canUpgrade(id) {
    return (power[id] || 0) < MAX_POWER && this.gold() >= this.cost(id);
  },
  isMax(id) {
    return (power[id] || 0) >= MAX_POWER;
  },
  // Intenta comprar un nivel de potencia. Devuelve true si se realizó.
  buyPower(id) {
    if (this.isMax(id)) return false;
    const c = this.cost(id);
    if (this.gold() < c) return false;
    localStorage.setItem(GOLD_KEY, String(this.gold() - c));
    power[id] = (power[id] || 0) + 1;
    localStorage.setItem(POWER_KEY, JSON.stringify(power));
    return true;
  },
  reset() {
    localStorage.removeItem(GOLD_KEY);
    localStorage.removeItem(POWER_KEY);
    power = {};
  }
};
