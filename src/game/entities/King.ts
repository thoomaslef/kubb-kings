import Phaser from 'phaser';
import { KING_BODY } from '../physics/matterConfig';
import { HITBOX } from '../rules';
import { SHADOW } from '../theme';

/**
 * Le roi, unique, au centre du terrain (regle classique du Kubb).
 * Les deux equipes le partagent : le faire tomber trop tot coute la partie.
 */
export class King {
  readonly sprite: Phaser.Physics.Matter.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private downed = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.shadow = scene.add
      .image(x + SHADOW.offsetX, y + SHADOW.offsetY, 'shadow')
      .setDepth(2)
      .setAlpha(SHADOW.alpha)
      .setScale(SHADOW.scale.king);

    this.sprite = scene.matter.add.image(x, y, 'king', undefined, {
      ...KING_BODY,
      shape: { type: 'circle', radius: HITBOX.kingRadius }
    });
    this.sprite.setDepth(4);
    this.sprite.setData('king', this);
  }

  get isStanding() {
    return !this.downed;
  }

  /** Recale l'ombre sur le roi. Appele a chaque frame par la scene. */
  syncShadow() {
    if (this.downed) return;
    this.shadow.setPosition(this.sprite.x + SHADOW.offsetX, this.sprite.y + SHADOW.offsetY);
  }

  knockDown(scene: Phaser.Scene) {
    if (this.downed) return;
    this.downed = true;

    const { x, y } = this.sprite;
    this.sprite.destroy();

    // Le roi bascule lentement : c'est le geste qui clot la partie.
    const fallen = scene.add.image(x, y, 'king-down').setDepth(1).setScale(0.55, 1.1).setAngle(-12);

    scene.tweens.add({
      targets: fallen,
      scaleX: 1,
      scaleY: 1,
      angle: Phaser.Math.Between(74, 100),
      duration: 460,
      ease: 'Back.easeOut'
    });

    this.shadow.setDepth(0.5);
    scene.tweens.add({
      targets: this.shadow,
      x: x + SHADOW.offsetX * 0.4,
      y: y + SHADOW.offsetY * 0.4,
      scaleX: SHADOW.scale.king * 1.5,
      scaleY: SHADOW.scale.king * 0.8,
      alpha: SHADOW.alpha * 0.7,
      duration: 460,
      ease: 'Quad.easeOut'
    });
  }
}
