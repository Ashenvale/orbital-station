# Orbital Station — Arcade Neon (Direction C) Patch

Implementación completa de **Direction C — Arcade Neon** del documento de análisis visual, aplicada sobre la base del prototipo Phaser 3.

## Cómo aplicar

1. Hacé backup de tu carpeta `orbital-station/`.
2. Reemplazá los archivos de tu carpeta `orbital-station/` con los de este `game/` (mismo árbol).
3. `npm install && npm run dev`

Las fuentes nuevas se cargan desde Google Fonts (Pixelify Sans + VT323) — no hay assets locales que sumar.

## Cambios por archivo

### `index.html`
- `<link>` a Google Fonts (Pixelify Sans + VT323).
- `<meta theme-color>` → `#10081f` (púrpura profundo).
- `body background` y `font-family` actualizados.

### `src/config.js` — Paleta Arcade Neon
- `bg`        `#10081f`   púrpura profundo
- `station`   `#00f0ff`   cian neón
- `laser`     `#ff2bd6`   magenta (acento principal)
- `shield`    `#5bffb8`   verde-menta
- `xp / gold` `#ffe640`   amarillo (un solo color para ambos: simplifica)
- `danger`    `#ff3a5e`
- `missile`   `#ff8a3d`
- `orb`       `#c084ff`
- Enemigos repintados con la nueva paleta.

### `src/gfxTextures.js`
- Strokes de enemigos más gruesos (3px en vez de 2px).
- Sombra interior aumentada (blur 14 en vez de 10).
- Estación: stroke 3.5px y blur 22 — más presencia, más "heroína".
- Núcleo de la estación más grande (radio 7 en vez de 6).
- Scanlines magenta en vez de cian.
- Viñeta con base púrpura `(8,3,18)`.

### `src/backdrop.js`
- Nebulosas: 3 capas en lugar de 2, mezcla magenta + púrpura + violeta.
- Estrellas: 120 (antes 80), 15% con tinte magenta + 30% amarillo para variedad.
- Velocidad de paralax y twinkle un ~30% más rápida.
- Scanlines con `BlendMode.ADD` y opacidad 0.12 (antes 0.07).
- Radar sweep en magenta con doble grosor.

### `src/scenes/MenuScene.js`
- FONT global a Pixelify Sans; FONT_DATA a VT323.
- Wordmark "ORBITAL / STATION" en 2 líneas, 52px, con **offset cromático** cian/magenta sobre texto blanco central.
- Halo doble (cian + magenta) respirando.
- Estación 2.1× (antes 1.7×).
- Botones más grandes (270×64 / 270×58).
- Botón de Habilidades pasa de naranja a magenta (mejor jerarquía con XP amarillo).

### `src/ui/button.js`
- Borde rectangular **chunky 3px** (sin chamfer) — más arcade que sci-fi.
- Highlight blanco 1px en el borde superior.
- 4 cuadrados de esquina sólidos de 6×6 px (estética pixel).
- Fondo `#1c0d34` púrpura translúcido.
- Glow del hover sube de 0.18 → 0.5 alpha.
- Tween de squash 0.96×0.94 en click (`Quad.out`, 70ms yoyo).
- Texto del label pasa a blanco en hover.
- Tipografía Pixelify Sans 24px (antes Courier 18px).

### `src/ui/abilityTile.js`
- Mismo lenguaje chunky: borde 3px + esquinas pixel + highlight superior.
- Icono hex con stroke 3px (antes 2px) y radio mayor.
- Texto del nombre 20px (antes 15px), badge 15px (antes 11px), body 16px (antes 12px).
- Hover: pop con `Back.out` al 1.03× + glow 0.55.
- Pop-in inicial desde 0.82× (antes 0.86×) — más exagerado.

### `src/scenes/UIScene.js`

**HUD superior**
- Panel sube de 82px a 90px de alto.
- Fondo `#1c0d34` opacidad 0.78 (antes `#05121c` 0.62) — más sólido, más arcade.
- Línea inferior magenta 2px (antes cian 1px).
- Línea superior blanca 1px (highlight).
- Separadores de chips magenta 2px (antes cian 1px finos).
- Labels en VT323 13px púrpura claro (antes Courier 9px gris).
- Valores en Pixelify 24px (antes 17px) — números legibles incluso en mobile pequeño.

**Barra de integridad**
- Label "INTEGRIDAD" en VT323 13px púrpura (antes Courier 9px gris).
- Valor numérico 15px (antes 11px).
- Frame magenta 2px + esquinas pixel 5×5 px.
- Celdas: 22 en vez de 26 (más chunky), gap 3px (antes 2px), altura 14px (antes 12).
- Colores arcade: shield-green / yellow / hot-pink.
- Track de XP: 4px alto (antes 3px), fondo púrpura.

