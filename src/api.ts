/**
 * The global records API: one Lambda behind an HTTP API (infra/records.tf).
 * Names are three characters like a pinball table. Every call is best
 * effort: the game never waits on it and the local records stay the
 * fallback when the network is away.
 */
import { tr } from './i18n';

export const RECORDS_API = 'https://qsp5ltmjrg.execute-api.eu-north-1.amazonaws.com';
/** GET /board through CloudFront, cached a minute: what every leaderboard view reads. */
export const BOARD_URL = 'https://d1x53tebijcunt.cloudfront.net/board';

export type Period = 'day' | 'week' | 'month' | 'all';

export interface TopEntry {
  name: string;
  character: string;
  time: number;
  level: number;
  kills: number;
  bosses: number;
  at: string;
  /** weapon ids in the build, and the one that dealt the most; absent on old rows */
  weapons?: string[];
  top?: string;
}

export const PERIOD_LABELS: Record<Period, () => string> = {
  day: () => tr('Tänään', 'Today'),
  week: () => tr('Viikko', 'Week'),
  month: () => tr('Kuukausi', 'Month'),
  all: () => tr('Kaikki', 'All time'),
};

export interface Board {
  top: TopEntry[];
  /** runs per survival second in the period, for ranks on the device */
  hist: Record<string, number>;
  /** when the server built this answer; the cache can hold it a minute */
  updated: string;
}

export async function fetchBoard(period: Period): Promise<Board> {
  const r = await fetch(`${BOARD_URL}?period=${period}`);
  if (!r.ok) throw new Error(`board ${r.status}`);
  const j = (await r.json()) as Board;
  // The API orders by time; equal times go to the run with more kills.
  j.top.sort((a, b) => b.time - a.time || b.kills - a.kills || b.level - a.level);
  return j;
}

/** The rank a survival time holds in a board: 1 + the runs that lasted longer. */
export function rankIn(board: Board, time: number): number {
  const t = Math.floor(time);
  let above = 0;
  for (const [sec, n] of Object.entries(board.hist)) if (Number(sec) > t) above += n;
  return above + 1;
}

export async function submitScore(s: { name: string; character: string; time: number; level: number; kills: number; bosses: number; weapons: string[]; top: string | null }): Promise<Record<Period, number>> {
  const r = await fetch(`${RECORDS_API}/scores`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...s, time: Math.floor(s.time) }),
  });
  if (!r.ok) throw new Error(`scores ${r.status}`);
  const j = (await r.json()) as { ranks: Record<Period, number> };
  return j.ranks;
}

const NAME_KEY = 'rakka.initials';
export function loadInitials(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
export function saveInitials(n: string): void {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* fine */
  }
}
