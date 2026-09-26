import type { SimState } from './state';
import { xpForLevel } from './state';
import type { Enemy, EnemyDef, Input, PickupKind } from './types';
import { ENEMIES, BOSS_ORDER, type EnemyId } from './content/enemies';
import { WAVES, SWARM_EVENTS, BOSS_MINUTES, type SpawnEntry } from './content/waves';
import { updateWeapons, updateProjectiles, updateZones } from './weapons';
import { addText, healPlayer, hurt, onScreen, sound } from './combat';
import { computeStats, powerLevel } from './upgrades';

export const DT = 1 / 60;
const PLAYER_SPEED = 95;
const PLAYER_RADIUS = 9;
const BASE_MAGNET = 48;
const MAX_GEMS = 400;
const MAX_ENEMIES = 520;

/** HP multiplier by minute. Linear early, exponential after twenty, endless. */
export function enemyHpScale(minute: number, curse: number): number {
  // A build that can stand still at minute 15 must not be able to at 20:
  // HP compounds 24 percent a minute from minute 12, on top of the linear
  // part, and the director also spawns more (see direct()).
  const linear = 1 + minute * 0.12;
  const late = minute > 12 ? Math.pow(1.27, minute - 12) : 1;
  return linear * late * (0.7 + 0.3 * curse);
}
export function enemyDamageScale(minute: number): number {
  const late = minute > 15 ? Math.pow(1.07, minute - 15) : 1;
  return (1 + minute * 0.035) * late;
}

export function initRun(s: SimState): void {
  computeStats(s);
  s.player.hp = s.stats.maxHp;
}

