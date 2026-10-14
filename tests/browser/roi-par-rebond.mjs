/**
 * Le roi decouvert (tous les kubbs adverses au sol) ne tombe que sur un REBOND de bande :
 *   - un tir droit sur le roi ne fait rien (la partie continue, le roi reste debout) ;
 *   - l'IA le sait : elle vise la bande, et finit par faire tomber le roi ;
 *   - toucher le roi TROP TOT reste une defaite immediate.
 */
import { attendreEcran, attendreSonTour, conclure, lancer, lancerDepuisLeMenu, lancerNavigateur, ouvrirJeu, surveiller } from './harness.mjs';

const navigateur = await lancerNavigateur();
const erreurs = [];
const resultats = {};

const scene = (page, f, arg) => page.evaluate(`(${f.toString()})(window.__kubb.scene.getScene('MatchScene'), ${JSON.stringify(arg ?? null)})`);

// ---- 1) tir droit : sans effet
{
  const page = await navigateur.newPage({ viewport: { width: 420, height: 900 } });
  surveiller('droit', page, erreurs);
  await ouvrirJeu(page);
  await lancerDepuisLeMenu(page, /1v1/i);
  await attendreEcran(page, 'match');
  await page.waitForTimeout(1200);
  await scene(page, (s) => {
    s.activeTeam = 'blue';
    s.teams.red.kubbs.forEach((k) => k.knockDown(s));
  });
  await attendreSonTour(page);
  await lancer(page, 0.9, { surLeRoi: true });
  await page.waitForTimeout(800);
  const e = await scene(page, (s) => ({ debout: s.king.isStanding, phase: s.phase, touche: s.kingTouchedThisThrow }));
  console.log({ droit: e });
  resultats.droit_LeRoiResteDebout = e.debout === true;
  resultats.droit_LaPartieContinue = e.phase !== 'over';
  await page.close();
}

// ---- 2) trop tot : defaite immediate, rebond ou non
{
  const page = await navigateur.newPage({ viewport: { width: 420, height: 900 } });
  surveiller('tropTot', page, erreurs);
  await ouvrirJeu(page);
  await lancerDepuisLeMenu(page, /1v1/i);
  await attendreEcran(page, 'match');
  await page.waitForTimeout(1200);
  await scene(page, (s) => { s.activeTeam = 'blue'; });
  await attendreSonTour(page);
  await lancer(page, 0.9, { surLeRoi: true });
  await page.waitForTimeout(800);
  const e = await scene(page, (s) => ({ debout: s.king.isStanding }));
  resultats.tropTot_LeRoiTombeEncore = e.debout === false;
  await page.close();
}

// ---- 3) l'IA joue le rebond
{
  const page = await navigateur.newPage({ viewport: { width: 420, height: 900 } });
  surveiller('ia', page, erreurs);
  await ouvrirJeu(page);
  await lancerDepuisLeMenu(page, /Solo/i);
  await attendreEcran(page, 'match');
  await page.waitForTimeout(1200);
  const ESSAIS = 12;
  let gagnes = 0;
  for (let i = 0; i < ESSAIS; i += 1) {
    await scene(page, (s) => s.scene.restart());
    await page.waitForTimeout(1300);
    await scene(page, (s) => {
      s.teams.blue.kubbs.forEach((k) => k.knockDown(s));
      s.activeTeam = 'red';
      s.beginAiTurn();
    });
    let fini = null;
    for (let t = 0; t < 40 && !fini; t += 1) {
      await page.waitForTimeout(250);
      fini = await scene(page, (s) => (s.phase === 'over' || (s.phase === 'aiming' && s.activeTeam === 'blue') ? { phase: s.phase, roi: s.king.isStanding, mur: s.bouncedWallThisThrow, touche: s.kingTouchedThisThrow } : null));
    }
    if (fini && fini.roi === false && fini.phase === 'over') gagnes += 1;
  }
  console.log({ gagnes, ESSAIS });
  resultats.ia_FaitTomberLeRoiParRebond = gagnes >= 4;
  await page.close();
}

await navigateur.close();
conclure(resultats, erreurs);
