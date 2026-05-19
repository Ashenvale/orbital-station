// Botón holográfico reutilizable (Menú, Habilidades, Game Over).
// Arcade Neon: borde chunky 3px, pixel-style.
import Phaser from 'phaser';
import { Sfx } from '../sfx.js';

const ADD = Phaser.BlendModes.ADD;
const FONT = '"Pixelify Sans", "VT323", ui-monospace, monospace';
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function buildButton(scene, x, y, w, h, label, color, onClick) {
  const c = scene.add.container(x, y);

  const glow = scene.add
    .image(0, 0, 'tex_glow')
    .setTint(color)
    .setBlendMode(ADD)
    .setAlpha(0.32)
    .setScale(w / 32, h / 26);

  const g = scene.add.graphics();
  const hw = w / 2;
  const hh = h / 2;
  // Chunky rectangular border (no chamfer): más arcade
  const draw = (fillA, lineA) => {
    g.clear();
    // Fondo púrpura semi-translúcido
    g.fillStyle(0x1c0d34, fillA);
    g.fillRect(-hw, -hh, w, h);
    // Borde chunky 3px en el color del botón
    g.lineStyle(3, color, lineA);
    g.strokeRect(-hw, -hh, w, h);
    // Línea de highlight superior (1px blanco)
    g.lineStyle(1, 0xffffff, lineA * 0.4);
    g.lineBetween(-hw + 2, -hh + 2, hw - 2, -hh + 2);
    // Esquinas pixel-style (pequeños cuadrados en las 4 esquinas)
    g.fillStyle(color, lineA);
    g.fillRect(-hw, -hh, 6, 6);
    g.fillRect(hw - 6, -hh, 6, 6);
    g.fillRect(-hw, hh - 6, 6, 6);
    g.fillRect(hw - 6, hh - 6, 6, 6);
  };
  draw(0.85, 0.95);

  const txt = scene.add
    .text(0, 0, label, {
      fontFamily: FONT,
      fontSize: '24px',
      color: hex(color),
      fontStyle: 'bold'
    })
    .setOrigin(0.5);

  const zone = scene.add
    .rectangle(0, 0, w, h, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });
  zone.on('pointerover', () => {
    draw(0.95, 1);
    glow.setAlpha(0.5);
    txt.setColor('#ffffff');
  });
  zone.on('pointerout', () => {
    draw(0.85, 0.95);
    glow.setAlpha(0.32);
    txt.setColor(hex(color));
  });
  zone.on('pointerdown', () => {
    Sfx.play('ui');
    // Squash arcade en click
    scene.tweens.add({
      targets: c,
      scaleX: 0.96,
      scaleY: 0.94,
      duration: 70,
      yoyo: true,
      ease: 'Quad.out'
    });
    onClick();
  });

  c.add([glow, g, txt, zone]);
  return c;
}

