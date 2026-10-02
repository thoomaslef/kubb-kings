/**
 * Le terrain se choisit sur son propre ecran, avant chaque partie.
 *
 * Avant, il se reglait dans une liste du menu, noyee parmi huit autres
 * reglages et sans rien montrer de ce qu'on choisissait — alors que c'est
 * la decision qui change le plus une partie.
 *
 * Ce qui est verifie ici, et qu'aucun test unitaire ne peut voir :
 *   - le terrain retenu sur cet ecran est bien celui que la partie utilise
 *     (le lien entre un clic et `MatchScene.fieldPreset`) ;
 *   - les quatre modes concernes y passent, et aboutissent au bon endroit ;
 *   - le mode Defi ne passe PAS par la (il impose ses terrains manche par
 *     manche) ;
 *   - un terrain non debloque reste visible mais non selectionnable ;
 *   - les miniatures sont bien dessinees, et la barre d'action reste a
 *     l'ecran malgre les onze terrains (sinon il faut faire defiler tout
 *     l'ecran pour trouver "Jouer").
 */
import { attendreEcran, focus, lancerNavigateur, surveiller } from './harness.mjs';
import { readFileSync } from 'node:fs';

const BASE = process.env.KUBB_URL ?? 'http://localhost:4173/kubb-kings/';
const TOUS_LES_ARTICLES = [
  ...readFileSync(new URL('../../src/game/shop.ts', import.meta.url), 'utf8').matchAll(/id:\s*'([^']+)'/g)
].map((m) => m[1]);

const navigateur = await lancerNavigateur();
const erreurs = [];
const resultats = {};

/** Ouvre le jeu, avec ou sans tout le contenu debloque. */
async function ouvrir({ toutDebloque = true } = {}) {
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
  const page = await contexte.newPage();
  surveiller('jeu', page, erreurs);
  await page.goto(BASE);
  await page.waitForFunction(() => Boolean(window.__kubbStoreApi), null, { timeout: 30000 });
  await page.evaluate(
    ([ids, tout]) => {
      if (tout) localStorage.setItem('kubb-kings.shop.owned', JSON.stringify(ids));
      localStorage.setItem('kubb-kings.lang', 'fr');
    },
    [TOUS_LES_ARTICLES, toutDebloque]
  );
  await page.reload();
  await page.waitForFunction(() => window.__kubbStoreApi?.getState().screen === 'menu', null, { timeout: 30000 });
  await focus(page);
  return { contexte, page };
}

const ecran = (page) => page.evaluate(() => window.__kubbStoreApi.getState().screen);

// ---- 1. Solo : le terrain choisi est-il REELLEMENT celui de la partie ?
{
  const { contexte, page } = await ouvrir();
  await page.locator('button', { hasText: /Solo/i }).first().click();
  await page.waitForSelector('.map-grid', { timeout: 10000 });
  resultats.soloPasseParLEcran = (await ecran(page)) === 'map-select';

  const vue = await page.evaluate(() => ({
    cartes: document.querySelectorAll('.map-card').length,
    miniatures: document.querySelectorAll('.field-preview').length,
    debordeLateral: document.querySelector('.panel--scroll').scrollWidth > document.querySelector('.panel--scroll').clientWidth + 1
  }));
  resultats.onzeTerrainsAvecMiniature = vue.cartes === 11 && vue.miniatures === 11;
  resultats.aucunDebordementLateral = !vue.debordeLateral;

  // La barre d'action doit rester visible SANS faire defiler l'ecran.
  const barre = await page.evaluate(() => {
    const p = document.querySelector('.panel--scroll');
    const a = document.querySelector('.map-actions');
    const bp = p.getBoundingClientRect();
    const ba = a.getBoundingClientRect();
    return {
      visibleSansDefiler: ba.bottom <= bp.bottom + 2 && ba.top < bp.bottom,
      // Rien ne doit depasser SOUS la barre : le panneau lui cede son padding.
      couvreJusquAuBord: bp.bottom - ba.bottom < 4
    };
  });
  resultats.barreDactionToujoursVisible = barre.visibleSansDefiler;
  resultats.barreCouvreJusquAuBord = barre.couvreJusquAuBord;

  // On choisit un terrain reconnaissable, puis on joue.
  await page.locator('.map-card', { hasText: 'Boue' }).click();
  await page.locator('.btn--primary', { hasText: 'Jouer' }).click();
  await attendreEcran(page, 'match');
  await page.waitForTimeout(1200);
  const terrainEnJeu = await page.evaluate(() => window.__kubb.scene.getScene('MatchScene').fieldPreset);
  console.log('  terrain choisi "boue" -> terrain en jeu :', terrainEnJeu);
  resultats.leTerrainChoisiEstCeluiJoue = terrainEnJeu === 'boue';
  await contexte.close();
}

