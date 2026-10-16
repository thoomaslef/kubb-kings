import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { levelFromXp } from '../game/progression';
import { LADDER, getBestStage } from '../game/roguelite';
import { savedRunStageNumber } from '../game/runSave';
import { useT } from '../i18n/useT';
import { RankBadge, useRankName } from './RankBadge';
import { isSafeMode, leaveSafeMode, safeModeReason } from '../game/safeMode';
import { gameUrl, shareGame, type ShareData, type ShareOutcome } from '../game/shareLink';
import { accountAvailable } from '../game/account/sync';

export function Menu() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);
  const account = useGameStore((s) => s.account);
  // Partage du lien du jeu : `null` tant que rien n'a ete tente.
  const [shareState, setShareState] = useState<ShareOutcome | null>(null);
  const shareUrl = gameUrl(window.location.origin, import.meta.env.BASE_URL);
  const shareWithFriend = async () => {
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    const outcome = await shareGame(
      { title: t('menu.share.title'), text: t('menu.share.text'), url: shareUrl },
      {
        share: typeof nav.share === 'function' ? (d) => nav.share!(d) : undefined,
        writeText: navigator.clipboard?.writeText ? (text) => navigator.clipboard.writeText(text) : undefined
      }
    );
    setShareState(outcome === 'cancelled' ? null : outcome);
  };
  const lastRankChange = useGameStore((s) => s.lastRankChange);
  const clearRankChange = useGameStore((s) => s.clearRankChange);
  const rankName = useRankName();
  const rank = useGameStore((s) => s.rank);
  const setMode = useGameStore((s) => s.setMode);
  const online = useGameStore((s) => s.online);
  const endOnline = useGameStore((s) => s.endOnline);
  const startRun = useGameStore((s) => s.startRun);
  const progression = useGameStore((s) => s.progression);
  const levelInfo = levelFromXp(progression.totalXp);
  const coins = useGameStore((s) => s.coins);

  // Lue une seule fois au montage : elle ne peut changer que pendant une run,
  // ecran que ce composant n'affiche jamais.
  const [bestStage] = useState(getBestStage);

  // Le terrain se choisit maintenant sur son propre ecran, juste avant la
  // partie (cf. MapSelect.tsx) : le menu n'enchaine plus directement.
  const savedRun = useGameStore((s) => s.savedRun);
  const resumeDefi = () => {
    const pendingPerk = useGameStore.getState().resumeRun();
    if (pendingPerk) {
      // La manche gagnee avant la fermeture attendait encore son bonus : on rouvre le choix.
      useGameStore.getState().setPerkFromMenu(true);
      setScreen('perk');
    } else bridge.send('start-match');
  };
  const playDefi = () => {
    setMode('defi');
    startRun();
    bridge.send('start-match');
  };

  // Une partie en ligne qui s'arrete seule (adversaire parti, liaison
  // coupee) ramenait au menu sans un mot : le joueur ne pouvait que deviner.
  if (online && online.status === 'terminee' && online.endedBecause) {
    return (
      <div className="overlay overlay--solid">
        <div className="panel">
          <h2 className="panel__title">{t('online.endedTitle')}</h2>
          <p className="panel__text">{t(`online.ended.${online.endedBecause}`)}</p>
          <div className="button-column">
            <button className="btn" onClick={endOnline}>
              {t('online.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--menu">
        <h1 className="title">
          KUBB<span className="title__accent">: Kings</span>
        </h1>
        <p className="subtitle">{t('menu.subtitle')}</p>

        {/* Mode compatibilite (safeMode.ts) : le jeu a plante au demarrage, ou le joueur l'a demande. */}
        {isSafeMode() && (
          <div className="ranks-change" role="status" data-testid="safe-mode-notice">
            <p className="footnote footnote--tight">
              {t(safeModeReason() === 'crash' ? 'menu.safeMode.crash' : 'menu.safeMode.text')}
            </p>
            <button type="button" className="btn btn--ghost" onClick={leaveSafeMode}>
              {t('menu.safeMode.retry')}
            </button>
          </div>
        )}

        {/* Un mouvement de rang hors fin de partie normale (forfait, onglet ferme) : annonce, une fois. */}
        {lastRankChange && lastRankChange.reason !== 'match' && (
          <button type="button" className="footnote ranks-change" onClick={clearRankChange}>
            {t(`ranks.change.${lastRankChange.reason}`, {
              from: rankName(lastRankChange.before),
              to: rankName(lastRankChange.after)
            })}
          </button>
        )}

        {/* Une seule carte : le compte au-dessus, puis le niveau du profil. */}
        <div className="profile-card">
          {/* Sans service configure (build local, tests), pas de compte a proposer. */}
          {accountAvailable() && (
            <button type="button" className="btn btn--ghost btn--account" onClick={() => setScreen('account')}>
              {account.status === 'signedIn' && account.email ? (
                <>
                  {account.pseudo && (
                    <strong className="account-pseudo" data-testid="menu-pseudo">
                      {account.pseudo}
                    </strong>
                  )}
                  <span className="account-email">{t('menu.account.signedIn', { email: account.email })}</span>
                </>
              ) : (
                t('menu.account.signedOut')
              )}
            </button>
          )}
          <button
            type="button"
            className="xp-panel xp-panel--clickable"
            onClick={() => setScreen('progression')}
            aria-label={t('menu.progressionAria')}
          >
            <div className="xp-panel__header">
              <span className="xp-panel__icon">{levelInfo.icon}</span>
              <span className="xp-panel__level">{t('progression.level', { n: levelInfo.level })}</span>
              <span className="xp-panel__title">{t(levelInfo.titleKey)}</span>
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
          </button>
        </div>

        <button type="button" className="btn btn--ghost btn--share" onClick={shareWithFriend}>
          {t('menu.share.button')}
        </button>
        {shareState === 'copied' && (
          <p className="footnote footnote--tight" role="status" data-testid="share-status">
            {t('menu.share.copied')}
          </p>
        )}
        {shareState === 'shared' && (
          <p className="footnote footnote--tight" role="status" data-testid="share-status">
            {t('menu.share.shared')}
          </p>
        )}
        {shareState === 'manual' && (
          <div role="status" data-testid="share-status">
            <p className="footnote footnote--tight">{t('menu.share.manual')}</p>
            <input
              className="input"
              readOnly
              value={shareUrl}
              aria-label={t('menu.share.button')}
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        )}

        <div className="button-column">
          <button className="btn btn--primary" onClick={() => setScreen('online-hub')}>
            {t('menu.playOnline')}
          </button>
          <button className="btn btn--primary" onClick={() => setScreen('local-hub')}>
            {t('menu.playLocal')}
          </button>
          {savedRun && (
            <button className="btn btn--primary" onClick={resumeDefi} data-testid="defi-resume">
              {t('menu.defi.resume', { n: savedRunStageNumber(savedRun), total: LADDER.length })}
            </button>
          )}
          <button className="btn" onClick={playDefi}>
            {savedRun ? t('menu.defi.new') : t('menu.defi', { n: LADDER.length })}
          </button>
          {bestStage > 0 && (
            <p className="footnote footnote--tight">
              {t(bestStage > 1 ? 'menu.bestStage.many' : 'menu.bestStage.one', {
                stage: bestStage,
                total: LADDER.length
              })}
            </p>
          )}
          <button className="btn btn--ranked" onClick={() => setScreen('ranks')}>
            <RankBadge index={rank.index} size="sm" />
            {t('menu.ranked', { rank: rankName(rank.index) })}
          </button>

          <button className="btn" onClick={() => setScreen('appearance')}>
            {t('menu.appearance')}
          </button>
          <button className="btn" onClick={() => setScreen('shop')}>
            {t('menu.shop')} — {t('menu.coinsAria', { n: coins })}
          </button>
          <button className="btn" onClick={() => setScreen('achievements')}>
            {t('menu.achievements')}
          </button>

          <button className="btn" onClick={() => setScreen('options')}>
            {t('menu.options')}
          </button>
          <button className="btn" onClick={() => setScreen('rules')}>
            {t('menu.rules')}
          </button>
          <button className="btn btn--ghost" onClick={() => setScreen('quit')}>
            {t('menu.quit')}
          </button>
        </div>

        <p className="footnote">{t('menu.footer')}</p>
        <button className="link-btn" onClick={() => setScreen('about')}>
          {t('menu.about')}
        </button>
        <button className="link-btn" onClick={() => setScreen('legal')}>
          {t('menu.legal')}
        </button>
      </div>
    </div>
  );
}
