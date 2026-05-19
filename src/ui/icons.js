// ---------------------------------------------------------------------------
// Glifo distintivo por módulo, para identificarlos de un vistazo.
// drawModuleIcon(g, id, cx, cy, r, color): dibuja en un Graphics ya creado.
// id puede venir como 'laser_beam', 'laser_beam#refraction', '__repair', etc.
// ---------------------------------------------------------------------------
// Alias de los ids de arma v0.7 a los glifos existentes.
const ALIAS = {
  cannon: 'cannon',
  missiles: 'homing_missiles',
  orbital: 'orbital_ring',
  nova: 'nova_pulse',
  laser: 'laser_beam',
  shield: 'regen_shield',
  drone: 'drone',
  blackhole: 'blackhole',
  railgun: 'railgun'
};
const norm = (id) => {
  const base = String(id || '').split('#')[0];
  return ALIAS[base] || base;
};

export function drawModuleIcon(g, id, cx, cy, r, color) {
  g.lineStyle(2.5, color, 1);
  g.fillStyle(color, 1);
  const k = norm(id);
  const line = (x1, y1, x2, y2) => g.lineBetween(cx + x1, cy + y1, cx + x2, cy + y2);
  const dot = (x, y, rad) => g.fillCircle(cx + x, cy + y, rad);

  switch (k) {
    case 'cannon': // cañón base (barra única)
      g.fillRect(cx - r * 0.2, cy - r * 0.75, r * 0.4, r * 1.5);
      dot(0, -r * 0.75, r * 0.22);
      break;
    case 'dual_cannon': // dos cañones (barras gemelas)
      g.fillRect(cx - r * 0.55, cy - r * 0.7, r * 0.35, r * 1.4);
      g.fillRect(cx + r * 0.2, cy - r * 0.7, r * 0.35, r * 1.4);
      break;
    case 'drone': // dron (núcleo + 4 brazos)
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        line(0, 0, Math.cos(a) * r, Math.sin(a) * r);
        dot(Math.cos(a) * r, Math.sin(a) * r, r * 0.16);
      }
      dot(0, 0, r * 0.28);
      break;
    case 'railgun': // riel: doble carril + punta de proyectil
      line(-r * 0.6, -r * 0.5, r * 0.7, -r * 0.5);
      line(-r * 0.6, r * 0.5, r * 0.7, r * 0.5);
      g.fillTriangle(
        cx + r * 0.55, cy - r * 0.5, cx + r * 0.55, cy + r * 0.5, cx + r, cy
      );
      break;
    case 'blackhole': // agujero negro (anillo + núcleo oscuro)
      g.strokeCircle(cx, cy, r * 0.9);
      g.strokeCircle(cx, cy, r * 0.55);
      g.fillStyle(color, 1);
      dot(0, 0, r * 0.3);
      break;
    case 'homing_missiles': // misil (punta + aletas)
      g.fillTriangle(cx, cy - r, cx + r * 0.45, cy + r * 0.4, cx - r * 0.45, cy + r * 0.4);
      line(-r * 0.45, r * 0.4, -r * 0.75, r * 0.8);
      line(r * 0.45, r * 0.4, r * 0.75, r * 0.8);
      break;
    case 'orbital_ring': // anillo con orbes
      g.strokeCircle(cx, cy, r * 0.7);
      dot(0, -r * 0.7, r * 0.18);
      dot(r * 0.6, r * 0.35, r * 0.18);
      dot(-r * 0.6, r * 0.35, r * 0.18);
      break;
    case 'nova_pulse': // ondas concéntricas
      g.strokeCircle(cx, cy, r * 0.35);
      g.strokeCircle(cx, cy, r * 0.7);
      g.strokeCircle(cx, cy, r * 1.05);
      break;
    case 'laser_beam': // haz horizontal + destello
      line(-r, 0, r, 0);
      line(-r * 0.4, -r * 0.5, -r * 0.4, r * 0.5);
      dot(r * 0.55, 0, r * 0.22);
      break;
    case 'regen_shield': // escudo
      g.beginPath();
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r * 0.8, cy - r * 0.45);
      g.lineTo(cx + r * 0.55, cy + r * 0.7);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r * 0.55, cy + r * 0.7);
      g.lineTo(cx - r * 0.8, cy - r * 0.45);
      g.closePath();
      g.strokePath();
      break;
    case 'sh_damage': // flecha hacia arriba (daño)
      g.fillTriangle(cx, cy - r, cx + r * 0.7, cy, cx - r * 0.7, cy);
      g.fillRect(cx - r * 0.25, cy, r * 0.5, r * 0.8);
      break;
    case 'sh_rate': // copo / asterisco (refrigeración)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        line(0, 0, Math.cos(a) * r, Math.sin(a) * r);
      }
      break;
    case 'sh_atkspd': // doble flecha (velocidad)
      line(-r * 0.8, -r * 0.5, -r * 0.1, 0);
      line(-r * 0.8, r * 0.5, -r * 0.1, 0);
      line(r * 0, -r * 0.5, r * 0.7, 0);
      line(r * 0, r * 0.5, r * 0.7, 0);
      break;
    case 'sh_range': // mira / crosshair (alcance)
      g.strokeCircle(cx, cy, r * 0.65);
      line(0, -r, 0, r);
      line(-r, 0, r, 0);
      break;
    case 'sh_hp': // cruz (vida/casco)
      g.fillRect(cx - r * 0.25, cy - r * 0.8, r * 0.5, r * 1.6);
      g.fillRect(cx - r * 0.8, cy - r * 0.25, r * 1.6, r * 0.5);
      break;
    default: // soporte / reparación: signo +
      line(0, -r * 0.8, 0, r * 0.8);
      line(-r * 0.8, 0, r * 0.8, 0);
  }
}
