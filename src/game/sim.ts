import type { SimState, Hero } from './state';
import { xpForLevel, nearestHero } from './state';
import type { Enemy, EnemyDef, Input, PickupKind } from './types';
import { ENEMIES, BOSS_ORDER, type EnemyId } from './content/enemies';
import { WAVES, SWARM_EVENTS, BOSS_MINUTES, type SpawnEntry } from './content/waves';
import { updateWeapons, updateProjectiles, updateZones, dropWeapons } from './weapons';
import { addText, healPlayer, hurt, onScreen, sound } from './combat';
import { tr } from '../i18n';
import { computeStats, powerLevel } from './upgrades';
import { collideTrees, featuresNear, cellKey } from './forest';

export const DT = 1 / 60;
const PLAYER_SPEED = 95;
const PLAYER_RADIUS = 9;
const BASE_MAGNET = 48;
const MAX_GEMS = 400;
const MAX_ENEMIES = 520;
/** co-op: a living hero this close to a fallen one, for this long, raises them */
const REVIVE_RANGE = 34;
const REVIVE_TIME = 3;

/** HP multiplier by minute. Linear early, exponential after twenty, endless. */
export function enemyHpScale(minute: number, curse: number): number {
  // A build that can stand still at minute 15 must not be able to at 20:
  // HP compounds 24 percent a minute from minute 12, on top of the linear
  // part, and the director also spawns more (see direct()).
  const linear = 1 + minute * 0.18;
  const late = minute > 12 ? Math.pow(1.25, minute - 12) : 1;
  return 1.4 * linear * late * (0.7 + 0.3 * curse);
}
/** Enemies speed up after twenty so a kiting build is caught by thirty. */
export function enemySpeedScale(minute: number): number {
  return minute > 20 ? 1 + (minute - 20) * 0.04 : 1;
}
export function enemyDamageScale(minute: number): number {
  const late = minute > 15 ? Math.pow(1.07, minute - 15) : 1;
  return 1.4 * (1 + minute * 0.035) * late;
}

/**
 * Two heroes fire two builds, so the forest answers: enemies carry 65
 * percent more HP and the director sends 40 percent more. The bot pair
 * (`npm run balance 15 2 vaino+lemminkainen`) should die somewhere near
 * where one bot does, a little later: two thumbs are more than one but the
 * screen and the berries are shared.
 */
function coopHp(s: SimState): number {
  return s.heroes.length > 1 ? 1.65 : 1;
}
function coopRate(s: SimState): number {
  return s.heroes.length > 1 ? 1.4 : 1;
}
/** Each hero's share of a berry in co-op: together they get more than one would, not twice. */
function coopXp(s: SimState): number {
  return s.heroes.length > 1 ? 0.75 : 1;
}

export function initRun(s: SimState): void {
  for (const h of s.heroes) {
    computeStats(s, h);
    h.player.hp = h.stats.maxHp;
  }
  updateCamera(s);
}

/** The camera sits on the living heroes' midpoint; the strongest curse among them drives the director. */
function updateCamera(s: SimState): void {
  let x = 0;
  let y = 0;
  let n = 0;
  let curse = 0;
  for (const h of s.heroes) {
    if (!h.player.alive) continue;
    x += h.player.x;
    y += h.player.y;
    n++;
    curse = Math.max(curse, h.stats.curse);
  }
  if (n > 0) {
    s.cam.x = x / n;
    s.cam.y = y / n;
    s.curse = curse;
  }
}

export function step(s: SimState, input: Input | Input[], dt: number): void {
  const inputs = Array.isArray(input) ? input : [input];
  if (s.gameOver) {
    for (const h of s.heroes) if (!h.player.alive) h.player.deadTime += dt;
    decay(s, dt);
    return;
  }
  if (!s.heroes.some((h) => h.player.alive)) {
    s.gameOver = true;
    return;
  }
  s.time += dt;
  s.minute = s.time / 60;
  s.trip = Math.max(0, s.trip - dt);

  for (const h of s.heroes) {
    prev[h.index] = { x: h.player.x, y: h.player.y };
    if (!h.player.alive) {
      h.player.deadTime += dt;
      continue;
    }
    movePlayer(s, h, inputs[h.index] ?? inputs[0] ?? { dx: 0, dy: 0 }, dt);
  }
  leash(s);
  revive(s, dt);
  updateCamera(s);

  direct(s, dt);

  // Grid
  const g = s.grid;
  g.clear();
  for (let i = 0; i < s.enemies.length; i++) g.insert(s.enemies[i]);

  updateEnemies(s, dt);
  for (const h of s.heroes) if (h.player.alive) updateWeapons(s, h, dt);
  updateProjectiles(s, dt);
  updateZones(s, dt);
  reap(s);
  updateGems(s, dt);
  updatePickups(s, dt);
  decay(s, dt);
}

