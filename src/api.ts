/**
 * The global records API: one Lambda behind an HTTP API (infra/records.tf).
 * Names are three characters like a pinball table. Every call is best
 * effort: the game never waits on it and the local records stay the
 * fallback when the network is away.
 */
export const RECORDS_API = 'https://qsp5ltmjrg.execute-api.eu-north-1.amazonaws.com';

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

export const PERIOD_LABELS: Record<Period, string> = { day: 'Tänään', week: 'Viikko', month: 'Kuukausi', all: 'Kaikki' };

export async function fetchTop(period: Period, limit = 25): Promise<TopEntry[]> {
  const r = await fetch(`${RECORDS_API}/top?period=${period}&limit=${limit}`);
  if (!r.ok) throw new Error(`top ${r.status}`);
  const j = (await r.json()) as { top: TopEntry[] };
  // The API orders by time; equal times go to the run with more kills.
  return j.top.sort((a, b) => b.time - a.time || b.kills - a.kills || b.level - a.level);
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
