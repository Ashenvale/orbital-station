// ---------------------------------------------------------------------------
// Fondo holográfico reutilizable: nebulosas, estrellas, rejilla de radar con
// barrido, líneas de escaneo y viñeta. Lo usan Menú, Habilidades y Juego para
// que toda la app comparta la misma estética.
//
// Devuelve { update(dt) } para animar barrido + scroll de scanlines + estrellas.
// ---------------------------------------------------------------------------
import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from './config.js';
import { ensureTextures } from './gfxTextures.js';

const ADD = Phaser.BlendModes.ADD;

export function createBackdrop(scene, opts = {}) {
  ensureTextures(scene);
  const { nebula = true, stars = 120 } = opts;
  const CX = GAME_W / 2;
  const CY = GAME_H / 2;

  if (nebula) {
    // Nebulosas púrpura/magenta más intensas
    const nebColors = [0x3a1268, COLORS.laser, 0x5a1a8a];
    for (let i = 0; i < 3; i++) {
      const n = scene.add
        .image(
          Phaser.Math.Between(80, GAME_W - 80),
          Phaser.Math.Between(150, GAME_H - 150),
          'tex_glow'
        )
        .setTint(nebColors[i % nebColors.length])
        .setBlendMode(ADD)
        .setAlpha(0.32)
        .setScale(10 + i * 4)
        .setDepth(-9);
      scene.tweens.add({
        targets: n,
        scale: n.scale * 1.22,
        alpha: 0.45,
        duration: 5000 + i * 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });
    }
  }

  const starGroup = scene.add.group();
  for (let i = 0; i < stars; i++) {
    const tint = Math.random() < 0.15 ? 0xff7adb : Math.random() < 0.3 ? 0xffe640 : 0xc8faff;
    const s = scene.add
      .circle(
        Phaser.Math.Between(0, GAME_W),
        Phaser.Math.Between(0, GAME_H),
        Phaser.Math.FloatBetween(0.6, 2.0),
        tint,
        Phaser.Math.FloatBetween(0.25, 0.9)
      )
      .setDepth(-8);
    s.vy = Phaser.Math.FloatBetween(6, 18);
    scene.tweens.add({
      targets: s,
      alpha: 0.1,
      duration: Phaser.Math.Between(700, 2200),
      yoyo: true,
      repeat: -1
    });
    starGroup.add(s);
  }

  const grid = scene.add.graphics().setDepth(-7);
  const R = GAME_H * 0.62;
  grid.lineStyle(1, COLORS.station, 0.32);
  for (let r = 70; r < R; r += 70) grid.strokeCircle(CX, CY, r);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6)
    grid.lineBetween(CX, CY, CX + Math.cos(a) * R, CY + Math.sin(a) * R);
  grid.lineStyle(1, COLORS.laser, 0.18);
  grid.strokeRect(8, 8, GAME_W - 16, GAME_H - 16);

  const radar = scene.add.graphics().setDepth(-6);
  let radarAng = 0;

  const scanlines = scene.add
    .tileSprite(0, 0, GAME_W, GAME_H, 'tex_scan')
    .setOrigin(0, 0)
    .setAlpha(0.12)
    .setDepth(90)
    .setBlendMode(ADD);
  scene.add.image(0, 0, 'tex_vignette').setOrigin(0, 0).setDepth(95);

  return {
    update(dt) {
      starGroup.children.iterate((s) => {
        if (!s) return;
        s.y += s.vy * (dt / 1000);
        if (s.y > GAME_H) {
          s.y = 0;
          s.x = Phaser.Math.Between(0, GAME_W);
        }
      });
      scanlines.tilePositionY -= dt * 0.04;
      radarAng += dt * 0.0008;
      radar.clear();
      radar.fillStyle(COLORS.laser, 0.07);
      radar.slice(CX, CY, R, radarAng - 0.55, radarAng, false);
      radar.fillPath();
      radar.lineStyle(2, COLORS.laser, 0.25);
      radar.lineBetween(CX, CY, CX + Math.cos(radarAng) * R, CY + Math.sin(radarAng) * R);
    }
  };
}
