/**
 * Ecran des regles : court, a jour (30 s par lancer, rebond pour le roi), sans « Revoir le tutoriel ».
 */
import { conclure, lancerNavigateur, ouvrirJeu, surveiller } from './harness.mjs';

const navigateur = await lancerNavigateur();
const page = await navigateur.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [];
const resultats = {};
surveiller('regles', page, erreurs);
await ouvrirJeu(page);
await page.locator('button', { hasText: /^Regles$/ }).click();
await page.waitForTimeout(300);
const items = await page.locator('.rules-list li').allTextContents();
const texte = items.join(' ');
resultats.regles_huitPoints = items.length === 8;
resultats.regles_courtes = texte.length < 1300;
resultats.regles_30sParCoup = /30 secondes/.test(texte);
resultats.regles_roiParRebond = /rebond/.test(texte);
resultats.regles_plusDeChronoGeneral = !/4 minutes/.test(texte);
resultats.regles_pasDeRevoirLeTutoriel = (await page.locator('button', { hasText: /tutoriel/i }).count()) === 0;
resultats.regles_boutonRetour = (await page.locator('button', { hasText: /^Retour$/ }).count()) === 1;
console.log({ longueur: texte.length });
await navigateur.close();
conclure(resultats, erreurs);
