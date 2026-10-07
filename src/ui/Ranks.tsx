import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import {
  fetchLeaderboard,
  fetchStanding,
  rerollMyPseudo,
  setMyLeaderboardVisible
} from '../game/account/sync';
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
  const setRankedLobby = useGameStore((s) => s.setRankedLobby);
  const rank = useGameStore((s) => s.rank);
  const lastRankChange = useGameStore((s) => s.lastRankChange);
  const clearRankChange = useGameStore((s) => s.clearRankChange);

  const account = useGameStore((s) => s.account);
  const [board, setBoard] = useState<Board>({ state: 'loading' });
  const [standing, setStanding] = useState<Standing | null>(null);
  const [busy, setBusy] = useState(false);

  const loadBoard = useCallback(async () => {
    setBoard({ state: 'loading' });
    try {
      const entries = await fetchLeaderboard(BOARD_SIZE);
      setBoard(entries === null ? { state: 'unavailable' } : { state: 'ok', entries });
      setStanding(await fetchStanding());
    } catch {
      setBoard({ state: 'error' });
    }
  }, []);

  // Au chargement de l'ecran, et quand on se connecte ou deconnecte.
  useEffect(() => {
    void loadBoard();
  }, [loadBoard, account.status]);

  const reroll = async () => {
    setBusy(true);
    const pseudo = await rerollMyPseudo();
    setBusy(false);
    if (pseudo) await loadBoard();
  };

  const toggleVisible = async () => {
    if (!standing) return;
    setBusy(true);
    const ok = await setMyLeaderboardVisible(!standing.visible);
    setBusy(false);
    if (ok) await loadBoard();
  };

  const current = rankPosition(rank.index);
  const total = rank.wins + rank.losses;
  const winRate = total > 0 ? Math.round((rank.wins / total) * 100) : null;

  const search = () => {
    setRankedLobby(true);
    setScreen('online');
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
                {board.entries.map((e) => (
                  <li key={e.place} className={`leaderboard__row${e.isMe ? ' leaderboard__row--me' : ''}`}>
                    <span className="leaderboard__place">{e.place}</span>
                    <RankBadge index={e.rankIndex} size="sm" />
                    <span className="leaderboard__name">
                      {e.pseudo}
                      {e.isMe && <em> — {t('ranks.you')}</em>}
                    </span>
                    <span className="leaderboard__rank">{rankName(e.rankIndex)}</span>
                    <span className="leaderboard__score">{t('ranks.board.score', { wins: e.wins, losses: e.losses })}</span>
                  </li>
                ))}
              </ol>
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
                    : ` — ${t(standing.visible ? 'ranks.board.notRanked' : 'ranks.board.hidden')}`}
                </p>
                <div className="button-column">
                  <button className="btn btn--ghost" onClick={reroll} disabled={busy}>
                    {t('ranks.board.reroll')}
                  </button>
                  <button className="btn btn--ghost" onClick={toggleVisible} disabled={busy}>
                    {t(standing.visible ? 'ranks.board.hide' : 'ranks.board.show')}
                  </button>
                </div>
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

        <ul className="rules-list">
          <li>{t('ranks.rule.step')}</li>
          <li>{t('ranks.rule.divisions')}</li>
          <li>{t('ranks.rule.fixed')}</li>
          <li>{t('ranks.rule.forfeit')}</li>
          <li>{t('ranks.rule.bot')}</li>
        </ul>
        <p className="footnote">{t('ranks.localNote')}</p>

        <div className="button-column">
          <button className="btn btn--primary" onClick={search}>
            {t('ranks.search')}
          </button>
          <button className="btn btn--ghost" onClick={back}>
            {t('online.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
