import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.js';
import { createBackdrop } from '../backdrop.js';
import { buildButton } from '../ui/button.js';
import { Economy } from '../economy.js';
import { t, Lang } from '../i18n.js';

const ADD = Phaser.BlendModes.ADD;
const FONT = '"Courier New", ui-monospace, monospace';
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.backdrop = createBackdrop(this);

    const cx = GAME_W / 2;
    // Capa de UI por encima de la viñeta/scanlines del backdrop (depth 90/95).
    const UI = 100;

    // Logo: estación con halo pulsante
    const halo = this.add
      .image(cx, 250, 'tex_glow')
      .setTint(COLORS.station)
      .setBlendMode(ADD)
      .setAlpha(0.5)
      .setScale(3.4)
      .setDepth(UI);
    this.tweens.add({
      targets: halo,
      scale: 4.1,
      alpha: 0.7,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
    this.add.image(cx, 250, 'tex_station').setScale(1.7).setDepth(UI + 1);

    this.add
      .text(cx, 360, 'ORBITAL STATION', {
        fontFamily: FONT,
        fontSize: '34px',
        color: '#dffcff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(UI);
    this.add
      .text(cx, 394, t('ui.subtitle'), {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#7fb8cf'
      })
      .setOrigin(0.5)
      .setDepth(UI);
    this.add
      .text(cx, 424, t('ui.menu_gold', { n: Economy.gold() }), {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#ffd76a',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(UI);

    buildButton(this, cx, 486, 250, 58, t('ui.btn_levels'), COLORS.station, () => {
      this.scene.start('LevelsScene');
    }).setDepth(UI);
    buildButton(this, cx, 554, 250, 52, t('ui.btn_arcade'), COLORS.xp, () => {
      this.scene.start('GameScene');
    }).setDepth(UI);
    buildButton(this, cx, 616, 250, 52, t('ui.btn_abilities'), COLORS.orb, () => {
      this.scene.start('AbilitiesScene');
    }).setDepth(UI);

    // Selector de idioma (cicla en/es/pt) — reinicia el menú para aplicar.
    const langBtn = this.add
      .text(cx, GAME_H - 64, t('ui.lang', { l: Lang.get().toUpperCase() }), {
        fontFamily: FONT,
        fontSize: '13px',
        color: hex(COLORS.station),
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(UI)
      .setInteractive({ useHandCursor: true });
    langBtn.on('pointerdown', () => {
      Lang.cycle();
      this.scene.restart();
    });

    this.add
      .text(cx, GAME_H - 36, t('ui.proto'), {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#4a6b7c'
      })
      .setOrigin(0.5)
      .setDepth(UI);
  }

  update(time, delta) {
    this.backdrop.update(Math.min(delta, 50));
  }
}
