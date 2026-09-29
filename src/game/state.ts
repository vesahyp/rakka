import { Rng } from './rng';
import { BASE_STATS, type Stats, type StatDelta } from './stats';
import type { CharacterDef } from './content/characters';
import type { Enemy, Projectile, Zone, Gem, Pickup, WeaponState, PassiveState, FloatText, Effect, RunStats } from './types';
import { Grid } from './grid';

export interface Player {
  x: number;
  y: number;
  hp: number;
  /** last non-zero move direction */
  dirX: number;
  dirY: number;
  facing: number;
  moving: boolean;
  invuln: number;
  level: number;
  xp: number;
  xpNext: number;
  alive: boolean;
  /** seconds since death, for the death animation */
  deadTime: number;
  hurtFlash: number;
  /** seconds standing still (kanto) */
  still: number;
  /** piilopaikka cooldown left */
  hideCd: number;
  /** kills since the last elonkorjuu drop */
  harvest: number;
}

/**
 * One hero: a character, a body in the forest and a build. A solo run has
 * one; local co-op has two, sharing the enemies, the berries and the
 * camera, each with their own weapons, items, taiat and level.
 */
export interface Hero {
  /** 0 or 1: the input slot, the colour ring, the HUD side */
  index: number;
  character: CharacterDef;
  player: Player;
  stats: Stats;
  weapons: WeaponState[];
  passives: PassiveState[];
  powers: PassiveState[];
  pendingLevelUps: number;
  /** co-op: seconds a living hero has stood beside this fallen one */
  revive: number;
}

export interface Banner {
  text: string;
  sub: string;
  life: number;
}

export interface SimState {
  seed: number;
  rng: Rng;
  time: number;
  minute: number;
  heroes: Hero[];
  /** permanent bonuses from the altar, applied like character traits */
  meta: StatDelta;
  /** the camera: the living heroes' midpoint. Spawns and "on screen" use it. */
  cam: { x: number; y: number };
  /** the strongest curse among living heroes, for the director */
  curse: number;
  enemies: Enemy[];
  projectiles: Projectile[];
  zones: Zone[];
  gems: Gem[];
  pickups: Pickup[];
  texts: FloatText[];
  effects: Effect[];
  grid: Grid;
  /** world units visible; set by the renderer from the canvas aspect */
  view: { w: number; h: number };
  nextId: number;
  spawnAcc: Record<string, number>;
  eventIndex: number;
  bossIndex: number;
  nextBossMinute: number;
  bossesAlive: number;
  lastElite: number;
  /** chests waiting to be opened, as the index of the hero who picked each up */
  pendingChests: number[];
  banner: Banner | null;
  run: RunStats;
  gameOver: boolean;
  /** endless tier once the authored waves run out */
  tier: number;
  /** sound names queued by the sim this frame; the UI drains and plays them */
  sounds: string[];
  /** screen shake left, seconds */
  shake: number;
  /** how many Tuoni have been sent */
  tuoni: number;
  /** seconds until a cone falls from a tree */
  coneTimer: number;
  /** seconds until the next locked käpyarkku is set down, with its key elsewhere */
  chestTimer: number;
  /** seconds until the locked chest may say again that it is locked */
  lockHint: number;
  /** mushrooms eaten, by cell key, so the renderer leaves them out */
  eaten: Set<number>;
  /** seconds of hallucination left */
  trip: number;
}

export function xpForLevel(level: number): number {
  // Level 1 -> 2 needs 8. Each level adds 15 until 20, 20 until 40, 40
  // until 80, then 70: the pool is picked clean around level a hundred and
  // a level past that should be rare.
  if (level < 20) return 8 + 15 * (level - 1);
  if (level < 40) return 293 + 20 * (level - 19);
  if (level < 80) return 693 + 40 * (level - 39);
  return 2293 + 70 * (level - 79);
}

function createHero(index: number, character: CharacterDef, count: number): Hero {
  return {
    index,
    character,
    player: {
      // Two heroes start a step apart, side by side.
      x: count > 1 ? (index === 0 ? -20 : 20) : 0,
      y: 0,
      hp: 100,
      dirX: 1,
      dirY: 0,
      facing: 1,
      moving: false,
      invuln: 0,
      level: 1,
      xp: 0,
      xpNext: xpForLevel(1),
      alive: true,
      deadTime: 0,
      hurtFlash: 0,
      still: 0,
      hideCd: 0,
      harvest: 0,
    },
    stats: { ...BASE_STATS },
    weapons: [{ id: character.weapon, level: 1, cooldown: 0.3, burst: 0, burstTimer: 0, side: 1, active: 0 }],
    passives: [],
    powers: [],
    pendingLevelUps: 0,
    revive: 0,
  };
}

export function createState(seed: number, characters: CharacterDef | CharacterDef[], meta: StatDelta = {}): SimState {
  const chars = Array.isArray(characters) ? characters : [characters];
  const s: SimState = {
    seed,
    rng: new Rng(seed),
    time: 0,
    minute: 0,
    heroes: chars.map((c, i) => createHero(i, c, chars.length)),
    meta,
    cam: { x: 0, y: 0 },
    curse: 1,
    enemies: [],
    projectiles: [],
    zones: [],
    gems: [],
    pickups: [],
    texts: [],
    effects: [],
    grid: new Grid(48),
    view: { w: 420, h: 760 },
    nextId: 1,
    spawnAcc: {},
    eventIndex: 0,
    bossIndex: 0,
    nextBossMinute: 5,
    bossesAlive: 0,
    lastElite: 0,
    pendingChests: [],
    banner: null,
    run: { kills: 0, damageDealt: 0, damageTaken: 0, chests: 0, bosses: 0, maxLevel: 1, cones: 0, keys: 0, damageBy: {} },
    gameOver: false,
    tier: 0,
    sounds: [],
    shake: 0,
    tuoni: 0,
    coneTimer: 240,
    chestTimer: 150,
    lockHint: 0,
    eaten: new Set(),
    trip: 0,
  };
  return s;
}

/** Heroes still standing. */
export function alive(s: SimState): Hero[] {
  return s.heroes.filter((h) => h.player.alive);
}

/** The living hero nearest a point, or null when all are down. */
export function nearestHero(s: SimState, x: number, y: number): Hero | null {
  let best: Hero | null = null;
  let bd = Infinity;
  for (const h of s.heroes) {
    if (!h.player.alive) continue;
    const dx = h.player.x - x;
    const dy = h.player.y - y;
    const d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      best = h;
    }
  }
  return best;
}
