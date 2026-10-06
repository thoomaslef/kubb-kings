import { describe, expect, it } from 'vitest';
import { SPIN, spinAcceleration, spinFromDragPath, type Point } from './spin';
import { THROW } from './rules';

/**
 * Les deux regles de l'effet, verifiees sans navigateur.
 *
 * La plus importante est la CORRESPONDANCE DES SIGNES : un geste qui bombe
 * d'un cote doit faire partir le baton de ce cote-la. Rien d'autre ne
 * signalerait une inversion — le jeu continuerait de fonctionner, les
 * trajectoires seraient courbes, et chaque tir partirait a l'oppose de ce
 * que le joueur a dessine. La premiere version du module avait exactement
 * ce defaut.
 */

/** Trajet en arc de `debut` a `fin`, bombe de `fleche` px perpendiculairement. */
function arc(debut: Point, fin: Point, fleche: number, points = 9): Point[] {
  const dx = fin.x - debut.x;
  const dy = fin.y - debut.y;
  const longueur = Math.hypot(dx, dy);
  const ux = dx / longueur;
  const uy = dy / longueur;
  // Normale a gauche de la corde dans le repere ecran.
  const nx = -uy;
  const ny = ux;
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    // Parabole : nulle aux extremites, maximale au milieu.
    const ecart = fleche * 4 * t * (1 - t);
    return { x: debut.x + dx * t + nx * ecart, y: debut.y + dy * t + ny * ecart };
  });
}

describe('spinFromDragPath', () => {
  it('ne lit aucun effet dans un glissement rectiligne', () => {
    const droit = arc({ x: 360, y: 1100 }, { x: 360, y: 700 }, 0);
    expect(spinFromDragPath(droit)).toBe(0);
  });

  it('ne lit aucun effet dans un geste trop court, meme tres courbe', () => {
    const court = arc({ x: 360, y: 1100 }, { x: 360, y: 1100 - (SPIN.minDragLength - 10) }, 30);
    expect(spinFromDragPath(court)).toBe(0);
  });

  it('donne des effets opposes pour deux arcs symetriques', () => {
    const gauche = spinFromDragPath(arc({ x: 360, y: 1100 }, { x: 360, y: 700 }, 40));
    const droite = spinFromDragPath(arc({ x: 360, y: 1100 }, { x: 360, y: 700 }, -40));
    expect(gauche).toBeCloseTo(-droite, 6);
    expect(gauche).not.toBe(0);
  });

  it('croit avec la courbure, puis sature a 1', () => {
    const corde = 400;
    const faible = Math.abs(spinFromDragPath(arc({ x: 360, y: 1100 }, { x: 360, y: 1100 - corde }, 10)));
    const fort = Math.abs(spinFromDragPath(arc({ x: 360, y: 1100 }, { x: 360, y: 1100 - corde }, 40)));
    expect(fort).toBeGreaterThan(faible);
    const enorme = Math.abs(spinFromDragPath(arc({ x: 360, y: 1100 }, { x: 360, y: 1100 - corde }, 400)));
    expect(enorme).toBe(1);
  });

  it('ne depend que de la FORME du geste, pas de sa taille', () => {
    // Deux gestes homothetiques doivent donner le meme effet : sinon un
    // lancer puissant courberait plus qu'un lancer doux a geste identique.
    const petit = spinFromDragPath(arc({ x: 0, y: 0 }, { x: 0, y: 200 }, 20));
    const grand = spinFromDragPath(arc({ x: 0, y: 0 }, { x: 0, y: 400 }, 40));
    expect(petit).toBeCloseTo(grand, 6);
  });

  it('se lit dans toutes les directions, pas seulement vers le haut', () => {
    const versLeHaut = spinFromDragPath(arc({ x: 360, y: 1100 }, { x: 360, y: 700 }, 40));
    const versLaDroite = spinFromDragPath(arc({ x: 160, y: 640 }, { x: 560, y: 640 }, 40));
    expect(versLaDroite).toBeCloseTo(versLeHaut, 6);
  });
});

