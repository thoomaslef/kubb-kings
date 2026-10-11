/**
 * Le mode compatibilite : le jeu se rattrape seul quand il fait planter le navigateur.
 *
 * Signale : sur un iPhone 13 mini, Safari affichait « Un probleme recurrent est survenu » — l'onglet
 * plantait a repetition. On ne peut pas reproduire ce plantage ici (ni connaitre sa cause), alors on
 * verifie le MECANISME de rattrapage, et que le jeu simplifie reste JOUABLE :
 *
 *   - `?safe=1` : rendu Canvas (pas WebGL), definition 1x, avis affiche — et retenu au chargement suivant ;
 *   - un demarrage qui n'est jamais alle au bout (la note de demarrage est encore la) passe
 *     automatiquement en mode compatibilite, et l'explique ;
 *   - un demarrage normal ne laisse AUCUNE note derriere lui (ni apres quelques secondes, ni a la
 *     fermeture de la page), donc pas de fausse alerte ;
 *   - une vraie PARTIE se joue en mode compatibilite : on lance une manche et un lancer, sans erreur ;
 *   - « Reessayer en mode normal » revient au rendu WebGL et efface le souvenir.
 *
 * Phaser : 1 = CANVAS, 2 = WEBGL.
 */
import { attendreEcran, conclure, lancer, lancerDepuisLeMenu, lancerNavigateur, surveiller } from './harness.mjs';

const JEU = process.env.KUBB_URL ?? 'http://localhost:5173/';
const navigateur = await lancerNavigateur();
const erreurs = [];
const resultats = {};

async function ouvrir(nom, suffixe = '', preparer) {
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'fr-FR' });
  const page = await contexte.newPage();
  surveiller(nom, page, erreurs);
  await page.goto(JEU);
  await page.evaluate(() => {
    localStorage.setItem('kubb-kings.tutorial-done', '1');
    localStorage.setItem('kubb-kings.lang', 'fr');
  });
  if (preparer) await page.evaluate(preparer);
  await page.goto(JEU + suffixe);
  await page.waitForSelector('.panel--menu', { timeout: 60000 });
  return { page, contexte };
}

const moteur = (page) =>
  page.evaluate(() => {
    const jeu = window.__kubb;
    const toile = document.querySelector('canvas');
    return {
      rendu: jeu?.renderer?.type ?? null,
      largeur: toile?.width ?? null,
      note: localStorage.getItem('kubb-kings.boot-attempt'),
      souvenir: localStorage.getItem('kubb-kings.safe-mode'),
      avis: !!document.querySelector('[data-testid="safe-mode-notice"]'),
      texteAvis: document.querySelector('[data-testid="safe-mode-notice"]')?.textContent ?? ''
    };
  });

