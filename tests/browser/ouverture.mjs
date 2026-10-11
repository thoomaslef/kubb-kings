/**
 * L'ouverture du jeu quand tout ne se passe pas bien.
 *
 * Signale par un joueur : le lien envoye a un ami, ouvert dans le navigateur INTEGRE d'Instagram
 * sur un iPhone, laissait un ecran uni, sans un mot, indefiniment. Le jeu n'etait pas le seul
 * suspect (telephone lent, navigateur integre limite) et on ne peut pas reproduire cette
 * combinaison ici. Ce qu'on peut garantir, c'est que le joueur n'est JAMAIS devant du vide :
 *
 *   - la page affiche « Chargement » AVANT tout JavaScript (testee JavaScript coupe) ;
 *   - dans un navigateur integre, l'aide s'affiche tout de suite — et elle disparait quand le
 *     jeu demarre normalement ;
 *   - si le chargement traine, on le dit et on propose de copier le lien ;
 *   - si un fichier du jeu ne se charge pas, ou si le demarrage plante, le MESSAGE s'affiche : une
 *     capture d'ecran suffit alors a comprendre ce qui se passe sur son telephone ;
 *   - un chargement normal ne laisse aucune trace de cet ecran.
 *
 * Les echecs sont PROVOQUES (requetes bloquees, retardees ou remplacees) : un chargement reel ne
 * les produirait pas a la demande.
 */
import { conclure, lancerNavigateur } from './harness.mjs';

const JEU = process.env.KUBB_URL ?? 'http://localhost:5173/';
const INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21A329 Instagram 300.0.0.0.0 (iPhone14,4; iOS 17_0; fr_FR; fr; scale=3.00; 1080x2340; 123456789)';
const SCRIPT_DU_JEU = '**/assets/index-*.js';

const navigateur = await lancerNavigateur();
const resultats = {};

async function ouvrir(options = {}, preparer) {
  // Francais par defaut (Chromium annonce « en-US » sans cela, et les messages s'afficheraient en anglais).
  const contexte = await navigateur.newContext({ viewport: { width: 812, height: 375 }, locale: 'fr-FR', ...options });
  const page = await contexte.newPage();
  if (preparer) await preparer(page, contexte);
  return { page, contexte };
}

const visible = async (page, id) => {
  const n = page.locator(`#${id}`);
  if ((await n.count()) === 0) return false;
  return (await n.evaluate((e) => e.style.display !== 'none')) && !!(await n.textContent())?.trim();
};

// ------------------------------------------------------------ 1. sans JavaScript : jamais de vide
{
  const { page, contexte } = await ouvrir({ javaScriptEnabled: false });
  await page.goto(JEU);
  const texte = (await page.locator('#kubb-splash').textContent()) ?? '';
  resultats.sansJavaScript_LaPageNEstPasVide = /KUBB/.test(texte) && /Chargement/.test(texte);
  const fond = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  resultats.sansJavaScript_LeFondEstCeluiDuJeu = fond === 'rgb(13, 26, 20)';
  await contexte.close();
}

// ------------------------------------------------------------ 2. chargement normal : aucune trace
{
  const { page, contexte } = await ouvrir();
  await page.goto(JEU);
  await page.waitForSelector('.panel--menu', { timeout: 30000 });
  resultats.normal_LEcranDAttenteADisparu = (await page.locator('#kubb-splash').count()) === 0;
  await page.waitForTimeout(9000); // au-dela du delai « chargement long »
  resultats.normal_AucuneAideTardiveNApparait = (await page.locator('#kubb-splash').count()) === 0;
  await contexte.close();
}

