/**
 * Les parties classees, de bout en bout.
 *
 * `ranks.test.ts` verrouille la regle pure (une marche par resultat, bornes,
 * Or 2 + victoire = Or 3). Il ne dit rien de la chaine reelle, que voici :
 *
 *   - l'ecran des rangs, depuis le menu ;
 *   - la file CLASSEE (canal separe de la partie rapide) qui couple deux
 *     joueurs, avec des conditions imposees : terrain classique, sans vent,
 *     sans kubb de champ, projectile de base pour les deux ;
 *   - le rang qui bouge VRAIMENT apres une partie : le vainqueur monte d'une
 *     marche, le perdant descend d'une marche, partant de Or 2 pour les deux ;
 *   - le forfait : l'invite qui quitte perd une marche, l'hote gagne par
 *     forfait ;
 *   - l'onglet ferme en pleine partie, qui compte comme une defaite au
 *     chargement suivant ;
 *   - le bot de la file classee, qui est de l'entrainement : le rang ne bouge pas.
 *
 * Le rang de depart est inscrit dans le stockage (Or 2 = marche 7) pour que la
 * promotion dans le meme palier soit visible, pas seulement Bronze 1 -> Bronze 2.
 */
import { attendreEcran, conclure, creerSalon, etat, focus, lancer, lancerNavigateur, ouvrirJeu, surveiller } from './harness.mjs';

const OR_2 = 7; // Bronze 1-3 = 0-2, Argent 1-3 = 3-5, Or 1-3 = 6-8
const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 420, height: 900 } });
const erreurs = [];
const resultats = {};

async function nouvellePage(nom, indexDeRang = OR_2, { pending = false } = {}) {
  const page = await contexte.newPage();
  surveiller(nom, page, erreurs);
  await ouvrirJeu(page);
  await page.evaluate(
    ({ index, pending }) => {
      localStorage.setItem('kubb-kings.rank', JSON.stringify({ index, wins: 0, losses: 0, peak: index }));
      if (pending) localStorage.setItem('kubb-kings.ranked-pending', '1');
      else localStorage.removeItem('kubb-kings.ranked-pending');
    },
    { index: indexDeRang, pending }
  );
  await page.reload();
  await page.waitForTimeout(1000);
  return page;
}

const rang = (page) => page.evaluate(() => window.__kubbStoreApi.getState().rank);
const dernierMouvement = (page) => page.evaluate(() => window.__kubbStoreApi.getState().lastRankChange);

/** Menu -> ecran des rangs -> recherche classee. */
async function chercherClasse(page) {
  await focus(page);
  await page.locator('button', { hasText: /Classe —/ }).first().click();
  await page.waitForTimeout(400);
  await page.locator('button', { hasText: /Chercher une partie classee/i }).first().click();
}

// ---------------------------------------------------------------- 1. l'ecran des rangs
{
  const p = await nouvellePage('menu');
  await focus(p);
  const libelleMenu = await p.locator('button', { hasText: /Classe —/ }).first().textContent();
  await p.locator('button', { hasText: /Classe —/ }).first().click();
  await p.waitForTimeout(400);
  const ecran = await p.evaluate(() => ({
    titre: document.querySelector('.panel__title')?.textContent,
    paliers: [...document.querySelectorAll('.ranks-tier__name')].map((n) => n.textContent),
    divisions: document.querySelectorAll('.ranks-division').length,
    ici: document.querySelectorAll('.ranks-division--here').length,
    courant: document.querySelector('.ranks-current__name')?.textContent
  }));
  console.log({ libelleMenu, ecran });
  resultats.leMenuAfficheLeRang = /Or 2/.test(libelleMenu ?? '');
  resultats.sixPaliersDuPlusHautAuPlusBas =
    JSON.stringify(ecran.paliers) === JSON.stringify(['Master', 'Diamant', 'Platine', 'Or', 'Argent', 'Bronze']);
  resultats.dixHuitDivisions = ecran.divisions === 18;
  resultats.uneSeuleMarcheMarqueeIci = ecran.ici === 1;
  resultats.leRangCourantEstAffiche = ecran.courant === 'Or 2';
  await p.close();
}

