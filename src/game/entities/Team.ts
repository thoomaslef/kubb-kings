import type Phaser from 'phaser';
import { KUBBS_PER_TEAM, KUBB_SPACING, FIELD_CENTER_X } from '../rules';
import type { KubbSkin } from '../theme';
import { Kubb } from './Kubb';
import { TEAMS, type TeamId } from './teamData';

export * from './teamData';

/**
 * Une equipe et sa ligne de kubbs.
 * Le camp d'une equipe est la cible de l'adversaire : les kubbs d'une equipe
 * ne peuvent pas etre abattus par ses propres batons.
 */
export class Team {
  readonly id: TeamId;
  readonly kubbs: Kubb[];

  constructor(scene: Phaser.Scene, id: TeamId, skin: KubbSkin) {
    this.id = id;
    const { baselineY } = TEAMS[id];
    const first = -((KUBBS_PER_TEAM - 1) / 2) * KUBB_SPACING;

    this.kubbs = Array.from(
      { length: KUBBS_PER_TEAM },
      (_, i) => new Kubb(scene, FIELD_CENTER_X + first + i * KUBB_SPACING, baselineY, id, skin)
    );
  }

  /** Recale les ombres portees des kubbs encore debout. */
  syncShadows() {
    this.kubbs.forEach((kubb) => kubb.syncShadow());
  }

  get standingCount(): number {
    return this.kubbs.reduce((total, kubb) => total + (kubb.isStanding ? 1 : 0), 0);
  }

  get downCount(): number {
    return KUBBS_PER_TEAM - this.standingCount;
  }
}