// ------------------------------------------------------------ 1. ?safe=1 : Canvas, 1x, avis, souvenir
{
  const { page, contexte } = await ouvrir('force', '?safe=1');
  await page.waitForTimeout(1500);
  const e = await moteur(page);
  console.log({ force: e });
  resultats.force_RenduCanvas = e.rendu === 1;
  resultats.force_DefinitionSimple = e.largeur === 720;
  resultats.force_LAvisEstAffiche = e.avis && /compatibilite/i.test(e.texteAvis);
  resultats.force_EstRetenu = e.souvenir === '1';

  // Une vraie partie, en mode compatibilite.
  await lancerDepuisLeMenu(page, /Solo/);
  const enMatch = await attendreEcran(page, 'match', 120);
  await page.waitForTimeout(1500);
  resultats.partie_LaMancheDemarre = enMatch;
  const premier = await page.evaluate(() => window.__kubb.scene.getScene('MatchScene').activeTeam);
  // Si c'est a Bleue de jouer, on lance ; sinon l'IA ouvre. Dans les deux cas : au moins un coup JOUE.
  if (premier === 'blue') await lancer(page, 0.5);
  for (let i = 0; i < 40; i += 1) {
    const coups = await page.evaluate(() => window.__kubb.scene.getScene('MatchScene').record.throws.length);
    if (coups >= 1) break;
    await page.waitForTimeout(500);
  }
  resultats.partie_UnCoupEstJoue =
    (await page.evaluate(() => window.__kubb.scene.getScene('MatchScene').record.throws.length)) >= 1;
  await page.waitForTimeout(2500);
  const apres = await page.evaluate(() => {
    const s = window.__kubb.scene.getScene('MatchScene');
    return { phase: s.phase, kubbs: s.teams.red.kubbs.length };
  });
  resultats.partie_LaSceneVit = apres.kubbs > 0 && !!apres.phase;

  // Sans le parametre, au chargement suivant : toujours en mode compatibilite (retenu).
  await page.goto(JEU);
  await page.waitForSelector('.panel--menu', { timeout: 60000 });
  await page.waitForTimeout(1200);
  const suivant = await moteur(page);
  resultats.force_RestePendantLesVisitesSuivantes = suivant.rendu === 1 && suivant.avis;

  // Revenir au rendu normal.
  await page.locator('[data-testid="safe-mode-notice"] button').click();
  await page.waitForSelector('.panel--menu', { timeout: 60000 });
  await page.waitForTimeout(1500);
  const normal = await moteur(page);
  console.log({ retourNormal: normal });
  resultats.retour_RenduWebGL = normal.rendu === 2;
  resultats.retour_LAvisDisparait = !normal.avis && normal.souvenir === null;
  await contexte.close();
}

// ------------------------------------------------------------ 2. un demarrage jamais abouti => mode compatibilite
{
  const { page, contexte } = await ouvrir('plantage', '', () => localStorage.setItem('kubb-kings.boot-attempt', String(Date.now())));
  await page.waitForTimeout(1500);
  const e = await moteur(page);
  console.log({ plantage: e });
  resultats.plantage_PasseEnModeCompatibilite = e.rendu === 1 && e.avis;
  resultats.plantage_LExplique = /plant/i.test(e.texteAvis);
  resultats.plantage_EstRetenu = e.souvenir === '1';
  await contexte.close();
}

// ------------------------------------------------------------ 3. un demarrage normal ne laisse aucune trace
{
  const { page, contexte } = await ouvrir('normal');
  await page.waitForTimeout(1000);
  const tot = await moteur(page);
  resultats.normal_RenduWebGL = tot.rendu === 2;
  resultats.normal_PasDAvis = !tot.avis;
  resultats.normal_UneNoteEstPoseePendantLeDemarrage = tot.note !== null;
  await page.waitForTimeout(4500);
  const tard = await moteur(page);
  resultats.normal_LaNoteDisparaitQuandLeJeuEstStable = tard.note === null;
  resultats.normal_AucunSouvenir = tard.souvenir === null;
  await contexte.close();
}
{
  // Page fermee NORMALEMENT pendant le demarrage : pas de fausse alerte au chargement suivant.
  const { page, contexte } = await ouvrir('fermeture');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const note = await page.evaluate(() => localStorage.getItem('kubb-kings.boot-attempt'));
  resultats.fermeture_PagehideEffaceLaNote = note === null;
  await page.reload();
  await page.waitForSelector('.panel--menu', { timeout: 60000 });
  await page.waitForTimeout(1200);
  const e = await moteur(page);
  resultats.fermeture_PasDeFausseAlerte = e.rendu === 2 && !e.avis;
  await contexte.close();
}

// ------------------------------------------------------------ 4. ?safe=0 efface aussi un souvenir de plantage
{
  const { page, contexte } = await ouvrir('retour', '?safe=0', () => {
    localStorage.setItem('kubb-kings.safe-mode', '1');
    localStorage.setItem('kubb-kings.boot-attempt', String(Date.now()));
  });
  await page.waitForTimeout(1200);
  const e = await moteur(page);
  resultats.safe0_RenduNormal = e.rendu === 2 && !e.avis && e.souvenir === null;
  await contexte.close();
}

conclure(resultats, erreurs);
await navigateur.close();
