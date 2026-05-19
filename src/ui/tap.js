// Feedback auditivo + visual para elementos interactivos "sueltos" (textos,
// chips, íconos) que no usan buildButton/buildTile. Mantiene el handler.
import { Sfx } from '../sfx.js';

// obj debe ser un GameObject. onClick = callback al soltar/click.
// opts: { sound='ui', hover='hover', press=0.88, lift=1.12 }
export function makeTappable(scene, obj, onClick, opts = {}) {
  const { sound = 'ui', hover = 'hover', press = 0.88, lift = 1.12 } = opts;
  const base = obj.scale || 1;
  obj.setInteractive({ useHandCursor: true });
  obj.on('pointerover', () => {
    Sfx.play(hover);
    scene.tweens.add({ targets: obj, scale: base * lift, duration: 90, ease: 'Quad.out' });
  });
  obj.on('pointerout', () => {
    scene.tweens.add({ targets: obj, scale: base, duration: 90, ease: 'Quad.out' });
  });
  obj.on('pointerdown', () => {
    Sfx.play(sound);
    scene.tweens.add({
      targets: obj,
      scale: base * press,
      duration: 70,
      yoyo: true,
      ease: 'Quad.out'
    });
    onClick && onClick();
  });
  return obj;
}
