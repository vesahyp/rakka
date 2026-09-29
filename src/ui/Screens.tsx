import { useEffect, useRef, useState } from 'react';
import { CHARACTERS, type CharacterDef } from '../game/content/characters';
import { WEAPONS } from '../game/content/weapons';
import { PASSIVES } from '../game/content/passives';
import { isUnlocked, fmtTime, type Records } from '../records';
import { icon } from './icons';
import { characterSprite, sprite } from '../render/sprites';
import { HERO_COLORS } from '../render/renderer';
import type { RunSummary } from './Game';
import { Initials, RankLine } from './Initials';
import { fetchTop, fetchRank, loadInitials, PERIOD_LABELS, type Period, type TopEntry } from '../api';
import type { RunRecord } from '../records';
import { audio } from '../audio';
import type { Meta } from '../meta';

export function Title({ records, meta, onPlay, onRecords, onAltar }: { records: Records; meta: Meta; onPlay: (players: 1 | 2) => void; onRecords: () => void; onAltar: () => void }) {
  const best = records.best[0];
  const [muted, setMuted] = useState(audio.muted);
  return (
    <div className="screen">
      <img className="titleicon" src={`${import.meta.env.BASE_URL}icon-512.png`} alt="" width={128} height={128} />
      <h1 className="logo">RÄKKÄ</h1>
      <p className="tagline">Metsä ei lopu. Räkkä ei lopu.</p>
      <button
        className="btn primary"
        onClick={() => {
          audio.unlock();
          onPlay(1);
        }}
        data-ui
      >
        Pelaa
      </button>
      <button
        className="btn"
        onClick={() => {
          audio.unlock();
          onPlay(2);
        }}
        data-ui
      >
        Kaksin
      </button>
      <div className="row">
        <button className="btn ghost" onClick={onRecords} data-ui>
          Tulostaulu
        </button>
        <button className="btn ghost" onClick={onAltar} data-ui>
          🌲 Tapion pöytä{meta.cones > 0 ? ` (${meta.cones})` : ''}
        </button>
        <button
          className="btn ghost"
          data-ui
          onClick={() => {
            audio.unlock();
            audio.setMuted(!muted);
            setMuted(!muted);
          }}
        >
          {muted ? '🔇 Äänet pois' : '🔊 Äänet päällä'}
        </button>
      </div>
      {best && (
        <p className="small" style={{ marginTop: 20 }}>
          Paras: {fmtTime(best.time)}, taso {best.level}
        </p>
      )}
      <p className="help" style={{ marginTop: 24 }}>
        Liiku peukalolla. Aseet ampuvat itse. Kerää marjat, valitse päivitys, väistä parvi. Kun kuolet, metsä muistaa kuinka pitkälle pääsit.
      </p>
    </div>
  );
}

function Portrait({ c }: { c: CharacterDef }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const key = 'char:' + c.id;
    characterSprite(key, c.colors);
    const sp = sprite(key);
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sp.img as CanvasImageSource, 0, 0, cv.width, cv.height);
  }, [c]);
  return <canvas ref={ref} width={72} height={96} style={{ width: 36, height: 48 }} />;
}

export function Select({ records, players, onPick, onBack }: { records: Records; players: 1 | 2; onPick: (c: CharacterDef[]) => void; onBack: () => void }) {
  // Co-op: player one picks, then player two; the same hero twice is fine.
  const [first, setFirst] = useState<CharacterDef | null>(null);
  const who = players === 2 ? (first ? 2 : 1) : 0;
  return (
    <div className="screen" style={{ justifyContent: 'flex-start' }}>
      {who > 0 && (
        <div className="herotag" style={{ color: HERO_COLORS[who - 1] }}>
          Pelaaja {who}
          {first ? ` · ${first.name} lähtee jo` : ''}
        </div>
      )}
      <h2>{who === 2 ? 'Kuka lähtee mukaan?' : 'Kuka lähtee metsään?'}</h2>
      {players === 2 && (
        <p className="small" style={{ maxWidth: 380, marginTop: 0 }}>
          Yksi puhelin, kaksi peukaloa. Käännä puhelin vaakaan: vasen puoli ohjaa ensimmäistä, oikea toista. Näppäimistöllä WASD ja nuolet. Marjat ovat yhteiset, kaatuneen nostaa seisomalla vieressä.
        </p>
      )}
      <div className="chars">
        {CHARACTERS.map((c) => {
          const open = isUnlocked(c, records);
          const w = WEAPONS[c.weapon];
          const pc = records.perChar[c.id];
          return (
            <button
              key={c.id}
              className={'char' + (open ? '' : ' locked')}
              disabled={!open}
              onClick={() => {
                audio.unlock();
                if (players === 2 && !first) setFirst(c);
                else onPick(first ? [first, c] : [c]);
              }}
              data-ui
            >
              <Portrait c={c} />
              <div className="name">{c.name}</div>
              <div className="title">{c.title}</div>
              <div className="desc">{c.desc}</div>
              <div className="weapon">
                {icon(w.icon)} {w.name}
              </div>
              <div className="trait">{open ? c.trait : '🔒 ' + c.unlock!.text}</div>
              {pc && <div className="small">Paras {fmtTime(pc.time)}, taso {pc.level}</div>}
            </button>
          );
        })}
      </div>
      <button className="btn ghost" onClick={() => (first ? setFirst(null) : onBack())} data-ui>
        Takaisin
      </button>
    </div>
  );
}

