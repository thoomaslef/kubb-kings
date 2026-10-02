import {
  BASELINE_INSET,
  FIELD,
  FIELD_PRESETS,
  HILL_RADIUS,
  OBSTACLE_RADIUS,
  RIVER_HALF_WIDTH,
  THROW_POSITIONS,
  type FieldPresetId
} from '../game/rules';
import { PALETTE } from '../game/theme';
import { TEAMS } from '../game/entities/teamData';

/**
 * Miniature d'un terrain, dessinee a partir du preset lui-meme.
 *
 * Volontairement DERIVEE des donnees de `rules.ts` plutot que dessinee a la
 * main : un terrain dont on deplacerait les rochers, ou un terrain ajoute,
 * voit sa miniature suivre toute seule. Une image figee aurait menti des la
 * premiere retouche d'equilibrage — et le jeu n'embarque de toute facon
 * aucun fichier d'image.
 *
 * Ce n'est pas un rendu fidele du jeu (pas de textures, pas d'ombres) :
 * c'est un plan. Ce qu'il doit faire comprendre avant de lancer la partie,
 * c'est OU sont les obstacles et ce qui couvre le sol.
 */

/** 0xRRGGBB (Phaser) vers une couleur CSS. */
const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

const SOL: Record<FieldPreset['groundTexture'], number> = {
  grass: PALETTE.grass,
  ice: PALETTE.ice,
  sand: PALETTE.sand,
  night: PALETTE.nightGrass,
  mud: PALETTE.mud
};

type FieldPreset = (typeof FIELD_PRESETS)[FieldPresetId];

/** Les cactus remplacent les rochers sur le sable (cf. theme.ts). */
const rocheDe = (preset: FieldPreset) => (preset.groundTexture === 'sand' ? PALETTE.cactus : PALETTE.rock);

export function FieldPreview({ id }: { id: FieldPresetId }) {
  const preset = FIELD_PRESETS[id];
  const { width, height } = FIELD;
  const cx = width / 2;
  const cy = height / 2;

  return (
    <svg
      className="field-preview"
      viewBox={`0 0 ${width} ${height}`}
      // Decoratif : le nom du terrain est deja dans le libelle du bouton.
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0" y="0" width={width} height={height} fill={css(SOL[preset.groundTexture])} />

      {/* Colline : zone qui freine, centree sur le terrain. */}
      {preset.hasHill && <circle cx={cx} cy={cy} r={HILL_RADIUS} fill={css(PALETTE.hill)} opacity="0.85" />}

      {/* Riviere : bande horizontale qui, elle, accelere. */}
      {preset.hasRiver && (
        <rect x="0" y={cy - RIVER_HALF_WIDTH} width={width} height={RIVER_HALF_WIDTH * 2} fill={css(PALETTE.river)} />
      )}

      {/* Ligne mediane, comme en jeu. */}
      <line x1="0" y1={cy} x2={width} y2={cy} stroke={css(PALETTE.chalk)} strokeWidth="6" strokeDasharray="26 22" opacity="0.5" />

      {/* Les deux lignes de kubbs : elles donnent l'echelle du terrain. */}
      {(['red', 'blue'] as const).map((team) =>
        THROW_POSITIONS.map((x) => (
          <rect
            key={`${team}-${x}`}
            x={x - FIELD.x - 18}
            y={(team === 'red' ? BASELINE_INSET : height - BASELINE_INSET) - 18}
            width="36"
            height="36"
            rx="6"
            fill={TEAMS[team].cssColor}
          />
        ))
      )}

      {/* Le roi, au centre. */}
      <circle cx={cx} cy={cy} r="20" fill={css(PALETTE.gold)} />

      {/* Obstacles, aux coordonnees exactes du preset. */}
      {preset.obstacles.map((o, i) => (
        <circle key={i} cx={cx + o.dx} cy={cy + o.dy} r={OBSTACLE_RADIUS} fill={css(rocheDe(preset))} />
      ))}

      {/* Lune : seul indice que "Nuit" ne change rien d'autre que l'ambiance. */}
      {preset.nightSky && <circle cx={width - 90} cy={110} r="34" fill={css(PALETTE.moon)} opacity="0.9" />}

      <rect x="3" y="3" width={width - 6} height={height - 6} fill="none" stroke={css(PALETTE.wood)} strokeWidth="6" />
    </svg>
  );
}
