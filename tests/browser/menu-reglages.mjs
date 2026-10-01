/**
 * Les groupes de choix du menu tiennent-ils dans l'ecran ?
 *
 * Ce fichier existe a cause d'un vrai defaut. `.segmented` etait un
 * `display: flex` sans `wrap` : tous les choix etaient forces sur UNE
 * ligne. Avec 2 ou 3 options (vent, difficulte) c'etait le comportement
 * voulu. Avec les 11 terrains, il fallait 593 px dans un cadre de 310 :
 * les cinq derniers etaient coupes au milieu d'un mot, sans barre de
 * defilement ni rien pour signaler qu'il en restait.
 *
 * Deux raisons pour lesquelles rien ne l'avait vu :
 *   - le probleme n'apparait qu'une fois le contenu DEBLOQUE ; sur un
 *     profil neuf, un seul terrain est possede et tout tient ;
 *   - aucune suite ne regardait la mise en page.
 *
 * On verrouille donc la largeur (rien ne deborde, rien n'est coupe) et la
 * hauteur des cibles tactiles, a plusieurs largeurs d'ecran et dans les
 * deux langues — les libelles francais sont plus longs que les anglais.
 */
import { lancerNavigateur, surveiller } from './harness.mjs';
import { readFileSync } from 'node:fs';

const BASE = process.env.KUBB_URL ?? 'http://localhost:4173/kubb-kings/';
/** 320 px : le pire cas reel (iPhone SE 1re generation, Galaxy Fold ferme). */
const LARGEURS = [320, 360, 390, 430, 768];
const LANGUES = ['fr', 'en'];
/** Cible tactile minimale recommandee. */
const CIBLE_MIN = 44;

/** Tous les articles de la boutique : le menu n'est dense qu'une fois tout possede. */
const TOUS_LES_ARTICLES = [
  ...readFileSync(new URL('../../src/game/shop.ts', import.meta.url), 'utf8').matchAll(/id:\s*'([^']+)'/g)
].map((m) => m[1]);

const navigateur = await lancerNavigateur();
const erreurs = [];
const resultats = {};

/** Mesure un menu entierement deverrouille, a une largeur et une langue donnees. */
async function mesurer(largeur, langue) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: 844 } });
  const page = await contexte.newPage();
  surveiller(`menu ${largeur}/${langue}`, page, erreurs);
  await page.goto(BASE);
  await page.waitForFunction(() => Boolean(window.__kubbStoreApi), null, { timeout: 30000 });
  await page.evaluate(
    ([ids, lang]) => {
      localStorage.setItem('kubb-kings.shop.owned', JSON.stringify(ids));
      localStorage.setItem('kubb-kings.lang', lang);
    },
    [TOUS_LES_ARTICLES, langue]
  );
  await page.reload();
  await page.waitForFunction(() => window.__kubbStoreApi?.getState().screen === 'menu', null, { timeout: 30000 });
  await page.waitForSelector('.segmented__item', { timeout: 10000 });

  const mesure = await page.evaluate(() => {
    const groupes = [...document.querySelectorAll('.segmented')];
    const pastilles = [...document.querySelectorAll('.segmented__item')];
    return {
      groupes: groupes.length,
      // Un groupe plus large que son cadre = contenu hors de l'ecran.
      groupesDebordants: groupes
        .filter((g) => g.scrollWidth > g.clientWidth + 1)
        .map((g) => g.previousElementSibling?.textContent?.trim() ?? '?'),
      // Une pastille plus large que sa boite = libelle tronque.
      pastillesTronquees: pastilles.filter((b) => b.scrollWidth > b.clientWidth + 1).length,
      pastilles: pastilles.length,
      hauteurMin: Math.round(Math.min(...pastilles.map((b) => b.getBoundingClientRect().height))),
      // Une pastille qui sort de son groupe a droite est injoignable.
      pastillesHorsCadre: pastilles.filter((b) => {
        const cadre = b.parentElement.getBoundingClientRect();
        const r = b.getBoundingClientRect();
        return r.right > cadre.right + 1 || r.left < cadre.left - 1;
      }).length,
      pageDeborde: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });
  await contexte.close();
  return mesure;
}

for (const langue of LANGUES) {
  for (const largeur of LARGEURS) {
    const m = await mesurer(largeur, langue);
    const cle = `${langue}_${largeur}px`;
    const ok =
      m.groupesDebordants.length === 0 &&
      m.pastillesTronquees === 0 &&
      m.pastillesHorsCadre === 0 &&
      !m.pageDeborde &&
      m.hauteurMin >= CIBLE_MIN;
    resultats[cle] = ok;
    console.log(
      `  ${langue} ${String(largeur).padStart(4)}px  ${ok ? 'OK  ' : 'ECHEC'}  ` +
        `${m.pastilles} pastilles, h>=${m.hauteurMin}px, debordants=[${m.groupesDebordants}], ` +
        `tronquees=${m.pastillesTronquees}, horsCadre=${m.pastillesHorsCadre}, page=${m.pageDeborde}`
    );
  }
}

// ---- L'ecran Tournoi partage la classe `.segmented` : il ne doit pas
//      subir les reglages pris pour les listes longues du menu.
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexte.newPage();
surveiller('tournoi', page, erreurs);
await page.goto(BASE);
await page.waitForFunction(() => window.__kubbStoreApi?.getState().screen === 'menu', null, { timeout: 30000 });
await page.evaluate(() => window.__kubbStoreApi.getState().setScreen('tournament-setup'));
await page.waitForSelector('.segmented__item', { timeout: 10000 });
const tournoi = await page.evaluate(() => {
  const g = document.querySelector('.segmented');
  const b = [...g.querySelectorAll('.segmented__item')];
  return {
    choix: b.length,
    deborde: g.scrollWidth > g.clientWidth + 1,
    hauteurMin: Math.round(Math.min(...b.map((x) => x.getBoundingClientRect().height))),
    // A deux choix, ils doivent toujours remplir la largeur : c'est ce qui
    // distingue un selecteur binaire d'un nuage d'etiquettes.
    remplitLaLargeur: b.reduce((t, x) => t + x.getBoundingClientRect().width, 0) > g.clientWidth * 0.9
  };
});
console.log(`  tournoi : ${JSON.stringify(tournoi)}`);
resultats.tournoiIntact = !tournoi.deborde && tournoi.hauteurMin >= CIBLE_MIN && tournoi.remplitLaLargeur;

console.log('\n', JSON.stringify(resultats, null, 1));
console.log('Erreurs JS :', erreurs);
const ok = Object.values(resultats).every(Boolean) && erreurs.length === 0;
console.log('=== OK:', ok, '===');
await navigateur.close();
process.exitCode = ok ? 0 : 1;