describe('spinAcceleration', () => {
  it('ne pousse nulle part sans effet', () => {
    expect(spinAcceleration(0, -20, 0, THROW.maxSpeed)).toEqual({ x: 0, y: 0 });
  });

  it('ne pousse plus quand le projectile est presque arrete', () => {
    const a = spinAcceleration(0, -(SPIN.minSpeed - 0.5), 1, THROW.maxSpeed);
    expect(a).toEqual({ x: 0, y: 0 });
  });

  it('pousse perpendiculairement a la vitesse, jamais le long', () => {
    const vx = 12;
    const vy = -16;
    const a = spinAcceleration(vx, vy, 0.8, THROW.maxSpeed);
    // Produit scalaire nul = strictement perpendiculaire.
    expect(a.x * vx + a.y * vy).toBeCloseTo(0, 9);
    expect(Math.hypot(a.x, a.y)).toBeGreaterThan(0);
  });

  it('croit avec la vitesse, et plafonne a la vitesse de reference', () => {
    const lent = Math.hypot(...Object.values(spinAcceleration(0, -10, 1, THROW.maxSpeed)));
    const rapide = Math.hypot(...Object.values(spinAcceleration(0, -THROW.maxSpeed, 1, THROW.maxSpeed)));
    const tresRapide = Math.hypot(...Object.values(spinAcceleration(0, -THROW.maxSpeed * 2, 1, THROW.maxSpeed)));
    expect(rapide).toBeGreaterThan(lent);
    expect(tresRapide).toBeCloseTo(rapide, 9);
  });

  // ---- LE point : le baton part du cote ou le doigt est passe.
  //
  // Chaque cas donne un geste REEL (via `arc`), en tire l'effet comme le fait
  // le jeu, puis regarde de quel cote la force pousse un projectile lance
  // dans la direction de ce geste.
  const cas = [
    { nom: 'vers le haut, bombe a droite', debut: { x: 360, y: 1100 }, fin: { x: 360, y: 700 }, cote: 'droite' },
    { nom: 'vers le haut, bombe a gauche', debut: { x: 360, y: 1100 }, fin: { x: 360, y: 700 }, cote: 'gauche' },
    { nom: 'vers le bas, bombe a droite', debut: { x: 360, y: 200 }, fin: { x: 360, y: 600 }, cote: 'droite' },
    { nom: 'vers la droite, bombe en bas', debut: { x: 160, y: 640 }, fin: { x: 560, y: 640 }, cote: 'bas' }
  ] as const;

  it.each(cas)('$nom : la force pousse du meme cote', ({ debut, fin, cote }) => {
    // `arc` bombe a GAUCHE de la corde pour une fleche positive.
    const dx = fin.x - debut.x;
    const dy = fin.y - debut.y;
    const longueur = Math.hypot(dx, dy);
    const nx = -dy / longueur;
    const ny = dx / longueur;

    // Fleche positive = cote (nx, ny) ; negative = cote oppose.
    const signeFleche = cote === 'gauche' ? 1 : cote === 'droite' ? -1 : ny > 0 ? 1 : -1;
    const trajet = arc(debut, fin, 40 * signeFleche);
    const effet = spinFromDragPath(trajet);
    expect(effet).not.toBe(0);

    // Projectile lance dans la direction du geste, a pleine vitesse.
    const vx = (dx / longueur) * THROW.maxSpeed;
    const vy = (dy / longueur) * THROW.maxSpeed;
    const a = spinAcceleration(vx, vy, effet, THROW.maxSpeed);

    // La force doit avoir une composante positive sur la normale du cote
    // ou le trajet a bombe.
    const cotePousse = a.x * nx * signeFleche + a.y * ny * signeFleche;
    expect(cotePousse).toBeGreaterThan(0);
  });
});

describe('zone morte', () => {
  /** Trajet en arc, decrit par sa fleche en FRACTION de la corde. */
  const arcRelatif = (fleche: number) => arc({ x: 0, y: 0 }, { x: 0, y: 400 }, 400 * fleche);

  it('rend exactement 0 pour un arc en deca du seuil', () => {
    // Un pouce pivote : un glissement « droit » l'est rarement tout a fait.
    // Il doit rendre 0, pas 0,05 — sinon tirer droit devient impossible.
    expect(spinFromDragPath(arcRelatif(0.04))).toBe(0);
    expect(spinFromDragPath(arcRelatif(-0.04))).toBe(0);
  });

  it('atteint l effet maximal avec l arc qu un pouce trace vraiment', () => {
    // Regression du retour « je n'arrive pas a donner assez de courbe » : le
    // maximum exigeait un arc de 24 % de la corde, que personne ne trace au
    // pouce. Il arrive maintenant a ~14 %.
    expect(Math.abs(spinFromDragPath(arcRelatif(0.15)))).toBe(1);
    // Un arc ordinaire (10 %) donne deja plus de la moitie de l'effet — il
    // n'en donnait que 0,27.
    expect(Math.abs(spinFromDragPath(arcRelatif(0.1)))).toBeGreaterThan(0.45);
    // ... et il reste de la plage entre la zone morte et le maximum : le
    // controle est GRADUE, pas un interrupteur.
    const moitie = Math.abs(spinFromDragPath(arcRelatif(0.09)));
    expect(moitie).toBeGreaterThan(0.2);
    expect(moitie).toBeLessThan(0.7);
  });
});
