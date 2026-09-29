/**
 * `npm run balance [minutes] [runs] [character|a+b]`: play many bot runs and
 * print a table. `a+b` plays that pair in co-op.
 * The bot is weak on purpose (see autoplayer.ts), so read the numbers as a
 * floor: a run the bot survives for ten minutes is easy for a human.
 */
declare const process: { argv: string[]; exitCode?: number };

import { createState } from '../src/game/state';
import { initRun } from '../src/game/sim';
import { CHARACTERS } from '../src/game/content/characters';
import { playRun, type RunReport } from './autoplayer';

const maxMinutes = Number(process.argv[2] ?? 20);
const runs = Number(process.argv[3] ?? 2);
const only = process.argv[4];

const reports: RunReport[] = [];
// "vaino+aino" plays the pair in co-op: two bots, one screen.
const pair = only && only.includes('+') ? only.split('+').map((id) => CHARACTERS.find((c) => c.id === id)!) : null;
for (const c of pair ? [pair] : CHARACTERS) {
  if (!pair && only && (c as (typeof CHARACTERS)[number]).id !== only) continue;
  for (let i = 0; i < runs; i++) {
    const s = createState(1000 + i * 7919 + (pair ? 3 : (c as (typeof CHARACTERS)[number]).id.length), c);
    initRun(s);
    reports.push(playRun(s, maxMinutes, { weaponBias: 0.5 + (i % 2) * 0.2 }));
  }
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
console.log('char          time   lvl  kills chests boss  taken  dealt   maxE  ms/min  killer');
for (const r of reports) {
  console.log(
    `${r.character.padEnd(13)} ${fmt(r.time).padStart(5)}  ${String(r.level).padStart(3)}  ${String(r.kills).padStart(5)}  ${String(r.chests).padStart(4)}  ${String(r.bosses).padStart(3)}  ${String(r.dmgTaken).padStart(5)}  ${String(Math.round(r.dmgDealt / 1000) + 'k').padStart(6)}  ${String(r.maxEnemies).padStart(4)}  ${r.msPerMinute.toFixed(0).padStart(5)}  ${r.killer}`,
  );
  console.log(`              ${r.weapons}  |  ${r.passives}`);
}
const avg = reports.reduce((a, r) => a + r.time, 0) / reports.length;
const survived = reports.filter((r) => r.time >= maxMinutes * 60).length;
console.log(`\navg ${fmt(avg)}  survived ${survived}/${reports.length}`);