// ---------------------------------------------------------------- 2. une vraie partie classee
{
  const hote = await nouvellePage('hote');
  const invite = await nouvellePage('invite');
  // Des reglages de menu qui, hors classe, changeraient la partie : en classe, ils doivent rester sans effet.
  await hote.evaluate(() => {
    const st = window.__kubbStoreApi.getState();
    st.setWindEnabled(true);
    st.setFieldKubbsEnabled(true);
    st.setFieldPreset('glace');
  });
  await chercherClasse(hote);
  await chercherClasse(invite);
  const hoteEnMatch = await attendreEcran(hote, 'match', 200);
  const inviteEnMatch = await attendreEcran(invite, 'match', 200);
  resultats.lesDeuxSontCouples = hoteEnMatch && inviteEnMatch;

  await hote.waitForTimeout(1500);
  const conditions = await hote.evaluate(() => {
    const s = window.__kubbStoreApi.getState();
    const scene = window.__kubb.scene.getScene('MatchScene');
    return { ranked: s.online?.ranked, role: s.online?.role, setup: scene.record.setup };
  });
  const conditionsInvite = await invite.evaluate(() => {
    const s = window.__kubbStoreApi.getState();
    return { ranked: s.online?.ranked, role: s.online?.role, pending: localStorage.getItem('kubb-kings.ranked-pending') };
  });
  console.log({ conditions, conditionsInvite });
  resultats.partieMarqueeClasseDesDeuxCotes = conditions.ranked === true && conditionsInvite.ranked === true;
  resultats.terrainClassiqueSansVentNiKubbDeChamp =
    conditions.setup.fieldPreset === 'classique' && conditions.setup.wind === null && conditions.setup.fieldKubbsEnabled === false;
  resultats.projectileDeBasePourLesDeux = conditions.setup.batons.blue === 'base' && conditions.setup.batons.red === 'base';
  resultats.abandonParOngletFermeDetectable = conditionsInvite.pending === '1';

  // L'invite touche le roi trop tot : il perd, l'hote gagne.
  const premier = await hote.evaluate(() => window.__kubb.scene.getScene('MatchScene').activeTeam);
  if (premier === 'blue') await lancer(hote, 0.4);
  await lancer(invite, 1, { surLeRoi: true });
  const hoteResultat = await attendreEcran(hote, 'result', 200);
  const inviteResultat = await attendreEcran(invite, 'result', 200);
  resultats.lesDeuxVoientLeResultat = hoteResultat && inviteResultat;

  const rh = await rang(hote);
  const ri = await rang(invite);
  const mh = await dernierMouvement(hote);
  console.log({ rh, ri, mh });
  resultats.leVainqueurPasseDeOr2AOr3 = rh.index === OR_2 + 1 && rh.wins === 1;
  resultats.lePerdantDescendUneMarche = ri.index === OR_2 - 1 && ri.losses === 1;
  resultats.lePerdantNeDescendQueDUneMarche = ri.index === 6;

  const affichage = await hote.evaluate(() => ({
    ligne: document.querySelector('.rank-line')?.textContent ?? null,
    boutons: [...document.querySelectorAll('.button-column button')].map((b) => b.textContent)
  }));
  resultats.lEcranDeResultatAnnonceLeRang = /Or 2/.test(affichage.ligne ?? '') && /Or 3/.test(affichage.ligne ?? '');
  resultats.pasDeRevancheEnClasse = !affichage.boutons.some((b) => /revanche/i.test(b ?? ''));
  resultats.onPeutEnchainerUneAutrePartie = affichage.boutons.some((b) => /Autre partie classee/i.test(b ?? ''));
  const pendantApres = await hote.evaluate(() => localStorage.getItem('kubb-kings.ranked-pending'));
  resultats.marqueurEffaceApresLaPartie = pendantApres === null;

  // Le rang survit a un rechargement.
  await hote.reload();
  await hote.waitForTimeout(1000);
  resultats.leRangSurvitAuRechargement = (await rang(hote)).index === OR_2 + 1;
  await hote.close();
  await invite.close();
}

// ---------------------------------------------------------------- 3. forfait de l'invite
{
  const hote = await nouvellePage('hote2');
  const invite = await nouvellePage('invite2');
  await chercherClasse(hote);
  await chercherClasse(invite);
  await attendreEcran(hote, 'match', 200);
  await attendreEcran(invite, 'match', 200);
  await hote.waitForTimeout(1500);

  // L'invite quitte en cours de partie, comme depuis le menu pause.
  await focus(invite);
  await invite.evaluate(() => window.__kubb.scene.getScene('MatchScene').handleLeave());
  await invite.waitForTimeout(800);
  await focus(hote);
  for (let i = 0; i < 40; i += 1) {
    const m = await dernierMouvement(hote);
    if (m) break;
    await hote.waitForTimeout(250);
  }
  const ri = await rang(invite);
  const rh = await rang(hote);
  const mi = await dernierMouvement(invite);
  const mh = await dernierMouvement(hote);
  console.log({ ri, rh, mi, mh });
  resultats.quitterEnCoursCompteCommeDefaite = ri.index === OR_2 - 1 && mi?.reason === 'forfeit-loss';
  resultats.lAdversaireParti_VictoireParForfait = rh.index === OR_2 + 1 && mh?.reason === 'forfeit-win';
  resultats.pasDeMarqueurRestantApresForfait =
    (await invite.evaluate(() => localStorage.getItem('kubb-kings.ranked-pending'))) === null &&
    (await hote.evaluate(() => localStorage.getItem('kubb-kings.ranked-pending'))) === null;
  await hote.close();
  await invite.close();
}

// ---------------------------------------------------------------- 4. onglet ferme en pleine partie
{
  const p = await nouvellePage('abandon', OR_2, { pending: true });
  const r = await rang(p);
  const m = await dernierMouvement(p);
  const pend = await p.evaluate(() => localStorage.getItem('kubb-kings.ranked-pending'));
  console.log({ r, m, pend });
  resultats.ongletFermeEnPartieEstUneDefaite = r.index === OR_2 - 1 && r.losses === 1 && m?.reason === 'abandon';
  resultats.leMarqueurNEstPasRejoue = pend === null;
  await p.reload();
  await p.waitForTimeout(800);
  resultats.pasDeDoubleSanction = (await rang(p)).index === OR_2 - 1;
  await p.close();
}

// ---------------------------------------------------------------- 5. seul : un bot d'entrainement, sans effet sur le rang
{
  const a = await nouvellePage('seul');
  await chercherClasse(a);
  const enMatch = await attendreEcran(a, 'match', 260);
  await a.waitForTimeout(1500);
  const e = await a.evaluate(() => {
    const s = window.__kubbStoreApi.getState();
    return { mode: s.mode, online: s.online, rank: s.rank, pending: localStorage.getItem('kubb-kings.ranked-pending') };
  });
  console.log({ enMatch, e });
  resultats.leBotArriveEnClasse = enMatch && e.mode === 'solo' && e.online === null;
  resultats.leRangNeBougePasContreLeBot = e.rank.index === OR_2 && e.rank.wins === 0 && e.rank.losses === 0;
  resultats.aucunMarqueurDAbandonContreLeBot = e.pending === null;
  await a.close();
}

conclure(resultats, erreurs);
await navigateur.close();
