/**
 * Page Options : la langue n'est plus au menu, elle se change ici, avec un drapeau par langue.
 */
import { conclure, lancerNavigateur, ouvrirJeu, surveiller } from './harness.mjs';

const navigateur = await lancerNavigateur();
const page = await navigateur.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
const resultats = {};
surveiller('options', page, erreurs);
await ouvrirJeu(page);

const ecran = () => page.evaluate(() => window.__kubbStoreApi.getState().screen);
const langue = () => page.evaluate(() => window.__kubbStoreApi.getState().lang);

resultats.menu_aUnBoutonOptions = (await page.locator('button', { hasText: /^Options$/ }).count()) === 1;
resultats.menu_plusDeChoixDeLangue = (await page.locator('button', { hasText: /Français|English/ }).count()) === 0;

await page.locator('button', { hasText: /^Options$/ }).click();
await page.waitForTimeout(300);
resultats.options_ecran = (await ecran()) === 'options';
const texte = await page.evaluate(() => document.querySelector('.segmented')?.textContent ?? '');
resultats.options_drapeaux = texte.includes('🇫🇷') && texte.includes('🇬🇧');
resultats.options_deuxLangues = /Français/.test(texte) && /English/.test(texte);

await page.locator('.segmented__item', { hasText: /English/ }).click();
await page.waitForTimeout(300);
resultats.options_changeLaLangue = (await langue()) === 'en';
resultats.options_titreTraduit = (await page.locator('.panel__title').textContent()) === 'Options';
resultats.options_lAutreBoutonEstActif = (await page.locator('.segmented__item--on').textContent())?.includes('English');

await page.locator('button', { hasText: /^Back$/ }).click();
await page.waitForTimeout(300);
resultats.retourAuMenu = (await ecran()) === 'menu';
resultats.menuEnAnglais = (await page.locator('button', { hasText: /Play offline/ }).count()) === 1;

await navigateur.close();
conclure(resultats, erreurs);
