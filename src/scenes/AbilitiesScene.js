import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.js';
import { ABILITIES, ROMAN } from '../data/abilities.js';
import { SHIP_MODULES } from '../data/shipmods.js';
import { createBackdrop } from '../backdrop.js';
import { buildButton } from '../ui/button.js';
import { buildTile } from '../ui/abilityTile.js';
import { Economy, MAX_POWER } from '../economy.js';
import { Sfx } from '../sfx.js';
import { t } from '../i18n.js';

const ADD = Phaser.BlendModes.ADD;
const FONT = '"Courier New", ui-monospace, monospace';
const GOLD = '#ffd76a';
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const toPts = (flat) => {
  const o = [];
  for (let i = 0; i < flat.length; i += 2) o.push(new Phaser.Math.Vector2(flat[i], flat[i + 1]));
  return o;
};

export default class AbilitiesScene extends Phaser.Scene {
  constructor() {
    super('AbilitiesScene');
  }

  create() {
    this.backdrop = createBackdrop(this, { nebula: false });
    const cx = GAME_W / 2;
    const UI = 100;

    this.add
      .text(cx, 34, t('ui.modules'), {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#dffcff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(UI);
    this.add
      .text(cx, 56, t('ui.modules_hint'), {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#7fb8cf'
      })
      .setOrigin(0.5)
      .setDepth(UI);
    this.goldHeader = this.add
      .text(cx, 72, t('ui.gold_avail', { n: Economy.gold() }), {
        fontFamily: FONT,
        fontSize: '13px',
        color: GOLD,
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(UI);
    this._dirty = false; // si se compró algo, refrescar grid al cerrar

    const margin = 16;
    const gap = 12;
    const cols = 3;
    const tileW = (GAME_W - margin * 2 - gap * (cols - 1)) / cols;
    const tileH = 126;
    const UId = UI;

    const placeTile = (d, isShip, cxk, cyk) => {
      const lv = Economy.powerLevel(d.id);
      buildTile(this, {
        cx: cxk,
        cy: cyk,
        w: tileW,
        h: tileH,
        color: d.color,
        name: d.name,
        compact: true,
        footer: isShip
          ? lv > 0
            ? t('ui.f_passive_lv', { n: lv })
            : t('ui.f_passive')
          : lv > 0
            ? t('ui.f_power', { n: lv })
            : t('ui.f_noupg'),
        footerColor: lv > 0 ? GOLD : '#6f93a8',
        onClick: () => (isShip ? this.openShipDetail(d) : this.openDetail(d))
      }).setDepth(UId);
    };

    const colX = (c) => margin + tileW / 2 + c * (tileW + gap);

    const rowsOf = (n) => Math.ceil(n / cols);
    const blockH = (n) => rowsOf(n) * tileH + (rowsOf(n) - 1) * gap;

    // --- Sección PASIVAS (mejoras permanentes de la nave) -----------------
    const sec1Y = 88;
    this.sectionHeader(sec1Y, t('ui.sec_passive'), '#ffd76a', UI);
    const ship1 = sec1Y + 22;
    SHIP_MODULES.forEach((m, i) =>
      placeTile(
        m,
        true,
        colX(i % cols),
        ship1 + tileH / 2 + Math.floor(i / cols) * (tileH + gap)
      )
    );

    // --- Sección ARMAS (módulos de combate del draft) --------------------
    const sec2Y = ship1 + blockH(SHIP_MODULES.length) + 20;
    this.sectionHeader(sec2Y, t('ui.sec_weapons'), hex(COLORS.station), UI);
    const arm1 = sec2Y + 22;
    ABILITIES.forEach((a, i) =>
      placeTile(
        a,
        false,
        colX(i % cols),
        arm1 + tileH / 2 + Math.floor(i / cols) * (tileH + gap)
      )
    );

    buildButton(this, cx, GAME_H - 42, 200, 50, t('ui.back'), COLORS.station, () => {
      this.scene.start('MenuScene');
    }).setDepth(UI);

    // Capa para el modal de detalle
    this.detailLayer = this.add.container(0, 0).setDepth(UI + 50).setVisible(false);
  }

  sectionHeader(y, text, color, depth) {
    this.add
      .text(16, y, text, { fontFamily: FONT, fontSize: '12px', color, fontStyle: 'bold' })
      .setOrigin(0, 0.5)
      .setDepth(depth);
    const g = this.add.graphics().setDepth(depth);
    g.lineStyle(1, COLORS.station, 0.22);
    g.lineBetween(16, y + 13, GAME_W - 16, y + 13);
  }

  // ===========================================================================
  //  Modal de detalle de una habilidad
  // ===========================================================================
  openDetail(a) {
    this.detailLayer.removeAll(true);
    this.detailLayer.setVisible(true);

    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const w = GAME_W - 40;
    const h = 420;
    const hw = w / 2;
    const hh = h / 2;

    // Fondo oscuro: tocar fuera cierra.
    const dim = this.add
      .rectangle(0, 0, GAME_W, GAME_H, 0x02030a, 0.86)
      .setOrigin(0, 0)
      .setInteractive();
    dim.on('pointerdown', () => this.closeDetail());
    this.detailLayer.add(dim);

    const card = this.add.container(cx, cy);
    const cut = 18;
    const shape = toPts([-hw, -hh, hw - cut, -hh, hw, -hh + cut, hw, hh, -hw, hh]);
    const glow = this.add
      .image(0, 0, 'tex_glow')
      .setTint(a.color)
      .setBlendMode(ADD)
      .setAlpha(0.18)
      .setScale(w / 12, h / 18);
    const g = this.add.graphics();
    g.fillStyle(0x081521, 0.97);
    g.fillPoints(shape, true);
    g.lineStyle(2, a.color, 0.95);
    g.strokePoints(shape, true);

    // Ícono + nombre
    const icon = this.add.graphics();
    icon.fillStyle(a.color, 0.18);
    icon.lineStyle(2, a.color, 0.95);
    const ip = [];
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2 - Math.PI / 2;
      ip.push(new Phaser.Math.Vector2(-hw + 34 + Math.cos(ang) * 15, -hh + 34 + Math.sin(ang) * 15));
    }
    icon.fillPoints(ip, true);
    icon.strokePoints(ip, true);

    const kids = [glow, g, icon];
    kids.push(
      this.add.text(-hw + 60, -hh + 18, a.name, {
        fontFamily: FONT,
        fontSize: '20px',
        color: hex(a.color),
        fontStyle: 'bold'
      })
    );
    kids.push(
      this.add.text(-hw + 60, -hh + 44, a.blurb, {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#aecbe0',
        wordWrap: { width: w - 80 }
      })
    );

    const sepY = -hh + 88;
    const sep = this.add.graphics();
    sep.lineStyle(1, a.color, 0.3);
    sep.lineBetween(-hw + 20, sepY, hw - 20, sepY);
    kids.push(sep);
    kids.push(
      this.add.text(-hw + 20, sepY + 8, t('ui.specials_h'), {
        fontFamily: FONT,
        fontSize: '10px',
        color: GOLD
      })
    );
    a.specials.forEach((sp, idx) => {
      const y = sepY + 26 + idx * 40;
      kids.push(
        this.add.rectangle(-hw + 26, y + 8, 10, 10, 0xffd76a, 1).setAngle(45).setBlendMode(ADD)
      );
      kids.push(
        this.add.text(-hw + 42, y, `${ROMAN[idx]}  ${sp}`, {
          fontFamily: FONT,
          fontSize: '12px',
          color: '#e7f3ff',
          wordWrap: { width: w - 80 }
        })
      );
    });

    // -- Potencia permanente -----------------------------------------------
    const lv = Economy.powerLevel(a.id);
    const pwY = hh - 78;
    const pdiv = this.add.graphics();
    pdiv.lineStyle(1, a.color, 0.25);
    pdiv.lineBetween(-hw + 20, pwY - 10, hw - 20, pwY - 10);
    kids.push(pdiv);
    kids.push(
      this.add.text(-hw + 20, pwY, t('ui.power_row', { n: lv, m: MAX_POWER, p: lv * 12 }), {
        fontFamily: FONT,
        fontSize: '13px',
        color: lv > 0 ? GOLD : '#aecbe0'
      })
    );

    const max = Economy.isMax(a.id);
    const cost = Economy.cost(a.id);
    const afford = !max && Economy.gold() >= cost;
    const upBtn = this.add
      .rectangle(0, hh - 46, w - 56, 34, 0x0c1f2b, 0.95)
      .setStrokeStyle(2, max ? 0x44546a : afford ? 0xffd76a : 0x7a6a3a, 0.9);
    const upTx = this.add
      .text(0, hh - 46, max ? t('ui.power_max') : t('ui.upg_dmg', { c: cost }), {
        fontFamily: FONT,
        fontSize: '14px',
        color: max ? '#7f8fa0' : afford ? '#ffe9a8' : '#9a8b5a',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    kids.push(upBtn, upTx);
    if (!max) {
      upBtn.setInteractive({ useHandCursor: true });
      upBtn.on('pointerdown', () => {
        if (Economy.buyPower(a.id)) {
          Sfx.play('levelup');
          this.afterBuy();
          this.openDetail(a); // la card NO se cierra: se refresca
        } else {
          Sfx.play('hit');
          upBtn.setStrokeStyle(2, 0xff6b7d, 0.9);
        }
      });
    }

    const close = this.add
      .text(hw - 20, -hh + 16, '✕', {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#9fb6d6',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.closeDetail());
    kids.push(close);

    card.add(kids);
    card.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 200, ease: 'Back.out' });
    this.detailLayer.add(card);
  }

  // Modal de un módulo de NAVE (mejora permanente global).
  openShipDetail(mod) {
    this.detailLayer.removeAll(true);
    this.detailLayer.setVisible(true);

    const w = GAME_W - 50;
    const h = 300;
    const hw = w / 2;
    const hh = h / 2;

    const dim = this.add
      .rectangle(0, 0, GAME_W, GAME_H, 0x02030a, 0.86)
      .setOrigin(0, 0)
      .setInteractive();
    dim.on('pointerdown', () => this.closeDetail());
    this.detailLayer.add(dim);

    const card = this.add.container(GAME_W / 2, GAME_H / 2);
    const cut = 18;
    const shape = toPts([-hw, -hh, hw - cut, -hh, hw, -hh + cut, hw, hh, -hw, hh]);
    const glow = this.add
      .image(0, 0, 'tex_glow')
      .setTint(mod.color)
      .setBlendMode(ADD)
      .setAlpha(0.18)
      .setScale(w / 12, h / 16);
    const g = this.add.graphics();
    g.fillStyle(0x081521, 0.97);
    g.fillPoints(shape, true);
    g.lineStyle(2, mod.color, 0.95);
    g.strokePoints(shape, true);

    const icon = this.add.graphics();
    icon.fillStyle(mod.color, 0.18);
    icon.lineStyle(2, mod.color, 0.95);
    const ip = [];
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2 - Math.PI / 2;
      ip.push(new Phaser.Math.Vector2(-hw + 34 + Math.cos(ang) * 15, -hh + 34 + Math.sin(ang) * 15));
    }
    icon.fillPoints(ip, true);
    icon.strokePoints(ip, true);

    const lv = Economy.powerLevel(mod.id);
    const kids = [glow, g, icon];
    kids.push(
      this.add.text(-hw + 60, -hh + 16, mod.name, {
        fontFamily: FONT,
        fontSize: '20px',
        color: hex(mod.color),
        fontStyle: 'bold'
      })
    );
    kids.push(
      this.add.text(-hw + 60, -hh + 42, t('ui.shipmod_tag'), {
        fontFamily: FONT,
        fontSize: '10px',
        color: GOLD
      })
    );
    kids.push(
      this.add.text(-hw + 22, -hh + 74, mod.blurb, {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#cfeefb',
        wordWrap: { width: w - 44 },
        lineSpacing: 4
      })
    );
    kids.push(
      this.add.text(0, 8, `Nv ${lv}/${MAX_POWER}`, {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#dffcff',
        fontStyle: 'bold'
      }).setOrigin(0.5)
    );
    kids.push(
      this.add.text(0, 32, t('ui.cur', { x: mod.effect(lv) }), {
        fontFamily: FONT,
        fontSize: '13px',
        color: lv > 0 ? GOLD : '#7fb8cf'
      }).setOrigin(0.5)
    );

    const max = Economy.isMax(mod.id);
    const cost = Economy.cost(mod.id);
    const afford = !max && Economy.gold() >= cost;
    if (!max) {
      kids.push(
        this.add.text(0, 54, t('ui.nextv', { x: mod.effect(lv + 1) }), {
          fontFamily: FONT,
          fontSize: '12px',
          color: '#9fb6d6'
        }).setOrigin(0.5)
      );
    }

    const upBtn = this.add
      .rectangle(0, hh - 42, w - 56, 34, 0x0c1f2b, 0.95)
      .setStrokeStyle(2, max ? 0x44546a : afford ? 0xffd76a : 0x7a6a3a, 0.9);
    const upTx = this.add
      .text(0, hh - 42, max ? t('ui.lvl_max') : t('ui.upgrade', { c: cost }), {
        fontFamily: FONT,
        fontSize: '14px',
        color: max ? '#7f8fa0' : afford ? '#ffe9a8' : '#9a8b5a',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    kids.push(upBtn, upTx);
    if (!max) {
      upBtn.setInteractive({ useHandCursor: true });
      upBtn.on('pointerdown', () => {
        if (Economy.buyPower(mod.id)) {
          Sfx.play('levelup');
          this.afterBuy();
          this.openShipDetail(mod); // la card NO se cierra: se refresca
        } else {
          Sfx.play('hit');
          upBtn.setStrokeStyle(2, 0xff6b7d, 0.9);
        }
      });
    }

    const close = this.add
      .text(hw - 20, -hh + 16, '✕', {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#9fb6d6',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.closeDetail());
    kids.push(close);

    card.add(kids);
    card.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 200, ease: 'Back.out' });
    this.detailLayer.add(card);
  }

  // Tras comprar: refresca el oro de cabecera y marca el grid para rehacer.
  afterBuy() {
    this._dirty = true;
    if (this.goldHeader) this.goldHeader.setText(t('ui.gold_avail', { n: Economy.gold() }));
  }

  closeDetail() {
    Sfx.play('ui');
    this.detailLayer.setVisible(false).removeAll(true);
    // Al cerrar, si hubo compras, rehace la cuadrícula (footers actualizados).
    if (this._dirty) this.scene.restart();
  }

  update(time, delta) {
    this.backdrop.update(Math.min(delta, 50));
  }
}
