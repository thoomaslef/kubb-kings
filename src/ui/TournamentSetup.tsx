import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import type { TournamentSize } from '../game/tournament';

const SIZES: TournamentSize[] = [4, 8];

/**
 * Choix de la taille et des noms, avant de lancer le tournoi. Le premier
 * match (round 0, slot 0) oppose toujours names[0] a names[1] par
 * construction de buildBracket — pas besoin de le recalculer ici.
 */
export function TournamentSetup() {
  const setScreen = useGameStore((s) => s.setScreen);
  const setMode = useGameStore((s) => s.setMode);
  const startTournament = useGameStore((s) => s.startTournament);
  const beginTournamentMatch = useGameStore((s) => s.beginTournamentMatch);

  const [size, setSize] = useState<TournamentSize>(4);
  const [names, setNames] = useState<string[]>(Array(8).fill(''));

  const setName = (i: number, value: string) => {
    const next = [...names];
    next[i] = value;
    setNames(next);
  };

  const start = () => {
    const finalNames = names.slice(0, size).map((n, i) => n.trim() || `Joueur ${i + 1}`);
    setMode('local');
    startTournament(finalNames);
    beginTournamentMatch(0, 0, finalNames[0], finalNames[1]);
    bridge.send('start-match');
  };

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--scroll">
        <h2 className="panel__title">Tournoi local</h2>
        <p className="panel__text">
          Elimination directe, pass-and-play : chacun joue sur le meme telephone, a tour de
          role.
        </p>

        <div className="segmented" role="group" aria-label="Taille du tournoi">
          {SIZES.map((n) => (
            <button
              key={n}
              className={`segmented__item${n === size ? ' segmented__item--on' : ''}`}
              aria-pressed={n === size}
              onClick={() => setSize(n)}
            >
              {n} joueurs
            </button>
          ))}
        </div>

        <div className="button-column" style={{ marginTop: 16, marginBottom: 20 }}>
          {names.slice(0, size).map((name, i) => (
            <input
              key={i}
              className="text-input"
              placeholder={`Joueur ${i + 1}`}
              value={name}
              onChange={(e) => setName(i, e.target.value)}
            />
          ))}
        </div>

        <div className="button-column">
          <button className="btn btn--primary" onClick={start}>
            Commencer le tournoi
          </button>
          <button className="btn btn--ghost" onClick={() => setScreen('menu')}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
