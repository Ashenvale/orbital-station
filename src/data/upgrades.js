// ---------------------------------------------------------------------------
// Catálogo de upgrades atómicos (propuesta v0.7, slice v1: 4 comunes + 2
// especiales por arma = 48 cartas). Stats numéricos + textos es/en (pt cae a
// es por ahora; i18n total de cartas = parche posterior, como pide el doc).
//
//  - 9 armas. cannon = base (no ocupa slot hasta el 1er upgrade).
//  - commons: apilables hasta `max`. qty:true => penaliza daño global por stack.
//  - specials: 3 por arma. Ritmo: 2 comunes -> especial 1; 4 -> 2; 6 -> 3.
//  - unlock: null | 'boss1' | 'boss2' | 'boss3'.
// El efecto numérico concreto lo aplica el resolver en GameScene (por id).
// ---------------------------------------------------------------------------
import { Lang } from '../i18n.js';

// Texto bilingüe compacto (pt usa es).
export const tx = (o) => (Lang.get() === 'en' ? o.en : o.es);

const C = (id, max, es, en, dEs, dEn, qty) => ({
  id,
  max,
  qty: !!qty,
  nm: { es, en },
  ds: { es: dEs, en: dEn }
});
const S = (id, es, en, dEs, dEn) => ({ id, nm: { es, en }, ds: { es: dEs, en: dEn } });

