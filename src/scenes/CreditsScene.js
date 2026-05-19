import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.js';
import { createBackdrop } from '../backdrop.js';
import { buildButton } from '../ui/button.js';
import { t } from '../i18n.js';
import { Sfx } from '../sfx.js';
import { VERSION } from '../version.js';
import { Music } from '../music.js';

const FONT = '"Pixelify Sans", "VT323", ui-monospace, monospace';
const FONT_DATA = '"VT323", "Pixelify Sans", ui-monospace, monospace';
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export default class CreditsScene extends Phaser.Scene {
  constructor() {
    super('CreditsScene');
  }

  create() {
    Music.stop();
    this.backdrop = createBackdrop(this, { nebula: true });
    const cx = GAME_W / 2;
    const UI = 100;

    this.add
      .text(cx, 40, t('ui.credits_title'), {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setStroke(hex(COLORS.laser), 4)
      .setShadow(0, 0, hex(COLORS.station), 10, false, true)
      .setDepth(UI);

    let y = 96;
    const head = (txt) => {
      this.add
        .text(28, y, txt, { fontFamily: FONT_DATA, fontSize: '15px', color: '#c084ff' })
        .setOrigin(0, 0)
        .setDepth(UI);
      y += 26;
    };
    const big = (txt, color) => {
      this.add
        .text(28, y, txt, {
          fontFamily: FONT,
          fontSize: '20px',
          color: color || '#ffffff',
          fontStyle: 'bold'
        })
        .setOrigin(0, 0)
        .setDepth(UI);
      y += 32;
    };
    const small = (txt) => {
      this.add
        .text(28, y, txt, {
          fontFamily: FONT_DATA,
          fontSize: '14px',
          color: '#cfeefb',
          wordWrap: { width: GAME_W - 56 }
        })
        .setOrigin(0, 0)
        .setDepth(UI);
      y += 24;
    };
    const link = (label, url) => {
      const a = this.add
        .text(28, y, '› ' + label, {
          fontFamily: FONT_DATA,
          fontSize: '14px',
          color: hex(COLORS.station)
        })
        .setOrigin(0, 0)
        .setDepth(UI)
        .setInteractive({ useHandCursor: true });
      a.on('pointerover', () => {
        Sfx.play('hover');
        a.setColor('#ffffff');
      });
      a.on('pointerout', () => a.setColor(hex(COLORS.station)));
      a.on('pointerdown', () => {
        Sfx.play('open');
        window.open(url, '_blank');
      });
      y += 20;
      this.add
        .text(40, y, url, { fontFamily: FONT_DATA, fontSize: '11px', color: '#6f8aa0' })
        .setOrigin(0, 0)
        .setDepth(UI);
      y += 24;
    };

    head(t('ui.dev'));
    big('Yoshua Cary', hex(COLORS.station));
    y += 14;

    head(t('ui.music_h'));
    big('Punch Deck — "Neon Underworld"', hex(COLORS.xp));
    small('Creative Commons BY 3.0 · Música proporcionada por BreakingCopyright.');
    y += 6;
    link('Licencia CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0/');
    link('Punch Deck (artista)', 'https://www.youtube.com/@PunchDeck');
    link('BreakingCopyright', 'https://breakingcopyright.com');
    link('Tema en YouTube', 'https://www.youtube.com/watch?v=kbx2guA73N8');

    this.add
      .text(cx, GAME_H - 96, `ORBITAL STATION · ${VERSION}`, {
        fontFamily: FONT_DATA,
        fontSize: '13px',
        color: '#7a5fa8'
      })
      .setOrigin(0.5)
      .setDepth(UI);

    buildButton(this, cx, GAME_H - 50, 220, 52, t('ui.back'), COLORS.station, () => {
      this.scene.start('MenuScene');
    }).setDepth(UI);
  }

  update(time, delta) {
    this.backdrop.update(Math.min(delta, 50));
  }
}
