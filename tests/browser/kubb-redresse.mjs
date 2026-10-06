/**
 * Un kubb redresse par la recompense du ricochet revient en demi-taille.
 *
 * La recompense existait deja (MatchScene::reviveLeftmostKubb : abattre un
 * kubb adverse avec un tir qui a ricoche sur une bande redresse un de ses
 * propres kubbs tombes). Elle rend maintenant ce kubb deux fois plus petit,
 * donc plus difficile a reabattre.
 *
 * Ce qui doit etre verifie dans un VRAI navigateur, et que rien d'autre ne
 * peut voir :
 *
 *   - la reduction porte sur le CORPS MATTER, pas seulement sur l'image.
 *     Une reduction purement visuelle mentirait au joueur : il viserait un
 *     petit bloc avec la hitbox d'un grand. Ce defaut a bien eu lieu, a
 *     l'envers — `setScale` sur une image Matter redimensionne aussi le
 *     corps, et reduire en plus la forme donnait 9 px de cote au lieu de 18.
 *   - elle n'est pas cumulative : un kubb deja reduit, abattu puis redresse
 *     a nouveau, reste a la meme taille. Sinon il deviendrait intouchable et
 *     la manche pourrait ne plus se terminer.
 *   - elle ne s'applique pas sous la regle "Kubbs de champ", qui fait deja
 *     revenir des kubbs en jeu.
 */
import { attendreEcran, lancerDepuisLeMenu, lancerNavigateur, surveiller } from './harness.mjs';

const BASE = process.env.KUBB_URL ?? 'http://localhost:4173/kubb-kings/';
/** Cote normal d'un kubb (rules.ts::HITBOX.kubb). */
const COTE_NORMAL = 36;
/** Cote attendu apres redressement (rules.ts::REVIVED_KUBB_SCALE = 0.5). */
const COTE_REDUIT = 18;

const navigateur = await lancerNavigateur();
const erreurs = [];

/**
 * Une page NEUVE par scenario. Reutiliser la precedente remesurait le kubb
 * deja reduit du scenario d'avant, et le reglage de regle n'atteignait meme
 * pas la scene : le premier jet de cette verification s'y est fait prendre.
 */
async function scenario(regleKubbsDeChamp) {
  const page = await navigateur.newPage({ viewport: { width: 420, height: 900 } });
  surveiller(`champ=${regleKubbsDeChamp}`, page, erreurs);
  await page.goto(BASE);
  await page.waitForFunction(() => window.__kubbStoreApi?.getState().screen === 'menu', null, { timeout: 30000 });
  await page.evaluate((v) => window.__kubbStoreApi.getState().setFieldKubbsEnabled(v), regleKubbsDeChamp);
  // 1v1 LOCAL et non Solo : il n'y a plus de tir d'ouverture pour geler le
  // plateau, donc en Solo l'IA peut commencer et percuter le kubb qu'on mesure.
  // La regle testee (taille d'un kubb redresse) ne depend pas du mode.
  await lancerDepuisLeMenu(page, /1v1 local/i);
  await attendreEcran(page, 'match');
  await page.waitForTimeout(1500);

  /** Cote REEL du corps physique, lu dans Matter — pas une valeur declaree. */
  const mesurer = () =>
    page.evaluate(() => {
      const scene = window.__kubb.scene.getScene('MatchScene');
      const kubb = scene.teams.blue.kubbs[0];
      const b = kubb.sprite.body.bounds;
      return {
        coteCorps: Math.round(b.max.x - b.min.x),
        echelleSprite: Number(kubb.sprite.scaleX.toFixed(2)),
        regleChamp: scene.fieldKubbsEnabled
      };
    });

  /** Abat le kubb, puis declenche la recompense du ricochet. */
  const abattrePuisRedresser = async () => {
    await page.evaluate(() => {
      const scene = window.__kubb.scene.getScene('MatchScene');
      scene.teams.blue.kubbs[0].knockDown(scene);
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__kubb.scene.getScene('MatchScene').reviveLeftmostKubb('blue'));
    await page.waitForTimeout(500);
    return mesurer();
  };

  const depart = await mesurer();
  const premier = await abattrePuisRedresser();
  const second = await abattrePuisRedresser();

  console.log(`\n--- regle "Kubbs de champ" = ${regleKubbsDeChamp} (vue par la scene : ${depart.regleChamp}) ---`);
  console.log('  au depart        :', JSON.stringify(depart));
  console.log('  1er redressement :', JSON.stringify(premier));
  console.log('  2e redressement  :', JSON.stringify(second));
  await page.close();
  return { depart, premier, second };
}

const classique = await scenario(false);
const avecKubbsDeChamp = await scenario(true);

const resultats = {
  // Si la regle n'atteint pas la scene, les deux scenarios testent la meme chose.
  regleBienTransmiseALaScene: classique.depart.regleChamp === false && avecKubbsDeChamp.depart.regleChamp === true,
  tailleNormaleAuDepart: classique.depart.coteCorps === COTE_NORMAL && classique.depart.echelleSprite === 1,
  corpsReellementDivisePar2: classique.premier.coteCorps === COTE_REDUIT,
  imageDivisePar2: classique.premier.echelleSprite === 0.5,
  reductionNonCumulative: classique.second.coteCorps === COTE_REDUIT && classique.second.echelleSprite === 0.5,
  intacteSousLaRegleKubbsDeChamp:
    avecKubbsDeChamp.premier.coteCorps === COTE_NORMAL &&
    avecKubbsDeChamp.second.coteCorps === COTE_NORMAL &&
    avecKubbsDeChamp.premier.echelleSprite === 1
};

console.log('\n', JSON.stringify(resultats, null, 1));
console.log('Erreurs JS :', erreurs);
const ok = Object.values(resultats).every(Boolean) && erreurs.length === 0;
console.log('=== OK:', ok, '===');
await navigateur.close();
process.exitCode = ok ? 0 : 1;
