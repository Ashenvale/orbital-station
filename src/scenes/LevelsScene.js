import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.js';
import { LEVELS } from '../data/levels.js';
import { Progress } from '../progress.js';
import { createBackdrop } from '../backdrop.js';
import { buildButton } from '../ui/button.js';
import { Sfx } from '../sfx.js';
import { t } from '../i18n.js';
import { Music } from '../music.js';

const ADD = Phaser.BlendModes.ADD;
const FONT = '"Pixelify Sans", "VT323", ui-monospace, monospace';
const FONT_DATA = '"VT323", "Pixelify Sans", ui-monospace, monospace';
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export default class LevelsScene extends Phaser.Scene {
  constructor() {
    super('LevelsScene');
  }

  create() {
    Music.stop();
    this.backdrop = createBackdrop(this, { nebula: true });
    const cx = GAME_W / 2;
    const UI = 100;

    this.add
      .text(cx, 36, t('ui.starmap_title'), {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#dffcff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(UI + 5);
    this.add
      .text(cx, 60, t('ui.starmap_hint'), {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#7fb8cf'
      })
      .setOrigin(0.5)
      .setDepth(UI + 5);

    const listTop = 78;
    const listBottom = GAME_H - 70;
    const listH = listBottom - listTop;
    const stepY = 100;
    const topPad = 40;
    const colX = (c) => (c === 1 ? GAME_W * 0.66 : GAME_W * 0.34);

    this.mapC = this.add.container(0, listTop).setDepth(UI);
    // El viaje va de ABAJO hacia ARRIBA: Nv1 en la base, último arriba.
    const last = LEVELS.length - 1;
    const nodes = LEVELS.map((l, i) => ({
      l,
      x: colX(l.col),
      y: topPad + (last - i) * stepY
    }));

    // Constelación: líneas entre nodos consecutivos.
    const path = this.add.graphics();
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];
      const open = Progress.isUnlocked(b.l.n);
      path.lineStyle(2, open ? COLORS.station : COLORS.grid, open ? 0.5 : 0.22);
      path.lineBetween(a.x, a.y, b.x, b.y);
    }
    this.mapC.add(path);
    nodes.forEach((nd) => this.buildNode(nd));

    this.contentH = topPad + nodes.length * stepY;
    this.scrollY = 0;
    this.minScroll = Math.min(0, listH - this.contentH);
    this.listTop = listTop;
    // Empieza mostrando el nivel más alto desbloqueado (más arriba).
    const open = Math.max(1, Progress.completed() + 1);
    const focusY = topPad + (last - (open - 1)) * stepY;
    this.scrollY = Phaser.Math.Clamp(listH / 2 - focusY, this.minScroll, 0);
    this.mapC.y = listTop + this.scrollY;

    const m = this.make.graphics();
    m.fillStyle(0xffffff);
    m.fillRect(0, listTop, GAME_W, listH);
    this.mapC.setMask(m.createGeometryMask());

    // Anti-bug: ignora el pointerup heredado de la pulsación que ABRIÓ esta
    // escena (la del botón "NIVELES" del menú). Solo "armamos" la selección
    // tras un pointerdown nuevo, hecho ya dentro de este mapa.
    this._armed = false;

    // Scroll: rueda + arrastre.
    this.input.on('wheel', (p, go, dx, dy) => this.applyScroll(-dy));
    let dragging = false;
    let lastY = 0;
    let movedY = 0;
    this.input.on('pointerdown', (p) => {
      this._armed = true;
      if (p.y > listTop && p.y < listBottom) {
        dragging = true;
        lastY = p.y;
        movedY = 0;
      }
    });
    this.input.on('pointermove', (p) => {
      if (dragging && p.isDown) {
        const d = p.y - lastY;
        movedY += Math.abs(d);
        this.applyScroll(d);
        lastY = p.y;
      }
    });
    this.input.on('pointerup', () => (dragging = false));
    this._wasDrag = () => movedY > 10;

    buildButton(this, cx, GAME_H - 38, 200, 48, t('ui.back'), COLORS.station, () => {
      this.scene.start('MenuScene');
    }).setDepth(UI + 5);
  }

  applyScroll(delta) {
    this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, this.minScroll, 0);
    this.mapC.y = this.listTop + this.scrollY;
  }

  buildNode({ l, x, y }) {
    const cleared = Progress.isCleared(l.n);
    const unlocked = Progress.isUnlocked(l.n);
    const color = cleared ? COLORS.xp : unlocked ? COLORS.station : 0x44546a;
    const add = [];

    const glow = this.add
      .image(x, y, 'tex_glow')
      .setTint(color)
      .setBlendMode(ADD)
      .setAlpha(unlocked ? 0.45 : 0.14)
      .setScale(1.5);
    if (unlocked && !cleared) {
      this.tweens.add({
        targets: glow,
        scale: 2.1,
        alpha: 0.75,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });
    }
    const g = this.add.graphics();
    g.fillStyle(0x081521, 0.95);
    g.fillCircle(x, y, 22);
    g.lineStyle(2, color, unlocked ? 0.95 : 0.4);
    g.strokeCircle(x, y, 22);
    const label = cleared ? '✓' : unlocked ? String(l.n) : '🔒';
    const lbl = this.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: '18px',
        color: hex(color),
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    const nm = this.add
      .text(x, y + 34, l.name, {
        fontFamily: FONT,
        fontSize: '11px',
        color: unlocked ? '#cfeefb' : '#5a6b7c',
        align: 'center',
        wordWrap: { width: 180 }
      })
      .setOrigin(0.5, 0);
    const sub = this.add
      .text(x, y + 34 + nm.height + 2, unlocked ? t('ui.destroy', { n: l.targetKills }) : t('ui.locked'), {
        fontFamily: FONT,
        fontSize: '10px',
        color: unlocked ? '#7fb8cf' : '#4a5b6c'
      })
      .setOrigin(0.5, 0);
    const st = Progress.stars(l.n);
    let starStr = '';
    for (let i = 0; i < 3; i++) starStr += i < st ? '★' : '☆';
    const stars = this.add
      .text(x, y - 36, starStr, {
        fontFamily: FONT,
        fontSize: '12px',
        color: st > 0 ? '#ffd76a' : '#3c4a59'
      })
      .setOrigin(0.5);

    add.push(glow, g, lbl, nm, sub, stars);

    if (unlocked) {
      const zone = this.add
        .circle(x, y, 26, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      const gA = glow.alpha;
      zone.on('pointerover', () => {
        Sfx.play('hover');
        this.tweens.add({ targets: glow, alpha: Math.min(1, gA + 0.35), duration: 140 });
      });
      zone.on('pointerout', () =>
        this.tweens.add({ targets: glow, alpha: gA, duration: 140 })
      );
      zone.on('pointerup', () => {
        if (!this._armed) return; // pointerup heredado del menú: ignorar
        if (this._wasDrag && this._wasDrag()) return; // era scroll
        Sfx.play('select');
        this.cameras.main.flash(120, 60, 180, 255);
        this.scene.start('GameScene', { level: l.n });
      });
      add.push(zone);
    }
    this.mapC.add(add);
  }

  update(time, delta) {
    this.backdrop.update(Math.min(delta, 50));
  }
}
