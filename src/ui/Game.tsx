import { useEffect, useRef, useState } from 'react';
import { createState, type SimState, type Hero } from '../game/state';
import { step, DT, initRun } from '../game/sim';
import { Renderer, HERO_COLORS } from '../render/renderer';
import { InputController, loadStickMode, saveStickMode, type StickMode } from '../input/input';
import { rollOffers, applyOffer, openChest, type Offer, type ChestResult } from '../game/upgrades';
import type { CharacterDef } from '../game/content/characters';
import type { StatDelta } from '../game/stats';
import { WEAPONS } from '../game/content/weapons';
import { PASSIVES } from '../game/content/passives';
import { POWERS } from '../game/content/powers';
import { OfferCard } from './Cards';
import { icon } from './icons';
import { fmtTime, track } from '../records';
import { botInput, botPick } from '../../tools/autoplayer';
import { Rng } from '../game/rng';
import { audio } from '../audio';
import { UpdateBanner } from './Update';
import { tr } from '../i18n';

export interface RunSummary {
  /** the first hero, for records and the board; `characters` has everyone */
  character: CharacterDef;
  characters: CharacterDef[];
  time: number;
  /** the highest level reached; `levels` has each hero's */
  level: number;
  levels: number[];
  kills: number;
  bosses: number;
  chests: number;
  weapons: string[];
  passives: string[];
  damageDealt: number;
  cones: number;
  /** damage per weapon id, sorted, for the records API and the beacon */
  damageBy: Record<string, number>;
  topWeapon: string | null;
}

interface HeroHud {
  name: string;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpNext: number;
  alive: boolean;
  weapons: { id: string; level: number; evolved: boolean }[];
  passives: { id: string; level: number }[];
  powers: { id: string; level: number }[];
}

interface Hud {
  time: number;
  kills: number;
  cones: number;
  keys: number;
  heroes: HeroHud[];
  boss: { name: string; hp: number; max: number } | null;
  banner: { text: string; sub: string } | null;
}

type Overlay = { kind: 'none' } | { kind: 'levelup'; hero: number; offers: Offer[] } | { kind: 'chest'; hero: number; result: ChestResult } | { kind: 'pause' };

/** "Pelaaja 1 · Väinö", coloured, above a card set in co-op. */
function HeroTag({ h }: { h: Hero }) {
  return (
    <div className="herotag" style={{ color: HERO_COLORS[h.index] }}>
      {tr('Pelaaja', 'Player')} {h.index + 1} · {h.character.name}
    </div>
  );
}

