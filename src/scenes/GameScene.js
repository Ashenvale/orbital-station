import Phaser from 'phaser';
import {
  GAME_W,
  GAME_H,
  COLORS,
  STATION,
  ABILITY_SLOTS,
  xpToNext,
  DIFFICULTY,
  MAX_RANGE
} from '../config.js';
import { ENEMY_CATALOG, enemyName, enemyInfoText } from '../data/enemies.js';
import { resistMul, resistSummary, weaknessColor } from '../data/enemyInfo.js';
import { t } from '../i18n.js';
import { ensureTextures, STATION_TEX_PAD } from '../gfxTextures.js';
import { createBackdrop } from '../backdrop.js';
import { Sfx } from '../sfx.js';
import { Music } from '../music.js';
import { LEVEL_BY_N } from '../data/levels.js';
import { WEAPONS, WEAPON_IDS, tx, cardMeta, wname, CAP_COMMON } from '../data/upgrades.js';
import {
  newUpgState,
  weaponStats,
  applyUpg,
  draftPool,
  occupiesSlot,
  isUnlocked,
  specialSlotsOpen
} from '../upgradeEngine.js';
import { Economy } from '../economy.js';
import {
  shipDamageMul,
  shipRateMul,
  shipHpMul,
  shipAtkSpdMul,
  shipRangeMul
} from '../data/shipmods.js';
import { Progress } from '../progress.js';

const CX = GAME_W / 2;
const CY = GAME_H / 2;
const SPAWN_RING = Math.max(GAME_W, GAME_H) * 0.62;
const ADD = Phaser.BlendModes.ADD;