**Slots de habilidades**
- Slots más altos (40px vs 34px).
- Borde 2.5px (antes 1.5px).
- Texto del nombre Pixelify 15px bold (antes 11px).
- "Nv 3" en VT323 12px púrpura (antes Courier 9px gris).

**Botones laterales (pausa / sonido)**
- 16px (antes 12px), cian neón.

**Draft overlay**
- Fondo `#10081f` 0.92 (antes `#02030a` 0.9).
- Título "LEVEL UP!" en mayúsculas, 40px, con offset cromático magenta/cian/blanco.
- Cinta de fondo: línea superior/inferior magenta 3px (antes cian 2px).
- Subtítulo amarillo (antes cian) — más arcade.

**Game Over**
- Título 40px rojo brillante con stroke púrpura.
- Halo rojo escala 11×4 (antes 9×3) — más dramático.
- Botones más grandes (260×64 / 260×56).
- "Reintentar" en magenta (acento de acción), "Mapa/Menú" en cian (acento secundario).

**Level Clear (Victoria)**
- Título "¡NIVEL X COMPLETADO!" con offset cromático magenta/cian/amarillo.
- Estrellas más grandes (42px vs 34px), espaciado mayor (52px vs 46px).
- Color de estrella inactiva: púrpura profundo (`#5a2a8a`).
- Subtítulo del nivel en púrpura claro.
- Botón "Siguiente" en magenta.

### `src/scenes/GameScene.js`

**Estación (visual)**
- Doble halo: cian principal (3.2× → 3.8× respirando) + magenta secundario (2.2× → 2.8×).
- Anillo de módulos con stroke 2px y opacidad 0.7 (más visible).

**Integridad ring (alrededor de la estación)**
- Stroke encendido 4px (antes 3px).
- Color inactivo `#3a1268` púrpura (antes teal-dark).

**Enemy health bars**
- Colores arcade: green/yellow/hot-pink.
- Fondo `#10081f` 0.85 (antes teal 0.7).

**Damage numbers** ★ nuevo
- Texto flotante que sube del enemigo cada hit (`spawnDamageNumber`).
- ≥ 50 daño → tamaño 28px (vs 20px) — "crit" implícito.
- Color por tipo: blanco (kinetic), cian (energy), naranja (explosive), magenta (laser).
- Stroke `#10081f` 4px para legibilidad sobre cualquier fondo.
- Tween `Cubic.out` 540–720ms, sube 38–56px y fade.

**Hit flash** ★ nuevo
- Cada enemigo se vuelve blanco por 60ms al recibir daño (`setTintFill(0xffffff)`).
- Sin coste extra de render — usa el tint API existente.

**Killstreak** ★ nuevo
- Cuenta kills en ventana móvil de 1500ms.
- Mostra texto chunky en pantalla cuando `streak ≥ 5`:
  - 5–9: `×N STREAK` cian
  - 10–14: `×N RAMPAGE!` amarillo
  - ≥ 15: `×N INSANE!` magenta
- Pop-in con `Back.out` (escala 0.4 → 1.1 → 1.0), fade out después de 900ms.

**Screen shake graduado** ★ nuevo
- Kill chico (`enemy.maxHp ≤ 80`): sin shake.
- Kill grande (> 80 HP): shake leve `90ms, 0.004`.
- Boss kill: shake `450ms, 0.014` + camera flash magenta `(255, 43, 214)` 180ms.
- Mantiene los shakes existentes para impacto en estación (no se modificaron — siguen jerarquizados naturalmente).

### `src/scenes/LevelsScene.js` y `AbilitiesScene.js`
- FONT global a Pixelify Sans; FONT_DATA a VT323.
- (Resto de su lógica intacta — heredan automáticamente los nuevos botones y tiles.)

## Sin tocar

- Lógica de gameplay (balance, AI, daño, drops): **intacta**.
- Catálogo de enemigos, niveles, habilidades: **intacta**.
- Sistema de progresión y economía: **intacta**.
- i18n / persistencia / sfx: **intacta**.

Es un patch puramente visual + de feedback (damage numbers / killstreak / shake graduado). Toda la lógica subyacente sigue funcionando idéntica.

## Lo que falta (siguientes pasos)

Si después de jugarlo querés profundizar la dirección, los próximos candidatos serían:

- **Critical hits explícitos**: lógica de daño con `isCrit` flag, no sólo el shorthand `≥ 50 damage`.
- **Variantes de muerte**: explosión grande para enemigos de alto HP (no solo `spawnDeathFx`).
- **Wordmark animado**: barrido de gradiente sobre las letras del menú cada 4s.
- **Splash screen**: 1.2s entre carga y menú con halo respirando, antes de revelar el wordmark.
- **Tienda cosmética**: skins de estación según el modelo de monetización del documento de análisis (sección 09).
