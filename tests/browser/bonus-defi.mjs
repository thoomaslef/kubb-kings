/**
 * Les quatre bonus du mode Defi ajoutes apres les treize premiers :
 * « Poignet souple », « Effet appuye », « Grand renfort », « Pillage », « Trait guide » et « Poigne ferme ».
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

/**
 * Un choc a la vitesse `vitesse` sur le roi (ou sur un kubb de Rouge) : tombe-t-il ?
 * On injecte une collision reelle dans le gestionnaire de la scene, avec un projectile
 * dont la vitesse d'impact est imposee.
 */
async function chocSur(cible, vitesse, perks) {
  await manche(perks);
  await attendreBleue();
  return page.evaluate(
    ({ cible, vitesse }) => {
      const s = window.__kubb.scene.getScene('MatchScene');
      s.activeTeam = 'blue';
      s.launch();
      Object.defineProperty(s.baton, 'impactSpeed', { get: () => vitesse });
      const corps = cible === 'roi' ? s.king.sprite.body : s.teams.red.kubbs[0].sprite.body;
      s.onCollisionStart({ pairs: [{ bodyA: corps, bodyB: s.baton.sprite.body }] });
      return cible === 'roi' ? !s.king.isStanding : !s.teams.red.kubbs[0].isAtBaseline;
    },
    { cible, vitesse }
  );
}

// ----------------------------------------------------------------- Grand renfort
const sans = await kubbsAbattus([]);
const renfort = await kubbsAbattus(['renfort']);
const grand = await kubbsAbattus(['grand-renfort']);

// ----------------------------------------------------------------- Poignet souple / Effet appuye
const base = await geste([], 32);
const souple = await geste(['poignet-souple'], 32);
const appuye = await geste(['effet-appuye'], 32);

// ----------------------------------------------------------------- Pillage : pieces par kubb abattu
/** Fin de manche gagnee avec 5 kubbs abattus : combien de pieces la scene accorde-t-elle ? */
async function piecesGagnees(perks) {
  await manche(perks);
  await attendreBleue();
  return page.evaluate(() => {
    // Aucun succes deja debloque : leurs pieces s'ajouteraient au bareme mesure.
    window.__kubbStoreApi.setState({ unlockedAchievements: [] });
    const s = window.__kubb.scene.getScene('MatchScene');
    s.finish({ winner: 'blue', reason: 'king-down', knockedDown: { blue: 5, red: 0 } }, 100000);
    return window.__kubbStoreApi.getState().lastCoinsAward;
  });
}
const piecesSans = await piecesGagnees([]);
const piecesPillage = await piecesGagnees(['pillage']);
const piecesPillageEtBourse = await piecesGagnees(['pillage', 'bourse-pleine']);

// ----------------------------------------------------------------- Trait guide : la fleche s'affiche avec le bonus
await manche(['trait-guide']);
await attendreBleue();
const traitGuide = await page.evaluate(() => {
  const s = window.__kubb.scene.getScene('MatchScene');
  try {
    s.aimPower = 1;
    s.aimAngle = s.forwardAngle();
    s.isDragging = true;
    s.drawAim();
    return { ok: true, traits: s.aimGfx.commandBuffer.length };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
});

// ----------------------------------------------------------------- Poigne ferme (roi plus difficile a renverser)
const roiSans7 = await chocSur('roi', 7, []);
const roiAvec7 = await chocSur('roi', 7, ['poigne-ferme']);
const roiAvec9 = await chocSur('roi', 9, ['poigne-ferme']);
const kubbAvec65 = await chocSur('kubb', 6.5, ['poigne-ferme']);
const kubbSans65 = await chocSur('kubb', 6.5, []);
console.log({ piecesSans, piecesPillage, piecesPillageEtBourse, traitGuide, sans, renfort, grand, base, souple, appuye, roiSans7, roiAvec7, roiAvec9, kubbAvec65, kubbSans65 });

const resultats = {
  aucunKubbAbattuSansBonus: sans === 0,
  renfortAbatUnKubb: renfort === 1,
  grandRenfortAbatDeuxKubbs: grand === 2,
  geste: base.lu !== 0 && Math.abs(base.lu) < 0.6,
  poignetSoupleAmplifieLEffetLu: Math.abs(souple.lu - Math.min(1, base.lu * 1.5)) < 0.05 && Math.abs(souple.lu) > Math.abs(base.lu),
  sansBonusLEffetDeVolEgaleLEffetLu: Math.abs(base.vol - base.lu) < 1e-6,
  effetAppuyeRenforceLaForce: Math.abs(appuye.vol - appuye.lu * 1.25) < 0.02 && Math.abs(appuye.lu - base.lu) < 0.05,
  poignetSoupleNeChangePasLaForce: Math.abs(souple.vol - souple.lu) < 1e-6,
  // Les pieces de succes (identiques d'une mesure a l'autre) s'ajoutent au bareme : on compare par DIFFERENCE.
  pillageAjouteHuitPiecesParKubb: piecesPillage - piecesSans === 5 * 8,
  // (20 + 5 x 18 + 50) x 1,5 = 240 contre 120 sans bonus : +120.
  pillageSeCumuleAvecBoursePleine: piecesPillageEtBourse - piecesSans === 240 - 120,
  traitGuideDessineLaFleche: traitGuide.ok && traitGuide.traits > 0,
  roiTombeSansPoigneFerme: roiSans7 === true,
  poigneFermeProtegeLeRoiDunChocMoyen: roiAvec7 === false,
  poigneFermeLaisseTomberLeRoiSousUnChocFranc: roiAvec9 === true,
  poigneFermeNeChangeRienPourLesKubbs: kubbAvec65 === kubbSans65 && kubbAvec65 === true};
conclure(resultats, erreurs);
await navigateur.close();
