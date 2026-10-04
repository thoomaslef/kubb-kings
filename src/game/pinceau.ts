/**
 * Pinceau : le dessin des textures du jeu, sur une toile Canvas 2D.
 *
 * Pourquoi pas `Phaser.Graphics`, qui servait jusqu'ici :
 *
 *   1. Graphics NE SAIT PAS FAIRE DE DEGRADE. Toutes les rondeurs du jeu
 *      etaient donc obtenues en empilant quatorze cercles concentriques dont
 *      les alphas s'additionnent (l'ancien `softCircle`) : cher, grossier, et
 *      impossible a etendre a une ombre floue ou a un reflet.
 *   2. Graphics n'a pas d'ombre portee. Canvas en a une vraie
 *      (`shadowBlur`), ce qui donne du relief sans le simuler a la main.
 *
 * Et surtout, le passage a Canvas permet la chose qui manquait au rendu
 * haute resolution : TOUT EST DESSINE A `facteur` FOIS LA TAILLE. Le tampon
 * de rendu etait bien passe a la definition reelle de l'ecran
 * (renderScale.ts), mais les textures, elles, restaient generees a la taille
 * de design et se faisaient donc agrandir d'autant par le zoom de la camera :
 * le gain etait exactement annule pour tout ce qui est pre-rendu. Mesure a
 * DPR 3 avant cette correction : 1,625 pixel physique par pixel de texture,
 * soit la meme valeur qu'avant le rendu haute resolution.
 *
 * Le dessin reste ecrit en UNITES DE DESIGN : c'est la toile qui est plus
 * grande, via `ctx.scale`. Aucune des tailles ecrites dans BootScene n'a
 * donc eu a changer.
 *
 * L'API reprend volontairement celle de `Phaser.Graphics` (fillStyle +
 * fillCircle, lineStyle + strokeCircle...) : le dessin de chaque piece du
 * jeu a ainsi pu etre reporte tel quel, et seuls les endroits qui GAGNENT
 * quelque chose ont ete reecrits avec les nouveaux outils.
 */

/** Un arret de degrade : position (0..1), couleur, et opacite. */
export interface ArretDeDegrade {
  stop: number;
  color: number;
  alpha?: number;
}

function css(color: number, alpha: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export class Pinceau {
  /**
   * `facteur` n'est PAS la pour multiplier les coordonnees — `ctx.scale` s'en
   * charge — mais pour les rares grandeurs que Canvas n'exprime pas dans
   * l'espace transforme : le flou et le decalage d'une ombre portee sont en
   * pixels de l'appareil, et resteraient donc deux fois trop petits.
   */
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly facteur: number
  ) {}

  // --------------------------------------------------- styles (comme Graphics)

  fillStyle(color: number, alpha = 1): this {
    this.ctx.fillStyle = css(color, alpha);
    return this;
  }

  lineStyle(width: number, color: number, alpha = 1): this {
    this.ctx.lineWidth = width;
    this.ctx.strokeStyle = css(color, alpha);
    return this;
  }

  // ------------------------------------------------------------- remplissages

  fillRect(x: number, y: number, width: number, height: number): this {
    this.ctx.fillRect(x, y, width, height);
    return this;
  }

  fillCircle(x: number, y: number, radius: number): this {
    this.ctx.beginPath();
    this.ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2);
    this.ctx.fill();
    return this;
  }

  /** Centre et DIAMETRES, comme `Graphics.fillEllipse`. */
  fillEllipse(x: number, y: number, width: number, height: number): this {
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, Math.max(0, width / 2), Math.max(0, height / 2), 0, 0, Math.PI * 2);
    this.ctx.fill();
    return this;
  }

  fillRoundedRect(x: number, y: number, width: number, height: number, radius: number): this {
    this.cheminArrondi(x, y, width, height, radius);
    this.ctx.fill();
    return this;
  }

  fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.lineTo(x3, y3);
    this.ctx.closePath();
    this.ctx.fill();
    return this;
  }

  // ----------------------------------------------------------------- contours

  strokeCircle(x: number, y: number, radius: number): this {
    this.ctx.beginPath();
    this.ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2);
    this.ctx.stroke();
    return this;
  }

  strokeRoundedRect(x: number, y: number, width: number, height: number, radius: number): this {
    this.cheminArrondi(x, y, width, height, radius);
    this.ctx.stroke();
    return this;
  }

  lineBetween(x1: number, y1: number, x2: number, y2: number): this {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    return this;
  }

  // ------------------------------------------------------- ce que Graphics n'a pas

  /**
   * Degrade lineaire, d'un point a un autre. Remplace `fillStyle` pour le
   * prochain remplissage, comme dans Graphics.
   */
  degradeLineaire(x1: number, y1: number, x2: number, y2: number, arrets: ArretDeDegrade[]): this {
    const d = this.ctx.createLinearGradient(x1, y1, x2, y2);
    arrets.forEach(({ stop, color, alpha = 1 }) => d.addColorStop(stop, css(color, alpha)));
    this.ctx.fillStyle = d;
    return this;
  }

  /** Degrade radial depuis le centre. */
  degradeRadial(cx: number, cy: number, radius: number, arrets: ArretDeDegrade[]): this {
    const d = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(0.01, radius));
    arrets.forEach(({ stop, color, alpha = 1 }) => d.addColorStop(stop, css(color, alpha)));
    this.ctx.fillStyle = d;
    return this;
  }

  /**
   * Disque a bord doux — l'ancien `softCircle`, en un seul vrai degrade.
   *
   * `durete` (0..1) est la part du rayon qui reste pleine avant le fondu :
   * 0 donne un halo tres diffus, 0,5 un coeur net entoure d'un bord doux.
   */
  disqueDoux(cx: number, cy: number, radius: number, color: number, alpha = 1, durete = 0): this {
    this.degradeRadial(cx, cy, radius, [
      { stop: 0, color, alpha },
      { stop: Math.min(0.99, durete), color, alpha },
      { stop: 1, color, alpha: 0 }
    ]);
    return this.fillCircle(cx, cy, radius);
  }

  /**
   * Dessine avec une ombre portee floue. Le flou et le decalage sont donnes
   * en unites de design et convertis ici : Canvas les exprime en pixels de
   * l'appareil, hors de la transformation courante.
   */
  avecOmbre(
    flou: number,
    decalageX: number,
    decalageY: number,
    color: number,
    alpha: number,
    dessin: () => void
  ): this {
    const { ctx } = this;
    ctx.save();
    ctx.shadowBlur = flou * this.facteur;
    ctx.shadowOffsetX = decalageX * this.facteur;
    ctx.shadowOffsetY = decalageY * this.facteur;
    ctx.shadowColor = css(color, alpha);
    dessin();
    ctx.restore();
    return this;
  }

  /** Limite les prochains dessins a un rectangle arrondi. */
  dansArrondi(x: number, y: number, width: number, height: number, radius: number, dessin: () => void): this {
    this.ctx.save();
    this.cheminArrondi(x, y, width, height, radius);
    this.ctx.clip();
    dessin();
    this.ctx.restore();
    return this;
  }

  private cheminArrondi(x: number, y: number, width: number, height: number, radius: number) {
    const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}