export function step(s: SimState, input: Input, dt: number): void {
  if (s.gameOver) {
    s.player.deadTime += dt;
    decay(s, dt);
    return;
  }
  s.time += dt;
  s.minute = s.time / 60;
  const p = s.player;

  // Player
  p.invuln = Math.max(0, p.invuln - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.hideCd = Math.max(0, p.hideCd - dt);
  // Kanto: a second of standing still turns the player into a stump.
  const kanto = powerLevel(s, 'kanto');
  const rooted = kanto > 0 && p.still >= 1;
  const regen = s.stats.regen + (rooted ? 1 * kanto : 0);
  if (regen > 0 && p.hp < s.stats.maxHp) p.hp = Math.min(s.stats.maxHp, p.hp + regen * dt);
  const len = Math.hypot(input.dx, input.dy);
  if (len > 0.05) {
    const m = Math.min(1, len);
    const nx = input.dx / len;
    const ny = input.dy / len;
    p.x += nx * m * PLAYER_SPEED * s.stats.moveSpeed * dt;
    p.y += ny * m * PLAYER_SPEED * s.stats.moveSpeed * dt;
    p.dirX = nx;
    p.dirY = ny;
    if (Math.abs(nx) > 0.2) p.facing = nx > 0 ? 1 : -1;
    p.moving = true;
    p.still = 0;
  } else {
    p.moving = false;
    p.still += dt;
  }

  direct(s, dt);

  // Grid
  const g = s.grid;
  g.clear();
  for (let i = 0; i < s.enemies.length; i++) g.insert(s.enemies[i]);

  updateEnemies(s, dt);
  updateWeapons(s, dt);
  updateProjectiles(s, dt);
  updateZones(s, dt);
  reap(s);
  updateGems(s, dt);
  updatePickups(s, dt);
  decay(s, dt);
}

function decay(s: SimState, dt: number): void {
  for (let i = s.texts.length - 1; i >= 0; i--) {
    const t = s.texts[i];
    t.life -= dt;
    t.y -= 28 * dt;
    if (t.life <= 0) {
      s.texts[i] = s.texts[s.texts.length - 1];
      s.texts.pop();
    }
  }
  for (let i = s.effects.length - 1; i >= 0; i--) {
    const e = s.effects[i];
    e.life -= dt;
    if (e.life <= 0) {
      s.effects[i] = s.effects[s.effects.length - 1];
      s.effects.pop();
    }
  }
  if (s.banner) {
    s.banner.life -= dt;
    if (s.banner.life <= 0) s.banner = null;
  }
}

// ---------------------------------------------------------------- director

function currentWave(s: SimState): { entries: SpawnEntry[]; tier: number } {
  const m = Math.floor(s.minute);
  const last = WAVES[WAVES.length - 1];
  if (m < last.at + 2) {
    let w = WAVES[0];
    for (const c of WAVES) if (c.at <= m) w = c;
    return { entries: w.spawns, tier: 0 };
  }
  // Endless: cycle the last five authored waves, each pass one tier harder.
  const over = m - (last.at + 2);
  const cycle = WAVES.slice(-5);
  const idx = Math.floor(over / 2) % cycle.length;
  const tier = Math.floor(over / 10) + 1;
  return { entries: cycle[idx].spawns, tier };
}

function spawnPoint(s: SimState, out: { x: number; y: number }, margin = 30): void {
  const hw = s.view.w / 2 + margin;
  const hh = s.view.h / 2 + margin;
  const side = s.rng.int(0, 3);
  const p = s.player;
  switch (side) {
    case 0:
      out.x = p.x + s.rng.range(-hw, hw);
      out.y = p.y - hh;
      break;
    case 1:
      out.x = p.x + s.rng.range(-hw, hw);
      out.y = p.y + hh;
      break;
    case 2:
      out.x = p.x - hw;
      out.y = p.y + s.rng.range(-hh, hh);
      break;
    default:
      out.x = p.x + hw;
      out.y = p.y + s.rng.range(-hh, hh);
  }
}

const tmp = { x: 0, y: 0 };

export function spawnEnemy(s: SimState, def: EnemyDef, x: number, y: number, opts: { elite?: boolean; boss?: boolean; tier?: number } = {}): Enemy {
  const elite = !!opts.elite;
  const boss = !!opts.boss;
  const tier = opts.tier ?? s.tier;
  const scale = enemyHpScale(s.minute, s.stats.curse);
  // Bosses and elites ride a gentler curve: they are fights, not walls.
  let hp = def.hp * (boss || elite ? Math.pow(scale, 0.75) : scale) * (1 + tier * 0.35);
  if (elite) hp *= 9;
  if (boss) hp *= 1 + s.bossIndex * 0.15;
  const e: Enemy = {
    id: s.nextId++,
    def,
    x,
    y,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    elite,
    boss,
    scale: def.scale * (elite ? 1.45 : 1),
    flash: 0,
    slow: 0,
    slowTime: 0,
    kx: 0,
    ky: 0,
    t1: s.rng.range(0.5, 2.5),
    t2: 0,
    contact: 0,
    facing: 1,
    wobble: s.rng.next() * Math.PI * 2,
  };
  s.enemies.push(e);
  return e;
}

function direct(s: SimState, dt: number): void {
  const { entries, tier } = currentWave(s);
  s.tier = tier;
  const curse = s.stats.curse;
  const pressure = s.minute > 15 ? 1 + (s.minute - 15) * 0.1 : 1;
  const rateMul = curse * (1 + tier * 0.3) * pressure;
  const capMul = curse * (1 + tier * 0.25) * pressure;
  if (s.enemies.length < MAX_ENEMIES) {
    // Alive counts per type, once.
    const alive: Record<string, number> = {};
    for (const e of s.enemies) alive[e.def.id] = (alive[e.def.id] ?? 0) + 1;
    for (const en of entries) {
      const acc = (s.spawnAcc[en.type] ?? 0) + en.rate * rateMul * dt;
      let n = Math.floor(acc);
      s.spawnAcc[en.type] = acc - n;
      const cap = Math.ceil(en.cap * capMul);
      while (n-- > 0 && (alive[en.type] ?? 0) < cap && s.enemies.length < MAX_ENEMIES) {
        spawnPoint(s, tmp);
        spawnEnemy(s, ENEMIES[en.type], tmp.x, tmp.y, { tier });
        alive[en.type] = (alive[en.type] ?? 0) + 1;
      }
    }
  }

  // Elites: one every so often, from the types the wave marks as elite
  // capable. A chest per elite is the pacing of upgrades, so this timer is
  // the knob, not a per-spawn chance.
  const eliteEvery = Math.max(30, 70 - s.minute - tier * 5) / curse;
  if (s.time - s.lastElite >= eliteEvery && s.time > 100) {
    const pool = entries.filter((e) => e.elite);
    if (pool.length > 0) {
      s.lastElite = s.time;
      spawnPoint(s, tmp);
      spawnEnemy(s, ENEMIES[s.rng.pick(pool).type], tmp.x, tmp.y, { elite: true, tier });
    }
  }

  // Scripted swarms
  while (s.eventIndex < SWARM_EVENTS.length && SWARM_EVENTS[s.eventIndex].atSeconds <= s.time) {
    const ev = SWARM_EVENTS[s.eventIndex++];
    swarm(s, ev.kind, ENEMIES[ev.type], Math.round(ev.count * curse));
  }
  // Endless swarms after the list runs out: one every two minutes.
  if (s.eventIndex >= SWARM_EVENTS.length) {
    const lastAt = SWARM_EVENTS[SWARM_EVENTS.length - 1].atSeconds;
    const k = Math.floor((s.time - lastAt) / 120);
    if (k >= 1 && s.spawnAcc.__swarm !== k) {
      s.spawnAcc.__swarm = k;
      const pool: EnemyId[] = ['hyttynen', 'makara', 'muurahainen', 'hirvikarpanen', 'liekkio', 'ampiainen'];
      swarm(s, k % 2 === 0 ? 'ring' : 'column', ENEMIES[pool[k % pool.length]], Math.round((120 + k * 20) * curse));
    }
  }

  // Bosses
  if (s.minute >= s.nextBossMinute) {
    const id = BOSS_ORDER[s.bossIndex % BOSS_ORDER.length];
    spawnPoint(s, tmp, 60);
    const b = spawnEnemy(s, ENEMIES[id], tmp.x, tmp.y, { boss: true, tier });
    b.t1 = 3;
    s.bossIndex++;
    s.bossesAlive++;
    s.banner = { text: `${ENEMIES[id].name} saapuu`, sub: 'Pomo', life: 3 };
    sound(s, 'boss');
    const i = BOSS_MINUTES.indexOf(s.nextBossMinute);
    s.nextBossMinute = i >= 0 && i + 1 < BOSS_MINUTES.length ? BOSS_MINUTES[i + 1] : s.nextBossMinute + 5;
  }
}

function swarm(s: SimState, kind: 'ring' | 'column', def: EnemyDef, count: number): void {
  const p = s.player;
  if (kind === 'ring') {
    const r = Math.hypot(s.view.w, s.view.h) / 2 + 40;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      spawnEnemy(s, def, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    }
    s.banner = { text: 'Räkkä', sub: `${def.name} joka suunnasta`, life: 2.5 };
    sound(s, 'swarm');
  } else {
    // A column crosses the screen from one side, past the player.
    const horizontal = s.rng.chance(0.5);
    const dir = s.rng.chance(0.5) ? 1 : -1;
    const hw = s.view.w / 2 + 40;
    const hh = s.view.h / 2 + 40;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const along = (t - 0.5) * 2;
      let x: number;
      let y: number;
      if (horizontal) {
        x = p.x - dir * (hw + i * 14);
        y = p.y + along * hh * 0.9;
      } else {
        x = p.x + along * hw * 0.9;
        y = p.y - dir * (hh + i * 14);
      }
      const e = spawnEnemy(s, def, x, y);
      e.t2 = 3; // marching: fixed heading, see updateEnemies
      e.vx = horizontal ? dir : 0;
      e.vy = horizontal ? 0 : dir;
    }
    s.banner = { text: 'Vaellus', sub: `${def.name} marssii ohi`, life: 2.5 };
    sound(s, 'swarm');
  }
}