export const WEAPONS = {
  cannon: {
    name: { es: 'Cañón', en: 'Cannon' },
    blurb: {
      es: 'Arma base: dispara balas al enemigo más cercano. Siempre activo.',
      en: 'Base weapon: fires bullets at the nearest enemy. Always active.'
    },
    type: 'kinetic',
    color: 0xfff07a,
    unlock: null,
    baseSlotFree: true, // no ocupa slot hasta el 1er upgrade
    base: { damage: 7, cooldownMs: 620, projectiles: 1, bulletSpeed: 420, range: 230, crit: 0 },
    commons: [
      C('dmg', 3, '+Daño', '+Damage', '+15% daño por bala.', '+15% damage per shot.'),
      C('rate', 3, '+Cadencia', '+Fire rate', '−12% enfriamiento.', '−12% cooldown.'),
      C('proj', 2, '+Proyectil', '+Projectile', '+1 bala. Daño global −20%/stack.', '+1 bullet. Global −20%/stack.', true),
      C('crit', 3, '+Crítico', '+Crit', '+8% prob. de crítico (×2).', '+8% crit chance (×2).')
    ],
    specials: [
      S('explosive', 'Balas explosivas', 'Explosive rounds', 'Cada bala explota (AOE).', 'Each bullet explodes (AOE).'),
      S('pierce', 'Perforación', 'Pierce', 'La bala atraviesa hasta 3 enemigos.', 'Bullets pierce up to 3 enemies.'),
      S('ricochet', 'Rebote', 'Ricochet', 'La bala rebota a otro enemigo cercano.', 'Bullets bounce to a nearby enemy.')
    ]
  },

  missiles: {
    name: { es: 'Misiles', en: 'Missiles' },
    blurb: {
      es: 'Lanza misiles teledirigidos que persiguen y explotan al impactar.',
      en: 'Launches homing missiles that chase and explode on impact.'
    },
    type: 'explosive',
    color: 0xff7a59,
    unlock: null,
    base: { cooldownMs: 1600, count: 1, damage: 16, range: 210, turn: 0.12, speed: 230 },
    commons: [
      C('dmg', 3, '+Daño', '+Damage', '+18% daño por misil.', '+18% damage per missile.'),
      C('rate', 3, '+Cadencia', '+Fire rate', '−15% entre tandas.', '−15% between volleys.'),
      C('count', 2, '+Misil', '+Missile', '+1 misil. Daño −15%/stack.', '+1 missile. Damage −15%/stack.', true),
      C('track', 3, '+Rastreo', '+Tracking', 'El misil persigue (base va recto). +giro/stack.', 'Missiles seek (base flies straight). +turn/stack.')
    ],
    specials: [
      S('fission', 'Fisión', 'Fission', 'Al impactar se divide en 3.', 'Splits into 3 on impact.'),
      S('plasma', 'Campo de plasma', 'Plasma field', 'Deja zona elemental al impactar.', 'Leaves an elemental zone on impact.'),
      S('swarm', 'Saturación', 'Saturation', '+2 misiles por tanda.', '+2 missiles per volley.')
    ]
  },

  orbital: {
    name: { es: 'Anillo Orbital', en: 'Orbital Ring' },
    blurb: {
      es: 'Orbes que giran alrededor de la estación y dañan al tocar enemigos.',
      en: 'Orbs that circle the station and damage enemies on contact.'
    },
    type: 'kinetic',
    color: 0xc792ff,
    unlock: null,
    base: { orbs: 1, damage: 7, radius: 96, speed: 2.4, orbSize: 12 },
    commons: [
      C('dmg', 3, '+Daño', '+Damage', '+20% daño de contacto.', '+20% contact damage.'),
      C('orb', 2, '+Orbe', '+Orb', '+1 orbe. Daño −10%/stack.', '+1 orb. Damage −10%/stack.', true),
      C('radius', 3, '+Radio', '+Radius', '+15% radio de la órbita.', '+15% orbit radius.'),
      C('ospeed', 2, '+Vel. órbita', '+Orbit speed', '+20% velocidad angular.', '+20% angular speed.')
    ],
    specials: [
      S('pulse', 'Pulso al impactar', 'Impact pulse', 'Onda de área al golpear.', 'Area pulse on hit.'),
      S('double', 'Anillo doble', 'Double ring', 'Segundo anillo inverso.', 'Second reversed ring.'),
      S('heavy', 'Orbe pesado', 'Heavy orb', '×1.6 daño de contacto.', '×1.6 contact damage.')
    ]
  },

  nova: {
    name: { es: 'Pulso Nova', en: 'Nova Pulse' },
    blurb: {
      es: 'Onda expansiva periódica que daña a todo lo que esté en su radio.',
      en: 'Periodic shockwave that damages everything within its radius.'
    },
    type: 'elemental',
    color: 0x6fe3ff,
    unlock: null,
    base: { cooldownMs: 3000, radius: 140, damage: 26 },
    commons: [
      C('dmg', 3, '+Daño', '+Damage', '+22% daño por onda.', '+22% wave damage.'),
      C('radius', 3, '+Radio', '+Radius', '+18% radio de la onda.', '+18% wave radius.'),
      C('cd', 3, '−Cooldown', '−Cooldown', '−12% entre pulsos.', '−12% between pulses.'),
      C('extra', 2, '+Onda', '+Wave', '+1 onda. Daño −20%/stack.', '+1 wave. Damage −20%/stack.', true)
    ],
    specials: [
      S('frost', 'Escarcha', 'Frost', 'Ralentiza 1.8s a los golpeados.', 'Slows hit enemies 1.8s.'),
      S('poison', 'Veneno', 'Poison', '5 daño/s durante 4s.', '5 dmg/s for 4s.'),
      S('mega', 'Onda expansiva', 'Shockwave', '+40% radio y +25% daño.', '+40% radius and +25% damage.')
    ]
  },

  laser: {
    name: { es: 'Rayo de Plasma', en: 'Plasma Beam' },
    blurb: {
      es: 'Rayo continuo (ciclo on/off) que quema al objetivo más cercano.',
      en: 'Continuous beam (on/off cycle) that burns the nearest target.'
    },
    type: 'energy',
    color: 0xff4f86,
    unlock: null,
    base: { dps: 18, onMs: 1400, offMs: 1200, range: 200, beams: 1 },
    commons: [
      C('dps', 3, '+DPS', '+DPS', '+20% daño/seg del rayo.', '+20% beam damage/s.'),
      C('on', 3, '+Duración on', '+On time', '+0.2s de ciclo activo.', '+0.2s active cycle.'),
      C('off', 2, '−Duración off', '−Off time', '−0.15s de enfriamiento.', '−0.15s cooldown cycle.'),
      C('refract', 3, '+Refracción', '+Refraction', 'El rayo salta a otro enemigo (+1 salto, daño reducido).', 'Beam jumps to another enemy (+1 hop, reduced dmg).')
    ],
    specials: [
      S('beam2', 'Doble láser', 'Twin laser', 'Un segundo rayo independiente a daño pleno.', 'A second independent beam at full damage.'),
      S('pierceall', 'Perforación total', 'Full pierce', 'Atraviesa a todos en línea.', 'Pierces all enemies in line.'),
      S('overcharge', 'Sobrecarga', 'Overcharge', 'Sin enfriamiento: el rayo es continuo.', 'No cooldown: the beam is continuous.')
    ]
  },

  shield: {
    name: { es: 'Escudo Regen', en: 'Regen Shield' },
    blurb: {
      es: 'Capa de escudo que absorbe daño y se regenera sola con el tiempo.',
      en: 'Shield layer that absorbs damage and self-regenerates over time.'
    },
    type: 'defense',
    color: 0x49f2c2,
    unlock: null,
    base: { shieldMax: 60, regenPerSec: 8, resist: 0 },
    commons: [
      C('cap', 3, '+HP escudo', '+Shield HP', '+25% capacidad máx.', '+25% max capacity.'),
      C('regen', 3, '+Regen', '+Regen', '+20% velocidad de regen.', '+20% regen speed.'),
      C('resist', 3, '+Resistencia', '+Resistance', '+5% reducción de daño.', '+5% damage reduction.'),
      C('recharge', 2, '+Recarga', '+Recharge', '+10% HP al iniciar nivel.', '+10% HP at level start.')
    ],
    specials: [
      S('absorb', 'Absorción', 'Absorb', 'Absorbe el golpe letal + 1s invul.', 'Absorbs a lethal hit + 1s invuln.'),
      S('thorns', 'Espinas', 'Thorns', 'Refleja 25% del daño recibido.', 'Reflects 25% of damage taken.'),
      S('burst', 'Detonación', 'Detonation', 'Al romperse, onda que daña alrededor.', 'On break, a wave damages around.')
    ]
  },

  drone: {
    name: { es: 'Drone de Combate', en: 'Combat Drone' },
    blurb: {
      es: 'Dron con vida: ATRAVIESA enemigos y reaparece al morir. Con Cañón, orbita al enemigo disparándole y, al quedarse sin balas, lo atraviesa. Disparo y explosión = mejoras.',
      en: 'Drone with HP: DASHES through enemies, respawns on death. With Gun it orbits the enemy shooting and, out of ammo, dashes through it. Gun and explosion = upgrades.'
    },
    type: 'kinetic',
    color: 0x9ad0ff,
    unlock: 'boss1',
    base: { damage: 12, cooldownMs: 360, hp: 45, range: 165, respawnMs: 9000, speed: 150 },
    commons: [
      C('dmg', 3, '+Daño', '+Damage', '+18% daño de embestida.', '+18% ram damage.'),
      C('count', 2, '+Drone', '+Drone', '+1 drone. Daño −20%/stack.', '+1 drone. Damage −20%/stack.', true),
      C('hp', 3, '+HP drone', '+Drone HP', '+30% vida del drone.', '+30% drone HP.'),
      C('speed', 3, '+Velocidad', '+Speed', '+15% velocidad de movimiento.', '+15% move speed.')
    ],
    specials: [
      S('gun', 'Cañón de drone', 'Drone gun', 'Además dispara al más cercano.', 'Also shoots the nearest enemy.'),
      S('kamikaze', 'Kamikaze', 'Kamikaze', 'Explota (AOE) al morir.', 'Explodes (AOE) on death.'),
      S('phase', 'Munición de fase', 'Phase ammo', 'Disparos pasan a energía (req. Cañón).', 'Shots become energy (needs Gun).')
    ]
  },

  // Recompensa del Jefe 2 (Nv10): cañón de riel — disparo lento y brutal
  // que atraviesa TODA la línea. Distinto del láser (continuo).
  railgun: {
    name: { es: 'Escopeta de Plasma', en: 'Plasma Shotgun' },
    blurb: {
      es: 'Ráfaga de perdigones de plasma en abanico, corto alcance y mucho daño de cerca.',
      en: 'Fan blast of plasma pellets, short range and big close-up damage.'
    },
    type: 'kinetic',
    color: 0xa0f0ff,
    unlock: 'boss2',
    base: { damage: 18, cooldownMs: 1300, range: 165, pellets: 3, spread: 0.5, bulletSpeed: 540, crit: 0 },
    commons: [
      C('dmg', 3, '+Daño', '+Damage', '+20% daño por perdigón.', '+20% damage per pellet.'),
      C('rate', 3, '+Cadencia', '+Fire rate', '−12% enfriamiento.', '−12% cooldown.'),
      C('pellet', 2, '+Perdigones', '+Pellets', '+2 perdigones. Daño −20%/stack.', '+2 pellets. Damage −20%/stack.', true),
      C('crit', 3, '+Crítico', '+Crit', '+8% prob. de crítico (×2).', '+8% crit chance (×2).')
    ],
    specials: [
      S('twin', 'Doble cargador', 'Double tap', 'Dispara 2 ráfagas seguidas.', 'Fires two blasts in a row.'),
      S('shock', 'Sobrecarga', 'Shock', 'Ralentiza 1.5s a los impactados.', 'Slows hit enemies 1.5s.'),
      S('knockback', 'Retroceso', 'Knockback', 'Empuja hacia atrás a los impactados.', 'Pushes hit enemies back.')
    ]
  },

  blackhole: {
    name: { es: 'Agujero Negro', en: 'Black Hole' },
    blurb: {
      es: 'Invoca una singularidad que atrae y daña a los enemigos en su zona.',
      en: 'Summons a singularity that pulls in and damages enemies in its zone.'
    },
    type: 'gravity',
    color: 0xb36bff,
    unlock: 'boss3',
    base: { dps: 18, durationMs: 2000, radius: 90, cooldownMs: 6000, pull: 26 },
    commons: [
      C('dmg', 3, '+Daño', '+Damage', '+25% daño/seg dentro.', '+25% dmg/s inside.'),
      C('count', 2, '+Agujero', '+Black hole', '+1 agujero negro simultáneo.', '+1 simultaneous black hole.'),
      C('dur', 3, '+Duración', '+Duration', '+0.5s de duración.', '+0.5s duration.'),
      C('radius', 2, '+Radio', '+Radius', '+20% radio de atracción.', '+20% pull radius.'),
      C('cd', 3, '−Cooldown', '−Cooldown', '−15% entre invocaciones.', '−15% between casts.')
    ],
    specials: [
      S('implosion', 'Implosión', 'Implosion', 'Al cerrar daña a todo lo de dentro.', 'On close, damages all inside.'),
      S('distort', 'Distorsión', 'Distortion', 'Dentro reciben ×1.5 de TODO.', 'Inside take ×1.5 from ALL.'),
      S('singularity', 'Singularidad', 'Singularity', '+60% radio y dura el doble.', '+60% radius, lasts twice as long.')
    ]
  }
};

