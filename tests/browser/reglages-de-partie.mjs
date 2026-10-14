/**
 * Vent et kubbs de champ se reglent sur l'ecran du terrain, pour toute partie qu'on choisit
 * (solo, 1v1, 2v2, tournoi, ami) — et NON pour la recherche classee, qui tire terrain et vent au hasard
 * et ne joue jamais les kubbs de champ.
 */
import { attendreEcran, conclure, lancerNavigateur, ouvrirJeu, ouvrirUnHub, rejoindreSalon, surveiller } from './harness.mjs';

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const erreurs = [];
const resultats = {};
const hote = await contexte.newPage();
const invite = await contexte.newPage();
surveiller('hote', hote, erreurs);
surveiller('invite', invite, erreurs);
await ouvrirJeu(hote);
await ouvrirJeu(invite);

const options = (page) => page.locator('[data-testid="game-options"]');
const activer = async (page) => {
  await options(page).locator('.segmented').nth(0).locator('.segmented__item').nth(1).click();
  await options(page).locator('.segmented').nth(1).locator('.segmented__item').nth(1).click();
};

// Le menu n'a plus ces reglages.
resultats.menu_pasDeReglagesEnVrac = (await hote.locator('.segmented').count()) === 0;

// Chaque mode choisi passe par un ecran du terrain qui les propose.
for (const [mode, motif] of [['solo', /Solo/], ['1v1', /1v1/], ['2v2', /2v2/], ['tournoi', /Tournoi/]]) {
  await ouvrirUnHub(hote, 'local');
  await hote.locator('button', { hasText: motif }).first().click();
  await hote.waitForSelector('.map-grid');
  resultats[`${mode}_reglagesProposes`] = (await options(hote).locator('.segmented').count()) === 2;
  await hote.evaluate(() => window.__kubbStoreApi.getState().setScreen('menu'));
}

// Solo : le vent choisi est bien celui de la partie.
await ouvrirUnHub(hote, 'local');
await hote.locator('button', { hasText: /Solo/ }).first().click();
await hote.waitForSelector('.map-grid');
await activer(hote);
await hote.locator('.map-actions .btn--primary').first().click();
await attendreEcran(hote, 'match');
await hote.waitForTimeout(1200);
const solo = await hote.evaluate(() => {
  const s = window.__kubb.scene.getScene('MatchScene');
  return { vent: !!s.wind, champ: s.fieldKubbsEnabled };
});
resultats.solo_ventEtKubbsDeChampAppliques = solo.vent === true && solo.champ === true;
await hote.evaluate(() => window.__kubbStoreApi.getState().setScreen('menu'));
await hote.reload();
await hote.waitForFunction(() => window.__kubbStoreApi?.getState().screen === 'menu', null, { timeout: 30000 });

// Entre amis : l'hote regle, l'invite joue la meme chose.
await ouvrirUnHub(hote, 'online');
await hote.locator('button', { hasText: /Jouer avec un ami/ }).click();
await hote.waitForSelector('.map-grid');
await activer(hote);
await hote.locator('.map-actions .btn--primary').first().click();
await hote.waitForTimeout(600);
await hote.locator('button', { hasText: /Creer une partie/i }).first().click();
await hote.waitForTimeout(600);
const code = await hote.evaluate(() => window.__kubbStoreApi.getState().online?.roomCode);
await rejoindreSalon(invite, code);
await attendreEcran(hote, 'match', 120);
await hote.waitForTimeout(1500);
const lire = (page) =>
  page.evaluate(() => {
    const s = window.__kubb.scene.getScene('MatchScene');
    return { vent: s.wind ?? null, champ: s.fieldKubbsEnabled, preset: s.fieldPreset, classee: !!window.__kubbStoreApi.getState().online?.ranked };
  });
const h = await lire(hote);
const i = await lire(invite);
console.log({ h, i });
resultats.amis_ventPourLesDeux = !!h.vent && !!i.vent && h.vent.direction === i.vent.direction && h.vent.force === i.vent.force;
resultats.amis_kubbsDeChampPourLesDeux = h.champ === true && i.champ === true;
resultats.amis_memeTerrain = h.preset === i.preset;
resultats.amis_pasClassee = !h.classee && !i.classee;

await navigateur.close();
conclure(resultats, erreurs);
