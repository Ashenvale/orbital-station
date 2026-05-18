import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.js';
import { ABILITY_BY_ID, MAX_LEVEL, isSpecial, ROMAN, specialIndex } from '../data/abilities.js';
import { buildTile } from '../ui/abilityTile.js';
import { buildButton } from '../ui/button.js';
import { Sfx } from '../sfx.js';
import { t } from '../i18n.js';

const ADD = Phaser.BlendModes.ADD;
const FONT = '"Courier New", ui-monospace, monospace';
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
    const PANEL_H = 82;
    this.add.rectangle(0, 0, GAME_W, PANEL_H, 0x05121c, 0.62).setOrigin(0, 0);
    this.add.rectangle(0, PANEL_H, GAME_W, 1, COLORS.station, 0.5).setOrigin(0, 0);

    // --- Fila de chips: NIVEL · TIEMPO/OBJETIVO · BAJAS · ORO -------------
    const chips = [
      { key: 'level', label: t('ui.c_level'), color: '#7fe8ff' },
      { key: 'mid', label: t('ui.c_time'), color: '#7fe8ff' },
      { key: 'kills', label: t('ui.c_kills'), color: '#7fe8ff' },
      { key: 'gold', label: t('ui.c_gold'), color: '#ffd76a' }
    ];
    const m = 12;
    const colW = (GAME_W - m * 2) / chips.length;
    this.chipLabels = {};
    this.chipValues = {};
    chips.forEach((c, i) => {
      const cxk = m + colW * (i + 0.5);
      if (i > 0) {
        this.add
          .rectangle(m + colW * i, 8, 1, 30, COLORS.station, 0.18)
          .setOrigin(0.5, 0);
      }
      this.chipLabels[c.key] = this.add
        .text(cxk, 11, c.label, { fontFamily: FONT, fontSize: '9px', color: '#6f93a8' })
        .setOrigin(0.5, 0);
      this.chipValues[c.key] = this.add
        .text(cxk, 22, '–', {
          fontFamily: FONT,
          fontSize: '17px',
          color: c.color,
          fontStyle: 'bold'
        })
        .setOrigin(0.5, 0);
    });

    // --- Barra de INTEGRIDAD ----------------------------------------------
    this.HPX = 18;
    this.HPY = 60;
    this.HPW = GAME_W - 36;
    this.HPH = 12;

    this.add
      .text(this.HPX, 48, t('ui.integrity'), { fontFamily: FONT, fontSize: '9px', color: '#6f93a8' })
      .setOrigin(0, 0.5);
    this.hpText = this.add
      .text(this.HPX + this.HPW, 48, '', {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#eafcff',
        fontStyle: 'bold'
      })
      .setOrigin(1, 0.5);

    const f = this.add.graphics();
    f.lineStyle(1, COLORS.station, 0.3);
    f.strokeRect(this.HPX - 3, this.HPY - 2, this.HPW + 6, this.HPH + 4);

    this.hpGfx = this.add.graphics();
    this.hpGlow = this.add.graphics().setBlendMode(ADD);

    this.add.rectangle(this.HPX, this.HPY + this.HPH + 4, this.HPW, 3, 0x0a1622).setOrigin(0, 0);
    this.xpBar = this.add
      .rectangle(this.HPX, this.HPY + this.HPH + 4, 0, 3, COLORS.xp)
      .setOrigin(0, 0)
      .setBlendMode(ADD);

    // Botón de silencio (fila de controles, encima de los slots)
    this.muteBtn = this.add
      .text(GAME_W - 14, GAME_H - 50, '', {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#7fb8cf'
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    const refreshMute = () =>
      this.muteBtn.setText(Sfx.isMuted() ? t('ui.snd_off') : t('ui.snd_on')).setColor(
        Sfx.isMuted() ? '#ff6b7d' : hex(COLORS.station)
      );
    refreshMute();
    this.muteBtn.on('pointerdown', () => {
      Sfx.toggleMute();
      if (!Sfx.isMuted()) Sfx.play('ui');
      refreshMute();
    });

    // -- Ranuras de habilidades (inferior): 4 chips visuales ---------------
    this.add
      .text(GAME_W / 2, GAME_H - 48, t('ui.modules_eq'), {
        fontFamily: FONT,
        fontSize: '9px',
        color: '#6f93a8'
      })
      .setOrigin(0.5);
    const sm = 8;
    const sg = 6;
    const sw = (GAME_W - sm * 2 - sg * 3) / 4;
    const sh = 34;
    const syc = GAME_H - 22;
    this.slotUI = [];
    for (let i = 0; i < 4; i++) {
      const sx = sm + sw / 2 + i * (sw + sg);
      const box = this.add
        .rectangle(sx, syc, sw, sh, 0x081521, 0.85)
        .setStrokeStyle(1.5, 0x33485c, 0.7)
        .setInteractive({ useHandCursor: true });
      const nm = this.add
        .text(sx, syc - 6, '—', {
          fontFamily: FONT,
          fontSize: '11px',
          color: '#5a6b7c',
          fontStyle: 'bold'
        })
        .setOrigin(0.5);
      const lv = this.add
        .text(sx, syc + 9, t('ui.slot_free'), {
          fontFamily: FONT,
          fontSize: '9px',
          color: '#5a6b7c'
        })
        .setOrigin(0.5);
      const slot = { box, nm, lv, sig: '', abilityId: null, abilityLv: 0 };
      box.on('pointerdown', () => {
        if (!slot.abilityId || !this.gs.running || this.gs.drafting) return;
        Sfx.play('ui');
        this.gs.pauseGame();
        this.showAbilityInfo(slot.abilityId, slot.abilityLv);
      });
      this.slotUI.push(slot);
    }

    // Botón de pausa / volver (fila de controles, encima de los slots)
    this.pauseBtn = this.add
      .text(14, GAME_H - 50, t('ui.pause_btn'), {
        fontFamily: FONT,
        fontSize: '12px',
        color: hex(COLORS.station),
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerdown', () => {
      if (!this.gs.running || this.gs.drafting) return;
      Sfx.play('ui');
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

    // Re-bind limpio: evita listeners duplicados si se vuelve del menú.
    this.gs.events.off('levelup', this.showDraft, this);
    this.gs.events.off('gameover', this.showGameOver, this);
    this.gs.events.off('levelclear', this.showLevelClear, this);
    this.gs.events.off('enemyintro', this.queueEnemyCard, this);
    this.gs.events.off('reset', this.clearOverlays, this);
    this.gs.events.on('levelup', this.showDraft, this);
    this.gs.events.on('gameover', this.showGameOver, this);
    this.gs.events.on('levelclear', this.showLevelClear, this);
    this.gs.events.on('enemyintro', this.queueEnemyCard, this);
    this.gs.events.on('reset', this.clearOverlays, this);
    this.events.once('shutdown', () => {
      this.gs.events.off('levelup', this.showDraft, this);
      this.gs.events.off('gameover', this.showGameOver, this);
      this.gs.events.off('levelclear', this.showLevelClear, this);
      this.gs.events.off('enemyintro', this.queueEnemyCard, this);
      this.gs.events.off('reset', this.clearOverlays, this);
    });
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

  // Barra de integridad por celdas de neón (holográfica) + escudo y glow.
  drawHpBar(h) {
    const g = this.hpGfx;
    const gl = this.hpGlow;
    g.clear();
    gl.clear();
    const ratio = Phaser.Math.Clamp(h.hp / h.maxHp, 0, 1);
    const col = ratio > 0.5 ? 0x49f2c2 : ratio > 0.25 ? 0xffc14f : 0xff5d6c;
    const cells = 26;
    const gap = 2;
    const cw = (this.HPW - (cells - 1) * gap) / cells;
    const lit = Math.ceil(cells * ratio);

    for (let i = 0; i < cells; i++) {
      const x = this.HPX + i * (cw + gap);
      if (i < lit) {
        g.fillStyle(col, 0.95);
        g.fillRect(x, this.HPY, cw, this.HPH);
        gl.fillStyle(col, 0.45);
        gl.fillRect(x - 1, this.HPY - 1, cw + 2, this.HPH + 2);
      } else {
        g.fillStyle(0x2a3f52, 0.45);
        g.fillRect(x, this.HPY + this.HPH * 0.32, cw, this.HPH * 0.36);
      }
    }

    // Escudo: línea fina segmentada justo encima de la barra.
    if (h.shieldMax > 0) {
      const sr = Phaser.Math.Clamp(h.shield / h.shieldMax, 0, 1);
      g.fillStyle(0x0a1622, 0.7);
      g.fillRect(this.HPX, this.HPY - 6, this.HPW, 3);
      gl.fillStyle(COLORS.shield, 0.85);
      gl.fillRect(this.HPX, this.HPY - 6, this.HPW * sr, 3);
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
      this.chipValues.kills.setText(`${h.kills}/${h.targetKills}`);
      const done = h.kills >= h.targetKills;
      const close = h.kills >= h.targetKills * 0.8;
      this.chipValues.kills.setColor(done ? '#7affc4' : close ? '#ffc14f' : '#7fe8ff');
    } else {
      this.chipLabels.kills.setText(t('ui.c_kills'));
      this.chipValues.kills.setText(h.kills);
    }

    const ids = Object.keys(h.abilities);
    for (let i = 0; i < this.slotUI.length; i++) {
      const s = this.slotUI[i];
      const id = ids[i];
      if (!id) {
        s.abilityId = null;
        if (s.sig !== 'empty') {
          s.sig = 'empty';
          s.box.setStrokeStyle(1.5, 0x33485c, 0.6);
          s.nm.setText('—').setColor('#5a6b7c');
          s.lv.setText(t('ui.slot_free')).setColor('#5a6b7c');
        }
        continue;
      }
      const lv = h.abilities[id];
      s.abilityId = id;
      s.abilityLv = lv;
      const sig = `${id}:${lv}`;
      if (s.sig === sig) continue;
      s.sig = sig;
      const a = ABILITY_BY_ID[id];
      const ch = '#' + a.color.toString(16).padStart(6, '0');
      const tag = isSpecial(lv)
        ? t('ui.lvl_sp', { r: ROMAN[specialIndex(lv)] })
        : t('ui.lvl_n', { n: lv, m: MAX_LEVEL });
      s.box.setStrokeStyle(2, a.color, 0.95);
      s.nm.setText(a.short || a.name).setColor(ch);
      s.lv.setText(tag).setColor(isSpecial(lv) ? '#ffd76a' : '#9fb6d6');
    }
  }

  // ===========================================================================
  //  DRAFT (subir de nivel) — usa la card sci-fi compartida
  // ===========================================================================
  showDraft({ choices, level }) {
    this.draftLayer.removeAll(true);
    this.draftLayer.setVisible(true);

    this.draftLayer.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x02030a, 0.9).setOrigin(0, 0));
    this.draftLayer.add(
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 220, t('ui.draft_title', { n: level }), {
          fontFamily: FONT,
          fontSize: '30px',
          color: hex(COLORS.station),
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
    );
    this.draftLayer.add(
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 188, t('ui.draft_sub'), {
          fontFamily: FONT,
          fontSize: '13px',
          color: '#7fb8cf'
        })
        .setOrigin(0.5)
    );

    const margin = 14;
    const gap = 10;
    const tileW = (GAME_W - margin * 2 - gap * 2) / 3;
    const tileH = 322;
    const cy = GAME_H / 2 + 26;

    // "Cinta" holográfica detrás de las 3 opciones.
    const bandY = cy - tileH / 2 - 14;
    const bandH = tileH + 28;
    this.draftLayer.add(
      this.add.rectangle(0, bandY, GAME_W, bandH, 0x081826, 0.55).setOrigin(0, 0)
    );
    const band = this.add.graphics();
    band.lineStyle(2, COLORS.station, 0.55);
    band.lineBetween(0, bandY, GAME_W, bandY);
    band.lineBetween(0, bandY + bandH, GAME_W, bandY + bandH);
    band.lineStyle(1, COLORS.station, 0.2);
    band.lineBetween(0, bandY + 4, GAME_W, bandY + 4);
    band.lineBetween(0, bandY + bandH - 4, GAME_W, bandY + bandH - 4);
    this.draftLayer.add(band);

    choices.forEach((c, i) => {
      const tile = buildTile(this, {
        cx: margin + tileW / 2 + i * (tileW + gap),
        cy,
        w: tileW,
        h: tileH,
        color: c.color,
        name: c.name,
        badge: c.levelLabel,
        body: c.desc,
        level: c.pips === false ? null : c.level || 0,
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

    this.overLayer.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x02030a, 0.92).setOrigin(0, 0));
    this.overLayer.add(
      this.add
        .image(GAME_W / 2, GAME_H / 2 - 120, 'tex_glow')
        .setTint(0xff4f5e)
        .setBlendMode(ADD)
        .setAlpha(0.35)
        .setScale(9, 3)
    );
    this.overLayer.add(
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 130, t('ui.go_title'), {
          fontFamily: FONT,
          fontSize: '24px',
          color: '#ff6b7d',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
    );
    this.overLayer.add(
      this.add
        .text(
          GAME_W / 2,
          GAME_H / 2 - 50,
          t('ui.go_stats', { t: `${mm}:${ss}`, n: level, k: kills, g: gold || 0 }),
          { fontFamily: FONT, fontSize: '16px', color: '#cfeefb', align: 'left', lineSpacing: 12 }
        )
        .setOrigin(0.5)
    );

    this.overLayer.add(
      buildButton(this, GAME_W / 2, GAME_H / 2 + 70, 230, 56, t('ui.retry'), COLORS.station, () => {
        this.clearOverlays();
        this.gs.restartGame();
      })
    );
    const back = this.gs.mode === 'level' ? 'LevelsScene' : 'MenuScene';
    this.overLayer.add(
      buildButton(this, GAME_W / 2, GAME_H / 2 + 140, 230, 50, this.gs.mode === 'level' ? t('ui.map') : t('ui.menu'), COLORS.orb, () => {
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

    this.overLayer.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x02030a, 0.92).setOrigin(0, 0));
    this.overLayer.add(
      this.add
        .image(GAME_W / 2, GAME_H / 2 - 120, 'tex_glow')
        .setTint(COLORS.xp)
        .setBlendMode(ADD)
        .setAlpha(0.4)
        .setScale(9, 3)
    );
    this.overLayer.add(
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 132, t('ui.lc_title', { n: level }), {
          fontFamily: FONT,
          fontSize: '24px',
          color: hex(COLORS.xp),
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
    );
    this.overLayer.add(
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 100, name || '', {
          fontFamily: FONT,
          fontSize: '14px',
          color: '#cfeefb'
        })
        .setOrigin(0.5)
    );

    // Estrellas (1-3) por integridad del casco.
    const sy = GAME_H / 2 - 62;
    for (let i = 0; i < 3; i++) {
      const lit = i < stars;
      this.overLayer.add(
        this.add
          .text(GAME_W / 2 + (i - 1) * 46, sy, lit ? '★' : '☆', {
            fontFamily: FONT,
            fontSize: '34px',
            color: lit ? '#ffd76a' : '#44546a'
          })
          .setOrigin(0.5)
      );
    }
    this.overLayer.add(
      this.add
        .text(
          GAME_W / 2,
          sy + 34,
          starGold > 0
            ? t('ui.lc_stars_gold', { g: starGold })
            : t('ui.lc_record', { n: starBest }),
          { fontFamily: FONT, fontSize: '12px', color: starGold > 0 ? '#ffd76a' : '#7fb8cf' }
        )
        .setOrigin(0.5)
    );

    this.overLayer.add(
      this.add
        .text(GAME_W / 2, GAME_H / 2 - 8, t('ui.lc_stats', { k: kills, g: gold || 0 }), {
          fontFamily: FONT,
          fontSize: '15px',
          color: '#cfeefb',
          align: 'center',
          lineSpacing: 8
        })
        .setOrigin(0.5)
    );

    let y = GAME_H / 2 + 50;
    if (next) {
      this.overLayer.add(
        buildButton(this, GAME_W / 2, y, 240, 56, t('ui.next'), COLORS.station, () => {
          this.clearOverlays();
          this.scene.stop('GameScene');
          this.scene.start('GameScene', { level: next });
        })
      );
      y += 72;
    } else {
      this.overLayer.add(
        this.add
          .text(GAME_W / 2, y, t('ui.campaign_done'), {
            fontFamily: FONT,
            fontSize: '16px',
            color: hex(COLORS.xp),
            fontStyle: 'bold'
          })
          .setOrigin(0.5)
      );
      y += 50;
    }
    this.overLayer.add(
      buildButton(this, GAME_W / 2, y, 240, 50, t('ui.starmap_btn'), COLORS.orb, () => {
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

  // Card de info de una habilidad equipada (al tocar su ranura). Pausa el juego.
  showAbilityInfo(id, lv) {
    const a = ABILITY_BY_ID[id];
    if (!a) return;
    this.infoLayer.removeAll(true);
    this.infoLayer.setVisible(true);
    const w = GAME_W - 60;
    const hh = 250;
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
    g.lineStyle(2, a.color, 0.95);
    g.strokeRect(cx - w / 2, cy - hh / 2, w, hh);
    this.infoLayer.add(g);
    const lx = cx - w / 2 + 18;
    this.infoLayer.add(
      this.add.text(lx, cy - hh / 2 + 16, a.name, {
        fontFamily: FONT,
        fontSize: '20px',
        color: hex(a.color),
        fontStyle: 'bold'
      })
    );
    const badge = isSpecial(lv)
      ? t('ui.lvl_sp', { r: ROMAN[specialIndex(lv)] })
      : t('ui.lvl_n', { n: lv, m: MAX_LEVEL });
    this.infoLayer.add(
      this.add
        .text(cx + w / 2 - 18, cy - hh / 2 + 18, `[ ${badge} ]`, {
          fontFamily: FONT,
          fontSize: '12px',
          color: isSpecial(lv) ? '#ffd76a' : '#9fb6d6',
          fontStyle: 'bold'
        })
        .setOrigin(1, 0)
    );
    this.infoLayer.add(
      this.add.text(lx, cy - hh / 2 + 44, a.blurb, {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#aecbe0',
        wordWrap: { width: w - 36 }
      })
    );
    this.infoLayer.add(
      this.add.text(lx, cy - hh / 2 + 80, t('ui.specials_h'), {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#ffd76a'
      })
    );
    a.specials.forEach((sp, idx) => {
      const reached = lv >= 5 + idx;
      this.infoLayer.add(
        this.add.text(lx, cy - hh / 2 + 98 + idx * 34, `${ROMAN[idx]}  ${sp}`, {
          fontFamily: FONT,
          fontSize: '11px',
          color: reached ? '#e7f3ff' : '#5a6b7c',
          wordWrap: { width: w - 36 }
        })
      );
    });
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

  clearOverlays() {
    this.tweens.killAll();
    this.draftLayer.setVisible(false).removeAll(true);
    this.overLayer.setVisible(false).removeAll(true);
    if (this.pauseLayer) this.pauseLayer.setVisible(false).removeAll(true);
    if (this.infoLayer) this.infoLayer.setVisible(false).removeAll(true);
    if (this.enemyCardLayer) {
      this.enemyCardQueue = [];
      this.enemyCardActive = false;
      this.enemyCardLayer.setVisible(false).removeAll(true).setAlpha(1).setY(0);
    }
  }
}
