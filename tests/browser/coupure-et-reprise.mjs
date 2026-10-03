/**
 * Ce qui arrive quand la liaison lache.
 *
 * Deux defauts qui n'existent PAS avec le transport local (deux onglets
 * vivent ou meurent ensemble) et que seul un vrai reseau revele :
 *   - un joueur qui recharge sa page doit pouvoir reprendre la partie ;
 *   - une coupure silencieuse doit etre detectee, et DITE.
 */
import {
  attendreCoups,
  conclure,
  ouvrirPartieEnLigne,
  etat,
  focus,
  lancer,
  lancerNavigateur,
  ouvrirJeu,
  rejoindreSalon,
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
resultats.partieLancee = enMatch;

// ---- Deux lancers, pour que la partie ait une histoire a rejouer.
for (const n of [1, 2]) {
  const s = await etat(hote);
  const lanceur = s.activeTeam === 'blue' ? hote : invite;
  const autre = s.activeTeam === 'blue' ? invite : hote;
  await lancer(lanceur, 0.8);
  await attendreCoups(autre, n);
}
const avant = await etat(hote);
console.log('avant coupure :', JSON.stringify({ coups: avant.coups, kubbs: avant.kubbs, restants: avant.throwsLeft }));
resultats.deuxLancers = avant.coups === 2;

// ---- L'invite recharge : tout est perdu de son cote.
const depart = Date.now();
await focus(invite);
await invite.reload();
await invite.waitForTimeout(900);
const neuf = await etat(invite);
console.log('apres rechargement :', JSON.stringify({ ecran: neuf.screen, online: neuf.online }));
resultats.inviteRemisAZero = neuf.screen === 'menu' && neuf.online === null;

// ---- Il rejoint avec le MEME code : l'hote doit lui renvoyer la partie.
await rejoindreSalon(invite, code);
resultats.repriseRecue = await attendreCoups(invite, 2);
console.log('reprise en', Date.now() - depart, 'ms');

const apres = await etat(invite);
const ref = await etat(hote);
console.log('invite apres reprise :', JSON.stringify({ coups: apres.coups, kubbs: apres.kubbs, actif: apres.activeTeam }));
resultats.repriseFidele =
  apres.coups === ref.coups &&
  apres.activeTeam === ref.activeTeam &&
  JSON.stringify(apres.kubbs) === JSON.stringify(ref.kubbs) &&
  JSON.stringify(apres.throwsLeft) === JSON.stringify(ref.throwsLeft);

// ---- Et la partie continue : preuve que la numerotation a bien repris.
const s3 = await etat(hote);
const lanceur3 = s3.activeTeam === 'blue' ? hote : invite;
const autre3 = s3.activeTeam === 'blue' ? invite : hote;
await lancer(lanceur3, 0.75);
resultats.jouableApresReprise = await attendreCoups(autre3, 3);
const h3 = await etat(hote);
const g3 = await etat(invite);
resultats.toujoursSynchro = h3.coups === 3 && g3.coups === 3 && JSON.stringify(h3.kubbs) === JSON.stringify(g3.kubbs);

// ---- Coupure SILENCIEUSE : on ferme l'onglet sans un mot.
const coupure = Date.now();
await invite.close();
let perdu = null;
for (let i = 0; i < 80; i += 1) {
  const s = await etat(hote);
  if (s.online?.status === 'terminee') {
    perdu = s;
    break;
  }
  await hote.waitForTimeout(500);
}
console.log('coupure detectee en', Date.now() - coupure, 'ms —', JSON.stringify(perdu?.online));
resultats.coupureDetectee = perdu?.online?.endedBecause === 'perdu';

// Le retour au menu passe par une scene Phaser puis un rendu React : on
// attend l'ECRAN, pas l'instant ou le store a change.
let avis = null;
for (let i = 0; i < 40; i += 1) {
  const s = await etat(hote);
  if (s.screen === 'menu' && s.texte) {
    avis = s;
    break;
  }
  await hote.waitForTimeout(250);
}
console.log('message au menu :', avis?.titre, '—', avis?.texte);
resultats.coupureExpliquee = /perdue/i.test(avis?.texte ?? '');

conclure(resultats, erreurs);
await navigateur.close();
