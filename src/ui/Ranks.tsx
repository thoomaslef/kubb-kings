import { useGameStore } from '../store/useGameStore';
import { DIVISIONS_PER_TIER, RANK_COLORS, RANK_COUNT, RANK_TIERS, rankPosition } from '../game/ranks';
import { useT } from '../i18n/useT';
import { RankBadge, useRankName } from './RankBadge';

/**
 * Presentation des rangs, et porte d'entree des parties classees : le rang
 * actuel, le chemin a parcourir, les regles — puis le bouton qui lance la
 * recherche d'un adversaire classe (OnlineLobby.tsx, mode classe).
 */
export function Ranks() {
  const t = useT();
  const rankName = useRankName();
  const setScreen = useGameStore((s) => s.setScreen);
  const setRankedLobby = useGameStore((s) => s.setRankedLobby);
  const rank = useGameStore((s) => s.rank);
  const lastRankChange = useGameStore((s) => s.lastRankChange);
  const clearRankChange = useGameStore((s) => s.clearRankChange);

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
