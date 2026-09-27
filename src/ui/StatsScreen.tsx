import { useEffect, useMemo, useState } from 'react';
import { WEAPONS } from '../game/content/weapons';
import { CHARACTERS } from '../game/content/characters';
import { PASSIVES } from '../game/content/passives';
import { POWERS } from '../game/content/powers';
import { ALTAR } from '../meta';

/**
 * The traffic board (jeeves practices/web-tracking.md). Reads the nightly
 * pipeline's analytics.json from the pixel host and only sums days and
 * formats; the pipeline aggregates. Reached with ?stats on the URL. Not
 * linked from the game, not authenticated: obscurity only, so nothing on
 * it may be something that cannot survive being found.
 */
export const STATS_URL = 'https://d1x53tebijcunt.cloudfront.net/data/analytics.json';

interface DayRow {
  date: string;
  sessions: number;
  visitors: number;
  visitors7d: number;
  visitors30d: number;
  events: number;
  crashes: number;
  errors: number;
  bots: { sessions: number; events: number };
  by: Record<string, Record<string, number>>;
  bySessions: Record<string, Record<string, number>>;
}

function sumMaps(rows: DayRow[], table: 'by' | 'bySessions', dim: string): [string, number][] {
  const acc: Record<string, number> = {};
  for (const r of rows) {
    const m = r[table]?.[dim];
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) acc[k] = (acc[k] ?? 0) + v;
  }
  return Object.entries(acc).sort((a, b) => b[1] - a[1]);
}

