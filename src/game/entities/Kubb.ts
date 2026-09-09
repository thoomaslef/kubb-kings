import Phaser from 'phaser';
import { KUBB_BODY } from '../physics/matterConfig';
import type { TeamId } from './Team';

/**
 * Un bloc de bois aligne sur la ligne de fond d'une equipe.
 * Une fois tombe, il quitte la simulation et reste au sol comme decor.
 */
export class Kubb {
  readonly sprite: Phaser.Physics.Matter.Image;
  readonly team: TeamId;
  private downed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, team: TeamId) {
    this.team = team;
    this.sprite = scene.matter.add.image(x, y, `kubb-${team}`, undefined, {
      ...KUBB_BODY,
      chamfer: { radius: 5 }
    });
    this.sprite.setDepth(4);
    this.sprite.setData('kubb', this);
  }

  get isStanding() {
    return !this.downed;
  }

  /** Retire le kubb du jeu et laisse une trace couchee au sol. */
  knockDown(scene: Phaser.Scene) {
    if (this.downed) return;
    this.downed = true;

    const { x, y } = this.sprite;
    const rotation = Phaser.Math.FloatBetween(-Math.PI / 2, Math.PI / 2);
    this.sprite.destroy();

    const fallen = scene.add.image(x, y, `kubb-${this.team}`);
    fallen.setDepth(1);
    fallen.setRotation(rotation);
    fallen.setTint(0x5a5a5a);
    fallen.setAlpha(0.85);
    scene.tweens.add({
      targets: fallen,
      scaleX: 1.12,
      scaleY: 0.5,
      alpha: 0.55,
      duration: 220,
      ease: 'Quad.easeOut'
    });
  }
}