function movePlayer(s: SimState, h: Hero, input: Input, dt: number): void {
  const p = h.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.hideCd = Math.max(0, p.hideCd - dt);
  // Kanto: a second of standing still turns the player into a stump.
  const kanto = powerLevel(h, 'kanto');
  const rooted = kanto > 0 && p.still >= 1;
  const regen = h.stats.regen + (rooted ? 1 * kanto : 0);
  if (regen > 0 && p.hp < h.stats.maxHp) p.hp = Math.min(h.stats.maxHp, p.hp + regen * dt);
  const len = Math.hypot(input.dx, input.dy);
  if (len > 0.05) {
    const m = Math.min(1, len);
    let nx = input.dx / len;
    let ny = input.dy / len;
    if (s.trip > 0) {
      // Kärpässieni: the legs go where they want, a slow swing of the
      // heading, up to forty degrees either way.
      const a = Math.sin(s.time * 1.7) * 0.7;
      const rx = nx * Math.cos(a) - ny * Math.sin(a);
      const ry = nx * Math.sin(a) + ny * Math.cos(a);
      nx = rx;
      ny = ry;
    }
    p.x += nx * m * PLAYER_SPEED * h.stats.moveSpeed * dt;
    p.y += ny * m * PLAYER_SPEED * h.stats.moveSpeed * dt;
    p.dirX = nx;
    p.dirY = ny;
    if (Math.abs(nx) > 0.2) p.facing = nx > 0 ? 1 : -1;
    p.moving = true;
    p.still = 0;
  } else {
    p.moving = false;
    p.still += dt;
  }
  collideTrees(p, PLAYER_RADIUS);
  // Red mushrooms are eaten by walking on them.
  featuresNear(p.x, p.y, 14, (f) => {
    if (f.kind !== 'mushroom') return;
    const key = cellKey(f.cx, f.cy);
    if (s.eaten.has(key)) return;
    if (Math.hypot(f.x - p.x, f.y - p.y) > PLAYER_RADIUS + 7) return;
    s.eaten.add(key);
    s.trip = 9;
    addText(s, p.x, p.y - 18, tr('Kärpässieni! Metsä huojuu', 'Fly agaric! The forest sways'), '#ff6a6a', true);
    sound(s, 'swarm');
  });
}

const prev: { x: number; y: number }[] = [];

/**
 * Co-op: nobody walks off the shared screen. A hero who would leave the
 * other behind by more than the view stops at its edge. The limit is
 * measured from where the partner stood before this step, so two heroes
 * pushing apart both stop and neither drags the other along.
 */
function leash(s: SimState): void {
  if (s.heroes.length < 2) return;
  const lx = s.view.w - 70;
  const ly = s.view.h - 70;
  for (const h of s.heroes) {
    if (!h.player.alive) continue;
    for (const o of s.heroes) {
      if (o === h || !o.player.alive) continue;
      const p = h.player;
      const q = prev[o.index];
      if (p.x - q.x > lx) p.x = q.x + lx;
      else if (q.x - p.x > lx) p.x = q.x - lx;
      if (p.y - q.y > ly) p.y = q.y + ly;
      else if (q.y - p.y > ly) p.y = q.y - ly;
    }
  }
}

