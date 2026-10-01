/**
 * Le tir d'ouverture ne designe QUE le premier joueur.
 *
 * Les kubbs n'y participent pas : ils ne sont ni affiches, ni presents dans le
 * monde physique tant que dure le tirage. Avant, un baton qui depassait
 * largement le roi pouvait en abattre un a la ligne adverse — rare, mais
 * contraire a la regle, et il donnait un avantage gratuit.
 *
 * Seule verification a couvrir le mode LOCAL (les autres sont toutes en
 * ligne, ou le tir d'ouverture n'existe pas).
 */
import { attendreEcran, conclure, etat, focus, lancer, lancerNavigateur, ouvrirJeu, surveiller } from './harness.mjs';

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 420, height: 900 } });
const erreurs = [];
const resultats = {};
const page = await contexte.newPage();
surveiller('jeu', page, erreurs);
await ouvrirJeu(page);

/** Etat des kubbs vu de la scene : visibilite ET presence dans le monde Matter. */
const kubbs = (p) =>
  p.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    const tous = [...scene.teams.blue.kubbs, ...scene.teams.red.kubbs];
    const corpsDansLeMonde = scene.matter.world.localWorld.bodies;
    return {
      stage: scene.matchStage,
      total: tous.length,
      visibles: tous.filter((k) => k.sprite.visible).length,
      // Un corps retire du monde ne peut etre percute par rien.
      dansLeMonde: tous.filter((k) => k.sprite.body && corpsDansLeMonde.includes(k.sprite.body)).length,
      statuts: tous.map((k) => k.status)
    };
  });

// ---- Partie locale contre l'IA : il y a donc un tir d'ouverture.
await focus(page);
await page.locator('button', { hasText: /Solo/i }).first().click();
await attendreEcran(page, 'match');
await page.waitForTimeout(1200);

const ouverture = await kubbs(page);
console.log('pendant le tir d ouverture :', JSON.stringify(ouverture));
resultats.ouvertureEnCours = ouverture.stage === 'opening';
resultats.aucunKubbVisible = ouverture.visibles === 0;
resultats.aucunKubbDansLeMonde = ouverture.dansLeMonde === 0;
resultats.tousDebout = ouverture.statuts.every((s) => s === 'baseline');

// ---- Un lancer a pleine puissance, droit devant : il traverse tout le
//      terrain et passerait sur la ligne adverse. Rien ne doit tomber.
await page.evaluate(() => {
  const scene = window.__kubb.scene.getScene('MatchScene');
  scene.aimAngle = scene.forwardAngle();
  scene.aimPower = 1;
  scene.launch();
});
for (let i = 0; i < 400; i += 1) {
  const fini = await page.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    return scene.phase !== 'flying' && !scene.baton;
  });
  if (fini) break;
  await page.waitForTimeout(250);
}
const apresLancer = await kubbs(page);
console.log('apres un lancer a fond :', JSON.stringify(apresLancer));
resultats.rienNEstTombe = apresLancer.statuts.every((s) => s === 'baseline');

// ---- On laisse l'ouverture s'achever (l'IA repond) et la partie commencer.
let enMatch = false;
for (let i = 0; i < 400; i += 1) {
  if ((await kubbs(page)).stage === 'match') {
    enMatch = true;
    break;
  }
  await page.waitForTimeout(250);
}
resultats.partieCommencee = enMatch;

await page.waitForTimeout(600);
const match = await kubbs(page);
console.log('une fois la partie commencee :', JSON.stringify(match));
resultats.kubbsRevenus = match.visibles === match.total;
resultats.kubbsDansLeMonde = match.dansLeMonde === match.total;

// ---- Et ils redeviennent abattables : un lancer puissant doit pouvoir faire
//      tomber quelque chose, sinon on aurait « corrige » en les neutralisant.
const avant = (await kubbs(page)).statuts.filter((s) => s !== 'baseline').length;
let tombes = avant;
for (let essai = 0; essai < 4 && tombes === avant; essai += 1) {
  if (!(await lancer(page, 1))) break;
  tombes = (await kubbs(page)).statuts.filter((s) => s !== 'baseline').length;
  // L'IA joue entre deux lancers du joueur : on attend de reprendre la main.
  await page.waitForTimeout(500);
}
console.log('kubbs sortis de leur ligne apres quelques lancers :', tombes);
resultats.redeviennentAbattables = tombes > avant;

const fin = await etat(page);
resultats.toujoursEnPartie = fin.screen === 'match' || fin.screen === 'result';

conclure(resultats, erreurs);
await navigateur.close();