// Arcade infinito: cada escalón de dificultad (cada `stepSeconds`) además de
// subir vida/cadencia DESBLOQUEA nuevos tipos de enemigo.
// Arcade infinito: UN tipo nuevo por escalón (como ir entre niveles), del
// más débil al más fuerte. Los duros aparecen mucho más tarde, no de entrada.
const ENDLESS_TIERS = [
  { from: 0, ids: ['debris', 'asteroid'] },
  { from: 1, ids: ['probe'] },
  { from: 2, ids: ['missile'] },
  { from: 3, ids: ['ship'] },
  { from: 4, ids: ['interceptor'] },
  { from: 5, ids: ['swarm'] },
  { from: 6, ids: ['bomb'] },
  { from: 7, ids: ['armored'] },
  { from: 8, ids: ['stealth'] },
  { from: 9, ids: ['berserker'] },
  { from: 10, ids: ['healer'] },
  { from: 11, ids: ['shielder'] },
  { from: 12, ids: ['carrier'] }
];

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    ensureTextures(this);
    this.sfx = Sfx;
    Music.play(); // música de fondo durante el modo de juego

    // -- Modo: campaña (level) o arcade infinito (endless) -------------------
    const data = this.scene.settings.data || {};
    this.levelData = data;
    // Tutorial breve solo la primerísima vez (no en reintentos del Nv1).
    this.tutorial = !!data.tutorial && localStorage.getItem('os_tut') !== '1';
    if (this.tutorial) localStorage.setItem('os_tut', '1');
    if (data.level && LEVEL_BY_N[data.level]) {
      const L = LEVEL_BY_N[data.level];
      this.mode = 'level';
      this.levelNum = L.n;
      this.levelName = L.name;
      this.targetKills = L.targetKills;
      this.lvlMul = { hp: L.hpMul, speed: L.speedMul, spawn: L.spawnMul };
      // rampMul < 1 estira los escalones => la dificultad sube más lento.
      this.stepSeconds = DIFFICULTY.stepSeconds / (L.rampMul || 1);
      this.enemyPool = L.pool.slice();
      this.bossId = L.boss || null;
      // Solo el enemigo NUEVO de este nivel muestra su cartel de presentación.
      this._introduced = L.introduced;
    } else {
      this.mode = 'endless';
      this._introduced = null;
      this.levelNum = 0;
      this.targetKills = 0;
      this.lvlMul = { hp: 1, speed: 1, spawn: 1 };
      // Arcade: escala LENTO. Cada escalón (26 s) sube vida y desbloquea UN
      // tipo de enemigo más fuerte (empieza con piedras; los duros, tarde).
      this.stepSeconds = 26;
      // Arcade: el pool se calcula por escalón (desbloqueo progresivo).
      this.enemyPool = null;
      this.bossId = null;
    }
    this.paused = false;
    this._won = false;
    this._winPending = false;
    this._bossSpawned = false;
    this._bossKilled = false;
    this._goldBanked = false;
    this._seenTypes = new Set(); // tipos ya presentados (card) en esta partida
    // -- Sistema de upgrades v0.7 -------------------------------------------
    this.up = newUpgState();
    this.up.cannon.owned = true; // el cañón base dispara desde el segundo 0
    this.bossCount = parseInt(localStorage.getItem('os_bosses') || '0', 10) || 0;
    // MODO DEV (su propio modo, NO toca los modos normales): enemigos
    // infinitos, estación invulnerable, y elegís el arma que quieras cuando
    // quieras con el botón "✚ ARMA" (sin XP). Se entra con ?dev=1.
    this.dev = !!data.dev;
    if (this.dev) {
      this.mode = 'endless'; // spawn indefinido
      this.bossCount = 99; // el selector ofrece TODAS las armas
    }

    // -- Módulos permanentes de la nave (comprados con oro) -----------------
    this.abilRateMul = shipAtkSpdMul(Economy.powerLevel('sh_atkspd'));
    this.rangeMul = shipRangeMul(Economy.powerLevel('sh_range'));
    this.shipDmgMul = shipDamageMul(Economy.powerLevel('sh_damage'));
    this.shipRateMul = shipRateMul(Economy.powerLevel('sh_rate'));

    // -- Estado de la partida -------------------------------------------------
    this.running = true;
    this.maxHp = Math.round(STATION.maxHp * shipHpMul(Economy.powerLevel('sh_hp')));
    this.hp = this.maxHp;
    this.shield = 0;
    this.shieldMax = 0;
    this.shieldBrokenFlag = false;
    this.level = 1;
    this.xp = 0;
    this.kills = 0;
    this.spawned = 0; // enemigos generados (tope = targetKills en campaña)
    this.quotaKills = 0; // bajas que cuentan para la cuota (no jefe ni invocados)
    this.gold = 0;
    this.timeSurvived = 0;
    this.pendingLevelUps = 0;
    this.drafting = false;

    this.backdrop = createBackdrop(this, { nebula: true });
    this.buildStation();

    // -- Grupos de fisicas (con reciclaje: ver acquire/kill) -----------------
    this.enemies = this.physics.add.group();
    this.bullets = this.physics.add.group();
    this.missiles = this.physics.add.group();
    this.orbsGroup = this.physics.add.group();
    this.bossShots = this.physics.add.group(); // disparos de jefe (destruibles)
    // Pools de FX (Text/Image) reutilizables — evitan GC en cada golpe/muerte.
    this._dnPool = []; // damage numbers
    this._glowPool = []; // glows de muerte / plasma
    this.orbs = [];
    this.drones = []; // dron(es) v0.7 (se reconstruyen por nivel)
    this._droneRespawnAt = null; // respawn en escuadrón (todos juntos)
    this._bhs = []; // agujeros negros activos (puede haber +1 con la común)
    this.bhGfx = null;

    this.laserGfx = this.add.graphics().setDepth(6).setBlendMode(ADD);
    this.enemyBars = this.add.graphics().setDepth(7); // barras de vida sobre enemigos
    this.droneGfx = this.add.graphics().setDepth(7); // barra de vida del/los drone(s)

    // -- Colisiones ----------------------------------------------------------
    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHit, null, this);
    this.physics.add.overlap(this.missiles, this.enemies, this.onMissileHit, null, this);
    this.physics.add.overlap(this.orbsGroup, this.enemies, this.onOrbHit, null, this);
    this.physics.add.overlap(this.station, this.enemies, this.onEnemyReachStation, null, this);
    // Disparos del jefe: el jugador puede destruirlos; si llegan, dañan.
    this.physics.add.overlap(this.bullets, this.bossShots, this.onPlayerHitBossShot, null, this);
    this.physics.add.overlap(this.missiles, this.bossShots, this.onPlayerHitBossShot, null, this);
    this.physics.add.overlap(this.orbsGroup, this.bossShots, this.onPlayerHitBossShot, null, this);
    this.physics.add.overlap(this.station, this.bossShots, this.onBossShotStation, null, this);

    this.baseWeaponT = 0;
    // Pre-cargado: el primer enemigo aparece en el primer frame (sin espera).
    this.spawnT = 1e6;
    this._firstSpawn = true;
    this.abilityTimers = {};

    // Tutorial in-game: NO se pausa. Las burbujas-coach aparecen sobre el
    // juego en marcha (UIScene.tutStart, disparadas por eventos reales).

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    this.events.emit('reset');
  }

  buildStation() {
    // Halo pulsante (arcade: doble halo cian + magenta)
    this.stationHalo = this.add
      .image(CX, CY, 'tex_glow')
      .setTint(COLORS.station)
      .setBlendMode(ADD)
      .setScale(3.2)
      .setAlpha(0.55)
      .setDepth(2);
    this.tweens.add({
      targets: this.stationHalo,
      scale: 3.8,
      alpha: 0.75,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
    this.stationHaloMag = this.add
      .image(CX, CY, 'tex_glow')
      .setTint(COLORS.laser)
      .setBlendMode(ADD)
      .setScale(2.2)
      .setAlpha(0.3)
      .setDepth(2);
    this.tweens.add({
      targets: this.stationHaloMag,
      scale: 2.8,
      alpha: 0.5,
      duration: 1700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    // Anillo de modulos con marcas (gira) — más grueso arcade
    this.moduleRing = this.add.graphics().setDepth(3);
    this.moduleRing.lineStyle(2, COLORS.station, 0.7);
    this.moduleRing.strokeCircle(0, 0, STATION.radius + 16);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r1 = STATION.radius + 12;
      const r2 = STATION.radius + 20;
      this.moduleRing.lineBetween(
        Math.cos(a) * r1,
        Math.sin(a) * r1,
        Math.cos(a) * r2,
        Math.sin(a) * r2
      );
    }
    this.moduleRing.setPosition(CX, CY);

    // Escudo (bola translucida; tickShield ajusta fill/radio)
    this.shieldFx = this.add
      .circle(CX, CY, STATION.radius + 10, COLORS.shield, 0)
      .setStrokeStyle(1.5, COLORS.shield, 0.4)
      .setDepth(4);

    // Anillo de ALCANCE del arma base (radar holografico, gira lento).
    // Su radio refleja el alcance efectivo y crece con Cañón Múltiple.
    this.rangeRing = this.add.graphics().setDepth(3).setPosition(CX, CY);
    this._rangeDrawn = -1;
    // Anillos de alcance de las demás armas (uno por habilidad con rango).
    this.weaponRings = this.add.graphics().setDepth(3).setPosition(CX, CY);
    this._ringSig = '';

    // Anillo de INTEGRIDAD: arco alrededor del núcleo que se vacía con el daño
    // y cambia de color (verde → ámbar → rojo). Lectura holográfica del HP.
    this.integrityRing = this.add.graphics().setDepth(4).setPosition(CX, CY);

    // Estacion
    this.station = this.add.image(CX, CY, 'tex_station').setDepth(5);
    this.physics.add.existing(this.station, true);
    this.station.body.setCircle(STATION.radius, STATION_TEX_PAD, STATION_TEX_PAD);
  }

  // Medidor de integridad holográfico: anillo de celdas de neón que se vacían,
  // con arco interior tenue, acento de avance y barrido de escaneo.
  drawIntegrityRing() {
    const g = this.integrityRing;
    g.clear();
    const ratio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    const R = STATION.radius + 30;
    const col = ratio > 0.5 ? 0x5bffb8 : ratio > 0.25 ? 0xffe640 : 0xff3a5e;
    const segs = 44;
    const full = (Math.PI * 2) / segs;
    const gap = full * 0.28;
    const lit = Math.round(segs * ratio);
    const top = -Math.PI / 2;

    for (let i = 0; i < segs; i++) {
      const a0 = top + i * full + gap / 2;
      const a1 = top + (i + 1) * full - gap / 2;
      const on = i < lit;
      g.lineStyle(on ? 4 : 2, on ? col : 0x3a1268, on ? 1 : 0.35);
      g.beginPath();
      g.arc(0, 0, R, a0, a1, false);
      g.strokePath();
    }

    if (ratio > 0) {
      // Relleno interior tenue + acento de avance brillante.
      g.lineStyle(1.5, col, 0.28);
      g.beginPath();
      g.arc(0, 0, R - 5, top, top + Math.PI * 2 * ratio, false);
      g.strokePath();
      const edge = top + Math.PI * 2 * ratio;
      const ex = Math.cos(edge) * R;
      const ey = Math.sin(edge) * R;
      g.fillStyle(col, 0.35);
      g.fillCircle(ex, ey, 6);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(ex, ey, 2.6);

      // Barrido de escaneo recorriendo la zona "viva".
      const t = ((this.timeSurvived * 0.00045) % 1 + 1) % 1;
      const sa = top + t * Math.PI * 2 * ratio;
      g.lineStyle(3, 0xffffff, 0.5);
      g.beginPath();
      g.arc(0, 0, R, sa, sa + full * 1.6, false);
      g.strokePath();
    }
  }

  // ===========================================================================
  //  LOOP PRINCIPAL
  // ===========================================================================
  update(time, deltaMs) {
    const dt = Math.min(deltaMs, 50);

    this.backdrop.update(dt);

    if (!this.running) return;

    this.timeSurvived += dt;

    // Fin de nivel: hay que cumplir la CUOTA y, si el nivel tiene jefe,
    // también MATARLO. Quota sin jefe = sigue; jefe sin quota = sigue.
    // (Los enemigos que invoca el jefe NO cuentan para la cuota.)
    if (this.mode === 'level' && !this._won) {
      const quotaDone =
        this.quotaKills >= this.targetKills ||
        (this.spawned >= this.targetKills && this._activeQuotaCount() === 0);
      const bossDone = !this.bossId || this._bossKilled;
      if (quotaDone && bossDone) this.triggerWin();
    }

    const step = this.difficultyStep();

    this.updateEnemies(dt);
    this.updateBaseWeapon(dt);
    this.updateAbilities(dt);
    this.updateSpawner(dt, step);
    this.cullProjectiles();

    // Jefe: aparece cerca del final de la cuota (uno solo).
    if (
      this.bossId &&
      !this._bossSpawned &&
      this.quotaKills >= Math.floor(this.targetKills * 0.6)
    ) {
      this._bossSpawned = true;
      this.sfx?.play('shieldbreak');
      this.spawnBoss(step);
    }

    // Arcade (infinito): un jefe cada cierto tiempo, ciclando los 3.
    if (this.mode === 'endless' && !this.dev) {
      this._endlessBossT = (this._endlessBossT || 0) + dt;
      if (this._endlessBossT >= 70000) {
        this._endlessBossT = 0;
        this.spawnEndlessBoss(step);
      }
    }
    this.station.rotation += 0.35 * (dt / 1000);
    this.moduleRing.rotation -= 0.5 * (dt / 1000);

    // Anillo del arma base: redibuja solo si el alcance cambió (upgrade).
    const r = this.baseRange();
    if (r !== this._rangeDrawn) {
      this.drawRangeRing(r);
      this._rangeDrawn = r;
    }
    this.rangeRing.rotation += 0.18 * (dt / 1000);

    // Anillos de las demás armas: redibuja solo si cambió algún rango.
    const rings = this.weaponRanges();
    const sig = rings.map((w) => `${w.id}:${Math.round(w.range)}`).join('|');
    if (sig !== this._ringSig) {
      this.drawWeaponRings(rings);
      this._ringSig = sig;
    }

    this.drawIntegrityRing();
    this.drawEnemyBars();
  }

  // Barra de vida holográfica sobre cada enemigo (solo si está dañado).
  drawEnemyBars() {
    const g = this.enemyBars;
    g.clear();
    this.enemies.children.iterate((e) => {
      if (!e || !e.active) return;
      const top = e.y - e.displayHeight / 2;
      // Aura de debilidad: punto del color del tipo que más le hace daño.
      if (!e.flags || !e.flags.boss) {
        g.fillStyle(weaknessColor(e.enemyType), 0.95);
        g.fillCircle(e.x, top - 13, 3);
      }
      if (e.hp >= e.maxHp) return;
      const ratio = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
      const w = 26;
      const x = e.x - w / 2;
      const y = top - 7;
      const col = ratio > 0.5 ? 0x5bffb8 : ratio > 0.25 ? 0xffe640 : 0xff3a5e;
      g.fillStyle(0x10081f, 0.85);
      g.fillRect(x - 1, y - 1, w + 2, 5);
      g.fillStyle(col, 1);
      g.fillRect(x, y, w * ratio, 3);
    });
  }

  // Aplica la pasiva de Alcance y topa en MAX_RANGE (no sale de pantalla).
  scaledRange(r) {
    return Math.min(MAX_RANGE, r * this.rangeMul);
  }

  // Alcance efectivo del arma común (fijo + pasiva de Alcance).
  baseRange() {
    return this.scaledRange(STATION.baseWeapon.range);
  }

  // v0.7: el daño de las armas viene del draft, no del oro. Shim neutro.
  pmul() {
    return 1;
  }

  // Stats efectivos de un arma (motor v0.7).
  ws(id) {
    return weaponStats(id, this.up);
  }

  // Los proyectiles no "vuelan al infinito": se eliminan al salir de pantalla.
  cullProjectiles() {
    const m = 24;
    const now = this.timeSurvived;
    const cull = (grp) =>
      grp.children.iterate((p) => {
        if (!p || !p.active) return;
        const out = p.x < -m || p.x > GAME_W + m || p.y < -m || p.y > GAME_H + m;
        if (out || (p._dieAt && now >= p._dieAt)) this.kill(p);
      });
    cull(this.bullets);
    cull(this.missiles);
    cull(this.bossShots);
  }

  // ---------------------------------------------------------------------------
  //  RECICLAJE / POOLING
  //  Reusamos sprites en vez de crear+destruir (menos GC, más fluido).
  //  acquire = saca uno muerto del grupo o crea; kill = lo "guarda" inactivo.
  // ---------------------------------------------------------------------------
  acquire(group, x, y, key) {
    let o = group.getFirstDead(false);
    if (o) {
      o.setTexture(key);
      o.enableBody(true, x, y, true, true);
    } else {
      o = group.create(x, y, key);
    }
    o.setActive(true).setVisible(true).setAngle(0).setScale(1).setAlpha(1).clearTint();
    return o;
  }

  kill(o) {
    if (!o || !o.active) return;
    o.disableBody(true, true); // inactivo + oculto + body off (queda en el pool)
  }

  // Texto flotante reutilizable.
  getText() {
    const t = this._dnPool.pop();
    if (t) {
      this.tweens.killTweensOf(t);
      t.setActive(true).setVisible(true).setAlpha(1).setScale(1);
      return t;
    }
    return this.add
      .text(0, 0, '', { fontFamily: '"Pixelify Sans", "VT323", monospace' })
      .setDepth(20);
  }

  freeText(t) {
    this.tweens.killTweensOf(t);
    t.setActive(false).setVisible(false);
    this._dnPool.push(t);
  }

  // Glow (tex_glow) reutilizable para FX de muerte / plasma.
  getGlow() {
    const g = this._glowPool.pop();
    if (g) {
      this.tweens.killTweensOf(g);
      g.setActive(true).setVisible(true);
      return g;
    }
    return this.add.image(0, 0, 'tex_glow').setBlendMode(ADD);
  }

  freeGlow(g) {
    this.tweens.killTweensOf(g);
    g.setActive(false).setVisible(false);
    this._glowPool.push(g);
  }

  drawRangeRing(r) {
    const g = this.rangeRing;
    g.clear();
    g.lineStyle(1, COLORS.station, 0.16);
    g.strokeCircle(0, 0, r);
    g.lineStyle(2, COLORS.station, 0.4);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const long = i % 6 === 0;
      const r1 = r - (long ? 8 : 4);
      g.lineBetween(Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a) * r, Math.sin(a) * r);
    }
  }

  // Anillos de alcance de las armas equipadas (motor v0.7).
  weaponRanges() {
    const out = [];
    const add = (id, range) => out.push({ id, range, color: WEAPONS[id].color });
    if (this.up.missiles.owned)
      add('missiles', this.scaledRange(this.ws('missiles').range));
    if (this.up.laser.owned) add('laser', this.scaledRange(this.ws('laser').range));
    if (this.up.nova.owned) add('nova', Math.min(MAX_RANGE, this.ws('nova').radius));
    if (this.up.orbital.owned) add('orbital', this.ws('orbital').radius);
    if (this.up.blackhole.owned) add('blackhole', this.ws('blackhole').radius);
    if (this.up.railgun.owned) add('railgun', this.scaledRange(this.ws('railgun').range));
    return out;
  }

  drawWeaponRings(rings) {
    const g = this.weaponRings;
    g.clear();
    for (const w of rings) {
      g.lineStyle(1, w.color, 0.22);
      g.strokeCircle(0, 0, w.range);
      // Marcador en la parte superior con el color del arma (para identificarla).
      g.fillStyle(w.color, 0.9);
      g.fillCircle(0, -w.range, 3);
    }
  }

  // Resalte al conseguir/mejorar un arma: el nuevo rango "aparece".
  pingRange(range, color) {
    const ring = this.add
      .circle(CX, CY, STATION.radius, color, 0)
      .setStrokeStyle(2, color, 0.95)
      .setBlendMode(ADD)
      .setDepth(6);
    this.tweens.add({
      targets: ring,
      radius: range,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.out',
      onComplete: () => ring.destroy()
    });
  }

  difficultyStep() {
    return Math.floor(this.timeSurvived / 1000 / this.stepSeconds);
  }

  // ===========================================================================
  //  ENEMIGOS
  // ===========================================================================
  updateSpawner(dt, step) {
    // Campaña: aparecen EXACTAMENTE targetKills enemigos (sin spawn infinito).
    if (this.mode === 'level' && this.spawned >= this.targetKills) return;
    this.spawnT += dt;
    const interval =
      Math.max(
        DIFFICULTY.spawnIntervalMinMs,
        DIFFICULTY.spawnIntervalStartMs * Math.pow(DIFFICULTY.spawnIntervalDecay, step)
      ) / this.lvlMul.spawn;
    if (this.spawnT >= interval) {
      this.spawnT = 0;
      this.spawnEnemy(step);
    }
  }

  // Arcade: tipos desbloqueados hasta el escalón actual.
  endlessPool(step) {
    const ids = [];
    for (const t of ENDLESS_TIERS) if (step >= t.from) ids.push(...t.ids);
    return ids.filter(
      (id) => ENEMY_CATALOG[id] && (ENEMY_CATALOG[id].weight || 0) > 0
    );
  }

  pickEnemyType(pool) {
    let total = 0;
    for (const id of pool) total += ENEMY_CATALOG[id].weight || 0;
    let r = Math.random() * total;
    for (const id of pool) {
      r -= ENEMY_CATALOG[id].weight || 0;
      if (r <= 0) return id;
    }
    return pool[0];
  }

  spawnEnemy(step) {
    const pool = this.enemyPool || this.endlessPool(step);
    const type = this.pickEnemyType(pool);
    const def = ENEMY_CATALOG[type];
    const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const x = CX + Math.cos(ang) * SPAWN_RING;
    const y = CY + Math.sin(ang) * SPAWN_RING;

    const created = [];
    if (def.flags && def.flags.swarm) {
      for (let i = 0; i < def.flags.swarmCount; i++) {
        created.push(
          this.makeEnemy(
            def.flags.swarm,
            x + Phaser.Math.Between(-40, 40),
            y + Phaser.Math.Between(-40, 40),
            step
          )
        );
      }
    } else {
      created.push(this.makeEnemy(type, x, y, step));
    }

    // El PRIMER enemigo de la partida aparece ~5 s más cerca (llega antes;
    // la velocidad no cambia). Tope para no nacer dentro del alcance.
    if (this._firstSpawn) {
      this._firstSpawn = false;
      created.forEach((e) => {
        const dx = CX - e.x;
        const dy = CY - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const shift = Math.min(e.baseSpeed * 5, d - 270);
        if (shift > 0) {
          e.x += (dx / d) * shift;
          e.y += (dy / d) * shift;
        }
      });
    }

    this.spawned += created.length; // cuenta para el tope de la campaña
  }

  makeEnemy(type, x, y, step) {
    const def = ENEMY_CATALOG[type];
    if (!this._seenTypes.has(type)) {
      this._seenTypes.add(type);
      // Campaña: solo el enemigo introducido en ESTE nivel se presenta
      // (los arrastrados de niveles previos no). Arcade: primer avistamiento.
      let showId = null;
      if (this.mode === 'level') {
        if (
          type === this._introduced ||
          (this._introduced === 'swarm' && type === 'drone')
        )
          showId = this._introduced;
      } else {
        showId = type;
      }
      if (showId) {
        const rs = resistSummary(showId);
        this.events.emit('enemyintro', {
          name: enemyName(showId),
          color: ENEMY_CATALOG[showId].color,
          info: enemyInfoText(showId),
          resiste: rs.resiste,
          debil: rs.debil
        });
      }
    }
    const e = this.acquire(this.enemies, x, y, `tex_e_${type}`);
    e.setBlendMode(ADD).setDepth(3);
    e.enemyType = type;
    e.flags = def.flags || {};
    e.move = def.move;
    // Reset de estado por si viene reciclado del pool.
    e._shieldedUntil = 0;
    e._shieldMul = 1;
    e._distortUntil = 0;
    e._poisonEnd = 0;
    e._poisonDps = 0;
    e._untargetable = false;
    e._heldUntil = 0;
    e._noQuota = false; // los invocados por jefe/portanaves se marcan true
    e._atkT = 0;
    e._blinkT = 0;
    e._bossInit = false;
    const grow = e.flags.boss ? 1 : Math.pow(DIFFICULTY.enemyHpGrowth, step);
    e.maxHp = Math.round(def.hp * grow * this.lvlMul.hp);
    e.hp = e.maxHp;
    e.baseSpeed = def.speed * this.lvlMul.speed;
    e.contactDmg = def.contactDmg;
    e.dmgMul = e.flags.dmgMul || 1;
    // XP proporcional al ESFUERZO real (vida efectiva = hp / blindaje).
    // Así: enemigo más difícil => más XP, y el ritmo de subir de nivel es
    // CONSISTENTE en todos los niveles (más vida por nivel => más XP).
    const effortHp = e.maxHp / e.dmgMul;
    e.xpValue = Math.max(1, Math.round(effortHp * 0.7));
    e.goldValue = Math.max(1, Math.round(e.xpValue * 0.5));
    e.slowUntil = 0;
    e._orbCdUntil = 0;
    e.bornAt = this.timeSurvived;
    e.zzPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    e._auraT = 0;
    e._droneT = 0;
    const r = def.radius;
    e.body.setCircle(r, e.width / 2 - r, e.height / 2 - r);
    return e;
  }

  spawnBoss(step) {
    const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const e = this.makeEnemy(
      this.bossId,
      CX + Math.cos(ang) * SPAWN_RING,
      CY + Math.sin(ang) * SPAWN_RING,
      step
    );
    e.setScale(1.15);
    this.cameras.main.shake(300, 0.008);
  }

  // Aviso "arma desbloqueada" — UNA sola vez por arma (persistido).
  announceUnlock(wid) {
    const key = 'os_unlocked_' + wid;
    if (localStorage.getItem(key) === '1') return;
    localStorage.setItem(key, '1');
    this.sfx?.play('win');
    this.events.emit('unlocked', { wid, name: wname(wid), color: WEAPONS[wid].color });
  }

  // Enemigos activos que cuentan para la cuota (ni jefe ni invocados).
  _activeQuotaCount() {
    let n = 0;
    this.enemies.children.iterate((e) => {
      if (e && e.active && !e._noQuota && !(e.flags && e.flags.boss)) n++;
    });
    return n;
  }

  // IA de jefes (no kamikazes: mantienen distancia y atacan a distancia).
  tickBoss(e, dt, fl, now, dx, dy, d) {
    const ux = dx / d;
    const uy = dy / d; // hacia el centro
    const tx = -uy;
    const ty = ux; // tangente
    const spd = e.baseSpeed;
    e.rotation = Math.atan2(dy, dx) + Math.PI / 2;
    e._atkT += dt;

    if (fl.bossKind === 'orbital') {
      const R = Math.min(fl.orbitR, MAX_RANGE - 20);
      const radial = Phaser.Math.Clamp((R - d) * 1.6, -spd, spd); // mantener R
      e.body.setVelocity(tx * spd - ux * radial, ty * spd - uy * radial);
      if (e._atkT >= fl.fireMs) {
        e._atkT = 0;
        this.bossFire(e, fl.shotDmg, 1, fl);
      }
    } else if (fl.bossKind === 'siege') {
      const R = fl.holdR;
      if (d > R + 6) {
        e.body.setVelocity(ux * spd, uy * spd); // avanza
      } else {
        e.body.setVelocity(tx * spd * 0.35, ty * spd * 0.35); // se planta
      }
      if (e._atkT >= fl.fireMs) {
        e._atkT = 0;
        this.bossFire(e, fl.shotDmg, fl.volley, fl);
      }
    } else if (fl.bossKind === 'warp') {
      e._blinkT += dt;
      const warping = now < (e._warpUntil || 0);
      e._untargetable = warping;
      e.setAlpha(warping ? 0.25 : 1);
      if (e._blinkT >= fl.blinkMs && !warping) {
        e._blinkT = 0;
        e._warpUntil = now + 260; // breve fase de salto (intargeteable)
        const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const rr = 138; // dentro del alcance de las armas (no se va lejos)
        e.x = CX + Math.cos(a) * rr;
        e.y = CY + Math.sin(a) * rr;
        this.cameras.main.flash(120, 150, 80, 255);
      }
      e.body.setVelocity(tx * spd * (warping ? 0 : 0.6), ty * spd * (warping ? 0 : 0.6));
      if (!warping && e._atkT >= fl.fireMs) {
        e._atkT = 0;
        this.bossFire(e, fl.shotDmg, fl.spread, fl);
      }
    } else {
      // fallback: orbita defensiva
      const radial = Phaser.Math.Clamp((MAX_RANGE * 0.7 - d) * 1.5, -spd, spd);
      e.body.setVelocity(tx * spd - ux * radial, ty * spd - uy * radial);
    }
  }

  // Disparo de jefe: proyectil FÍSICO destruible. El jugador puede abatirlo
  // con balas/misiles/orbes; si llega a la estación, la daña.
  bossFire(e, dmg, n, fl) {
    if (this._won || this._winPending) return;
    this.sfx?.play('shoot');
    const col = (ENEMY_CATALOG[e.enemyType] && ENEMY_CATALOG[e.enemyType].color) || 0xff4f86;
    const base = Math.atan2(CY - e.y, CX - e.x);
    const speed = 200;
    for (let i = 0; i < n; i++) {
      const off = n > 1 ? (i - (n - 1) / 2) * 0.18 : 0;
      const ang = base + off;
      const p = this.acquire(this.bossShots, e.x, e.y, 'tex_bullet');
      p.setBlendMode(ADD).setDepth(6).setScale(1.5).setTint(col);
      p.damage = dmg;
      p._dieAt = this.timeSurvived + 6000;
      p.body.setCircle(5, p.width / 2 - 5, p.height / 2 - 5);
      p.body.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed);
    }
  }

  // El jugador derriba un disparo del jefe (cuenta como proyectil).
  onPlayerHitBossShot(proj, shot) {
    if (!shot.active) return;
    this.sfx?.play('hit');
    this.spawnDeathFx(shot.x, shot.y, 0xfff0a0);
    this.kill(shot);
    // El proyectil del jugador se consume salvo que perfore.
    if (proj && proj.active && proj._hit) {
      if (proj.pierce > 0) proj.pierce--;
      else this.kill(proj);
    }
  }

  onBossShotStation(station, shot) {
    if (!shot.active) return;
    this.applyStationDamage(shot.damage);
    this.spawnDeathFx(shot.x, shot.y, 0xff8a8a);
    this.kill(shot);
  }

  updateEnemies(dt) {
    const now = this.timeSurvived;
    this.enemies.children.iterate((e) => {
      if (!e || !e.active) return;
      const fl = e.flags || {};

      // Berserker: acelera con el tiempo.
      if (fl.berserker) e.baseSpeed = Math.min(fl.speedMax, e.baseSpeed + fl.accel * (dt / 1000));

      // Sigiloso: alterna fase visible / fantasma (intargeteable).
      if (fl.stealth) {
        const period = fl.phaseOnMs + fl.phaseOffMs;
        const ph = (now - e.bornAt) % period;
        e._untargetable = ph >= fl.phaseOnMs;
        e.setAlpha(e._untargetable ? 0.16 : 1);
      }

      const dx = CX - e.x;
      const dy = CY - e.y;
      const d = Math.hypot(dx, dy) || 1;

      // Jefes: IA propia (NO se lanzan al centro). Maneja todo y sale.
      if (fl.boss) {
        this.tickBoss(e, dt, fl, now, dx, dy, d);
        if (fl.healer || fl.shielder || fl.carrier) {
          e._auraT += dt;
          if (e._auraT >= 360) {
            this.enemyAura(e, fl, e._auraT);
            e._auraT = 0;
          }
        }
        return;
      }

      // Bomba: detona por proximidad (no por contacto).
      if (fl.bomb && d <= fl.bombRange) {
        this.bombExplode(e, fl);
        return;
      }

      const slowed = now < e.slowUntil;
      const sp = e.baseSpeed * (slowed ? 0.4 : 1);
      const nx = dx / d;
      const ny = dy / d;
      if (e.move === 'zigzag') {
        const lat = Math.sin((now - e.bornAt) / 1000 * fl.zigzagFreq + e.zzPhase) * fl.zigzagAmp;
        e.body.setVelocity(nx * sp - ny * lat, ny * sp + nx * lat);
      } else {
        e.body.setVelocity(nx * sp, ny * sp);
      }

      if (!fl.stealth) e.setTint(slowed ? 0x6fa8ff : 0xffffff);
      if (e.enemyType === 'asteroid') e.rotation += 0.5 * (dt / 1000);
      else e.rotation = Math.atan2(dy, dx) + Math.PI / 2;

      // Auras (sanador / escudero) y portanaves: con throttle.
      if (fl.healer || fl.shielder || fl.carrier) {
        e._auraT += dt;
        if (e._auraT >= 360) {
          this.enemyAura(e, fl, e._auraT);
          e._auraT = 0;
        }
      }
    });
  }

  enemyAura(e, fl, elapsed) {
    if (fl.healer) {
      this.enemies.children.iterate((o) => {
        if (o && o.active && o !== e && Math.hypot(o.x - e.x, o.y - e.y) < fl.healRadius)
          o.hp = Math.min(o.maxHp, o.hp + fl.healPerSec * (elapsed / 1000));
      });
      const ring = this.add
        .circle(e.x, e.y, 8, 0x7affc4, 0.3)
        .setBlendMode(ADD)
        .setDepth(5);
      this.tweens.add({
        targets: ring,
        radius: fl.healRadius,
        alpha: 0,
        duration: 360,
        onComplete: () => ring.destroy()
      });
    }
    if (fl.shielder) {
      this.enemies.children.iterate((o) => {
        if (o && o.active && Math.hypot(o.x - e.x, o.y - e.y) < fl.shieldRadius) {
          o._shieldedUntil = this.timeSurvived + 460;
          o._shieldMul = fl.shieldMul;
        }
      });
    }
    if (fl.carrier) {
      e._droneT += elapsed;
      if (e._droneT >= fl.droneEveryMs) {
        e._droneT = 0;
        for (let i = 0; i < fl.droneCount; i++) {
          const child = this.makeEnemy(
            fl.carrier,
            e.x + Phaser.Math.Between(-26, 26),
            e.y + Phaser.Math.Between(-26, 26),
            this.difficultyStep()
          );
          child._noQuota = true; // invocado: no cuenta para la cuota
        }
      }
    }
  }

  bombExplode(e, fl) {
    this.applyStationDamage(fl.bombDmg);
    this.sfx?.play('explosion');
    const fx = this.add
      .image(e.x, e.y, 'tex_glow')
      .setTint(0xff8a3d)
      .setBlendMode(ADD)
      .setScale(0.3)
      .setDepth(6);
    this.tweens.add({
      targets: fx,
      scale: (fl.bombFx * 2) / 64,
      alpha: 0,
      duration: 360,
      onComplete: () => fx.destroy()
    });
    this.cameras.main.shake(160, 0.008);
    e.destroy();
  }

  // ===========================================================================
  //  ARMA COMÚN (cañón base de la estación; NO es Cañón Múltiple)
  //  Solo la mejora la PASIVA de nave (Cañón Principal), no las de habilidades.
  // ===========================================================================
  // Cañón base (motor v0.7): siempre activo. Comunes: +daño/+cadencia/
  // +proyectil/+crítico. Especiales: explosivo / perforación.
  updateBaseWeapon(dt) {
    const st = this.ws('cannon');
    this.baseWeaponT += dt;
    if (this.baseWeaponT < st.cooldownMs / this.shipRateMul) return;
    const target = this.nearestEnemy(this.scaledRange(st.range));
    if (!target) return;
    this.baseWeaponT = 0;

    let damage = st.damage; // la pasiva +Daño se aplica en damageEnemy (global)
    if (st.crit > 0 && Math.random() < st.crit) damage *= 2;
    const n = st.projectiles;
    const baseAng = Math.atan2(target.y - CY, target.x - CX);
    const spread = Phaser.Math.DegToRad(7);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * spread;
      const b = this.fireBullet(baseAng + off, st.bulletSpeed, damage, st.pierce, 'kinetic');
      b.explode = !!st.special.explosive;
      b.bounce = st.special.ricochet ? 1 : 0; // 1 rebote por la mejora
    }
    this.sfx?.play('shoot');
  }

  fireBullet(angle, speed, damage, pierce, type = 'kinetic') {
    const b = this.acquire(this.bullets, CX, CY, 'tex_bullet');
    b.setBlendMode(ADD).setDepth(4).setScale(0.9);
    b.damage = damage;
    b.pierce = pierce;
    b.dmgType = type;
    b.explode = false;
    b.bounce = 0;
    b.slowMs = 0;
    b.knockback = 0;
    b._spd = speed;
    if (b._hit) b._hit.clear();
    else b._hit = new Set();
    b.body.setCircle(4, b.width / 2 - 4, b.height / 2 - 4);
    b.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    b._dieAt = this.timeSurvived + 2600; // auto-reciclaje (ver cullProjectiles)
    return b;
  }

  // ===========================================================================
  //  HABILIDADES
  // ===========================================================================
  updateAbilities(dt) {
    this.laserGfx.clear();
    const U = this.up;
    if (U.missiles.owned) this.tickMissiles(dt);
    if (U.nova.owned) this.tickNova(dt);
    if (U.laser.owned) this.tickLaser(dt);
    if (U.shield.owned) this.tickShield(dt);
    if (U.drone.owned) this.tickDrone(dt);
    if (U.blackhole.owned) this.tickBlackhole(dt);
    if (U.railgun.owned) this.tickRailgun(dt);
    this.updateOrbs(dt);
  }

  // Escopeta de Plasma (recompensa Jefe 2): ráfaga de perdigones en abanico,
  // corto alcance. Distinta del láser (continuo) — esto es burst de cerca.
  tickRailgun(dt) {
    const st = this.ws('railgun');
    this.abilityTimers.rail = (this.abilityTimers.rail || 0) + dt;
    if (this.abilityTimers.rail < st.cooldownMs / this.abilRateMul) return;
    const range = this.scaledRange(st.range);
    if (!this.nearestEnemy(range)) return;
    this.abilityTimers.rail = 0;

    const blast = () => {
      if (this._won || this._winPending) return;
      const tg = this.nearestEnemy(range);
      if (!tg) return;
      this.sfx?.play('shoot');
      const baseAng = Math.atan2(tg.y - CY, tg.x - CX);
      const n = Math.max(1, st.pellets);
      const life = (range / st.bulletSpeed) * 1000 + 60; // perdigones de corto alcance
      for (let i = 0; i < n; i++) {
        const off = n > 1 ? (i / (n - 1) - 0.5) * st.spread : 0;
        let dmg = st.damage;
        if (st.crit > 0 && Math.random() < st.crit) dmg *= 2;
        const b = this.fireBullet(baseAng + off, st.bulletSpeed, dmg, 0, 'kinetic');
        b.setTint(0xa0f0ff);
        b._dieAt = this.timeSurvived + life;
        if (st.special.shock) b.slowMs = 1500;
        if (st.special.knockback) b.knockback = 22;
      }
      // Fogonazo del cañón.
      const fx = this.getGlow();
      fx.setPosition(CX + Math.cos(baseAng) * 24, CY + Math.sin(baseAng) * 24)
        .setTint(0xa0f0ff)
        .setScale(0.55)
        .setAlpha(0.85)
        .setDepth(6);
      this.tweens.add({
        targets: fx,
        scale: 1.1,
        alpha: 0,
        duration: 200,
        onComplete: () => this.freeGlow(fx)
      });
    };
    blast();
    if (st.volleys > 1) this.time.delayedCall(140, () => this.running && blast());
  }

  tickMissiles(dt) {
    const st = this.ws('missiles');
    const range = this.scaledRange(st.range);
    this.abilityTimers.homing = (this.abilityTimers.homing || 0) + dt;
    if (this.abilityTimers.homing >= st.cooldownMs / this.abilRateMul && this.nearestEnemy(range)) {
      this.abilityTimers.homing = 0;
      const aim0 = this.nearestEnemy(range);
      for (let i = 0; i < st.count; i++) {
        const m = this.acquire(this.missiles, CX, CY, 'tex_missile_p');
        m.setBlendMode(ADD).setDepth(4);
        m.damage = st.damage;
        m.fission = !!st.special.fission;
        m.plasma = !!st.special.plasma;
        m.body.setCircle(5, m.width / 2 - 5, m.height / 2 - 5);
        // Sale APUNTANDO al objetivo (con dispersión). Base = recto.
        const ba = aim0 ? Math.atan2(aim0.y - CY, aim0.x - CX) : Math.random() * Math.PI * 2;
        const ang = ba + (i - (st.count - 1) / 2) * 0.16;
        m.body.setVelocity(Math.cos(ang) * st.speed, Math.sin(ang) * st.speed);
        m.rotation = ang + Math.PI / 2;
        m._dieAt = this.timeSurvived + 4000;
        m._target = null;
      }
    }
    // Rastreo SOLO si hay stacks de "+Rastreo" (st.turn > 0); si no, recto.
    if (st.turn > 0) {
      this.missiles.children.iterate((m) => {
        if (!m || !m.active) return;
        let tgt = m._target;
        if (!tgt || !tgt.active || tgt._untargetable) {
          tgt = this.nearestEnemyToPoint(m.x, m.y);
          m._target = tgt;
        }
        if (!tgt) return;
        const desired = Math.atan2(tgt.y - m.y, tgt.x - m.x);
        const cur = Math.atan2(m.body.velocity.y, m.body.velocity.x);
        const next = Phaser.Math.Angle.RotateTo(cur, desired, st.turn);
        m.body.setVelocity(Math.cos(next) * st.speed, Math.sin(next) * st.speed);
        m.rotation = next + Math.PI / 2;
      });
    }
  }

  tickNova(dt) {
    const st = this.ws('nova');
    this.abilityTimers.nova = (this.abilityTimers.nova || 0) + dt;
    if (this.abilityTimers.nova < st.cooldownMs / this.abilRateMul) return;
    this.abilityTimers.nova = 0;
    for (let w = 0; w < st.waves; w++)
      this.time.delayedCall(w * 220, () => this.running && this.novaBlast(st));
  }

  novaBlast(st) {
    this.sfx?.play('nova');
    const radius = Math.min(MAX_RANGE, st.radius);
    const ring = this.add
      .circle(CX, CY, STATION.radius, COLORS.nova, 0)
      .setStrokeStyle(3, COLORS.nova, 0.95)
      .setBlendMode(ADD)
      .setDepth(6);
    this.tweens.add({ targets: ring, radius, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
    this.enemies.children.iterate((e) => {
      if (!e || !e.active) return;
      if (Math.hypot(e.x - CX, e.y - CY) <= radius) {
        if (st.special.frost) e.slowUntil = this.timeSurvived + 1800;
        if (st.special.poison) {
          e._poisonEnd = this.timeSurvived + 4000;
          e._poisonDps = 5;
        }
        this.damageEnemy(e, st.damage, 'elemental');
      }
    });
    // La onda también barre disparos de jefe que entren en su radio.
    this.bossShots.children.iterate((s) => {
      if (s && s.active && Math.hypot(s.x - CX, s.y - CY) <= radius) this.kill(s);
    });
  }

  tickLaser(dt) {
    const st = this.ws('laser');
    const range = this.scaledRange(st.range);
    this.abilityTimers.laser = (this.abilityTimers.laser || 0) + dt;
    if (this.abilityTimers.laser % (st.onMs + st.offMs) >= st.onMs) return; // OFF
    const tick = st.dps * (dt / 1000);
    const inRange = [];
    this.enemies.children.iterate((e) => {
      if (!e || !e.active || e._untargetable) return;
      const d = Math.hypot(e.x - CX, e.y - CY);
      if (d <= range) inRange.push({ e, d });
    });
    if (!inRange.length) return;
    inRange.sort((a, b) => a.d - b.d);
    const lit = new Set();
    if (st.special.pierceall) {
      // "Perforación total": rayo RECTO que atraviesa a todos en su línea.
      // Sinergia: con "Doble láser" se disparan `st.beams` líneas (cada una
      // apunta a un objetivo distinto); con "+Refracción" cada línea rebota
      // desde su último enemigo perforado.
      const nBeams = Math.max(1, st.beams);
      let used = 0;
      for (let bI = 0; bI < inRange.length && used < nBeams; bI++) {
        const aim = inRange[bI].e;
        if (lit.has(aim)) continue;
        used++;
        const ang = Math.atan2(aim.y - CY, aim.x - CX);
        const ux = Math.cos(ang);
        const uy = Math.sin(ang);
        const ex = CX + ux * range;
        const ey = CY + uy * range;
        let farthest = aim;
        let farT = -1;
        for (const { e } of inRange) {
          if (lit.has(e)) continue;
          const tproj = (e.x - CX) * ux + (e.y - CY) * uy;
          if (tproj < 0 || tproj > range) continue;
          const perp = Math.abs((e.x - CX) * uy - (e.y - CY) * ux);
          if (perp <= 24) {
            this.damageEnemy(e, tick, 'energy');
            lit.add(e);
            if (tproj > farT) {
              farT = tproj;
              farthest = e;
            }
          }
        }
        this.drawLaserSeg(CX, CY, ex, ey, 5); // haz largo y visible
        if (st.refract > 0 && farthest) {
          this.laserChain(farthest.x, farthest.y, tick, lit, st.refract);
        }
      }
      return;
    }
    // Haces independientes a daño pleno (base 1, +1 con especial "Doble").
    // Cada haz REFRACTA: salta a otro cercano con daño decreciente (0.6^k).
    const beams = Math.min(inRange.length, st.beams);
    for (let bI = 0; bI < beams; bI++) {
      const cur = inRange[bI].e;
      if (lit.has(cur)) continue;
      lit.add(cur);
      this.damageEnemy(cur, tick, 'energy');
      this.drawLaser(cur, 3); // estación -> objetivo (haz pleno)
      this.laserChain(cur.x, cur.y, tick, lit, st.refract);
    }
  }

  // Salto más cercano a (x,y) NO golpeado, dentro de JUMP_R y EN PANTALLA
  // (puede exceder el alcance base, pero nunca se va fuera del mapa).
  _laserJumpTarget(x, y, lit) {
    const JUMP_R = 220;
    let best = null;
    let bd = JUMP_R * JUMP_R;
    this.enemies.children.iterate((e) => {
      if (!e || !e.active || e._untargetable || lit.has(e)) return;
      if (e.x < 6 || e.x > GAME_W - 6 || e.y < 6 || e.y > GAME_H - 6) return;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    });
    return best;
  }

  // Cadena de refracción desde (sx,sy): `refract` saltos, daño 0.6^k.
  laserChain(sx, sy, tick, lit, refract) {
    let cx = sx;
    let cy = sy;
    for (let k = 1; k <= refract; k++) {
      const nxt = this._laserJumpTarget(cx, cy, lit);
      if (!nxt) break;
      lit.add(nxt);
      this.damageEnemy(nxt, tick * Math.pow(0.6, k), 'energy');
      this.drawLaserSeg(cx, cy, nxt.x, nxt.y, 2);
      cx = nxt.x;
      cy = nxt.y;
    }
  }

  drawLaserSeg(x1, y1, x2, y2, width) {
    this.laserGfx.lineStyle(width + 4, COLORS.laser, 0.22);
    this.laserGfx.lineBetween(x1, y1, x2, y2);
    this.laserGfx.lineStyle(width, COLORS.laser, 0.9);
    this.laserGfx.lineBetween(x1, y1, x2, y2);
    this.laserGfx.fillStyle(0xffffff, 0.8);
    this.laserGfx.fillCircle(x2, y2, width);
  }

  drawLaser(t, width) {
    this.laserGfx.lineStyle(width + 4, COLORS.laser, 0.25);
    this.laserGfx.lineBetween(CX, CY, t.x, t.y);
    this.laserGfx.lineStyle(width, COLORS.laser, 0.95);
    this.laserGfx.lineBetween(CX, CY, t.x, t.y);
    this.laserGfx.fillStyle(0xffffff, 0.8);
    this.laserGfx.fillCircle(t.x, t.y, width);
  }

  tickShield(dt) {
    const st = this.ws('shield');
    this.shieldMax = st.shieldMax;
    this.shieldResist = st.resist || 0;
    this._thorns = !!st.special.thorns;
    this._absorb = !!st.special.absorb;
    this._shieldBurst = !!st.special.burst;
    if (this.shield < this.shieldMax)
      this.shield = Math.min(this.shieldMax, this.shield + st.regenPerSec * (dt / 1000));
    const ratio = this.shieldMax > 0 ? this.shield / this.shieldMax : 0;
    this.shieldFx.setFillStyle(COLORS.shield, 0.05 + ratio * 0.2);
    this.shieldFx.setStrokeStyle(1.5, COLORS.shield, 0.2 + ratio * 0.6);
    this.shieldFx.setRadius(STATION.radius + 10 + ratio * 5);
  }

  // -- Drone de combate (v0.7, simplificado v1: torreta orbital invulnerable) -
  // Drone errático con vida: embiste enemigos con el cuerpo, pierde HP,
  // explota (AOE) y reaparece. El disparo es un ESPECIAL ('gun').
  tickDrone(dt) {
    const st = this.ws('drone');
    const now = this.timeSurvived;
    if (!this.drones) this.drones = [];
    while (this.drones.length < st.count) {
      const d = this.add
        .image(CX + Phaser.Math.Between(-40, 40), CY, 'tex_orb')
        .setTint(0x9ad0ff)
        .setBlendMode(ADD)
        .setScale(0.95)
        .setDepth(4);
      d.maxHp = st.hp;
      d.hp = st.hp;
      d.dead = false;
      d.phase = Math.random() * Math.PI * 2;
      d._gunT = 0;
      d._dash = false;
      d.ammo = 5;
      this.drones.push(d);
    }
    while (this.drones.length > st.count) this.drones.pop().destroy();
    this.droneGfx.clear();

    // Respawn EN ESCUADRÓN: si hay +1 drone, reaparecen JUNTOS y solo
    // cuando TODOS están destruidos (no de a uno).
    const anyAlive = this.drones.some((d) => !d.dead);
    if (!anyAlive && this.drones.length) {
      if (this._droneRespawnAt == null) this._droneRespawnAt = now + st.respawnMs;
      else if (now >= this._droneRespawnAt) {
        this._droneRespawnAt = null;
        this.drones.forEach((d, i) => {
          d.dead = false;
          d.hp = st.hp;
          d.maxHp = st.hp;
          d._dash = false;
          d.ammo = 5;
          d.setVisible(true).setActive(true);
          const a = (i / this.drones.length) * Math.PI * 2;
          d.x = CX + Math.cos(a) * 50;
          d.y = CY + Math.sin(a) * 50;
        });
      }
    } else if (anyAlive) {
      this._droneRespawnAt = null;
    }

    const M = 14;
    for (const d of this.drones) {
      d.maxHp = st.hp;
      if (d.dead) continue; // muerto: espera a que mueran todos para volver

      const DASH_SP = st.speed * 1.7;
      const OVERSHOOT = 55;
      const RANGE = this.scaledRange(st.range);
      const AMMO = 5;
      const ORBIT_R = 78;

      const idleOrbitStation = () => {
        const R = 72;
        d._orbA = (d._orbA == null ? d.phase : d._orbA) + 1.6 * (dt / 1000);
        const ox = CX + Math.cos(d._orbA) * R;
        const oy = CY + Math.sin(d._orbA) * R;
        const k = Math.min(1, 6 * (dt / 1000));
        d.x += (ox - d.x) * k;
        d.y += (oy - d.y) * k;
        d.rotation = d._orbA + Math.PI / 2;
      };
      const startDash = (tx, ty) => {
        const a = Math.atan2(ty - d.y, tx - d.x);
        d._dx = Math.cos(a);
        d._dy = Math.sin(a);
        d._dashLeft = Math.hypot(tx - d.x, ty - d.y) + OVERSHOOT;
        d._dashHit = new Set();
        d._dash = true;
      };
      const stepDash = () => {
        const step = DASH_SP * (dt / 1000);
        d.x += d._dx * step;
        d.y += d._dy * step;
        d._dashLeft -= step;
        d.rotation = Math.atan2(d._dy, d._dx) + Math.PI / 2;
        this.enemies.children.iterate((e) => {
          if (!e || !e.active || e._untargetable || d._dashHit.has(e)) return;
          if (Math.hypot(e.x - d.x, e.y - d.y) < 26) {
            d._dashHit.add(e);
            this.damageEnemy(e, st.damage, 'kinetic');
            d.hp -= Math.max(2, d.maxHp * 0.15);
            this.spawnDeathFx(d.x, d.y, 0x9ad0ff);
          }
        });
        const out = d.x < M || d.x > GAME_W - M || d.y < M || d.y > GAME_H - M;
        if (d._dashLeft <= 0 || out) {
          d.x = Phaser.Math.Clamp(d.x, M, GAME_W - M);
          d.y = Phaser.Math.Clamp(d.y, M, GAME_H - M);
          d._dash = false;
          d.ammo = AMMO; // recarga tras la pasada
        }
      };

      if (st.special.gun) {
        // Cañón: ORBITA al enemigo disparándole; al quedarse sin balas lo
        // ATRAVIESA (pasada), recarga y busca otro.
        if (d.ammo == null) d.ammo = AMMO;
        if (d._dash) {
          stepDash();
        } else {
          const tg = this.nearestEnemyToPoint(d.x, d.y, RANGE);
          if (!tg) {
            idleOrbitStation();
          } else {
            d._orbA = (d._orbA == null ? d.phase : d._orbA) + 2.4 * (dt / 1000);
            const ox = tg.x + Math.cos(d._orbA) * ORBIT_R;
            const oy = tg.y + Math.sin(d._orbA) * ORBIT_R;
            const k = Math.min(1, 7 * (dt / 1000));
            d.x += (ox - d.x) * k;
            d.y += (oy - d.y) * k;
            d.rotation = Math.atan2(tg.y - d.y, tg.x - d.x) + Math.PI / 2;
            d._gunT += dt;
            if (d.ammo > 0 && d._gunT >= st.cooldownMs / this.abilRateMul) {
              d._gunT = 0;
              d.ammo--;
              const ga = Math.atan2(tg.y - d.y, tg.x - d.x);
              const b = this.fireBullet(
                ga, 700, st.damage, 0, st.special.phase ? 'energy' : 'kinetic'
              );
              b.setPosition(d.x, d.y);
              b.setTint(0x9ad0ff);
            }
            if (d.ammo <= 0) startDash(tg.x, tg.y); // sin balas => pasada
          }
        }
      } else {
        // Sin cañón: pasada pura (atraviesa y sale por el otro lado).
        if (!d._dash) {
          const tg = this.nearestEnemyToPoint(d.x, d.y, RANGE);
          if (tg) startDash(tg.x, tg.y);
          else idleOrbitStation();
        }
        if (d._dash) stepDash();
      }

      // Muere sin HP y reaparece tras respawnMs. La EXPLOSIÓN (AOE) es la
      // mejora especial "Kamikaze"; sin ella, muere sin estallar.
      if (d.hp <= 0) {
        if (st.special.kamikaze) {
          const R = 84;
          // Daño AOE.
          this.enemies.children.iterate((e) => {
            if (e && e.active && Math.hypot(e.x - d.x, e.y - d.y) < R)
              this.damageEnemy(e, st.damage * 4, 'kinetic');
          });
          // Destello brillante grande.
          const g = this.getGlow();
          g.setPosition(d.x, d.y).setTint(0xffe6a0).setScale(0.45).setAlpha(0.95).setDepth(7);
          this.tweens.add({
            targets: g,
            scale: (R * 2.4) / 64,
            alpha: 0,
            duration: 340,
            ease: 'Quad.out',
            onComplete: () => this.freeGlow(g)
          });
          // Anillo expansivo + sacudida.
          const ring = this.add
            .circle(d.x, d.y, 8, 0xff8a3d, 0)
            .setStrokeStyle(3, 0xffd76a, 0.95)
            .setBlendMode(ADD)
            .setDepth(7);
          this.tweens.add({
            targets: ring,
            radius: R,
            alpha: 0,
            duration: 360,
            onComplete: () => ring.destroy()
          });
          this.cameras.main.shake(120, 0.006);
          this.sfx?.play('explosion');
        } else {
          this.spawnDeathFx(d.x, d.y, 0x9ad0ff);
        }
        d.dead = true;
        d.setVisible(false).setActive(false);
        continue;
      }

      // Barra de vida del drone (sobre él).
      const ratio = Phaser.Math.Clamp(d.hp / d.maxHp, 0, 1);
      const bw = 24;
      const bx = d.x - bw / 2;
      const by = d.y - 20;
      this.droneGfx.fillStyle(0x10081f, 0.85);
      this.droneGfx.fillRect(bx - 1, by - 1, bw + 2, 5);
      this.droneGfx.fillStyle(ratio > 0.35 ? 0x9ad0ff : 0xff5d6c, 1);
      this.droneGfx.fillRect(bx, by, bw * ratio, 3);
    }
  }

  // Invoca un agujero en el enemigo más cercano que NO esté ya cubierto por
  // otro agujero activo (para repartirse a objetivos distintos).
  spawnBlackhole() {
    if (!this.up.blackhole.owned) return;
    const st = this.ws('blackhole');
    if (!this._bhs) this._bhs = [];
    if (this._bhs.length >= st.count) return;
    const range = this.scaledRange(MAX_RANGE);
    let best = null;
    let bd = range * range;
    this.enemies.children.iterate((e) => {
      if (!e || !e.active || e._untargetable) return;
      for (const bh of this._bhs)
        if (Math.hypot(e.x - bh.x, e.y - bh.y) < st.radius * 0.8) return; // ya cubierto
      const d = (e.x - CX) ** 2 + (e.y - CY) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    });
    if (best) {
      // Nunca dentro de un radio interno: si el objetivo está muy cerca de la
      // estación, el agujero se ancla en el borde de ese radio (no encima).
      const MIN_INNER = 120;
      let bx = best.x;
      let by = best.y;
      const d = Math.hypot(bx - CX, by - CY);
      if (d < MIN_INNER) {
        const a = Math.atan2(by - CY, bx - CX) || 0;
        bx = CX + Math.cos(a) * MIN_INNER;
        by = CY + Math.sin(a) * MIN_INNER;
      }
      this._bhs.push({ x: bx, y: by, end: this.timeSurvived + st.durationMs });
    }
  }

  // -- Agujero Negro (v0.7): atrae y daña en zona. La común +Agujero permite
  //    tener varios simultáneos.
  tickBlackhole(dt) {
    const st = this.ws('blackhole');
    if (!this.bhGfx) this.bhGfx = this.add.graphics().setDepth(5); // sin ADD
    if (!this._bhs) this._bhs = [];
    this.abilityTimers.bh = (this.abilityTimers.bh || 0) + dt;
    // Cada cooldown invoca los que falten hasta st.count, pero ESCALONADOS en
    // el tiempo y en enemigos DISTINTOS (no todos juntos sobre el mismo).
    const need = st.count - this._bhs.length;
    if (need > 0 && this.abilityTimers.bh >= st.cooldownMs) {
      this.abilityTimers.bh = 0;
      for (let k = 0; k < need; k++) {
        this.time.delayedCall(k * 320, () => this.running && this.spawnBlackhole());
      }
    }
    this.bhGfx.clear();
    const spin = this.timeSurvived / 220;
    for (let i = this._bhs.length - 1; i >= 0; i--) {
      const bh = this._bhs[i];
      if (this.timeSurvived >= bh.end) {
        if (st.special.implosion)
          this.enemies.children.iterate((e) => {
            if (e && e.active && Math.hypot(e.x - bh.x, e.y - bh.y) < st.radius)
              this.damageEnemy(e, st.dps * 1.5, 'gravity');
          });
        this._bhs.splice(i, 1);
        continue;
      }
      // Visual: núcleo oscuro + disco de acreción + borde tenue de la zona.
      this.bhGfx.lineStyle(1, 0x5a3f8c, 0.18);
      this.bhGfx.strokeCircle(bh.x, bh.y, st.radius);
      this.bhGfx.fillStyle(0x07030f, 0.95);
      this.bhGfx.fillCircle(bh.x, bh.y, 17);
      this.bhGfx.lineStyle(2.5, 0x7d5cff, 0.85);
      this.bhGfx.strokeCircle(bh.x, bh.y, 17 + Math.sin(spin) * 1.5);
      this.bhGfx.lineStyle(1, 0x9a7bff, 0.4);
      this.bhGfx.strokeCircle(bh.x, bh.y, 11);
      this.enemies.children.iterate((e) => {
        if (!e || !e.active) return;
        const dx = bh.x - e.x;
        const dy = bh.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < st.radius) {
          // Los jefes apenas se dejan absorber (no quedan pegados al centro).
          const pm = e.flags && e.flags.boss ? 0.12 : 1;
          e.body.setVelocity((dx / d) * st.pull * pm, (dy / d) * st.pull * pm);
          if (st.special.distort) e._distortUntil = this.timeSurvived + 200;
          this.damageEnemy(e, st.dps * (dt / 1000), 'gravity');
        }
      });
    }
  }

  rebuildOrbs() {
    this.orbs.forEach((o) => o.destroy());
    this.orbs = [];
    if (!this.up.orbital.owned) return;
    const st = this.ws('orbital');
    for (let i = 0; i < st.orbs; i++) {
      const o = this.orbsGroup.create(CX, CY, 'tex_orb');
      o.setBlendMode(ADD).setDepth(4);
      o.body.setCircle(7, o.width / 2 - 7, o.height / 2 - 7);
      o.body.setAllowGravity(false);
      o.idx = i;
      this.orbs.push(o);
    }
  }

  updateOrbs(dt) {
    if (!this.up.orbital.owned) return;
    const st = this.ws('orbital');
    if (this.orbs.length !== st.orbs) this.rebuildOrbs();
    this._orbBaseAng = (this._orbBaseAng || 0) + st.speed * (dt / 1000);
    const n = this.orbs.length;
    this.orbs.forEach((o, i) => {
      const a = this._orbBaseAng + (i / n) * Math.PI * 2;
      o.x = CX + Math.cos(a) * st.radius;
      o.y = CY + Math.sin(a) * st.radius;
    });
  }

  // ===========================================================================
  //  COLISIONES
  // ===========================================================================
  onBulletHit(bullet, enemy) {
    if (!bullet.active || !enemy.active || bullet._hit.has(enemy)) return;
    bullet._hit.add(enemy);
    this.damageEnemy(enemy, bullet.damage, bullet.dmgType);
    if (bullet.slowMs) enemy.slowUntil = this.timeSurvived + bullet.slowMs; // sobrecarga
    if (bullet.knockback) {
      // Empuje hacia AFUERA (lejos de la estación).
      const kx = enemy.x - CX;
      const ky = enemy.y - CY;
      const kd = Math.hypot(kx, ky) || 1;
      enemy.x += (kx / kd) * bullet.knockback;
      enemy.y += (ky / kd) * bullet.knockback;
    }
    if (bullet.explode) this.plasmaField(bullet.x, bullet.y, bullet.damage, 'kinetic', 40);
    if (bullet.pierce > 0) {
      bullet.pierce--;
      return;
    }
    // ESPECIAL cañón "Rebote": redirige a otro enemigo cercano (hasta N).
    if (bullet.bounce > 0) {
      let best = null;
      let bd = 240 * 240;
      this.enemies.children.iterate((o) => {
        if (!o || !o.active || o === enemy || o._untargetable) return;
        const dd = (o.x - bullet.x) ** 2 + (o.y - bullet.y) ** 2;
        if (dd < bd) {
          bd = dd;
          best = o;
        }
      });
      if (best) {
        bullet.bounce--;
        bullet._hit.clear();
        bullet._hit.add(enemy);
        const a = Math.atan2(best.y - bullet.y, best.x - bullet.x);
        const spd = bullet._spd || 420;
        bullet.body.setVelocity(Math.cos(a) * spd, Math.sin(a) * spd);
        return;
      }
    }
    this.kill(bullet);
  }

  onMissileHit(missile, enemy) {
    if (!missile.active || !enemy.active) return;
    this.sfx?.play('hit');
    this.damageEnemy(enemy, missile.damage, 'explosive');
    if (missile.fission) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const frag = this.fireBullet(a, 260, missile.damage * 0.5, 0, 'explosive');
        frag.setPosition(missile.x, missile.y);
      }
    }
    if (missile.plasma) this.plasmaZone(missile.x, missile.y, missile.damage, 64);
    this.kill(missile);
  }

  plasmaField(x, y, dmg, type = 'explosive', R = 56) {
    const fx = this.getGlow();
    fx
      .setPosition(x, y)
      .setTint(type === 'kinetic' ? 0xfff07a : COLORS.missile)
      .setAlpha(0.5)
      .setScale(0.2)
      .setDepth(5);
    this.tweens.add({
      targets: fx,
      scale: (R * 2) / 64,
      alpha: 0,
      duration: 480,
      onComplete: () => this.freeGlow(fx)
    });
    this.enemies.children.iterate((e) => {
      if (e && e.active && Math.hypot(e.x - x, e.y - y) < R) this.damageEnemy(e, dmg * 0.7, type);
    });
  }

  // Campo de plasma del misil (ESPECIAL): zona que PERMANECE ~1.4s y daña por
  // tiempo (no un fogonazo). Disco translúcido con latido suave + anillo.
  plasmaZone(x, y, dmg, R) {
    const sc = (R * 2) / 64;
    const disc = this.getGlow();
    disc
      .setPosition(x, y)
      .setTint(COLORS.missile)
      .setBlendMode(ADD)
      .setDepth(5)
      .setAlpha(0.34)
      .setScale(sc * 0.92);
    // Latido lento (queda "vivo" como zona, no explota).
    this.tweens.add({
      targets: disc,
      scale: sc * 1.05,
      duration: 380,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.inOut'
    });
    const ring = this.add
      .circle(x, y, R, COLORS.missile, 0)
      .setStrokeStyle(2, COLORS.missile, 0.5)
      .setBlendMode(ADD)
      .setDepth(5);
    // Daño por tiempo: 6 ticks suaves a lo largo de ~1.4s.
    let ticks = 6;
    const tick = () => {
      this.enemies.children.iterate((e) => {
        if (e && e.active && Math.hypot(e.x - x, e.y - y) < R)
          this.damageEnemy(e, dmg * 0.32, 'elemental');
      });
      if (--ticks > 0) {
        this.time.delayedCall(230, tick);
      } else {
        this.tweens.add({
          targets: [disc, ring],
          alpha: 0,
          duration: 280,
          onComplete: () => {
            ring.destroy();
            this.freeGlow(disc);
          }
        });
      }
    };
    tick();
  }

  onOrbHit(orb, enemy) {
    if (!enemy.active || this.timeSurvived < enemy._orbCdUntil) return;
    enemy._orbCdUntil = this.timeSurvived + 230;
    const st = this.ws('orbital');
    this.damageEnemy(enemy, st.damage, 'kinetic');
    if (st.special.pulse) {
      const pr = 80;
      const ring = this.add.circle(orb.x, orb.y, 4, COLORS.orb, 0.5).setBlendMode(ADD).setDepth(6);
      this.tweens.add({
        targets: ring,
        radius: pr,
        alpha: 0,
        duration: 260,
        onComplete: () => ring.destroy()
      });
      this.enemies.children.iterate((other) => {
        if (
          other &&
          other.active &&
          other !== enemy &&
          Math.hypot(other.x - orb.x, other.y - orb.y) < pr
        )
          this.damageEnemy(other, st.damage * 0.6, 'kinetic');
      });
    }
  }

  onEnemyReachStation(station, enemy) {
    if (!enemy.active) return;
    this.applyStationDamage(enemy.contactDmg);
    // Aunque choque contra la base, el objeto destruido también da XP/oro.
    this.addXp(enemy.xpValue || 0);
    this.gold = (this.gold || 0) + (enemy.goldValue || 0);
    this.spawnDeathFx(enemy.x, enemy.y, 0xff8a8a);
    this.kill(enemy);
    this.cameras.main.shake(120, 0.006);
  }

  // ===========================================================================
  //  DAÑO / MUERTE / XP
  // ===========================================================================
  damageEnemy(enemy, amount, type = 'kinetic') {
    if (!enemy.active || enemy._untargetable) return; // sigiloso en fase = inmune
    // Pasiva de nave "+Daño": GLOBAL (todas las armas), aplicada aquí.
    let dmg = amount * (this.shipDmgMul || 1) * (enemy.dmgMul || 1);
    dmg *= resistMul(enemy.enemyType, type); // resistencia/debilidad por tipo
    if (enemy._distortUntil && this.timeSurvived < enemy._distortUntil) dmg *= 1.5; // agujero negro
    if (enemy._shieldedUntil && this.timeSurvived < enemy._shieldedUntil)
      dmg *= enemy._shieldMul || 1;
    enemy.hp -= dmg;
    // Arcade Neon: damage numbers flotantes en cada impacto.
    this.spawnDamageNumber(enemy.x, enemy.y, dmg, type, false);
    // Hit-flash: enemy turns white for 60ms
    if (enemy.active && enemy.hp > 0) {
      enemy.setTintFill(0xffffff);
      this.time.delayedCall(60, () => enemy.active && enemy.clearTint());
    }
    if (enemy.hp <= 0) {
      const wasBoss = enemy.flags && enemy.flags.boss;
      this.spawnDeathFx(enemy.x, enemy.y, wasBoss ? 0xff4f86 : COLORS.xp);
      this.sfx?.play('explosion');
      this.kills++;
      // Cuota: solo enemigos "normales" (ni jefe ni invocados por él).
      if (!wasBoss && !enemy._noQuota) this.quotaKills++;
      this.registerKillstreak();
      this.addXp(enemy.xpValue);
      this.gold = (this.gold || 0) + (enemy.goldValue || 0);
      // Shake graduado: kill peque\u00f1o, ning\u00fan shake; kill grande, leve.
      if (enemy.maxHp > 80 && !wasBoss) this.cameras.main.shake(90, 0.004);
      this.kill(enemy);
      if (wasBoss) {
        // Boss kill: shake fuerte + flash
        this.cameras.main.shake(450, 0.014);
        this.cameras.main.flash(180, 255, 43, 214);
        // Modo dev: NO persiste progreso ni dispara win (es solo prueba).
        if (!this.dev) {
          // Persistir conteo de jefes -> desbloquea Drone(1)/Riel(2)/Agujero(3).
          this.bossCount++;
          const before = parseInt(localStorage.getItem('os_bosses') || '0', 10) || 0;
          const after = Math.max(this.bossCount, before);
          localStorage.setItem('os_bosses', String(after));
          if (before < 1 && after >= 1) this.announceUnlock('drone');
          if (before < 2 && after >= 2) this.announceUnlock('railgun');
          if (before < 3 && after >= 3) this.announceUnlock('blackhole');
          // NO termina el nivel solo: el chequeo combinado vive en update().
          this._bossKilled = true;
        }
      }
    }
  }

  // ==========================================================================
  //  Damage numbers (Arcade Neon)
  //  Texto flotante que sube del enemigo al recibir da\u00f1o. Crit (> 50 dmg)
  //  con tama\u00f1o 1.5x y color del arma.
  // ==========================================================================
  spawnDamageNumber(x, y, amount, type, crit) {
    const n = Math.max(1, Math.round(amount));
    const big = n >= 50;
    const colorMap = {
      kinetic: '#ffffff',
      energy: '#00f0ff',
      explosive: '#ff8a3d',
      laser: '#ff2bd6'
    };
    const color = colorMap[type] || '#ffffff';
    const txt = this.getText();
    txt
      .setText(String(n))
      .setFontSize(big ? 28 : 20)
      .setColor(color)
      .setFontStyle('bold')
      .setStroke('#10081f', 4)
      .setOrigin(0.5, 1)
      .setPosition(x + Phaser.Math.Between(-8, 8), y - 8)
      .setDepth(20);
    this.tweens.add({
      targets: txt,
      y: y - (big ? 56 : 38),
      alpha: 0,
      scale: big ? 1.0 : 0.9,
      duration: big ? 720 : 540,
      ease: 'Cubic.out',
      onComplete: () => this.freeText(txt)
    });
  }

  // ==========================================================================
  //  Killstreak: cuenta kills en los \u00faltimos 1500ms.
  //  Si supera 5, muestra texto chunky en pantalla.
  // ==========================================================================
  registerKillstreak() {
    const now = this.timeSurvived;
    if (!this._streakHits) this._streakHits = [];
    this._streakHits.push(now);
    // descarta los > 1500ms viejos
    while (this._streakHits.length && now - this._streakHits[0] > 1500) {
      this._streakHits.shift();
    }
    const streak = this._streakHits.length;
    if (streak >= 5 && (!this._lastStreakShown || streak > this._lastStreakShown)) {
      this._lastStreakShown = streak;
      this.showStreak(streak);
    }
    if (streak < 5) this._lastStreakShown = 0;
  }

  showStreak(n) {
    if (this._streakTxt) this._streakTxt.destroy();
    const tier = n >= 15 ? 'INSANE!' : n >= 10 ? 'RAMPAGE!' : 'STREAK';
    const color = n >= 15 ? '#ff2bd6' : n >= 10 ? '#ffe640' : '#00f0ff';
    const txt = this.add
      .text(GAME_W / 2, 120, `\u00d7${n}  ${tier}`, {
        fontFamily: '"Pixelify Sans", monospace',
        fontSize: '26px',
        color,
        fontStyle: 'bold',
        stroke: '#10081f',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setScale(0.4)
      .setAlpha(0);
    this._streakTxt = txt;
    this.tweens.add({
      targets: txt,
      scale: 1.1,
      alpha: 1,
      duration: 200,
      ease: 'Back.out',
      onComplete: () => {
        this.tweens.add({
          targets: txt,
          scale: 1,
          duration: 120,
          ease: 'Sine.out'
        });
        this.time.delayedCall(900, () => {
          this.tweens.add({
            targets: txt,
            alpha: 0,
            y: 100,
            duration: 320,
            onComplete: () => txt.destroy()
          });
        });
      }
    });
  }

  applyStationDamage(amount) {
    if (this.dev) return; // modo DEV: estación invulnerable
    // Nivel ya ganado (o en su "respiro" final): nada de daño/derrota.
    if (this._won || this._winPending) return;
    // ESPECIAL escudo "Absorción": anula el golpe letal + 1s de invulnerable
    // (un uso por nivel).
    if (this._absorb && !this._absorbUsed && amount >= this.hp + this.shield) {
      this._absorbUsed = true;
      this._invulUntil = this.timeSurvived + 1000;
      this.shield = this.shieldMax || this.shield;
      this.cameras.main.flash(160, 73, 242, 194);
      return;
    }
    if (this._invulUntil && this.timeSurvived < this._invulUntil) return;
    const raw = amount;
    if (this.shieldResist) amount *= 1 - this.shieldResist; // común "+Resistencia"
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
      if (this._thorns) this.shieldThorns(raw * 0.25); // ESPECIAL "Espinas"
      // ESPECIAL "Detonación": al romperse el escudo, onda alrededor.
      if (this.shield <= 0 && this._shieldBurst) {
        this._shieldBurst = false; // una vez por recarga (tickShield lo repone)
        this.sfx?.play('shieldbreak');
        const R = 150;
        const ring = this.add
          .circle(CX, CY, STATION.radius, COLORS.shield, 0.35)
          .setBlendMode(ADD)
          .setDepth(6);
        this.tweens.add({
          targets: ring,
          radius: R,
          alpha: 0,
          duration: 360,
          onComplete: () => ring.destroy()
        });
        this.enemies.children.iterate((e) => {
          if (e && e.active && Math.hypot(e.x - CX, e.y - CY) < R)
            this.damageEnemy(e, 60, 'energy');
        });
      }
    }
    if (amount <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.sfx?.play('damage');
    if (this.hp <= 0) this.gameOver();
  }

  shieldThorns(td) {
    const R = 130;
    const ring = this.add
      .circle(CX, CY, STATION.radius, COLORS.shield, 0.3)
      .setBlendMode(ADD)
      .setDepth(6);
    this.tweens.add({
      targets: ring,
      radius: R,
      alpha: 0,
      duration: 220,
      onComplete: () => ring.destroy()
    });
    this.enemies.children.iterate((e) => {
      if (e && e.active && Math.hypot(e.x - CX, e.y - CY) < R) this.damageEnemy(e, td, 'energy');
    });
  }

  spawnDeathFx(x, y, color) {
    const g = this.getGlow();
    g.setPosition(x, y).setTint(color).setScale(0.4).setAlpha(1).setDepth(6);
    this.tweens.add({
      targets: g,
      scale: 1.1,
      alpha: 0,
      duration: 280,
      ease: 'Quad.out',
      onComplete: () => this.freeGlow(g)
    });
  }

  addXp(amount) {
    // Modo DEV: sin XP automática; se sube de nivel con el botón ⬆ NIVEL.
    if (this.dev) return;
    // Partida terminada o en su "respiro" final: no más XP ni subir de nivel
    // (no tiene sentido draftear con el nivel ya ganado/perdido).
    if (this._won || this._winPending) return;
    this.xp += amount;
    let need = xpToNext(this.level);
    while (this.xp >= need) {
      this.xp -= need;
      this.level++;
      this.pendingLevelUps++;
      need = xpToNext(this.level);
    }
    if (this.pendingLevelUps > 0 && !this.drafting) {
      this.sfx?.play('levelup');
      this.openDraft();
    }
  }

  // ===========================================================================
  //  DRAFT
  // ===========================================================================
  _mkChoice(p) {
    const m = cardMeta(p.wid, p.kind, p.id);
    const stacks = p.kind === 'common' ? (this.up[p.wid].commons[p.id] || 0) : 0;
    const max = p.kind === 'common' ? WEAPONS[p.wid].commons.find((c) => c.id === p.id).max : 0;
    const badge =
      p.kind === 'special'
        ? t('ui.tag_special')
        : p.kind === 'unlock'
          ? t('ui.tag_new')
          : null;
    return {
      id: `${p.wid}:${p.kind}:${p.id}`,
      name: m.weapon,
      color: m.color,
      icon: p.wid,
      badge,
      levelLabel:
        p.kind === 'common'
          ? `${m.title} ${stacks + 1}/${max}`
          : p.kind === 'special'
            ? m.title
            : '',
      level: p.kind === 'common' ? stacks + 1 : 0,
      pips: false,
      desc: m.desc
    };
  }

  _repairChoice() {
    return {
      id: '__repair',
      name: t('ui.repair_name'),
      color: 0x9affc4,
      icon: null,
      badge: null,
      levelLabel: t('ui.tag_support'),
      level: 0,
      pips: false,
      desc: t('ui.repair_desc', { n: Math.round(this.maxHp * 0.25) })
    };
  }

  // Modo dev: simula las REGLAS reales pero mostrando TODAS las opciones:
  //  · armas que NO tengo  -> carta de conseguirla (todas las nuevas).
  //  · armas que SÍ tengo  -> todas sus comunes (mejoras base) disponibles.
  //  · si toca hito especial -> sus especiales pendientes (y no comunes).
  _devChoices() {
    const choices = [];
    for (const wid of WEAPON_IDS) {
      if (!isUnlocked(wid, this.bossCount)) continue;
      const W = WEAPONS[wid];
      const s = this.up[wid];
      if (!s.owned) {
        choices.push(this._mkChoice({ wid, kind: 'unlock', id: 'base' }));
        continue;
      }
      const open = specialSlotsOpen(this.up, wid);
      const pendingSp = W.specials.filter((sp) => !s.specials.includes(sp.id));
      if (s.specials.length < open && pendingSp.length) {
        for (const sp of pendingSp)
          choices.push(this._mkChoice({ wid, kind: 'special', id: sp.id }));
      } else if (s.totalCommons < CAP_COMMON) {
        for (const c of W.commons)
          if ((s.commons[c.id] || 0) < c.max)
            choices.push(this._mkChoice({ wid, kind: 'common', id: c.id }));
      }
    }
    choices.push(this._repairChoice());
    return choices;
  }

  openDraft() {
    if (this._won || this._winPending) return; // partida terminada: sin draft
    this.drafting = true;
    this.running = false;
    this.physics.world.pause();

    // Modo DEV: el subir de nivel muestra el selector simulado completo
    // (mismas reglas, pero elegís cualquiera). Solo afecta al modo dev.
    if (this.dev) {
      this.events.emit('levelup', { choices: this._devChoices(), level: this.level, dev: true });
      return;
    }

    // Pool atómico (motor v0.7). Cada candidato = una carta apilable.
    let pool = draftPool(this.up, { bossCount: this.bossCount });
    const occupied = WEAPON_IDS.filter((w) => occupiesSlot(w, this.up)).length;
    if (occupied >= ABILITY_SLOTS) {
      pool = pool.filter((c) => occupiesSlot(c.wid, this.up));
    }

    // Selección ponderada de hasta 3 cartas distintas.
    const picks = [];
    const bag = pool.slice();
    while (picks.length < 3 && bag.length) {
      let total = 0;
      for (const c of bag) total += c.weight;
      let r = Math.random() * total;
      let idx = 0;
      for (let i = 0; i < bag.length; i++) {
        r -= bag[i].weight;
        if (r <= 0) {
          idx = i;
          break;
        }
      }
      picks.push(bag.splice(idx, 1)[0]);
    }
    const choices = picks.map((p) => this._mkChoice(p));
    while (choices.length < 3) choices.push(this._repairChoice());
    this.events.emit('levelup', { choices, level: this.level });
  }

  // Botón DEV: abrir el selector completo CUANDO QUIERA (sin gastar nivel).
  openDevPicker(levelUp) {
    if (!this.dev || !this.running || this.drafting || this._won || this._winPending) return;
    if (levelUp) {
      this.level++;
      this.sfx?.play('levelup');
    }
    this._devPicker = true;
    this.drafting = true;
    this.running = false;
    this.physics.world.pause();
    this.events.emit('levelup', { choices: this._devChoices(), level: this.level, dev: true });
  }

  _spawnBossId(id, step) {
    const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const e = this.makeEnemy(id, CX + Math.cos(ang) * SPAWN_RING, CY + Math.sin(ang) * SPAWN_RING, step);
    e.setScale(1.15);
    this.sfx?.play('shieldbreak');
    this.cameras.main.shake(300, 0.008);
  }

  // Botón DEV: invoca un jefe (cicla los 3 para probarlos).
  devSpawnBoss() {
    if (!this.dev || !this.running) return;
    const ids = ['boss_orbital', 'boss_siege', 'boss_warp'];
    const i = (this._devBossI || 0) % ids.length;
    this._devBossI = i + 1;
    this._spawnBossId(ids[i], this.difficultyStep());
  }

  // Arcade infinito: jefe periódico (cicla los 3).
  spawnEndlessBoss(step) {
    const ids = ['boss_orbital', 'boss_siege', 'boss_warp'];
    const i = (this._endlessBossI || 0) % ids.length;
    this._endlessBossI = i + 1;
    this._spawnBossId(ids[i], step);
  }

  _applyCard(id) {
    if (id === '__repair') {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25);
      return;
    }
    const [wid, kind, cid] = id.split(':'); // "wid:kind:cardId"
    applyUpg(this.up, { wid, kind, id: cid });
    if (wid === 'orbital') this.rebuildOrbs();
    const w = this.weaponRanges().find((x) => x.id === wid);
    if (w) this.pingRange(w.range, w.color);
  }

  _resumeFromDraft() {
    this.drafting = false;
    this.running = true;
    this.physics.world.resume();
    this.events.emit('draftclosed');
  }

  chooseDraft(id) {
    this._applyCard(id);
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
    if (this.pendingLevelUps > 0) this.openDraft();
    else this._resumeFromDraft();
  }

  // Selección desde el grid dev (level-up dev o botón a demanda).
  devChoose(id) {
    this._applyCard(id);
    if (this._devPicker) {
      this._devPicker = false;
      this._resumeFromDraft(); // a demanda: no toca pendingLevelUps
      return;
    }
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
    if (this.pendingLevelUps > 0) this.openDraft();
    else this._resumeFromDraft();
  }

  // ===========================================================================
  //  UTILIDADES / FIN
  // ===========================================================================
  nearestEnemy(maxRange = Infinity) {
    return this.nearestEnemyToPoint(CX, CY, maxRange);
  }

  // Enemigo más cercano a un punto (lo usan los misiles: cada uno persigue
  // al que tiene MÁS cerca, no al más cercano a la estación).
  nearestEnemyToPoint(px, py, maxRange = Infinity) {
    let best = null;
    let bd = maxRange * maxRange;
    this.enemies.children.iterate((e) => {
      if (!e || !e.active || e._untargetable) return;
      const d = (e.x - px) ** 2 + (e.y - py) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    });
    return best;
  }

  bankGold() {
    if (this._goldBanked) return;
    this._goldBanked = true;
    Economy.addGold(this.gold);
  }

  gameOver() {
    if (!this.running && !this.drafting) return;
    this.running = false;
    this.drafting = false;
    this.physics.world.pause();
    this.cameras.main.shake(260, 0.012);
    this.sfx?.play('gameover');
    this.bankGold();
    this.events.emit('gameover', {
      time: this.timeSurvived,
      kills: this.kills,
      level: this.level,
      gold: this.gold
    });
  }

  // "Un poco de aire": al caer el último enemigo el juego sigue ~1s (se ven
  // las explosiones, la cámara respira) y RECIÉN ahí aparece la victoria.
  triggerWin() {
    if (this._won || this._winPending) return;
    this._winPending = true;
    this.sfx?.play('explosion'); // último estallido, sin jingle todavía
    this.time.delayedCall(1100, () => {
      if (!this._won && this.scene.isActive()) this.levelClear();
    });
  }

  levelClear() {
    this._won = true;
    this.running = false;
    this.drafting = false;
    this.physics.world.pause();
    this.sfx?.play('win');
    Progress.complete(this.levelNum);

    // Estrellas por integridad del casco al terminar.
    const ratio = this.hp / this.maxHp;
    const stars = ratio >= 0.85 ? 3 : ratio >= 0.5 ? 2 : 1;
    const sr = Progress.claimStars(this.levelNum, stars);
    this.gold += sr.gold; // bonus de estrellas nuevas (una vez c/u)

    this.bankGold();
    this.events.emit('levelclear', {
      level: this.levelNum,
      name: this.levelName,
      time: this.timeSurvived,
      kills: this.kills,
      gold: this.gold,
      stars,
      starBest: sr.best,
      starGold: sr.gold,
      next: Progress.nextLevel(this.levelNum)
    });
  }

  restartGame() {
    this.scene.restart(this.levelData);
  }

  pauseGame() {
    if (!this.running) return;
    this.running = false;
    this.paused = true;
    this.physics.world.pause();
  }

  resumeGame() {
    if (!this.paused) return;
    this.paused = false;
    this.running = true;
    this.physics.world.resume();
  }

  getHud() {
    return {
      hp: this.hp,
      maxHp: this.maxHp,
      shield: this.shield,
      shieldMax: this.shieldMax,
      level: this.level,
      xp: this.xp,
      xpToNext: xpToNext(this.level),
      time: this.timeSurvived,
      kills: this.kills,
      gold: this.gold,
      slots: ABILITY_SLOTS,
      weapons: WEAPON_IDS.filter((w) => occupiesSlot(w, this.up)).map((w) => ({
        id: w,
        name: wname(w),
        color: WEAPONS[w].color,
        commons: this.up[w].totalCommons,
        specials: this.up[w].specials.length
      })),
      mode: this.mode,
      levelNum: this.levelNum,
      targetKills: this.targetKills,
      quota: this.quotaKills,
      bossId: this.bossId,
      bossKilled: this._bossKilled,
      bossAlive: !!this.bossId && this._bossSpawned && !this._bossKilled,
      diff: this.difficultyStep() + 1
    };
  }
}