/** Co-op: a living hero standing by a fallen one for three seconds raises them at half health. */
function revive(s: SimState, dt: number): void {
  if (s.heroes.length < 2) return;
  for (const h of s.heroes) {
    if (h.player.alive) continue;
    const near = s.heroes.some((o) => o.player.alive && Math.hypot(o.player.x - h.player.x, o.player.y - h.player.y) < REVIVE_RANGE);
    if (!near) {
      h.revive = Math.max(0, h.revive - dt * 2);
      continue;
    }
    h.revive += dt;
    if (h.revive < REVIVE_TIME) continue;
    h.revive = 0;
    const p = h.player;
    p.alive = true;
    p.hp = Math.ceil(h.stats.maxHp * 0.5);
    p.invuln = 2;
    p.deadTime = 0;
    s.effects.push({ kind: 'revive', x: p.x, y: p.y, x2: 0, y2: 0, life: 0.8, maxLife: 0.8, color: '#ffffff', radius: 160 });
    for (const e of s.enemies) {
      if (!e.boss && Math.hypot(e.x - p.x, e.y - p.y) < 120) hurt(s, null, e, 9999, 0, 0, 0);
    }
    s.banner = { text: `${h.character.name} ${tr('nousee', 'is back up')}`, sub: tr('Toveri nosti', 'A friend helped'), life: 2.5 };
    sound(s, 'revive');
  }
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
  s.shake = Math.max(0, s.shake - dt);
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

/** A point just outside the screen, around the camera. */
function spawnPoint(s: SimState, out: { x: number; y: number }, margin = 30): void {
  const hw = s.view.w / 2 + margin;
  const hh = s.view.h / 2 + margin;
  const side = s.rng.int(0, 3);
  const c = s.cam;
  switch (side) {
    case 0:
      out.x = c.x + s.rng.range(-hw, hw);
      out.y = c.y - hh;
      break;
    case 1:
      out.x = c.x + s.rng.range(-hw, hw);
      out.y = c.y + hh;
      break;
    case 2:
      out.x = c.x - hw;
      out.y = c.y + s.rng.range(-hh, hh);
      break;
    default:
      out.x = c.x + hw;
      out.y = c.y + s.rng.range(-hh, hh);
  }
}

const tmp = { x: 0, y: 0 };

export function spawnEnemy(s: SimState, def: EnemyDef, x: number, y: number, opts: { elite?: boolean; boss?: boolean; tier?: number } = {}): Enemy {
  const elite = !!opts.elite;
  const boss = !!opts.boss;
  const tier = opts.tier ?? s.tier;
  const scale = enemyHpScale(s.minute, s.curse) * coopHp(s);
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
    lastSource: '',
    lastOwner: -1,
    target: 0,
  };
  s.enemies.push(e);
  return e;
}