// ------------------------------------------------------------ 3. navigateur integre (Instagram), chargement lent
{
  const { page, contexte } = await ouvrir({ userAgent: INSTAGRAM, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }, async (p) => {
    await p.route(SCRIPT_DU_JEU, async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
  });
  await page.goto(JEU, { waitUntil: 'commit' });
  await page.waitForSelector('#kubb-splash');
  await page.waitForTimeout(800);
  resultats.instagram_LAideEstLaToutDeSuite = await visible(page, 'kubb-splash-inapp');
  resultats.instagram_ElleExpliqueOuvrirDansLeNavigateur = /Ouvrir dans/.test((await page.locator('#kubb-splash-inapp').textContent()) ?? '');
  resultats.instagram_LeBoutonCopierEstLa = await visible(page, 'kubb-splash-copy');
  await page.waitForSelector('.panel--menu', { timeout: 30000 });
  resultats.instagram_QuandLeJeuDemarre_TouteLAideDisparait = (await page.locator('#kubb-splash').count()) === 0;
  await contexte.close();
}
{
  // Un navigateur ordinaire, lui, n'affiche pas cette aide.
  const { page, contexte } = await ouvrir({}, async (p) => {
    await p.route(SCRIPT_DU_JEU, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });
  });
  await page.goto(JEU, { waitUntil: 'commit' });
  await page.waitForSelector('#kubb-splash');
  await page.waitForTimeout(500);
  resultats.navigateurOrdinaire_PasDAideDeNavigateurIntegre = !(await visible(page, 'kubb-splash-inapp'));
  await contexte.close();
}

// ------------------------------------------------------------ 4. un fichier du jeu ne se charge pas
{
  const { page, contexte } = await ouvrir({}, async (p) => {
    await p.route(SCRIPT_DU_JEU, (route) => route.abort());
  });
  await page.goto(JEU);
  await page.waitForTimeout(1500);
  const erreur = (await page.locator('#kubb-splash-error').textContent()) ?? '';
  resultats.fichierBloque_LeMessageNommeLeFichier = /Impossible de charger/.test(erreur) && /index-/.test(erreur);
  resultats.fichierBloque_LaPageNEstPasVide = (await page.locator('#kubb-splash').count()) === 1;
  resultats.fichierBloque_LAideDeChargementLongArriveApres8s = !(await visible(page, 'kubb-splash-slow'));
  await page.waitForTimeout(7500);
  resultats.fichierBloque_LAideDeChargementLongArriveApres8s =
    resultats.fichierBloque_LAideDeChargementLongArriveApres8s && (await visible(page, 'kubb-splash-slow'));
  resultats.fichierBloque_OnPeutCopierLeLien = await visible(page, 'kubb-splash-copy');
  await contexte.close();
}

// ------------------------------------------------------------ 5. le demarrage plante : le message s'affiche
{
  const { page, contexte } = await ouvrir({}, async (p) => {
    await p.route(SCRIPT_DU_JEU, (route) =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body: 'throw new Error("boum de test");' })
    );
  });
  await page.goto(JEU);
  await page.waitForTimeout(1500);
  const erreur = (await page.locator('#kubb-splash-error').textContent()) ?? '';
  resultats.plantage_LeMessageEstAffiche = /Impossible de demarrer/.test(erreur) && /boum de test/.test(erreur);
  await contexte.close();
}

// ------------------------------------------------------------ 6. copier le lien, et l'anglais
{
  const { page, contexte } = await ouvrir({ locale: 'en-US', permissions: ['clipboard-read', 'clipboard-write'] }, async (p) => {
    await p.route(SCRIPT_DU_JEU, (route) => route.abort());
  });
  await page.goto(JEU);
  await page.waitForTimeout(8800);
  resultats.anglais_LEcranEstEnAnglais = /Loading/.test((await page.locator('#kubb-splash-msg').textContent()) ?? '') &&
    /taking a while/.test((await page.locator('#kubb-splash-slow').textContent()) ?? '');
  await page.locator('#kubb-splash-copy').click();
  await page.waitForTimeout(400);
  const presse = await page.evaluate(() => navigator.clipboard.readText());
  resultats.copier_LePresseP_ContientLAdresseNueDuJeu = presse === new URL(JEU).origin + new URL(JEU).pathname;
  resultats.copier_LeBoutonConfirme = /Link copied/.test((await page.locator('#kubb-splash-copy').textContent()) ?? '');
  await contexte.close();
}

conclure(resultats, []);
await navigateur.close();
