// ---------------------------------------------------------------------------
// Generador idempotente de texturas (canvas). Cualquier escena puede llamar a
// ensureTextures(scene): si ya existen no hace nada, así Menú/Juego/Habilidades
// comparten el mismo set de glow/neón.
// ---------------------------------------------------------------------------
import { GAME_W, GAME_H, COLORS, STATION } from './config.js';
import { ENEMY_CATALOG } from './data/enemies.js';

export const STATION_TEX_PAD = 20;

const css = (n, a = 1) => {
  const c = n.toString(16).padStart(6, '0');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

export function ensureTextures(scene) {
  const T = scene.textures;
  const make = (key, w, h, draw) => {
    if (T.exists(key)) return;
    const t = T.createCanvas(key, w, h);
    draw(t.getContext(), w, h);
    t.refresh();
  };

  // Glow radial reutilizable (se tinta + blend ADD).
  make('tex_glow', 64, 64, (x) => {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
  });

  // Núcleos de proyectil.
  const core = (key, size, color) =>
    make(key, size, size, (x) => {
      const c = size / 2;
      const g = x.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, css(color, 0.95));
      g.addColorStop(1, css(color, 0));
      x.fillStyle = g;
      x.fillRect(0, 0, size, size);
    });
  core('tex_bullet', 22, COLORS.bullet);
  core('tex_missile_p', 26, COLORS.missile);
  core('tex_orb', 24, COLORS.orb);

  // Forma neón con halo (enemigos).
  const neon = (key, size, color, drawPath, fillA = 0.12) =>
    make(key, size, size, (x) => {
      const c = size / 2;
      const g = x.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, css(color, 0.4));
      g.addColorStop(1, css(color, 0));
      x.fillStyle = g;
      x.fillRect(0, 0, size, size);
      x.save();
      x.translate(c, c);
      x.beginPath();
      drawPath(x);
      x.closePath();
      x.fillStyle = css(color, fillA);
      x.fill();
      x.shadowColor = css(color, 1);
      x.shadowBlur = 14;
      x.lineWidth = 3;
      x.strokeStyle = css(0xffffff, 1);
      x.stroke();
      x.shadowBlur = 0;
      x.lineWidth = 1.5;
      x.strokeStyle = css(color, 1);
      x.stroke();
      x.restore();
    });

  const drawPoly = (verts) => (x) =>
    verts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));

  // Una textura neón por cada enemigo del catálogo: tex_e_<id>.
  for (const [id, def] of Object.entries(ENEMY_CATALOG)) {
    const r = def.radius;
    const pad = Math.max(8, Math.round(r * 0.35));
    neon(`tex_e_${id}`, (r + pad) * 2, def.color, drawPoly(def.shape(r)));
  }

  // Estación: hexágono con halo y núcleo.
  const R = STATION.radius;
  const sz = (R + STATION_TEX_PAD) * 2;
  make('tex_station', sz, sz, (x) => {
    const cc = sz / 2;
    const halo = x.createRadialGradient(cc, cc, 0, cc, cc, R + STATION_TEX_PAD);
    halo.addColorStop(0, css(COLORS.station, 0.5));
    halo.addColorStop(0.7, css(COLORS.station, 0.12));
    halo.addColorStop(1, css(COLORS.station, 0));
    x.fillStyle = halo;
    x.fillRect(0, 0, sz, sz);
    x.save();
    x.translate(cc, cc);
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * R;
      const py = Math.sin(a) * R;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath();
    x.fillStyle = css(COLORS.station, 0.28);
    x.fill();
    x.shadowColor = css(COLORS.station, 0.95);
    x.shadowBlur = 22;
    x.lineWidth = 3.5;
    x.strokeStyle = css(COLORS.stationCore, 1);
    x.stroke();
    x.shadowBlur = 0;
    x.beginPath();
    x.arc(0, 0, 7, 0, Math.PI * 2);
    x.fillStyle = css(COLORS.stationCore, 1);
    x.fill();
    x.restore();
  });

  // Línea de escaneo (patrón TileSprite) — magenta arcade.
  make('tex_scan', 4, 4, (x) => {
    x.fillStyle = css(COLORS.laser, 0.55);
    x.fillRect(0, 3, 4, 1);
  });

  // Viñeta.
  make('tex_vignette', GAME_W, GAME_H, (x) => {
    const vg = x.createRadialGradient(
      GAME_W / 2,
      GAME_H / 2,
      GAME_H * 0.28,
      GAME_W / 2,
      GAME_H / 2,
      GAME_H * 0.72
    );
    vg.addColorStop(0, 'rgba(16,8,31,0)');
    vg.addColorStop(1, 'rgba(8,3,18,0.94)');
    x.fillStyle = vg;
    x.fillRect(0, 0, GAME_W, GAME_H);
  });
}