function direct(s: SimState, dt: number): void {
  const { entries, tier } = currentWave(s);
  s.tier = tier;
  const curse = s.curse;
  const pressure = s.minute > 15 ? 1 + (s.minute - 15) * 0.14 : 1;
  const rateMul = curse * (1 + tier * 0.3) * pressure * coopRate(s);
  const capMul = curse * (1 + tier * 0.25) * pressure * coopRate(s);
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
      const circles: EnemyId[] = ['peikko', 'hiisi', 'kaarme', 'cahceravga'];
      if (k % 3 === 2) swarm(s, 'circle', ENEMIES[circles[k % circles.length]], 40 + k * 2);
      else swarm(s, k % 2 === 0 ? 'ring' : 'column', ENEMIES[pool[k % pool.length]], Math.round((120 + k * 20) * curse));
    }
  }

  // A cone falls from a tree every four minutes, near but not under the
  // players, so it has to be walked to. Tapion pöytä (src/meta.ts) is paid
  // in these; nothing else makes them.
  s.coneTimer -= dt;
  if (s.coneTimer <= 0) {
    s.coneTimer = 240;
    const a = s.rng.next() * Math.PI * 2;
    drop(s, 'kapy', s.cam.x + Math.cos(a) * 140, s.cam.y + Math.sin(a) * 140);
  }

  // Käpyarkku: a locked chest set down off screen, its key off screen the
  // other way. Both have to be found; the chest pays five cones and opens
  // like an ordinary chest. First at two and a half minutes, then every five.
  s.chestTimer -= dt;
  s.lockHint = Math.max(0, s.lockHint - dt);
  if (s.chestTimer <= 0) {
    s.chestTimer = 300;
    const a = s.rng.next() * Math.PI * 2;
    const far = Math.hypot(s.view.w, s.view.h) / 2 + 60;
    drop(s, 'kapyarkku', s.cam.x + Math.cos(a) * far, s.cam.y + Math.sin(a) * far);
    const b = a + Math.PI + (s.rng.next() - 0.5) * 1.6;
    drop(s, 'avain', s.cam.x + Math.cos(b) * far, s.cam.y + Math.sin(b) * far);
    s.banner = { text: tr('Käpyarkku', 'Cone chest'), sub: tr('Lukossa. Avain on jossain metsässä', 'Locked. The key is somewhere in the forest'), life: 3 };
    sound(s, 'chest');
  }

  // Tuoni: one at 28, one more every minute from 30.
  const due = s.minute >= 28 ? 1 + Math.max(0, Math.floor(s.minute - 29)) : 0;
  if (s.tuoni < due) {
    s.tuoni++;
    spawnPoint(s, tmp, 80);
    spawnEnemy(s, ENEMIES.tuoni, tmp.x, tmp.y);
    s.banner = { text: tr('Tuoni saapuu', 'Tuoni arrives'), sub: s.tuoni === 1 ? tr('Metsä sulkeutuu', 'Death has come for you') : tr('Toinen tulee', 'Another one comes'), life: 3.5 };
    sound(s, 'boss');
    s.shake = 1.2;
  }

  // Bosses
  if (s.minute >= s.nextBossMinute) {
    const id = BOSS_ORDER[s.bossIndex % BOSS_ORDER.length];
    spawnPoint(s, tmp, 60);
    const b = spawnEnemy(s, ENEMIES[id], tmp.x, tmp.y, { boss: true, tier });
    b.t1 = 3;
    s.bossIndex++;
    s.bossesAlive++;
    s.banner = { text: `${ENEMIES[id].name} ${tr('saapuu', 'arrives')}`, sub: tr('Pomo', 'Boss'), life: 3 };
    sound(s, 'boss');
    s.shake = 0.7;
    const i = BOSS_MINUTES.indexOf(s.nextBossMinute);
    s.nextBossMinute = i >= 0 && i + 1 < BOSS_MINUTES.length ? BOSS_MINUTES[i + 1] : s.nextBossMinute + 5;
  }
}

function swarm(s: SimState, kind: 'ring' | 'column' | 'circle', def: EnemyDef, count: number): void {
  const c = s.cam;
  if (kind === 'circle') {
    // The trap: a closed ring of tough enemies that keeps formation and
    // contracts on where the players stood. A gap has to be cut to get out.
    // Members ignore knockback while in formation and hold twice the HP.
    const r0 = Math.hypot(s.view.w, s.view.h) / 2 + 20;
    const n = Math.max(count, Math.ceil((2 * Math.PI * 70) / (def.radius * def.scale * 2.2)));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const e = spawnEnemy(s, def, c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0);
      e.t2 = 4;
      e.t1 = a;
      e.vx = c.x;
      e.vy = c.y;
      e.hp *= 2;
      e.maxHp = e.hp;
    }
    s.banner = { text: tr('Piiri', 'The ring'), sub: `${def.name} ${tr('sulkee renkaan. Murra se.', 'close the ring. Break through.')}`, life: 3 };
    sound(s, 'swarm');
    s.shake = 0.6;
    return;
  }
  if (kind === 'ring') {
    const r = Math.hypot(s.view.w, s.view.h) / 2 + 40;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      spawnEnemy(s, def, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
    }
    s.banner = { text: 'Räkkä', sub: `${def.name} ${tr('joka suunnasta', 'from every side')}`, life: 2.5 };
    sound(s, 'swarm');
    s.shake = 0.4;
  } else {
    // A wall crosses the screen from one side: the whole width, several
    // ranks deep, bigger and faster than the same creature in a wave. The
    // ranks are offset so the wall reads as a mass and not as a grid.
    const horizontal = s.rng.chance(0.5);
    const dir = s.rng.chance(0.5) ? 1 : -1;
    const hw = s.view.w / 2 + 40;
    const hh = s.view.h / 2 + 40;
    const across = horizontal ? hh : hw;
    const perRank = Math.max(8, Math.round((across * 2) / 16));
    const ranks = Math.max(3, Math.ceil((count * 2) / perRank));
    for (let r = 0; r < ranks; r++) {
      for (let i = 0; i < perRank; i++) {
        const along = ((i + (r % 2) * 0.5) / perRank - 0.5) * 2;
        const depth = r * 15 + (s.rng.next() - 0.5) * 6;
        let x: number;
        let y: number;
        if (horizontal) {
          x = c.x - dir * (hw + depth);
          y = c.y + along * across;
        } else {
          x = c.x + along * across;
          y = c.y - dir * (hh + depth);
        }
        const e = spawnEnemy(s, def, x, y);
        e.t2 = 3; // marching: fixed heading, see updateEnemies
        e.vx = horizontal ? dir : 0;
        e.vy = horizontal ? 0 : dir;
        e.scale *= 1.3;
        e.hp *= 1.5;
        e.maxHp = e.hp;
      }
    }
    s.banner = { text: tr('Vaellus', 'Migration'), sub: `${def.name} ${tr('tulee seinänä', 'come as a wall')}`, life: 2.5 };
    sound(s, 'swarm');
    s.shake = 0.9;
  }
}