// ---------------------------------------------------------------- enemies

function updateEnemies(s: SimState, dt: number): void {
  const p = s.player;
  const es = s.enemies;
  const dmgScale = enemyDamageScale(s.minute);
  const farX = s.view.w / 2 + 160;
  const farY = s.view.h / 2 + 160;
  for (let i = 0; i < es.length; i++) {
    const e = es[i];
    if (e.hp <= 0) continue;
    e.flash = Math.max(0, e.flash - dt);
    if (e.slowTime > 0) {
      e.slowTime -= dt;
      if (e.slowTime <= 0) e.slow = 0;
    }
    e.wobble += dt * 6;

    // Relocate stragglers so the pressure stays on. Bosses and columns walk.
    if (!e.boss && e.t2 < 3 && (Math.abs(e.x - p.x) > farX || Math.abs(e.y - p.y) > farY)) {
      spawnPoint(s, tmp);
      e.x = tmp.x;
      e.y = tmp.y;
      e.kx = e.ky = 0;
    }

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    let speed = e.def.speed * (1 - e.slow);
    let mx = ux;
    let my = uy;

    switch (e.def.behaviour) {
      case 'swarm': {
        const w = Math.sin(e.wobble) * 0.35;
        mx = ux - uy * w;
        my = uy + ux * w;
        break;
      }
      case 'dash': {
        e.t1 -= dt;
        if (e.t1 <= 0 && dist < 240) {
          e.t1 = 2.6 + s.rng.next();
          e.kx = ux * 380;
          e.ky = uy * 380;
        }
        break;
      }
      case 'stick': {
        if (e.t2 === 1) {
          // attached: ride along, bite faster
          e.x = p.x + e.vx;
          e.y = p.y + e.vy;
          speed = 0;
        } else if (dist < PLAYER_RADIUS + e.def.radius * e.scale) {
          e.t2 = 1;
          e.vx = e.x - p.x;
          e.vy = e.y - p.y;
        }
        break;
      }
      case 'phase': {
        const w = Math.sin(e.wobble * 0.7) * 0.8;
        mx = ux - uy * w;
        my = uy + ux * w;
        break;
      }
      case 'boss': {
        e.t1 -= dt;
        if (e.t1 <= 0) {
          e.t1 = 4;
          e.kx = ux * 240;
          e.ky = uy * 240;
          if (e.def.id === 'ajattara' || e.def.id === 'stallu') {
            const minion = e.def.id === 'ajattara' ? ENEMIES.makara : ENEMIES.gufihtar;
            const n = e.def.id === 'ajattara' ? 8 : 3;
            for (let k = 0; k < n; k++) {
              const a = (k / n) * Math.PI * 2;
              spawnEnemy(s, minion, e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40);
            }
          }
        }
        break;
      }
      default:
        break;
    }

    if (e.t2 === 3) {
      // Column: keep heading, leave the screen, then die quietly far away.
      mx = e.vx;
      my = e.vy;
      speed = e.def.speed * 1.1 * (1 - e.slow);
      if (Math.abs(e.x - p.x) > farX + 200 || Math.abs(e.y - p.y) > farY + 200) e.hp = -1;
    }

    // Separation: push apart from a few neighbours in the same cell.
    if (e.def.behaviour !== 'phase' && e.t2 !== 1) {
      const cell = s.grid.cellOf(e);
      if (cell) {
        let px = 0;
        let py = 0;
        let n = 0;
        for (let k = 0; k < cell.length && n < 8; k++) {
          const o = cell[k];
          if (o === e || o.hp <= 0) continue;
          const ox = e.x - o.x;
          const oy = e.y - o.y;
          const rr = (e.def.radius * e.scale + o.def.radius * o.scale) * 0.9;
          const d2 = ox * ox + oy * oy;
          if (d2 < rr * rr && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (rr - d) / rr;
            px += (ox / d) * f;
            py += (oy / d) * f;
            n++;
          }
        }
        if (n > 0) {
          e.x += px * 140 * dt;
          e.y += py * 140 * dt;
        }
      }
    }

    e.x += (mx * speed + e.kx) * dt;
    e.y += (my * speed + e.ky) * dt;
    e.kx *= Math.pow(0.02, dt);
    e.ky *= Math.pow(0.02, dt);
    if (Math.abs(mx) > 0.1) e.facing = mx > 0 ? 1 : -1;

    // Contact damage
    const r = PLAYER_RADIUS + e.def.radius * e.scale;
    if (dist < r && p.alive) {
      e.contact -= dt;
      if (e.contact <= 0) {
        e.contact = e.def.behaviour === 'stick' ? 0.4 : e.boss ? 1.0 : 0.55;
        if (p.invuln <= 0) {
          const armor = s.stats.armor + (powerLevel(s, 'kanto') > 0 && p.still >= 1 ? 3 * powerLevel(s, 'kanto') : 0);
          let raw = e.def.damage * dmgScale * (e.elite ? 1.5 : 1);
          if (e.boss || e.elite) raw *= 1 - 0.25 * powerLevel(s, 'tapionsuoja');
          const dmg = Math.max(1, Math.round(raw - armor));
          p.hp -= dmg;
          p.hurtFlash = 0.15;
          s.run.damageTaken += dmg;
          sound(s, 'hurt');
          // Ukon suosio: the biter is struck.
          const thorns = powerLevel(s, 'ukonsuosio');
          if (thorns > 0) {
            hurt(s, e, 20 * thorns * s.stats.might * (1 + s.minute * 0.15), 0, 0, 0);
            s.effects.push({ kind: 'bolt', x: e.x, y: e.y - 200, x2: e.x, y2: e.y, life: 0.2, maxLife: 0.2, color: '#9fd3ff', radius: 12 });
          }
          // Piilopaikka: a hard hit hides the player for a moment.
          const hide = powerLevel(s, 'piilopaikka');
          if (hide > 0 && p.hideCd <= 0 && dmg >= s.stats.maxHp * 0.08) {
            p.invuln = 0.8 * hide + 0.4;
            p.hideCd = 15;
            addText(s, p.x, p.y - 16, 'Piilossa', '#c8f0ff', true);
          }
          if (p.hp <= 0) die(s);
        }
      }
    } else {
      e.contact = Math.min(e.contact, 0.1);
    }
  }
}

