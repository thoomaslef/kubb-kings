import { RANK_COLORS, rankPosition } from '../game/ranks';
import { useT } from '../i18n/useT';

/**
 * Insigne d'un rang : un ecusson a la couleur du palier, la division au
 * centre. Le nom complet (« Or 2 ») est TOUJOURS ecrit a cote ou dans
 * l'attribut d'accessibilite — la couleur seule ne dit rien a un daltonien.
 */
export function RankBadge({ index, size = 'md' }: { index: number; size?: 'sm' | 'md' | 'lg' }) {
  const t = useT();
  const { tier, division } = rankPosition(index);
  const name = `${t(`rank.tier.${tier}`)} ${division}`;
  return (
    <span
      className={`rank-badge rank-badge--${size}`}
      style={{ ['--rank-color' as string]: RANK_COLORS[tier] }}
      role="img"
      aria-label={name}
      title={name}
    >
      <span className="rank-badge__division" aria-hidden="true">
        {division}
      </span>
    </span>
  );
}

/** « Or 2 », dans la langue du joueur. */
export function useRankName() {
  const t = useT();
  return (index: number) => {
    const { tier, division } = rankPosition(index);
    return `${t(`rank.tier.${tier}`)} ${division}`;
  };
}
