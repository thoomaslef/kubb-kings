/**
 * Les effets de lancer de la boutique (feu, glace) doivent se VOIR en vol.
 *
 * Constat d'origine : la trainee etait teintee, mais par une teinte
 * multipliee, a 26 % d'opacite, pendant 200 ms — invisible sur un baton
 * sombre. On mesure ici, dans un vrai navigateur, les images rementes
 * (profondeur 5) pendant un vrai lancer : leur nombre, leur opacite, leur
 * couleur (teinte PLEINE de l'effet) et la lueur qui les accompagne.
 * Sans effet, la trainee reste discrete et a la couleur du projectile.
 */
import { attendreSonTour, conclure, lancer, lancerDepuisLeMenu, lancerNavigateur, ouvrirJeu, surveiller } from './harness.mjs';

const navigateur = await lancerNavigateur();
const erreurs = [];
const resultats = {};

async function mesurer(effet) {
  const contexte = await navigateur.newContext({ viewport: { width: 420, height: 900 }, locale: 'fr-FR' });
  const page = await contexte.newPage();
  surveiller(`effet=${effet}`, page, erreurs);
  await ouvrirJeu(page);
  await page.evaluate((e) => window.__kubbStoreApi.getState().setTrailEffect(e), effet);
  await lancerDepuisLeMenu(page, /1v1/i);
  await attendreSonTour(page);
  const mesure = page.evaluate(async () => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    const out = { fantomes: 0, pleins: 0, alphaMax: 0, additifs: 0, lueurs: 0, couleurs: new Set() };
    for (let i = 0; i < 70; i += 1) {
      await new Promise((r) => setTimeout(r, 40));
      const objets = scene.children.list.filter((o) => o.type === 'Image' && o.depth === 5);
      const fantomes = objets.filter((o) => o.texture.key.startsWith('baton'));
      out.fantomes = Math.max(out.fantomes, fantomes.length);
      out.pleins = Math.max(out.pleins, fantomes.filter((o) => o.tintFill).length);
      out.additifs = Math.max(out.additifs, fantomes.filter((o) => o.blendMode === 1).length);
      out.alphaMax = Math.max(out.alphaMax, ...fantomes.map((o) => o.alpha), 0);
      out.lueurs = Math.max(out.lueurs, objets.filter((o) => o.texture.key === 'p-flash').length);
      fantomes.filter((o) => o.tintFill).forEach((o) => out.couleurs.add(o.tintTopLeft));
    }
    out.couleurs = [...out.couleurs];
    return out;
  });
  await lancer(page, 0.9);
  const r = await mesure;
  await contexte.close();
  return r;
}

const feu = await mesurer('feu');
const glace = await mesurer('glace');
const aucun = await mesurer('none');
console.log({ feu, glace, aucun });

resultats.feu_laTraineeEstDense = feu.fantomes >= 4;
resultats.feu_silhouettePleineEtAdditive = feu.pleins >= 4 && feu.additifs >= 4;
resultats.feu_assezOpaquePourSeVoir = feu.alphaMax >= 0.5;
resultats.feu_uneLueurAccompagne = feu.lueurs >= 2;
resultats.feu_couleurDuFeu = feu.couleurs.length === 1 && feu.couleurs[0] === 0xff6a2a;
resultats.glace_couleurDeLaGlace = glace.couleurs.length === 1 && glace.couleurs[0] === 0x6ad9ff && glace.lueurs >= 2;
resultats.sansEffet_traineeDiscreteEtNaturelle = aucun.fantomes >= 1 && aucun.pleins === 0 && aucun.lueurs === 0 && aucun.alphaMax < 0.35;

conclure(resultats, erreurs);
await navigateur.close();