// Nombre / descripción del arma según idioma (pt cae a es).
export const wname = (wid) => tx(WEAPONS[wid].name);
export const wblurb = (wid) =>
  WEAPONS[wid].blurb ? tx(WEAPONS[wid].blurb) : '';

const UNLOCK = { es: 'Conseguir esta arma (forma base).', en: 'Unlock this weapon (base form).' };

// Metadatos de una carta del draft para pintarla en el tile.
export function cardMeta(wid, kind, id) {
  const W = WEAPONS[wid];
  if (kind === 'unlock') {
    return { weapon: wname(wid), color: W.color, title: wname(wid), desc: tx(UNLOCK), special: false, unlock: true };
  }
  const entry = (kind === 'common' ? W.commons : W.specials).find((c) => c.id === id);
  return {
    weapon: wname(wid),
    color: W.color,
    title: entry ? tx(entry.nm) : wname(wid),
    desc: entry ? tx(entry.ds) : '',
    special: kind === 'special'
  };
}

export const WEAPON_IDS = Object.keys(WEAPONS);
export const CAP_COMMON = 6; // tope de stacks comunes (suma)
export const CAP_SPECIAL = 3; // 3 especiales por arma (hitos 2/4/6)
// Hitos: especial i (1-based) disponible tras (i*2) comunes acumulados.
export const specialMilestone = (i) => i * 2;
