/**
 * Le tchat en texte libre, de bout en bout, entre deux vrais joueurs.
 *
 * C'est le SEUL contenu du jeu qu'un humain redige : tout le reste est
 * produit par le jeu lui-meme. Il arrive par un canal public dont le code de
 * salon est l'unique secret, donc rien ne garantit qu'un message vienne de
 * l'interface de ce jeu.
 *
 * `chat.test.ts` verifie les regles sur le texte (longueur, caracteres,
 * cadence) hors navigateur. Ce qu'il ne peut PAS voir, et qui est verifie
 * ici :
 *   - qu'un message parte reellement d'un appareil et arrive sur l'autre ;
 *   - que les garde-fous tiennent sur le chemin REEL, pas seulement dans la
 *     fonction pure — un plafond applique a l'envoi mais pas a la reception
 *     ne protegerait de rien ;
 *   - que rien ne survive a la partie.
 */
import { attendreEcran, conclure, lancerNavigateur, ouvrirJeu, ouvrirPartieEnLigne, surveiller } from './harness.mjs';

/** Doit valoir CHAT_MAX_LENGTH (src/game/online/chat.ts). */
const LONGUEUR_MAX = 160;

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

/** Ouvre le panneau de tchat s'il est encore replie. */
async function ouvrirLeTchat(page) {
  await page.bringToFront();
  if (await page.locator('.chat').count()) return;
  await page.locator('.chat-bulle').click();
  await page.waitForSelector('.chat', { timeout: 10000 });
}

/** Ecrit et envoie, en passant par l'interface comme le ferait un joueur. */
async function ecrire(page, texte) {
  await ouvrirLeTchat(page);
  await page.locator('.chat__saisie input').fill(texte);
  await page.locator('.chat__saisie button').click();
  await page.waitForTimeout(400);
}

/** Messages affiches sur cette page, dans l'ordre. */
const messages = async (page) => {
  await ouvrirLeTchat(page);
  return page.evaluate(() => [...document.querySelectorAll('.chat__message')].map((p) => p.textContent));
};

await ouvrirLeTchat(hote);
await ouvrirLeTchat(invite);
resultats.panneauVideAuDepart = (await messages(hote)).length === 0;

// ---- 1. Un message part et arrive.
await ecrire(hote, 'bien joue !');
await invite.bringToFront();
await invite.waitForTimeout(600);
const vuParInvite = await messages(invite);
console.log('invite voit :', JSON.stringify(vuParInvite));
resultats.messageRecuParLAdversaire = vuParInvite.includes('bien joue !');
resultats.messageVisibleChezLAuteur = (await messages(hote)).includes('bien joue !');

// ---- 2. Et dans l'autre sens.
await ecrire(invite, 'merci, a toi');
await hote.bringToFront();
await hote.waitForTimeout(600);
const vuParHote = await messages(hote);
console.log('hote voit  :', JSON.stringify(vuParHote));
resultats.reponseRecue = vuParHote.includes('merci, a toi');

// ---- 3. Les retours a la ligne ne doivent pas fabriquer plusieurs bulles.
//         `fill` les accepte alors que le champ est sur une ligne : c'est
//         exactement le genre de contenu qui n'arrive pas de l'interface.
const avantSaut = (await messages(invite)).length;
await hote.bringToFront();
await hote.waitForTimeout(900); // laisse passer la cadence
await ecrire(hote, 'une\nligne\nseule');
await invite.bringToFront();
await invite.waitForTimeout(600);
const apresSaut = await messages(invite);
resultats.sautsDeLigneNeuTralises =
  apresSaut.length === avantSaut + 1 && apresSaut[apresSaut.length - 1] === 'une ligne seule';

// ---- 4. La longueur est plafonnee A LA RECEPTION aussi.
await hote.bringToFront();
await hote.waitForTimeout(900);
await ecrire(hote, 'x'.repeat(600));
await invite.bringToFront();
await invite.waitForTimeout(600);
const recus = await messages(invite);
const dernier = recus[recus.length - 1] ?? '';
console.log('longueur recue :', dernier.length);
resultats.longueurPlafonneeALaReception = dernier.length === LONGUEUR_MAX;

