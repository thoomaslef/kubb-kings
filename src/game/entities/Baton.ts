import Phaser from 'phaser';
import { BATON_BODY } from '../physics/matterConfig';
import { THROW, MAX_AIM_DEVIATION_DEG, HITBOX } from '../rules';
import { SHADOW } from '../theme';

/**
 * Le baton lance par le joueur actif.
 * Corps Matter allonge, tres peu amorti : il glisse sur le terrain vu de dessus.
 */
export class Baton {
  readonly sprite: Phaser.Physics.Matter.Image;
  /** Ombre portee, sprite independant qui suit le baton. */
  private readonly shadow: Phaser.GameObjects.Image;
  /** Vitesse observee a la frame precedente, utilisee pour mesurer la force d'impact. */
  private previousSpeed = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.shadow = scene.add
      .image(x + SHADOW.offsetX, y + SHADOW.offsetY, 'shadow')
      .setDepth(3)
      .setAlpha(SHADOW.alpha * 0.8)
      .setScale(SHADOW.scale.baton, SHADOW.scale.baton * 1.5);

    this.sprite = scene.matter.add.image(x, y, 'baton', undefined, {
      ...BATON_BODY,
      chamfer: { radius: 6 },
      shape: { type: 'rectangle', width: HITBOX.batonWidth, height: HITBOX.batonLength }
    });
    this.sprite.setDepth(6);
  }

  /** Recale l'ombre sur le baton. Appele a chaque frame par la scene. */
  syncShadow() {
    this.shadow.setPosition(this.sprite.x + SHADOW.offsetX, this.sprite.y + SHADOW.offsetY);
    this.shadow.setRotation(this.sprite.rotation);
  }

  /**
   * Lance le baton. Une deviation aleatoire de +/- MAX_AIM_DEVIATION_DEG degres
   * est ajoutee a l'angle vise : c'est "l'effet" leger du MVP.
   */
  launch(angle: number, power: number) {
    const deviation = Phaser.Math.DegToRad(
      Phaser.Math.FloatBetween(-MAX_AIM_DEVIATION_DEG, MAX_AIM_DEVIATION_DEG)
    );
    const finalAngle = angle + deviation;
    const speed = THROW.maxSpeed * power;

    // La texture est verticale : on aligne son grand axe sur la trajectoire.
    this.sprite.setRotation(finalAngle - Math.PI / 2);
    this.sprite.setVelocity(Math.cos(finalAngle) * speed, Math.sin(finalAngle) * speed);
    this.sprite.setAngularVelocity(THROW.spin * (Math.random() < 0.5 ? -1 : 1));
    this.previousSpeed = speed;
  }

  get speed(): number {
    const v = this.sprite.body?.velocity;
    return v ? Math.hypot(v.x, v.y) : 0;
  }

  /**
   * Vitesse retenue pour juger un impact : Matter emet collisionstart avant
   * la resolution, mais on garde la frame precedente comme filet de securite.
   */
  get impactSpeed(): number {
    return Math.max(this.speed, this.previousSpeed);
  }

  rememberSpeed() {
    this.previousSpeed = this.speed;
  }

  destroy() {
    this.shadow.destroy();
    this.sprite.destroy();
  }
}
