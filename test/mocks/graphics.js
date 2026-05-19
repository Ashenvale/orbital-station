// Mock de un Phaser.GameObjects.Graphics: registra llamadas, no dibuja.
// Lo usa ui/icons.js (drawModuleIcon recibe un `g` así).
export function makeGraphics() {
  const calls = [];
  const rec =
    (name) =>
    (...args) => {
      calls.push({ name, args });
      return g;
    };
  const g = {
    calls,
    count: (name) => calls.filter((c) => c.name === name).length,
    lineStyle: rec('lineStyle'),
    fillStyle: rec('fillStyle'),
    fillRect: rec('fillRect'),
    strokeRect: rec('strokeRect'),
    lineBetween: rec('lineBetween'),
    fillCircle: rec('fillCircle'),
    strokeCircle: rec('strokeCircle'),
    fillTriangle: rec('fillTriangle'),
    beginPath: rec('beginPath'),
    moveTo: rec('moveTo'),
    lineTo: rec('lineTo'),
    closePath: rec('closePath'),
    strokePath: rec('strokePath'),
    fillPoints: rec('fillPoints'),
    strokePoints: rec('strokePoints')
  };
  return g;
}
