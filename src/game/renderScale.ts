import type Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './rules';

/**
 * Dessiner a la resolution REELLE de l'ecran.
 *
 * Mesure a l'origine de ce module, sur un ecran de telephone courant
 * (390 pt de large, 3 pixels physiques par point) : le jeu dessinait dans un
 * tampon de 720x1280 etire sur 1170x2080 pixels physiques. Un agrandissement
 * de 1,63x applique en permanence a tout ce qui est affiche — c'est la
 * premiere cause de flou du jeu, bien avant la qualite des textures.
 *
 * La correction tient en deux gestes qui vont ensemble :
 *   1. le jeu est cree a `design x facteur`, donc le tampon de rendu grandit
 *      d'autant ;
 *   2. la camera de chaque scene zoome du MEME facteur, ce qui ramene la
 *      zone visible a la taille de design.
 *
 * Consequence voulue : les coordonnees du monde ne bougent pas d'un pixel.
 * Toute la physique, les hitboxes et le calibrage de l'IA raisonnent en
 * unites de design (rules.ts) et restent valides tels quels — c'est la seule
 * approche qui ne demandait pas de retoucher l'equilibrage.
 *
 * `scale.setZoom()` ne fait PAS ce travail : verifie a chaud, il laisse le
 * tampon a 720x1280 et ne change que l'affichage. C'est le piege evident de
 * ce sujet.
 */

/**
 * Plafond du facteur de rendu.
 *
 * A 3, un ecran de telephone demanderait 2160x3840, soit 8,3 millions de
 * pixels par image — de quoi faire tomber le framerate sur un appareil
 * moyen, et pour un gain que l'oeil ne distingue plus guere au-dela de 2.
 * A 2 on reste a 1440x2560 (3,7 Mpx), ce qui suffit a rendre net un ecran
 * meme tres dense.
 */
const FACTEUR_MAX = 2;

/** Facteur de rendu retenu pour cet appareil. 1 sur un ecran classique. */
export function renderScaleFactor(): number {
  const dpr = typeof window === 'undefined' ? 1 : (window.devicePixelRatio ?? 1);
  // Jamais en dessous de 1 : un ecran qui annonce moins ne gagnerait rien a
  // ce qu'on dessine plus petit que sa propre definition.
  return Math.min(FACTEUR_MAX, Math.max(1, dpr));
}

/** Taille du jeu a demander a Phaser, en pixels de rendu. */
export function gameSize(): { width: number; height: number } {
  const facteur = renderScaleFactor();
  return { width: DESIGN_WIDTH * facteur, height: DESIGN_HEIGHT * facteur };
}

/**
 * Ramene la camera d'une scene aux coordonnees de design.
 *
 * A appeler dans le `create()` de CHAQUE scene qui dessine : sans cela, la
 * scene verrait un monde `facteur` fois plus grand et tout serait dessine
 * dans le coin superieur gauche.
 */
export function fitCameraToDesign(scene: Phaser.Scene) {
  const facteur = renderScaleFactor();
  const camera = scene.cameras.main;
  camera.setZoom(facteur);
  // Le zoom s'applique autour du centre de la camera : sans ce recentrage,
  // la zone visible resterait accrochee au coin et le terrain sortirait de
  // l'ecran.
  camera.centerOn(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
}
