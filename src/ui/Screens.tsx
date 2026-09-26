import { useEffect, useRef } from 'react';
import { CHARACTERS, type CharacterDef } from '../game/content/characters';
import { WEAPONS } from '../game/content/weapons';
import { PASSIVES } from '../game/content/passives';
import { isUnlocked, fmtTime, type Records } from '../records';
import { icon } from './icons';
import { characterSprite, sprite } from '../render/sprites';
import type { RunSummary } from './Game';

export function Title({ records, onPlay, onRecords }: { records: Records; onPlay: () => void; onRecords: () => void }) {
  const best = records.best[0];
  return (
    <div className="screen">
      <h1 className="logo">RÄKKÄ</h1>
      <p className="tagline">Metsä ei lopu. Räkkä ei lopu.</p>
      <button className="btn primary" onClick={onPlay} data-ui>
        Pelaa
      </button>
      <button className="btn ghost" onClick={onRecords} data-ui>
        Tulokset
      </button>
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

export function Select({ records, onPick, onBack }: { records: Records; onPick: (c: CharacterDef) => void; onBack: () => void }) {
  return (
    <div className="screen" style={{ justifyContent: 'flex-start' }}>
      <h2>Kuka lähtee metsään?</h2>
      <div className="chars">
        {CHARACTERS.map((c) => {
          const open = isUnlocked(c, records);
          const w = WEAPONS[c.weapon];
          const pc = records.perChar[c.id];
          return (
            <button key={c.id} className={'char' + (open ? '' : ' locked')} disabled={!open} onClick={() => onPick(c)} data-ui>
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
      <button className="btn ghost" onClick={onBack} data-ui>
        Takaisin
      </button>
    </div>
  );
}

export function Death({ r, rank, charBest, onAgain, onMenu }: { r: RunSummary; rank: number; charBest: boolean; onAgain: () => void; onMenu: () => void }) {
  return (
    <div className="screen">
      <h2 style={{ color: 'var(--danger)' }}>Metsä otti omansa</h2>
      <p className="small">
        {r.character.name} selviytyi {fmtTime(r.time)}
      </p>
      {rank === 0 && <div className="record">Uusi paras aika!</div>}
      {rank > 0 && <div className="record">Sija {rank + 1} tuloksissa</div>}
      {rank !== 0 && charBest && <div className="record">Hahmon paras aika</div>}
      <div className="stats">
        <span>Taso</span>
        <b>{r.level}</b>
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
      <button className="btn primary" onClick={onAgain} data-ui>
        Uudestaan
      </button>
      <button className="btn ghost" onClick={onMenu} data-ui>
        Valikkoon
      </button>
    </div>
  );
}

export function RecordsScreen({ records, onBack }: { records: Records; onBack: () => void }) {
  return (
    <div className="screen" style={{ justifyContent: 'flex-start' }}>
      <h2>Tulokset</h2>
      {records.best.length === 0 && <p className="small">Ei vielä yhtään peliä.</p>}
      {records.best.length > 0 && (
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
      <p className="small">
        {records.runs} peliä, {records.totalKills.toLocaleString('fi')} kaatoa, {fmtTime(records.totalTime)} metsässä
      </p>
      <button className="btn ghost" onClick={onBack} data-ui>
        Takaisin
      </button>
    </div>
  );
}
