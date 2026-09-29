/** Player-wide stats after character base and passives are applied. */
export interface Stats {
  maxHp: number;
  regen: number; // hp per second
  armor: number; // flat reduction per hit
  moveSpeed: number; // multiplier
  might: number; // damage multiplier
  area: number; // size multiplier
  speed: number; // projectile speed multiplier
  duration: number; // multiplier
  cooldown: number; // multiplier, lower is faster
  amount: number; // extra projectiles
  magnet: number; // pickup radius multiplier
  luck: number; // multiplier
  growth: number; // xp multiplier
  curse: number; // enemy count and hp multiplier
  revives: number;
  reroll: number; // level-up rerolls remaining
}

export type Behaviour = 'chase' | 'swarm' | 'dash' | 'stick' | 'phase' | 'boss';

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  radius: number;
  /** 0 = full knockback, 1 = immune */
  kbResist: number;
  behaviour: Behaviour;
  /** Sprite key. Several defs may share one. */
  sprite: string;
  scale: number;
}

export interface Enemy {
  id: number;
  def: EnemyDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  elite: boolean;
  boss: boolean;
  scale: number;
  /** seconds of white flash left after a hit */
  flash: number;
  /** slow factor 0..1 applied to speed, and its remaining time */
  slow: number;
  slowTime: number;
  /** knockback velocity, decays */
  kx: number;
  ky: number;
  /** per-behaviour timers */
  t1: number;
  t2: number;
  /** contact damage timer */
  contact: number;
  facing: number; // -1 or 1
  wobble: number;
  /** what hit it last, so a kill by a blast does not blast again */
  lastSource: string;
  /** index of the hero behind the last hit, -1 for none */
  lastOwner: number;
  /** index of the hero it is after this step */
  target: number;
}

export type ProjectileKind =
  | 'blade'
  | 'arrow'
  | 'axe'
  | 'stone'
  | 'wind'
  | 'ring'
  | 'orbit'
  | 'bolt'
  | 'spark'
  | 'spirit';

export interface Projectile {
  kind: ProjectileKind;
  weapon: string;
  /** index of the hero who fired it */
  owner: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  life: number;
  maxLife: number;
  pierce: number; // hits remaining, Infinity for unlimited
  knockback: number;
  hit: Set<number>; // enemy ids hit already
  rot: number;
  spin: number;
  /** gravity for lobbed things, in units/s^2 */
  gravity: number;
  /** ring: growth per second. orbit: angle offset */
  grow: number;
  angle: number;
  orbitRadius: number;
  /** on expiry, spawn a zone of this kind */
  explode?: ZoneKind;
  explodeRadius: number;
  slow: number;
  bounce: boolean;
  homing: boolean;
  /** heal player by this much per hit */
  heal: number;
  tint: string;
}

export type ZoneKind = 'fire' | 'aura' | 'steam' | 'net' | 'frost' | 'song' | 'sweep';

export interface Zone {
  kind: ZoneKind;
  weapon: string;
  /** index of the hero it belongs to, -1 for a taika fire from a kill */
  owner: number;
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  damage: number; // per tick
  tick: number; // seconds between ticks
  timer: number;
  followPlayer: boolean;
  slow: number; // 0 = none
  knockback: number;
  heal: number;
  /** sweep: arc from angle-halfWidth to angle+halfWidth, hits once */
  angle: number;
  halfWidth: number;
  hit: Set<number>;
  tint: string;
}

export type PickupKind = 'kanttarelli' | 'lakka' | 'kekale' | 'arkku' | 'kahvi' | 'kapy' | 'avain' | 'kapyarkku';

export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  life: number;
}

export interface Gem {
  x: number;
  y: number;
  value: number;
  /** flying to player */
  pull: boolean;
}

export interface WeaponState {
  id: string;
  level: number;
  cooldown: number; // time left
  burst: number; // shots left in burst
  burstTimer: number;
  side: number; // alternating swing side
  /** orbit weapons keep their projectiles here so they can be refreshed */
  active: number;
}

export interface PassiveState {
  id: string;
  level: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
  big: boolean;
}

export interface Effect {
  kind: 'bolt' | 'burst' | 'levelup' | 'chest' | 'revive' | 'puff';
  x: number;
  y: number;
  x2: number;
  y2: number;
  life: number;
  maxLife: number;
  color: string;
  radius: number;
}

export interface Input {
  dx: number;
  dy: number;
}

export interface RunStats {
  kills: number;
  damageDealt: number;
  damageTaken: number;
  chests: number;
  bosses: number;
  maxLevel: number;
  cones: number;
  /** keys held, for the locked käpyarkku */
  keys: number;
  /** damage dealt per source: a weapon id, or a taika or pickup name */
  damageBy: Record<string, number>;
}