function die(s: SimState): void {
  const p = s.player;
  if (s.stats.revives > 0) {
    s.stats.revives--;
    p.hp = s.stats.maxHp;
    p.invuln = 2.5;
    s.effects.push({ kind: 'revive', x: p.x, y: p.y, x2: 0, y2: 0, life: 0.8, maxLife: 0.8, color: '#ffffff', radius: 260 });
    for (const e of s.enemies) {
      if (!e.boss && Math.hypot(e.x - p.x, e.y - p.y) < 260) hurt(s, e, 9999, 0, 0, 0);
    }
    s.banner = { text: 'Lovi', sub: 'Palaat toisesta maailmasta', life: 2.5 };
    sound(s, 'revive');
    return;
  }
  p.hp = 0;
  p.alive = false;
  s.gameOver = true;
  sound(s, 'death');
}

// ---------------------------------------------------------------- deaths and drops

function drop(s: SimState, kind: PickupKind, x: number, y: number): void {
  s.pickups.push({ kind, x, y, life: 90 });
}

function reap(s: SimState): void {
  const es = s.enemies;
  const luck = s.stats.luck;
  for (let i = es.length - 1; i >= 0; i--) {
    const e = es[i];
    if (e.hp > 0) continue;
    es[i] = es[es.length - 1];
    es.pop();
    if (e.hp === -1 && e.t2 === 3) continue; // walked off
    s.run.kills++;
    sound(s, 'kill');
    onKill(s, e);
    if (s.effects.length < 60) s.effects.push({ kind: 'puff', x: e.x, y: e.y, x2: 0, y2: 0, life: 0.28, maxLife: 0.28, color: e.boss ? '#ffd166' : '#dfe8d8', radius: e.def.radius * e.scale * 1.6 });
    if (e.boss) {
      s.bossesAlive--;
      s.run.bosses++;
      drop(s, 'arkku', e.x, e.y);
      drop(s, 'kanttarelli', e.x + 30, e.y);
      // A boss pays in a spray of berries.
      for (let k = 0; k < 12; k++) addGem(s, e.x + (s.rng.next() - 0.5) * 80, e.y + (s.rng.next() - 0.5) * 80, Math.ceil(e.def.xp / 12));
      s.banner = { text: `${e.def.name} kaatui`, sub: 'Arkku putosi', life: 2.5 };
      sound(s, 'bosskill');
      continue;
    }
    if (e.elite) {
      drop(s, 'arkku', e.x, e.y);
      addGem(s, e.x, e.y, e.def.xp * 3);
      continue;
    }
    addGem(s, e.x, e.y, e.def.xp);
    const r = s.rng.next();
    if (r < 0.006 * luck) drop(s, 'kanttarelli', e.x, e.y);
    else if (r < 0.0085 * luck) drop(s, 'lakka', e.x, e.y);
    else if (r < 0.0097 * luck) drop(s, 'kekale', e.x, e.y);
  }
}

