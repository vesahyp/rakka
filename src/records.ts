/**
 * Local records. One JSON blob in localStorage: every finished run's summary
 * is folded into a top-ten list, per-character bests and lifetime totals.
 * Nothing leaves the device. A global table is a later slice (ROADMAP).
 */
import type { CharacterDef } from './game/content/characters';

export interface RunRecord {
  character: string;
  time: number;
  level: number;
  kills: number;
  bosses: number;
  chests: number;
  date: string;
  weapons: string[];
}

export interface Records {
  runs: number;
  best: RunRecord[];
  perChar: Record<string, { time: number; level: number; kills: number }>;
  totalKills: number;
  totalTime: number;
}

const KEY = 'rakka.records.v1';

export function loadRecords(): Records {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { runs: 0, best: [], perChar: {}, totalKills: 0, totalTime: 0, ...JSON.parse(raw) };
  } catch {
    /* private mode or blocked storage: play without records */
  }
  return { runs: 0, best: [], perChar: {}, totalKills: 0, totalTime: 0 };
}

export function saveRun(r: RunRecord): { records: Records; rank: number; charBest: boolean } {
  const rec = loadRecords();
  rec.runs++;
  rec.totalKills += r.kills;
  rec.totalTime += r.time;
  rec.best.push(r);
  rec.best.sort((a, b) => b.time - a.time || b.level - a.level);
  const rank = rec.best.indexOf(r);
  rec.best = rec.best.slice(0, 10);
  const pc = rec.perChar[r.character] ?? { time: 0, level: 0, kills: 0 };
  const charBest = r.time > pc.time;
  rec.perChar[r.character] = { time: Math.max(pc.time, r.time), level: Math.max(pc.level, r.level), kills: Math.max(pc.kills, r.kills) };
  try {
    localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* see loadRecords */
  }
  return { records: rec, rank: rank < 10 ? rank : -1, charBest };
}

export function isUnlocked(c: CharacterDef, rec: Records): boolean {
  if (!c.unlock) return true;
  const u = c.unlock;
  switch (u.kind) {
    case 'runs':
      return rec.runs >= u.value;
    case 'survive':
      return Object.values(rec.perChar).some((p) => p.time >= u.value);
    case 'kills':
      return Object.values(rec.perChar).some((p) => p.kills >= u.value);
    case 'level':
      return Object.values(rec.perChar).some((p) => p.level >= u.value);
  }
}

export function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function track(event: string, data: Record<string, unknown> = {}): void {
  const w = window as unknown as { __clvtracker?: { track?: (e: string, d: Record<string, unknown>) => void } };
  try {
    w.__clvtracker?.track?.(event, data);
  } catch {
    /* tracker is optional */
  }
}
