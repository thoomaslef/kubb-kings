import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { TEAMS, OPPONENT } from '../game/entities/Team';
import { AI_TEAM } from '../game/ai';
import type { MatchResult } from '../store/useGameStore';

/** En solo le joueur n'est pas "l'equipe Bleue" : c'est lui. */
function headline(result: MatchResult, solo: boolean) {
  if (result.winner === 'draw') return 'Match nul';
  if (solo) return result.winner === AI_TEAM ? 'Defaite' : 'Victoire !';
  return `Victoire de l'equipe ${TEAMS[result.winner].label}`;
}

function detail(result: MatchResult) {
  switch (result.reason) {
    case 'king-down':
      return 'Le roi est tombe dans les regles.';
    case 'king-early':
      return result.winner === 'draw'
        ? ''
        : `L'equipe ${TEAMS[OPPONENT[result.winner]].label} a touche le roi avant d'avoir abattu tous les kubbs adverses.`;
    case 'timeout':
      return 'Temps ecoule : le plus grand nombre de kubbs abattus l’emporte.';
    case 'throws-exhausted':
      return 'Plus de lancers : le plus grand nombre de kubbs abattus l’emporte.';
    default:
      return '';
  }
}

export function ResultScreen() {
  const result = useGameStore((s) => s.result);
  const setScreen = useGameStore((s) => s.setScreen);
  const solo = useGameStore((s) => s.mode) === 'solo';
  if (!result) return null;

  const accent = result.winner === 'draw' ? '#f2c14e' : TEAMS[result.winner].cssColor;

  return (
    <div className="overlay overlay--solid">
      <div className="panel">
        <h2 className="panel__title" style={{ color: accent }}>
          {headline(result, solo)}
        </h2>
        <p className="panel__text">{detail(result)}</p>

        <div className="score-row">
          <div className="score-cell" style={{ borderColor: TEAMS.blue.cssColor }}>
            <span className="score-cell__value">{result.knockedDown.blue}</span>
            <span className="score-cell__label">kubbs abattus &mdash; {solo ? 'Vous' : 'Bleue'}</span>
          </div>
          <div className="score-cell" style={{ borderColor: TEAMS.red.cssColor }}>
            <span className="score-cell__value">{result.knockedDown.red}</span>
            <span className="score-cell__label">kubbs abattus &mdash; {solo ? 'IA' : 'Rouge'}</span>
          </div>
        </div>

        <div className="button-column">
          <button className="btn btn--primary" onClick={() => bridge.send('restart-match')}>
            Rejouer
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => {
              bridge.send('leave-match');
              setScreen('menu');
            }}
          >
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}