// ---------------------------------------------------------------- enemies

function updateEnemies(s: SimState, dt: number): void {
  const es = s.enemies;
  const dmgScale = enemyDamageScale(s.minute);
  const speedScale = enemySpeedScale(s.minute);
  const farX = s.view.w / 2 + 160;
  const farY = s.view.h / 2 + 160;
  const cam = s.cam;
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
    if (!e.boss && e.def.id !== 'tuoni' && e.t2 < 3 && (Math.abs(e.x - cam.x) > farX || Math.abs(e.y - cam.y) > farY)) {
      spawnPoint(s, tmp);
      e.x = tmp.x;
      e.y = tmp.y;
      e.kx = e.ky = 0;
    }

    // The hero it is after: the nearest one standing. An attached tick
    // stays on the hero it bit.
    let h: Hero;
    if (e.t2 === 1 && e.def.behaviour === 'stick' && s.heroes[e.target].player.alive) h = s.heroes[e.target];
    else {
      h = nearestHero(s, e.x, e.y) ?? s.heroes[0];
      e.target = h.index;
    }
    const p = h.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    let speed = e.def.speed * (1 - e.slow) * (e.def.id === 'tuoni' ? 1 : speedScale);
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
        if (e.t2 === 4) break;
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

    if (e.t2 === 4) {
      // Circle: contract on the stored centre, keeping the angle, until the
      // ring is tight; then the members hunt like anyone else.
      const cx = e.vx;
      const cy = e.vy;
      const r = Math.hypot(e.x - cx, e.y - cy);
      const next = Math.max(0, r - 26 * dt);
      e.x = cx + Math.cos(e.t1) * next;
      e.y = cy + Math.sin(e.t1) * next;
      e.kx = e.ky = 0;
      e.facing = Math.cos(e.t1) < 0 ? 1 : -1;
      if (next < 70) e.t2 = 0;
      // Contact damage still applies below; skip the ordinary move.
      speed = 0;
      mx = my = 0;
    } else if (e.t2 === 3) {
      // Wall: keep heading, faster than a chaser, then die quietly far away.
      mx = e.vx;
      my = e.vy;
      speed = e.def.speed * 1.5 * (1 - e.slow);
      if (Math.abs(e.x - cam.x) > farX + 200 || Math.abs(e.y - cam.y) > farY + 200) e.hp = -1;
    }

    // Separation: push apart from a few neighbours in the same cell.
    if (e.def.behaviour !== 'phase' && e.t2 !== 1 && e.t2 !== 4) {
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

    // Contact damage, on whichever standing hero is inside reach. Usually
    // the target; the partner can walk into it too.
    const r = PLAYER_RADIUS + e.def.radius * e.scale;
    let bit: Hero | null = null;
    if (dist < r && p.alive) bit = h;
    else if (s.heroes.length > 1) {
      for (const o of s.heroes) {
        if (o === h || !o.player.alive) continue;
        if (Math.hypot(o.player.x - e.x, o.player.y - e.y) < r) bit = o;
      }
    }
    if (bit) {
      e.contact -= dt;
      if (e.contact <= 0) {
        e.contact = e.def.behaviour === 'stick' ? 0.4 : e.boss ? 1.0 : 0.55;
        bite(s, bit, e, dmgScale);
      }
    } else {
      e.contact = Math.min(e.contact, 0.1);
    }
  }
}

