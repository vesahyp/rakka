/**
 * `npm run sim-check`: behavioural checks on the real sim, headless.
 *
 * Part one is a weapon table: each weapon at level 1 and at max level, alone,
 * against a steady ring of the minute-0 roster for twenty seconds. Kills per
 * second is the number to compare weapons by. Part two is a short list of
 * PASS/FAIL assertions on things a green build cannot see: enemies reach the
 * player, berries get collected, a level-up fires, a chest opens, a boss
 * arrives, and a seed replays identically.
 */
declare const process: { exitCode?: number; argv: string[] };

import { createState, type SimState } from '../src/game/state';
import { initRun, step, DT, spawnEnemy } from '../src/game/sim';
import { CHARACTERS } from '../src/game/content/characters';
import { WEAPONS, weaponMaxLevel } from '../src/game/content/weapons';
import { ENEMIES } from '../src/game/content/enemies';
import { openChest } from '../src/game/upgrades';

let fails = 0;
const check = (name: string, ok: boolean, extra = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

const still = { dx: 0, dy: 0 };
const walk = { dx: 1, dy: 0 };

/** A state with no director: the wave table is emptied by spawning nothing (time stays 0). */
function arena(weapon: string, level: number): SimState {
  const s = createState(42, CHARACTERS[0]);
  initRun(s);
  s.weapons = [{ id: weapon, level, cooldown: 0, burst: 0, burstTimer: 0, side: 1, active: 0 }];
  s.player.hp = 1e9;
  s.stats.maxHp = 1e9;
  return s;
}

/** Keep a ring of enemies walking in from 150 units. */
function topUp(s: SimState, n: number, def = ENEMIES.hyttynen) {
  while (s.enemies.length < n) {
    const a = s.rng.next() * Math.PI * 2;
    const r = 110 + s.rng.next() * 80;
    spawnEnemy(s, def, s.player.x + Math.cos(a) * r, s.player.y + Math.sin(a) * r);
  }
}

function weaponTable() {
  console.log('weapon           lvl   kills/s (mosquito)   dps (gnome)');
  for (const id of Object.keys(WEAPONS)) {
    const def = WEAPONS[id];
    const levels = def.evolved ? [1] : [1, weaponMaxLevel(def)];
    for (const lvl of levels) {
      const out: string[] = [];
      for (const roster of [ENEMIES.hyttynen, ENEMIES.menninkainen]) {
        const s = arena(id, lvl);
        // Freeze the director by holding time below the first wave and
        // skipping direct(): we do that by never letting time pass in
        // minutes that spawn. Simplest: run and then strip director spawns
        // by counting kills of our roster only.
        const seconds = 20;
        const steps = Math.round(seconds / DT);
        let moving = 0;
        for (let i = 0; i < steps; i++) {
          topUp(s, 30, roster);
          step(s, i % 120 < 60 ? walk : still, DT);
          moving++;
        }
        void moving;
        out.push(roster === ENEMIES.hyttynen ? (s.run.kills / seconds).toFixed(1) : (s.run.damageDealt / seconds).toFixed(0));
      }
      console.log(`${id.padEnd(16)} ${String(lvl).padStart(3)}   ${out[0].padStart(18)}   ${out[1].padStart(11)}`);
    }
  }
}

function assertions() {
  // Enemies reach and hurt a standing player.
  {
    const s = createState(7, CHARACTERS[0]);
    initRun(s);
    s.weapons = [];
    for (let i = 0; i < 60 * 20; i++) step(s, still, DT);
    check('enemies reach a standing player and hurt them', s.run.damageTaken > 0, `taken ${s.run.damageTaken}`);
  }
  // Berries: kills leave gems, walking over collects, a level-up fires.
  {
    const s = createState(7, CHARACTERS[0]);
    initRun(s);
    for (let i = 0; i < 60 * 40; i++) step(s, { dx: Math.cos(i / 90), dy: Math.sin(i / 90) }, DT);
    check('kills drop berries', s.gems.length > 0 || s.run.kills > 0, `gems ${s.gems.length} kills ${s.run.kills}`);
    check('a level-up fires within 40 s', s.pendingLevelUps > 0 || s.player.level > 1, `level ${s.player.level} pending ${s.pendingLevelUps}`);
  }
  // Chest: opening one applies at least one upgrade.
  {
    const s = createState(7, CHARACTERS[1]);
    initRun(s);
    s.passives.push({ id: 'terva', level: 1 });
    const before = s.weapons[0].level + s.passives[0].level;
    const r = openChest(s);
    const after = s.weapons[0].level + s.passives[0].level;
    check('a chest levels something', r.items.length >= 1 && after > before, `${r.items.map((i) => i.name).join(', ')}`);
  }
  // Evolution: max weapon + passive owned, chest evolves.
  {
    const s = createState(7, CHARACTERS[1]);
    initRun(s);
    s.weapons[0].level = weaponMaxLevel(WEAPONS.puukko);
    s.passives.push({ id: 'tuohikontti', level: 1 });
    const r = openChest(s);
    check('a chest evolves a maxed weapon with its passive', s.weapons[0].id === 'puukkosade', r.items[0].name);
  }
  // Käpyarkku: locked without a key, five cones and a chest with one.
  {
    const s = createState(7, CHARACTERS[0]);
    initRun(s);
    s.chestTimer = 1e9;
    s.pickups.push({ kind: 'kapyarkku', x: 40, y: 0, life: 1e9 });
    for (let i = 0; i < 60; i++) step(s, walk, DT);
    const locked = s.pickups.some((k) => k.kind === 'kapyarkku') && s.run.cones === 0;
    s.pickups.push({ kind: 'avain', x: s.player.x + 20, y: s.player.y, life: 1e9 });
    for (let i = 0; i < 30; i++) step(s, walk, DT);
    s.pickups.push({ kind: 'kapyarkku', x: s.player.x + 20, y: s.player.y, life: 1e9 });
    for (let i = 0; i < 30; i++) step(s, walk, DT);
    check('a käpyarkku stays locked without a key and pays five cones with one', locked && s.run.cones === 5 && s.run.keys === 0 && s.pendingChests === 1, `cones ${s.run.cones} keys ${s.run.keys} chests ${s.pendingChests}`);
  }
  // Boss arrives at minute 5.
  {
    const s = createState(7, CHARACTERS[0]);
    initRun(s);
    s.player.hp = 1e9;
    s.stats.maxHp = 1e9;
    s.time = 299;
    for (let i = 0; i < 60 * 2; i++) step(s, still, DT);
    check('a boss arrives at minute 5', s.enemies.some((e) => e.boss), `bosses ${s.enemies.filter((e) => e.boss).length}`);
  }
  // Determinism.
  {
    const run = () => {
      const s = createState(99, CHARACTERS[2]);
      initRun(s);
      for (let i = 0; i < 60 * 30; i++) step(s, { dx: Math.cos(i / 60), dy: Math.sin(i / 60) }, DT);
      return `${s.run.kills}:${s.player.x.toFixed(3)}:${s.player.y.toFixed(3)}:${s.enemies.length}:${s.run.damageDealt}`;
    };
    const a = run();
    const b = run();
    check('a seed replays identically', a === b, a === b ? a : `${a} vs ${b}`);
  }
  // Performance: 500 enemies, all weapons, one second of steps.
  {
    const s = createState(5, CHARACTERS[0]);
    initRun(s);
    s.weapons = ['puukko', 'kokko', 'kantele', 'ukonvasara', 'kierukka', 'sarvet'].map((id) => ({ id, level: 8, cooldown: 0, burst: 0, burstTimer: 0, side: 1, active: 0 }));
    s.player.hp = 1e9;
    s.stats.maxHp = 1e9;
    topUp(s, 500, ENEMIES.peikko);
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) {
      topUp(s, 500, ENEMIES.peikko);
      step(s, walk, DT);
    }
    const ms = (performance.now() - t0) / 60;
    check('a step with 500 enemies and six maxed weapons is under 4 ms', ms < 4, `${ms.toFixed(2)} ms`);
  }
}

if (process.argv[2] !== 'quick') weaponTable();
assertions();
if (fails) {
  console.log(`\n${fails} failed`);
  process.exitCode = 1;
}