// ---- 2. Les autres modes aboutissent au bon endroit.
for (const [bouton, attendu, cle] of [
  [/En ligne/i, 'online', 'enLigneAboutitAuSalon'],
  [/Tournoi/i, 'tournament-setup', 'tournoiAboutitAuReglage']
]) {
  const { contexte, page } = await ouvrir();
  await page.locator('button', { hasText: bouton }).first().click();
  await page.waitForSelector('.map-grid', { timeout: 10000 });
  const passeParLEcran = (await ecran(page)) === 'map-select';
  await page.locator('.btn--primary').first().click();
  await page.waitForTimeout(800);
  const arrivee = await ecran(page);
  console.log(`  ${bouton} -> map-select : ${passeParLEcran}, puis : ${arrivee}`);
  resultats[cle] = passeParLEcran && arrivee === attendu;
  await contexte.close();
}

// ---- 3. Le Defi impose ses terrains : il ne doit PAS passer par l'ecran.
{
  const { contexte, page } = await ouvrir();
  await page.locator('button', { hasText: /Defi/i }).first().click();
  await page.waitForTimeout(1200);
  const arrivee = await ecran(page);
  console.log('  Defi ->', arrivee);
  resultats.defiNePassePasParLEcran = arrivee !== 'map-select';
  await contexte.close();
}

// ---- 4. Profil neuf : les terrains verrouilles restent visibles, non cliquables.
{
  const { contexte, page } = await ouvrir({ toutDebloque: false });
  await page.locator('button', { hasText: /Solo/i }).first().click();
  await page.waitForSelector('.map-grid', { timeout: 10000 });
  const v = await page.evaluate(() => {
    const cartes = [...document.querySelectorAll('.map-card')];
    return {
      total: cartes.length,
      verrouillees: cartes.filter((c) => c.disabled).length,
      // Verrouille mais TOUJOURS affiche : savoir ce qui attend motive.
      afficheLeNiveauRequis: document.querySelectorAll('.map-card__lock').length
    };
  });
  console.log('  profil neuf :', JSON.stringify(v));
  resultats.terrainsVerrouillesVisiblesMaisInactifs =
    v.total === 11 && v.verrouillees === 10 && v.afficheLeNiveauRequis === 10;
  await contexte.close();
}

// ---- 5. Garde-fou : un terrain memorise mais NON possede ne doit pas
//         partir en partie. Le cas se produit si la liste des articles
//         change entre deux versions, alors que la preference, elle, est
//         persistee. Sans ce garde-fou, la partie se lancerait sur un
//         terrain que le joueur n'a pas.
{
  const { contexte, page } = await ouvrir({ toutDebloque: false });
  await page.evaluate(() => window.__kubbStoreApi.getState().setFieldPreset('boue'));
  await page.locator('button', { hasText: /Solo/i }).first().click();
  await page.waitForSelector('.map-grid', { timeout: 10000 });
  await page.locator('.btn--primary', { hasText: 'Jouer' }).click();
  await attendreEcran(page, 'match');
  await page.waitForTimeout(1200);
  const terrain = await page.evaluate(() => window.__kubb.scene.getScene('MatchScene').fieldPreset);
  console.log('  terrain memorise "boue" (non possede) -> terrain en jeu :', terrain);
  resultats.terrainNonPossedeRamene = terrain === 'classique';
  await contexte.close();
}

console.log('\n', JSON.stringify(resultats, null, 1));
console.log('Erreurs JS :', erreurs);
const ok = Object.values(resultats).every(Boolean) && erreurs.length === 0;
console.log('=== OK:', ok, '===');
await navigateur.close();
process.exitCode = ok ? 0 : 1;
