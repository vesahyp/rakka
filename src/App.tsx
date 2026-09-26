import { useState } from 'react';
import type { CharacterDef } from './game/content/characters';
import { Game, type RunSummary } from './ui/Game';
import { Title, Select, Death, RecordsScreen } from './ui/Screens';
import { loadRecords, saveRun, type Records } from './records';
import { UpdateBanner } from './ui/Update';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { BUILD } from './version';

type Screen = { kind: 'title' } | { kind: 'select' } | { kind: 'records' } | { kind: 'run'; character: CharacterDef; seed: number } | { kind: 'dead'; r: RunSummary; rank: number; charBest: boolean };

export default function App() {
  return (
    <ErrorBoundary>
      <Screens />
    </ErrorBoundary>
  );
}

function Screens() {
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  const [records, setRecords] = useState<Records>(() => loadRecords());

  const start = (character: CharacterDef) => setScreen({ kind: 'run', character, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });

  let body;
  switch (screen.kind) {
    case 'title':
      body = <Title records={records} onPlay={() => setScreen({ kind: 'select' })} onRecords={() => setScreen({ kind: 'records' })} />;
      break;
    case 'select':
      body = <Select records={records} onPick={start} onBack={() => setScreen({ kind: 'title' })} />;
      break;
    case 'records':
      body = <RecordsScreen records={records} onBack={() => setScreen({ kind: 'title' })} />;
      break;
    case 'run':
      body = (
        <Game
          key={screen.seed}
          character={screen.character}
          seed={screen.seed}
          onQuit={() => setScreen({ kind: 'select' })}
          onRestart={() => start(screen.character)}
          onEnd={(r) => {
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
            setScreen({ kind: 'dead', r, rank: saved.rank, charBest: saved.charBest });
          }}
        />
      );
      break;
    case 'dead':
      body = <Death r={screen.r} rank={screen.rank} charBest={screen.charBest} onAgain={() => start(screen.r.character)} onMenu={() => setScreen({ kind: 'select' })} />;
      break;
  }
  return (
    <>
      {body}
      {screen.kind !== 'run' && <UpdateBanner />}
      {screen.kind === 'title' && <div className="build">{BUILD}</div>}
    </>
  );
}
