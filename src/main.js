import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from './config.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';
import AbilitiesScene from './scenes/AbilitiesScene.js';
import LevelsScene from './scenes/LevelsScene.js';
import CreditsScene from './scenes/CreditsScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: COLORS.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game',
    expandParent: true,
    width: GAME_W,
    height: GAME_H
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false }
  },
  render: { antialias: true, pixelArt: false },
  scene: [MenuScene, GameScene, UIScene, AbilitiesScene, LevelsScene, CreditsScene]
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
