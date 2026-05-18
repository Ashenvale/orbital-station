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
import { resistMul, resistSummary } from '../data/enemyInfo.js';
import { t } from '../i18n.js';
import { ABILITY_BY_ID, ABILITIES, MAX_LEVEL, levelLabel } from '../data/abilities.js';
import { ensureTextures, STATION_TEX_PAD } from '../gfxTextures.js';
import { createBackdrop } from '../backdrop.js';
import { Sfx } from '../sfx.js';
import { LEVEL_BY_N } from '../data/levels.js';
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
const ENDLESS_TIERS = [
  { from: 0, ids: ['debris', 'asteroid'] },
  { from: 1, ids: ['missile', 'probe'] },
  { from: 2, ids: ['ship'] },
  { from: 3, ids: ['interceptor', 'swarm'] },
  { from: 4, ids: ['armored', 'bomb'] },
  { from: 5, ids: ['berserker', 'stealth'] },
  { from: 6, ids: ['healer', 'shielder'] },
  { from: 7, ids: ['carrier'] }
];

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    ensureTextures(this);
    this.sfx = Sfx;

    // -- Modo: campaña (level) o arcade infinito (endless) -------------------
    const data = this.scene.settings.data || {};
    this.levelData = data;
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
      // Arcade: escala LENTO. Cada escalón (22 s) sube vida/cadencia y
      // desbloquea un tipo de enemigo más fuerte (empieza con piedras).
      this.stepSeconds = 22;
      // Arcade: el pool se calcula por escalón (desbloqueo progresivo).
      this.enemyPool = null;
      this.bossId = null;
    }
    this.paused = false;
    this._won = false;
    this._bossSpawned = false;
    this._goldBanked = false;
    this._seenTypes = new Set(); // tipos ya presentados (card) en esta partida

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
    this.gold = 0;
    this.timeSurvived = 0;
    this.pendingLevelUps = 0;
    this.drafting = false;
    this.abilities = {};

    this.backdrop = createBackdrop(this, { nebula: true });
    this.buildStation();

    // -- Grupos de fisicas ---------------------------------------------------
    this.enemies = this.physics.add.group();
    this.bullets = this.physics.add.group();
    this.missiles = this.physics.add.group();
    this.orbsGroup = this.physics.add.group();
    this.orbs = [];

    this.laserGfx = this.add.graphics().setDepth(6).setBlendMode(ADD);
    this.enemyBars = this.add.graphics().setDepth(7); // barras de vida sobre enemigos

    // -- Colisiones ----------------------------------------------------------
    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHit, null, this);
    this.physics.add.overlap(this.missiles, this.enemies, this.onMissileHit, null, this);
    this.physics.add.overlap(this.orbsGroup, this.enemies, this.onOrbHit, null, this);
    this.physics.add.overlap(this.station, this.enemies, this.onEnemyReachStation, null, this);

    this.baseWeaponT = 0;
    // Pre-cargado: el primer enemigo aparece en el primer frame (sin espera).
    this.spawnT = 1e6;
    this._firstSpawn = true;
    this.abilityTimers = {};

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    this.events.emit('reset');
  }

  buildStation() {
    // Halo pulsante
    this.stationHalo = this.add
      .image(CX, CY, 'tex_glow')
      .setTint(COLORS.station)
      .setBlendMode(ADD)
      .setScale(2.6)
      .setAlpha(0.45)
      .setDepth(2);
    this.tweens.add({
      targets: this.stationHalo,
      scale: 3.1,
      alpha: 0.65,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    // Anillo de modulos con marcas (gira)
    this.moduleRing = this.add.graphics().setDepth(3);
    this.moduleRing.lineStyle(1.5, COLORS.station, 0.5);
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
    const col = ratio > 0.5 ? 0x49f2c2 : ratio > 0.25 ? 0xffc14f : 0xff5d6c;
    const segs = 44;
    const full = (Math.PI * 2) / segs;
    const gap = full * 0.28;
    const lit = Math.round(segs * ratio);
    const top = -Math.PI / 2;

    for (let i = 0; i < segs; i++) {
      const a0 = top + i * full + gap / 2;
      const a1 = top + (i + 1) * full - gap / 2;
      const on = i < lit;
      g.lineStyle(on ? 3 : 2, on ? col : 0x33485c, on ? 0.95 : 0.22);
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

    if (this.mode === 'level' && !this._won && this.kills >= this.targetKills) {
      this.levelClear();
      return;
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
      this.kills >= Math.floor(this.targetKills * 0.6)
    ) {
      this._bossSpawned = true;
      this.sfx?.play('shieldbreak');
      this.spawnBoss(step);
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
      if (!e || !e.active || e.hp >= e.maxHp) return;
      const ratio = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
      const w = 26;
      const x = e.x - w / 2;
      const y = e.y - (e.displayHeight / 2) - 9;
      const col = ratio > 0.5 ? 0x7affc4 : ratio > 0.25 ? 0xffc14f : 0xff5d6c;
      g.fillStyle(0x02030a, 0.7);
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

  // Multiplicador de daño permanente comprado con oro.
  pmul(id) {
    return Economy.powerMul(id);
  }

  // Los proyectiles no "vuelan al infinito": se eliminan al salir de pantalla.
  cullProjectiles() {
    const m = 24;
    const cull = (grp) =>
      grp.children.iterate((p) => {
        if (!p || !p.active) return;
        if (p.x < -m || p.x > GAME_W + m || p.y < -m || p.y > GAME_H + m) p.destroy();
      });
    cull(this.bullets);
    cull(this.missiles);
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

  // Armas (no base) que tienen un rango/alcance que mostrar en pantalla.
  weaponRanges() {
    const out = [];
    const A = this.abilities;
    const push = (id, range) =>
      out.push({ id, range, color: ABILITY_BY_ID[id].color });
    if (A.dual_cannon)
      push('dual_cannon', this.scaledRange(ABILITY_BY_ID.dual_cannon.levels[A.dual_cannon - 1].range));
    if (A.homing_missiles)
      push(
        'homing_missiles',
        this.scaledRange(ABILITY_BY_ID.homing_missiles.levels[A.homing_missiles - 1].range)
      );
    if (A.laser_beam)
      push('laser_beam', this.scaledRange(ABILITY_BY_ID.laser_beam.levels[A.laser_beam - 1].range));
    if (A.nova_pulse)
      push('nova_pulse', Math.min(MAX_RANGE, ABILITY_BY_ID.nova_pulse.levels[A.nova_pulse - 1].radius));
    if (A.orbital_ring)
      push('orbital_ring', ABILITY_BY_ID.orbital_ring.levels[A.orbital_ring - 1].radius);
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
    const e = this.enemies.create(x, y, `tex_e_${type}`);
    e.setBlendMode(ADD);
    e.enemyType = type;
    e.flags = def.flags || {};
    e.move = def.move;
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
        for (let i = 0; i < fl.droneCount; i++)
          this.makeEnemy(
            fl.carrier,
            e.x + Phaser.Math.Between(-26, 26),
            e.y + Phaser.Math.Between(-26, 26),
            this.difficultyStep()
          );
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
  updateBaseWeapon(dt) {
    this.baseWeaponT += dt;
    const bw = STATION.baseWeapon;
    const cooldown = bw.cooldownMs / this.shipRateMul;
    if (this.baseWeaponT < cooldown) return;

    const target = this.nearestEnemy(this.baseRange());
    if (!target) return;
    this.baseWeaponT = 0;

    const damage = bw.damage * this.shipDmgMul; // pasiva = solo arma común
    const ang = Math.atan2(target.y - CY, target.x - CX);
    this.fireBullet(ang, bw.projectileSpeed, damage, 0);
    this.sfx?.play('shoot');
  }

  // Cañón Múltiple: arma EXTRA independiente (su propio bucle/alcance/daño).
  tickDualCannon(dt, s) {
    this.abilityTimers.dual = (this.abilityTimers.dual || 0) + dt;
    if (this.abilityTimers.dual < s.cooldownMs / this.abilRateMul) return;
    const range = this.scaledRange(s.range);
    const target = this.nearestEnemy(range);
    if (!target) return;
    this.abilityTimers.dual = 0;

    const damage = s.damage * this.pmul('dual_cannon');
    const baseAng = Math.atan2(target.y - CY, target.x - CX);
    const spread = Phaser.Math.DegToRad(8);
    for (let i = 0; i < s.projectiles; i++) {
      const offset = (i - (s.projectiles - 1) / 2) * spread;
      const b = this.fireBullet(baseAng + offset, 460, damage, s.pierce);
      b.setTint(0xfff07a);
    }
    this.sfx?.play('shoot');
  }

  fireBullet(angle, speed, damage, pierce, type = 'kinetic') {
    const b = this.bullets.create(CX, CY, 'tex_bullet');
    b.setBlendMode(ADD).setDepth(4).setScale(0.9);
    b.damage = damage;
    b.pierce = pierce;
    b.dmgType = type;
    b._hit = new Set();
    b.body.setCircle(4, b.width / 2 - 4, b.height / 2 - 4);
    b.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.time.delayedCall(2600, () => b.active && b.destroy());
    return b;
  }

  // ===========================================================================
  //  HABILIDADES
  // ===========================================================================
  updateAbilities(dt) {
    this.laserGfx.clear();

    for (const id of Object.keys(this.abilities)) {
      const lv = this.abilities[id];
      const s = ABILITY_BY_ID[id].levels[lv - 1];
      if (id === 'dual_cannon') this.tickDualCannon(dt, s);
      else if (id === 'homing_missiles') this.tickHomingMissiles(dt, s);
      else if (id === 'nova_pulse') this.tickNova(dt, s);
      else if (id === 'laser_beam') this.tickLaser(dt, s);
      else if (id === 'regen_shield') this.tickShield(dt, s);
    }
    this.updateOrbs(dt);
  }

  tickHomingMissiles(dt, s) {
    const range = this.scaledRange(s.range);
    this.abilityTimers.homing = (this.abilityTimers.homing || 0) + dt;
    // Solo lanza si hay un objetivo dentro del alcance del modulo.
    if (this.abilityTimers.homing >= s.cooldownMs / this.abilRateMul && this.nearestEnemy(range)) {
      this.abilityTimers.homing = 0;
      for (let i = 0; i < s.count; i++) {
        const m = this.missiles.create(CX, CY, 'tex_missile_p');
        m.setBlendMode(ADD).setDepth(4);
        m.damage = s.damage * this.pmul('homing_missiles');
        m.splits = s.splits;
        m.field = s.field;
        m.body.setCircle(5, m.width / 2 - 5, m.height / 2 - 5);
        m.spawnAng = Phaser.Math.FloatBetween(0, Math.PI * 2);
        m.body.setVelocity(Math.cos(m.spawnAng) * 60, Math.sin(m.spawnAng) * 60);
        this.time.delayedCall(4000, () => m.active && m.destroy());
      }
    }
    this.missiles.children.iterate((m) => {
      if (!m || !m.active) return;
      const t = this.nearestEnemy(range);
      if (!t) return;
      const desired = Math.atan2(t.y - m.y, t.x - m.x);
      const cur = Math.atan2(m.body.velocity.y, m.body.velocity.x);
      const next = Phaser.Math.Angle.RotateTo(cur, desired, 0.12);
      const sp = 230;
      m.body.setVelocity(Math.cos(next) * sp, Math.sin(next) * sp);
      m.rotation = next + Math.PI / 2;
    });
  }

  tickNova(dt, s) {
    this.abilityTimers.nova = (this.abilityTimers.nova || 0) + dt;
    if (this.abilityTimers.nova < s.cooldownMs / this.abilRateMul) return;
    this.abilityTimers.nova = 0;

    this.novaBlast(s);
    if (s.double) this.time.delayedCall(260, () => this.running && this.novaBlast(s));
  }

  novaBlast(s) {
    this.sfx?.play('nova');
    const radius = Math.min(MAX_RANGE, s.radius);
    const ring = this.add
      .circle(CX, CY, STATION.radius, COLORS.nova, 0)
      .setStrokeStyle(3, COLORS.nova, 0.95)
      .setBlendMode(ADD)
      .setDepth(6);
    this.tweens.add({
      targets: ring,
      radius,
      alpha: 0,
      duration: 420,
      onComplete: () => ring.destroy()
    });

    const dmg = s.damage * this.pmul('nova_pulse');
    this.enemies.children.iterate((e) => {
      if (!e || !e.active) return;
      if (Math.hypot(e.x - CX, e.y - CY) <= radius) {
        if (s.slowMs) e.slowUntil = this.timeSurvived + s.slowMs;
        this.damageEnemy(e, dmg, 'energy');
      }
    });
  }

  tickLaser(dt, s) {
    const beams = s.beams || 1;
    const dps = s.dps * this.pmul('laser_beam');
    const range = this.scaledRange(s.range);
    if (s.pierceAll) {
      const inRange = [];
      this.enemies.children.iterate((e) => {
        if (!e || !e.active) return;
        const d = Math.hypot(e.x - CX, e.y - CY);
        if (d <= range) {
          this.damageEnemy(e, dps * (dt / 1000), 'laser');
          inRange.push({ e, d });
        }
      });
      inRange.sort((a, b) => a.d - b.d);
      for (let i = 0; i < Math.min(beams, inRange.length); i++) this.drawLaser(inRange[i].e, 4);
      return;
    }
    const t = this.nearestEnemy(range);
    if (!t) return;
    this.damageEnemy(t, dps * (dt / 1000), 'laser');
    this.drawLaser(t, 3);
  }

  drawLaser(t, width) {
    this.laserGfx.lineStyle(width + 4, COLORS.laser, 0.25);
    this.laserGfx.lineBetween(CX, CY, t.x, t.y);
    this.laserGfx.lineStyle(width, COLORS.laser, 0.95);
    this.laserGfx.lineBetween(CX, CY, t.x, t.y);
    this.laserGfx.fillStyle(0xffffff, 0.8);
    this.laserGfx.fillCircle(t.x, t.y, width);
  }

  tickShield(dt, s) {
    this.shieldMax = Math.round(s.shieldMax * this.pmul('regen_shield'));
    if (this.shield < this.shieldMax) {
      this.shield = Math.min(this.shieldMax, this.shield + s.regenPerSec * (dt / 1000));
    }
    const ratio = this.shieldMax > 0 ? this.shield / this.shieldMax : 0;
    this.shieldFx.setFillStyle(COLORS.shield, 0.05 + ratio * 0.2);
    this.shieldFx.setStrokeStyle(1.5, COLORS.shield, 0.2 + ratio * 0.6);
    this.shieldFx.setRadius(STATION.radius + 10 + ratio * 5);
  }

  rebuildOrbs() {
    this.orbs.forEach((o) => o.destroy());
    this.orbs = [];
    const lv = this.abilities.orbital_ring;
    if (!lv) return;
    const s = ABILITY_BY_ID.orbital_ring.levels[lv - 1];
    for (let i = 0; i < s.orbs; i++) {
      const o = this.orbsGroup.create(CX, CY, 'tex_orb');
      o.setBlendMode(ADD).setDepth(4);
      o.body.setCircle(7, o.width / 2 - 7, o.height / 2 - 7);
      o.body.setAllowGravity(false);
      o.idx = i;
      this.orbs.push(o);
    }
  }

  updateOrbs(dt) {
    const lv = this.abilities.orbital_ring;
    if (!lv) return;
    const s = ABILITY_BY_ID.orbital_ring.levels[lv - 1];
    this._orbBaseAng = (this._orbBaseAng || 0) + s.speed * (dt / 1000);
    const n = this.orbs.length;
    this.orbs.forEach((o, i) => {
      const a = this._orbBaseAng + (i / n) * Math.PI * 2;
      o.x = CX + Math.cos(a) * s.radius;
      o.y = CY + Math.sin(a) * s.radius;
    });
  }

  // ===========================================================================
  //  COLISIONES
  // ===========================================================================
  onBulletHit(bullet, enemy) {
    if (!bullet.active || !enemy.active || bullet._hit.has(enemy)) return;
    bullet._hit.add(enemy);
    this.damageEnemy(enemy, bullet.damage, bullet.dmgType);
    if (bullet.pierce > 0) bullet.pierce--;
    else bullet.destroy();
  }

  onMissileHit(missile, enemy) {
    if (!missile.active || !enemy.active) return;
    this.sfx?.play('hit');
    this.damageEnemy(enemy, missile.damage, 'explosive');
    if (missile.splits > 0) {
      for (let i = 0; i < missile.splits; i++) {
        const a = (i / missile.splits) * Math.PI * 2;
        const frag = this.fireBullet(a, 260, missile.damage * 0.5, 0, 'explosive');
        frag.setPosition(missile.x, missile.y);
      }
    }
    if (missile.field) this.plasmaField(missile.x, missile.y, missile.damage);
    missile.destroy();
  }

  // ESPECIAL III misiles: zona de plasma que daña al impactar.
  plasmaField(x, y, dmg) {
    const R = 56;
    const fx = this.add
      .image(x, y, 'tex_glow')
      .setTint(COLORS.missile)
      .setBlendMode(ADD)
      .setAlpha(0.5)
      .setScale(0.2)
      .setDepth(5);
    this.tweens.add({
      targets: fx,
      scale: (R * 2) / 64,
      alpha: 0,
      duration: 520,
      onComplete: () => fx.destroy()
    });
    this.enemies.children.iterate((e) => {
      if (e && e.active && Math.hypot(e.x - x, e.y - y) < R) this.damageEnemy(e, dmg * 0.7, 'explosive');
    });
  }

  onOrbHit(orb, enemy) {
    if (!enemy.active || this.timeSurvived < enemy._orbCdUntil) return;
    enemy._orbCdUntil = this.timeSurvived + 230;
    const lv = this.abilities.orbital_ring;
    const s = ABILITY_BY_ID.orbital_ring.levels[lv - 1];
    const odmg = s.damage * this.pmul('orbital_ring');
    this.damageEnemy(enemy, odmg, 'energy');
    if (s.pulse) {
      const pr = s.pulseR || 42;
      const ring = this.add
        .circle(orb.x, orb.y, 4, COLORS.orb, 0.5)
        .setBlendMode(ADD)
        .setDepth(6);
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
          this.damageEnemy(other, odmg * 0.6, 'energy');
      });
    }
  }

  onEnemyReachStation(station, enemy) {
    if (!enemy.active) return;
    this.applyStationDamage(enemy.contactDmg);
    this.spawnDeathFx(enemy.x, enemy.y, 0xff8a8a);
    enemy.destroy();
    this.cameras.main.shake(120, 0.006);
  }

  // ===========================================================================
  //  DAÑO / MUERTE / XP
  // ===========================================================================
  damageEnemy(enemy, amount, type = 'kinetic') {
    if (!enemy.active || enemy._untargetable) return; // sigiloso en fase = inmune
    let dmg = amount * (enemy.dmgMul || 1); // pasiva NO global (solo arma común)
    dmg *= resistMul(enemy.enemyType, type); // resistencia/debilidad por tipo
    if (enemy._shieldedUntil && this.timeSurvived < enemy._shieldedUntil)
      dmg *= enemy._shieldMul || 1;
    enemy.hp -= dmg;
    if (enemy.hp <= 0) {
      const wasBoss = enemy.flags && enemy.flags.boss;
      this.spawnDeathFx(enemy.x, enemy.y, wasBoss ? 0xff4f86 : COLORS.xp);
      this.sfx?.play('explosion');
      this.kills++;
      this.addXp(enemy.xpValue);
      this.gold = (this.gold || 0) + (enemy.goldValue || 0);
      enemy.destroy();
      if (wasBoss) {
        if (this.mode === 'level' && !this._won) this.levelClear();
        else this.cameras.main.shake(300, 0.01);
      }
    }
  }

  applyStationDamage(amount) {
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
      this.shieldThorns(); // ESPECIAL III escudo: espinas en cada impacto
      if (this.shield <= 0 && !this.shieldBrokenFlag) {
        this.shieldBrokenFlag = true;
        this.onShieldBreak();
      }
    } else {
      this.shieldBrokenFlag = false;
    }
    if (amount <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.sfx?.play('damage');
    if (this.hp <= 0) this.gameOver();
  }

  shieldThorns() {
    const lv = this.abilities.regen_shield;
    if (!lv) return;
    const s = ABILITY_BY_ID.regen_shield.levels[lv - 1];
    if (!s.reflect) return;
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
    const td = 24 * this.pmul('regen_shield');
    this.enemies.children.iterate((e) => {
      if (e && e.active && Math.hypot(e.x - CX, e.y - CY) < R) this.damageEnemy(e, td, 'energy');
    });
  }

  onShieldBreak() {
    const lv = this.abilities.regen_shield;
    if (!lv) return;
    const s = ABILITY_BY_ID.regen_shield.levels[lv - 1];
    if (!s.burst) return;
    this.sfx?.play('shieldbreak');
    const ring = this.add
      .circle(CX, CY, STATION.radius, COLORS.shield, 0.4)
      .setBlendMode(ADD)
      .setDepth(6);
    this.tweens.add({
      targets: ring,
      radius: 150,
      alpha: 0,
      duration: 380,
      onComplete: () => ring.destroy()
    });
    const bd = s.burst * this.pmul('regen_shield');
    this.enemies.children.iterate((e) => {
      if (e && e.active && Math.hypot(e.x - CX, e.y - CY) < 150) this.damageEnemy(e, bd, 'energy');
    });
  }

  spawnDeathFx(x, y, color) {
    const g = this.add
      .image(x, y, 'tex_glow')
      .setTint(color)
      .setBlendMode(ADD)
      .setScale(0.4)
      .setDepth(6);
    this.tweens.add({
      targets: g,
      scale: 1.1,
      alpha: 0,
      duration: 280,
      ease: 'Quad.out',
      onComplete: () => g.destroy()
    });
  }

  addXp(amount) {
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
  openDraft() {
    this.drafting = true;
    this.running = false;
    this.physics.world.pause();

    const owned = Object.keys(this.abilities);
    const pool = [];

    for (const id of owned) {
      if (this.abilities[id] < MAX_LEVEL)
        pool.push({ id, type: 'up', nextLevel: this.abilities[id] + 1 });
    }
    if (owned.length < ABILITY_SLOTS) {
      for (const a of ABILITIES) {
        if (!this.abilities[a.id]) pool.push({ id: a.id, type: 'new', nextLevel: 1 });
      }
    }

    Phaser.Utils.Array.Shuffle(pool);
    const picks = pool.slice(0, 3);
    while (picks.length < 3) picks.push({ id: '__repair', type: 'repair', nextLevel: 0 });

    const choices = picks.map((p) => {
      if (p.type === 'repair') {
        return {
          id: '__repair',
          name: t('ui.repair_name'),
          color: 0x9affc4,
          levelLabel: t('ui.tag_support'),
          level: 0,
          pips: false,
          desc: t('ui.repair_desc', { n: Math.round(this.maxHp * 0.25) })
        };
      }
      const a = ABILITY_BY_ID[p.id];
      return {
        id: p.id,
        name: a.name,
        color: a.color,
        levelLabel: levelLabel(p.nextLevel),
        level: p.nextLevel,
        pips: true,
        desc: a.desc(p.nextLevel)
      };
    });

    this.events.emit('levelup', { choices, level: this.level });
  }

  chooseDraft(id) {
    if (id === '__repair') {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25);
    } else {
      this.abilities[id] = (this.abilities[id] || 0) + 1;
      if (id === 'orbital_ring') this.rebuildOrbs();
      // El nuevo alcance "aparece": resalte del rango del arma conseguida.
      const w = this.weaponRanges().find((x) => x.id === id);
      if (w) this.pingRange(w.range, w.color);
    }

    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);

    if (this.pendingLevelUps > 0) {
      this.openDraft();
    } else {
      this.drafting = false;
      this.running = true;
      this.physics.world.resume();
      this.events.emit('draftclosed');
    }
  }

  // ===========================================================================
  //  UTILIDADES / FIN
  // ===========================================================================
  nearestEnemy(maxRange = Infinity) {
    let best = null;
    let bd = maxRange * maxRange;
    this.enemies.children.iterate((e) => {
      if (!e || !e.active || e._untargetable) return;
      const d = (e.x - CX) ** 2 + (e.y - CY) ** 2;
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
      abilities: { ...this.abilities },
      mode: this.mode,
      levelNum: this.levelNum,
      targetKills: this.targetKills,
      diff: this.difficultyStep() + 1
    };
  }
}