function bite(s: SimState, h: Hero, e: Enemy, dmgScale: number): void {
  const p = h.player;
  if (p.invuln > 0) return;
  const armor = h.stats.armor + (powerLevel(h, 'kanto') > 0 && p.still >= 1 ? 3 * powerLevel(h, 'kanto') : 0);
  let raw = e.def.damage * dmgScale * (e.elite ? 1.5 : 1);
  if (e.boss || e.elite) raw *= 1 - 0.25 * powerLevel(h, 'tapionsuoja');
  const dmg = Math.max(1, Math.round(raw - armor));
  p.hp -= dmg;
  p.hurtFlash = 0.15;
  s.run.damageTaken += dmg;
  sound(s, 'hurt');
  // Ukon suosio: the biter is struck.
  const thorns = powerLevel(h, 'ukonsuosio');
  if (thorns > 0) {
    hurt(s, h, e, 20 * thorns * h.stats.might * (1 + s.minute * 0.15), 0, 0, 0, 'ukonsuosio');
    s.effects.push({ kind: 'bolt', x: e.x, y: e.y - 200, x2: e.x, y2: e.y, life: 0.2, maxLife: 0.2, color: '#9fd3ff', radius: 12 });
  }
  // Piilopaikka: a hard hit hides the player for a moment.
  const hide = powerLevel(h, 'piilopaikka');
  if (hide > 0 && p.hideCd <= 0 && dmg >= h.stats.maxHp * 0.08) {
    p.invuln = 0.8 * hide + 0.4;
    p.hideCd = 15;
    addText(s, p.x, p.y - 16, tr('Piilossa', 'Hidden'), '#c8f0ff', true);
  }
  if (p.hp <= 0) die(s, h);
}

function die(s: SimState, h: Hero): void {
  const p = h.player;
  if (h.stats.revives > 0) {
    h.stats.revives--;
    p.hp = h.stats.maxHp;
    p.invuln = 2.5;
    s.effects.push({ kind: 'revive', x: p.x, y: p.y, x2: 0, y2: 0, life: 0.8, maxLife: 0.8, color: '#ffffff', radius: 260 });
    for (const e of s.enemies) {
      if (!e.boss && Math.hypot(e.x - p.x, e.y - p.y) < 260) hurt(s, null, e, 9999, 0, 0, 0);
    }
    s.banner = { text: tr('Lovi', 'Trance'), sub: tr('Palaat toisesta maailmasta', 'You return from the other world'), life: 2.5 };
    sound(s, 'revive');
    return;
  }
  p.hp = 0;
  p.alive = false;
  p.deadTime = 0;
  h.revive = 0;
  dropWeapons(s, h);
  if (s.heroes.every((o) => !o.player.alive)) {
    s.gameOver = true;
    sound(s, 'death');
    return;
  }
  // Co-op: the partner has three seconds beside them to bring them back.
  s.banner = { text: `${h.character.name} ${tr('kaatui', 'is down')}`, sub: tr('Seiso vierellä, niin hän nousee', 'Stand next to them to revive them'), life: 3 };
  sound(s, 'death');
}

// ---------------------------------------------------------------- deaths and drops

function drop(s: SimState, kind: PickupKind, x: number, y: number): void {
  s.pickups.push({ kind, x, y, life: kind === 'kapy' || kind === 'avain' || kind === 'kapyarkku' ? 1e9 : 90 });
}