/** Taiat that fire on a kill: Kalman kosketus, Tulikaste, Elonkorjuu. */
function onKill(s: SimState, e: Enemy): void {
  const boom = powerLevel(s, 'kalmankosketus');
  if (boom > 0 && !e.boss) {
    const r = 34 + e.def.radius * e.scale;
    const dmg = e.maxHp * 0.12 * boom;
    s.grid.query(e.x, e.y, r, (o) => {
      if (o === e || o.hp <= 0) return;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      if (dx * dx + dy * dy > r * r) return;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      hurt(s, o, dmg, dx / d, dy / d, 10);
    });
    if (s.effects.length < 60) s.effects.push({ kind: 'burst', x: e.x, y: e.y, x2: 0, y2: 0, life: 0.25, maxLife: 0.25, color: '#b8a0ff', radius: r });
  }
  const fire = powerLevel(s, 'tulikaste');
  if (fire > 0 && s.rng.chance(0.06 * fire) && s.zones.length < 40) {
    s.zones.push({ kind: 'fire', weapon: 'tulikaste', x: e.x, y: e.y, radius: 26, life: 2.2, maxLife: 2.2, damage: 4 * s.stats.might * (1 + s.minute * 0.15), tick: 0.5, timer: 0, followPlayer: false, slow: 0, knockback: 0, heal: 0, angle: 0, halfWidth: 0, hit: new Set(), tint: '#ff8a3d' });
  }
  const harvest = powerLevel(s, 'elonkorjuu');
  if (harvest > 0) {
    s.player.harvest++;
    if (s.player.harvest >= (harvest >= 2 ? 100 : 150)) {
      s.player.harvest = 0;
      drop(s, 'kanttarelli', s.player.x + 20, s.player.y);
    }
  }
}

