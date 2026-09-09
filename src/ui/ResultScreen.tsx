import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { TEAMS, OPPONENT } from '../game/entities/Team';
import { AI_TEAM } from '../game/ai';
import { LADDER, setBestStageIfHigher } from '../game/roguelite';
import type { MatchResult } from '../store/useGameStore';

/** En solo (et en Defi, qui en est une variante) le joueur n'est pas "l'equipe Bleue" : c'est lui. */
function headline(result: MatchResult, soloLike: boolean) {
  if (result.winner === 'draw') return 'Match nul';
  if (soloLike) return result.winner === AI_TEAM ? 'Defaite' : 'Victoire !';
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
  const mode = useGameStore((s) => s.mode);
  const run = useGameStore((s) => s.run);
  const startRun = useGameStore((s) => s.startRun);
  const isDefi = mode === 'defi';
  const soloLike = mode === 'solo' || isDefi;

  const wonMatch = result?.winner === 'blue';
  const stageIndex = run?.stageIndex ?? 0;
  // Nombre de manches franchies : celle-ci comptee si elle vient d'etre gagnee.
  const stagesCleared = wonMatch ? stageIndex + 1 : stageIndex;
  const runComplete = wonMatch && stagesCleared >= LADDER.length;

  // Persiste la meilleure serie une seule fois par resultat, avant que
  // "Manche suivante" ou "Nouvelle run" ne fasse avancer `run`.
  const persistedFor = useRef<MatchResult | null>(null);
  useEffect(() => {
    if (!isDefi || !result || persistedFor.current === result) return;
    persistedFor.current = result;
    setBestStageIfHigher(stagesCleared);
  }, [isDefi, result, stagesCleared]);

  if (!result) return null;

  const accent = result.winner === 'draw' ? '#f2c14e' : TEAMS[result.winner].cssColor;

  const quitRun = () => {
    bridge.send('leave-match');
    setScreen('menu');
  };

  const newRun = () => {
    startRun();
    bridge.send('restart-match');
  };

  return (
    <div className="overlay overlay--solid">
      <div className="panel">
        <h2 className="panel__title" style={{ color: accent }}>
          {isDefi && wonMatch && !runComplete ? `Manche ${stagesCleared} franchie !` : headline(result, soloLike)}
        </h2>
        <p className="panel__text">
          {isDefi
            ? runComplete
              ? `Run terminee : les ${LADDER.length} manches sont passees. Bravo.`
              : wonMatch
                ? detail(result)
                : `Run terminee a la manche ${stageIndex + 1} — ${stagesCleared} manche${
                    stagesCleared === 1 ? '' : 's'
                  } franchie${stagesCleared === 1 ? '' : 's'}.`
            : detail(result)}
        </p>

        <div className="score-row">
          <div className="score-cell" style={{ borderColor: TEAMS.blue.cssColor }}>
            <span className="score-cell__value">{result.knockedDown.blue}</span>
            <span className="score-cell__label">kubbs abattus &mdash; {soloLike ? 'Vous' : 'Bleue'}</span>
          </div>
          <div className="score-cell" style={{ borderColor: TEAMS.red.cssColor }}>
            <span className="score-cell__value">{result.knockedDown.red}</span>
            <span className="score-cell__label">kubbs abattus &mdash; {soloLike ? 'IA' : 'Rouge'}</span>
          </div>
        </div>

        <div className="button-column">
          {isDefi ? (
            wonMatch && !runComplete ? (
              <>
                <button className="btn btn--primary" onClick={() => setScreen('perk')}>
                  Manche suivante
                </button>
                <button className="btn btn--ghost" onClick={quitRun}>
                  Abandonner la run
                </button>
              </>
            ) : (
              <>
                <button className="btn btn--primary" onClick={newRun}>
                  Nouvelle run
                </button>
                <button className="btn btn--ghost" onClick={quitRun}>
                  Menu
                </button>
              </>
            )
          ) : (
            <>
              <button className="btn btn--primary" onClick={() => bridge.send('restart-match')}>
                Rejouer
              </button>
              <button className="btn btn--ghost" onClick={quitRun}>
                Menu
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
