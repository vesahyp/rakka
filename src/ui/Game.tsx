import { useEffect, useRef, useState } from 'react';
import { createState, type SimState } from '../game/state';
import { step, DT, initRun } from '../game/sim';
import { Renderer } from '../render/renderer';
import { InputController } from '../input/input';
import { rollOffers, applyOffer, openChest, type Offer, type ChestResult } from '../game/upgrades';
import type { CharacterDef } from '../game/content/characters';
import { WEAPONS } from '../game/content/weapons';
import { PASSIVES } from '../game/content/passives';
import { OfferCard } from './Cards';
import { icon } from './icons';
import { fmtTime, track } from '../records';

export interface RunSummary {
  character: CharacterDef;
  time: number;
  level: number;
  kills: number;
  bosses: number;
  chests: number;
  weapons: string[];
  passives: string[];
  damageDealt: number;
}

interface Hud {
  time: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpNext: number;
  kills: number;
  weapons: { id: string; level: number; evolved: boolean }[];
  passives: { id: string; level: number }[];
  boss: { name: string; hp: number; max: number } | null;
  banner: { text: string; sub: string } | null;
}

type Overlay = { kind: 'none' } | { kind: 'levelup'; offers: Offer[] } | { kind: 'chest'; result: ChestResult } | { kind: 'pause' };

