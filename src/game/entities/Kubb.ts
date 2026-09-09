import Phaser from 'phaser';
import { KUBB_BODY } from '../physics/matterConfig';
import { HITBOX } from '../rules';
import { SHADOW } from '../theme';
import type { TeamId } from './Team';

/**
 * Un bloc de bois aligne sur la ligne de fond d'une equipe.
 * Une fois tombe, il quitte la simulation et reste couche au sol comme decor.
 *
 * Le corps physique fait HITBOX.kubb de cote, quelle que soit la taille de la
 * texture : le rendu peut evoluer sans toucher aux collisions.
 */
export class Kubb {
  readonly sprite: Phaser.Physics.Matter.Image;
  readonly team: TeamId;
  /** Ombre portee, sprite independant qui suit le bloc. */
  private readonly shadow: Phaser.GameObjects.Image;
  private downed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, team: TeamId) {
    this.team = team;

    this.shadow = scene.add
      .image(x + SHADOW.offsetX, y + SHADOW.offsetY, 'shadow')
      .setDepth(2)
      .setAlpha(SHADOW.alpha)
      .setScale(SHADOW.scale.kubb);

    this.sprite = scene.matter.add.image(x, y, `kubb-${team}`, undefined, {
      ...KUBB_BODY,
      chamfer: { radius: 5 },
      shape: { type: 'rectangle', width: HITBOX.kubb, height: HITBOX.kubb }
    });
    this.sprite.setDepth(4);
    this.sprite.setData('kubb', this);
  }

  get isStanding() {
    return !this.downed;
  }

  /** Recale l'ombre sur le bloc. Appele a chaque frame par la scene. */
  syncShadow() {
    if (this.downed) return;
    this.shadow.setPosition(this.sprite.x + SHADOW.offsetX, this.sprite.y + SHADOW.offsetY);
    this.shadow.setRotation(this.sprite.rotation);
  }

  /** Retire le kubb du jeu : il bascule sur le flanc et y reste. */
  knockDown(scene: Phaser.Scene) {
    if (this.downed) return;
    this.downed = true;

    const { x, y, rotation } = this.sprite;
    this.sprite.destroy();

    const fallen = scene.add
      .image(x, y, `kubb-down-${this.team}`)
      .setDepth(1)
      .setRotation(rotation)
      .setScale(0.68, 1.05);

    // Le bloc part sur un cote au hasard et s'aplatit.
    scene.tweens.add({
      targets: fallen,
      rotation: rotation + Phaser.Math.FloatBetween(-Math.PI / 3, Math.PI / 3),
      scaleX: 1,
      scaleY: 0.94,
      duration: 260,
      ease: 'Back.easeOut'
    });

    // L'ombre s'etale et s'eclaircit : la piece n'est plus debout.
    this.shadow.setDepth(0.5);
    scene.tweens.add({
      targets: this.shadow,
      x: x + SHADOW.offsetX * 0.4,
      y: y + SHADOW.offsetY * 0.4,
      scaleX: SHADOW.scale.kubb * 1.4,
      scaleY: SHADOW.scale.kubb * 0.85,
      alpha: SHADOW.alpha * 0.6,
      duration: 260,
      ease: 'Quad.easeOut'
    });
  }
}