function reap(s: SimState): void {
  const es = s.enemies;
  for (let i = es.length - 1; i >= 0; i--) {
    const e = es[i];
    if (e.hp > 0) continue;
    es[i] = es[es.length - 1];
    es.pop();
    if (e.hp === -1 && e.t2 === 3) continue; // walked off
    if (e.def.id === 'tuoni') continue;
    s.run.kills++;
    sound(s, 'kill');
    const killer = e.lastOwner >= 0 ? s.heroes[e.lastOwner] : null;
    if (killer) onKill(s, killer, e);
    if (s.effects.length < 60) s.effects.push({ kind: 'puff', x: e.x, y: e.y, x2: 0, y2: 0, life: 0.28, maxLife: 0.28, color: e.boss ? '#ffd166' : '#dfe8d8', radius: e.def.radius * e.scale * 1.6 });
    if (e.boss) {
      s.bossesAlive--;
      s.run.bosses++;
      drop(s, 'arkku', e.x, e.y);
      drop(s, 'kanttarelli', e.x + 30, e.y);
      drop(s, 'kapy', e.x - 30, e.y);
      // A boss pays in a spray of berries.
      for (let k = 0; k < 12; k++) addGem(s, e.x + (s.rng.next() - 0.5) * 80, e.y + (s.rng.next() - 0.5) * 80, Math.ceil(e.def.xp / 12));
      s.banner = { text: `${e.def.name} ${tr('kaatui', 'is defeated')}`, sub: tr('Arkku putosi', 'A chest dropped'), life: 2.5 };
      sound(s, 'bosskill');
      continue;
    }
    if (e.elite) {
      drop(s, 'arkku', e.x, e.y);
      // One elite in four carries a key to the käpyarkku.
      if (s.rng.chance(0.25)) drop(s, 'avain', e.x + 24, e.y + 10);
      addGem(s, e.x, e.y, e.def.xp * 3);
      continue;
    }
    addGem(s, e.x, e.y, e.def.xp);
    // Luck of the hero who made the kill; the run's first hero when a
    // pickup did.
    const luck = (killer ?? s.heroes[0]).stats.luck;
    const r = s.rng.next();
    if (r < 1 / 1500) drop(s, 'kapy', e.x, e.y);
    else if (r < 1 / 1500 + 0.006 * luck) drop(s, 'kanttarelli', e.x, e.y);
    else if (r < 1 / 1500 + 0.0085 * luck) drop(s, 'lakka', e.x, e.y);
    else if (r < 1 / 1500 + 0.0097 * luck) drop(s, 'kekale', e.x, e.y);
  }
}

