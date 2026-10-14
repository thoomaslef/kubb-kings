/**
 * Les deux pages qui reunissent les modes : « Jouer hors ligne » (solo, 1v1,
 * 2v2) ; « Jouer en ligne » (trouver une partie classee, jouer avec un ami) ; le classement est au menu.
 *
 * Verifie dans un vrai navigateur : le menu n'expose plus que ces deux
 * entrees (plus de bouton de mode en vrac), chaque page porte ses trois
 * modes, le niveau de l'IA se regle dans la page hors ligne, chaque bouton
 * aboutit au bon ecran, et « Retour » ramene au menu — y compris depuis le
 * choix du terrain.
 */
import { conclure, etat, lancerNavigateur, ouvrirJeu, surveiller } from './harness.mjs';

const navigateur = await lancerNavigateur();
const erreurs = [];
const resultats = {};

async function nouvelle(nom) {
  const contexte = await navigateur.newContext({ viewport: { width: 420, height: 900 }, locale: 'fr-FR' });
  const page = await contexte.newPage();
  surveiller(nom, page, erreurs);
  await ouvrirJeu(page);
  return { page, contexte };
}
const ecran = async (page) => (await etat(page)).screen;
const bouton = (page, motif) => page.locator('button', { hasText: motif }).first();
const textes = (page) => page.evaluate(() => [...document.querySelectorAll('.panel button')].map((b) => b.textContent));
const present = async (page, motif) => (await page.locator('button', { hasText: motif }).count()) > 0;

// ---- le menu
{
  const { page, contexte } = await nouvelle('menu');
  resultats.menu_deuxEntrees = (await present(page, /Jouer hors ligne/)) && (await present(page, /Jouer en ligne/));
  const haut = (motif) => page.locator('button', { hasText: motif }).first().evaluate((b) => b.getBoundingClientRect().top);
  resultats.menu_enLigneAuDessusDeHorsLigne = (await haut(/Jouer en ligne/)) < (await haut(/Jouer hors ligne/));
  resultats.menu_plusDeModeEnVrac =
    !(await present(page, /^Solo/)) && !(await present(page, /1v1 local/)) && !(await present(page, /2v2 local/)) &&
    !(await present(page, /Partie privee/));
  resultats.menu_defiResteAuMenu = await present(page, /Defi/);
  resultats.menu_tournoiEstDansLaPageHorsLigne = !(await present(page, /Tournoi/));
  await contexte.close();
}

// ---- page hors ligne
{
  const { page, contexte } = await nouvelle('hors-ligne');
  await bouton(page, /Jouer hors ligne/).click();
  await page.waitForTimeout(300);
  resultats.local_ecran = (await ecran(page)) === 'local-hub';
  resultats.local_quatreModes = (await present(page, /^Solo/)) && (await present(page, /1v1 local/)) && (await present(page, /2v2 local/)) && (await present(page, /Tournoi local/));
  const niveaux = await page.locator('.segmented__item').count();
  resultats.local_niveauIA = niveaux >= 2;
  const avant = await page.evaluate(() => window.__kubbStoreApi.getState().difficulty);
  const cible = page.locator('.segmented__item:not(.segmented__item--on)').first();
  await cible.click();
  const apres = await page.evaluate(() => window.__kubbStoreApi.getState().difficulty);
  resultats.local_niveauIAChange = apres !== avant;
  for (const [motif, intention] of [[/^Solo/, 'solo'], [/1v1 local/, 'local'], [/2v2 local/, '2v2'], [/Tournoi local/, 'tournament']]) {
    await bouton(page, motif).click();
    await page.waitForSelector('.map-grid', { timeout: 10000 });
    const intent = await page.evaluate(() => window.__kubbStoreApi.getState().mapIntent);
    resultats[`local_${intention}_choixDuTerrain`] = intent === intention;
    // Annuler au choix du terrain ramene a la page, pas au menu.
    await bouton(page, /Retour|Annuler|Menu/).click().catch(() => {});
    await page.waitForTimeout(300);
    resultats[`local_${intention}_retourALaPage`] = (await ecran(page)) === 'local-hub';
  }
  await bouton(page, /Retour/).click();
  await page.waitForTimeout(300);
  resultats.local_retourAuMenu = (await ecran(page)) === 'menu';
  await contexte.close();
}

// ---- page en ligne : deux choix
{
  const { page, contexte } = await nouvelle('en-ligne');
  resultats.enLigne_menuPorteLeBouton = (await present(page, /Jouer en ligne/)) && !(await present(page, /Partie rapide/)) && !(await present(page, /Jouer avec un ami/));
  resultats.enLigne_aucunTexteSousLeBouton = !/Un adversaire au hasard/.test(await page.evaluate(() => document.body.innerText));
  await bouton(page, /Jouer en ligne/).click();
  await page.waitForTimeout(300);
  resultats.enLigne_ecran = (await ecran(page)) === 'online-hub';
  resultats.enLigne_deuxChoix = (await present(page, /Trouver une partie/)) && (await present(page, /Jouer avec un ami/));

  await bouton(page, /Jouer avec un ami/).click();
  await page.waitForSelector('.map-grid', { timeout: 10000 });
  resultats.enLigne_amiPasseParLeTerrain = (await page.evaluate(() => window.__kubbStoreApi.getState().mapIntent)) === 'online';
  await bouton(page, /Retour|Annuler|Menu/).click().catch(() => {});
  await page.waitForTimeout(300);
  resultats.enLigne_amiRetourALaPage = (await ecran(page)) === 'online-hub';

  // Trouver une partie : recherche CLASSEE immediate.
  await bouton(page, /Trouver une partie/).click();
  await page.waitForTimeout(800);
  const e = await page.evaluate(() => ({ ecran: window.__kubbStoreApi.getState().screen, classe: window.__kubbStoreApi.getState().rankedLobby, texte: document.body.innerText }));
  resultats.trouver_lanceLaRecherche = e.ecran === 'online' && /Recherche/i.test(e.texte);
  resultats.trouver_estClassee = e.classe === true;
  await bouton(page, /Annuler/).click();
  await page.waitForTimeout(300);
  resultats.trouver_annulerRamenePage = (await ecran(page)) === 'online-hub';
  await bouton(page, /Retour/).click();
  await page.waitForTimeout(300);
  resultats.enLigne_retourAuMenu = (await ecran(page)) === 'menu';

  // Le classement reste au menu et explique le fonctionnement.
  await bouton(page, /Classement —/).click();
  await page.waitForTimeout(300);
  resultats.classement_ouvreLesRangs = (await ecran(page)) === 'ranks';
  const txt = await page.evaluate(() => document.body.innerText);
  resultats.classement_expliqueLeFonctionnement = /Comment ca marche/.test(txt) && /classee/.test(txt);
  resultats.classement_neLancePasDeRecherche = !(await present(page, /Partie rapide|Trouver une partie/));
  await contexte.close();
}

conclure(resultats, erreurs);
await navigateur.close();
