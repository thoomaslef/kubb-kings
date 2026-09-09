import Phaser from 'phaser';
import * as sfx from './audio';

/**
 * Tout le "ressenti" du match : particules, secousses, vibration, ralenti,
 * textes flottants. Regroupe ici pour que MatchScene reste une machine a
 * etats lisible et que le reglage du feedback se fasse en un seul endroit.
 *
 * Aucune de ces methodes n'a d'effet sur les regles : on peut toutes les
 * retirer sans changer l'issue d'une partie.
 */

/** Reglage du feedback. Purement cosmetique : rien ici n'influe sur le jeu. */
export const FEEL = {
  /** Secousse camera a l'impact d'un kubb : duree (ms) et amplitude. */
  kubbShake: { duration: 150, min: 0.004, max: 0.011 },
  kingShake: { duration: 420, intensity: 0.018 },
  wallShake: { duration: 70, intensity: 0.002 },
  /** Ralenti applique au monde Matter quand le roi tombe. */
  hitStop: { scale: 0.12, durationMs: 260 },
  /** Intervalle entre deux images remanentes du baton en vol. */
  trailIntervalMs: 26,
  /** Vibrations (ms). Ignorees si le navigateur ne les expose pas. */
  vibration: { kubb: 22, king: [40, 50, 90] as number[], foul: [28, 40, 28] as number[] }
} as const;

/** Vibre si le materiel le permet ; silencieux partout ailleurs (iOS Safari). */
function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* certains navigateurs jettent quand la page n'a pas le focus */
  }
}

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

export class Juice {
  private readonly scene: Phaser.Scene;

  private splinters!: Emitter;
  private dust!: Emitter;
  private sparkle!: Emitter;

  /** Halo qui pulse autour du roi quand il devient une cible legale. */
  private kingHalo: Phaser.GameObjects.Image | null = null;
  private haloTween: Phaser.Tweens.Tween | null = null;

  private trailMs = 0;
  private hitStopTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Eclats de bois : projetes dans toutes les directions, ils retombent vite.
    this.splinters = scene.add.particles(0, 0, 'p-splinter', {
      speed: { min: 90, max: 320 },
      lifespan: { min: 260, max: 520 },
      scale: { start: 1, end: 0.2 },
      alpha: { start: 1, end: 0 },
      rotate: { min: -180, max: 180 },
      emitting: false
    });
    this.splinters.setDepth(8);

    // Poussiere : nuage large et lent, pour l'assise de l'impact.
    this.dust = scene.add.particles(0, 0, 'p-dust', {
      speed: { min: 20, max: 110 },
      lifespan: { min: 320, max: 620 },
      scale: { start: 0.5, end: 1.7 },
      alpha: { start: 0.32, end: 0 },
      emitting: false
    });
    this.dust.setDepth(3);

    // Etincelles dorees, reservees au roi.
    this.sparkle = scene.add.particles(0, 0, 'p-gold', {
      speed: { min: 60, max: 280 },
      lifespan: { min: 420, max: 900 },
      scale: { start: 1.1, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false
    });
    this.sparkle.setDepth(9);
  }

  // ------------------------------------------------------------------ lancer

  throwStart(x: number, y: number, power: number) {
    sfx.playThrow(power);
    this.dust.explode(6, x, y);
    this.trailMs = 0;
  }