export function Game({ character, seed, onEnd, onQuit }: { character: CharacterDef; seed: number; onEnd: (r: RunSummary) => void; onQuit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<SimState | null>(null);
  const overlayRef = useRef<Overlay>({ kind: 'none' });
  const [overlay, setOverlayState] = useState<Overlay>({ kind: 'none' });
  const [hud, setHud] = useState<Hud | null>(null);
  const [stick, setStick] = useState<{ cx: number; cy: number; x: number; y: number } | null>(null);
  const endedRef = useRef(false);

  const setOverlay = (o: Overlay) => {
    overlayRef.current = o;
    setOverlayState(o);
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const root = rootRef.current!;
    const s = createState(seed, character);
    initRun(s);
    simRef.current = s;
    if (import.meta.env.DEV) (window as unknown as { __sim: SimState }).__sim = s;
    const renderer = new Renderer(canvas);
    s.view = renderer.view();
    const input = new InputController();
    input.attach(root);
    track('run_start', { character: character.id, seed });

    let wake: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (wake = l)).catch(() => undefined);

    const onResize = () => {
      renderer.resize();
      s.view = renderer.view();
    };
    window.addEventListener('resize', onResize);

    let last = performance.now();
    let acc = 0;
    let hudAcc = 0;
    let deathAcc = 0;
    let raf = 0;
    let pauseKey = false;

    const publishHud = () => {
      const boss = s.enemies.find((e) => e.boss);
      setHud({
        time: s.time,
        hp: s.player.hp,
        maxHp: s.stats.maxHp,
        level: s.player.level,
        xp: s.player.xp,
        xpNext: s.player.xpNext,
        kills: s.run.kills,
        weapons: s.weapons.map((w) => ({ id: w.id, level: w.level, evolved: !!WEAPONS[w.id].evolved })),
        passives: s.passives.map((p) => ({ id: p.id, level: p.level })),
        boss: boss ? { name: boss.def.name, hp: boss.hp, max: boss.maxHp } : null,
        banner: s.banner ? { text: s.banner.text, sub: s.banner.sub } : null,
      });
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const ov = overlayRef.current;

      // Pause toggle from the keyboard, edge-triggered.
      const pk = input.pressed('p') || input.pressed('escape');
      if (pk && !pauseKey) {
        if (ov.kind === 'none') setOverlay({ kind: 'pause' });
        else if (ov.kind === 'pause') setOverlay({ kind: 'none' });
      }
      pauseKey = pk;

      if (ov.kind === 'none' && !s.gameOver) {
        acc += dt;
        let n = 0;
        while (acc >= DT && n < 4) {
          step(s, input.read(), DT);
          acc -= DT;
          n++;
          if (s.pendingChests > 0) {
            s.pendingChests--;
            const result = openChest(s);
            track('chest', { size: result.size, items: result.items.map((i) => i.id).join(',') });
            setOverlay({ kind: 'chest', result });
            break;
          }
          if (s.pendingLevelUps > 0) {
            s.pendingLevelUps--;
            setOverlay({ kind: 'levelup', offers: rollOffers(s) });
            break;
          }
        }
        if (acc > DT * 4) acc = 0;
      } else if (s.gameOver) {
        step(s, { dx: 0, dy: 0 }, dt);
        deathAcc += dt;
        if (deathAcc > 1.6 && !endedRef.current) {
          endedRef.current = true;
          track('run_end', { character: character.id, time: Math.round(s.time), level: s.player.level, kills: s.run.kills });
          onEnd({
            character,
            time: s.time,
            level: s.player.level,
            kills: s.run.kills,
            bosses: s.run.bosses,
            chests: s.run.chests,
            weapons: s.weapons.map((w) => w.id),
            passives: s.passives.map((p) => p.id),
            damageDealt: s.run.damageDealt,
          });
        }
      }

      renderer.render(s, dt);
      hudAcc += dt;
      if (hudAcc > 0.1) {
        hudAcc = 0;
        publishHud();
        setStick(input.stick.active ? { cx: input.stick.cx, cy: input.stick.cy, x: input.stick.x, y: input.stick.y } : null);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      input.detach(root);
      wake?.release().catch(() => undefined);
    };
    // The run is created once per mount; a new seed or character means a new mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Number keys pick cards.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ov = overlayRef.current;
      if (ov.kind === 'levelup') {
        const i = Number(e.key) - 1;
        if (i >= 0 && i < ov.offers.length) pick(ov.offers[i]);
      } else if (ov.kind === 'chest' && (e.key === 'Enter' || e.key === ' ')) {
        setOverlay({ kind: 'none' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (o: Offer) => {
    const s = simRef.current!;
    applyOffer(s, o);
    track('pick', { id: o.id, level: o.level, kind: o.kind });
    setOverlay({ kind: 'none' });
  };

  const s = simRef.current;
  return (
    <div className="game" ref={rootRef}>
      <canvas ref={canvasRef} />
      {hud && (
        <>
          <div className="hud">
            <div className="xpbar">
              <div style={{ width: `${Math.min(100, (hud.xp / hud.xpNext) * 100)}%` }} />
              <span>TASO {hud.level}</span>
            </div>
            <div className="hudrow">
              <div className="items">
                {hud.weapons.map((w) => (
                  <div key={w.id} className={'it' + (w.evolved ? ' evo' : '')} title={WEAPONS[w.id].name}>
                    {icon(WEAPONS[w.id].icon)}
                    {!w.evolved && <b>{w.level}</b>}
                  </div>
                ))}
                {hud.passives.length > 0 && <div className="gap" />}
                {hud.passives.map((p) => (
                  <div key={p.id} className="it" title={PASSIVES[p.id].name}>
                    {icon(PASSIVES[p.id].icon)}
                    <b>{p.level}</b>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="timer">{fmtTime(hud.time)}</div>
                <div className="kills">☠ {hud.kills}</div>
              </div>
            </div>
          </div>
          {hud.boss && (
            <div className="bossbar">
              <div className="name">{hud.boss.name}</div>
              <div className="bar">
                <div style={{ width: `${(hud.boss.hp / hud.boss.max) * 100}%` }} />
              </div>
            </div>
          )}
          <div className="hpbar">
            <div style={{ width: `${Math.max(0, (hud.hp / hud.maxHp) * 100)}%` }} />
            <span>
              {Math.ceil(hud.hp)} / {hud.maxHp}
            </span>
          </div>
          {hud.banner && overlay.kind === 'none' && (
            <div className="banner">
              <div className="t">{hud.banner.text}</div>
              <div className="s">{hud.banner.sub}</div>
            </div>
          )}
          {overlay.kind === 'none' && (
            <button className="pausebtn" data-ui onClick={() => setOverlay({ kind: 'pause' })} aria-label="Tauko">
              II
            </button>
          )}
        </>
      )}
      {stick && (
        <div className="stick" style={{ left: stick.cx, top: stick.cy }}>
          <div style={{ transform: `translate(calc(-50% + ${stick.x - stick.cx}px), calc(-50% + ${stick.y - stick.cy}px))` }} />
        </div>
      )}

      {overlay.kind === 'levelup' && (
        <div className="overlay" data-ui>
          <h2>Taso {s?.player.level}</h2>
          <div className="cards">
            {overlay.offers.map((o, i) => (
              <OfferCard key={o.id + i} o={o} index={i} onPick={pick} />
            ))}
          </div>
        </div>
      )}
      {overlay.kind === 'chest' && (
        <div className="overlay" data-ui onClick={() => setOverlay({ kind: 'none' })}>
          <div className="chest">🪵</div>
          <h2>{overlay.result.size === 5 ? 'Tapion suuri lahja' : overlay.result.size === 3 ? 'Tapion lahja' : 'Arkku'}</h2>
          <div className="cards">
            {overlay.result.items.map((o, i) => (
              <OfferCard key={o.id + i} o={o} />
            ))}
          </div>
          <p className="small">Napauta jatkaaksesi</p>
        </div>
      )}
      {overlay.kind === 'pause' && s && (
        <div className="overlay" data-ui>
          <h2>Tauko</h2>
          <div className="stats">
            <span>Aika</span>
            <b>{fmtTime(s.time)}</b>
            <span>Taso</span>
            <b>{s.player.level}</b>
            <span>Kaadot</span>
            <b>{s.run.kills}</b>
            <span>Vahinko</span>
            <b>{Math.round(s.stats.might * 100)} %</b>
            <span>Alue</span>
            <b>{Math.round(s.stats.area * 100)} %</b>
            <span>Latausaika</span>
            <b>{Math.round(s.stats.cooldown * 100)} %</b>
            <span>Nopeus</span>
            <b>{Math.round(s.stats.moveSpeed * 100)} %</b>
            <span>Suoja</span>
            <b>{s.stats.armor}</b>
            <span>Palautuminen</span>
            <b>{s.stats.regen.toFixed(1)} /s</b>
            <span>Onni</span>
            <b>{Math.round(s.stats.luck * 100)} %</b>
            <span>Kirous</span>
            <b>{Math.round(s.stats.curse * 100)} %</b>
          </div>
          <div className="cards">
            {s.weapons.map((w) => {
              const def = WEAPONS[w.id];
              const evo = def.evolvesWith ? PASSIVES[def.evolvesWith] : null;
              return (
                <div className="card" key={w.id} style={{ cursor: 'default' }}>
                  <div className="ic">{icon(def.icon)}</div>
                  <div className="body">
                    <div className="name">
                      <span>{def.name}</span>
                      <span className="lvl">{def.evolved ? 'Kehittynyt' : `Taso ${w.level}/${def.levels.length + 1}`}</span>
                    </div>
                    {evo && !def.evolved && (
                      <div className="desc">
                        Kehittyy: taso {def.levels.length + 1} + {icon(evo.icon)} {evo.name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={() => setOverlay({ kind: 'none' })}>
              Jatka
            </button>
            <button className="btn ghost" onClick={onQuit}>
              Lopeta peli
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