function addGem(s: SimState, x: number, y: number, value: number): void {
  if (s.gems.length >= MAX_GEMS) {
    // Fold into the newest gem so nothing is lost and the count stays bounded.
    s.gems[s.gems.length - 1].value += value;
    return;
  }
  s.gems.push({ x, y, value, pull: false });
}

// ---------------------------------------------------------------- gems and pickups

function gainXp(s: SimState, v: number): void {
  const p = s.player;
  p.xp += v * s.stats.growth;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = xpForLevel(p.level);
    s.pendingLevelUps++;
    sound(s, 'levelup');
    s.effects.push({ kind: 'levelup', x: p.x, y: p.y, x2: 0, y2: 0, life: 0.6, maxLife: 0.6, color: '#f0b830', radius: 90 });
    s.run.maxLevel = Math.max(s.run.maxLevel, p.level);
  }
}

function updateGems(s: SimState, dt: number): void {
  const p = s.player;
  const gs = s.gems;
  const mr = BASE_MAGNET * s.stats.magnet;
  const mr2 = mr * mr;
  for (let i = gs.length - 1; i >= 0; i--) {
    const g = gs[i];
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    const d2 = dx * dx + dy * dy;
    if (!g.pull && d2 < mr2) g.pull = true;
    if (g.pull) {
      const d = Math.sqrt(d2) || 1;
      const sp = 380 + (mr - Math.min(d, mr)) * 3;
      g.x += (dx / d) * sp * dt;
      g.y += (dy / d) * sp * dt;
      if (d < 12) {
        gainXp(s, g.value);
        sound(s, 'gem');
        const nl = powerLevel(s, 'nakinlahja');
        if (nl > 0 && p.hp < s.stats.maxHp) p.hp = Math.min(s.stats.maxHp, p.hp + 0.6 * nl);
        gs[i] = gs[gs.length - 1];
        gs.pop();
      }
    }
  }
}

function updatePickups(s: SimState, dt: number): void {
  const p = s.player;
  const ps = s.pickups;
  for (let i = ps.length - 1; i >= 0; i--) {
    const k = ps[i];
    k.life -= dt;
    const d = Math.hypot(p.x - k.x, p.y - k.y);
    if (d < PLAYER_RADIUS + 14) {
      collect(s, k.kind, k.x, k.y);
      ps[i] = ps[ps.length - 1];
      ps.pop();
    } else if (k.life <= 0) {
      ps[i] = ps[ps.length - 1];
      ps.pop();
    }
  }
}

function collect(s: SimState, kind: PickupKind, x: number, y: number): void {
  switch (kind) {
    case 'kanttarelli':
      healPlayer(s, 30);
      sound(s, 'pickup');
      break;
    case 'lakka':
      for (const g of s.gems) g.pull = true;
      addText(s, x, y, 'Lakka! Marjat lentävät', '#ffb347', true);
      sound(s, 'pickup');
      break;
    case 'kekale':
      for (const e of s.enemies) if (!e.boss && onScreen(s, e.x, e.y, 40)) hurt(s, e, 9999, 0, 0, 0);
      s.effects.push({ kind: 'burst', x, y, x2: 0, y2: 0, life: 0.5, maxLife: 0.5, color: '#ff8a3d', radius: 400 });
      sound(s, 'ember');
      break;
    case 'arkku':
      s.pendingChests++;
      break;
    case 'kahvi':
      break;
  }
}
