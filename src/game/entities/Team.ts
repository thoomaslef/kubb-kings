import { FIELD, BASELINE_INSET, THROWER_INSET, FIELD_CENTER_X } from '../rules';

export type TeamId = 'blue' | 'red';

export interface TeamConfig {
  id: TeamId;
  label: string;
  /** Couleur Phaser (0xRRGGBB). */
  color: number;
  /** Meme couleur pour l'UI React. */
  cssColor: string;
  /** Ligne de fond ou sont alignes les kubbs de l'equipe. */
  baselineY: number;
  /** Position du lanceur de l'equipe. */
  throwerY: number;
  /** Sens de lancer sur l'axe Y : -1 vers le haut, +1 vers le bas. */
  direction: -1 | 1;
}

export const TEAMS: Record<TeamId, TeamConfig> = {
  red: {
    id: 'red',
    label: 'Rouge',
    color: 0xe2564a,
    cssColor: '#e2564a',
    baselineY: FIELD.y + BASELINE_INSET,
    throwerY: FIELD.y + THROWER_INSET,
    direction: 1
  },
  blue: {
    id: 'blue',
    label: 'Bleue',
    color: 0x4a90e2,
    cssColor: '#4a90e2',
    baselineY: FIELD.y + FIELD.height - BASELINE_INSET,
    throwerY: FIELD.y + FIELD.height - THROWER_INSET,
    direction: -1
  }
};

export const OPPONENT: Record<TeamId, TeamId> = { blue: 'red', red: 'blue' };

/** Position depuis laquelle l'equipe lance (centre de sa ligne de fond). */
export function throwerPosition(team: TeamId): { x: number; y: number } {
  return { x: FIELD_CENTER_X, y: TEAMS[team].throwerY };
}
