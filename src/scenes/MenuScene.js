import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.js';
import { createBackdrop } from '../backdrop.js';
import { buildButton } from '../ui/button.js';
import { makeTappable } from '../ui/tap.js';
import { Economy } from '../economy.js';
import { t, Lang } from '../i18n.js';
import { Music } from '../music.js';
import { VERSION } from '../version.js';

const ADD = Phaser.BlendModes.ADD;
const FONT = '"Pixelify Sans", "VT323", ui-monospace, monospace';
const FONT_DATA = '"VT323", "Pixelify Sans", ui-monospace, monospace';
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    Music.stop(); // la música solo suena en los modos de juego
    // QA: ?tut=1 fuerza "primera vez". ?reset=1 limpia todo lo guardado.
    const q = new URLSearchParams(window.location.search);
    if (q.has('tut')) localStorage.removeItem('os_tut');
    if (q.has('reset')) {
      [
        'os_tut', 'os_progress', 'os_stars', 'os_gold', 'os_power',
        'os_bosses', 'os_unlocked_drone', 'os_unlocked_blackhole'
      ].forEach((k) => localStorage.removeItem(k)
      );
    }
    // MODO DEV: ?dev=1 entra a un modo propio (enemigos infinitos, sin
    // morir, elegís el arma cuando quieras). No toca los modos normales.
    if (q.has('dev')) {
      this.scene.start('GameScene', { dev: true });
      return;
    }
    // Primera vez de todas: directo al Nivel 1 con tutorial breve.
    if (!localStorage.getItem('os_tut')) {
      this.scene.start('GameScene', { level: 1, tutorial: true });
      return;
    }
    this.backdrop = createBackdrop(this);

    const cx = GAME_W / 2;
    // Capa de UI por encima de la viñeta/scanlines del backdrop (depth 90/95).
    const UI = 100;

    // Logo: estación con halo pulsante (más dramático)
    const halo = this.add
      .image(cx, 230, 'tex_glow')
      .setTint(COLORS.laser)
      .setBlendMode(ADD)
      .setAlpha(0.55)
      .setScale(4.2)
      .setDepth(UI);
    this.tweens.add({
      targets: halo,
      scale: 5,
      alpha: 0.75,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
    const halo2 = this.add
      .image(cx, 230, 'tex_glow')
      .setTint(COLORS.station)
      .setBlendMode(ADD)
      .setAlpha(0.4)
      .setScale(3)
      .setDepth(UI);
    this.tweens.add({
      targets: halo2,
      scale: 3.6,
      alpha: 0.6,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
    this.add.image(cx, 230, 'tex_station').setScale(2.1).setDepth(UI + 1);

    // Wordmark NÍTIDO: blanco con contorno magenta + glow cian (sin offset
    // cromático borroso).
    const titleY = 360;
    const word = (txt, y) =>
      this.add
        .text(cx, y, txt, {
          fontFamily: FONT,
          fontSize: '54px',
          color: '#ffffff',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setStroke(hex(COLORS.laser), 4)
        .setShadow(0, 0, hex(COLORS.station), 12, false, true)
        .setDepth(UI + 1);
    word('ORBITAL', titleY);
    word('STATION', titleY + 52);

    this.add
      .text(cx, titleY + 110, t('ui.subtitle'), {
        fontFamily: FONT_DATA,
        fontSize: '20px',
        color: hex(COLORS.station)
      })
      .setOrigin(0.5)
      .setDepth(UI);
    this.add
      .text(cx, titleY + 138, t('ui.menu_gold', { n: Economy.gold() }), {
        fontFamily: FONT,
        fontSize: '18px',
        color: hex(COLORS.xp),
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(UI);

    // Mismo tamaño y espaciado idéntico para los 3 botones.
    const BTN_W = 270;
    const BTN_H = 60;
    const BTN_GAP = 76; // distancia entre centros (igual para todos)
    const btnY0 = titleY + 200;
    const menu = [
      [t('ui.btn_levels'), COLORS.station, 'LevelsScene'],
      [t('ui.btn_arcade'), COLORS.xp, 'GameScene'],
      [t('ui.btn_abilities'), COLORS.laser, 'AbilitiesScene']
    ];
    menu.forEach(([label, color, scene], i) => {
      buildButton(this, cx, btnY0 + i * BTN_GAP, BTN_W, BTN_H, label, color, () => {
        this.scene.start(scene);
      }).setDepth(UI);
    });

    // Volumen de música: − [NN%] +
    const volY = GAME_H - 98;
    this.add
      .text(cx - 92, volY, t('ui.music'), {
        fontFamily: FONT_DATA,
        fontSize: '16px',
        color: '#c084ff'
      })
      .setOrigin(1, 0.5)
      .setDepth(UI);
    const volTxt = this.add
      .text(cx, volY, `${Math.round(Music.volume() * 100)}%`, {
        fontFamily: FONT,
        fontSize: '16px',
        color: hex(COLORS.xp),
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(UI);
    const mkVol = (dx, sym, delta) => {
      const b = this.add
        .text(cx + dx, volY, sym, {
          fontFamily: FONT,
          fontSize: '22px',
          color: hex(COLORS.station),
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setDepth(UI);
      makeTappable(this, b, () => {
        Music.setVolume(Math.round((Music.volume() + delta) * 10) / 10);
        volTxt.setText(`${Math.round(Music.volume() * 100)}%`);
      }, { sound: 'tap' });
    };
    mkVol(-44, '−', -0.1);
    mkVol(44, '+', 0.1);

    // Fila inferior: CRÉDITOS · IDIOMA (links compactos)
    const rowY = GAME_H - 64;
    const credits = this.add
      .text(cx - 12, rowY, t('ui.credits'), {
        fontFamily: FONT,
        fontSize: '16px',
        color: hex(COLORS.laser),
        fontStyle: 'bold'
      })
      .setOrigin(1, 0.5)
      .setDepth(UI);
    makeTappable(this, credits, () => this.scene.start('CreditsScene'), { sound: 'open' });
    this.add
      .text(cx, rowY, '·', { fontFamily: FONT, fontSize: '16px', color: '#7a5fa8' })
      .setOrigin(0.5)
      .setDepth(UI);
    const langBtn = this.add
      .text(cx + 12, rowY, t('ui.lang', { l: Lang.get().toUpperCase() }), {
        fontFamily: FONT,
        fontSize: '16px',
        color: hex(COLORS.station),
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(UI);
    makeTappable(this, langBtn, () => {
      Lang.cycle();
      this.scene.restart();
    }, { sound: 'select' });

    this.add
      .text(cx, GAME_H - 36, t('ui.proto', { v: VERSION }), {
        fontFamily: FONT_DATA,
        fontSize: '14px',
        color: '#7a5fa8'
      })
      .setOrigin(0.5)
      .setDepth(UI);
  }

  update(time, delta) {
    this.backdrop.update(Math.min(delta, 50));
  }
}
