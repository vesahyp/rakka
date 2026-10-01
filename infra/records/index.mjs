// Räkkä records API. One Lambda:
//   POST /scores        {name, character, time, level, kills, bosses}
//   GET  /board?period=day|week|month|all   the top 25 and the histogram;
//        the game reads it through CloudFront, cached for a minute
//   GET  /top?period=...&limit=20      older clients
//   GET  /rank?period=...&time=1234    older clients: the rank a time would hold
// Names are three characters, A-Z and 0-9, like a pinball machine. Periods
// are counted in Europe/Helsinki. The table has one item per run and four
// indexes keyed by period value and sorted by survival time, so a top list
// is one Query.
//
// Ranks come from a histogram, one item per period value (`hist#day#2026-10-01`)
// with one counter per survival second (`s754`), raised with ADD on every
// score. A rank is the sum of the counters above a time: one GetItem at any
// table size. The histogram items have no `time` or period attributes, so
// they stay out of the indexes. A score counted in the histograms carries
// `h`; scripts/backfill-hist.py counts the ones from before that.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const TABLE = process.env.TABLE;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const NAME = /^[A-Z0-9]{3}$/;
const WEAPON_ID = /^[a-z]{2,24}$/;
const CHARACTERS = new Set(['vaino', 'lemminkainen', 'ilmarinen', 'louhi', 'aino', 'noaidi', 'kullervo', 'tonttu', 'tapio', 'ukko', 'nyyrikki']);

function periods(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  );
  const y = Number(parts.year);
  const m = Number(parts.month);
  const d = Number(parts.day);
  // ISO week of the local date.
  const local = new Date(Date.UTC(y, m - 1, d));
  const dow = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(local.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((local - yearStart) / 86400000 + 1) / 7);
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    week: `${local.getUTCFullYear()}-W${String(week).padStart(2, '0')}`,
    month: `${parts.year}-${parts.month}`,
    all: 'ALL',
  };
}

const INDEX = { day: 'byDay', week: 'byWeek', month: 'byMonth', all: 'byAll' };

const json = (status, body, maxAge = 30) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json', 'cache-control': status === 200 ? `public, max-age=${maxAge}` : 'no-store' },
  body: JSON.stringify(body),
});

const histId = (period, value) => `hist#${period}#${value}`;

/** {seconds: runs} for one period value. */
async function hist(period, value) {
  const r = await db.send(new GetCommand({ TableName: TABLE, Key: { id: histId(period, value) } }));
  return counts(r.Item);
}

function counts(item) {
  const out = {};
  for (const [k, v] of Object.entries(item ?? {})) if (/^s\d+$/.test(k)) out[k.slice(1)] = v;
  return out;
}

/** 1 + the runs that lasted longer. Equal seconds share a rank. */
function rankIn(h, time) {
  let above = 0;
  for (const [sec, n] of Object.entries(h)) if (Number(sec) > time) above += n;
  return above + 1;
}

async function top(period, limit) {
  const p = periods()[period];
  const r = await db.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: INDEX[period],
      KeyConditionExpression: '#p = :p',
      ExpressionAttributeNames: { '#p': period },
      ExpressionAttributeValues: { ':p': p },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (r.Items ?? []).map((i) => ({ name: i.name, character: i.character, time: i.time, level: i.level, kills: i.kills, bosses: i.bosses, at: i.at, weapons: i.weapons, top: i.top }));
}

async function rank(period, value, time) {
  return rankIn(await hist(period, value), Math.floor(time));
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method;
  const path = event.rawPath ?? '';
  try {
    if (method === 'GET' && path.endsWith('/top')) {
      const q = event.queryStringParameters ?? {};
      const period = INDEX[q.period] ? q.period : 'all';
      const limit = Math.min(50, Math.max(1, Number(q.limit) || 20));
      return json(200, { period, value: periods()[period], top: await top(period, limit) });
    }
    if (method === 'GET' && path.endsWith('/board')) {
      const q = event.queryStringParameters ?? {};
      const period = INDEX[q.period] ? q.period : 'all';
      const value = periods()[period];
      const [list, h] = await Promise.all([top(period, 25), hist(period, value)]);
      return json(200, { period, value, updated: new Date().toISOString(), top: list, hist: h }, 60);
    }
    if (method === 'GET' && path.endsWith('/rank')) {
      const q = event.queryStringParameters ?? {};
      const period = INDEX[q.period] ? q.period : 'all';
      const time = Math.floor(Number(q.time));
      if (!(time >= 0 && time <= 4 * 3600)) return json(400, { error: 'time' });
      return json(200, { period, rank: await rank(period, periods()[period], time) });
    }
    if (method === 'POST' && path.endsWith('/scores')) {
      let b;
      try {
        b = JSON.parse(event.body ?? '{}');
      } catch {
        return json(400, { error: 'bad json' });
      }
      const name = String(b.name ?? '').toUpperCase();
      const time = Math.floor(Number(b.time));
      const level = Math.floor(Number(b.level));
      const kills = Math.floor(Number(b.kills));
      const bosses = Math.floor(Number(b.bosses ?? 0));
      const character = String(b.character ?? '');
      if (!NAME.test(name)) return json(400, { error: 'name' });
      if (!CHARACTERS.has(character)) return json(400, { error: 'character' });
      // Impossible runs are refused; a cheat that stays inside these bounds
      // is a cheat we accept for a hobby table.
      if (!(time >= 30 && time <= 4 * 3600)) return json(400, { error: 'time' });
      if (!(level >= 1 && level <= 300) || !(kills >= 0 && kills <= 200000) || !(bosses >= 0 && bosses <= 60)) return json(400, { error: 'stats' });
      if (kills > time * 40 || level > time / 4 + 5) return json(400, { error: 'stats' });
      // The build: up to six weapon ids and the one that dealt the most.
      // Optional, so a client without them still scores.
      const weapons = Array.isArray(b.weapons) ? b.weapons.filter((w) => typeof w === 'string' && WEAPON_ID.test(w)).slice(0, 6) : [];
      const top = typeof b.top === 'string' && WEAPON_ID.test(b.top) ? b.top : undefined;
      const now = new Date();
      const p = periods(now);
      const id = `${now.toISOString()}#${Math.random().toString(36).slice(2, 8)}`;
      await db.send(new PutCommand({ TableName: TABLE, Item: { id, name, character, time, level, kills, bosses, at: now.toISOString(), ...(weapons.length ? { weapons } : {}), ...(top ? { top } : {}), ...p, h: 1 } }));
      const ranks = {};
      await Promise.all(
        Object.keys(p).map(async (k) => {
          const r = await db.send(
            new UpdateCommand({
              TableName: TABLE,
              Key: { id: histId(k, p[k]) },
              UpdateExpression: 'ADD #s :one',
              ExpressionAttributeNames: { '#s': `s${time}` },
              ExpressionAttributeValues: { ':one': 1 },
              ReturnValues: 'ALL_NEW',
            }),
          );
          ranks[k] = rankIn(counts(r.Attributes), time);
        }),
      );
      return json(200, { ok: true, ranks });
    }
    return json(404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server' });
  }
};
