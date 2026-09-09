import Phaser from 'phaser';
import { TEAMS } from '../entities/Team';
import { PALETTE } from '../theme';
import { OBSTACLE_RADIUS } from '../rules';

/**
 * Genere toutes les textures du jeu par code (aucun asset externe a charger),
 * puis enchaine sur le menu.
 *
 * Les tailles dessinees ici sont purement visuelles : les corps physiques ont
 * leurs propres dimensions (HITBOX dans rules.ts). On peut donc retoucher une
 * texture sans deplacer une seule collision.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.buildGrassTexture();
    this.buildBatonTexture();
    this.buildKubbTextures();
    this.buildKingTextures();
    this.buildThrowerTextures();
    this.buildObstacleTexture();
    this.buildShadowTexture();
    this.buildParticleTextures();

    this.scene.start('MenuScene');
  }

  private texture(key: string, width: number, height: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  /**
   * Disque a bord doux. Graphics ne sait pas faire de degrade : on empile des
   * cercles concentriques dont les alphas s'additionnent vers le centre.
   */
  private softCircle(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    radius: number,
    color: number,
    steps = 14,
    step = 0.1
  ) {
    for (let i = steps; i >= 1; i -= 1) {
      g.fillStyle(color, step);
      g.fillCircle(cx, cy, (radius * i) / steps);
    }
  }

  /** Variantes claire et sombre d'une couleur d'equipe. */
  private shades(color: number) {
    const base = Phaser.Display.Color.ValueToColor(color);
    return {
      light: base.clone().lighten(26).color,
      dark: base.clone().darken(32).color,
      deep: base.clone().darken(55).color
    };
  }

  // ---------------------------------------------------------------- pelouse

  /**
   * Tuile d'herbe repetee sur tout le terrain. La moucheture fine casse
   * l'aplat de couleur : c'est ce qui distingue une pelouse d'un rectangle vert.
   */
  private buildGrassTexture() {
    const size = 128;
    this.texture('grass', size, size, (g) => {
      g.fillStyle(PALETTE.grass, 1);
      g.fillRect(0, 0, size, size);

      for (let i = 0; i < 320; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        g.fillStyle(Math.random() < 0.5 ? PALETTE.grassLight : PALETTE.grassDark, 0.45);
        g.fillRect(x, y, 2 + Math.random() * 3, 1 + Math.random() * 2);
      }

      // Brins : de courts traits inclines, plus clairs que le fond.
      for (let i = 0; i < 110; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        g.lineStyle(1, PALETTE.blade, 0.3);
        g.lineBetween(x, y, x + (Math.random() * 4 - 2), y + 3 + Math.random() * 3);
      }
    });
  }

  // ------------------------------------------------------------------ baton

  private buildBatonTexture() {
    this.texture('baton', 16, 66, (g) => {
      g.fillStyle(PALETTE.batonWoodDark, 1);
      g.fillRoundedRect(0, 0, 16, 66, 7);
      g.fillStyle(PALETTE.batonWood, 1);
      g.fillRoundedRect(1, 1, 14, 64, 6);

      // Fil du bois : quelques veines longitudinales.
      g.fillStyle(PALETTE.batonWoodLight, 0.85);
      g.fillRect(5, 6, 3, 54);
      g.fillStyle(PALETTE.batonWoodDark, 0.28);
      g.fillRect(3, 10, 1, 46);
      g.fillRect(11, 8, 1, 50);

      // Bouts scies, plus sombres que le corps.
      g.fillStyle(PALETTE.batonWoodDark, 0.4);
      g.fillRoundedRect(1, 1, 14, 5, 3);
      g.fillRoundedRect(1, 60, 14, 5, 3);
    });
  }

  // ------------------------------------------------------------------ kubbs

  private buildKubbTextures() {
    (Object.keys(TEAMS) as Array<keyof typeof TEAMS>).forEach((id) => {
      const { color } = TEAMS[id];
      const { light, dark, deep } = this.shades(color);

      // Debout : bloc vu de tres legerement au-dessus. La face du dessus,
      // plus claire, donne le relief ; le biseau du bas l'assoit au sol.
      this.texture(`kubb-${id}`, 40, 40, (g) => {
        g.fillStyle(deep, 1);
        g.fillRoundedRect(0, 0, 40, 40, 8);
        g.fillStyle(color, 1);
        g.fillRoundedRect(1, 1, 38, 36, 7);

        g.fillStyle(light, 0.62);
        g.fillRoundedRect(4, 4, 32, 13, 5);

        // Fil du bois.
        g.fillStyle(dark, 0.2);
        for (let y = 20; y < 34; y += 5) g.fillRect(6, y, 28, 1);

        g.fillStyle(deep, 0.55);
        g.fillRoundedRect(1, 30, 38, 7, 4);
      });

      // Couche : bloc bascule sur le flanc, deteint, hors jeu.
      this.texture(`kubb-down-${id}`, 48, 32, (g) => {
        // Un bloc hors jeu doit se lire "eteint" : moins sature ET plus sombre.
        // Desaturer seul le fait virer au blanc et le rend plus visible que debout.
        const muted = Phaser.Display.Color.ValueToColor(color)
          .clone()
          .desaturate(34)
          .darken(26).color;

        g.fillStyle(deep, 0.55);
        g.fillRoundedRect(0, 2, 48, 30, 7);
        g.fillStyle(muted, 1);
        g.fillRoundedRect(1, 1, 46, 28, 6);

        // Face de bout, visible maintenant que le bloc est couche.
        g.fillStyle(dark, 0.4);
        g.fillRoundedRect(33, 2, 13, 26, 5);
        g.fillStyle(deep, 0.25);
        for (let x = 6; x < 30; x += 6) g.fillRect(x, 5, 1, 20);
      });
    });
  }

  // -------------------------------------------------------------------- roi

  private buildKingTextures() {
    this.texture('king', 52, 52, (g) => {
      g.fillStyle(PALETTE.goldDark, 1);
      g.fillCircle(26, 26, 24);
      g.fillStyle(PALETTE.gold, 1);
      g.fillCircle(26, 25, 22);
      g.fillStyle(PALETTE.goldLight, 0.55);
      g.fillCircle(26, 22, 15);

      // Couronne a trois pointes, posee sur un bandeau.
      g.fillStyle(PALETTE.goldDark, 1);
      g.fillTriangle(11, 32, 17, 15, 23, 32);
      g.fillTriangle(20, 32, 26, 11, 32, 32);
      g.fillTriangle(29, 32, 35, 15, 41, 32);
      g.fillRoundedRect(11, 30, 30, 8, 3);

      // Joyaux au sommet des pointes.
      g.fillStyle(0xfffdf2, 1);
      g.fillCircle(17, 16, 2.2);
      g.fillCircle(26, 12, 2.6);
      g.fillCircle(35, 16, 2.2);

      g.lineStyle(2, PALETTE.goldDark, 0.9);
      g.strokeCircle(26, 25, 22);
    });

    // Couche : l'or s'eteint, mais la couronne doit rester lisible — c'est
    // encore le roi, pas un caillou.
    this.texture('king-down', 56, 40, (g) => {
      const dull = Phaser.Display.Color.ValueToColor(PALETTE.gold)
        .clone()
        .desaturate(26)
        .darken(30).color;

      g.fillStyle(PALETTE.goldDark, 1);
      g.fillEllipse(28, 22, 52, 32);
      g.fillStyle(dull, 1);
      g.fillEllipse(28, 20, 48, 28);

      g.fillStyle(PALETTE.goldDark, 1);
      g.fillTriangle(12, 30, 17, 9, 23, 30);
      g.fillTriangle(24, 30, 30, 7, 36, 30);
      g.fillTriangle(37, 30, 42, 9, 48, 30);
      g.fillRoundedRect(12, 26, 36, 7, 3);
    });
  }

  // --------------------------------------------------------------- lanceurs

  private buildThrowerTextures() {
    (Object.keys(TEAMS) as Array<keyof typeof TEAMS>).forEach((id) => {
      const { color } = TEAMS[id];
      const { light } = this.shades(color);

      this.texture(`thrower-${id}`, 40, 40, (g) => {
        this.softCircle(g, 20, 20, 19, color, 8, 0.05);
        g.lineStyle(3, color, 0.9);
        g.strokeCircle(20, 20, 14);
        g.lineStyle(2, light, 0.55);
        g.strokeCircle(20, 20, 9);
        g.fillStyle(0xffffff, 0.92);
        g.fillCircle(20, 20, 4);
      });
    });
  }

  // --------------------------------------------------------------- rochers

  /**
   * Rocher des terrains a obstacles : une silhouette irreguliere (plusieurs
   * cercles chevauchants plutot qu'un disque parfait, pour ne pas se confondre
   * avec le roi) avec une facette claire en haut a gauche, coherente avec la
   * source de lumiere des ombres portees (theme.ts).
   */
  private buildObstacleTexture() {
    const size = OBSTACLE_RADIUS * 2 + 6;
    const c = size / 2;

    this.texture('obstacle', size, size, (g) => {
      const bump = (dx: number, dy: number, r: number, color: number, alpha = 1) => {
        g.fillStyle(color, alpha);
        g.fillCircle(c + dx, c + dy, r);
      };

      bump(0, 2, OBSTACLE_RADIUS, PALETTE.rockDark);
      bump(-4, -3, OBSTACLE_RADIUS - 3, PALETTE.rock);
      bump(5, 4, OBSTACLE_RADIUS - 6, PALETTE.rock);

      // Facette claire : meme coin que les autres pieces (haut-gauche).
      bump(-6, -7, OBSTACLE_RADIUS - 11, PALETTE.rockLight, 0.7);

      // Quelques craquelures, pour casser l'aplat.
      g.lineStyle(1, PALETTE.rockDark, 0.4);
      g.lineBetween(c - 6, c - 2, c + 2, c + 6);
      g.lineBetween(c + 4, c - 8, c + 8, c - 1);
    });
  }

  // ---------------------------------------------------------------- ombres

  /**
   * Une seule tache d'ombre, mise a l'echelle par chaque piece.
   * Coeur dense puis halo doux : une ombre uniformement diffuse ne se voit pas.
   */
  private buildShadowTexture() {
    this.texture('shadow', 56, 56, (g) => {
      this.softCircle(g, 28, 28, 26, 0x061109, 12, 0.13);
      g.fillStyle(0x061109, 0.5);
      g.fillCircle(28, 28, 12);
    });
  }

  // ------------------------------------------------------------- particules

  private buildParticleTextures() {
    // Eclat de bois projete par un impact.
    this.texture('p-splinter', 9, 5, (g) => {
      g.fillStyle(PALETTE.batonWood, 1);
      g.fillRect(0, 0, 9, 5);
      g.fillStyle(PALETTE.batonWoodLight, 1);
      g.fillRect(0, 0, 9, 2);
    });

    // Poussiere soulevee au sol.
    this.texture('p-dust', 22, 22, (g) => this.softCircle(g, 11, 11, 11, 0xd9e6d4));

    // Etincelle doree, reservee au roi.
    this.texture('p-gold', 10, 10, (g) => {
      this.softCircle(g, 5, 5, 5, PALETTE.goldLight, 6);
      g.fillStyle(0xfff6d5, 1);
      g.fillCircle(5, 5, 1.6);
    });

    // Halo d'impact : agrandi puis efface par un tween.
    this.texture('p-flash', 96, 96, (g) => this.softCircle(g, 48, 48, 48, 0xffffff, 18));

    // Anneau pulsant autour du roi quand il devient une cible legale.
    this.texture('p-halo', 170, 170, (g) => {
      for (let i = 0; i < 10; i += 1) {
        g.lineStyle(10 - i * 0.6, PALETTE.gold, 0.05);
        g.strokeCircle(85, 85, 52 + i * 2.4);
      }
      g.lineStyle(3, PALETTE.goldLight, 0.5);
      g.strokeCircle(85, 85, 58);
    });
  }
}