/** Taiat that fire on a kill: Kalman kosketus, Tulikaste, Elonkorjuu. */
function onKill(s: SimState, h: Hero, e: Enemy): void {
  // No chain: a creature killed by a blast does not blast. The blast is a
  // share of the creature's own base HP at this minute, so an elite's nine
  // times HP does not clear the screen.
  const boom = powerLevel(h, 'kalmankosketus');
  if (boom > 0 && !e.boss && e.lastSource !== 'kalmankosketus') {
    const r = 26 + e.def.radius * e.scale;
    const dmg = e.def.hp * enemyHpScale(s.minute, s.curse) * 0.08 * boom;
    s.grid.query(e.x, e.y, r, (o) => {
      if (o === e || o.hp <= 0) return;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      if (dx * dx + dy * dy > r * r) return;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      hurt(s, h, o, dmg, dx / d, dy / d, 10, 'kalmankosketus');
    });
    if (s.effects.length < 60) s.effects.push({ kind: 'burst', x: e.x, y: e.y, x2: 0, y2: 0, life: 0.25, maxLife: 0.25, color: '#b8a0ff', radius: r });
  }
  const fire = powerLevel(h, 'tulikaste');
  if (fire > 0 && s.rng.chance(0.06 * fire) && s.zones.length < 40) {
    s.zones.push({ kind: 'fire', weapon: 'tulikaste', owner: h.index, x: e.x, y: e.y, radius: 26, life: 2.2, maxLife: 2.2, damage: 4 * h.stats.might * (1 + s.minute * 0.15), tick: 0.5, timer: 0, followPlayer: false, slow: 0, knockback: 0, heal: 0, angle: 0, halfWidth: 0, hit: new Set(), tint: '#ff8a3d' });
  }
  const harvest = powerLevel(h, 'elonkorjuu');
  if (harvest > 0) {
    h.player.harvest++;
    if (h.player.harvest >= (harvest >= 2 ? 100 : 150)) {
      h.player.harvest = 0;
      drop(s, 'kanttarelli', h.player.x + 20, h.player.y);
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

/** Berries feed every standing hero: one screen, one harvest. */
function gainXp(s: SimState, v: number): void {
  for (const h of s.heroes) {
    if (!h.player.alive) continue;
    const p = h.player;
    p.xp += v * h.stats.growth * coopXp(s);
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = xpForLevel(p.level);
      h.pendingLevelUps++;
      sound(s, 'levelup');
      s.effects.push({ kind: 'levelup', x: p.x, y: p.y, x2: 0, y2: 0, life: 0.6, maxLife: 0.6, color: '#f0b830', radius: 90 });
      s.run.maxLevel = Math.max(s.run.maxLevel, p.level);
    }
  }
}

function updateGems(s: SimState, dt: number): void {
  const gs = s.gems;
  for (let i = gs.length - 1; i >= 0; i--) {
    const g = gs[i];
    const h = nearestHero(s, g.x, g.y);
    if (!h) return;
    const p = h.player;
    const mr = BASE_MAGNET * h.stats.magnet;
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    const d2 = dx * dx + dy * dy;
    if (!g.pull && d2 < mr * mr) g.pull = true;
    if (g.pull) {
      const d = Math.sqrt(d2) || 1;
      const sp = 380 + (mr - Math.min(d, mr)) * 3;
      g.x += (dx / d) * sp * dt;
      g.y += (dy / d) * sp * dt;
      if (d < 12) {
        gainXp(s, g.value);
        sound(s, 'gem');
        const nl = powerLevel(h, 'nakinlahja');
        if (nl > 0 && p.hp < h.stats.maxHp) p.hp = Math.min(h.stats.maxHp, p.hp + 0.6 * nl);
        gs[i] = gs[gs.length - 1];
        gs.pop();
      }
    }
  }
}

function updatePickups(s: SimState, dt: number): void {
  const ps = s.pickups;
  for (let i = ps.length - 1; i >= 0; i--) {
    const k = ps[i];
    k.life -= dt;
    let taker: Hero | null = null;
    for (const h of s.heroes) {
      if (!h.player.alive) continue;
      if (Math.hypot(h.player.x - k.x, h.player.y - k.y) < PLAYER_RADIUS + 14) {
        taker = h;
        break;
      }
    }
    if (taker) {
      if (!collect(s, taker, k.kind, k.x, k.y)) continue;
      ps[i] = ps[ps.length - 1];
      ps.pop();
    } else if (k.life <= 0) {
      ps[i] = ps[ps.length - 1];
      ps.pop();
    }
  }
}

/** Apply a pickup to the hero who walked on it. Returns false when it stays on the ground (a locked chest). */
function collect(s: SimState, h: Hero, kind: PickupKind, x: number, y: number): boolean {
  switch (kind) {
    case 'kanttarelli':
      healPlayer(s, h, 30);
      sound(s, 'pickup');
      break;
    case 'lakka':
      for (const g of s.gems) g.pull = true;
      addText(s, x, y, tr('Lakka! Marjat lentävät', 'Cloudberry! The berries fly to you'), '#ffb347', true);
      sound(s, 'pickup');
      break;
    case 'kekale':
      for (const e of s.enemies) if (!e.boss && e.def.id !== 'tuoni' && onScreen(s, e.x, e.y, 40)) hurt(s, null, e, 9999, 0, 0, 0, 'kekale');
      s.effects.push({ kind: 'burst', x, y, x2: 0, y2: 0, life: 0.5, maxLife: 0.5, color: '#ff8a3d', radius: 400 });
      sound(s, 'ember');
      break;
    case 'arkku':
      s.pendingChests.push(h.index);
      break;
    case 'kapy':
      s.run.cones++;
      addText(s, x, y, tr('+1 käpy', '+1 cone'), '#c9a46c', true);
      sound(s, 'pickup');
      break;
    case 'avain':
      s.run.keys++;
      addText(s, x, y, tr('Avain! Etsi käpyarkku', 'A key! Find the cone chest'), '#e8c060', true);
      sound(s, 'pickup');
      break;
    case 'kapyarkku':
      if (s.run.keys <= 0) {
        if (s.lockHint <= 0) {
          s.lockHint = 2;
          addText(s, x, y - 14, tr('Lukossa. Etsi avain', 'Locked. Find the key'), '#e8c060', true);
        }
        return false;
      }
      s.run.keys--;
      s.run.cones += 5;
      s.pendingChests.push(h.index);
      addText(s, x, y, tr('+5 käpyä', '+5 cones'), '#c9a46c', true);
      s.effects.push({ kind: 'burst', x, y, x2: 0, y2: 0, life: 0.6, maxLife: 0.6, color: '#e8c060', radius: 60 });
      sound(s, 'chestbig');
      break;
    case 'kahvi':
      break;
  }
  return true;
}
