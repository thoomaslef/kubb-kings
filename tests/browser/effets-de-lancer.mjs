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
    const out = { fantomes: 0, pleins: 0, alphaMax: 0, additifs: 0, lueurs: 0, particules: 0, couleurs: new Set() };
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
      // Particules vivantes (braises / cristaux) : emetteurs dont la texture est celle de l'effet.
      const vivantes = scene.children.list
        .filter((o) => o.type === 'ParticleEmitter' && ['p-ember', 'p-ice'].includes(o.texture?.key))
        .reduce((n, e) => n + e.getAliveParticleCount(), 0);
      out.particules = Math.max(out.particules, vivantes);
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

const FEU = [0xfff3b0, 0xffc14d, 0xff6a2a, 0xc9301a];
const GLACE = [0xffffff, 0xd6f6ff, 0x8fe3ff, 0x4fb8ff];

resultats.feu_laTraineeEstDense = feu.fantomes >= 3;
resultats.feu_silhouettePleineEtAdditive = feu.pleins >= 3 && feu.additifs >= 3;
resultats.feu_assezOpaquePourSeVoir = feu.alphaMax >= 0.5;
resultats.feu_uneLueurAccompagne = feu.lueurs >= 2;
resultats.feu_degradeDeLaPaletteDuFeu = feu.couleurs.length >= 2 && feu.couleurs.every((c) => FEU.includes(c));
resultats.feu_desBraisesVolent = feu.particules >= 4;
resultats.glace_degradeDeLaPaletteDeLaGlace = glace.couleurs.length >= 2 && glace.couleurs.every((c) => GLACE.includes(c)) && glace.lueurs >= 2;
resultats.glace_desCristauxFlottent = glace.particules >= 3;
resultats.sansEffet_traineeDiscreteEtNaturelle =
  aucun.fantomes >= 1 && aucun.pleins === 0 && aucun.lueurs === 0 && aucun.alphaMax < 0.35 && aucun.particules === 0;

conclure(resultats, erreurs);
await navigateur.close();
