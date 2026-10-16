/**
 * Defi : la run se reprend apres fermeture du jeu, a la manche ou l'on s'est arrete (bonus compris).
 */
import { attendreEcran, conclure, lancerNavigateur, ouvrirJeu, surveiller } from './harness.mjs';

const navigateur = await lancerNavigateur();
const page = await navigateur.newPage({ viewport: { width: 420, height: 900 } });
const erreurs = [];
const resultats = {};
surveiller('defi', page, erreurs);
await ouvrirJeu(page);

const etat = () =>
  page.evaluate(() => {
    const s = window.__kubbStoreApi.getState();
    return { screen: s.screen, run: s.run, saved: s.savedRun };
  });
const recharger = async () => {
  await page.reload();
  await page.waitForFunction(() => window.__kubbStoreApi?.getState().screen === 'menu', null, { timeout: 30000 });
};
const boutonReprise = () => page.locator('[data-testid="defi-resume"]');
const terminer = (gagne) =>
  page.evaluate((gagne) => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    scene.finish({ winner: gagne ? 'blue' : 'red', reason: 'king-down', knockedDown: { blue: 5, red: gagne ? 5 : 0 } }, 100);
  }, gagne);

resultats.depart_PasDeReprise = (await boutonReprise().count()) === 0;

// Manche 1 gagnee, puis on ferme le jeu AVANT d'avoir choisi le bonus.
await page.locator('button', { hasText: /Defi — 30 manches/ }).click();
await attendreEcran(page, 'match');
await page.waitForTimeout(1200);
await terminer(true);
await page.waitForTimeout(1500);
resultats.manche1_LaRunEstRetenueApresUneVictoire = (await etat()).saved?.perkPending === true;
await recharger();
resultats.manche1_LeMenuProposeDeReprendre = (await boutonReprise().count()) === 1;
resultats.manche1_LeNumeroDeManche = /manche 2\/30/i.test((await boutonReprise().textContent()) ?? '');

// Reprise : le choix du bonus rouvre, puis la manche 2 demarre avec ce bonus.
await boutonReprise().click();
await page.waitForSelector('.btn--perk', { timeout: 10000 });
resultats.reprise_LeChoixDuBonusRouvre = (await etat()).screen === 'perk';
await page.locator('.btn--perk').first().click();
await attendreEcran(page, 'match');
await page.waitForTimeout(1200);
const e2 = await etat();
resultats.reprise_LaManche2Demarre = e2.run?.stageIndex === 1 && e2.run.perks.length === 1;

// On ferme au milieu de la manche 2 : on reprend la MEME manche, bonus conserve.
await recharger();
resultats.manche2_ReprendALaManche2 = /manche 2\/30/i.test((await boutonReprise().textContent()) ?? '');
await boutonReprise().click();
await attendreEcran(page, 'match');
await page.waitForTimeout(1200);
const e3 = await etat();
resultats.manche2_LeBonusEstConserve = e3.run?.stageIndex === 1 && e3.run.perks.length === 1;

// Une defaite termine la run : plus rien a reprendre.
await terminer(false);
await page.waitForTimeout(1500);
resultats.defaite_LaSauvegardeEstEffacee = (await etat()).saved === null;
await recharger();
resultats.defaite_PlusDeReprise = (await boutonReprise().count()) === 0;

// Nouvelle run : efface une sauvegarde existante.
await page.locator('button', { hasText: /Defi — 30 manches/ }).click();
await attendreEcran(page, 'match');
await page.waitForTimeout(1200);
await terminer(true);
await page.waitForTimeout(1500);
await recharger();
await page.locator('button', { hasText: /Nouveau Defi/ }).click();
await attendreEcran(page, 'match');
await page.waitForTimeout(1000);
const e4 = await etat();
resultats.nouvelle_RepartDeLaManche1 = e4.run?.stageIndex === 0 && e4.run.perks.length === 0 && e4.saved === null;

// Une sauvegarde abimee est ignoree.
await page.evaluate(() => localStorage.setItem('kubb-kings.defi-run', '{"run":{"stageIndex":99,"perks":["triche"]}}'));
await recharger();
resultats.abimee_EstIgnoree = (await boutonReprise().count()) === 0;

await navigateur.close();
conclure(resultats, erreurs);
