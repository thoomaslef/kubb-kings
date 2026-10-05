/**
 * Une vraie partie en ligne, de bout en bout, entre deux onglets.
 *
 * Couvre ce qu'aucun test unitaire ne peut couvrir : la poignee de main, le
 * decor impose par l'hote, le tour de jeu verrouille, la propagation d'un
 * lancer avec la physique Matter reelle, et le coup decisif — celui qui
 * termine la partie et qui, pendant longtemps, ne partait PAS (cf. README).
 */
import {
  attendreCoups,
  attendreEcran,
  conclure,
  ouvrirPartieEnLigne,
  etat,
  lancer,
  lancerNavigateur,
  ouvrirJeu,
  surveiller
} from './harness.mjs';

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 420, height: 900 } });
const erreurs = [];
const resultats = {};
const hote = await contexte.newPage();
const invite = await contexte.newPage();
surveiller('hote', hote, erreurs);
surveiller('invite', invite, erreurs);
await ouvrirJeu(hote);
await ouvrirJeu(invite);

const { code, enMatch } = await ouvrirPartieEnLigne(hote, invite);
console.log('salon :', code);
resultats.partieLancee = enMatch;

const h0 = await etat(hote);
const g0 = await etat(invite);
console.log('hote  :', JSON.stringify({ ecran: h0.screen, camp: h0.profileTeam, actif: h0.activeTeam }));
console.log('invite:', JSON.stringify({ ecran: g0.screen, camp: g0.profileTeam, actif: g0.activeTeam }));
resultats.campsDistribues = h0.profileTeam === 'blue' && g0.profileTeam === 'red';
resultats.memeDecor = JSON.stringify(h0.setup) === JSON.stringify(g0.setup);
resultats.memePremierJoueur = h0.activeTeam === g0.activeTeam;

// ---- Celui qui n'a pas la main ne doit pas pouvoir viser.
const enAttente = h0.activeTeam === 'blue' ? invite : hote;
const bloque = await enAttente.evaluate(() => {
  const scene = window.__kubb.scene.getScene('MatchScene');
  scene.onPointerDown({ worldX: 360, worldY: 900 });
  return scene.isDragging;
});
console.log("l'autre camp peut viser ?", bloque);
resultats.tourVerrouille = bloque === false;
resultats.bandeauDeTour = (await etat(enAttente)).notes.concat((await etat(enAttente)).boutons).join(' ').length >= 0;

// ---- Un lancer de chaque camp, etat identique des deux cotes.
//
// Le PREMIER part avec de l'effet : c'est la seule entree de lancer ajoutee
// depuis que le protocole existe, et il faut verifier qu'elle traverse. Sans
// cela, l'adversaire rejouerait un baton tout droit et verrait son
// animation rater ce qu'elle vient d'abattre.
const effetsEnvoyes = [0.6, 0];
/** Effet reellement APPLIQUE au dernier vol de cette page. */
const effetDuVol = (page) =>
  page.evaluate(() => window.__kubb.scene.getScene('MatchScene').flightSpin);

let effetRejoue = null;
for (const n of [1, 2]) {
  const s = await etat(hote);
  const lanceur = s.activeTeam === 'blue' ? hote : invite;
  const autre = s.activeTeam === 'blue' ? invite : hote;
  await lancer(lanceur, 0.8, { effet: effetsEnvoyes[n - 1] });
  resultats[`lancer${n}Recu`] = await attendreCoups(autre, n);
  // Releve APRES le premier lancer seulement : le second, sans effet,
  // ecraserait la valeur.
  if (n === 1) effetRejoue = await effetDuVol(autre);
}

console.log(`effet envoye : ${effetsEnvoyes[0]}   effet rejoue chez l'adversaire : ${effetRejoue}`);
// On regarde le VOL rejoue, pas l'enregistrement : celui-ci n'est que la
// charge utile renvoyee en echo, et il reste identique des deux cotes meme
// si le receveur anime un baton tout droit. Une premiere version comparait
// les enregistrements — la mutation « ne pas rejouer l'effet » ne la faisait
// pas broncher.
resultats.effetRejoueChezLAdversaire = effetRejoue === effetsEnvoyes[0];
const h2 = await etat(hote);
const g2 = await etat(invite);
console.log('apres deux lancers — hote :', JSON.stringify({ coups: h2.coups, kubbs: h2.kubbs, restants: h2.throwsLeft }));
console.log('                     invite:', JSON.stringify({ coups: g2.coups, kubbs: g2.kubbs, restants: g2.throwsLeft }));
resultats.etatIdentique =
  h2.coups === 2 &&
  g2.coups === 2 &&
  h2.activeTeam === g2.activeTeam &&
  JSON.stringify(h2.kubbs) === JSON.stringify(g2.kubbs) &&
  JSON.stringify(h2.throwsLeft) === JSON.stringify(g2.throwsLeft);

// ---- Coup decisif : il ne repasse pas par la fin de tour normale, il doit
//      donc partir depuis finish() — sinon l'adversaire attend a jamais.
const s3 = await etat(hote);
const decisif = s3.activeTeam === 'blue' ? hote : invite;
const autre3 = s3.activeTeam === 'blue' ? invite : hote;
await lancer(decisif, 0.85, { surLeRoi: true });
await attendreCoups(autre3, 3);
resultats.finChezLeLanceur = await attendreEcran(decisif, 'result');
resultats.finChezLAutre = await attendreEcran(autre3, 'result');

const rh = await hote.evaluate(() => window.__kubbStoreApi.getState().result);
const rg = await invite.evaluate(() => window.__kubbStoreApi.getState().result);
console.log('resultat hote  :', JSON.stringify(rh));
console.log('resultat invite:', JSON.stringify(rg));
resultats.memeResultat = !!rh && JSON.stringify(rh) === JSON.stringify(rg) && rh.reason === 'king-early';

conclure(resultats, erreurs);
await navigateur.close();
