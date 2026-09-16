import Phaser from 'phaser';
import { KUBB_BODY } from '../physics/matterConfig';
import { HITBOX } from '../rules';
import { SHADOW, type KubbSkin } from '../theme';
import type { TeamId } from './Team';

/**
 * Statut d'un kubb :
 * - 'baseline' : encore sur sa ligne de fond d'origine, jamais touche.
 * - 'field' : "kubb de champ" (regle Kubbs de champ, cf. rules.ts
 *   FIELD_KUBB_INSET) — abattu une premiere fois puis replante par
 *   MatchScene dans le camp de son PROPRE lanceur (cible prioritaire au
 *   tour suivant de cette equipe, cf. MatchScene::legalTargets). Reste
 *   possede par la meme equipe, juste deplace.
 * - 'out' : definitivement tombe (deuxieme abattage, ou premier abattage
 *   quand la regle Kubbs de champ est desactivee) — quitte la simulation,
 *   reste couche au sol comme decor.
 */
export type KubbStatus = 'baseline' | 'field' | 'out';

/**
 * Un bloc de bois d'une equipe. Sans la regle "Kubbs de champ" (menu),
 * `status` ne vaut jamais que 'baseline' ou 'out' — comportement identique
 * a avant l'introduction de cette regle.
 *
 * Le corps physique fait HITBOX.kubb de cote, quelle que soit la taille de la
 * texture : le rendu peut evoluer sans toucher aux collisions.
 */
export class Kubb {
  sprite: Phaser.Physics.Matter.Image;
  readonly team: TeamId;
  private readonly skin: KubbSkin;
  /** Position d'origine sur la ligne de fond : reprise telle quelle a la redresse (reviveUp), quel que soit le chemin emprunte pour tomber. */
  private readonly baselineX: number;
  private readonly baselineY: number;
  /** Ombre portee, sprite independant qui suit le bloc tant qu'il est en jeu (baseline ou field). */
  private readonly shadow: Phaser.GameObjects.Image;
  /** Decor couche au sol pendant que le kubb est definitivement tombe — detruit a la redresse. */
  private fallenSprite: Phaser.GameObjects.Image | null = null;
  private _status: KubbStatus = 'baseline';

  constructor(scene: Phaser.Scene, x: number, y: number, team: TeamId, skin: KubbSkin) {
    this.team = team;
    this.skin = skin;
    this.baselineX = x;
    this.baselineY = y;

    this.shadow = scene.add
      .image(x + SHADOW.offsetX, y + SHADOW.offsetY, 'shadow')
      .setDepth(2)
      .setAlpha(SHADOW.alpha)
      .setScale(SHADOW.scale.kubb);

    this.sprite = this.spawnBody(scene, x, y);
  }

  private spawnBody(scene: Phaser.Scene, x: number, y: number): Phaser.Physics.Matter.Image {
    const sprite = scene.matter.add.image(x, y, `kubb-${this.team}-${this.skin}`, undefined, {
      ...KUBB_BODY,
      chamfer: { radius: 5 },
      shape: { type: 'rectangle', width: HITBOX.kubb, height: HITBOX.kubb }
    });
    sprite.setDepth(4);
    sprite.setData('kubb', this);
    return sprite;
  }

  get status(): KubbStatus {
    return this._status;
  }

  /** Toujours en jeu (baseline ou field) : c'est encore une cible que l'adversaire doit abattre. */
  get isInPlay(): boolean {
    return this._status !== 'out';
  }

  /** Encore sur sa ligne de fond d'origine : seul statut qui ouvre une position de lancer (cf. rules.ts::availableThrowPositions). */
  get isAtBaseline(): boolean {
    return this._status === 'baseline';
  }

  /** "Kubb de champ" : cible prioritaire de sa propre equipe au tour suivant. */
  get isFieldKubb(): boolean {
    return this._status === 'field';
  }

  /** Recale l'ombre sur le bloc. Appele a chaque frame par la scene, tant qu'il est en jeu. */
  syncShadow() {
    if (this._status === 'out') return;
    this.shadow.setPosition(this.sprite.x + SHADOW.offsetX, this.sprite.y + SHADOW.offsetY);
    this.shadow.setRotation(this.sprite.rotation);
  }

  /** Retire le kubb du jeu : il bascule sur le flanc et y reste. */
  knockDown(scene: Phaser.Scene) {
    if (this._status === 'out') return;
    this._status = 'out';

    const { x, y, rotation } = this.sprite;
    this.sprite.destroy();

    const fallen = scene.add
      .image(x, y, `kubb-down-${this.team}-${this.skin}`)
      .setDepth(1)
      .setRotation(rotation)
      .setScale(0.68, 1.05);
    this.fallenSprite = fallen;

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

  /**
   * Regle "Kubbs de champ" (menu) : un kubb encore sur sa ligne de fond
   * (baseline) vient d'etre abattu, mais au lieu de sortir du jeu, il est
   * aussitot replante a (x, y) — dans le camp de son PROPRE lanceur, cf.
   * MatchScene::fieldKubbSlot — ou il reste une cible, prioritaire sur les
   * kubbs de ligne au prochain tour de son equipe. Placement automatique et
   * instantane (pas de sous-lancer physique) : juste un corps physique neuf
   * a la nouvelle position, comme une redresse.
   */
  plantInField(scene: Phaser.Scene, x: number, y: number) {
    if (this._status !== 'baseline') return;
    this._status = 'field';

    this.sprite.destroy();
    this.sprite = this.spawnBody(scene, x, y);

    this.shadow.setPosition(x + SHADOW.offsetX, y + SHADOW.offsetY);
    this.shadow.setRotation(0);

    // Petit "pop" a l'arrivee : seul indice visuel, hors tween de chute
    // (knockDown), que ce kubb vient d'etre replante ailleurs.
    this.sprite.setScale(0.6);
    scene.tweens.add({
      targets: this.sprite,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut'
    });
  }

  /**
   * Redresse un kubb definitivement tombe ('out') a sa position de ligne de
   * fond d'origine (effet "ricochet sur bande avant l'impact") : reforme un
   * corps physique neuf, comme a la creation. Toujours vers la baseline,
   * qu'il soit tombe directement ou apres etre passe par 'field'.
   */
  reviveUp(scene: Phaser.Scene) {
    if (this._status !== 'out') return;
    this._status = 'baseline';

    scene.tweens.killTweensOf(this.shadow);
    if (this.fallenSprite) {
      scene.tweens.killTweensOf(this.fallenSprite);
      this.fallenSprite.destroy();
      this.fallenSprite = null;
    }

    this.sprite = this.spawnBody(scene, this.baselineX, this.baselineY);
    this.shadow.setDepth(2);
    this.shadow.setPosition(this.baselineX + SHADOW.offsetX, this.baselineY + SHADOW.offsetY);
    this.shadow.setRotation(0);
    this.shadow.setScale(SHADOW.scale.kubb);
    this.shadow.setAlpha(SHADOW.alpha);
  }
}
