# Orbital Station — Prototipo

Defensa orbital 2D: una **estación espacial modular fija** en el centro que
auto-dispara mientras enemigos llegan desde los 360°. Al subir de nivel eliges
módulos (habilidades) en un draft tipo roguelite.

## Correr el proyecto

```bash
cd orbital-station
npm install
npm run dev      # http://localhost:5173
```

Para probar el modo mobile: abre la URL desde el móvil en la misma red, o usa
la vista responsive del navegador (DevTools → toggle device toolbar).

## Decisiones de diseño bloqueadas

| Aspecto | Decisión |
|---|---|
| Núcleo | Estación espacial modular fija en el centro |
| Motor | Phaser 3 + Vite (web → empaquetable a mobile con Capacitor) |
| Interacción | **Auto puro**: el jugador solo elige upgrades al subir de nivel |
| Habilidades | Draft aleatorio, 3 cartas, 4 slots |
| Progresión | Nivel 1 (nueva) → 3 upgrades → **nivel 5 = premium** |
| Disposición | Retrato, enemigos 360° derivando al centro |
| Monetización | Fuera del prototipo; *hooks* preparados (ver abajo) |

## Estética

Holograma sci-fi: glow aditivo, rejilla de radar con barrido, líneas de
escaneo, viñeta, naves/proyectiles de neón y estación con anillos animados.
Todo generado por código (texturas canvas), sin assets externos.

## Modos

- **Niveles** (campaña): mapa estelar tipo constelación. 5 niveles encadenados
  (`src/data/levels.js`); cada uno se gana **destruyendo una cuota de enemigos**
  (`targetKills`) con dificultad creciente. Progreso persistido en
  `localStorage` (`src/progress.js`).
- **Arcade infinito**: supervivencia sin fin, dificultad escalando con el tiempo.
- **Habilidades**: codex scrollable con los 3 especiales de cada módulo y
  **mejoras permanentes de daño** compradas con oro (`src/economy.js`).

## Enemigos (`src/data/enemies.js`, data-driven)

Catálogo data-driven con barra de vida holográfica. **Progresión narrativa por
nivel**: 1) escombros y rocas → 2) sondas de reconocimiento → 3) primer contacto
(primeras naves) → 4) flota hostil (naves, interceptores, acorazados, enjambres,
portanaves, bombas) → 5) todo + la **Nave Insignia** (jefe). Tipos especiales:
sanador, escudero, sigiloso, berserker, portanaves, bomba, interceptor (zigzag).

## Economía

Matar enemigos da **oro** (se banca al terminar la partida, persistido). En la
pantalla Habilidades se gasta oro para subir la **potencia permanente** de cada
módulo (+12% daño por nivel, hasta Nv8). Base preparada para monetización.

## Bucle de juego

1. La estación auto-apunta al enemigo más cercano **dentro de su alcance** y
   dispara sola. El alcance se ve como un anillo de radar holográfico.
2. Enemigos (asteroide / misil / nave) aparecen en cualquier borde y van al
   centro; cada uno con barra de vida holográfica.
3. Destruirlos da XP → al llenar la barra, **subes de nivel**.
4. Se ofrecen 3 módulos al azar (nuevos o upgrade de los que ya tienes).
5. Máximo 4 módulos por partida; progresión **7 niveles**: nuevo + 3 mejoras +
   **3 especiales en cadena** (Nv5/6/7).
6. Si la integridad del casco llega a 0 → game over.
7. Efectos de sonido procedurales (WebAudio, sin assets); silenciable.

## Habilidades implementadas (6)

`Cañón Múltiple` · `Misiles Buscadores` · `Anillo Orbital` · `Pulso Nova` ·
`Rayo de Plasma` · `Escudo Regenerativo`. Stats por nivel en
`src/data/abilities.js`; el comportamiento en `GameScene` (switch por id).
Especiales: perforación, fisión/campo de plasma, pulso/onda de choque,
escarcha/doble onda, doble/triple haz, detonación/espinas.

**Todas las armas tienen alcance** (no disparan a enemigos fuera de rango):
arma base y misiles tienen `range`; Nova/Anillo/Rayo lo definen por su radio.
`Cañón Múltiple` aumenta el alcance del arma base por nivel.

## Estructura

```
src/
  main.js            Config de Phaser + escenas
  config.js          TODO el balance (tunear aquí)
  data/abilities.js  Catálogo data-driven de habilidades
  scenes/GameScene.js  Lógica: estación, spawner, enemigos, habilidades, XP
  scenes/UIScene.js    HUD + overlay de draft + game over
```

## Hooks de monetización (para decidir después, NO implementados)

El diseño ya deja los puntos de enganche listos para cuando se decida el modelo:

- **Upgrade premium = nivel 5** de cada habilidad: ahora se obtiene jugando;
  es el candidato natural a "desbloqueo premium" (moneda dura o pago).
- **`Reparación de Emergencia`**: carta de soporte → futura "revive con rewarded ad".
- **Fin de partida**: pantalla ideal para intersticial / "duplicar recompensa".
- **Skins de la estación**: `tex_station` es una textura única → cosmético IAP trivial.

## Próximos pasos sugeridos

- Sustituir primitivas por sprites/arte.
- Meta-progresión persistente (localStorage) entre partidas.
- Naves enemigas que disparen + 1 jefe por hito de tiempo.
- Decidir y conectar el modelo de monetización sobre los hooks de arriba.
```
