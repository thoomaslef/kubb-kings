import { describe, expect, it } from 'vitest';
import { AI_PROFILES, decideThrow, type AiBoard, type Difficulty } from './ai';
import {
  BASELINE_INSET,
  FIELD,
  FIELD_CENTER_X,
  FIELD_CENTER_Y,
  HITBOX,
  THROWER_INSET,
  THROW_POSITIONS
} from './rules';

/**
 * Ce que l'IA doit SAVOIR faire, independamment de son adresse.
 *
 * Ces tests existent a cause d'un vrai defaut, et d'un defaut couteux : le
 * controle anti-suicide (`curvedKingDanger`) appliquait par temps calme une
 * marge calibree pour le vent. Resultat mesure : le kubb CENTRAL — celui
 * que la ligne droite ne peut viser qu'en passant par le roi — survivait
 * dans 200 manches sur 200 au niveau difficile. L'IA plafonnait a 4 kubbs
 * sur 5, toujours, et ne pouvait donc jamais gagner une manche.
 *
 * Rien ne l'avait signale : elle ne se suicidait pas (le seul invariant
 * verifie jusque-la), elle renoncait. Un refus systematique est pourtant
 * aussi grave qu'une faute, et beaucoup plus discret.
 */

const Y_LANCEUR = FIELD.y + THROWER_INSET;
const Y_LIGNE_ADVERSE = FIELD.y + FIELD.height - BASELINE_INSET;
const NIVEAUX = Object.keys(AI_PROFILES) as Difficulty[];

/** Generateur reproductible : un echec doit pouvoir etre rejoue. */
function alea(graine: number): () => number {
  let s = graine >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function plateau(cibles: { x: number; y: number }[]): AiBoard {
  return {
    throwerY: Y_LANCEUR,
    direction: 1,
    targets: cibles,
    kingTargetable: false,
    kingStanding: true,
    frictionMultiplier: 1
  };
}

/**
 * L'IA a-t-elle vraiment vise cette cible, ou s'est-elle rabattue sur un tir
 * de repli ? `safeThrow` renvoie un `aimedAt` calcule a 200 px devant elle,
 * jamais la cible : la distance les separe sans ambiguite.
 */
function viseVraiment(aimedAt: { x: number; y: number }, cible: { x: number; y: number }): boolean {
  return Math.hypot(aimedAt.x - cible.x, aimedAt.y - cible.y) < 1;
}

describe('echelle de difficulte', () => {
  it('chaque niveau vise mieux que le precedent', () => {
    expect(AI_PROFILES.facile.aimErrorDeg).toBeGreaterThan(AI_PROFILES.moyen.aimErrorDeg);
    expect(AI_PROFILES.moyen.aimErrorDeg).toBeGreaterThan(AI_PROFILES.difficile.aimErrorDeg);
  });

  it('et dose mieux, et prend plus de temps', () => {
    expect(AI_PROFILES.facile.powerErrorRatio).toBeGreaterThan(AI_PROFILES.moyen.powerErrorRatio);
    expect(AI_PROFILES.moyen.powerErrorRatio).toBeGreaterThan(AI_PROFILES.difficile.powerErrorRatio);
    expect(AI_PROFILES.facile.thinkMs).toBeLessThan(AI_PROFILES.difficile.thinkMs);
  });

  it("meme le niveau le plus faible garde une chance d'atteindre la ligne adverse", () => {
    // A 830 px, la tolerance laterale vaut ~1.73 deg. Une erreur de visee
    // plusieurs fois superieure rend la ligne adverse inatteignable en
    // pratique : l'IA ne peut alors plus finir une manche, quel que soit le
    // nombre de lancers (mesure a 12 deg : 100 % de manches perdues).
    const rayonContactKubb = HITBOX.kubb / 2 + HITBOX.batonWidth / 2;
    const toleranceDeg = (Math.atan(rayonContactKubb / (Y_LIGNE_ADVERSE - Y_LANCEUR)) * 180) / Math.PI;
    expect(AI_PROFILES.facile.aimErrorDeg).toBeLessThan(toleranceDeg * 4);
  });
});

describe('le kubb central reste atteignable', () => {
  /**
   * Le cas qui etait casse : un seul kubb adverse, pile au centre. La ligne
   * droite qui le vise depuis le poste central passe par le roi — mais les
   * postes de lancer excentres offrent un angle sur, et l'IA doit le
   * trouver plutot que de renoncer.
   */
  const kubbCentral = { x: FIELD_CENTER_X, y: Y_LIGNE_ADVERSE };

  it.each(NIVEAUX)('%s : vise le kubb central au lieu de renoncer', (niveau) => {
    let vises = 0;
    const essais = 12;
    for (let i = 0; i < essais; i += 1) {
      const tir = decideThrow(plateau([kubbCentral]), AI_PROFILES[niveau], alea(i * 7919));
      if (viseVraiment(tir.aimedAt, kubbCentral)) vises += 1;
    }
    expect(vises, `${niveau} : ${vises}/${essais} tirs visent reellement le kubb central`).toBe(essais);
  });

  it('ne lance pas pour autant depuis le poste central, qui pointe droit sur le roi', () => {
    const tir = decideThrow(plateau([kubbCentral]), AI_PROFILES.difficile, alea(1));
    expect(tir.throwX).not.toBe(FIELD_CENTER_X);
  });
});

describe('prudence vis-a-vis du roi', () => {
  const kubbCentral = { x: FIELD_CENTER_X, y: Y_LIGNE_ADVERSE };

  it('le tir retenu passe loin du roi, cone de visee compris', () => {
    // Marge minimale exigee : le rayon de contact reel. En deca, un simple
    // ecart de visee suffirait a faire perdre la partie sur-le-champ.
    const rayonContact = HITBOX.kingRadius + HITBOX.batonWidth / 2;
    for (const niveau of NIVEAUX) {
      for (let i = 0; i < 8; i += 1) {
        const tir = decideThrow(plateau([kubbCentral]), AI_PROFILES[niveau], alea(i * 104729));
        // Distance du roi a la droite portant le tir.
        const dx = Math.cos(tir.angle);
        const dy = Math.sin(tir.angle);
        const vx = FIELD_CENTER_X - tir.throwX;
        const vy = FIELD_CENTER_Y - Y_LANCEUR;
        const ecart = Math.abs(vx * dy - vy * dx);
        expect(ecart, `${niveau}, tirage ${i} : le tir passe a ${Math.round(ecart)} px du roi`).toBeGreaterThan(rayonContact);
      }
    }
  });

  it('un roi deja couche ne contraint plus rien', () => {
    // kingStanding=false : plus de danger, donc le poste central redevient
    // utilisable sur une cible centrale.
    const board = { ...plateau([kubbCentral]), kingStanding: false };
    const tir = decideThrow(board, AI_PROFILES.difficile, alea(3));
    expect(viseVraiment(tir.aimedAt, kubbCentral)).toBe(true);
  });

  it('la ligne pleine reste jouable a tous les niveaux', () => {
    const ligne = THROW_POSITIONS.map((x) => ({ x, y: Y_LIGNE_ADVERSE }));
    for (const niveau of NIVEAUX) {
      let vises = 0;
      const essais = 6;
      for (let i = 0; i < essais; i += 1) {
        const tir = decideThrow(plateau(ligne), AI_PROFILES[niveau], alea(i * 31));
        if (ligne.some((c) => viseVraiment(tir.aimedAt, c))) vises += 1;
      }
      expect(vises, `${niveau} renonce sur une ligne pleine`).toBe(essais);
    }
  });
});