export function Death({ r, rank, charBest, cones, onAgain, onMenu }: { r: RunSummary; rank: number; charBest: boolean; cones: number; onAgain: () => void; onMenu: () => void }) {
  // Runs under a minute do not go on the table; the API refuses them too.
  const coop = r.characters.length > 1;
  const [stage, setStage] = useState<'ask' | 'done'>(r.time >= 60 && !coop ? 'ask' : 'done');
  const [ranks, setRanks] = useState<Record<Period, number> | null>(null);
  return (
    <div className="screen">
      <h2 style={{ color: 'var(--danger)' }}>Metsä otti omansa</h2>
      <p className="small">
        {r.characters.map((c) => c.name).join(' ja ')} {coop ? 'selviytyivät' : 'selviytyi'} {fmtTime(r.time)}
      </p>
      {coop && <p className="small">Kaksinpeli ei mene tulostaululle. Kävyt kyllä.</p>}
      {stage === 'ask' && (
        <Initials
          r={r}
          onDone={(rk) => {
            setRanks(rk);
            setStage('done');
          }}
        />
      )}
      {ranks && <RankLine ranks={ranks} />}
      {cones > 0 && <div className="earned">+{cones} käpyä Tapion pöydälle</div>}
      {rank === 0 && <div className="record">Uusi paras aika!</div>}
      {rank > 0 && <div className="record">Sija {rank + 1} omissa tuloksissa</div>}
      {rank !== 0 && charBest && <div className="record">Hahmon paras aika</div>}
      <div className="stats">
        <span>Taso</span>
        <b>{coop ? r.levels.join(' ja ') : r.level}</b>
        <span>Kaadot</span>
        <b>{r.kills}</b>
        <span>Pomot</span>
        <b>{r.bosses}</b>
        <span>Arkut</span>
        <b>{r.chests}</b>
        <span>Vahinko</span>
        <b>{Math.round(r.damageDealt).toLocaleString('fi')}</b>
      </div>
      <div className="row" style={{ marginBottom: 16, maxWidth: 360 }}>
        {r.weapons.map((id) => (
          <span key={id} title={WEAPONS[id].name} style={{ fontSize: 24 }}>
            {icon(WEAPONS[id].icon)}
          </span>
        ))}
        {r.passives.map((id) => (
          <span key={id} title={PASSIVES[id].name} style={{ fontSize: 24, opacity: 0.8 }}>
            {icon(PASSIVES[id].icon)}
          </span>
        ))}
      </div>
      {stage === 'done' && (
        <>
          <button className="btn primary" onClick={onAgain} data-ui>
            Uudestaan
          </button>
          <button className="btn ghost" onClick={onMenu} data-ui>
            Valikkoon
          </button>
        </>
      )}
    </div>
  );
}

const TABS: (Period | 'mine')[] = ['day', 'week', 'month', 'all', 'mine'];