  /**
   * Images remanentes derriere le baton. Appele a chaque frame de vol :
   * l'accumulateur espace les copies pour que la trainee ne depende pas du framerate.
   */
  trail(delta: number, x: number, y: number, rotation: number, speedRatio: number) {
    if (speedRatio < 0.12) return;
    this.trailMs += delta;
    if (this.trailMs < FEEL.trailIntervalMs) return;
    this.trailMs = 0;

    const ghost = this.scene.add
      .image(x, y, 'baton')
      .setDepth(5)
      .setRotation(rotation)
      .setAlpha(0.3 * speedRatio);

    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scaleX: 0.6,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => ghost.destroy()
    });
  }

  /** Le baton s'immobilise : petit frottement, sans effet visuel. */
  throwEnd() {
    sfx.playRest();
  }

  // --------------------------------------------------------------- impacts

  /**
   * Impact du baton sur un kubb adverse. `force` est normalisee (0..1) :
   * tout — secousse, particules, hauteur du son — s'echelonne dessus.
   */
  kubbImpact(x: number, y: number, force: number, color: number) {
    const f = Phaser.Math.Clamp(force, 0, 1);

    sfx.playKnock(f);
    vibrate(FEEL.vibration.kubb);

    const { duration, min, max } = FEEL.kubbShake;
    this.scene.cameras.main.shake(duration, min + (max - min) * f);

    this.splinters.explode(8 + Math.round(f * 12), x, y);
    this.dust.explode(5 + Math.round(f * 6), x, y);
    this.flash(x, y, color, 0.55 + f * 0.35);
  }

  /** Ricochet sur une bande : discret, juste assez pour situer le rebond. */
  wallBounce(x: number, y: number, force: number) {
    sfx.playBounce();
    this.dust.explode(3, x, y);
    this.scene.cameras.main.shake(FEEL.wallShake.duration, FEEL.wallShake.intensity * force);
  }

  /** Halo blanc bref a l'endroit du choc, teinte par l'equipe touchee. */
  private flash(x: number, y: number, color: number, alpha: number) {
    const halo = this.scene.add
      .image(x, y, 'p-flash')
      .setDepth(7)
      .setTint(color)
      .setAlpha(alpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.4);

    this.scene.tweens.add({
      targets: halo,
      scale: 1.6,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => halo.destroy()
    });
  }

  // ------------------------------------------------------------------- roi

  /**
   * Le roi devient (ou cesse d'etre) une cible legale pour l'equipe active.
   * `announce` joue le jingle et la gerbe d'ouverture : l'appelant le met a
   * false quand le halo ne fait que revenir au changement de tour.
   */
  setKingTargetable(targetable: boolean, x: number, y: number, announce = true) {
    if (targetable === (this.kingHalo !== null)) return;

    if (!targetable) {
      this.haloTween?.remove();
      this.haloTween = null;
      this.kingHalo?.destroy();
      this.kingHalo = null;
      return;
    }

    if (announce) {
      sfx.playKingUnlocked();
      this.sparkle.explode(18, x, y);
    }

    this.kingHalo = this.scene.add
      .image(x, y, 'p-halo')
      .setDepth(3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.5);

    this.haloTween = this.scene.tweens.add({
      targets: this.kingHalo,
      scale: { from: 0.8, to: 1.25 },
      alpha: { from: 0.55, to: 0.18 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  /**
   * Chute du roi : le moment le plus fort de la partie.
   * Ralenti du monde physique + zoom + gerbe doree.
   */
  kingFall(x: number, y: number, legal: boolean) {
    sfx.playKingFall();
    vibrate(legal ? FEEL.vibration.king : FEEL.vibration.foul);

    this.setKingTargetable(false, x, y, false);
    this.sparkle.explode(46, x, y);
    this.splinters.explode(22, x, y);
    this.dust.explode(16, x, y);
    this.flash(x, y, legal ? 0xf2c14e : 0xff5a4a, 0.95);

    const cam = this.scene.cameras.main;
    cam.shake(FEEL.kingShake.duration, FEEL.kingShake.intensity);
    cam.flash(180, 255, 240, 200, false);
    cam.zoomTo(1.09, 220, 'Sine.easeOut');
    this.scene.time.delayedCall(520, () => cam.zoomTo(1, 320, 'Sine.easeInOut'));

    this.hitStop();
  }

  /** Fige presque la physique un court instant, puis la relache. */
  private hitStop() {
    const timing = this.scene.matter.world.engine?.timing;
    if (!timing) return;

    timing.timeScale = FEEL.hitStop.scale;
    this.hitStopTimer?.remove();
    this.hitStopTimer = this.scene.time.delayedCall(FEEL.hitStop.durationMs, () => {
      const t = this.scene.matter.world.engine?.timing;
      if (t) t.timeScale = 1;
      this.hitStopTimer = null;
    });
  }

  // ----------------------------------------------------------------- textes

  /**
   * Texte qui monte et s'efface au-dessus d'un point du terrain.
   * Le point de depart est ramene dans l'ecran : un kubb abattu sur la ligne
   * de fond adverse est assez haut pour que le texte passe sous le HUD.
   */
  floatingText(x: number, y: number, label: string, color: string) {
    // Le texte monte de 70 px pendant son fondu : la borne haute tient compte
    // de cette course, sinon un impact sur la ligne de fond finit sous le HUD.
    const safeX = Phaser.Math.Clamp(x, 180, this.scene.scale.width - 180);
    const safeY = Phaser.Math.Clamp(y, 290, this.scene.scale.height - 90);

    const text = this.scene.add
      .text(safeX, safeY, label, {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color,
        stroke: '#0d1a14',
        strokeThickness: 6
      })
      .setOrigin(0.5)
      .setDepth(12);

    this.scene.tweens.add({
      targets: text,
      y: safeY - 70,
      alpha: { from: 1, to: 0 },
      scale: { from: 0.6, to: 1.15 },
      duration: 850,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy()
    });
  }

  /** Bandeau de passage de tour, qui traverse l'ecran horizontalement. */
  turnBanner(label: string, color: number, centerY: number, width: number) {
    sfx.playTurn();

    const container = this.scene.add.container(0, centerY).setDepth(14);

    const bar = this.scene.add.graphics();
    bar.fillStyle(0x0d1a14, 0.82);
    bar.fillRect(0, -34, width, 68);
    bar.fillStyle(color, 1);
    bar.fillRect(0, -34, width, 4);
    bar.fillRect(0, 30, width, 4);

    const text = this.scene.add
      .text(width / 2, 0, label, {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#eef4ef'
      })
      .setOrigin(0.5);

    container.add([bar, text]);
    container.setAlpha(0);
    container.setScale(1, 0.2);

    this.scene.tweens.chain({
      targets: container,
      tweens: [
        { alpha: 1, scaleY: 1, duration: 160, ease: 'Back.easeOut' },
        { alpha: 1, duration: 520 },
        { alpha: 0, scaleY: 0.2, duration: 180, ease: 'Quad.easeIn' }
      ],
      onComplete: () => container.destroy()
    });
  }

  /** Rend la physique a sa vitesse normale : indispensable en fin de scene. */
  destroy() {
    this.hitStopTimer?.remove();
    this.hitStopTimer = null;
    const timing = this.scene.matter.world?.engine?.timing;
    if (timing) timing.timeScale = 1;
    this.haloTween?.remove();
    this.haloTween = null;
  }
}
