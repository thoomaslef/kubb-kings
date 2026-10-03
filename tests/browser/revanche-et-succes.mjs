/**
 * La revanche et les trois succes du mode en ligne, en une seule session.
 *
 * Trois parties enchainees par la revanche, toutes gagnees par l'hote :
 * c'est le seul moyen d'atteindre « Invaincu », qui traverse trois parties
 * ET la persistance. L'invite part avec une grosse progression, pour que sa
 * carte annonce un niveau bien superieur (« Tombeur de geant »).
 */
import {
  attendreCoups,
  attendreEcran,
  conclure,
  ouvrirPartieEnLigne,
  etat,
  focus,
  lancer,
  lancerNavigateur,
  ouvrirJeu,
  surveiller,
  coups
} from './harness.mjs';

const ECART_ATTENDU = 3; // achievements.ts::GIANT_LEVEL_GAP
const SERIE_ATTENDUE = 3; // achievements.ts::ONLINE_STREAK_TARGET

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 420, height: 900 } });
const erreurs = [];
const resultats = {};
const hote = await contexte.newPage();
const invite = await contexte.newPage();
surveiller('hote', hote, erreurs);
surveiller('invite', invite, erreurs);

// Hote vierge, invite tres avance : c'est un ECART reel qui est teste.
await ouvrirJeu(hote, { xp: 0 });
await ouvrirJeu(invite, { xp: 6000 });
resultats.hoteVierge = (await etat(hote)).succes.length === 0;

const { enMatch } = await ouvrirPartieEnLigne(hote, invite);
resultats.partieLancee = enMatch;

const carte = await hote.evaluate(() => window.__kubb.scene.getScene('MatchScene').session?.opponentCard ?? null);
console.log("carte de l'adversaire :", JSON.stringify(carte));
resultats.carteRecue = !!carte && carte.level > ECART_ATTENDU;

/** Toucher le roi trop tot fait PERDRE son auteur : c'est donc l'invite qui le percute. */
async function faireGagnerHote() {
  const s = await etat(hote);
  if (s.activeTeam === 'blue') {
    const n = (await coups(hote)) + 1;
    await lancer(hote, 0.35);
    await attendreCoups(invite, n);
  }
  await lancer(invite, 0.85, { surLeRoi: true });
  return (await attendreEcran(hote, 'result')) && (await attendreEcran(invite, 'result'));
}

async function demanderRevanche() {
  await focus(hote);
  await hote.locator('button', { hasText: /^Revanche$/i }).first().click();
  await hote.waitForTimeout(2000);
  return etat(hote);
}

// ---- Partie 1.
resultats.partie1 = await faireGagnerHote();
const h1 = await etat(hote);
console.log('1re victoire —', JSON.stringify({ gagnant: h1.resultat?.winner, serie: h1.serie, succes: h1.succes }));
resultats.hoteGagne = h1.resultat?.winner === 'blue';
resultats.serieA1 = h1.serie === 1;
resultats.bapteme = h1.succes.includes('bapteme-du-feu');
resultats.tombeurDeGeant = h1.succes.includes('tombeur-de-geant');
resultats.pasEncoreInvaincu = !h1.succes.includes('invaincu');

// ---- Une demande SEULE ne doit rien relancer.
const apresDemande = await demanderRevanche();
const cote = await etat(invite);
console.log('une seule demande —', JSON.stringify({ hote: apresDemande.screen, invite: cote.screen, etat: cote.online?.rematch }));
resultats.demandeSeuleNeRelancePas = apresDemande.screen === 'result' && cote.screen === 'result';
resultats.adversairePrevenu = cote.online?.rematch === 'proposee';

// ---- L'accord du second relance, des deux cotes.
await focus(invite);
await invite.locator('button', { hasText: /Accepter la revanche/i }).first().click();
resultats.revancheHote = await attendreEcran(hote, 'match');
resultats.revancheInvite = await attendreEcran(invite, 'match');
await hote.waitForTimeout(1000);
const r2 = await etat(hote);
console.log('partie 2 :', JSON.stringify({ coups: r2.coups, commence: r2.setup?.startingTeam }));
resultats.compteurRemisAZero = r2.coups === 0;
resultats.plateauNeuf = r2.kubbs.blue.every((k) => k === 'baseline') && r2.kubbs.red.every((k) => k === 'baseline');

// ---- Partie 2, puis 3 : la serie doit atteindre le seuil, pas avant.
resultats.partie2 = await faireGagnerHote();
const h2 = await etat(hote);
console.log('2e victoire — serie', h2.serie);
resultats.serieA2 = h2.serie === 2;
resultats.toujoursPasInvaincu = !h2.succes.includes('invaincu');

await demanderRevanche();
await focus(invite);
await invite.locator('button', { hasText: /Accepter la revanche/i }).first().click();
await attendreEcran(hote, 'match');
await attendreEcran(invite, 'match');
await hote.waitForTimeout(1000);
resultats.partie3 = await faireGagnerHote();
const h3 = await etat(hote);
console.log('3e victoire —', JSON.stringify({ serie: h3.serie, succes: h3.succes }));
resultats.serieA3 = h3.serie === SERIE_ATTENDUE;
resultats.invaincu = h3.succes.includes('invaincu');

// ---- Le perdant ne gagne rien de tout cela.
const g3 = await etat(invite);
console.log('cote invite —', JSON.stringify({ serie: g3.serie, succes: g3.succes }));
resultats.perdantSansSucces =
  g3.serie === 0 && !['bapteme-du-feu', 'tombeur-de-geant', 'invaincu'].some((id) => g3.succes.includes(id));

// ---- La serie est persistee : elle survit au rechargement.
await focus(hote);
await hote.reload();
await hote.waitForTimeout(1200);
const serieApres = await hote.evaluate(() => window.__kubbStoreApi.getState().onlineWinStreak);
console.log('serie apres rechargement :', serieApres);
resultats.seriePersistee = serieApres === SERIE_ATTENDUE;

conclure(resultats, erreurs);
await navigateur.close();
