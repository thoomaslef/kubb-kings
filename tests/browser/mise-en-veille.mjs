/**
 * Le jeu revient-il a la bonne echelle apres une mise en veille ?
 *
 * Signale sur un vrai iPhone : verrouillage du telephone, deverrouillage,
 * et le jeu se retrouve dans un petit rectangle centre au milieu de
 * l'ecran. Le HUD React restait correct — c'est donc l'echelle de Phaser
 * qui etait restee figee.
 *
 * La cause : Phaser ne re-mesure son conteneur que lorsqu'il detecte un
 * changement, et ce controle tourne dans sa boucle de jeu — laquelle est
 * GELEE tant que la page est en arriere-plan. Si la taille du conteneur
 * change pendant ce gel, la mesure d'avant reste en place.
 *
 * Le declencheur exact d'iOS n'est pas reproductible ici : Chromium, lui,
 * se rattrape tout seul au reveil. On verifie donc l'INVARIANT, pas le
 * scenario : quoi qu'il arrive au conteneur, le canevas doit finir ajuste
 * — tenir dedans, et toucher au moins un bord.
 *
 * Le cas le plus severe est teste boucle ARRETEE, pour qu'aucun des
 * mecanismes internes de Phaser ne puisse masquer un filet absent.
 */
import { lancerNavigateur, focus, surveiller } from './harness.mjs';

const BASE = process.env.KUBB_URL ?? 'http://localhost:4173/kubb-kings/';
/** Laisse au chien de garde (1 s) le temps d'agir. */
const DELAI_RATTRAPAGE = 1800;

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const erreurs = [];
const page = await contexte.newPage();
surveiller('jeu', page, erreurs);
await page.goto(BASE);
await page.waitForFunction(() => Boolean(window.__kubb), null, { timeout: 30000 });
await page.waitForTimeout(1200);

/** Le canevas tient-il dans son conteneur en touchant un bord ? */
const mesurer = () =>
  page.evaluate(() => {
    const hote = document.querySelector('.game-canvas');
    const toile = hote.querySelector('canvas');
    const h = hote.getBoundingClientRect();
    const c = toile.getBoundingClientRect();
    const depasse = c.width > h.width + 1 || c.height > h.height + 1;
    const toucheUnBord = Math.abs(c.width - h.width) < 2 || Math.abs(c.height - h.height) < 2;
    return {
      hote: `${Math.round(h.width)}x${Math.round(h.height)}`,
      canvas: `${Math.round(c.width)}x${Math.round(c.height)}`,
      ajuste: !depasse && toucheUnBord
    };
  });

const hauteurHote = (pourcent) =>
  page.evaluate((p) => {
    document.querySelector('.app').style.height = p;
  }, pourcent);

const resultats = {};
console.log('depart                     :', JSON.stringify(await mesurer()));
resultats.ajusteAuDemarrage = (await mesurer()).ajuste;

// ---- 1. Boucle GELEE, conteneur retreci puis restaure.
//         C'est le scenario de la veille : rien dans Phaser ne tourne.
await page.evaluate(() => window.__kubb.loop.stop());
await hauteurHote('55%');
await page.waitForTimeout(300);
const casse = await mesurer();
console.log('gelee + hote retreci       :', JSON.stringify(casse));
// On veut vraiment avoir casse quelque chose, sinon le test ne prouve rien.
resultats.leGelCasseBienLEchelle = !casse.ajuste;

await page.waitForTimeout(DELAI_RATTRAPAGE);
const rattrape = await mesurer();
console.log('rattrape, boucle arretee   :', JSON.stringify(rattrape));
resultats.rattrapeSansLaBoucle = rattrape.ajuste;

await hauteurHote('100%');
await page.waitForTimeout(DELAI_RATTRAPAGE);
const restaure = await mesurer();
console.log('hote restaure              :', JSON.stringify(restaure));
resultats.revientAlaTailleDorigine = restaure.ajuste && restaure.canvas === '390x693';

// ---- 2. Vrai aller-retour d'arriere-plan, boucle rendue.
await page.evaluate(() => window.__kubb.loop.start(window.__kubb.step.bind(window.__kubb)));
const cdp = await contexte.newCDPSession(page);
await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
await page.setViewportSize({ width: 390, height: 600 });
await page.waitForTimeout(300);
await cdp.send('Page.setWebLifecycleState', { state: 'active' });
await page.setViewportSize({ width: 390, height: 844 });
await focus(page);
await page.waitForTimeout(DELAI_RATTRAPAGE);
const apresVeille = await mesurer();
console.log('apres aller-retour de veille:', JSON.stringify(apresVeille));
resultats.ajusteApresVeille = apresVeille.ajuste;

// ---- 3. Bascule d'orientation : l'autre moment ou iOS rebat la mise en page.
await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(DELAI_RATTRAPAGE);
const paysage = await mesurer();
console.log('en paysage                 :', JSON.stringify(paysage));
resultats.ajusteEnPaysage = paysage.ajuste;

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(DELAI_RATTRAPAGE);
const portrait = await mesurer();
console.log('retour en portrait         :', JSON.stringify(portrait));
resultats.ajusteDeRetourEnPortrait = portrait.ajuste;

console.log('\n', JSON.stringify(resultats, null, 1));
console.log('Erreurs JS :', erreurs);
const ok = Object.values(resultats).every(Boolean) && erreurs.length === 0;
console.log('=== OK:', ok, '===');
await navigateur.close();
process.exitCode = ok ? 0 : 1;
