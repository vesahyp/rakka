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
  character: CharacterDef;
  /** permanent bonuses from the altar, applied like character traits */
  meta: StatDelta;
  player: Player;
  stats: Stats;
  weapons: WeaponState[];
  passives: PassiveState[];
  powers: PassiveState[];
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
  pendingLevelUps: number;
  pendingChests: number;
  banner: Banner | null;
  run: RunStats;
  gameOver: boolean;
  /** endless tier once the authored waves run out */
  tier: number;
  /** sound names queued by the sim this frame; the UI drains and plays them */
  sounds: string[];
  /** screen shake left, seconds */
  shake: number;
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

export function createState(seed: number, character: CharacterDef, meta: StatDelta = {}): SimState {
  const s: SimState = {
    seed,
    rng: new Rng(seed),
    time: 0,
    minute: 0,
    character,
    meta,
    player: {
      x: 0,
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
    pendingLevelUps: 0,
    pendingChests: 0,
    banner: null,
    run: { kills: 0, damageDealt: 0, damageTaken: 0, chests: 0, bosses: 0, maxLevel: 1 },
    gameOver: false,
    tier: 0,
    sounds: [],
    shake: 0,
  };
  return s;
}
