// Räkkä records API. One Lambda, two routes:
//   POST /scores        {name, character, time, level, kills, bosses}
//   GET  /top?period=day|week|month|all&limit=20
// Names are three characters, A-Z and 0-9, like a pinball machine. Periods
// are counted in Europe/Helsinki. The table has one item per run and four
// indexes keyed by period value and sorted by survival time, so a top list
// is one Query and a rank is one Count.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const TABLE = process.env.TABLE;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const NAME = /^[A-Z0-9]{3}$/;
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

const json = (status, body) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json', 'cache-control': status === 200 ? 'public, max-age=30' : 'no-store' },
  body: JSON.stringify(body),
});

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
  return (r.Items ?? []).map((i) => ({ name: i.name, character: i.character, time: i.time, level: i.level, kills: i.kills, bosses: i.bosses, at: i.at }));
}

async function rank(period, value, time) {
  const r = await db.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: INDEX[period],
      KeyConditionExpression: '#p = :p AND #t > :t',
      ExpressionAttributeNames: { '#p': period, '#t': 'time' },
      ExpressionAttributeValues: { ':p': value, ':t': time },
      Select: 'COUNT',
    }),
  );
  return (r.Count ?? 0) + 1;
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
      const now = new Date();
      const p = periods(now);
      const id = `${now.toISOString()}#${Math.random().toString(36).slice(2, 8)}`;
      await db.send(new PutCommand({ TableName: TABLE, Item: { id, name, character, time, level, kills, bosses, at: now.toISOString(), ...p } }));
      const ranks = {};
      for (const k of Object.keys(p)) ranks[k] = await rank(k, p[k], time);
      return json(200, { ok: true, ranks });
    }
    return json(404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server' });
  }
};