export function StatsScreen({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<DayRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [showBots, setShowBots] = useState(false);

  useEffect(() => {
    // no-store: a response cached without its CORS header (a first fetch during a
    // CloudFront deploy) would otherwise fail every later read for five minutes.
    fetch(STATS_URL, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setRows)
      .catch(() => setFailed(true));
  }, []);

  const view = useMemo(() => {
    if (!rows) return null;
    const days = [...new Set(rows.map((r) => r.date))].sort();
    const latest = days[days.length - 1];
    const latestRow = rows.find((r) => r.date === latest);
    const last30 = rows.filter((r) => days.slice(-30).includes(r.date));
    return {
      days: days.slice(-30),
      latest,
      latestRow,
      runs: sumMaps(last30, 'by', 'run_start').reduce((n, [, v]) => n + v, 0),
      characters: sumMaps(last30, 'by', 'run_start').map(([k, v]): [string, number] => [CHARACTERS.find((c) => c.id === k)?.name ?? k, v]).slice(0, 11),
      picks: sumMaps(last30, 'by', 'pick').slice(0, 12),
      chests: sumMaps(last30, 'by', 'chest'),
      weaponDamage: sumMaps(last30, 'by', 'weapon_damage').map(([k, v]): [string, number] => [WEAPONS[k]?.name ?? k, v]),
      weaponRuns: sumMaps(last30, 'by', 'weapon_runs').map(([k, v]): [string, number] => [WEAPONS[k]?.name ?? k, v]),
      topWeapon: sumMaps(last30, 'by', 'top_weapon').map(([k, v]): [string, number] => [WEAPONS[k]?.name ?? k, v]),
      // Runs that had the item (sessions), not summed levels.
      passives: sumMaps(last30, 'bySessions', 'passive').map(([k, v]): [string, number] => [PASSIVES[k]?.name ?? k, v]),
      taiat: sumMaps(last30, 'bySessions', 'taika').map(([k, v]): [string, number] => [POWERS[k]?.name ?? k, v]),
      altar: sumMaps(last30, 'by', 'altar').map(([k, v]): [string, number] => [ALTAR.find((a) => a.id === k)?.name ?? k, v]),
      altarRuns: sumMaps(last30, 'bySessions', 'altar').reduce((n, [, v]) => Math.max(n, v), 0),
      might: sumMaps(last30, 'by', 'mod_might').sort((a, b) => Number(a[0]) - Number(b[0])),
      referrers: sumMaps(last30, 'bySessions', 'referrer')
        .map(([k, v]): [string, number] => [k === 'direct' ? 'Suoraan' : k, v])
        .slice(0, 8),
      edges: sumMaps(last30, 'bySessions', 'edge').slice(0, 8),
      errorsTop: sumMaps(last30, 'by', 'error').slice(0, 6),
      total30: {
        sessions: last30.reduce((n, r) => n + r.sessions, 0),
        bots: last30.reduce((n, r) => n + r.bots.sessions, 0),
      },
    };
  }, [rows]);

  const byDate = useMemo(() => new Map((rows ?? []).map((r) => [r.date, r])), [rows]);
  const maxSessions = Math.max(1, ...(view?.days ?? []).map((d) => (byDate.get(d)?.sessions ?? 0) + (showBots ? byDate.get(d)?.bots.sessions ?? 0 : 0)));

  const Kpi = ({ v, label }: { v: number | string | null | undefined; label: string }) => (
    <div className="kpi">
      <strong>{v ?? '–'}</strong>
      <span>{label}</span>
    </div>
  );

  return (
    <div className="screen stats-screen" style={{ justifyContent: 'flex-start' }}>
      <h2>Kävijät</h2>
      {failed && <p className="small">Ei vielä tilastoja. Yöajo julkaisee analytics.json; ensimmäinen ajo on ehkä vielä tekemättä.</p>}
      {!failed && !view && <p className="small">Haetaan…</p>}
      {view && (
        <>
          <div className="kpis">
            <Kpi v={view.latestRow?.sessions} label="istuntoa eilen" />
            <Kpi v={view.latestRow?.visitors7d} label="kävijää 7 pv" />
            <Kpi v={view.latestRow?.visitors30d} label="kävijää 30 pv" />
            <Kpi v={view.total30.sessions} label="istuntoa 30 pv" />
            <Kpi v={view.runs} label="pelejä 30 pv" />
            <Kpi v={view.total30.bots} label="bottia 30 pv" />
          </div>
          <p className="small">Viimeisin päivä {view.latest}. Ihmisten luvut; botit laskettu erikseen.</p>
          <section className="panel">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>Istunnot päivittäin</h3>
              <label className="small">
                <input type="checkbox" checked={showBots} onChange={(e) => setShowBots(e.target.checked)} /> botit
              </label>
            </div>
            <div className="bars" role="img" aria-label="Istunnot päivittäin">
              {view.days.map((d) => {
                const r = byDate.get(d);
                const human = r?.sessions ?? 0;
                const bots = r?.bots.sessions ?? 0;
                return (
                  <div key={d} className="bar" title={`${d}: ${human} istuntoa${showBots ? `, ${bots} bottia` : ''}`}>
                    {showBots && <div style={{ height: `${(bots / maxSessions) * 100}%`, background: '#8a8a8a' }} />}
                    <div style={{ height: `${Math.max(1, (human / maxSessions) * 100)}%`, background: 'var(--accent-2)' }} />
                  </div>
                );
              })}
            </div>
            <div className="row small" style={{ justifyContent: 'space-between' }}>
              <span>{view.days[0]?.slice(5)}</span>
              <span>{view.days[view.days.length - 1]?.slice(5)}</span>
            </div>
          </section>
          <section className="panel">
            <h3>Hahmot, 30 pv</h3>
            <BarList items={view.characters} />
          </section>
          <section className="panel">
            <h3>Aseiden vahinko-osuus, 30 pv</h3>
            <p className="small">Kokonaisvahinko per ase kaikista päättyneistä peleistä. Yksi ase kaukana muiden edellä on liian vahva; yksi kaukana takana on turha valinta.</p>
            <BarList items={view.weaponDamage} />
          </section>
          <section className="panel">
            <h3>Eniten vahinkoa tehnyt ase, pelejä 30 pv</h3>
            <BarList items={view.topWeapon} />
          </section>
          <section className="panel">
            <h3>Ase mukana, pelejä 30 pv</h3>
            <BarList items={view.weaponRuns} />
          </section>
          <section className="panel">
            <h3>Vahinkokerroin päättyneissä peleissä, 30 pv</h3>
            <p className="small">Might-kerroin pelin lopussa, kymmenyksen tarkkuudella. Kertoo kuinka paljon terva, taiat ja pöytä kertovat aseiden lukuja.</p>
            <BarList items={view.might} />
          </section>
          <section className="panel">
            <h3>Tapion pöytä: asteet päättyneissä peleissä, 30 pv</h3>
            <p className="small">Summa asteista per esine. {view.altarRuns} pelissä oli pöydän asteita.</p>
            <BarList items={view.altar} />
          </section>
          <section className="panel">
            <h3>Esine mukana, pelejä 30 pv</h3>
            <BarList items={view.passives} />
          </section>
          <section className="panel">
            <h3>Taika mukana, pelejä 30 pv</h3>
            <BarList items={view.taiat} />
          </section>
          <section className="panel">
            <h3>Valinnat, 30 pv</h3>
            <BarList items={view.picks} />
          </section>
          <section className="panel">
            <h3>Arkut koon mukaan, 30 pv</h3>
            <BarList items={view.chests} />
          </section>
          <section className="panel">
            <h3>Lähteet, 30 pv</h3>
            <BarList items={view.referrers} />
          </section>
          <section className="panel">
            <h3>Reunapalvelimet, 30 pv</h3>
            <BarList items={view.edges} />
          </section>
          <section className="panel">
            <h3>Virheet, 30 pv</h3>
            <BarList items={view.errorsTop} />
          </section>
        </>
      )}
      <button className="btn ghost" onClick={onBack} data-ui>
        Takaisin
      </button>
    </div>
  );
}

function BarList({ items }: { items: [string, number][] }) {
  const max = Math.max(1, ...items.map(([, v]) => v));
  return (
    <ul className="barlist">
      {items.length === 0 && <li className="small">Ei vielä.</li>}
      {items.map(([k, v]) => (
        <li key={k} title={`${k}: ${v}`}>
          <span className="k">{k}</span>
          <div className="track">
            <div style={{ width: `${(v / max) * 100}%` }} />
          </div>
          <span className="v">{v >= 10000 ? Math.round(v / 1000) + 'k' : v}</span>
        </li>
      ))}
    </ul>
  );
}
