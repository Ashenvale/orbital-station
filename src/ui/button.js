// Botón holográfico reutilizable (Menú, Habilidades, Game Over).
import Phaser from 'phaser';
import { Sfx } from '../sfx.js';

const ADD = Phaser.BlendModes.ADD;
const FONT = '"Courier New", ui-monospace, monospace';
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function buildButton(scene, x, y, w, h, label, color, onClick) {
  const c = scene.add.container(x, y);

  const glow = scene.add
    .image(0, 0, 'tex_glow')
    .setTint(color)
    .setBlendMode(ADD)
    .setAlpha(0.18)
    .setScale(w / 36, h / 30);

  const g = scene.add.graphics();
  const hw = w / 2;
  const hh = h / 2;
  const cut = 12;
  const pts = [
    -hw, -hh,
    hw - cut, -hh,
    hw, -hh + cut,
    hw, hh,
    -hw + cut, hh,
    -hw, hh - cut
  ];
  const draw = (fillA, lineA) => {
    g.clear();
    g.fillStyle(0x06202e, fillA);
    g.fillPoints(toPts(pts), true);
    g.lineStyle(2, color, lineA);
    g.strokePoints(toPts(pts), true);
  };
  draw(0.85, 0.85);

  const txt = scene.add
    .text(0, 0, label, { fontFamily: FONT, fontSize: '18px', color: hex(color), fontStyle: 'bold' })
    .setOrigin(0.5);

  const zone = scene.add
    .rectangle(0, 0, w, h, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });
  zone.on('pointerover', () => {
    draw(0.95, 1);
    glow.setAlpha(0.32);
  });
  zone.on('pointerout', () => {
    draw(0.85, 0.85);
    glow.setAlpha(0.18);
  });
  zone.on('pointerdown', () => {
    Sfx.play('ui');
    onClick();
  });

  c.add([glow, g, txt, zone]);
  return c;
}

function toPts(flat) {
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push(new Phaser.Math.Vector2(flat[i], flat[i + 1]));
  return out;
}
