import type Phaser from 'phaser';
import { OBSTACLE_BODY } from '../physics/matterConfig';
import { OBSTACLE_RADIUS } from '../rules';
import { SHADOW } from '../theme';

/**
 * Un rocher (ou cactus, sur "Sable") de terrain a obstacles. Purement
 * statique : il ne tombe jamais, ne peut pas etre abattu, et fait juste
 * rebondir le baton comme une bande. Contrairement a Kubb/King, il n'y a
 * donc pas d'etat "couche" a gerer. Meme corps Matter (rayon, rebond) quelle
 * que soit la texture — seul l'habillage change, cf. `textureKey`.
 */
export class Obstacle {
  readonly sprite: Phaser.Physics.Matter.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: 'obstacle' | 'cactus' = 'obstacle') {
    // L'ombre d'un rocher/cactus ne bouge jamais : pas besoin de la recaler a
    // chaque frame comme celles des pieces mobiles (Kubb, King, Baton).
    scene.add
      .image(x + SHADOW.offsetX, y + SHADOW.offsetY, 'shadow')
      .setDepth(2)
      .setAlpha(SHADOW.alpha)
      .setScale(SHADOW.scale.obstacle);

    this.sprite = scene.matter.add.image(x, y, textureKey, undefined, {
      ...OBSTACLE_BODY,
      shape: { type: 'circle', radius: OBSTACLE_RADIUS }
    });
    this.sprite.setDepth(4);
  }
}
