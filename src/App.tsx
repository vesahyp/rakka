import { useState } from 'react';
import type { CharacterDef } from './game/content/characters';
import { Game, type RunSummary } from './ui/Game';
import { Title, Select, Death, RecordsScreen } from './ui/Screens';
import { loadRecords, saveRun, type Records } from './records';

type Screen = { kind: 'title' } | { kind: 'select' } | { kind: 'records' } | { kind: 'run'; character: CharacterDef; seed: number } | { kind: 'dead'; r: RunSummary; rank: number; charBest: boolean };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  const [records, setRecords] = useState<Records>(() => loadRecords());

  const start = (character: CharacterDef) => setScreen({ kind: 'run', character, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });

  switch (screen.kind) {
    case 'title':
      return <Title records={records} onPlay={() => setScreen({ kind: 'select' })} onRecords={() => setScreen({ kind: 'records' })} />;
    case 'select':
      return <Select records={records} onPick={start} onBack={() => setScreen({ kind: 'title' })} />;
    case 'records':
      return <RecordsScreen records={records} onBack={() => setScreen({ kind: 'title' })} />;
    case 'run':
      return (
        <Game
          key={screen.seed}
          character={screen.character}
          seed={screen.seed}
          onQuit={() => setScreen({ kind: 'select' })}
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
    case 'dead':
      return <Death r={screen.r} rank={screen.rank} charBest={screen.charBest} onAgain={() => start(screen.r.character)} onMenu={() => setScreen({ kind: 'select' })} />;
  }
}
