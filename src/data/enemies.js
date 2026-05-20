// ---------------------------------------------------------------------------
// Catálogo de enemigos (data-driven). De aquí salen las texturas (gfxTextures),
// el spawn y los comportamientos (GameScene).
//
//   shape(r)  -> array de puntos [x,y] del contorno neón (centrado en 0,0)
//   move      -> 'straight' | 'zigzag'
//   flags     -> capacidades especiales que GameScene interpreta
//   weight    -> peso relativo de aparición dentro del pool del nivel
// ---------------------------------------------------------------------------

import { t } from '../i18n.js';

const poly = (n, r, rot = 0, jitter = 0) => {
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const rr = r * (1 - jitter + Math.random() * jitter * 2);
    p.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return p;
};

export const ENEMY_CATALOG = {
  // -- Básicos --------------------------------------------------------------
  asteroid: {
    color: 0x7fd0c0,
    hp: 40, speed: 26, contactDmg: 12, xp: 6, radius: 23, weight: 1.0,
    move: 'straight',
    shape: (r) => poly(9, r, 0, 0.22)
  },
  missile: {
    color: 0xff6b6b,
    hp: 10, speed: 78, contactDmg: 18, xp: 3, radius: 12, weight: 0.8,
    move: 'straight',
    shape: (r) => [[0, -r * 1.4], [r * 0.7, r], [0, r * 0.45], [-r * 0.7, r]]
  },
  ship: {
    color: 0x6fb3ff,
    hp: 24, speed: 44, contactDmg: 15, xp: 8, radius: 17, weight: 0.7,
    move: 'straight',
    shape: (r) => [[0, -r], [r, r * 0.8], [0, r * 0.3], [-r, r * 0.8]]
  },

  // -- Rocas y sondas (niveles tempranos) -----------------------------------
  debris: {
    color: 0x9fc4bb,
    hp: 8, speed: 50, contactDmg: 6, xp: 4, radius: 12, weight: 1.3,
    move: 'straight',
    shape: (r) => poly(6, r, 0, 0.34)
  },
  probe: {
    color: 0x6fe3ff,
    hp: 14, speed: 66, contactDmg: 9, xp: 3, radius: 13, weight: 0.95,
    move: 'straight',
    shape: (r) => [[0, -r * 1.25], [r * 0.55, 0], [0, r], [-r * 0.55, 0]]
  },

  // -- Pack esencial --------------------------------------------------------
  drone: {
    color: 0xffd76a,
    hp: 5, speed: 92, contactDmg: 7, xp: 1, radius: 9, weight: 0.0, // sale en enjambre
    move: 'straight',
    shape: (r) => poly(3, r, -Math.PI / 2)
  },
  swarm: {
    color: 0xffd76a,
    hp: 5, speed: 92, contactDmg: 7, xp: 1, radius: 9, weight: 0.9,
    move: 'straight',
    flags: { swarm: 'drone', swarmCount: 6 },
    shape: (r) => poly(3, r, -Math.PI / 2)
  },
  armored: {
    color: 0x9fb0c4,
    hp: 130, speed: 16, contactDmg: 20, xp: 18, radius: 28, weight: 0.5,
    move: 'straight',
    flags: { dmgMul: 0.55 }, // blindaje: recibe 55% del daño
    shape: (r) => poly(6, r)
  },
  interceptor: {
    color: 0x5de0ff,
    hp: 16, speed: 60, contactDmg: 13, xp: 6, radius: 14, weight: 0.7,
    move: 'zigzag',
    flags: { zigzagAmp: 90, zigzagFreq: 3.2 },
    shape: (r) => [[0, -r], [r, 0], [0, r], [-r, 0], [0, -r * 0.3], [r * 0.4, 0], [0, r * 0.3], [-r * 0.4, 0]]
  },

  // -- Pack táctico ---------------------------------------------------------
  bomb: {
    color: 0xff8a3d,
    hp: 22, speed: 30, contactDmg: 0, xp: 8, radius: 16, weight: 0.5,
    move: 'straight',
    flags: { bomb: true, bombRange: 150, bombDmg: 34, bombFx: 120 },
    shape: (r) => poly(8, r)
  },
  healer: {
    color: 0x7affc4,
    hp: 34, speed: 30, contactDmg: 8, xp: 12, radius: 16, weight: 0.45,
    move: 'straight',
    flags: { healer: true, healRadius: 150, healPerSec: 14 },
    shape: (r) => [[0, -r], [r * 0.9, -r * 0.3], [r * 0.55, r * 0.9], [-r * 0.55, r * 0.9], [-r * 0.9, -r * 0.3]]
  },
  shielder: {
    color: 0xc792ff,
    hp: 40, speed: 26, contactDmg: 10, xp: 14, radius: 17, weight: 0.4,
    move: 'straight',
    flags: { shielder: true, shieldRadius: 140, shieldMul: 0.45 },
    shape: (r) => poly(5, r, -Math.PI / 2)
  },

  // -- Pack avanzado --------------------------------------------------------
  stealth: {
    color: 0x9bd6ff,
    hp: 18, speed: 56, contactDmg: 16, xp: 10, radius: 14, weight: 0.45,
    move: 'straight',
    flags: { stealth: true, phaseOnMs: 1400, phaseOffMs: 1100 },
    shape: (r) => [[0, -r], [r * 0.8, 0], [0, r], [-r * 0.8, 0]]
  },
  berserker: {
    color: 0xff5d6c,
    hp: 30, speed: 24, contactDmg: 20, xp: 10, radius: 18, weight: 0.45,
    move: 'straight',
    flags: { berserker: true, accel: 14, speedMax: 150 },
    shape: (r) => poly(7, r, -Math.PI / 2, 0.12)
  },
  carrier: {
    color: 0x8fa6c0,
    hp: 90, speed: 14, contactDmg: 16, xp: 22, radius: 26, weight: 0.4,
    move: 'straight',
    flags: { carrier: 'drone', droneEveryMs: 2600, droneCount: 3 },
    shape: (r) => [[-r, -r * 0.6], [r, -r * 0.6], [r * 0.6, r * 0.7], [-r * 0.6, r * 0.7]]
  },

  // -- JEFES (3 distintos, no kamikazes: atacan a distancia) ----------------
  // bossKind define la IA en GameScene.tickBoss. dmgMul bajo = más aguante.

  // Nv5 — Orbital: gira alrededor, dispara al centro y suelta drones.
  boss_orbital: {
    color: 0xff4f86,
    hp: 2400, speed: 70, contactDmg: 16, xp: 220, radius: 42, weight: 0,
    move: 'boss',
    flags: {
      boss: true, bossKind: 'orbital', dmgMul: 0.8,
      orbitR: 135, fireMs: 1500, shotDmg: 8,
      carrier: 'drone', droneEveryMs: 3400, droneCount: 3
    },
    shape: (r) => [
      [0, -r], [r * 0.45, -r * 0.45], [r, -r * 0.1], [r * 0.7, r * 0.5],
      [r * 0.35, r], [-r * 0.35, r], [-r * 0.7, r * 0.5], [-r, -r * 0.1],
      [-r * 0.45, -r * 0.45]
    ]
  },

  // Nv10 — Asediador: avanza, se planta a media distancia y descarga
  // andanadas. Acorazado: mucha vida y recibe poco daño.
  boss_siege: {
    color: 0xffa23d,
    hp: 5200, speed: 26, contactDmg: 22, xp: 360, radius: 50, weight: 0,
    move: 'boss',
    flags: {
      boss: true, bossKind: 'siege', dmgMul: 0.55,
      holdR: 130, fireMs: 1900, volley: 3, shotDmg: 7
    },
    shape: (r) => [
      [-r, -r * 0.7], [r, -r * 0.7], [r * 0.85, 0], [r, r * 0.7],
      [-r, r * 0.7], [-r * 0.85, 0]
    ]
  },

  // Nv15 — Devorador: parpadea por el anillo (golpe y huida), invoca
  // interceptores y dispara ráfagas. Difícil de fijar.
  boss_warp: {
    color: 0xb36bff,
    hp: 3200, speed: 95, contactDmg: 18, xp: 480, radius: 40, weight: 0,
    move: 'boss',
    flags: {
      boss: true, bossKind: 'warp', dmgMul: 0.75,
      blinkMs: 2400, fireMs: 1300, spread: 3, shotDmg: 9,
      carrier: 'interceptor', droneEveryMs: 4200, droneCount: 2
    },
    shape: (r) => [
      [0, -r], [r * 0.7, -r * 0.2], [r * 0.55, r * 0.85], [0, r * 0.45],
      [-r * 0.55, r * 0.85], [-r * 0.7, -r * 0.2]
    ]
  }
};

export const ENEMY_IDS = Object.keys(ENEMY_CATALOG);

export const enemyName = (id) => t(`en.${id}.name`);
export const enemyInfoText = (id) => t(`en.${id}.info`);
