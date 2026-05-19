// ---------------------------------------------------------------------------
// PROTOTIPO del sistema de VARIANTES (mini-árbol) aplicado solo al láser.
// El láser se adquiere una vez (haz base) y cada subida ofrece elegir una
// variante (stat o comportamiento) que se acumula por rangos. Si funciona
// bien, este patrón se replica al resto de armas.
// ---------------------------------------------------------------------------
export const LASER_BASE = { dps: 24, onMs: 1400, offMs: 1200, range: 300 };

export const LASER_VARS = [
  { id: 'power', max: 4 }, // +daño/seg
  { id: 'cooler', max: 3 }, // menos tiempo apagado
  { id: 'lens', max: 3 }, // +alcance
  { id: 'refraction', max: 3 }, // rebota a enemigos extra (daño decreciente)
  { id: 'twin', max: 2 } // haz extra a otro objetivo
];
export const LASER_VAR_BY_ID = Object.fromEntries(LASER_VARS.map((v) => [v.id, v]));

// Estadísticas efectivas del láser según los rangos tomados.
// scaledRangeFn aplica la pasiva de Alcance + tope MAX_RANGE.
export function laserStats(vars, scaledRangeFn) {
  const r = (k) => vars[k] || 0;
  return {
    dps: LASER_BASE.dps * (1 + 0.18 * r('power')),
    onMs: LASER_BASE.onMs,
    offMs: Math.max(280, LASER_BASE.offMs * (1 - 0.18 * r('cooler'))),
    range: scaledRangeFn(LASER_BASE.range * (1 + 0.14 * r('lens'))),
    beams: 1 + r('twin'), // objetivos independientes a daño pleno
    refract: r('refraction') // enemigos extra encadenados (daño decreciente)
  };
}
