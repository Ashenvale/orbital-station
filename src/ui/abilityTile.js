// ---------------------------------------------------------------------------
// Tile vertical arcade reutilizable (Direction C — Arcade Neon).
// Dos usos:
//   - draft  : tarjeta de opción en la "cinta" de subir de nivel.
//   - grid   : cuadro compacto del codex.
// ---------------------------------------------------------------------------
import Phaser from 'phaser';
import { Sfx } from '../sfx.js';
import { drawModuleIcon } from './icons.js';

const ADD = Phaser.BlendModes.ADD;
const FONT = '"Pixelify Sans", "VT323", ui-monospace, monospace';
const FONT_DATA = '"VT323", "Pixelify Sans", ui-monospace, monospace';
const GOLD = 0xffe640;
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
  const tile = scene.add.container(cx, cy);

  const glow = scene.add
    .image(0, 0, 'tex_glow')
    .setTint(color)
    .setBlendMode(ADD)
    .setAlpha(0.32)
    .setScale(w / 12, h / 12);

  const g = scene.add.graphics();
  const paint = (fillA, lineA) => {
    g.clear();
    // Fondo púrpura profundo
    g.fillStyle(0x1c0d34, fillA);
    g.fillRect(-hw, -hh, w, h);
    // Borde chunky 3px
    g.lineStyle(3, color, lineA);
    g.strokeRect(-hw, -hh, w, h);
    // Highlight superior
    g.lineStyle(1, 0xffffff, lineA * 0.35);
    g.lineBetween(-hw + 3, -hh + 3, hw - 3, -hh + 3);
    // Esquinas pixel
    g.fillStyle(color, lineA);
    g.fillRect(-hw, -hh, 7, 7);
    g.fillRect(hw - 7, -hh, 7, 7);
    g.fillRect(-hw, hh - 7, 7, 7);
    g.fillRect(hw - 7, hh - 7, 7, 7);
  };
  paint(0.94, 0.95);

  const kids = [glow, g];

  // Hexágono + glifo distintivo del módulo (para identificarlo rápido)
  const iconR = Math.min(o.compact ? 19 : 26, w * (o.compact ? 0.16 : 0.22));
  const iconY = -hh + iconR + (o.compact ? 12 : 18);
  const icon = scene.add.graphics();
  icon.fillStyle(color, 0.16);
  icon.lineStyle(3, color, 1);
  const ip = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
    ip.push(new Phaser.Math.Vector2(Math.cos(a) * iconR, iconY + Math.sin(a) * iconR));
  }
  icon.fillPoints(ip, true);
  icon.strokePoints(ip, true);
  if (o.icon) drawModuleIcon(icon, o.icon, 0, iconY, iconR * 0.52, color);
  kids.push(icon);

  const nameY = iconY + iconR + (o.compact ? 8 : 16);
  const nameTxt = scene.add
    .text(0, nameY, name, {
      fontFamily: FONT,
      fontSize: o.compact ? '14px' : '20px',
      color: hex(color),
      fontStyle: 'bold',
      align: 'center',
      lineSpacing: o.compact ? 0 : 2,
      wordWrap: { width: w - (o.compact ? 12 : 16) }
    })
    .setOrigin(0.5, 0);
  kids.push(nameTxt);

  // Layout dinámico: todo cuelga DEBAJO del nombre real (que puede ocupar
  // 1 o 2 líneas), nunca a un offset fijo (evita que el badge pise el nombre).
  let cursorY = nameY + nameTxt.height + (o.compact ? 6 : 12);

  if (o.badge) {
    const prem = /PREMIUM|ESPECIAL/.test(o.badge);
    const badgeTxt = scene.add
      .text(0, cursorY, `[ ${o.badge} ]`, {
        fontFamily: FONT_DATA,
        fontSize: '15px',
        color: prem ? hex(GOLD) : '#c084ff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: w - 14 }
      })
      .setOrigin(0.5, 0);
    kids.push(badgeTxt);
    cursorY += badgeTxt.height + 10;
  }

  if (o.body) {
    kids.push(
      scene.add
        .text(0, cursorY, o.body, {
          fontFamily: FONT_DATA,
          fontSize: '16px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: w - 22 },
          lineSpacing: 4
        })
        .setOrigin(0.5, 0)
    );
  }

  if (o.footer) {
    // Compacto: justo debajo del nombre (sin solaparse aunque envuelva 2
    // líneas). Draft: anclado abajo.
    const fy = o.compact ? nameTxt.y + nameTxt.height + 6 : hh - 26;
    kids.push(
      scene.add
        .text(0, fy, o.footer, {
          fontFamily: FONT_DATA,
          fontSize: o.compact ? '12px' : '15px',
          color: o.footerColor || '#c084ff',
          align: 'center'
        })
        .setOrigin(0.5, 0)
    );
  }

  // Track de progresión: 3 barras + 3 diamantes ★ (encendidos = level-1).
  if (o.level != null) {
    const py = hh - 18;
    const litN = Phaser.Math.Clamp(o.level - 1, 0, 6);
    const startX = -((3 - 1) * 20 + 3 * 16) / 2;
    for (let i = 0; i < 6; i++) {
      const lit = i < litN;
      if (i < 3) {
        kids.push(
          scene.add
            .rectangle(startX + i * 22, py, 18, 6, color, lit ? 1 : 0.25)
            .setOrigin(0, 0.5)
        );
      } else {
        const dx = startX + 66 + (i - 3) * 18;
        const dia = scene.add.rectangle(dx, py, 11, 11, GOLD, lit ? 1 : 0.25).setAngle(45);
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
      paint(0.98, 1);
      glow.setAlpha(0.55);
      scene.tweens.add({ targets: tile, scaleX: 1.03, scaleY: 1.03, duration: 120, ease: 'Back.out' });
    });
    zone.on('pointerout', () => {
      paint(0.94, 0.95);
      glow.setAlpha(0.32);
      scene.tweens.add({ targets: tile, scaleX: 1, scaleY: 1, duration: 120, ease: 'Back.out' });
    });
    zone.on('pointerdown', () => {
      Sfx.play('ui');
      o.onClick();
    });
    tile.add(zone);
  }

  if (o.popDelay >= 0) {
    tile.setScale(0.82).setAlpha(0);
    scene.tweens.add({
      targets: tile,
      scale: 1,
      alpha: 1,
      duration: 320,
      delay: o.popDelay,
      ease: 'Back.out'
    });
  }

  return tile;
}

