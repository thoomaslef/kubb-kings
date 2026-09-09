import Phaser from 'phaser';
import { KING_BODY } from '../physics/matterConfig';

/**
 * Le roi, unique, au centre du terrain (regle classique du Kubb).
 * Les deux equipes le partagent : le faire tomber trop tot coute la partie.
 */
export class King {
  readonly sprite: Phaser.Physics.Matter.Image;
  private downed = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.matter.add.image(x, y, 'king', undefined, {
      ...KING_BODY,
      shape: { type: 'circle', radius: 20 }
    });
    this.sprite.setDepth(4);
    this.sprite.setData('king', this);
  }

  get isStanding() {
    return !this.downed;
  }

  knockDown(scene: Phaser.Scene) {
    if (this.downed) return;
    this.downed = true;

    const { x, y } = this.sprite;
    this.sprite.destroy();

    const fallen = scene.add.image(x, y, 'king').setDepth(1).setTint(0x8a7a45);
    scene.tweens.add({
      targets: fallen,
      scaleX: 1.2,
      scaleY: 0.45,
      angle: 82,
      alpha: 0.7,
      duration: 320,
      ease: 'Quad.easeOut'
    });
  }
}
