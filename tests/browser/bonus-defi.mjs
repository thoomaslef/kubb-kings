/**
 * Les quatre bonus du mode Defi ajoutes apres les treize premiers :
 * « Poignet souple », « Effet appuye », « Elan » et « Grand renfort ».
 *
 * Les tests unitaires ne voient pas ces bonus : ils vivent dans la scene
 * (MatchScene) et lisent le store au demarrage de la manche. Cette
 * verification demarre une VRAIE manche de Defi, pose les bonus dans le store
 * puis relance la scene — la meme chose que « Sursis » fait pour rejouer une
 * manche — et lit ce que la scene en a fait.
 *
 * Les gestes sont pilotes a la souris, comme dans effet.mjs : poser
 * `aimSpin` a la main testerait la moitie qu'on veut justement verifier.
 */
import { attendreEcran, conclure, focus, lancerNavigateur, ouvrirJeu, surveiller } from './harness.mjs';

const DESIGN = { width: 720, height: 1280 };
const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const erreurs = [];
const page = await contexte.newPage();
surveiller('bonus-defi', page, erreurs);

await ouvrirJeu(page);
// Le Defi n'a pas d'ecran de choix du terrain : le terrain vient de l'echelle.
await page.locator('button', { hasText: /d[eé]fi|challenge/i }).first().click();
if (!(await attendreEcran(page, 'match'))) throw new Error("La manche de Defi ne s'est pas lancee.");
await page.waitForTimeout(1200);
await focus(page);

/** Relance la manche avec exactement ces bonus. */
async function manche(perks) {
  await page.evaluate((perks) => {
    const api = window.__kubbStoreApi;
    const run = api.getState().run;
    api.setState({ run: { ...run, perks } });
    window.__kubb.scene.getScene('MatchScene').scene.restart();
  }, perks);
  await page.waitForTimeout(1500);
  await focus(page);
}

/** Attend que ce soit a Bleue (le joueur) de viser : Rouge, l'IA, peut commencer. */
async function attendreBleue() {
  for (let i = 0; i < 160; i += 1) {
    const ok = await page.evaluate(() => {
      const s = window.__kubb.scene.getScene('MatchScene');
      return s.scene.isActive() && s.activeTeam === 'blue' && s.phase === 'aiming' && !s.baton;
    });
    if (ok) return;
    await page.waitForTimeout(250);
  }
  throw new Error("Bleue n'a jamais eu la main.");
}

const rect = await page.evaluate(() => {
  const c = document.querySelector('canvas').getBoundingClientRect();
  return { left: c.left, top: c.top, width: c.width, height: c.height };
});
const ecran = (x, y) => ({ x: rect.left + (x / DESIGN.width) * rect.width, y: rect.top + (y / DESIGN.height) * rect.height });

/** Glisse en arc (fleche > 0 : bombe a gauche), s'arrete AVANT de relacher. */
async function glisser(fleche) {
  const depart = { x: 360, y: 1080 };
  const arrivee = { x: 360, y: 700 };
  const dx = arrivee.x - depart.x;
  const dy = arrivee.y - depart.y;
  const longueur = Math.hypot(dx, dy);
  const nx = -dy / longueur;
  const ny = dx / longueur;
  const p0 = ecran(depart.x, depart.y);
  await page.mouse.move(p0.x, p0.y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i += 1) {
    const t = i / 14;
    const e = fleche * 4 * t * (1 - t);
    const p = ecran(depart.x + dx * t + nx * e, depart.y + dy * t + ny * e);
    await page.mouse.move(p.x, p.y);
  }
}

/** Un geste, avec les bonus donnes : effet lu au bout du doigt, puis effet de vol. */
async function geste(perks, fleche) {
  await manche(perks);
  await attendreBleue();
  await glisser(fleche);
  const lu = await page.evaluate(() => window.__kubb.scene.getScene('MatchScene').aimSpin);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const vol = await page.evaluate(() => window.__kubb.scene.getScene('MatchScene').flightSpin);
  return { lu, vol };
}

/** Nombre de kubbs adverses (Rouge) deja hors jeu au debut de la manche. */
async function kubbsAbattus(perks) {
  await manche(perks);
  return page.evaluate(() =>
    window.__kubb.scene.getScene('MatchScene').teams.red.kubbs.filter((k) => !k.isInPlay).length
  );
}

/** Un lancer qui renverse `n` kubbs : le compte de lancers de Bleue baisse-t-il ? */
async function lancersApres(perks, n) {
  await manche(perks);
  await attendreBleue();
  return page.evaluate((n) => {
    const s = window.__kubb.scene.getScene('MatchScene');
    const avant = s.throwsLeft.blue;
    s.phase = 'flying';
    s.knockedThisThrow = n > 0;
    s.knockedThisThrowCount = n;
    s.resolveEndOfThrow();
    return { avant, apres: s.throwsLeft.blue };
  }, n);
}

// ----------------------------------------------------------------- Grand renfort
const sans = await kubbsAbattus([]);
const renfort = await kubbsAbattus(['renfort']);
const grand = await kubbsAbattus(['grand-renfort']);

// ----------------------------------------------------------------- Poignet souple / Effet appuye
const base = await geste([], 32);
const souple = await geste(['poignet-souple'], 32);
const appuye = await geste(['effet-appuye'], 32);

// ----------------------------------------------------------------- Elan
const deuxSans = await lancersApres([], 2);
const unAvec = await lancersApres(['elan'], 1);
const deuxAvec = await lancersApres(['elan'], 2);
const deuxFois = await page.evaluate(() => {
  // Deuxieme double dans la MEME manche que deuxAvec (aucune relance entre les deux) :
  // cette fois, le lancer compte.
  const s = window.__kubb.scene.getScene('MatchScene');
  s.activeTeam = 'blue';
  const avant = s.throwsLeft.blue;
  s.phase = 'flying';
  s.knockedThisThrow = true;
  s.knockedThisThrowCount = 2;
  s.resolveEndOfThrow();
  return { avant, apres: s.throwsLeft.blue };
});
console.log({ sans, renfort, grand, base, souple, appuye, deuxSans, deuxAvec, unAvec });

const resultats = {
  aucunKubbAbattuSansBonus: sans === 0,
  renfortAbatUnKubb: renfort === 1,
  grandRenfortAbatDeuxKubbs: grand === 2,
  geste: base.lu !== 0 && Math.abs(base.lu) < 0.6,
  poignetSoupleAmplifieLEffetLu: Math.abs(souple.lu - Math.min(1, base.lu * 1.5)) < 0.05 && Math.abs(souple.lu) > Math.abs(base.lu),
  sansBonusLEffetDeVolEgaleLEffetLu: Math.abs(base.vol - base.lu) < 1e-6,
  effetAppuyeRenforceLaForce: Math.abs(appuye.vol - appuye.lu * 1.25) < 0.02 && Math.abs(appuye.lu - base.lu) < 0.05,
  poignetSoupleNeChangePasLaForce: Math.abs(souple.vol - souple.lu) < 1e-6,
  doubleCompteSansElan: deuxSans.apres === deuxSans.avant - 1,
  elanRembourseUnDouble: deuxAvec.apres === deuxAvec.avant,
  elanIgnoreUnSimpleCoup: unAvec.apres === unAvec.avant - 1,
  elanNeServQuUneFois: deuxFois.apres === deuxFois.avant - 1
};
conclure(resultats, erreurs);
await navigateur.close();