/** The period key of a date on this device's clock: the same keys the API uses in Helsinki time. */
function periodKey(period: Period, d: Date): string {
  if (period === 'all') return 'ALL';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  if (period === 'day') return `${y}-${m}-${day}`;
  if (period === 'month') return `${y}-${m}`;
  const t = new Date(Date.UTC(y, d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - start.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** My best local run inside the period, by this device's clock. */
function myBestIn(period: Period, best: RunRecord[]): RunRecord | null {
  const now = periodKey(period, new Date());
  let top: RunRecord | null = null;
  for (const r of best) {
    if (periodKey(period, new Date(r.date)) !== now) continue;
    if (!top || r.time > top.time) top = r;
  }
  return top;
}

export function RecordsScreen({ records, onBack }: { records: Records; onBack: () => void }) {
  const [tab, setTab] = useState<Period | 'mine'>('day');
  const [top, setTop] = useState<Record<string, TopEntry[] | 'error' | undefined>>({});
  const [myRank, setMyRank] = useState<Record<string, number | undefined>>({});
  useEffect(() => {
    if (tab === 'mine' || top[tab]) return;
    let live = true;
    fetchTop(tab)
      .then((t) => live && setTop((o) => ({ ...o, [tab]: t })))
      .catch(() => live && setTop((o) => ({ ...o, [tab]: 'error' })));
    return () => {
      live = false;
    };
  }, [tab, top]);
  const charName = (id: string) => CHARACTERS.find((c) => c.id === id)?.name ?? id;
  const mine = loadInitials();
  const list = tab === 'mine' ? null : top[tab];
  const myBest = tab === 'mine' ? null : myBestIn(tab, records.best);
  // Is my best already a row on the list? Same initials and time is close enough.
  const myRow = myBest && Array.isArray(list) ? list.findIndex((e) => e.name === mine && Math.abs(e.time - Math.floor(myBest.time)) <= 1) : -1;
  useEffect(() => {
    if (tab === 'mine' || !myBest || myRow >= 0 || myRank[tab] !== undefined || !Array.isArray(list)) return;
    let live = true;
    fetchRank(tab, myBest.time)
      .then((n) => live && setMyRank((o) => ({ ...o, [tab]: n })))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [tab, myBest, myRow, myRank, list]);
  return (
    <div className="screen" style={{ justifyContent: 'flex-start' }}>
      <h2>Tulostaulu</h2>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={'tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)} data-ui>
            {t === 'mine' ? 'Omat' : PERIOD_LABELS[t]}
          </button>
        ))}
      </div>
      {tab !== 'mine' && list === undefined && <p className="small">Haetaan…</p>}
      {tab !== 'mine' && list === 'error' && <p className="small">Tulostaulua ei saatu haettua.</p>}
      {tab !== 'mine' && Array.isArray(list) && list.length === 0 && <p className="small">Ei vielä tuloksia. Ole ensimmäinen.</p>}
      {tab !== 'mine' && Array.isArray(list) && list.length > 0 && (
        <table className="records global">
          <thead>
            <tr>
              <th>#</th>
              <th>Nimi</th>
              <th>Hahmo</th>
              <th>Aika</th>
              <th className="n">Taso</th>
              <th className="n">Kaadot</th>
              {tab === 'all' && <th className="n">Pvm</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((e, i) => (
              <tr key={i} className={i === myRow ? 'me best' : e.name === mine ? 'me' : ''} title={`${e.bosses} pomoa`}>
                <td>{i + 1}</td>
                <td className="name">{e.name}</td>
                <td>
                  {charName(e.character)}
                  {e.top && WEAPONS[e.top] && (
                    <span className="topw" title={`Eniten vahinkoa: ${WEAPONS[e.top].name}`}>
                      {' '}
                      {icon(WEAPONS[e.top].icon)}
                    </span>
                  )}
                </td>
                <td>{fmtTime(e.time)}</td>
                <td className="n">{e.level}</td>
                <td className="n">{e.kills.toLocaleString('fi')}</td>
                {tab === 'all' && <td className="n small">{e.at.slice(5, 10).replace('-', '.')}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tab !== 'mine' && Array.isArray(list) && myBest && myRow < 0 && (
        <table className="records global myrow">
          <tbody>
            <tr className="me best">
              <td>{myRank[tab] ?? '…'}</td>
              <td className="name">{mine || 'Sinä'}</td>
              <td>{charName(myBest.character)}</td>
              <td>{fmtTime(myBest.time)}</td>
              <td className="n">{myBest.level}</td>
              <td className="n">{myBest.kills.toLocaleString('fi')}</td>
              {tab === 'all' && <td className="n small">oma paras</td>}
            </tr>
          </tbody>
        </table>
      )}
      {tab !== 'mine' && <p className="small">Järjestys: aika, sitten kaadot. Päivä vaihtuu keskiyöllä Suomen aikaa, viikko maanantaina. Oma paras korostettu; listan ulkopuolella se näkyy sijoineen alla.</p>}
      {tab === 'mine' && records.best.length === 0 && <p className="small">Ei vielä yhtään peliä.</p>}
      {tab === 'mine' && records.best.length > 0 && (
        <table className="records">
          <thead>
            <tr>
              <th>#</th>
              <th>Hahmo</th>
              <th>Aika</th>
              <th className="n">Taso</th>
              <th className="n">Kaadot</th>
            </tr>
          </thead>
          <tbody>
            {records.best.map((r, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{CHARACTERS.find((c) => c.id === r.character)?.name ?? r.character}</td>
                <td>{fmtTime(r.time)}</td>
                <td className="n">{r.level}</td>
                <td className="n">{r.kills}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tab === 'mine' && (
        <p className="small">
          {records.runs} peliä, {records.totalKills.toLocaleString('fi')} kaatoa, {fmtTime(records.totalTime)} metsässä
        </p>
      )}
      <button className="btn ghost" onClick={onBack} data-ui>
        Takaisin
      </button>
    </div>
  );
}
