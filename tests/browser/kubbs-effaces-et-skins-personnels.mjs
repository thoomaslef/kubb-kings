/**
 * 1) Un kubb abattu s'EFFACE apres sa chute (un nouveau joueur ne comprenait pas
 *    ce qu'etait ce bloc couche), et peut toujours etre redresse ensuite.
 * 2) Les skins sont PERSONNELS en ligne : chacun voit les kubbs de chaque camp
 *    avec le skin de leur proprietaire, pas avec le sien.
 */
import { attendreEcran, creerSalon, lancerDepuisLeMenu, lancerNavigateur, ouvrirJeu, rejoindreSalon, surveiller, conclure } from './harness.mjs';

const navigateur = await lancerNavigateur();
const erreurs = [];
const resultats = {};

// ---- 1) Effacement ----
{
  const page = await navigateur.newPage({ viewport: { width: 420, height: 900 } });
  surveiller('local', page, erreurs);
  await ouvrirJeu(page);
  await lancerDepuisLeMenu(page, /1v1/i);
  await attendreEcran(page, 'match');
  await page.waitForTimeout(1200);
  const comptes = () =>
    page.evaluate(() => {
      const s = window.__kubb.scene.getScene('MatchScene');
      const couches = s.children.list.filter((o) => o.texture?.key?.startsWith('kubb-down') && o.active).length;
      return { couches, debout: s.teams.blue.standingCount };
    });
  const avant = await comptes();
  await page.evaluate(() => {
    const s = window.__kubb.scene.getScene('MatchScene');
    s.teams.blue.kubbs[0].knockDown(s);
  });
  await page.waitForTimeout(200);
  const pendant = await comptes();
  await page.waitForTimeout(1200);
  const apres = await comptes();
  console.log({ avant, pendant, apres });
  resultats.local_LeKubbCoucheSeVoitPuisDisparait = pendant.couches === avant.couches + 1 && apres.couches === avant.couches;
  resultats.local_IlEstBienSortiDuJeu = apres.debout === avant.debout - 1;
  await page.evaluate(() => window.__kubb.scene.getScene('MatchScene').reviveLeftmostKubb('blue'));
  await page.waitForTimeout(400);
  resultats.local_IlPeutEtreRedresse = (await comptes()).debout === avant.debout;
  await page.close();
}

// ---- 2) Skins personnels ----
{
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
  const hote = await contexte.newPage();
  const invite = await contexte.newPage();
  surveiller('hote', hote, erreurs);
  surveiller('invite', invite, erreurs);
  await ouvrirJeu(hote);
  await ouvrirJeu(invite);
  await hote.evaluate(() => {
    const s = window.__kubbStoreApi.getState();
    s.setKubbSkin('marbre');
    s.setTrailEffect('glace');
  });
  const code = await creerSalon(hote);
  await rejoindreSalon(invite, code);
  await attendreEcran(hote, 'match', 120);
  await hote.waitForTimeout(1500);
  const textures = (page) =>
    page.evaluate(() => {
      const s = window.__kubb.scene.getScene('MatchScene');
      const cle = (t) => s.teams[t].kubbs[0].sprite.texture.key;
      return { blue: cle('blue'), red: cle('red'), carteAdverse: s.session?.opponentCard?.skins ?? null };
    });
  const th = await textures(hote);
  const ti = await textures(invite);
  console.log({ th, ti });
  resultats.en_LHoteVoitSesKubbsEnMarbre = th.blue === 'kubb-blue-marbre';
  resultats.en_LHoteVoitCeuxDeLInviteEnBois = th.red === 'kubb-red-bois';
  resultats.en_LInviteVoitCeuxDeLHoteEnMarbre = ti.blue === 'kubb-blue-marbre';
  resultats.en_LInviteGardeLesSiensEnBois = ti.red === 'kubb-red-bois';
  resultats.en_LInviteConnaitLaTrainee = ti.carteAdverse?.trail === 'glace' && ti.carteAdverse?.kubb === 'marbre';
  await contexte.close();
}

await navigateur.close();
conclure(resultats, erreurs);
