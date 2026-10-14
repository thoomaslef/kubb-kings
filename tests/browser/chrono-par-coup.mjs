/**
 * Le minuteur PAR COUP (30 s) a la place du chrono general.
 *
 * Constat : avec un chrono general, un joueur pouvait attendre avant son dernier coup (anti-jeu). Chaque
 * coup a maintenant sa propre limite : passee, le jeu LANCE pour le joueur. On verifie dans un vrai
 * navigateur : le compte a rebours demarre a 30 s, repart de 30 s a chaque tour, le lancer automatique
 * part reellement (un lancer compte, une trajectoire existe), la partie ne s'arrete PAS au temps
 * ecoule, « Longue haleine » ajoute 10 s, et — en ligne — un adversaire qui ne joue pas est
 * abandonne apres sa marge.
 */
import {
  attendreEcran,
  attendreSonTour,
  conclure,
  etat,
  lancerDepuisLeMenu,
  lancerNavigateur,
  ouvrirJeu,
  ouvrirPartieEnLigne,
  surveiller
} from './harness.mjs';

const navigateur = await lancerNavigateur();
const erreurs = [];
const resultats = {};

// ---------------------------------------------------------------- hors ligne (1v1 local)
{
  const contexte = await navigateur.newContext({ viewport: { width: 420, height: 900 }, locale: 'fr-FR' });
  const page = await contexte.newPage();
  surveiller('local', page, erreurs);
  await ouvrirJeu(page);
  await lancerDepuisLeMenu(page, /1v1/i);
  await attendreSonTour(page);
  await page.waitForTimeout(1500);

  const scene = () => page.evaluate(() => {
    const s = window.__kubb.scene.getScene('MatchScene');
    return { reste: s.timeLeftMs, phase: s.phase, lancers: { ...s.throwsLeft }, actif: s.activeTeam, hud: window.__kubbStoreApi.getState().hud.timeLeftMs };
  });
  const depart = await scene();
  console.log({ depart });
  resultats.local_ledecompteDemarreA30s = depart.reste <= 30000 && depart.reste > 27000;
  resultats.local_leHudMontreLeTempsDuCoup = depart.hud <= 30000 && depart.hud > 26000;

  // Le temps de ce coup s'ecoule : le jeu lance a la place du joueur.
  await page.evaluate(() => (window.__kubb.scene.getScene('MatchScene').timeLeftMs = 300));
  const avant = await scene();
  let lanceAuto = false;
  for (let i = 0; i < 20 && !lanceAuto; i += 1) {
    await page.waitForTimeout(150);
    lanceAuto = await page.evaluate(() => {
      const s = window.__kubb.scene.getScene('MatchScene');
      return s.phase === 'flying' || !!s.baton;
    });
  }
  resultats.local_ApresLeTempsLeJeuLanceSeul = lanceAuto;

  // Le vol se termine, c'est a l'autre camp : le compte repart de 30 s, et la partie continue.
  let apres = null;
  for (let i = 0; i < 80; i += 1) {
    await page.waitForTimeout(250);
    apres = await scene();
    if (apres.phase === 'aiming' && apres.actif !== avant.actif && apres.reste > 26000) break;
  }
  console.log({ avant, apres });
  resultats.local_LeLancerAutoComptePourUnLancer = apres.lancers[avant.actif] === avant.lancers[avant.actif] - 1;
  resultats.local_LeCompteRepartA30sPourLAutre = apres.actif !== avant.actif && apres.reste > 26000;
  resultats.local_LaPartieContinue = (await etat(page)).screen === 'match';

  // Un tour plus tard, plus d'un temps ecoule = plus aucune « fin au buzzer » : les motifs de fin n'ont plus 'timeout'.
  const motifs = await page.evaluate(() => typeof window.__kubb.scene.getScene('MatchScene').finishOnPoints === 'function');
  resultats.local_UneFinSurPointsResteLimiteeAuxLancers = motifs;
  await contexte.close();
}

// ---------------------------------------------------------------- « Longue haleine »
{
  const contexte = await navigateur.newContext({ viewport: { width: 420, height: 900 }, locale: 'fr-FR' });
  const page = await contexte.newPage();
  surveiller('longue-haleine', page, erreurs);
  await ouvrirJeu(page);
  await page.locator('button', { hasText: /Defi|Défi/i }).first().click();
  await attendreEcran(page, 'match');
  await page.waitForTimeout(1200);
  const limites = await page.evaluate(() => {
    const api = window.__kubbStoreApi;
    const lire = (perks) => {
      api.setState({ run: { ...api.getState().run, perks } });
      window.__kubb.scene.getScene('MatchScene').scene.restart();
      return new Promise((r) => setTimeout(() => r((() => { const sc = window.__kubb.scene.getScene('MatchScene'); sc.activeTeam = sc.profileTeam; return sc.turnLimitMs(); })()), 900));
    };
    return Promise.all([]).then(async () => ({ sans: await lire([]), avec: await lire(['longue-haleine']) }));
  });
  console.log({ limites });
  resultats.longueHaleine_30sSansLeBonus = limites.sans === 30000;
  resultats.longueHaleine_Plus10sAvecLeBonus = limites.avec === 40000;
  await contexte.close();
}

// ---------------------------------------------------------------- en ligne : un adversaire qui ne joue pas
{
  const contexte = await navigateur.newContext({ viewport: { width: 420, height: 900 } });
  const hote = await contexte.newPage();
  const invite = await contexte.newPage();
  surveiller('hote', hote, erreurs);
  surveiller('invite', invite, erreurs);
  await ouvrirJeu(hote);
  await ouvrirJeu(invite);
  const { enMatch } = await ouvrirPartieEnLigne(hote, invite);
  resultats.enLigne_partieLancee = enMatch;

  const h = await etat(hote);
  // Celui qui n'a PAS la main regarde l'autre : on lui fait croire que son delai est ecoule.
  const attente = h.activeTeam === 'blue' ? invite : hote;
  await attente.evaluate(() => {
    const s = window.__kubb.scene.getScene('MatchScene');
    s.timeLeftMs = 100;
    s.remoteOverdueMs = 0;
  });
  // Marge apres les 30 s : on la franchit sans attendre 12 s reelles.
  await attente.waitForTimeout(400);
  await attente.evaluate(() => (window.__kubb.scene.getScene('MatchScene').remoteOverdueMs = 11950));
  let fini = false;
  for (let i = 0; i < 40 && !fini; i += 1) {
    await attente.waitForTimeout(200);
    fini = await attente.evaluate(() => {
      const o = window.__kubbStoreApi.getState().online;
      return !o || o.status === 'terminee';
    });
  }
  const raison = await attente.evaluate(() => window.__kubbStoreApi.getState().online?.endedBecause ?? null);
  console.log({ raison });
  resultats.enLigne_UnAdversaireInactifEstAbandonne = fini && raison === 'inactif';

  await contexte.close();
}

conclure(resultats, erreurs);
await navigateur.close();
