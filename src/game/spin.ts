/**
 * L'effet : la troisieme entree d'un lancer.
 *
 * Jusqu'ici un lancer tenait en deux nombres — un angle et une puissance —
 * tires du meme glissement, et l'angle etait en plus brouille par une
 * deviation aleatoire. Le geste se terminait au relachement : aucune
 * decision a prendre pendant le vol, et aucune facon de faire mieux que
 * « viser juste ». C'est la raison pour laquelle le jeu paraissait simple.
 *
 * L'effet ajoute une dimension SANS ajouter d'interface : on le lit dans la
 * COURBURE du trajet du doigt. Tirer tout droit donne exactement le tir
 * d'avant ; tirer en arc fait decrire au baton une courbe du meme cote. On
 * dessine la trajectoire qu'on veut.
 *
 * Ce que ca ouvre, et qui existait deja sans servir : les rochers et les
 * cactus deviennent des choses a CONTOURNER, les onze terrains reprennent du
 * sens, et surtout le kubb central — injouable parce que la ligne droite
 * passe par le roi, dont le moindre contact fait perdre sur-le-champ —
 * devient atteignable par l'exterieur.
 *
 * Module PUR : ni Phaser, ni Matter, ni React. Les deux regles qui comptent
 * (comment un trajet devient un effet, comment un effet devient une force)
 * sont donc verifiables sans navigateur.
 */

/** Un point du trajet du doigt, en coordonnees de monde. */
export interface Point {
  x: number;
  y: number;
}

export const SPIN = {
  /**
   * Courbure, en fraction de la longueur du glissement, au-dela de laquelle
   * l'effet est maximal.
   *
   * Mesure geometrique : l'ecart perpendiculaire MOYEN vaut les deux tiers de
   * la fleche de l'arc. 0,16 correspond donc a une fleche d'environ 24 % de
   * la corde — une banane franche, impossible a tracer par megarde.
   *
   * La premiere valeur, 0,08, saturait a l'effet maximal pour un arc tout a
   * fait ordinaire (mesure au banc d'essai : fleche de 70 px sur 380,
   * effet 1,000). Il ne restait donc aucune plage utile entre « un peu » et
   * « a fond ».
   */
  fullCurveRatio: 0.16,

  /**
   * En deca de cette courbure, l'effet est nul.
   *
   * Indispensable sur telephone : un pouce PIVOTE autour de son
   * articulation, donc un glissement naturel est deja legerement courbe.
   * Sans zone morte, presque chaque lancer partirait en courbe sans que le
   * joueur l'ait voulu — et il n'aurait aucun moyen de tirer droit.
   */
  deadZoneRatio: 0.04,

  /**
   * En deca de cette longueur de glissement (px de design), on ne lit aucun
   * effet. Un geste court est du bruit : la main tremble, et deux pixels
   * d'ecart sur quarante feraient un effet maximal.
   */
  minDragLength: 60,

  /**
   * Acceleration laterale par pas Matter, a effet maximal et a pleine
   * vitesse. A comparer a WIND.accelPerStepPerForce = 0,05 : l'effet est
   * volontairement du meme ordre que le vent, qui est deja une force avec
   * laquelle il faut compter sans qu'elle decide de la partie.
   *
   * Valeur choisie sur une MESURE en vraie physique Matter, pas a
   * l'intuition (cf. tests/browser/effet.mjs).
   */
  accelPerStep: 0.3,

  /**
   * En dessous de cette vitesse (px/pas Matter), plus d'effet. Un baton qui
   * finit sa course en roulant ne doit pas partir en spirale — et c'est ce
   * qui arrive si la force laterale survit a la vitesse.
   */
  minSpeed: 2,

  /** Vitesse de rotation visuelle du baton, a effet maximal. */
  visualSpin: 0.7
} as const;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Effet lu dans le trajet du doigt, entre -1 et 1.
 *
 * 0 = glissement rectiligne = le tir d'avant, au pixel pres.
 *
 * On mesure l'ecart perpendiculaire MOYEN des points du trajet a la corde
 * qui joint son debut a sa fin, rapporte a la longueur de cette corde. La
 * moyenne plutot que le point du milieu : un doigt ne trace pas un arc
 * parfait, et un seul point mal place deciderait de tout.
 *
 * Le signe suit le produit vectoriel 2D (corde x point) : positif quand le
 * trajet passe a GAUCHE de la corde dans le repere ecran (y vers le bas),
 * donc quand le doigt a contourne par la gauche. `spinAcceleration` pousse
 * du meme cote, pour que la courbe aille la ou le doigt est passe.
 */
export function spinFromDragPath(path: readonly Point[]): number {
  if (path.length < 3) return 0;

  const debut = path[0];
  const fin = path[path.length - 1];
  const cordeX = fin.x - debut.x;
  const cordeY = fin.y - debut.y;
  const corde = Math.hypot(cordeX, cordeY);
  if (corde < SPIN.minDragLength) return 0;

  const ux = cordeX / corde;
  const uy = cordeY / corde;

  let somme = 0;
  for (let i = 1; i < path.length - 1; i += 1) {
    const px = path[i].x - debut.x;
    const py = path[i].y - debut.y;
    somme += ux * py - uy * px;
  }
  const ecartMoyen = somme / (path.length - 2);
  const ratio = ecartMoyen / corde;

  // Zone morte, puis montee lineaire jusqu'a 1 : en dessous du seuil on rend
  // exactement 0, pas « presque 0 » — tirer droit doit rester possible.
  const utile = Math.abs(ratio) - SPIN.deadZoneRatio;
  if (utile <= 0) return 0;
  return Math.sign(ratio) * clamp(utile / (SPIN.fullCurveRatio - SPIN.deadZoneRatio), 0, 1);
}

/**
 * Force de Magnus : l'acceleration a ajouter a la vitesse du projectile a
 * chaque pas de simulation.
 *
 * Perpendiculaire a la vitesse COURANTE, et non a l'angle de depart : c'est
 * ce qui fait une courbe plutot qu'une droite inclinee. Proportionnelle a la
 * vitesse, comme la vraie force de Magnus — la courbe se produit tant que le
 * baton file et s'efface quand il ralentit, ce qui donne la trajectoire en
 * banane attendue et evite qu'un baton presque arrete tourne en rond.
 *
 * `maxSpeed` est la vitesse de reference (THROW.maxSpeed) : passee en
 * parametre pour que ce module ne depende pas de rules.ts, et reste
 * simulable isolement.
 */
export function spinAcceleration(vx: number, vy: number, spin: number, maxSpeed: number): Point {
  if (spin === 0) return { x: 0, y: 0 };

  const vitesse = Math.hypot(vx, vy);
  if (vitesse < SPIN.minSpeed) return { x: 0, y: 0 };

  const magnitude = SPIN.accelPerStep * spin * Math.min(1, vitesse / maxSpeed);
  // (vx, vy) tourne d'un quart de tour, dans le sens qui pousse le projectile
  // DU COTE OU LE DOIGT EST PASSE.
  //
  // Le signe est le piege de ce module, et la premiere version l'avait a
  // l'envers : la courbe partait a l'oppose du geste. Verification a la main,
  // dans le repere ecran (y vers le bas) : un glissement vers le bas,
  // u = (0, 1), dont le trajet bombe vers la DROITE, p = (+d, .), donne
  // `ux*py - uy*px = -d`, donc un effet NEGATIF ; il faut alors une
  // acceleration vers +x. C'est ce que donne la formule ci-dessous, et
  // spin.test.ts le verrouille dans les quatre directions.
  return { x: (-vy / vitesse) * magnitude, y: (vx / vitesse) * magnitude };
}
