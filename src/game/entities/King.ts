import Phaser from 'phaser';
import { KING_BODY } from '../physics/matterConfig';
import { HITBOX } from '../rules';
import { KING_SKIN_COLORS, SHADOW, type KingSkin } from '../theme';
import { appliquerEchelleMatter, echelleSprite } from '../renderScale';

/**
 * Le roi, unique, au centre du terrain (regle classique du Kubb).
 * Les deux equipes le partagent : le faire tomber trop tot coute la partie.
 */
export class King {
  readonly sprite: Phaser.Physics.Matter.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly skin: KingSkin;
  private downed = false;
  /** Halo WebGL allume tant que le roi est une cible legale. null = eteint. */
  private glow: Phaser.FX.Glow | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, skin: KingSkin = 'or') {
    this.skin = skin;
    this.shadow = scene.add
      .image(x + SHADOW.offsetX, y + SHADOW.offsetY, 'shadow')
      .setDepth(2)
      .setAlpha(SHADOW.alpha)
      .setScale(echelleSprite(SHADOW.scale.king));

    this.sprite = scene.matter.add.image(x, y, `king-${skin}`, undefined, {
      ...KING_BODY,
      shape: { type: 'circle', radius: HITBOX.kingRadius }
    });
    this.sprite.setDepth(4);
    // Compense la resolution des textures SANS toucher au rayon du corps :
    // c'est lui que l'IA utilise pour decider si le roi est sur sa ligne de
    // tir (ai.ts::KING_HIT_RADIUS).
    appliquerEchelleMatter(this.sprite);
    this.sprite.setData('king', this);
  }

  get isStanding() {
    return !this.downed;
  }

  /**
   * Allume (ou eteint) un halo autour du roi tant qu'il est une cible legale
   * pour l'equipe active.
   *
   * C'est un vrai effet de post-traitement WebGL, pas une texture : il epouse
   * la silhouette du roi — couronne comprise — ce qu'aucun anneau pre-dessine
   * ne peut faire. Il s'ajoute a l'anneau pulsant au sol (juice.ts), qui
   * reste le signal principal : le halo seul serait trop discret en plein
   * soleil, et l'anneau seul ne designe pas la piece.
   *
   * Sans WebGL (`preFX` absent : repli Canvas de Phaser sur un materiel ou un
   * navigateur qui ne l'offre pas), il ne se passe simplement rien — le jeu
   * garde son anneau et reste parfaitement jouable.
   */
  setTargetGlow(on: boolean) {
    const fx = this.sprite.active ? this.sprite.preFX : null;
    if (!fx) return;
    if (on === (this.glow !== null)) return;

    if (!on) {
      if (this.glow) fx.remove(this.glow);
      this.glow = null;
      return;
    }

    // Le halo deborde du sprite : sans marge, il serait coupe net au bord de
    // la texture.
    fx.setPadding(10);
    this.glow = fx.addGlow(KING_SKIN_COLORS[this.skin].light, 3, 0, false, 0.08, 12);
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
    this.glow = null;
    this.sprite.destroy();

    // Le roi bascule lentement : c'est le geste qui clot la partie.
    const fallen = scene.add
      .image(x, y, `king-down-${this.skin}`)
      .setDepth(1)
      .setScale(echelleSprite(0.55), echelleSprite(1.1))
      .setAngle(-12);

    scene.tweens.add({
      targets: fallen,
      scaleX: echelleSprite(),
      scaleY: echelleSprite(),
      angle: Phaser.Math.Between(74, 100),
      duration: 460,
      ease: 'Back.easeOut'
    });

    this.shadow.setDepth(0.5);
    scene.tweens.add({
      targets: this.shadow,
      x: x + SHADOW.offsetX * 0.4,
      y: y + SHADOW.offsetY * 0.4,
      scaleX: echelleSprite(SHADOW.scale.king * 1.5),
      scaleY: echelleSprite(SHADOW.scale.king * 0.8),
      alpha: SHADOW.alpha * 0.7,
      duration: 460,
      ease: 'Quad.easeOut'
    });
  }
}
