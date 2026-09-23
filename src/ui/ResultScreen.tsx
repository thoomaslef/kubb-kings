import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { TEAMS, OPPONENT, type TeamId } from '../game/entities/teamData';
import { levelFromXp } from '../game/progression';
import { LADDER, setBestStageIfHigher } from '../game/roguelite';
import { downloadBlob, shareCardBlob } from '../game/shareCard';
import { translate, type Lang } from '../i18n/translate';
import { useT } from '../i18n/useT';
import type { MatchResult } from '../store/useGameStore';

type ShareStatus = 'idle' | 'sharing' | 'shared' | 'downloaded' | 'error';

/**
 * En solo (et en Defi, qui en est une variante) le joueur n'est pas
 * "l'equipe Bleue" : c'est lui. La victoire se lit donc sur SON camp
 * (`profileTeam`) et non sur une couleur en dur — l'ancienne version
 * deduisait la defaite de `winner === AI_TEAM`, ce qui revient a supposer
 * que l'adversaire est toujours Rouge : vrai contre l'IA, faux en ligne.
 */
function headline(lang: Lang, result: MatchResult, soloLike: boolean, profileTeam: TeamId) {
  if (result.winner === 'draw') return translate(lang, 'result.draw');
  if (soloLike) return translate(lang, result.winner === profileTeam ? 'result.victory' : 'result.defeat');
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
  const profileTeam = useGameStore((s) => s.profileTeam);
  const run = useGameStore((s) => s.run);
  const startRun = useGameStore((s) => s.startRun);
  const tournamentPending = useGameStore((s) => s.tournamentPending);
  const reportTournamentResult = useGameStore((s) => s.reportTournamentResult);
  const resetTournament = useGameStore((s) => s.resetTournament);
  const progression = useGameStore((s) => s.progression);
  const lastXpAward = useGameStore((s) => s.lastXpAward);
  const lastCoinsAward = useGameStore((s) => s.lastCoinsAward);
  const lastAchievementsUnlocked = useGameStore((s) => s.lastAchievementsUnlocked);
  const isDefi = mode === 'defi';
  const isOnline = mode === 'online';
  // En ligne comme en solo, le joueur n'a qu'un camp : le titre se lit de son
  // point de vue ("Victoire") et non de celui d'un arbitre ("Bleue gagne").
  const soloLike = mode === 'solo' || isDefi || isOnline;
  const isTournamentMatch = tournamentPending !== null;

  // "J'ai gagne" se lit sur le camp du joueur de cet appareil, pas sur la
  // couleur : en ligne, l'invite tient Rouge (cf. `profileTeam`).
  const wonMatch = result?.winner === profileTeam;
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

  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');

  if (!result) return null;

  const accent = result.winner === 'draw' ? '#f2c14e' : TEAMS[result.winner].cssColor;
  const levelInfo = levelFromXp(progression.totalXp);
  const tournamentWinnerName =
    isTournamentMatch && result.winner !== 'draw'
      ? result.winner === 'blue'
        ? tournamentPending.blueName
        : tournamentPending.redName
      : null;

  const headlineText = isTournamentMatch
    ? tournamentWinnerName
      ? t('result.tournament.win', { name: tournamentWinnerName })
      : t('result.tournament.draw')
    : isDefi && wonMatch && !runComplete
      ? t('result.defi.stageCleared', { n: stagesCleared })
      : headline(lang, result, soloLike, profileTeam);

  const detailText = isTournamentMatch
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
      : detail(lang, result);

  // "Vous" va au camp du profil, pas a Bleue : en solo c'est le meme, en
  // ligne ce ne le sera pas toujours.
  const sideLabel = (team: TeamId) =>
    soloLike ? t(team === profileTeam ? 'result.you' : 'result.ai') : t(`team.${team}.label`);
  const blueLabel = isTournamentMatch ? tournamentPending.blueName : sideLabel('blue');
  const redLabel = isTournamentMatch ? tournamentPending.redName : sideLabel('red');

  const levelLine = lastXpAward
    ? [
        t('progression.level', { n: levelInfo.level }),
        t('progression.xpGained', { n: lastXpAward.total }),
        ...(lastCoinsAward !== null ? [t('result.coinsGainedPlain', { n: lastCoinsAward })] : [])
      ].join(' · ')
    : null;

  const handleShare = async () => {
    setShareStatus('sharing');
    let blob: Blob;
    try {
      blob = await shareCardBlob({
        tagline: t('menu.subtitle'),
        headline: headlineText,
        detail: detailText,
        blueLabel,
        blueScore: result.knockedDown.blue,
        redLabel,
        redScore: result.knockedDown.red,
        blueColor: TEAMS.blue.cssColor,
        redColor: TEAMS.red.cssColor,
        accent,
        levelLine
      });
    } catch {
      setShareStatus('error');
      return;
    }

    const file = new File([blob], 'kubb-kings-resultat.png', { type: 'image/png' });
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: t('result.shareTitle'), text: t('result.shareText') });
        setShareStatus('shared');
        return;
      }
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') {
        setShareStatus('idle');
        return;
      }
      // Le partage a echoue (ex : navigateur qui accepte canShare mais rejette
      // ensuite) : on retombe sur le telechargement plutot que d'abandonner.
    }
    downloadBlob(file, 'kubb-kings-resultat.png');
    setShareStatus('downloaded');
  };

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
          {headlineText}
        </h2>
        <p className="panel__text">{detailText}</p>

        <div className="score-row">
          <div className="score-cell" style={{ borderColor: TEAMS.blue.cssColor }}>
            <span className="score-cell__value">{result.knockedDown.blue}</span>
            <span className="score-cell__label">
              {t('result.knockedLabel')} &mdash; {blueLabel}
            </span>
          </div>
          <div className="score-cell" style={{ borderColor: TEAMS.red.cssColor }}>
            <span className="score-cell__value">{result.knockedDown.red}</span>
            <span className="score-cell__label">
              {t('result.knockedLabel')} &mdash; {redLabel}
            </span>
          </div>
        </div>

        <div className="button-column" style={{ marginTop: 16 }}>
          <button className="btn btn--ghost" onClick={handleShare} disabled={shareStatus === 'sharing'}>
            {t('result.share')}
          </button>
          {shareStatus === 'shared' && <p className="footnote footnote--tight">{t('result.shareDone')}</p>}
          {shareStatus === 'downloaded' && <p className="footnote footnote--tight">{t('result.shareDownloaded')}</p>}
          {shareStatus === 'error' && <p className="footnote footnote--tight">{t('result.shareError')}</p>}
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
            {lastAchievementsUnlocked.map((id) => (
              <p key={id} className="xp-panel__achievement">
                {t('result.achievementUnlocked', { label: t(`achievement.${id}.label`) })}
              </p>
            ))}
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
          ) : isOnline ? (
            // Pas de "Rejouer" en ligne : relancer la scene de son cote
            // seulement laisserait l'adversaire sur une autre partie. Une
            // revanche demande un aller-retour, elle viendra avec le reste.
            <button className="btn btn--primary" onClick={quitRun}>
              {t('result.menu')}
            </button>
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
