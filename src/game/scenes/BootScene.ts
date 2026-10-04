import Phaser from 'phaser';
import { TEAMS } from '../entities/Team';
import { PALETTE, KUBB_SKINS, type KubbSkin, KING_SKINS, KING_SKIN_COLORS } from '../theme';
import { HITBOX, OBSTACLE_RADIUS } from '../rules';
import { Pinceau } from '../pinceau';
import { renderScaleFactor } from '../renderScale';

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
    this.buildNightGrassTexture();
    this.buildIceTexture();
    this.buildSandTexture();
    this.buildMudTexture();
    this.buildBatonTexture();
    this.buildBoulTexture();
    this.buildBoulFerTexture();
    this.buildDisqueTexture();
    this.buildKubbTextures();
    this.buildKingTextures();
    this.buildThrowerTextures();
    this.buildObstacleTexture();
    this.buildCactusTexture();
    this.buildShadowTexture();
    this.buildParticleTextures();

    this.scene.start('MenuScene');
  }

  /**
   * Genere une texture. `width`/`height` sont en UNITES DE DESIGN : la toile
   * reelle est `renderScaleFactor()` fois plus grande, et le dessin est mis a
   * l'echelle en consequence.
   *
   * C'est la moitie manquante du rendu haute resolution : le tampon avait
   * bien ete porte a la definition de l'ecran (renderScale.ts), mais une
   * texture generee a la taille de design se faisait ensuite agrandir
   * d'autant par le zoom de la camera. Cote affichage, chaque sprite
   * compense par `echelleSprite` / `appliquerEchelleMatter`.
   */
  private texture(key: string, width: number, height: number, draw: (p: Pinceau) => void) {
    const facteur = renderScaleFactor();
    // Un jeu recree (remontage du composant React) retrouve un gestionnaire
    // de textures neuf, mais autant ne pas dependre de ce detail : une cle
    // deja prise ferait echouer createCanvas en silence (il renvoie null).
    if (this.textures.exists(key)) this.textures.remove(key);

    const texture = this.textures.createCanvas(key, Math.ceil(width * facteur), Math.ceil(height * facteur));
    if (!texture) return;

    const ctx = texture.getContext();
    ctx.save();
    ctx.scale(facteur, facteur);
    draw(new Pinceau(ctx, facteur));
    ctx.restore();
    // Sans ceci, la toile est peinte mais jamais envoyee au GPU.
    texture.refresh();
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

  /**
   * Tuile d'herbe nocturne, terrain "Nuit" (remplace la pelouse sur tout le
   * terrain) : meme squelette que buildGrassTexture, teintes assombries —
   * purement decoratif (aucun obstacle ni friction modifiee, cf. rules.ts).
   */
  private buildNightGrassTexture() {
    const size = 128;
    this.texture('night', size, size, (g) => {
      g.fillStyle(PALETTE.nightGrass, 1);
      g.fillRect(0, 0, size, size);

      for (let i = 0; i < 320; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        g.fillStyle(Math.random() < 0.5 ? PALETTE.nightGrassLight : PALETTE.nightGrassDark, 0.45);
        g.fillRect(x, y, 2 + Math.random() * 3, 1 + Math.random() * 2);
      }

      for (let i = 0; i < 110; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        g.lineStyle(1, PALETTE.nightBlade, 0.3);
        g.lineBetween(x, y, x + (Math.random() * 4 - 2), y + 3 + Math.random() * 3);
      }
    });
  }

  /**
   * Tuile de glace, terrain "Glace" (remplace la pelouse sur tout le
   * terrain, cf. MatchScene::drawField) : quelques craquelures et reflets,
   * plus froid et plus lisse qu'un aplat de bleu clair.
   */
  private buildIceTexture() {
    const size = 128;
    this.texture('ice', size, size, (g) => {
      g.fillStyle(PALETTE.ice, 1);
      g.fillRect(0, 0, size, size);

      for (let i = 0; i < 90; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        g.fillStyle(Math.random() < 0.5 ? PALETTE.iceLight : PALETTE.iceDark, 0.3);
        g.fillRect(x, y, 3 + Math.random() * 6, 1 + Math.random() * 2);
      }

      // Craquelures : quelques traits fins et anguleux.
      for (let i = 0; i < 10; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        g.lineStyle(1, PALETTE.iceDark, 0.35);
        const midX = x + (Math.random() * 30 - 15);
        const midY = y + (Math.random() * 30 - 15);
        g.lineBetween(x, y, midX, midY);
        g.lineBetween(midX, midY, midX + (Math.random() * 24 - 12), midY + (Math.random() * 24 - 12));
      }
    });
  }

  /**
   * Tuile de sable, terrain "Sable" (remplace la pelouse sur tout le
   * terrain) : grain fin et quelques ondulations, comme une dune vue de dessus.
   */
  private buildSandTexture() {
    const size = 128;
    this.texture('sand', size, size, (g) => {
      g.fillStyle(PALETTE.sand, 1);
      g.fillRect(0, 0, size, size);

      for (let i = 0; i < 380; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        g.fillStyle(Math.random() < 0.5 ? PALETTE.sandLight : PALETTE.sandDark, 0.4);
        g.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
      }

      // Ondulations : bandes courbes tres subtiles.
      for (let i = 0; i < 5; i += 1) {
        const y = (i + 0.5) * (size / 5);
        g.lineStyle(2, PALETTE.sandDark, 0.18);
        g.lineBetween(0, y, size, y + (Math.random() * 10 - 5));
      }
    });
  }

  /**
   * Tuile de boue, terrain "Boue" (remplace la pelouse sur tout le
   * terrain) : grosses flaques sombres et quelques traces, plus lourd et
   * moins regulier que le grain fin du sable.
   */
  private buildMudTexture() {
    const size = 128;
    this.texture('mud', size, size, (g) => {
      g.fillStyle(PALETTE.mud, 1);
      g.fillRect(0, 0, size, size);

      for (let i = 0; i < 26; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        g.fillStyle(Math.random() < 0.5 ? PALETTE.mudLight : PALETTE.mudDark, 0.35);
        g.fillEllipse(x, y, 10 + Math.random() * 16, 6 + Math.random() * 10);
      }

      // Flaques : quelques taches sombres plus rondes, plus marquees.
      for (let i = 0; i < 8; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        g.fillStyle(PALETTE.mudDark, 0.4);
        g.fillEllipse(x, y, 6 + Math.random() * 8, 4 + Math.random() * 6);
      }
    });
  }

  // ------------------------------------------------------------------ baton

  private buildBatonTexture() {
    this.texture('baton', 16, 66, (g) => {
      g.fillStyle(PALETTE.batonWoodDark, 1);
      g.fillRoundedRect(0, 0, 16, 66, 7);

      // Degrade en travers du baton : c'est ce qui le fait lire comme un
      // cylindre et non comme un rectangle. Trois bandes de couleur plate le
      // suggeraient avant, avec une marche bien visible entre chacune.
      g.degradeLineaire(1, 0, 15, 0, [
        { stop: 0, color: PALETTE.batonWoodDark },
        { stop: 0.28, color: PALETTE.batonWoodLight },
        { stop: 0.52, color: PALETTE.batonWood },
        { stop: 1, color: PALETTE.batonWoodDark }
      ]).fillRoundedRect(1, 1, 14, 64, 6);

      // Fil du bois : quelques veines longitudinales.
      g.fillStyle(PALETTE.batonWoodDark, 0.22);
      g.fillRect(4, 10, 1, 46);
      g.fillRect(11, 8, 1, 50);

      // Bouts scies, plus sombres que le corps.
      g.fillStyle(PALETTE.batonWoodDark, 0.4);
      g.fillRoundedRect(1, 1, 14, 5, 3);
      g.fillRoundedRect(1, 60, 14, 5, 3);
    });
  }

  /**
   * Boule (baton de boutique, shape:'boule' dans batons.ts) : meme bois que
   * le baton, mais un disque plutot qu'un rectangle allonge. La couture en
   * croix (comme une boule de petanque en bois) donne un repere visuel a la
   * rotation en vol, sans quoi une simple sphere semble immobile en tournant
   * sur elle-meme.
   */
  private buildBoulTexture() {
    const size = HITBOX.ballRadius * 2 + 4;
    const r = HITBOX.ballRadius;
    const cx = size / 2;
    const cy = size / 2;
    this.texture('boule', size, size, (g) => {
      g.fillStyle(PALETTE.batonWoodDark, 1);
      g.fillCircle(cx, cy, r + 2);

      // Sphere : degrade radial decentre vers la source de lumiere (en haut
      // a gauche, comme les ombres portees, cf. theme.ts). Un disque plat
      // surmonte d'un petit cercle clair ne tournait pas vraiment rond.
      g.degradeRadial(cx - r * 0.3, cy - r * 0.32, r * 1.5, [
        { stop: 0, color: PALETTE.batonWoodLight },
        { stop: 0.42, color: PALETTE.batonWood },
        { stop: 1, color: PALETTE.batonWoodDark }
      ]).fillCircle(cx, cy, r);

      g.lineStyle(1.5, PALETTE.batonWoodDark, 0.55);
      g.strokeCircle(cx, cy, r * 0.62);
      g.lineBetween(cx - r * 0.62, cy, cx + r * 0.62, cy);
      g.lineBetween(cx, cy - r * 0.62, cx, cy + r * 0.62);
    });
  }

  /**
   * Boule de fer (baton de boutique, shape:'boule' dans batons.ts) : meme
   * corps physique et meme taille que la boule en bois (HITBOX.ballRadius),
   * juste une texture metallique — cf. PALETTE.metal, deja utilisee par le
   * skin de kubb "Metal". Rivets plutot que couture en croix : repere
   * visuel different de la boule en bois, pour rester distinguable au vol.
   */
  private buildBoulFerTexture() {
    const size = HITBOX.ballRadius * 2 + 4;
    const r = HITBOX.ballRadius;
    const cx = size / 2;
    const cy = size / 2;
    this.texture('boulefer', size, size, (g) => {
      g.fillStyle(PALETTE.metalDark, 1);
      g.fillCircle(cx, cy, r + 2);

      // Metal : meme sphere degradee que la boule en bois, mais avec un
      // reflet franc — c'est le contraste serre qui fait "poli".
      g.degradeRadial(cx - r * 0.34, cy - r * 0.36, r * 1.4, [
        { stop: 0, color: 0xffffff, alpha: 0.95 },
        { stop: 0.18, color: PALETTE.metalLight },
        { stop: 0.52, color: PALETTE.metal },
        { stop: 1, color: PALETTE.metalDark }
      ]).fillCircle(cx, cy, r);

      // Rivets : 4 petits points sombres, comme une boule de canon rivetee.
      g.fillStyle(PALETTE.metalDark, 0.7);
      [
        [cx, cy - r * 0.6],
        [cx, cy + r * 0.6],
        [cx - r * 0.6, cy],
        [cx + r * 0.6, cy]
      ].forEach(([px, py]) => g.fillCircle(px, py, r * 0.1));
    });
  }

  /**
   * Disque (baton de boutique, shape:'disque' dans batons.ts) : un corps
   * physique nouveau (HITBOX.discRadius, plus large que la boule), rendu
   * comme un palet plat vu de dessus — anneau exterieur plus sombre pour
   * suggerer l'epaisseur, plutot que le degrade spherique de la boule.
   */
  private buildDisqueTexture() {
    const size = HITBOX.discRadius * 2 + 4;
    const r = HITBOX.discRadius;
    const cx = size / 2;
    const cy = size / 2;
    this.texture('disque', size, size, (g) => {
      g.fillStyle(PALETTE.slateDark, 1);
      g.fillCircle(cx, cy, r + 2);
      // Palet vu de dessus : l'anneau exterieur garde son degrade d'epaisseur,
      // la face superieure reste franche pour que le palet ne passe pas pour
      // une bille.
      g.degradeRadial(cx, cy, r, [
        { stop: 0, color: PALETTE.slate },
        { stop: 0.74, color: PALETTE.slate },
        { stop: 1, color: PALETTE.slateDark }
      ]).fillCircle(cx, cy, r);
      g.degradeLineaire(cx, cy - r * 0.72, cx, cy + r * 0.72, [
        { stop: 0, color: PALETTE.slateLight },
        { stop: 1, color: PALETTE.slate }
      ]).fillCircle(cx, cy, r * 0.72);

      g.lineStyle(1.5, PALETTE.slateDark, 0.6);
      g.strokeCircle(cx, cy, r * 0.72);
      g.strokeCircle(cx, cy, r * 0.38);
    });
  }

  // ------------------------------------------------------------------ kubbs

  private buildKubbTextures() {
    (Object.keys(TEAMS) as Array<keyof typeof TEAMS>).forEach((id) => {
      const { color } = TEAMS[id];
      const shades = this.shades(color);

      KUBB_SKINS.forEach((skin) => {
        // Debout : bloc vu de tres legerement au-dessus. La face du dessus,
        // plus claire, donne le relief ; le biseau du bas l'assoit au sol.
        this.texture(`kubb-${id}-${skin}`, 40, 40, (g) => this.drawKubbStanding(g, skin, color, shades));

        // Couche : bloc bascule sur le flanc, deteint, hors jeu.
        this.texture(`kubb-down-${id}-${skin}`, 48, 32, (g) => this.drawKubbFallen(g, skin, color, shades));
      });
    });
  }

  /**
   * Un meme squelette (cadre + face + biseau) pour les trois habillages —
   * seuls les remplissages et details changent, jamais les dimensions : la
   * hitbox (rules.ts::HITBOX) ne depend d'aucun de ces choix visuels.
   */
  private drawKubbStanding(
    g: Pinceau,
    skin: KubbSkin,
    color: number,
    shades: { light: number; dark: number; deep: number }
  ) {
    const { light, dark, deep } = shades;

    if (skin === 'marbre') {
      g.fillStyle(deep, 1);
      g.fillRoundedRect(0, 0, 40, 40, 8);
      g.degradeLineaire(0, 1, 0, 37, [
        { stop: 0, color: 0xffffff },
        { stop: 0.4, color: PALETTE.marble },
        { stop: 1, color: dark, alpha: 0.75 }
      ]).fillRoundedRect(1, 1, 38, 36, 7);

      g.degradeLineaire(0, 4, 0, 18, [
        { stop: 0, color: 0xffffff, alpha: 0.75 },
        { stop: 1, color: 0xffffff, alpha: 0 }
      ]).fillRoundedRect(4, 4, 32, 14, 5);

      // Veines irregulieres, teintees par la couleur d'equipe.
      g.lineStyle(1, dark, 0.5);
      g.lineBetween(6, 12, 16, 22);
      g.lineBetween(16, 22, 14, 30);
      g.lineBetween(22, 8, 30, 18);
      g.lineBetween(30, 18, 26, 28);

      g.fillStyle(deep, 0.55);
      g.fillRoundedRect(1, 30, 38, 7, 4);
      return;
    }

    if (skin === 'metal') {
      g.fillStyle(deep, 1);
      g.fillRoundedRect(0, 0, 40, 40, 8);
      // Metal brosse : une serie de bandes de clarte decroissante, ce que
      // deux rectangles d'alpha fixe ne pouvaient pas rendre.
      g.degradeLineaire(0, 1, 0, 37, [
        { stop: 0, color: 0xffffff },
        { stop: 0.14, color: PALETTE.metalLight },
        { stop: 0.42, color: PALETTE.metal },
        { stop: 0.68, color: PALETTE.metalLight, alpha: 0.9 },
        { stop: 1, color: PALETTE.metalDark }
      ]).fillRoundedRect(1, 1, 38, 36, 7);

      // Bande d'equipe pleine couleur : seul un cadre suffirait moins a se
      // reperer au premier coup d'oeil sur une surface aussi neutre.
      g.fillStyle(color, 1);
      g.fillRoundedRect(1, 30, 38, 7, 4);
      return;
    }

    if (skin === 'ardoise') {
      // Boutique : pierre sombre fracturee, bande d'equipe fine en accent.
      g.fillStyle(PALETTE.slateDark, 1);
      g.fillRoundedRect(0, 0, 40, 40, 8);
      g.degradeLineaire(0, 1, 0, 37, [
        { stop: 0, color: PALETTE.slateLight },
        { stop: 0.3, color: PALETTE.slate },
        { stop: 1, color: PALETTE.slateDark }
      ]).fillRoundedRect(1, 1, 38, 36, 7);

      g.degradeLineaire(0, 4, 0, 16, [
        { stop: 0, color: PALETTE.slateLight, alpha: 0.6 },
        { stop: 1, color: PALETTE.slateLight, alpha: 0 }
      ]).fillRoundedRect(4, 4, 32, 12, 5);

      // Fractures irregulieres, comme des veines de marbre mais anguleuses.
      g.lineStyle(1, PALETTE.slateDark, 0.7);
      g.lineBetween(5, 10, 13, 20);
      g.lineBetween(13, 20, 9, 28);
      g.lineBetween(24, 6, 34, 16);
      g.lineBetween(34, 16, 28, 24);

      g.fillStyle(color, 0.9);
      g.fillRoundedRect(1, 32, 38, 5, 3);
      return;
    }

    // 'bois' — look d'origine, mais modele par de vrais degrades : le bloc
    // etait fait de trois aplats (corps, face du dessus, biseau) avec une
    // marche nette entre chacun. Memes dimensions, meme silhouette.
    g.fillStyle(deep, 1);
    g.fillRoundedRect(0, 0, 40, 40, 8);

    g.degradeLineaire(0, 1, 0, 37, [
      { stop: 0, color: light },
      { stop: 0.36, color },
      { stop: 1, color: dark }
    ]).fillRoundedRect(1, 1, 38, 36, 7);

    // Face du dessus : la lumiere s'y eteint vers l'arete, au lieu de
    // s'arreter net.
    g.degradeLineaire(0, 4, 0, 18, [
      { stop: 0, color: light, alpha: 0.9 },
      { stop: 1, color: light, alpha: 0 }
    ]).fillRoundedRect(4, 4, 32, 14, 5);

    // Fil du bois.
    g.fillStyle(dark, 0.18);
    for (let y = 20; y < 34; y += 5) g.fillRect(6, y, 28, 1);

    // Assise : l'ombre monte du sol, elle n'est plus une bande posee.
    g.degradeLineaire(0, 27, 0, 37, [
      { stop: 0, color: deep, alpha: 0 },
      { stop: 1, color: deep, alpha: 0.72 }
    ]).fillRoundedRect(1, 27, 38, 10, 5);
  }

  private drawKubbFallen(
    g: Pinceau,
    skin: KubbSkin,
    color: number,
    shades: { light: number; dark: number; deep: number }
  ) {
    const { dark, deep } = shades;

    if (skin === 'marbre') {
      const muted = Phaser.Display.Color.ValueToColor(PALETTE.marble).clone().darken(10).color;

      g.fillStyle(deep, 0.55);
      g.fillRoundedRect(0, 2, 48, 30, 7);
      g.fillStyle(muted, 1);
      g.fillRoundedRect(1, 1, 46, 28, 6);

      // Face de bout, visible maintenant que le bloc est couche.
      g.fillStyle(dark, 0.35);
      g.fillRoundedRect(33, 2, 13, 26, 5);
      g.lineStyle(1, dark, 0.4);
      g.lineBetween(6, 6, 14, 16);
      g.lineBetween(18, 4, 24, 14);
      g.lineBetween(24, 18, 30, 26);
      return;
    }

    if (skin === 'metal') {
      g.fillStyle(deep, 0.6);
      g.fillRoundedRect(0, 2, 48, 30, 7);
      g.fillStyle(PALETTE.metalDark, 1);
      g.fillRoundedRect(1, 1, 46, 28, 6);

      g.fillStyle(PALETTE.metal, 0.6);
      g.fillRect(2, 4, 44, 4);

      // Face de bout teintee d'equipe : reste identifiable une fois couche.
      g.fillStyle(color, 0.85);
      g.fillRoundedRect(33, 2, 13, 26, 5);
      return;
    }

    if (skin === 'ardoise') {
      g.fillStyle(deep, 0.55);
      g.fillRoundedRect(0, 2, 48, 30, 7);
      g.fillStyle(PALETTE.slateDark, 1);
      g.fillRoundedRect(1, 1, 46, 28, 6);

      g.lineStyle(1, PALETTE.slateLight, 0.5);
      g.lineBetween(6, 6, 14, 16);
      g.lineBetween(18, 4, 24, 14);
      g.lineBetween(24, 18, 30, 26);

      g.fillStyle(color, 0.85);
      g.fillRoundedRect(33, 2, 13, 26, 5);
      return;
    }

    // 'bois' — look d'origine.
    // Un bloc hors jeu doit se lire "eteint" : moins sature ET plus sombre.
    // Desaturer seul le fait virer au blanc et le rend plus visible que debout.
    const muted = Phaser.Display.Color.ValueToColor(color).clone().desaturate(34).darken(26).color;

    g.fillStyle(deep, 0.55);
    g.fillRoundedRect(0, 2, 48, 30, 7);
    g.fillStyle(muted, 1);
    g.fillRoundedRect(1, 1, 46, 28, 6);

    // Face de bout, visible maintenant que le bloc est couche.
    g.fillStyle(dark, 0.4);
    g.fillRoundedRect(33, 2, 13, 26, 5);
    g.fillStyle(deep, 0.25);
    for (let x = 6; x < 30; x += 6) g.fillRect(x, 5, 1, 20);
  }

  // -------------------------------------------------------------------- roi

  private buildKingTextures() {
    KING_SKINS.forEach((skin) => {
      const { base, light, dark, gem } = KING_SKIN_COLORS[skin];

      this.texture(`king-${skin}`, 52, 52, (g) => {
        g.fillStyle(dark, 1);
        g.fillCircle(26, 26, 24);

        // Spheroide metallique : degrade radial decentre vers la lumiere, et
        // un rebond de clarte au bord oppose, comme sur un metal poli. Trois
        // cercles concentriques donnaient un roi plat.
        g.degradeRadial(21, 19, 30, [
          { stop: 0, color: 0xffffff, alpha: 0.9 },
          { stop: 0.16, color: light },
          { stop: 0.52, color: base },
          { stop: 0.86, color: dark },
          { stop: 1, color: light, alpha: 0.55 }
        ]).fillCircle(26, 25, 22);

        // Couronne a trois pointes, posee sur un bandeau, detachee du corps
        // par une vraie ombre floue — c'est elle qui donne le relief.
        g.avecOmbre(3, 0, 1.5, 0x000000, 0.55, () => {
          g.degradeLineaire(0, 11, 0, 38, [
            { stop: 0, color: light },
            { stop: 0.55, color: base },
            { stop: 1, color: dark }
          ]);
          g.fillTriangle(11, 32, 17, 15, 23, 32);
          g.fillTriangle(20, 32, 26, 11, 32, 32);
          g.fillTriangle(29, 32, 35, 15, 41, 32);
          g.fillRoundedRect(11, 30, 30, 8, 3);
        });

        // Joyaux au sommet des pointes, chacun avec son propre eclat.
        [
          [17, 16, 2.2],
          [26, 12, 2.6],
          [35, 16, 2.2]
        ].forEach(([jx, jy, jr]) => {
          g.disqueDoux(jx, jy, jr * 2, gem, 0.5);
          g.fillStyle(gem, 1);
          g.fillCircle(jx, jy, jr);
        });

        g.lineStyle(2, dark, 0.9);
        g.strokeCircle(26, 25, 22);
      });

      // Couche : la teinte s'eteint, mais la couronne doit rester lisible —
      // c'est encore le roi, pas un caillou.
      this.texture(`king-down-${skin}`, 56, 40, (g) => {
        const dull = Phaser.Display.Color.ValueToColor(base).clone().desaturate(26).darken(30).color;

        g.fillStyle(dark, 1);
        g.fillEllipse(28, 22, 52, 32);
        g.fillStyle(dull, 1);
        g.fillEllipse(28, 20, 48, 28);

        g.fillStyle(dark, 1);
        g.fillTriangle(12, 30, 17, 9, 23, 30);
        g.fillTriangle(24, 30, 30, 7, 36, 30);
        g.fillTriangle(37, 30, 42, 9, 48, 30);
        g.fillRoundedRect(12, 26, 36, 7, 3);
      });
    });
  }

  // --------------------------------------------------------------- lanceurs

  private buildThrowerTextures() {
    (Object.keys(TEAMS) as Array<keyof typeof TEAMS>).forEach((id) => {
      const { color } = TEAMS[id];
      const { light } = this.shades(color);

      this.texture(`thrower-${id}`, 40, 40, (g) => {
        g.disqueDoux(20, 20, 19, color, 0.4);
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

  /**
   * Cactus (obstacles du terrain "Sable"), a la place des rochers habituels
   * — meme corps Matter (rayon, rebond), juste une autre texture. Un saguaro
   * simplifie (tronc + 2 bras) tient dans le meme gabarit circulaire que le
   * rocher, avec la meme facette claire en haut a gauche (coherente avec les
   * ombres portees, theme.ts) et quelques epines claires pour la lisibilite.
   */
  private buildCactusTexture() {
    const size = OBSTACLE_RADIUS * 2 + 6;
    const c = size / 2;

    this.texture('cactus', size, size, (g) => {
      const trunkWidth = 13;
      const trunkTop = c - OBSTACLE_RADIUS + 2;
      const trunkHeight = OBSTACLE_RADIUS * 2 - 4;

      g.fillStyle(PALETTE.cactusDark, 1);
      g.fillRoundedRect(c - trunkWidth / 2 + 1, trunkTop + 1, trunkWidth, trunkHeight, trunkWidth / 2);

      g.fillStyle(PALETTE.cactus, 1);
      g.fillRoundedRect(c - trunkWidth / 2, trunkTop, trunkWidth, trunkHeight, trunkWidth / 2);

      // Deux bras, un de chaque cote, comme un saguaro.
      const armWidth = 8;
      g.fillStyle(PALETTE.cactus, 1);
      g.fillRoundedRect(c - trunkWidth / 2 - armWidth + 2, c - 6, armWidth, 16, armWidth / 2);
      g.fillRoundedRect(c + trunkWidth / 2 - 2, c - 12, armWidth, 16, armWidth / 2);

      // Facette claire : meme coin que les autres pieces (haut-gauche).
      g.fillStyle(PALETTE.cactusLight, 0.55);
      g.fillRoundedRect(c - trunkWidth / 2, trunkTop, trunkWidth / 2, trunkHeight * 0.6, trunkWidth / 4);

      // Epines : quelques points clairs le long du tronc.
      g.fillStyle(PALETTE.cactusSpine, 0.8);
      for (let i = 0; i < 5; i += 1) {
        const y = trunkTop + 4 + i * (trunkHeight - 8) * 0.25;
        g.fillCircle(c - trunkWidth / 2 + 1, y, 1);
        g.fillCircle(c + trunkWidth / 2 - 1, y, 1);
      }
    });
  }

  // ---------------------------------------------------------------- ombres

  /**
   * Une seule tache d'ombre, mise a l'echelle par chaque piece.
   * Coeur dense puis halo doux : une ombre uniformement diffuse ne se voit pas.
   */
  private buildShadowTexture() {
    this.texture('shadow', 56, 56, (g) => {
      // Un seul vrai degrade, la ou il fallait douze cercles empiles plus un
      // disque plein : coeur dense, puis fondu complet au bord.
      g.degradeRadial(28, 28, 26, [
        { stop: 0, color: 0x061109, alpha: 0.95 },
        { stop: 0.42, color: 0x061109, alpha: 0.7 },
        { stop: 1, color: 0x061109, alpha: 0 }
      ]).fillCircle(28, 28, 26);
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
    this.texture('p-dust', 22, 22, (g) => g.disqueDoux(11, 11, 11, 0xd9e6d4, 1, 0.12));

    // Etincelle doree, reservee au roi.
    this.texture('p-gold', 10, 10, (g) => {
      g.disqueDoux(5, 5, 5, PALETTE.goldLight, 0.75, 0.1);
      g.fillStyle(0xfff6d5, 1);
      g.fillCircle(5, 5, 1.6);
    });

    // Halo d'impact : agrandi puis efface par un tween.
    this.texture('p-flash', 96, 96, (g) => g.disqueDoux(48, 48, 48, 0xffffff, 1, 0.06));

    // Anneau pulsant autour du roi quand il devient une cible legale.
    this.texture('p-halo', 170, 170, (g) => {
      // Anneau degrade : plein au rayon de l'anneau, eteint de part et
      // d'autre. Dix contours empiles donnaient des marches visibles.
      g.degradeRadial(85, 85, 85, [
        { stop: 0, color: PALETTE.gold, alpha: 0 },
        { stop: 0.56, color: PALETTE.gold, alpha: 0 },
        { stop: 0.69, color: PALETTE.goldLight, alpha: 0.55 },
        { stop: 0.78, color: PALETTE.gold, alpha: 0.18 },
        { stop: 1, color: PALETTE.gold, alpha: 0 }
      ]).fillCircle(85, 85, 85);
    });
  }
}
