import { Rng } from './rng';
import { BASE_STATS, type Stats } from './stats';
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
  player: Player;
  stats: Stats;
  weapons: WeaponState[];
  passives: PassiveState[];
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
  pendingLevelUps: number;
  pendingChests: number;
  banner: Banner | null;
  run: RunStats;
  gameOver: boolean;
  /** endless tier once the authored waves run out */
  tier: number;
}

export function xpForLevel(level: number): number {
  // Level 1 -> 2 needs 5. Each level adds 10 until 20, 13 until 40, then 16.
  if (level < 20) return 5 + 10 * (level - 1);
  if (level < 40) return 195 + 13 * (level - 19);
  return 455 + 16 * (level - 39);
}

export function createState(seed: number, character: CharacterDef): SimState {
  const s: SimState = {
    seed,
    rng: new Rng(seed),
    time: 0,
    minute: 0,
    character,
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
    },
    stats: { ...BASE_STATS },
    weapons: [{ id: character.weapon, level: 1, cooldown: 0.3, burst: 0, burstTimer: 0, side: 1, active: 0 }],
    passives: [],
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
    pendingLevelUps: 0,
    pendingChests: 0,
    banner: null,
    run: { kills: 0, damageDealt: 0, damageTaken: 0, chests: 0, bosses: 0, maxLevel: 1 },
    gameOver: false,
    tier: 0,
  };
  return s;
}
