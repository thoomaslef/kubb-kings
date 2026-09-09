import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { champion, nextMatch, roundLabelKey } from '../game/tournament';
import { useT } from '../i18n/useT';

/**
 * Tableau du tournoi entre deux matchs : qui a gagne quoi, et le prochain
 * match a jouer (ou le champion, une fois la finale jouee).
 */
export function TournamentBracket() {
  const t = useT();
  const tournament = useGameStore((s) => s.tournament);
  const setScreen = useGameStore((s) => s.setScreen);
  const beginTournamentMatch = useGameStore((s) => s.beginTournamentMatch);
  const resetTournament = useGameStore((s) => s.resetTournament);

  if (!tournament) return null;

  const champ = champion(tournament);
  const next = champ ? null : nextMatch(tournament);

  const playNext = () => {
    if (!next) return;
    beginTournamentMatch(next.round, next.slot, next.a as string, next.b as string);
    bridge.send('restart-match');
  };

  const quit = () => {
    resetTournament();
    bridge.send('leave-match');
    setScreen('menu');
  };

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--scroll">
        <h2 className="panel__title">{t('tournament.bracket.title')}</h2>

        {tournament.rounds.map((round, r) => {
          const { key, params } = roundLabelKey(r, tournament.rounds.length);
          return (
            <div key={r} style={{ marginBottom: 16 }}>
              <h3 className="bracket__round-title">{t(key, params)}</h3>
              <div className="button-column">
                {round.map((match, i) => (
                  <div key={i} className="bracket__match">
                    <span className={match.winner && match.winner === match.a ? 'bracket__winner' : ''}>
                      {match.a ?? '?'}
                    </span>
                    <span className="bracket__vs">vs</span>
                    <span className={match.winner && match.winner === match.b ? 'bracket__winner' : ''}>
                      {match.b ?? '?'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {champ ? (
          <>
            <p className="panel__text" style={{ color: 'var(--gold)', fontWeight: 700 }}>
              {t('tournament.bracket.champion', { name: champ })}
            </p>
            <div className="button-column">
              <button className="btn btn--primary" onClick={() => setScreen('tournament-setup')}>
                {t('tournament.bracket.newTournament')}
              </button>
              <button className="btn btn--ghost" onClick={quit}>
                {t('tournament.bracket.menu')}
              </button>
            </div>
          </>
        ) : next ? (
          <div className="button-column">
            <button className="btn btn--primary" onClick={playNext}>
              {t('tournament.bracket.play', { a: next.a as string, b: next.b as string })}
            </button>
            <button className="btn btn--ghost" onClick={quit}>
              {t('tournament.bracket.forfeit')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
