import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { AI_PROFILES, type Difficulty } from '../game/ai';

const LEVELS = Object.keys(AI_PROFILES) as Difficulty[];

export function Menu() {
  const setScreen = useGameStore((s) => s.setScreen);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const setMode = useGameStore((s) => s.setMode);

  const play = (mode: 'solo' | 'local') => {
    setMode(mode);
    bridge.send('start-match');
  };

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--menu">
        <h1 className="title">
          KUBB<span className="title__accent">: Kings</span>
        </h1>
        <p className="subtitle">Le duel de lancer, sur un seul telephone.</p>

        <div className="button-column">
          <button className="btn btn--primary" onClick={() => play('solo')}>
            Solo &mdash; contre l&apos;IA
          </button>

          <div className="segmented" role="group" aria-label="Niveau de l&apos;IA">
            {LEVELS.map((level) => (
              <button
                key={level}
                className={`segmented__item${level === difficulty ? ' segmented__item--on' : ''}`}
                aria-pressed={level === difficulty}
                onClick={() => setDifficulty(level)}
              >
                {AI_PROFILES[level].label}
              </button>
            ))}
          </div>
          <p className="footnote footnote--tight">{AI_PROFILES[difficulty].hint}</p>

          <button className="btn" onClick={() => play('local')}>
            1v1 local &mdash; a deux
          </button>
          <button className="btn" onClick={() => setScreen('rules')}>
            Regles
          </button>
          <button className="btn btn--ghost" onClick={() => setScreen('quit')}>
            Quitter
          </button>
        </div>

        <p className="footnote">Pass-and-play &middot; 4 minutes max</p>
      </div>
    </div>
  );
}
