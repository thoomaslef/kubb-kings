/**
 * Ecran Apparence : skins des kubbs / du roi / du baton et effet de lancer ne sont plus sur le menu.
 */
import { conclure, lancerNavigateur, ouvrirJeu, surveiller } from './harness.mjs';

const navigateur = await lancerNavigateur();
const page = await navigateur.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
const resultats = {};
surveiller('apparence', page, erreurs);
await ouvrirJeu(page);
await page.evaluate(() => localStorage.setItem('kubb-kings.shop.owned', JSON.stringify(['skin-marbre'])));
await page.reload();
await page.waitForFunction(() => window.__kubbStoreApi?.getState().screen === 'menu', null, { timeout: 30000 });

const ecran = () => page.evaluate(() => window.__kubbStoreApi.getState().screen);
const nbGroupes = () => page.locator('.segmented').count();

const groupesMenu = await nbGroupes();
resultats.menu_plusAucunReglage = groupesMenu === 0; // vent et kubbs de champ sont sur l'ecran du terrain
resultats.menu_aLeBoutonApparence = (await page.locator('button', { hasText: /^Apparence$/ }).count()) === 1;

await page.locator('button', { hasText: /^Apparence$/ }).click();
await page.waitForTimeout(300);
resultats.apparence_ecran = (await ecran()) === 'appearance';
resultats.apparence_quatreChoix = (await nbGroupes()) === 4;

const avant = await page.evaluate(() => window.__kubbStoreApi.getState().kubbSkin);
const libres = await page.locator('.segmented').first().locator('.segmented__item').count();
resultats.apparence_lesSkinsPossedesSontProposes = libres >= 2;
await page.locator('.segmented').first().locator('.segmented__item').nth(1).click();
const apres = await page.evaluate(() => window.__kubbStoreApi.getState().kubbSkin);
resultats.apparence_changeLeSkin = avant !== apres;

await page.locator('button', { hasText: /^Retour$/ }).click();
await page.waitForTimeout(300);
resultats.retourAuMenu = (await ecran()) === 'menu';
resultats.leChoixEstConserve = (await page.evaluate(() => window.__kubbStoreApi.getState().kubbSkin)) === apres;

await navigateur.close();
conclure(resultats, erreurs);
