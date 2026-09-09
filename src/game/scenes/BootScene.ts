import Phaser from 'phaser';
import { TEAMS } from '../entities/Team';

/**
 * Genere toutes les textures du MVP par code (aucun asset externe a charger),
 * puis enchaine sur le menu.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.buildBatonTexture();
    this.buildKubbTextures();
    this.buildKingTexture();
    this.buildThrowerTextures();
    this.buildParticleTextures();

    this.scene.start('MenuScene');
  }

  private texture(key: string, width: number, height: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  private buildBatonTexture() {
    this.texture('baton', 14, 62, (g) => {
      g.fillStyle(0x8a5f34, 1);
      g.fillRoundedRect(0, 0, 14, 62, 6);
      g.fillStyle(0xc9975b, 1);
      g.fillRoundedRect(2, 2, 10, 58, 5);
      g.fillStyle(0xe0b57c, 1);
      g.fillRect(5, 8, 3, 46);
    });
  }

  private buildKubbTextures() {
    (Object.keys(TEAMS) as Array<keyof typeof TEAMS>).forEach((id) => {
      const { color } = TEAMS[id];
      this.texture(`kubb-${id}`, 36, 36, (g) => {
        g.fillStyle(0x000000, 0.25);
        g.fillRoundedRect(2, 4, 34, 32, 6);
        g.fillStyle(color, 1);
        g.fillRoundedRect(0, 0, 34, 34, 6);
        g.fillStyle(0xffffff, 0.22);
        g.fillRoundedRect(4, 4, 26, 10, 4);
      });
    });
  }

  private buildKingTexture() {
    this.texture('king', 48, 48, (g) => {
      g.fillStyle(0x000000, 0.25);
      g.fillCircle(25, 26, 20);
      g.fillStyle(0xf2c14e, 1);
      g.fillCircle(24, 24, 20);
      g.fillStyle(0xfff0bd, 1);
      g.fillCircle(24, 24, 12);
      // Petite couronne stylisee
      g.fillStyle(0x8a6b12, 1);
      g.fillTriangle(14, 26, 19, 14, 24, 26);
      g.fillTriangle(24, 26, 29, 14, 34, 26);
    });
  }

  private buildThrowerTextures() {
    (Object.keys(TEAMS) as Array<keyof typeof TEAMS>).forEach((id) => {
      const { color } = TEAMS[id];
      this.texture(`thrower-${id}`, 34, 34, (g) => {
        g.fillStyle(color, 0.35);
        g.fillCircle(17, 17, 16);
        g.lineStyle(3, color, 1);
        g.strokeCircle(17, 17, 13);
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(17, 17, 5);
      });
    });
  }

  /**
   * Textures du feedback (particules, halos). Graphics ne sait pas faire de
   * degrade : les disques "doux" sont empiles en couches concentriques dont
   * les alphas s'additionnent vers le centre.
   */
  private buildParticleTextures() {
    const softCircle = (g: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number, color: number, steps = 14) => {
      for (let i = steps; i >= 1; i -= 1) {
        g.fillStyle(color, 0.10);
        g.fillCircle(cx, cy, (radius * i) / steps);
      }
    };

    // Eclat de bois projete par un impact.
    this.texture('p-splinter', 9, 5, (g) => {
      g.fillStyle(0xc9975b, 1);
      g.fillRect(0, 0, 9, 5);
      g.fillStyle(0xe8c896, 1);
      g.fillRect(0, 0, 9, 2);
    });

    // Poussiere soulevee au sol.
    this.texture('p-dust', 22, 22, (g) => softCircle(g, 11, 11, 11, 0xd9e6d4));

    // Etincelle doree, reservee au roi.
    this.texture('p-gold', 10, 10, (g) => {
      softCircle(g, 5, 5, 5, 0xffe08a, 6);
      g.fillStyle(0xfff6d5, 1);
      g.fillCircle(5, 5, 1.6);
    });

    // Halo d'impact : agrandi puis efface par un tween.
    this.texture('p-flash', 96, 96, (g) => softCircle(g, 48, 48, 48, 0xffffff, 18));

    // Anneau pulsant autour du roi quand il devient une cible legale.
    this.texture('p-halo', 170, 170, (g) => {
      for (let i = 0; i < 10; i += 1) {
        g.lineStyle(10 - i * 0.6, 0xf2c14e, 0.05);
        g.strokeCircle(85, 85, 52 + i * 2.4);
      }
      g.lineStyle(3, 0xffe08a, 0.5);
      g.strokeCircle(85, 85, 58);
    });
  }
}
