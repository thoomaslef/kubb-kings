import Phaser from 'phaser';
import { BATON_BODY } from '../physics/matterConfig';
import { THROW, MAX_AIM_DEVIATION_DEG, HITBOX } from '../rules';
import { SHADOW } from '../theme';
import type { BatonStats } from '../batons';

/**
 * Le projectile lance par le joueur actif : le baton par defaut (rectangle
 * allonge), ou un projectile de boutique a corps circulaire (boule, boule
 * de fer, disque) — cf. `shape` dans batons.ts. Corps Matter tres peu
 * amorti dans tous les cas : il glisse sur le terrain vu de dessus.
 */
export class Baton {
  readonly sprite: Phaser.Physics.Matter.Image;
  /** Ombre portee, sprite independant qui suit le baton. */
  private readonly shadow: Phaser.GameObjects.Image;
  /** Vitesse observee a la frame precedente, utilisee pour mesurer la force d'impact. */
  private previousSpeed = 0;
  /** Texture reellement utilisee — pour la trainee (Juice.trail). */
  readonly textureKey: string;

  /**
   * `textureKey` est separe de `shape` : deux projectiles peuvent partager
   * le meme corps physique (Boule et Boule de fer, meme cercle) avec un
   * rendu different — cf. batons.ts. `restitutionMultiplier` (terrain,
   * rules.ts::FieldPreset) : rebond aux bandes/rochers pour toute la
   * partie — fixe au lancer (contrairement a frictionAir, qui varie par
   * frame selon la position, cf. MatchScene::applyTerrainFriction), le
   * terrain ne change pas en cours de vol.
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    shape: BatonStats['shape'] = 'baton',
    textureKey: string = 'baton',
    restitutionMultiplier = 1
  ) {
    this.textureKey = textureKey;

    // Boule/disque sont ronds : ombre circulaire (pas d'allongement,
    // contrairement au baton dont l'ombre suit son grand axe).
    this.shadow = scene.add
      .image(x + SHADOW.offsetX, y + SHADOW.offsetY, 'shadow')
      .setDepth(3)
      .setAlpha(SHADOW.alpha * 0.8)
      .setScale(SHADOW.scale.baton, shape === 'baton' ? SHADOW.scale.baton * 1.5 : SHADOW.scale.baton);

    const bodyShape =
      shape === 'boule'
        ? { shape: { type: 'circle' as const, radius: HITBOX.ballRadius } }
        : shape === 'disque'
          ? { shape: { type: 'circle' as const, radius: HITBOX.discRadius } }
          : { chamfer: { radius: 6 }, shape: { type: 'rectangle' as const, width: HITBOX.batonWidth, height: HITBOX.batonLength } };

    this.sprite = scene.matter.add.image(x, y, this.textureKey, undefined, {
      ...BATON_BODY,
      restitution: BATON_BODY.restitution * restitutionMultiplier,
      ...bodyShape
    });
    this.sprite.setDepth(6);
  }

  /** Recale l'ombre sur le baton. Appele a chaque frame par la scene. */
  syncShadow() {
    this.shadow.setPosition(this.sprite.x + SHADOW.offsetX, this.sprite.y + SHADOW.offsetY);
    this.shadow.setRotation(this.sprite.rotation);
  }

  /**
   * Lance le baton. Une deviation aleatoire de +/- deviationDeg degres (par
   * defaut MAX_AIM_DEVIATION_DEG) est ajoutee a l'angle vise : c'est "l'effet"
   * leger du MVP. `speedMultiplier` (baton du joueur, cf. batons.ts) module la
   * vitesse atteinte a jauge egale — 1 par defaut (baton de base / IA).
   */
  launch(angle: number, power: number, deviationDeg = MAX_AIM_DEVIATION_DEG, speedMultiplier = 1) {
    const deviation = Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-deviationDeg, deviationDeg));
    const finalAngle = angle + deviation;
    const speed = THROW.maxSpeed * power * speedMultiplier;

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
