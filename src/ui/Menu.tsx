import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { AI_PROFILES, type Difficulty } from '../game/ai';
import { FIELD_PRESETS, type FieldPresetId } from '../game/rules';

const LEVELS = Object.keys(AI_PROFILES) as Difficulty[];
const PRESETS = Object.keys(FIELD_PRESETS) as FieldPresetId[];

export function Menu() {
  const setScreen = useGameStore((s) => s.setScreen);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const fieldPreset = useGameStore((s) => s.fieldPreset);
  const setFieldPreset = useGameStore((s) => s.setFieldPreset);
  const setMode = useGameStore((s) => s.setMode);

  const play = (mode: 'solo' | 'local' | '2v2') => {
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
          <button className="btn" onClick={() => play('2v2')}>
            2v2 local &mdash; a quatre
          </button>

          <div className="segmented" role="group" aria-label="Terrain">
            {PRESETS.map((id) => (
              <button
                key={id}
                className={`segmented__item${id === fieldPreset ? ' segmented__item--on' : ''}`}
                aria-pressed={id === fieldPreset}
                onClick={() => setFieldPreset(id)}
              >
                {FIELD_PRESETS[id].label}
              </button>
            ))}
          </div>
          <p className="footnote footnote--tight">{FIELD_PRESETS[fieldPreset].hint}</p>

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