export function Game({ characters, seed, meta, altar, onEnd, onQuit, onRestart }: { characters: CharacterDef[]; seed: number; meta: StatDelta; altar: Record<string, number>; onEnd: (r: RunSummary) => void; onQuit: () => void; onRestart: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<SimState | null>(null);
  const overlayRef = useRef<Overlay>({ kind: 'none' });
  const [overlay, setOverlayState] = useState<Overlay>({ kind: 'none' });
  const [hud, setHud] = useState<Hud | null>(null);
  const stickRefs = useRef<(HTMLDivElement | null)[]>([]);
  const inputRef = useRef<InputController | null>(null);
  const [stickMode, setStickModeState] = useState<StickMode>(loadStickMode);
  const [muted, setMuted] = useState(audio.muted);
  const endedRef = useRef(false);
  const coop = characters.length > 1;

  const setOverlay = (o: Overlay) => {
    overlayRef.current = o;
    setOverlayState(o);
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const root = rootRef.current!;
    const s = createState(seed, characters, meta);
    initRun(s);
    simRef.current = s;
    if (import.meta.env.DEV) (window as unknown as { __sim: SimState }).__sim = s;
    const renderer = new Renderer(canvas);
    s.view = renderer.view();
    const input = new InputController(characters.length);
    input.attach(root);
    inputRef.current = input;
    track('run_start', { character: characters.map((c) => c.id).join('+'), players: characters.length, seed });
    audio.unlock();
    audio.startMusic();

    let wake: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (wake = l)).catch(() => undefined);

    const onResize = () => {
      renderer.resize();
      s.view = renderer.view();
      input.layout();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);

    // Dev: ?bot=1 lets the balance bot play in the real renderer, so late
    // minutes can be looked at without playing there by hand. ?speed=N runs
    // the sim N times faster.
    const params = new URLSearchParams(location.search);
    const bot = import.meta.env.DEV && params.get('bot') === '1';
    const speed = import.meta.env.DEV ? Math.max(1, Number(params.get('speed') ?? 1)) : 1;
    const botRng = new Rng(seed ^ 0x5151);
    const perf = { frames: 0, ms: 0, worst: 0 };
    (window as unknown as { __perf: typeof perf }).__perf = perf;

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
        kills: s.run.kills,
        cones: s.run.cones,
        keys: s.run.keys,
        heroes: s.heroes.map((h) => ({
          name: h.character.name,
          hp: h.player.hp,
          maxHp: h.stats.maxHp,
          level: h.player.level,
          xp: h.player.xp,
          xpNext: h.player.xpNext,
          alive: h.player.alive,
          weapons: h.weapons.map((w) => ({ id: w.id, level: w.level, evolved: !!WEAPONS[w.id].evolved })),
          passives: h.passives.map((p) => ({ id: p.id, level: p.level })),
          powers: h.powers.map((p) => ({ id: p.id, level: p.level })),
        })),
        boss: boss ? { name: boss.def.name, hp: boss.hp, max: boss.maxHp } : null,
        banner: s.banner ? { text: s.banner.text, sub: s.banner.sub } : null,
      });
    };

    /** A chest or a level-up waiting after a step: open the overlay, or let the bot pick. Returns true when the loop should stop for this frame. */
    const pending = (): boolean => {
      if (s.pendingChests.length > 0) {
        const h = s.heroes[s.pendingChests.shift()!];
        const result = openChest(s, h);
        track('chest', { size: result.size, items: result.items.map((i) => i.id).join(',') });
        audio.play(result.items.some((i) => i.kind === 'evolve') ? 'evolve' : result.size > 1 ? 'chestbig' : 'chest');
        if (bot) return false;
        setOverlay({ kind: 'chest', hero: h.index, result });
        return true;
      }
      for (const h of s.heroes) {
        if (h.pendingLevelUps <= 0) continue;
        h.pendingLevelUps--;
        if (bot) {
          applyOffer(s, h, botPick(h, rollOffers(s, h), botRng, { weaponBias: 0.6 }));
          return false;
        }
        setOverlay({ kind: 'levelup', hero: h.index, offers: rollOffers(s, h) });
        return true;
      }
      return false;
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

      const t0 = performance.now();
      // Rotation on iOS reports the old size at the resize event; the truth
      // is the element's size on the next frame, so check it every frame.
      if (renderer.needsResize()) onResize();
      if (ov.kind === 'none' && !s.gameOver) {
        acc += dt * speed;
        let n = 0;
        while (acc >= DT && n < 4 * speed) {
          step(
            s,
            s.heroes.map((h) => (bot ? botInput(s, h, botRng, s.time) : input.read(h.index))),
            DT,
          );
          acc -= DT;
          n++;
          if (pending()) break;
        }
        if (acc > DT * 4 * speed) acc = 0;
      } else if (s.gameOver) {
        step(s, { dx: 0, dy: 0 }, dt);
        deathAcc += dt;
        if (deathAcc > 1.6 && !endedRef.current) {
          endedRef.current = true;
          // Per-weapon damage rides in one value: "puukko:12345,kokko:999".
          // The tracker truncates values past 200 characters, so only the
          // weapons go, sorted by damage, and taiat and pickups stay out.
          const weaponIds = new Set(s.heroes.flatMap((h) => h.weapons.map((w) => w.id)));
          const byWeapon = Object.entries(s.run.damageBy)
            .filter(([k]) => weaponIds.has(k))
            .sort((a, b) => b[1] - a[1]);
          // Everything that multiplied the damage rides along, each as its
          // own value under the 200-character cap: weapon levels, passives,
          // taiat, altar ranks and the derived multipliers. The first hero's
          // build; a co-op run is marked by players=2.
          const h0 = s.heroes[0];
          const st = h0.stats;
          const level = Math.max(...s.heroes.map((h) => h.player.level));
          track('run_end', {
            character: characters.map((c) => c.id).join('+'),
            players: characters.length,
            time: Math.round(s.time),
            level,
            kills: s.run.kills,
            w: byWeapon.map(([k, v]) => `${k}:${Math.round(v)}`).join(','),
            top: byWeapon[0]?.[0] ?? '',
            wl: h0.weapons.map((w) => `${w.id}:${w.level}`).join(','),
            pas: h0.passives.map((p) => `${p.id}:${p.level}`).join(','),
            tai: h0.powers.map((p) => `${p.id}:${p.level}`).join(','),
            alt: Object.entries(altar)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${k}:${v}`)
              .join(','),
            st: `might:${st.might.toFixed(2)},area:${st.area.toFixed(2)},cd:${st.cooldown.toFixed(2)},amt:${st.amount},spd:${st.speed.toFixed(2)},dur:${st.duration.toFixed(2)},luck:${st.luck.toFixed(2)},curse:${st.curse.toFixed(2)},growth:${st.growth.toFixed(2)},hp:${st.maxHp},armor:${st.armor},regen:${st.regen.toFixed(1)}`,
          });
          onEnd({
            character: characters[0],
            characters,
            time: s.time,
            level,
            levels: s.heroes.map((h) => h.player.level),
            kills: s.run.kills,
            bosses: s.run.bosses,
            chests: s.run.chests,
            weapons: s.heroes.flatMap((h) => h.weapons.map((w) => w.id)),
            passives: s.heroes.flatMap((h) => h.passives.map((p) => p.id)),
            damageDealt: s.run.damageDealt,
            cones: s.run.cones,
            damageBy: Object.fromEntries(byWeapon),
            topWeapon: byWeapon[0]?.[0] ?? null,
          });
        }
      }

      // Sounds queued by the sim, then the mosquito whine from the swarm nearby.
      if (s.sounds.length > 0) {
        for (const name of s.sounds) audio.play(name as never);
        s.sounds.length = 0;
      }
      if (ov.kind === 'none' && !s.gameOver) {
        let near = 0;
        for (const e of s.enemies) if (e.def.behaviour === 'swarm' && Math.abs(e.x - s.cam.x) < 220 && Math.abs(e.y - s.cam.y) < 220) near++;
        audio.setSwarm(near);
      } else audio.setSwarm(0);
      renderer.render(s, dt);
      for (let i = 0; i < s.heroes.length; i++) drawStick(stickRefs.current[i] ?? null, input, i);
      const ms = performance.now() - t0;
      perf.frames++;
      perf.ms += ms;
      if (ms > perf.worst) perf.worst = ms;
      hudAcc += dt;
      if (hudAcc > 0.1) {
        hudAcc = 0;
        publishHud();
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      audio.stopMusic();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
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
        if (i >= 0 && i < ov.offers.length) pick(ov.hero, ov.offers[i]);
      } else if (ov.kind === 'chest' && (e.key === 'Enter' || e.key === ' ')) {
        setOverlay({ kind: 'none' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStickMode = (m: StickMode) => {
    const input = inputRef.current;
    if (input) input.mode = m;
    saveStickMode(m);
    setStickModeState(m);
    audio.play('tap');
  };

  const pick = (heroIndex: number, o: Offer) => {
    const s = simRef.current!;
    applyOffer(s, s.heroes[heroIndex], o);
    audio.play('tap');
    track('pick', { id: o.id, level: o.level, kind: o.kind });
    setOverlay({ kind: 'none' });
  };

  const s = simRef.current;
  const items = (h: HeroHud, right = false) => (
    <div className={'items' + (right ? ' right' : '')}>
      {h.weapons.map((w) => (
        <div key={w.id} className={'it' + (w.evolved ? ' evo' : '')} title={WEAPONS[w.id].name}>
          {icon(WEAPONS[w.id].icon)}
          {!w.evolved && <b>{w.level}</b>}
        </div>
      ))}
      {h.passives.length > 0 && <div className="gap" />}
      {h.passives.map((p) => (
        <div key={p.id} className="it" title={PASSIVES[p.id].name}>
          {icon(PASSIVES[p.id].icon)}
          <b>{p.level}</b>
        </div>
      ))}
      {h.powers.length > 0 && <div className="gap" />}
      {h.powers.map((p) => (
        <div key={p.id} className="it power" title={POWERS[p.id].name}>
          {icon(POWERS[p.id].icon)}
          <b>{p.level}</b>
        </div>
      ))}
    </div>
  );
  const xpbar = (h: HeroHud, i: number) => (
    <div className="xpbar" key={i} style={coop ? { borderColor: HERO_COLORS[i] } : undefined}>
      <div style={{ width: `${Math.min(100, (h.xp / h.xpNext) * 100)}%` }} />
      <span>
        {tr('TASO', 'LEVEL')} {h.level}
      </span>
    </div>
  );
  const hpbar = (h: HeroHud, i: number) => (
    <div className={'hpbar' + (coop ? ` p${i}` : '')} key={i} style={coop ? { borderColor: HERO_COLORS[i] } : undefined}>
      <div style={{ width: `${Math.max(0, (h.hp / h.maxHp) * 100)}%`, opacity: h.alive ? 1 : 0.3 }} />
      <span>{h.alive ? `${Math.ceil(h.hp)} / ${h.maxHp}` : tr('Kaatunut', 'Down')}</span>
    </div>
  );
  return (
    <div className="game" ref={rootRef}>
      <canvas ref={canvasRef} />
      {hud && (
        <>
          <div className="hud">
            {coop ? <div className="xprow">{hud.heroes.map(xpbar)}</div> : xpbar(hud.heroes[0], 0)}
            <div className="hudrow">
              {items(hud.heroes[0])}
              <div className={'hudright' + (coop ? ' mid' : '')}>
                <div className="timer">{fmtTime(hud.time)}</div>
                <div className="kills">☠ {hud.kills}</div>
                {hud.cones > 0 && <div className="kills">🌲 {hud.cones}</div>}
                {hud.keys > 0 && <div className="kills">🔑 {hud.keys}</div>}
              </div>
              {coop && items(hud.heroes[1], true)}
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
          {hud.heroes.map(hpbar)}
          {hud.banner && overlay.kind === 'none' && (
            <div className="banner">
              <div className="t">{hud.banner.text}</div>
              <div className="s">{hud.banner.sub}</div>
            </div>
          )}
          {overlay.kind === 'none' && (
            <>
              <button className="pausebtn" data-ui onClick={() => setOverlay({ kind: 'pause' })} aria-label={tr('Tauko', 'Pause')}>
                II
              </button>
              <button
                className="pausebtn mutebtn"
                data-ui
                aria-label={muted ? tr('Äänet päälle', 'Sound on') : tr('Äänet pois', 'Sound off')}
                onClick={() => {
                  audio.setMuted(!muted);
                  setMuted(!muted);
                }}
              >
                {muted ? '🔇' : '🔊'}
              </button>
            </>
          )}
        </>
      )}
      {characters.map((_, i) => (
        <div
          className="stick"
          key={i}
          ref={(el) => {
            stickRefs.current[i] = el;
          }}
          style={{ display: 'none', borderColor: coop ? HERO_COLORS[i] : undefined }}
        >
          <div />
        </div>
      ))}

      {overlay.kind === 'levelup' && s && (
        <div className="overlay" data-ui>
          {coop && <HeroTag h={s.heroes[overlay.hero]} />}
          <h2>
            {tr('Taso', 'Level')} {s.heroes[overlay.hero].player.level}
          </h2>
          <div className="cards">
            {overlay.offers.map((o, i) => (
              <OfferCard key={o.id + i} o={o} index={i} onPick={(o) => pick(overlay.hero, o)} />
            ))}
          </div>
          {s.heroes[overlay.hero].stats.reroll > 0 && (
            <button
              className="btn ghost reroll"
              onClick={() => {
                const h = s.heroes[overlay.hero];
                h.stats.reroll--;
                audio.play('tap');
                setOverlay({ kind: 'levelup', hero: overlay.hero, offers: rollOffers(s, h) });
              }}
            >
              🎲 {tr('Heitä uudelleen', 'Reroll')} ({s.heroes[overlay.hero].stats.reroll})
            </button>
          )}
        </div>
      )}
      {overlay.kind === 'chest' && s && (
        <div className="overlay" data-ui onClick={() => setOverlay({ kind: 'none' })}>
          <div className="chest">🪵</div>
          {coop && <HeroTag h={s.heroes[overlay.hero]} />}
          <h2>{overlay.result.size === 5 ? tr('Tapion suuri lahja', "Tapio's great gift") : overlay.result.size === 3 ? tr('Tapion lahja', "Tapio's gift") : tr('Arkku', 'Chest')}</h2>
          <div className="cards">
            {overlay.result.items.map((o, i) => (
              <OfferCard key={o.id + i} o={o} />
            ))}
          </div>
          <p className="small">{tr('Napauta jatkaaksesi', 'Tap to continue')}</p>
        </div>
      )}
      {overlay.kind === 'pause' && s && (
        <div className="overlay" data-ui>
          <UpdateBanner />
          <h2>{tr('Tauko', 'Paused')}</h2>
          {!coop && (
            <div className="stats">
              <span>{tr('Aika', 'Time')}</span>
              <b>{fmtTime(s.time)}</b>
              <span>{tr('Taso', 'Level')}</span>
              <b>{s.heroes[0].player.level}</b>
              <span>{tr('Kaadot', 'Kills')}</span>
              <b>{s.run.kills}</b>
              <span>{tr('Vahinko', 'Damage')}</span>
              <b>{Math.round(s.heroes[0].stats.might * 100)} %</b>
              <span>{tr('Alue', 'Area')}</span>
              <b>{Math.round(s.heroes[0].stats.area * 100)} %</b>
              <span>{tr('Latausaika', 'Cooldown')}</span>
              <b>{Math.round(s.heroes[0].stats.cooldown * 100)} %</b>
              <span>{tr('Nopeus', 'Speed')}</span>
              <b>{Math.round(s.heroes[0].stats.moveSpeed * 100)} %</b>
              <span>{tr('Suoja', 'Armor')}</span>
              <b>{s.heroes[0].stats.armor}</b>
              <span>{tr('Palautuminen', 'Recovery')}</span>
              <b>{s.heroes[0].stats.regen.toFixed(1)} /s</b>
              <span>{tr('Onni', 'Luck')}</span>
              <b>{Math.round(s.heroes[0].stats.luck * 100)} %</b>
              <span>{tr('Kirous', 'Curse')}</span>
              <b>{Math.round(s.heroes[0].stats.curse * 100)} %</b>
            </div>
          )}
          {coop && (
            <div className="stats">
              <span>{tr('Aika', 'Time')}</span>
              <b>{fmtTime(s.time)}</b>
              <span>{tr('Kaadot', 'Kills')}</span>
              <b>{s.run.kills}</b>
            </div>
          )}
          <div className="cards">
            {s.heroes.map((h) => (
              <div key={h.index} className="cards">
                {coop && <HeroTag h={h} />}
                {h.powers.map((p) => (
                  <div className="card power" key={p.id} style={{ cursor: 'default' }}>
                    <div className="ic">{icon(POWERS[p.id].icon)}</div>
                    <div className="body">
                      <div className="name">
                        <span>{POWERS[p.id].name}</span>
                        <span className="lvl">
                          {tr('Taika', 'Charm')} {p.level}/{POWERS[p.id].maxLevel}
                        </span>
                      </div>
                      <div className="desc">{POWERS[p.id].desc}</div>
                    </div>
                  </div>
                ))}
                {h.weapons.map((w) => {
                  const def = WEAPONS[w.id];
                  const evo = def.evolvesWith ? PASSIVES[def.evolvesWith] : null;
                  return (
                    <div className="card" key={w.id} style={{ cursor: 'default' }}>
                      <div className="ic">{icon(def.icon)}</div>
                      <div className="body">
                        <div className="name">
                          <span>{def.name}</span>
                          <span className="lvl">{def.evolved ? tr('Kehittynyt', 'Evolved') : `${tr('Taso', 'Level')} ${w.level}/${def.levels.length + 1}`}</span>
                        </div>
                        {evo && !def.evolved && (
                          <div className="desc">
                            {tr('Kehittyy: taso', 'Evolves: level')} {def.levels.length + 1} + {icon(evo.icon)} {evo.name}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={() => setOverlay({ kind: 'none' })}>
              {tr('Jatka', 'Continue')}
            </button>
            <button className="btn ghost" onClick={() => setStickMode(stickMode === 'float' ? 'fixed' : 'float')}>
              {stickMode === 'float' ? tr('🕹️ Ohjain: kelluva', '🕹️ Stick: floating') : tr('🕹️ Ohjain: kiinteä', '🕹️ Stick: fixed')}
            </button>
            <button className="btn ghost" onClick={onRestart}>
              {tr('Aloita alusta', 'Restart')}
            </button>
            <button className="btn ghost" onClick={onQuit}>
              {tr('Lopeta peli', 'Quit run')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Draw one player's stick straight into the DOM, every frame. Going through
 * React state at ten hertz made the knob lag the thumb by up to a tenth of
 * a second, which read as sluggish control.
 */
export function drawStick(el: HTMLDivElement | null, input: InputController, i: number): void {
  if (!el) return;
  const st = input.sticks[i];
  const idleFixed = !st.active && input.mode === 'fixed';
  if (!st.active && !idleFixed) {
    el.style.display = 'none';
    return;
  }
  const cx = st.active ? st.cx : st.baseX;
  const cy = st.active ? st.cy : st.baseY;
  el.style.display = 'block';
  el.style.left = cx + 'px';
  el.style.top = cy + 'px';
  el.style.opacity = st.active ? '1' : '0.45';
  const knob = el.firstElementChild as HTMLElement | null;
  if (!knob) return;
  if (!st.active) {
    knob.style.transform = 'translate(-50%, -50%)';
    return;
  }
  // The knob follows the thumb inside the ring and stops at its edge.
  const dx = st.x - cx;
  const dy = st.y - cy;
  const d = Math.hypot(dx, dy);
  const r = input.radius;
  const k = d > r ? r / d : 1;
  knob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
}
