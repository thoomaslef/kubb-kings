import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { TEAMS, OPPONENT } from '../game/entities/teamData';
import { AI_TEAM } from '../game/ai';
import { levelFromXp } from '../game/progression';
import { LADDER, setBestStageIfHigher } from '../game/roguelite';
import { translate, type Lang } from '../i18n/translate';
import { useT } from '../i18n/useT';
import type { MatchResult } from '../store/useGameStore';

/** En solo (et en Defi, qui en est une variante) le joueur n'est pas "l'equipe Bleue" : c'est lui. */
function headline(lang: Lang, result: MatchResult, soloLike: boolean) {
  if (result.winner === 'draw') return translate(lang, 'result.draw');
  if (soloLike) return translate(lang, result.winner === AI_TEAM ? 'result.defeat' : 'result.victory');
  return translate(lang, 'result.teamVictory', { team: translate(lang, `team.${result.winner}.label`) });
}

function detail(lang: Lang, result: MatchResult) {
  switch (result.reason) {
    case 'king-down':
      return translate(lang, 'result.detail.kingDown');
    case 'king-early':
      return result.winner === 'draw'
        ? ''
        : translate(lang, 'result.detail.kingEarly', {
            team: translate(lang, `team.${OPPONENT[result.winner]}.label`)
          });
    case 'timeout':
      return translate(lang, 'result.detail.timeout');
    case 'throws-exhausted':
      return translate(lang, 'result.detail.throwsExhausted');
    default:
      return '';
  }
}

export function ResultScreen() {
  const t = useT();
  const lang = useGameStore((s) => s.lang);
  const result = useGameStore((s) => s.result);
  const setScreen = useGameStore((s) => s.setScreen);
  const mode = useGameStore((s) => s.mode);
  const run = useGameStore((s) => s.run);
  const startRun = useGameStore((s) => s.startRun);
  const tournamentPending = useGameStore((s) => s.tournamentPending);
  const reportTournamentResult = useGameStore((s) => s.reportTournamentResult);
  const resetTournament = useGameStore((s) => s.resetTournament);
  const progression = useGameStore((s) => s.progression);
  const lastXpAward = useGameStore((s) => s.lastXpAward);
  const lastCoinsAward = useGameStore((s) => s.lastCoinsAward);
  const isDefi = mode === 'defi';
  const soloLike = mode === 'solo' || isDefi;
  const isTournamentMatch = tournamentPending !== null;

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
  const levelInfo = levelFromXp(progression.totalXp);
  const tournamentWinnerName =
    isTournamentMatch && result.winner !== 'draw'
      ? result.winner === 'blue'
        ? tournamentPending.blueName
        : tournamentPending.redName
      : null;

  const quitRun = () => {
    bridge.send('leave-match');
    setScreen('menu');
  };

  const newRun = () => {
    startRun();
    bridge.send('restart-match');
  };

  const continueTournament = () => {
    reportTournamentResult();
    setScreen('tournament');
  };

  const quitTournament = () => {
    resetTournament();
    bridge.send('leave-match');
    setScreen('menu');
  };

  return (
    <div className="overlay overlay--solid">
      <div className="panel">
        <h2 className="panel__title" style={{ color: accent }}>
          {isTournamentMatch
            ? tournamentWinnerName
              ? t('result.tournament.win', { name: tournamentWinnerName })
              : t('result.tournament.draw')
            : isDefi && wonMatch && !runComplete
              ? t('result.defi.stageCleared', { n: stagesCleared })
              : headline(lang, result, soloLike)}
        </h2>
        <p className="panel__text">
          {isTournamentMatch
            ? tournamentWinnerName
              ? detail(lang, result)
              : t('result.tournament.replayHint')
            : isDefi
              ? runComplete
                ? t('result.defi.runComplete', { total: LADDER.length })
                : wonMatch
                  ? detail(lang, result)
                  : t(stagesCleared === 1 ? 'result.defi.runOver.one' : 'result.defi.runOver.many', {
                      stage: stageIndex + 1,
                      cleared: stagesCleared
                    })
              : detail(lang, result)}
        </p>

        <div className="score-row">
          <div className="score-cell" style={{ borderColor: TEAMS.blue.cssColor }}>
            <span className="score-cell__value">{result.knockedDown.blue}</span>
            <span className="score-cell__label">
              {t('result.knockedLabel')} &mdash;{' '}
              {isTournamentMatch ? tournamentPending.blueName : soloLike ? t('result.you') : t('team.blue.label')}
            </span>
          </div>
          <div className="score-cell" style={{ borderColor: TEAMS.red.cssColor }}>
            <span className="score-cell__value">{result.knockedDown.red}</span>
            <span className="score-cell__label">
              {t('result.knockedLabel')} &mdash;{' '}
              {isTournamentMatch ? tournamentPending.redName : soloLike ? t('result.ai') : t('team.red.label')}
            </span>
          </div>
        </div>

        {lastXpAward && (
          <div className="xp-panel">
            {lastXpAward.levelAfter > lastXpAward.levelBefore && (
              <p className="xp-panel__levelup">{t('progression.levelUp')}</p>
            )}
            <div className="xp-panel__header">
              <span className="xp-panel__icon">{levelInfo.icon}</span>
              <span className="xp-panel__level">{t('progression.level', { n: levelInfo.level })}</span>
              <span className="xp-panel__title">{t(levelInfo.titleKey)}</span>
              <span className="xp-panel__gain">{t('progression.xpGained', { n: lastXpAward.total })}</span>
            </div>
            <div className="xp-panel__bar-track">
              <div
                className="xp-panel__bar-fill"
                style={{ width: `${Math.min(100, (levelInfo.xpIntoLevel / levelInfo.xpForThisLevel) * 100)}%` }}
              />
            </div>
            <p className="xp-panel__bar-label">
              {levelInfo.xpIntoLevel} / {levelInfo.xpForThisLevel} XP
            </p>
            {lastCoinsAward !== null && (
              <p className="xp-panel__coins">{t('result.coinsGained', { n: lastCoinsAward })}</p>
            )}
          </div>
        )}

        <div className="button-column">
          {isTournamentMatch ? (
            tournamentWinnerName ? (
              <>
                <button className="btn btn--primary" onClick={continueTournament}>
                  {t('result.tournament.seeBracket')}
                </button>
                <button className="btn btn--ghost" onClick={quitTournament}>
                  {t('result.tournament.forfeit')}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn--primary" onClick={() => bridge.send('restart-match')}>
                  {t('result.tournament.replay')}
                </button>
                <button className="btn btn--ghost" onClick={quitTournament}>
                  {t('result.tournament.forfeit')}
                </button>
              </>
            )
          ) : isDefi ? (
            wonMatch && !runComplete ? (
              <>
                <button className="btn btn--primary" onClick={() => setScreen('perk')}>
                  {t('result.defi.nextStage')}
                </button>
                <button className="btn btn--ghost" onClick={quitRun}>
                  {t('result.defi.abandonRun')}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn--primary" onClick={newRun}>
                  {t('result.defi.newRun')}
                </button>
                <button className="btn btn--ghost" onClick={quitRun}>
                  {t('result.menu')}
                </button>
              </>
            )
          ) : (
            <>
              <button className="btn btn--primary" onClick={() => bridge.send('restart-match')}>
                {t('result.replay')}
              </button>
              <button className="btn btn--ghost" onClick={quitRun}>
                {t('result.menu')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
