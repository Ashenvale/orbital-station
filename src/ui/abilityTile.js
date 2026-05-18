// ---------------------------------------------------------------------------
// Tile vertical sci-fi reutilizable. Dos usos:
//   - draft  : tarjeta de opción en la "cinta" de subir de nivel (icono, nombre,
//              badge de nivel, descripción y track de pips). Interactiva.
//   - grid   : cuadro compacto del codex (icono, nombre, pie de potencia).
// ---------------------------------------------------------------------------
import Phaser from 'phaser';
import { Sfx } from '../sfx.js';

const ADD = Phaser.BlendModes.ADD;
const FONT = '"Courier New", ui-monospace, monospace';
const GOLD = 0xffd76a;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

const toPts = (flat) => {
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push(new Phaser.Math.Vector2(flat[i], flat[i + 1]));
  return out;
};

export function buildTile(scene, o) {
  const { cx, cy, w, h, color, name } = o;
  const hw = w / 2;
  const hh = h / 2;
  const cut = Math.min(16, w * 0.16);
  const tile = scene.add.container(cx, cy);
  const shape = toPts([-hw, -hh, hw - cut, -hh, hw, -hh + cut, hw, hh, -hw, hh]);

  const glow = scene.add
    .image(0, 0, 'tex_glow')
    .setTint(color)
    .setBlendMode(ADD)
    .setAlpha(0.18)
    .setScale(w / 14, h / 14);

  const g = scene.add.graphics();
  const paint = (fillA, lineA) => {
    g.clear();
    g.fillStyle(0x081521, fillA);
    g.fillPoints(shape, true);
    g.lineStyle(2, color, lineA);
    g.strokePoints(shape, true);
  };
  paint(0.92, 0.9);

  const kids = [glow, g];

  // Ícono hexagonal
  const iconR = Math.min(22, w * 0.2);
  const iconY = -hh + iconR + 16;
  const icon = scene.add.graphics();
  icon.fillStyle(color, 0.18);
  icon.lineStyle(2, color, 0.95);
  const ip = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
    ip.push(new Phaser.Math.Vector2(Math.cos(a) * iconR, iconY + Math.sin(a) * iconR));
  }
  icon.fillPoints(ip, true);
  icon.strokePoints(ip, true);
  kids.push(icon);

  const nameY = iconY + iconR + 14;
  kids.push(
    scene.add
      .text(0, nameY, name, {
        fontFamily: FONT,
        fontSize: o.compact ? '13px' : '15px',
        color: hex(color),
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: w - 16 }
      })
      .setOrigin(0.5, 0)
  );

  if (o.badge) {
    const prem = /PREMIUM|ESPECIAL/.test(o.badge);
    kids.push(
      scene.add
        .text(0, nameY + 32, `[ ${o.badge} ]`, {
          fontFamily: FONT,
          fontSize: '11px',
          color: prem ? hex(GOLD) : '#7fb8cf',
          fontStyle: 'bold'
        })
        .setOrigin(0.5, 0)
    );
  }

  if (o.body) {
    kids.push(
      scene.add
        .text(0, nameY + (o.badge ? 54 : 30), o.body, {
          fontFamily: FONT,
          fontSize: '12px',
          color: '#dfe9f7',
          align: 'center',
          wordWrap: { width: w - 22 },
          lineSpacing: 3
        })
        .setOrigin(0.5, 0)
    );
  }

  if (o.footer) {
    kids.push(
      scene.add
        .text(0, hh - 22, o.footer, {
          fontFamily: FONT,
          fontSize: '11px',
          color: o.footerColor || '#7fb8cf',
          align: 'center'
        })
        .setOrigin(0.5, 0)
    );
  }

  // Track de progresión: 3 barras + 3 diamantes ★ (encendidos = level-1).
  if (o.level != null) {
    const py = hh - 16;
    const litN = Phaser.Math.Clamp(o.level - 1, 0, 6);
    const startX = -((3 - 1) * 20 + 3 * 16) / 2; // centra el bloque de barras
    for (let i = 0; i < 6; i++) {
      const lit = i < litN;
      if (i < 3) {
        kids.push(
          scene.add
            .rectangle(startX + i * 22, py, 16, 5, color, lit ? 0.95 : 0.22)
            .setOrigin(0, 0.5)
        );
      } else {
        const dx = startX + 66 + (i - 3) * 18;
        const dia = scene.add.rectangle(dx, py, 10, 10, GOLD, lit ? 1 : 0.22).setAngle(45);
        if (lit) dia.setBlendMode(ADD);
        kids.push(dia);
      }
    }
  }

  tile.add(kids);

  if (o.onClick) {
    const zone = scene.add
      .rectangle(0, 0, w, h, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      paint(0.97, 1);
      glow.setAlpha(0.34);
    });
    zone.on('pointerout', () => {
      paint(0.92, 0.9);
      glow.setAlpha(0.18);
    });
    zone.on('pointerdown', () => {
      Sfx.play('ui');
      o.onClick();
    });
    tile.add(zone);
  }

  if (o.popDelay >= 0) {
    tile.setScale(0.86).setAlpha(0);
    scene.tweens.add({
      targets: tile,
      scale: 1,
      alpha: 1,
      duration: 280,
      delay: o.popDelay,
      ease: 'Back.out'
    });
  }

  return tile;
}
