import { useGameStore } from '../store/useGameStore';
import { resolveAccountConflict } from '../game/account/sync';
import { levelFromXp } from '../game/progression';
import type { ProfileSnapshot } from '../game/account/profileSnapshot';
import { useT } from '../i18n/useT';
import { useRankName } from './RankBadge';

/**
 * Premier rapprochement de cet appareil et d'un compte qui ont chacun leur
 * histoire. On ne tranche pas a la place du joueur : on lui montre les deux,
 * et il choisit — garder l'appareil, garder le compte, ou fusionner.
 */
export function AccountConflict() {
  const t = useT();
  const rankName = useRankName();
  const conflict = useGameStore((s) => s.accountConflict);
  if (!conflict) return null;

  const summary = (label: string, s: ProfileSnapshot, testId: string) => (
    <div className="xp-panel" data-testid={testId}>
      <strong>{label}</strong>
      <p className="footnote footnote--tight">
        {t('account.conflict.line', {
          level: levelFromXp(s.progression.totalXp).level,
          coins: s.coins,
          achievements: s.unlockedAchievements.length,
          rank: rankName(s.rank.index)
        })}
      </p>
    </div>
  );

  return (
    <div className="overlay overlay--solid">
      <div className="panel">
        <h2 className="panel__title">{t('account.conflict.title')}</h2>
        <p className="panel__text">{t('account.conflict.text')}</p>
        {summary(t('account.conflict.device'), conflict.local, 'conflict-local')}
        {summary(t('account.conflict.account'), conflict.remote, 'conflict-remote')}
        <div className="button-column">
          <button className="btn btn--primary" onClick={() => void resolveAccountConflict('merge')}>
            {t('account.conflict.merge')}
          </button>
          <p className="footnote footnote--tight">{t('account.conflict.mergeHint')}</p>
          <button className="btn" onClick={() => void resolveAccountConflict('remote')}>
            {t('account.conflict.keepAccount')}
          </button>
          <button className="btn" onClick={() => void resolveAccountConflict('local')}>
            {t('account.conflict.keepDevice')}
          </button>
        </div>
      </div>
    </div>
  );
}