// ---- 5. La cadence empeche de noyer l'autre joueur.
//
//      La rafale doit se jouer DANS la page. Pilotee depuis Playwright, elle
//      mettait 7,7 s pour cinq messages — 1,5 s d'ecart, bien au-dela de la
//      limite : les cinq passaient legitimement et la verification concluait
//      a tort que le garde-fou ne servait a rien. Ici les cinq clics tiennent
//      dans le meme tour de boucle du navigateur.
await hote.bringToFront();
await hote.waitForTimeout(900);
const avantRafale = (await messages(invite)).length;
await ouvrirLeTchat(hote);
const rafale = await hote.evaluate(() => {
  const champ = document.querySelector('.chat__saisie input');
  const bouton = document.querySelector('.chat__saisie button');
  // React ne voit pas une affectation directe de `value` : il faut passer par
  // le setter natif puis emettre `input`, comme le ferait une vraie frappe.
  const poserValeur = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const debut = performance.now();
  for (const mot of ['un', 'deux', 'trois', 'quatre', 'cinq']) {
    poserValeur.call(champ, mot);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    bouton.click();
  }
  return Math.round(performance.now() - debut);
});
await invite.bringToFront();
await invite.waitForTimeout(900);
const apresRafale = (await messages(invite)).length;
console.log(`rafale de 5 messages en ${rafale} ms -> ${apresRafale - avantRafale} recu(s)`);
// La rafale doit etre reellement rapide, sinon on ne teste rien.
resultats.rafaleReellementRapide = rafale < 200;
resultats.cadenceLimiteLaRafale = apresRafale - avantRafale === 1;

// ---- 6. Un message qui NE VIENT PAS de l'interface du jeu.
//
//      C'est la raison d'etre de l'assainissement a la RECEPTION, et le seul
//      moyen de l'eprouver : tout ce qui passe par le champ de saisie est
//      deja nettoye a l'envoi. On depose donc un message brut directement sur
//      le canal du salon, comme le ferait un pair qui ne se conforme pas.
//      Sans ce cas, retirer le nettoyage cote reception ne faisait echouer
//      aucune verification.
await hote.bringToFront();
await hote.waitForTimeout(900);
const avantBrut = (await messages(hote)).length;
await invite.evaluate((code) => {
  const canal = new BroadcastChannel(`kubb-kings.room.${code.toUpperCase()}`);
  canal.postMessage({
    kind: 'chat',
    playerId: 'pair-non-conforme',
    text: 'DEBUT\n\n\n' + 'z'.repeat(600) + '\u202EFIN'
  });
  canal.close();
}, code);
await hote.bringToFront();
await hote.waitForTimeout(900);
const apresBrut = await messages(hote);
const brutRecu = apresBrut[apresBrut.length - 1] ?? '';
console.log(`message brut recu : ${brutRecu.length} caracteres, debut "${brutRecu.slice(0, 12)}"`);
resultats.messageBrutAffiche = apresBrut.length === avantBrut + 1;
resultats.messageBrutAssainiALaReception =
  brutRecu.length === LONGUEUR_MAX && !brutRecu.includes('\n') && !brutRecu.includes('\u202E');

// ---- 7. Rien ne survit a la partie : on recharge, le tchat est vide.
await hote.reload();
await hote.waitForTimeout(1500);
const apresRechargement = await hote.evaluate(() => ({
  bulles: document.querySelectorAll('.chat__message').length,
  // Et rien n'a ete ecrit sur l'appareil.
  tracesLocales: Object.keys(localStorage).filter((k) => /chat|tchat|message/i.test(k)).length
}));
console.log('apres rechargement :', JSON.stringify(apresRechargement));
resultats.rienNeSurvitAuRechargement = apresRechargement.bulles === 0 && apresRechargement.tracesLocales === 0;

conclure(resultats, erreurs);
await navigateur.close();
