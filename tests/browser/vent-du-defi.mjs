/**
 * Le vent du Defi vient de l'echelle : aucun avant la manche 10, leger (force 1)
 * de la 10 a la 19, plus fort (force 2) a partir de la 20 — quel que soit le
 * reglage de meteo du menu. « Calme plat » le supprime.
 *
 * On relance reellement la scene de match sur chaque manche et on lit le vent
 * tire par le jeu (`scene.wind`), plusieurs fois par manche : la direction est
 * aleatoire, la force ne doit jamais varier.
 */
import { attendreEcran, conclure, lancerNavigateur, ouvrirJeu, surveiller } from './harness.mjs';

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
const erreurs = [];
const resultats = {};
const page = await contexte.newPage();
surveiller('vent-du-defi', page, erreurs);

await ouvrirJeu(page);
await page.locator('button', { hasText: /d[eé]fi|challenge/i }).first().click();
if (!(await attendreEcran(page, 'match'))) throw new Error("La manche de Defi ne s'est pas lancee.");
await page.waitForTimeout(1000);

/** Force du vent sur plusieurs tirages de cette manche ; null = pas de vent. */
async function forces(numeroDeManche, { menuVent, perks = [] }) {
  const vus = new Set();
  for (let essai = 0; essai < 6; essai += 1) {
    const vent = await page.evaluate(
      ({ index, menuVent, perks }) => {
        const api = window.__kubbStoreApi;
        api.getState().setWindEnabled(menuVent);
        api.setState({ run: { ...api.getState().run, stageIndex: index, perks } });
        window.__kubb.scene.getScene('MatchScene').scene.restart();
        return new Promise((resolve) =>
          setTimeout(() => {
            const w = window.__kubb.scene.getScene('MatchScene').wind;
            resolve(w ? w.force : null);
          }, 700)
        );
      },
      { index: numeroDeManche - 1, menuVent, perks }
    );
    vus.add(vent);
  }
  return [...vus];
}

const egal = (a, attendu) => a.length === 1 && a[0] === attendu;

resultats.manche1_pasDeVent = egal(await forces(1, { menuVent: false }), null);
resultats.manche1_lemenuNeDonnePasDeVent = egal(await forces(1, { menuVent: true }), null);
resultats.manche9_pasDeVent = egal(await forces(9, { menuVent: true }), null);
resultats.manche10_ventLeger = egal(await forces(10, { menuVent: false }), 1);
resultats.manche19_ventLeger = egal(await forces(19, { menuVent: true }), 1);
resultats.manche20_ventPlusFort = egal(await forces(20, { menuVent: false }), 2);
resultats.manche30_ventPlusFort = egal(await forces(30, { menuVent: true }), 2);
resultats.calmePlatSupprimeLeVent = egal(await forces(25, { menuVent: true, perks: ['calme-plat'] }), null);

conclure(resultats, erreurs);
await navigateur.close();
