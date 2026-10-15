import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import {
  fetchLeaderboard,
  fetchStanding,
  reportPlayer,
  rerollMyPseudo
} from '../game/account/sync';
import { blockPseudo, loadBlocked, unblockAll, withoutBlocked } from '../game/account/blocklist';
import type { LeaderboardEntry, Standing } from '../game/account/leaderboard';
import { DIVISIONS_PER_TIER, RANK_COLORS, RANK_COUNT, RANK_TIERS, rankPosition } from '../game/ranks';
import { useT } from '../i18n/useT';
import { RankBadge, useRankName } from './RankBadge';

/**
 * Presentation des rangs, et porte d'entree des parties classees : le rang
 * actuel, le chemin a parcourir, les regles — puis le bouton qui lance la
 * recherche d'un adversaire classe (OnlineLobby.tsx, mode classe).
 */
type Board =
  | { state: 'loading' }
  | { state: 'unavailable' }
  | { state: 'error' }
  | { state: 'ok'; entries: LeaderboardEntry[] };

/** Nombre de lignes du classement affichees. */
const BOARD_SIZE = 20;

export function Ranks() {
  const t = useT();
  const rankName = useRankName();
  const setScreen = useGameStore((s) => s.setScreen);
  const rank = useGameStore((s) => s.rank);
  const lastRankChange = useGameStore((s) => s.lastRankChange);
  const clearRankChange = useGameStore((s) => s.clearRankChange);

  const account = useGameStore((s) => s.account);
  const [board, setBoard] = useState<Board>({ state: 'loading' });
  const [standing, setStanding] = useState<Standing | null>(null);
  const pseudoRequested = useRef(false);
  // Signaler / bloquer : le pseudo sur lequel on agit, les pseudos masques sur cet appareil, et le dernier retour.
  const [target, setTarget] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string[]>(loadBlocked);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadBoard = useCallback(async () => {
    setBoard({ state: 'loading' });
    try {
      const entries = await fetchLeaderboard(BOARD_SIZE);
      setBoard(entries === null ? { state: 'unavailable' } : { state: 'ok', entries });
      let current = await fetchStanding();
      // Un profil cree AVANT l'arrivee du classement n'a pas encore de pseudo (le serveur n'en
      // attribue qu'a la sauvegarde suivante) : on en demande un tout de suite, une seule fois,
      // plutot que d'afficher « — » au joueur.
      if (current && current.pseudo === null && !pseudoRequested.current) {
        pseudoRequested.current = true;
        if (await rerollMyPseudo()) current = await fetchStanding();
      }
      setStanding(current);
    } catch {
      setBoard({ state: 'error' });
    }
  }, []);

  // Au chargement de l'ecran, et quand on se connecte ou deconnecte.
  useEffect(() => {
    void loadBoard();
  }, [loadBoard, account.status]);

  const current = rankPosition(rank.index);
  const total = rank.wins + rank.losses;
  const winRate = total > 0 ? Math.round((rank.wins / total) * 100) : null;

  const report = async (pseudo: string) => {
    setBusy(true);
    const outcome = await reportPlayer(pseudo, 'pseudo');
    setBusy(false);
    setTarget(null);
    setActionMessage(t(outcome.ok ? 'report.sent' : `report.error.${outcome.error}`));
  };
  const block = (pseudo: string) => {
    setBlocked(blockPseudo(pseudo));
    setTarget(null);
    setActionMessage(t('report.blocked'));
  };

  const back = () => {
    clearRankChange();
    setScreen('menu');
  };

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--ranks">
        <h2 className="panel__title">{t('ranks.title')}</h2>

        <div className="ranks-current">
          <RankBadge index={rank.index} size="lg" />
          <div className="ranks-current__text">
            <strong className="ranks-current__name">{rankName(rank.index)}</strong>
            <span className="footnote footnote--tight">
              {rank.index >= RANK_COUNT - 1 ? t('ranks.atTop') : t('ranks.nextStep', { rank: rankName(rank.index + 1) })}
            </span>
          </div>
        </div>

        {lastRankChange && lastRankChange.reason !== 'match' && (
          <p className="footnote ranks-change">
            {t(`ranks.change.${lastRankChange.reason}`, {
              from: rankName(lastRankChange.before),
              to: rankName(lastRankChange.after)
            })}
          </p>
        )}

        <p className="panel__text ranks-stats">
          {t('ranks.stats', { wins: rank.wins, losses: rank.losses })}
          {winRate !== null && ` — ${t('ranks.winRate', { pct: winRate })}`}
          {' — '}
          {t('ranks.peak', { rank: rankName(rank.peak) })}
        </p>

        <ol className="ranks-ladder" aria-label={t('ranks.ladderAria')}>
          {[...RANK_TIERS].reverse().map((tier) => {
            const tierIndex = RANK_TIERS.indexOf(tier);
            return (
              <li
                key={tier}
                className={`ranks-tier${tier === current.tier ? ' ranks-tier--current' : ''}`}
                style={{ ['--rank-color' as string]: RANK_COLORS[tier] }}
              >
                <span className="ranks-tier__name">{t(`rank.tier.${tier}`)}</span>
                <span className="ranks-tier__divisions">
                  {Array.from({ length: DIVISIONS_PER_TIER }, (_, d) => {
                    const index = tierIndex * DIVISIONS_PER_TIER + d;
                    const state = index === rank.index ? 'here' : index < rank.index ? 'done' : 'todo';
                    return (
                      <span
                        key={d}
                        className={`ranks-division ranks-division--${state}`}
                        aria-label={`${rankName(index)}${state === 'here' ? ` — ${t('ranks.you')}` : ''}`}
                      >
                        {d + 1}
                      </span>
                    );
                  })}
                </span>
              </li>
            );
          })}
        </ol>

        <h3 className="legal-heading">{t('ranks.board.title')}</h3>
        {board.state === 'loading' && <p className="footnote">{t('ranks.board.loading')}</p>}
        {board.state === 'unavailable' && <p className="footnote">{t('ranks.board.unavailable')}</p>}
        {board.state === 'error' && (
          <>
            <p className="footnote">{t('ranks.board.error')}</p>
            <button className="btn btn--ghost" onClick={() => void loadBoard()}>
              {t('ranks.board.retry')}
            </button>
          </>
        )}
        {board.state === 'ok' && (
          <>
            {board.entries.length === 0 ? (
              <p className="footnote" data-testid="board-empty">
                {t('ranks.board.empty')}
              </p>
            ) : (
              <ol className="leaderboard" data-testid="leaderboard">
                {withoutBlocked(board.entries, blocked).map((e) => (
                  <li key={e.place} className={`leaderboard__row${e.isMe ? ' leaderboard__row--me' : ''}`}>
                    <span className="leaderboard__place">{e.place}</span>
                    <RankBadge index={e.rankIndex} size="sm" />
                    <span className="leaderboard__name">
                      {e.pseudo}
                      {e.isMe && <em> — {t('ranks.you')}</em>}
                    </span>
                    <span className="leaderboard__rank">{rankName(e.rankIndex)}</span>
                    <span className="leaderboard__score">{t('ranks.board.score', { wins: e.wins, losses: e.losses })}</span>
                    {!e.isMe && (
                      <button
                        type="button"
                        className="leaderboard__more"
                        aria-label={t('report.open', { pseudo: e.pseudo })}
                        data-testid="player-actions"
                        onClick={() => {
                          setActionMessage(null);
                          setTarget(e.pseudo);
                        }}
                      >
                        ⋯
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {target && (
              <div className="leaderboard-actions" role="group" aria-label={t('report.open', { pseudo: target })} data-testid="player-menu">
                <p className="panel__text">{t('report.title', { pseudo: target })}</p>
                <div className="button-column">
                  <button className="btn" onClick={() => void report(target)} disabled={busy} data-testid="report-button">
                    {t('report.action')}
                  </button>
                  <button className="btn" onClick={() => block(target)} disabled={busy} data-testid="block-button">
                    {t('report.block')}
                  </button>
                  <button className="btn btn--ghost" onClick={() => setTarget(null)} disabled={busy}>
                    {t('online.cancel')}
                  </button>
                </div>
              </div>
            )}
            {actionMessage && (
              <p className="footnote" role="status" data-testid="report-message">
                {actionMessage}
              </p>
            )}
            {blocked.length > 0 && (
              <button className="link-btn" onClick={() => setBlocked(unblockAll())} data-testid="unblock-all">
                {t('report.unblockAll', { n: blocked.length })}
              </button>
            )}
            <p className="footnote">{t('ranks.board.unverified')}</p>
          </>
        )}

        {account.status === 'signedIn' ? (
          <div className="ranks-me" data-testid="my-standing">
            {standing ? (
              <>
                <p className="panel__text">
                  {t('ranks.board.yourPseudo')} <strong data-testid="my-pseudo">{standing.pseudo ?? '—'}</strong>
                  {standing.place !== null
                    ? ` — ${t('ranks.board.yourPlace', { place: standing.place, total: standing.total })}`
                    : ` — ${t('ranks.board.notRanked')}`}
                </p>
                <p className="footnote">{t('ranks.board.pseudoNote')}</p>
              </>
            ) : (
              <p className="footnote">{t('ranks.board.noProfile')}</p>
            )}
          </div>
        ) : (
          board.state !== 'unavailable' && (
            <div className="ranks-me">
              <p className="footnote">{t('ranks.board.signIn')}</p>
              <button className="btn btn--ghost" onClick={() => setScreen('account')}>
                {t('menu.account.signedOut')}
              </button>
            </div>
          )
        )}

        <h3 className="legal-heading">{t('ranks.how.title')}</h3>
        <p className="panel__text">{t('ranks.how.intro')}</p>
        <ul className="rules-list">
          <li>{t('ranks.rule.step')}</li>
          <li>{t('ranks.rule.divisions')}</li>
          <li>{t('ranks.rule.fixed')}</li>
          <li>{t('ranks.rule.forfeit')}</li>
          <li>{t('ranks.rule.bot')}</li>
        </ul>

        <div className="button-column">
          <button className="btn btn--ghost" onClick={back}>
            {t('online.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
