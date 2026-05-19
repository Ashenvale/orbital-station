import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.js';
import { WEAPONS, tx, wname, wblurb } from '../data/upgrades.js';
import { buildTile } from '../ui/abilityTile.js';
import { buildButton } from '../ui/button.js';
import { Sfx } from '../sfx.js';
import { t } from '../i18n.js';
import { Music } from '../music.js';

const ADD = Phaser.BlendModes.ADD;
const FONT = '"Pixelify Sans", "VT323", ui-monospace, monospace';
const FONT_DATA = '"VT323", "Pixelify Sans", ui-monospace, monospace';
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    this.gs = this.scene.get('GameScene');

    // -- Marco / esquinas holograficas --------------------------------------
    const frame = this.add.graphics();
    frame.lineStyle(1, COLORS.station, 0.25);
    frame.strokeRect(6, 6, GAME_W - 12, GAME_H - 12);
    this.drawCorners(frame, COLORS.station);

    // -- HUD superior (panel holográfico) -----------------------------------
    const PANEL_H = 90;
    this.add.rectangle(0, 0, GAME_W, PANEL_H, 0x1c0d34, 0.78).setOrigin(0, 0);
    this.add.rectangle(0, PANEL_H, GAME_W, 2, COLORS.laser, 0.85).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_W, 1, 0xffffff, 0.12).setOrigin(0, 0);

    // --- Fila de chips: NIVEL · TIEMPO/OBJETIVO · BAJAS · ORO -------------
    const chips = [
      { key: 'level', label: t('ui.c_level'), color: '#00f0ff' },
      { key: 'mid', label: t('ui.c_time'), color: '#00f0ff' },
      { key: 'kills', label: t('ui.c_kills'), color: '#ffffff' },
      { key: 'gold', label: t('ui.c_gold'), color: '#ffe640' }
    ];
    const m = 12;
    const colW = (GAME_W - m * 2) / chips.length;
    this.chipLabels = {};
    this.chipValues = {};
    chips.forEach((c, i) => {
      const cxk = m + colW * (i + 0.5);
      if (i > 0) {
        this.add
          .rectangle(m + colW * i, 10, 2, 32, COLORS.laser, 0.35)
          .setOrigin(0.5, 0);
      }
      this.chipLabels[c.key] = this.add
        .text(cxk, 11, c.label, { fontFamily: FONT_DATA, fontSize: '13px', color: '#c084ff' })
        .setOrigin(0.5, 0);
      this.chipValues[c.key] = this.add
        .text(cxk, 26, '–', {
          fontFamily: FONT,
          fontSize: '24px',
          color: c.color,
          fontStyle: 'bold'
        })
        .setOrigin(0.5, 0);
    });

    // --- Barra de INTEGRIDAD ----------------------------------------------
    this.HPX = 18;
    this.HPY = 70;
    this.HPW = GAME_W - 36;
    this.HPH = 14;

    this.add
      .text(this.HPX, 58, t('ui.integrity'), { fontFamily: FONT_DATA, fontSize: '13px', color: '#c084ff' })
      .setOrigin(0, 0.5);
    this.hpText = this.add
      .text(this.HPX + this.HPW, 58, '', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(1, 0.5);

    const f = this.add.graphics();
    f.lineStyle(2, COLORS.laser, 0.55);
    f.strokeRect(this.HPX - 4, this.HPY - 3, this.HPW + 8, this.HPH + 6);
    // Pixel corners
    f.fillStyle(COLORS.laser, 0.9);
    f.fillRect(this.HPX - 4, this.HPY - 3, 5, 5);
    f.fillRect(this.HPX + this.HPW - 1, this.HPY - 3, 5, 5);
    f.fillRect(this.HPX - 4, this.HPY + this.HPH - 2, 5, 5);
    f.fillRect(this.HPX + this.HPW - 1, this.HPY + this.HPH - 2, 5, 5);

    this.hpGfx = this.add.graphics();
    this.hpGlow = this.add.graphics().setBlendMode(ADD);

    this.add.rectangle(this.HPX, this.HPY + this.HPH + 6, this.HPW, 4, 0x3a1268, 0.7).setOrigin(0, 0);
    this.xpBar = this.add
      .rectangle(this.HPX, this.HPY + this.HPH + 6, 0, 4, COLORS.xp)
      .setOrigin(0, 0)
      .setBlendMode(ADD);

    // Botón de silencio (fila de controles, encima de los slots)
    this.muteBtn = this.add
      .text(GAME_W - 14, GAME_H - 56, '', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#00f0ff'
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    const refreshMute = () =>
      this.muteBtn.setText(Sfx.isMuted() ? t('ui.snd_off') : t('ui.snd_on')).setColor(
        Sfx.isMuted() ? '#ff3a5e' : '#00f0ff'
      );
    refreshMute();
    this.muteBtn.on('pointerover', () => Sfx.play('hover'));
    this.muteBtn.on('pointerdown', () => {
      Sfx.toggleMute();
      Music.setMuted(Sfx.isMuted()); // el botón corta SFX + música
      if (!Sfx.isMuted()) Sfx.play('tap');
      this.tweens.add({
        targets: this.muteBtn,
        scale: 0.88,
        duration: 70,
        yoyo: true,
        ease: 'Quad.out'
      });
      refreshMute();
    });

    // -- Ranuras de habilidades (inferior): 4 chips visuales ---------------
    this.add
      .text(GAME_W / 2, GAME_H - 54, t('ui.modules_eq'), {
        fontFamily: FONT_DATA,
        fontSize: '13px',
        color: '#c084ff'
      })
      .setOrigin(0.5);
    const sm = 8;
    const sg = 6;
    const sw = (GAME_W - sm * 2 - sg * 3) / 4;
    const sh = 40;
    const syc = GAME_H - 24;
    this.slotUI = [];
    for (let i = 0; i < 4; i++) {
      const sx = sm + sw / 2 + i * (sw + sg);
      const box = this.add
        .rectangle(sx, syc, sw, sh, 0x1c0d34, 0.92)
        .setStrokeStyle(2.5, 0x7a5fa8, 0.7)
        .setInteractive({ useHandCursor: true });
      const nm = this.add
        .text(sx, syc - 8, '—', {
          fontFamily: FONT,
          fontSize: '15px',
          color: '#7a5fa8',
          fontStyle: 'bold'
        })
        .setOrigin(0.5);
      const lv = this.add
        .text(sx, syc + 10, t('ui.slot_free'), {
          fontFamily: FONT_DATA,
          fontSize: '12px',
          color: '#7a5fa8'
        })
        .setOrigin(0.5);
      const slot = { box, nm, lv, sig: '', weaponId: null };
      box.on('pointerover', () => slot.weaponId && Sfx.play('hover'));
      box.on('pointerdown', () => {
        if (!slot.weaponId || !this.gs.running || this.gs.drafting) return;
        Sfx.play('open');
        this.tweens.add({
          targets: box,
          scale: 0.92,
          duration: 70,
          yoyo: true,
          ease: 'Quad.out'
        });
        this.gs.pauseGame();
        this.showWeaponInfo(slot.weaponId);
      });
      this.slotUI.push(slot);
    }

    // Botón de pausa / volver (fila de controles, encima de los slots)
    this.pauseBtn = this.add
      .text(14, GAME_H - 56, t('ui.pause_btn'), {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#00f0ff',
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerover', () => Sfx.play('hover'));
    this.pauseBtn.on('pointerdown', () => {
      if (!this.gs.running || this.gs.drafting) return;
      Sfx.play('open');
      this.tweens.add({
        targets: this.pauseBtn,
        scale: 0.9,
        duration: 70,
        yoyo: true,
        ease: 'Quad.out'
      });
      this.gs.pauseGame();
      this.showPause();
    });

    // -- Overlays -----------------------------------------------------------
    this.draftLayer = this.add.container(0, 0).setVisible(false).setDepth(50);
    this.overLayer = this.add.container(0, 0).setVisible(false).setDepth(50);
    this.pauseLayer = this.add.container(0, 0).setVisible(false).setDepth(50);
    this.infoLayer = this.add.container(0, 0).setVisible(false).setDepth(50);
    this.enemyCardLayer = this.add.container(0, 0).setVisible(false).setDepth(46);
    this.enemyCardQueue = [];
    this.enemyCardActive = false;
    this.tutorialLayer = this.add.container(0, 0).setVisible(false).setDepth(55);

    // Re-bind limpio: evita listeners duplicados si se vuelve del menú.
    this.gs.events.off('levelup', this.showDraft, this);
    this.gs.events.off('gameover', this.showGameOver, this);
    this.gs.events.off('levelclear', this.showLevelClear, this);
    this.gs.events.off('enemyintro', this.queueEnemyCard, this);
    this.gs.events.off('reset', this.clearOverlays, this);
    this.gs.events.off('draftclosed', this.tutOnDraftClosed, this);
    this.gs.events.off('unlocked', this.showUnlock, this);
    this.gs.events.on('levelup', this.showDraft, this);
    this.gs.events.on('gameover', this.showGameOver, this);
    this.gs.events.on('levelclear', this.showLevelClear, this);
    this.gs.events.on('enemyintro', this.queueEnemyCard, this);
    this.gs.events.on('reset', this.clearOverlays, this);
    this.gs.events.on('draftclosed', this.tutOnDraftClosed, this);
    this.gs.events.on('unlocked', this.showUnlock, this);
    this.events.once('shutdown', () => {
      this.gs.events.off('levelup', this.showDraft, this);
      this.gs.events.off('gameover', this.showGameOver, this);
      this.gs.events.off('levelclear', this.showLevelClear, this);
      this.gs.events.off('enemyintro', this.queueEnemyCard, this);
      this.gs.events.off('reset', this.clearOverlays, this);
      this.gs.events.off('draftclosed', this.tutOnDraftClosed, this);
      this.gs.events.off('unlocked', this.showUnlock, this);
    });

    if (this.gs.tutorial) this.tutStart();
  }

  drawCorners(g, color) {
    g.lineStyle(2, color, 0.8);
    const L = 22;
    const m = 6;
    const W = GAME_W;
    const H = GAME_H;
    g.lineBetween(m, m + L, m, m).lineBetween(m, m, m + L, m);
    g.lineBetween(W - m - L, m, W - m, m).lineBetween(W - m, m, W - m, m + L);
    g.lineBetween(m, H - m - L, m, H - m).lineBetween(m, H - m, m + L, H - m);
    g.lineBetween(W - m - L, H - m, W - m, H - m).lineBetween(W - m, H - m, W - m, H - m - L);
  }

  // Barra de integridad por celdas de neón (chunky arcade) + escudo y glow.
  drawHpBar(h) {
    const g = this.hpGfx;
    const gl = this.hpGlow;
    g.clear();
    gl.clear();
    const ratio = Phaser.Math.Clamp(h.hp / h.maxHp, 0, 1);
    const col = ratio > 0.5 ? 0x5bffb8 : ratio > 0.25 ? 0xffe640 : 0xff3a5e;
    const cells = 22;
    const gap = 3;
    const cw = (this.HPW - (cells - 1) * gap) / cells;
    const lit = Math.ceil(cells * ratio);

    for (let i = 0; i < cells; i++) {
      const x = this.HPX + i * (cw + gap);
      if (i < lit) {
        g.fillStyle(col, 1);
        g.fillRect(x, this.HPY, cw, this.HPH);
        gl.fillStyle(col, 0.55);
        gl.fillRect(x - 2, this.HPY - 2, cw + 4, this.HPH + 4);
      } else {
        g.fillStyle(0x3a1268, 0.55);
        g.fillRect(x, this.HPY + this.HPH * 0.3, cw, this.HPH * 0.4);
      }
    }

    // Escudo: línea fina justo encima de la barra.
    if (h.shieldMax > 0) {
      const sr = Phaser.Math.Clamp(h.shield / h.shieldMax, 0, 1);
      g.fillStyle(0x10081f, 0.8);
      g.fillRect(this.HPX, this.HPY - 7, this.HPW, 4);
      gl.fillStyle(COLORS.shield, 0.95);
      gl.fillRect(this.HPX, this.HPY - 7, this.HPW * sr, 4);
    }
  }

  update() {
    if (!this.gs || !this.gs.scene.isActive() || this.gs.hp === undefined) return;
    const h = this.gs.getHud();

    this.drawHpBar(h);
    this.hpText.setText(
      `${Math.ceil(h.hp)}/${h.maxHp}` +
        (h.shieldMax > 0 ? `  ⛉${Math.ceil(h.shield)}` : '')
    );

    this.xpBar.width = this.HPW * Phaser.Math.Clamp(h.xp / h.xpToNext, 0, 1);

    const secs = Math.floor(h.time / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');

    this.chipValues.level.setText(h.level);
    this.chipValues.gold.setText(h.gold || 0);
    if (h.mode === 'level') {
      this.chipLabels.mid.setText(t('ui.c_time'));
      this.chipValues.mid.setText(`${mm}:${ss}`);
    } else {
      this.chipLabels.mid.setText(t('ui.c_dif', { t: `${mm}:${ss}` }));
      this.chipValues.mid.setText(`${h.diff}`);
      this.chipValues.mid.setColor('#ffc14f');
    }

    if (h.mode === 'level') {
      this.chipLabels.kills.setText(t('ui.c_obj', { n: h.levelNum }));
      const q = h.quota || 0;
      const quotaDone = q >= h.targetKills;
      // Marca de jefe: ⚑ rojo = jefe vivo (falta matarlo aunque la cuota esté).
      const bossTag = h.bossId ? (h.bossKilled ? ' ✔' : ' ⚑') : '';
      this.chipValues.kills.setText(`${q}/${h.targetKills}${bossTag}`);
      const allDone = quotaDone && (!h.bossId || h.bossKilled);
      const close = q >= h.targetKills * 0.8;
      this.chipValues.kills.setColor(allDone ? '#7affc4' : close ? '#ffc14f' : '#7fe8ff');
    } else {
      this.chipLabels.kills.setText(t('ui.c_kills'));
      this.chipValues.kills.setText(h.kills);
    }

    const ws = h.weapons || [];
    for (let i = 0; i < this.slotUI.length; i++) {
      const s = this.slotUI[i];
      const w = ws[i];
      if (!w) {
        s.weaponId = null;
        if (s.sig !== 'empty') {
          s.sig = 'empty';
          s.box.setStrokeStyle(1.5, 0x33485c, 0.6);
          s.nm.setText('—').setColor('#5a6b7c');
          s.lv.setText(t('ui.slot_free')).setColor('#5a6b7c');
        }
        continue;
      }
      s.weaponId = w.id;
      const sig = `${w.id}:${w.commons}:${w.specials}`;
      if (s.sig === sig) continue;
      s.sig = sig;
      const ch = '#' + w.color.toString(16).padStart(6, '0');
      // Etiqueta: nº de comunes y especiales tomados (ej. "C3 · E1").
      const tag = w.specials > 0 ? `C${w.commons} · E${w.specials}` : `C${w.commons}`;
      s.box.setStrokeStyle(2, w.color, 0.95);
      s.nm.setText(w.name).setColor(ch);
      s.lv.setText(tag).setColor(w.specials > 0 ? '#ffd76a' : '#9fb6d6');
    }
  }

  // ===========================================================================
  //  DRAFT (subir de nivel) — usa la card sci-fi compartida
  // ===========================================================================
  showDraft({ choices, level, dev }) {
    if (dev) return this.showDraftDev(choices, level);
    this.draftLayer.removeAll(true);
    this.draftLayer.setVisible(true);

    this.draftLayer.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x10081f, 0.92).setOrigin(0, 0));

    // Big arcade "LEVEL UP!" with chromatic offset
    const titleY = GAME_H / 2 - 220;
    this.draftLayer.add(
      this.add
        .text(GAME_W / 2 - 3, titleY, t('ui.draft_title', { n: level }).toUpperCase(), {
          fontFamily: FONT,
          fontSize: '40px',
          color: '#ff2bd6',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setBlendMode(ADD)
        .setAlpha(0.9)
    );
    this.draftLayer.add(
      this.add
        .text(GAME_W / 2 + 3, titleY, t('ui.draft_title', { n: level }).toUpperCase(), {
          fontFamily: FONT,
          fontSize: '40px',
          color: '#00f0ff',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setBlendMode(ADD)
        .setAlpha(0.9)
    );
    this.draftLayer.add(
      this.add
        .text(GAME_W / 2, titleY, t('ui.draft_title', { n: level }).toUpperCase(), {
          fontFamily: FONT,
          fontSize: '40px',
          color: '#ffffff',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
    );
    this.draftLayer.add(
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 184, t('ui.draft_sub'), {
          fontFamily: FONT_DATA,
          fontSize: '16px',
          color: '#ffe640'
        })
        .setOrigin(0.5)
    );

    const margin = 14;
    const gap = 10;
    const tileW = (GAME_W - margin * 2 - gap * 2) / 3;
    const tileH = 322;
    const cy = GAME_H / 2 + 26;

    // "Cinta" arcade detrás de las 3 opciones.
    const bandY = cy - tileH / 2 - 14;
    const bandH = tileH + 28;
    this.draftLayer.add(
      this.add.rectangle(0, bandY, GAME_W, bandH, 0x1c0d34, 0.7).setOrigin(0, 0)
    );
    const band = this.add.graphics();
    band.lineStyle(3, COLORS.laser, 0.85);
    band.lineBetween(0, bandY, GAME_W, bandY);
    band.lineBetween(0, bandY + bandH, GAME_W, bandY + bandH);
    band.lineStyle(1, COLORS.station, 0.45);
    band.lineBetween(0, bandY + 6, GAME_W, bandY + 6);
    band.lineBetween(0, bandY + bandH - 6, GAME_W, bandY + bandH - 6);
    this.draftLayer.add(band);

    choices.forEach((c, i) => {
      const tile = buildTile(this, {
        cx: margin + tileW / 2 + i * (tileW + gap),
        cy,
        w: tileW,
        h: tileH,
        color: c.color,
        name: c.name,
        icon: c.icon || c.id,
        badge:
          c.badge && c.levelLabel
            ? `${c.badge} · ${c.levelLabel}`
            : c.badge || c.levelLabel || null,
        body: c.desc,
        level: c.pips ? c.level || 0 : null,
        popDelay: i * 80,
        onClick: () => {
          this.tweens.killAll();
          this.draftLayer.setVisible(false);
          this.draftLayer.removeAll(true);
          this.gs.chooseDraft(c.id);
        }
      });
      this.draftLayer.add(tile);
    });

    this.tutOnDraft(); // coach contextual (solo 1ª vez, tutorial)
  }

  // QA dev: TODAS las cartas en una grilla scrolleable (elegí cualquiera).
  showDraftDev(choices, level) {
    if (this._devScrollOff) this._devScrollOff(); // limpia listeners previos
    this.draftLayer.removeAll(true);
    this.draftLayer.setVisible(true);
    this.draftLayer.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x10081f, 0.95).setOrigin(0, 0));
    this.draftLayer.add(
      this.add
        .text(GAME_W / 2, 34, `DEV · LEVEL ${level} — elegí cualquiera`, {
          fontFamily: FONT,
          fontSize: '20px',
          color: '#ffe640',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
    );

    const margin = 14;
    const gap = 10;
    const cols = 3;
    const tileW = (GAME_W - margin * 2 - gap * (cols - 1)) / cols;
    const tileH = 132;
    const listTop = 62;
    const listH = GAME_H - listTop - 16;

    const grid = this.add.container(0, listTop);
    this.draftLayer.add(grid);
    const maskG = this.add.graphics().setVisible(false);
    maskG.fillRect(0, listTop, GAME_W, listH);
    grid.setMask(maskG.createGeometryMask());

    choices.forEach((c, i) => {
      grid.add(
        buildTile(this, {
          cx: margin + tileW / 2 + (i % cols) * (tileW + gap),
          cy: tileH / 2 + Math.floor(i / cols) * (tileH + gap),
          w: tileW,
          h: tileH,
          color: c.color,
          name: c.name,
          icon: c.icon || c.id,
          compact: true,
          footer:
            c.badge && c.levelLabel
              ? `${c.badge} · ${c.levelLabel}`
              : c.badge || c.levelLabel || '',
          footerColor: '#cfeefb',
          onClick: () => {
            this.tweens.killAll();
            if (this._devScrollOff) this._devScrollOff();
            this.draftLayer.setVisible(false);
            this.draftLayer.removeAll(true);
            this.gs.chooseDraft(c.id);
          }
        })
      );
    });

    const rows = Math.ceil(choices.length / cols);
    const totalH = rows * tileH + (rows - 1) * gap + 10;
    let scrollY = 0;
    let drag = false;
    let lastY = 0;
    const minScroll = Math.min(0, listH - totalH);
    const apply = (d) => {
      scrollY = Phaser.Math.Clamp(scrollY + d, minScroll, 0);
      grid.y = listTop + scrollY;
    };
    const onWheel = (p, go, dx, dy) => apply(-dy);
    const onDown = (p) => {
      if (p.y > listTop) {
        drag = true;
        lastY = p.y;
      }
    };
    const onMove = (p) => {
      if (drag && p.isDown) {
        apply(p.y - lastY);
        lastY = p.y;
      }
    };
    const onUp = () => (drag = false);
    this.input.on('wheel', onWheel);
    this.input.on('pointerdown', onDown);
    this.input.on('pointermove', onMove);
    this.input.on('pointerup', onUp);
    this._devScrollOff = () => {
      this.input.off('wheel', onWheel);
      this.input.off('pointerdown', onDown);
      this.input.off('pointermove', onMove);
      this.input.off('pointerup', onUp);
      this._devScrollOff = null;
    };
  }

  // Aviso no bloqueante "arma desbloqueada" (lo dispara GameScene una vez).
  showUnlock({ name, color }) {
    const cx = GAME_W / 2;
    const y = 148;
    const w = GAME_W - 70;
    const h = 76;
    const cont = this.add.container(0, 0).setDepth(57);
    const g = this.add.graphics();
    g.fillStyle(0x0a1830, 0.96);
    g.fillRoundedRect(cx - w / 2, y - h / 2, w, h, 12);
    g.lineStyle(2, color, 0.95);
    g.strokeRoundedRect(cx - w / 2, y - h / 2, w, h, 12);
    const t1 = this.add
      .text(cx, y - 14, t('ui.unlock_h'), {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#ffe640',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    const t2 = this.add
      .text(cx, y + 13, name, {
        fontFamily: FONT,
        fontSize: '22px',
        color: hex(color),
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    cont.add([g, t1, t2]);
    cont.setAlpha(0).setScale(0.9);
    this.tweens.add({ targets: cont, alpha: 1, scale: 1, duration: 260, ease: 'Back.out' });
    this.tweens.add({
      targets: cont,
      alpha: 0,
      delay: 2600,
      duration: 420,
      onComplete: () => cont.destroy()
    });
  }

  // ===========================================================================
  //  GAME OVER
  // ===========================================================================
  showGameOver({ time, kills, level, gold }) {
    this.overLayer.removeAll(true);
    this.overLayer.setVisible(true);

    const secs = Math.floor(time / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');

    this.overLayer.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x10081f, 0.94).setOrigin(0, 0));
    this.overLayer.add(
      this.add
        .image(GAME_W / 2, GAME_H / 2 - 120, 'tex_glow')
        .setTint(0xff3a5e)
        .setBlendMode(ADD)
        .setAlpha(0.55)
        .setScale(11, 4)
    );
    this.overLayer.add(
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 130, t('ui.go_title').toUpperCase(), {
          fontFamily: FONT,
          fontSize: '40px',
          color: '#ff3a5e',
          fontStyle: 'bold',
          stroke: '#10081f',
          strokeThickness: 4
        })
        .setOrigin(0.5)
    );
    this.overLayer.add(
      this.add
        .text(
          GAME_W / 2,
          GAME_H / 2 - 50,
          t('ui.go_stats', { t: `${mm}:${ss}`, n: level, k: kills, g: gold || 0 }),
          { fontFamily: FONT_DATA, fontSize: '20px', color: '#ffffff', align: 'left', lineSpacing: 10 }
        )
        .setOrigin(0.5)
    );

    this.overLayer.add(
      buildButton(this, GAME_W / 2, GAME_H / 2 + 90, 260, 64, t('ui.retry'), COLORS.laser, () => {
        this.clearOverlays();
        this.gs.restartGame();
      })
    );
    const back = this.gs.mode === 'level' ? 'LevelsScene' : 'MenuScene';
    this.overLayer.add(
      buildButton(this, GAME_W / 2, GAME_H / 2 + 162, 260, 56, this.gs.mode === 'level' ? t('ui.map') : t('ui.menu'), COLORS.station, () => {
        this.clearOverlays();
        this.scene.stop('GameScene');
        this.scene.start(back); // apaga UIScene (la llamadora)
      })
    );
  }

  // ===========================================================================
  //  NIVEL COMPLETADO (campaña)
  // ===========================================================================
  showLevelClear({ level, name, kills, next, gold, stars = 1, starBest = 1, starGold = 0 }) {
    this.overLayer.removeAll(true);
    this.overLayer.setVisible(true);

    this.overLayer.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x10081f, 0.94).setOrigin(0, 0));
    this.overLayer.add(
      this.add
        .image(GAME_W / 2, GAME_H / 2 - 120, 'tex_glow')
        .setTint(COLORS.xp)
        .setBlendMode(ADD)
        .setAlpha(0.55)
        .setScale(11, 4)
    );
    // Big VICTORY! con offset cromático
    const titleStr = t('ui.lc_title', { n: level }).toUpperCase();
    this.overLayer.add(
      this.add
        .text(GAME_W / 2 - 3, GAME_H / 2 - 132, titleStr, {
          fontFamily: FONT, fontSize: '36px', color: '#ff2bd6', fontStyle: 'bold'
        }).setOrigin(0.5).setBlendMode(ADD).setAlpha(0.85)
    );
    this.overLayer.add(
      this.add
        .text(GAME_W / 2 + 3, GAME_H / 2 - 132, titleStr, {
          fontFamily: FONT, fontSize: '36px', color: '#00f0ff', fontStyle: 'bold'
        }).setOrigin(0.5).setBlendMode(ADD).setAlpha(0.85)
    );
    this.overLayer.add(
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 132, titleStr, {
          fontFamily: FONT, fontSize: '36px', color: '#ffe640', fontStyle: 'bold',
          stroke: '#10081f', strokeThickness: 4
        }).setOrigin(0.5)
    );
    this.overLayer.add(
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 96, name || '', {
          fontFamily: FONT_DATA, fontSize: '17px', color: '#c084ff'
        }).setOrigin(0.5)
    );

    // Estrellas (1-3) por integridad del casco — pop escalonado con sonido.
    const sy = GAME_H / 2 - 58;
    for (let i = 0; i < 3; i++) {
      const lit = i < stars;
      const star = this.add
        .text(GAME_W / 2 + (i - 1) * 52, sy, lit ? '★' : '☆', {
          fontFamily: FONT,
          fontSize: '42px',
          color: lit ? '#ffe640' : '#5a2a8a'
        })
        .setOrigin(0.5);
      this.overLayer.add(star);
      if (lit) {
        star.setScale(0).setAlpha(0);
        this.tweens.add({
          targets: star,
          scale: 1,
          alpha: 1,
          ease: 'Back.out',
          duration: 320,
          delay: 380 + i * 260,
          onStart: () => Sfx.play('star')
        });
      }
    }
    this.overLayer.add(
      this.add
        .text(
          GAME_W / 2,
          sy + 38,
          starGold > 0
            ? t('ui.lc_stars_gold', { g: starGold })
            : t('ui.lc_record', { n: starBest }),
          { fontFamily: FONT_DATA, fontSize: '15px', color: starGold > 0 ? '#ffe640' : '#c084ff' }
        )
        .setOrigin(0.5)
    );

    this.overLayer.add(
      this.add
        .text(GAME_W / 2, GAME_H / 2 + 34, t('ui.lc_stats', { k: kills, g: gold || 0 }), {
          fontFamily: FONT_DATA,
          fontSize: '19px',
          color: '#ffffff',
          align: 'center',
          lineSpacing: 8
        })
        .setOrigin(0.5)
    );

    let y = GAME_H / 2 + 104;
    if (next) {
      this.overLayer.add(
        buildButton(this, GAME_W / 2, y, 270, 64, t('ui.next'), COLORS.laser, () => {
          this.clearOverlays();
          this.scene.stop('GameScene');
          this.scene.start('GameScene', { level: next });
        })
      );
      y += 80;
    } else {
      this.overLayer.add(
        this.add
          .text(GAME_W / 2, y, t('ui.campaign_done'), {
            fontFamily: FONT,
            fontSize: '20px',
            color: '#ffe640',
            fontStyle: 'bold'
          })
          .setOrigin(0.5)
      );
      y += 56;
    }
    this.overLayer.add(
      buildButton(this, GAME_W / 2, y, 270, 56, t('ui.starmap_btn'), COLORS.station, () => {
        this.clearOverlays();
        this.scene.stop('GameScene');
        this.scene.start('LevelsScene');
      })
    );
  }

  // ===========================================================================
  //  PAUSA / VOLVER (ambos modos)
  // ===========================================================================
  showPause() {
    this.pauseLayer.removeAll(true);
    this.pauseLayer.setVisible(true);
    this.pauseLayer.add(
      this.add.rectangle(0, 0, GAME_W, GAME_H, 0x02030a, 0.9).setOrigin(0, 0)
    );
    this.pauseLayer.add(
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 120, t('ui.pause'), {
          fontFamily: FONT,
          fontSize: '30px',
          color: hex(COLORS.station),
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
    );

    const back = this.gs.mode === 'level' ? 'LevelsScene' : 'MenuScene';
    this.pauseLayer.add(
      buildButton(this, GAME_W / 2, GAME_H / 2 - 20, 230, 56, t('ui.resume'), COLORS.station, () => {
        this.pauseLayer.setVisible(false).removeAll(true);
        this.gs.resumeGame();
      })
    );
    this.pauseLayer.add(
      buildButton(this, GAME_W / 2, GAME_H / 2 + 52, 230, 50, t('ui.restart'), COLORS.xp, () => {
        this.pauseLayer.setVisible(false).removeAll(true);
        this.gs.restartGame();
      })
    );
    this.pauseLayer.add(
      buildButton(
        this,
        GAME_W / 2,
        GAME_H / 2 + 118,
        230,
        50,
        this.gs.mode === 'level' ? t('ui.map') : t('ui.menu'),
        COLORS.orb,
        () => {
          this.pauseLayer.setVisible(false).removeAll(true);
          this.scene.stop('GameScene');
          this.scene.start(back);
        }
      )
    );
  }

  // ===========================================================================
  //  CARD DE ENEMIGO NUEVO (no bloqueante, en cola)
  // ===========================================================================
  queueEnemyCard(data) {
    this.enemyCardQueue.push(data);
    if (!this.enemyCardActive) this.showNextEnemyCard();
  }

  showNextEnemyCard() {
    if (!this.enemyCardQueue || this.enemyCardQueue.length === 0) {
      this.enemyCardActive = false;
      return;
    }
    this.enemyCardActive = true;
    const d = this.enemyCardQueue.shift();

    const w = GAME_W - 60;
    const h = 104;
    const x = 30;
    const y = 96;
    this.enemyCardLayer.removeAll(true);
    this.enemyCardLayer.setVisible(true);

    const g = this.add.graphics();
    g.fillStyle(0x081521, 0.95);
    g.fillRect(x, y, w, h);
    g.lineStyle(2, d.color, 0.9);
    g.strokeRect(x, y, w, h);
    g.fillStyle(d.color, 0.9);
    g.fillRect(x, y, 4, h);

    const tag = this.add.text(x + 14, y + 10, t('ui.new_enemy'), {
      fontFamily: FONT,
      fontSize: '10px',
      color: '#ffd76a',
      fontStyle: 'bold'
    });
    const name = this.add.text(x + 14, y + 24, d.name, {
      fontFamily: FONT,
      fontSize: '18px',
      color: hex(d.color),
      fontStyle: 'bold'
    });
    const info = this.add.text(x + 14, y + 48, d.info || '', {
      fontFamily: FONT,
      fontSize: '11px',
      color: '#cfeefb',
      wordWrap: { width: w - 28 }
    });
    const hasR = d.resiste && d.resiste.length;
    const hasW = d.debil && d.debil.length;
    const rLine =
      (hasR ? t('ui.resists', { l: d.resiste.join(', ') }) : '') +
      (hasR && hasW ? '   ·   ' : '') +
      (hasW ? t('ui.weak', { l: d.debil.join(', ') }) : '');
    const res = this.add.text(x + 14, y + h - 18, rLine || t('ui.no_res'), {
      fontFamily: FONT,
      fontSize: '11px',
      color: '#9fb6d6'
    });

    this.enemyCardLayer.add([g, tag, name, info, res]);
    this.enemyCardLayer.setAlpha(0).setY(-10);
    this.tweens.add({
      targets: this.enemyCardLayer,
      alpha: 1,
      y: 0,
      duration: 260,
      ease: 'Back.out',
      onComplete: () => {
        this.time.delayedCall(3600, () => {
          this.tweens.add({
            targets: this.enemyCardLayer,
            alpha: 0,
            y: -10,
            duration: 260,
            onComplete: () => {
              this.enemyCardLayer.setVisible(false).removeAll(true).setAlpha(1).setY(0);
              this.showNextEnemyCard();
            }
          });
        });
      }
    });
  }

  // Card de info de un arma equipada (al tocar su ranura). Pausa el juego.
  showWeaponInfo(wid) {
    const W = WEAPONS[wid];
    const st = this.gs.up && this.gs.up[wid];
    if (!W || !st) return;
    this.infoLayer.removeAll(true);
    this.infoLayer.setVisible(true);
    const w = GAME_W - 60;
    const hh = 320;
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;

    this.infoLayer.add(
      this.add
        .rectangle(0, 0, GAME_W, GAME_H, 0x02030a, 0.86)
        .setOrigin(0, 0)
        .setInteractive()
        .on('pointerdown', () => this.closeInfo())
    );
    const g = this.add.graphics();
    g.fillStyle(0x081521, 0.97);
    g.fillRect(cx - w / 2, cy - hh / 2, w, hh);
    g.lineStyle(2, W.color, 0.95);
    g.strokeRect(cx - w / 2, cy - hh / 2, w, hh);
    this.infoLayer.add(g);
    const lx = cx - w / 2 + 18;
    let y = cy - hh / 2 + 16;
    this.infoLayer.add(
      this.add.text(lx, y, wname(wid), {
        fontFamily: FONT,
        fontSize: '20px',
        color: hex(W.color),
        fontStyle: 'bold'
      })
    );
    this.infoLayer.add(
      this.add
        .text(cx + w / 2 - 18, y + 2, `[ ${t('dmg.' + W.type) || W.type} ]`, {
          fontFamily: FONT,
          fontSize: '12px',
          color: '#9fb6d6',
          fontStyle: 'bold'
        })
        .setOrigin(1, 0)
    );
    y += 28;
    const bl = this.add.text(lx, y, wblurb(wid), {
      fontFamily: FONT_DATA,
      fontSize: '12px',
      color: '#aecbe0',
      wordWrap: { width: w - 36 },
      lineSpacing: 3
    });
    this.infoLayer.add(bl);
    y += bl.height + 14;
    // SOLO lo que el jugador tiene en esta partida (su build), no el catálogo.
    this.infoLayer.add(
      this.add.text(lx, y, t('ui.upgrades_h'), {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#ffd76a'
      })
    );
    y += 18;
    const owned = W.commons.filter((c) => (st.commons[c.id] || 0) > 0);
    if (!owned.length) {
      this.infoLayer.add(
        this.add.text(lx, y, '—', { fontFamily: FONT, fontSize: '11px', color: '#5a6b7c' })
      );
      y += 26;
    } else {
      owned.forEach((c) => {
        const n = st.commons[c.id] || 0;
        this.infoLayer.add(
          this.add.text(lx, y, `${tx(c.nm)}  ${n}/${c.max}  ·  ${tx(c.ds)}`, {
            fontFamily: FONT,
            fontSize: '11px',
            color: '#e7f3ff',
            wordWrap: { width: w - 36 }
          })
        );
        y += 26;
      });
    }
    const tk = W.specials.filter((sp) => st.specials.includes(sp.id));
    if (tk.length) {
      y += 6;
      this.infoLayer.add(
        this.add.text(lx, y, t('ui.tag_special'), {
          fontFamily: FONT,
          fontSize: '10px',
          color: '#ffd76a'
        })
      );
      y += 18;
      tk.forEach((sp) => {
        this.infoLayer.add(
          this.add.text(lx, y, `✦  ${tx(sp.nm)}  —  ${tx(sp.ds)}`, {
            fontFamily: FONT,
            fontSize: '11px',
            color: '#e7f3ff',
            wordWrap: { width: w - 36 }
          })
        );
        y += 28;
      });
    }
    this.infoLayer.add(
      buildButton(this, cx, cy + hh / 2 - 26, 200, 40, t('ui.resume'), COLORS.station, () =>
        this.closeInfo()
      )
    );
  }

  closeInfo() {
    this.infoLayer.setVisible(false).removeAll(true);
    if (this.gs.paused) this.gs.resumeGame();
  }

  // ===========================================================================
  //  TUTORIAL IN-GAME (coach-marks contextuales, no bloquea el juego).
  //  Burbujas que aparecen por eventos reales: inicio → 1er draft → objetivo.
  // ===========================================================================
  tutStart() {
    this._tutDraftDone = false;
    this._tutObjDone = false;
    this._tutCoach = null;
    // Cola de burbujas iniciales (mientras el juego ya corre).
    this._tutEarly = [
      { key: 'ui.tut1', ax: GAME_W / 2, ay: GAME_H / 2, by: GAME_H / 2 - 150 },
      { key: 'ui.tut2', ax: GAME_W / 2, ay: 40, by: 150 }
    ];
    this.time.delayedCall(700, () => this.gs.tutorial && this.tutNextEarly());
  }

  tutNextEarly() {
    const step = this._tutEarly.shift();
    if (!step) return; // se acabaron; el resto lo disparan los eventos
    const first = step.key === 'ui.tut1';
    this.tutCoach({
      text: t(step.key),
      ax: step.ax,
      ay: step.ay,
      by: step.by,
      autoMs: 16000, // solo un respaldo: lo normal es avanzar con tap
      skip: first,
      onDone: () => this.gs.tutorial && this.tutNextEarly()
    });
  }

  // showDraft llama aquí: coach sobre las cartas (no autoclose).
  tutOnDraft() {
    if (!this.gs.tutorial || this._tutDraftDone) return;
    this._tutDraftDone = true;
    this.tutCoach({
      text: t('ui.tut3'),
      ax: GAME_W / 2,
      ay: GAME_H / 2 - 130,
      by: GAME_H / 2 - 250,
      sticky: true
    });
  }

  // Al cerrarse el 1er draft: objetivo del nivel y fin del tutorial.
  tutOnDraftClosed() {
    if (!this.gs.tutorial || !this._tutDraftDone || this._tutObjDone) return;
    this._tutObjDone = true;
    this.tutCoach({
      text: t('ui.tut4'),
      ax: GAME_W / 2,
      ay: 40,
      by: 160,
      autoMs: 16000,
      onDone: () => {
        this.gs.tutorial = false;
      }
    });
  }

  // Burbuja-coach: caja neón con flechita hacia el objetivo. No pausa.
  // opts: { text, ax, ay (ancla), by (centro Y de la burbuja), autoMs,
  //         sticky (no se cierra sola/por tap), skip (link saltar) , onDone }
  tutCoach({ text, ax, ay, by, autoMs = 0, sticky = false, skip = false, onDone }) {
    if (this._tutCoach) {
      this._tutCoach.destroy();
      this._tutCoach = null;
    }
    if (this._tutTimer) {
      this._tutTimer.remove();
      this._tutTimer = null;
    }
    const cx = GAME_W / 2;
    const W = GAME_W - 64;
    this.tutorialLayer.setVisible(true);
    const cont = this.add.container(0, 0);
    this._tutCoach = cont;
    this.tutorialLayer.add(cont);

    const label = this.add
      .text(cx, by, text, {
        fontFamily: FONT,
        fontSize: '17px',
        color: '#eaf7ff',
        align: 'center',
        wordWrap: { width: W - 40 },
        lineSpacing: 5
      })
      .setOrigin(0.5);
    const bw = Math.min(W, label.width + 40);
    const bh = label.height + (sticky || autoMs ? 46 : 36);
    const bx = cx - bw / 2;
    const byTop = by - bh / 2;

    const g = this.add.graphics();
    g.fillStyle(0x0a1830, 0.95);
    g.fillRoundedRect(bx, byTop, bw, bh, 12);
    g.lineStyle(2, COLORS.station, 0.95);
    g.strokeRoundedRect(bx, byTop, bw, bh, 12);
    // Flecha hacia el ancla.
    const fromY = ay > by ? byTop + bh : byTop;
    g.fillStyle(COLORS.station, 0.95);
    const tipx = Phaser.Math.Clamp(ax, bx + 20, bx + bw - 20);
    g.fillTriangle(tipx - 9, fromY, tipx + 9, fromY, tipx, fromY + (ay > by ? 14 : -14));
    g.lineStyle(2, COLORS.station, 0.5);
    g.lineBetween(tipx, fromY + (ay > by ? 14 : -14), ax, ay);

    const hint = this.add
      .text(
        cx,
        byTop + bh - 14,
        sticky ? '▾ ' + t('ui.tut3_hint') : '▸ ' + t('ui.tut_next'),
        { fontFamily: FONT_DATA, fontSize: '12px', color: '#7fd6ff' }
      )
      .setOrigin(0.5);

    cont.add([g, label, hint]);
    cont.setAlpha(0);
    this.tweens.add({ targets: cont, alpha: 1, duration: 220, ease: 'Quad.out' });
    // Pulso sutil del borde (vida arcade).
    this.tweens.add({
      targets: hint,
      alpha: 0.35,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
    Sfx.play('tut');

    const close = () => {
      if (!cont.active) return;
      this.tweens.add({
        targets: cont,
        alpha: 0,
        duration: 180,
        onComplete: () => {
          cont.destroy();
          if (this._tutCoach === cont) this._tutCoach = null;
        }
      });
      onDone && onDone();
    };

    if (!sticky) {
      // Tap en cualquier parte (zona invisible que NO cubre las cartas).
      const zone = this.add
        .rectangle(cx, byTop + bh / 2, bw + 60, bh + 60, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        Sfx.play('tap');
        close();
      });
      cont.add(zone);
      if (autoMs) this._tutTimer = this.time.delayedCall(autoMs, close);
    }

    if (skip) {
      const sk = this.add
        .text(cx, byTop + bh + 16, t('ui.tut_skip'), {
          fontFamily: FONT_DATA,
          fontSize: '13px',
          color: '#7a5fa8'
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      sk.on('pointerdown', () => {
        Sfx.play('back');
        this.gs.tutorial = false;
        this._tutEarly = [];
        close();
      });
      cont.add(sk);
    }
  }

  clearOverlays() {
    this.tweens.killAll();
    this.draftLayer.setVisible(false).removeAll(true);
    this.overLayer.setVisible(false).removeAll(true);
    if (this.tutorialLayer) this.tutorialLayer.setVisible(false).removeAll(true);
    if (this.pauseLayer) this.pauseLayer.setVisible(false).removeAll(true);
    if (this.infoLayer) this.infoLayer.setVisible(false).removeAll(true);
    if (this.enemyCardLayer) {
      this.enemyCardQueue = [];
      this.enemyCardActive = false;
      this.enemyCardLayer.setVisible(false).removeAll(true).setAlpha(1).setY(0);
    }
  }
}
