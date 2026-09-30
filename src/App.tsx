import { useEffect, useState } from 'react';
import type { CharacterDef } from './game/content/characters';
import { Game, type RunSummary } from './ui/Game';
import { Title, Select, Death, RecordsScreen } from './ui/Screens';
import { StatsScreen } from './ui/StatsScreen';
import { Altar } from './ui/Altar';
import { loadMeta, metaStats, earnCones, conesForRun, type Meta } from './meta';
import { loadRecords, saveRun, type Records } from './records';
import { UpdateBanner } from './ui/Update';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { BUILD, BUILD_NAME } from './version';
import { lang, setLang } from './i18n';

type Screen = { kind: 'title' } | { kind: 'select'; players: 1 | 2 } | { kind: 'records' } | { kind: 'stats' } | { kind: 'altar' } | { kind: 'run'; characters: CharacterDef[]; seed: number } | { kind: 'dead'; r: RunSummary; rank: number; charBest: boolean; cones: number };

export default function App() {
  return (
    <ErrorBoundary>
      <Screens />
    </ErrorBoundary>
  );
}

function Screens() {
  // ?stats opens the traffic board; nothing in the game links to it.
  const [screen, setScreen] = useState<Screen>(() => (new URLSearchParams(location.search).has('stats') ? { kind: 'stats' } : { kind: 'title' }));
  const [records, setRecords] = useState<Records>(() => loadRecords());
  const [meta, setMeta] = useState<Meta>(() => loadMeta());
  // The language is module state (i18n.ts); this copy only re-renders the screens when it changes.
  const [, setLangState] = useState(lang);
  // iOS can leave the fixed body scrolled after a keyboard; every screen
  // starts from the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen.kind]);

  const start = (characters: CharacterDef[]) => setScreen({ kind: 'run', characters, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });

  let body;
  switch (screen.kind) {
    case 'title':
      body = (
        <Title
          records={records} meta={meta} onPlay={(players) => setScreen({ kind: 'select', players })} onRecords={() => setScreen({ kind: 'records' })} onAltar={() => setScreen({ kind: 'altar' })}
          onLang={(l) => {
            setLang(l);
            setLangState(l);
          }}
        />
      );
      break;
    case 'select':
      body = <Select records={records} players={screen.players} onPick={start} onBack={() => setScreen({ kind: 'title' })} />;
      break;
    case 'records':
      body = <RecordsScreen records={records} onBack={() => setScreen({ kind: 'title' })} />;
      break;
    case 'stats':
      body = <StatsScreen onBack={() => setScreen({ kind: 'title' })} />;
      break;
    case 'altar':
      body = <Altar meta={meta} onChange={setMeta} onBack={() => setScreen({ kind: 'title' })} />;
      break;
    case 'run':
      body = (
        <Game
          key={screen.seed}
          characters={screen.characters}
          seed={screen.seed}
          meta={metaStats(meta)}
          altar={meta.ranks}
          onQuit={() => setScreen({ kind: 'select', players: screen.characters.length > 1 ? 2 : 1 })}
          onRestart={() => start(screen.characters)}
          onEnd={(r) => {
            const cones = conesForRun(r);
            setMeta(earnCones(cones));
            // A co-op run earns cones but stays off the tables: the boards
            // rank one hero's build, and two builds on one screen is
            // another game.
            if (r.characters.length > 1) {
              setScreen({ kind: 'dead', r, rank: -1, charBest: false, cones });
              return;
            }
            const saved = saveRun({
              character: r.character.id,
              time: r.time,
              level: r.level,
              kills: r.kills,
              bosses: r.bosses,
              chests: r.chests,
              date: new Date().toISOString(),
              weapons: r.weapons,
            });
            setRecords(saved.records);
            setScreen({ kind: 'dead', r, rank: saved.rank, charBest: saved.charBest, cones });
          }}
        />
      );
      break;
    case 'dead':
      body = <Death r={screen.r} rank={screen.rank} charBest={screen.charBest} cones={screen.cones} onAgain={() => start(screen.r.characters)} onMenu={() => setScreen({ kind: 'select', players: screen.r.characters.length > 1 ? 2 : 1 })} />;
      break;
  }
  return (
    <>
      {body}
      {screen.kind !== 'run' && <UpdateBanner />}
      {screen.kind === 'title' && (
        <div className="build">
          {BUILD_NAME} · {BUILD}
        </div>
      )}
    </>
  );
}
