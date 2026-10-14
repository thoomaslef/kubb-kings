/**
 * Terrain Boue : moins collant qu'avant, et la bande fait glisser le projectile.
 *
 * Mesure, dans un vrai navigateur et sur un vrai lancer visant le mur de
 * gauche : la friction de l'air du corps Matter AVANT et APRES le contact avec
 * la bande, et la restitution du rebond. Sur Boue, la friction doit
 * tomber nettement apres le mur (le projectile glisse) ; sur Classique, elle ne
 * doit PAS bouger (la glisse est propre a Boue).
 */
import { attendreSonTour, conclure, lancerDepuisLeMenu, lancerNavigateur, ouvrirJeu, surveiller } from './harness.mjs';

const navigateur = await lancerNavigateur();
const erreurs = [];
const resultats = {};

async function mesurer(terrain) {
  const contexte = await navigateur.newContext({ viewport: { width: 420, height: 900 }, locale: 'fr-FR' });
  const page = await contexte.newPage();
  surveiller(terrain, page, erreurs);
  await ouvrirJeu(page);
  await page.evaluate((t) => {
    const api = window.__kubbStoreApi;
    api.setState({ ownedItems: [...api.getState().ownedItems, 'terrain-boue'] });
    api.getState().setFieldPreset(t);
    api.getState().setWindEnabled(false);
  }, terrain);
  await lancerDepuisLeMenu(page, /1v1/i);
  await attendreSonTour(page);
  const releve = await page.evaluate(async () => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    scene.throwX[scene.activeTeam] = 300;
    // 70 degres vers la gauche : le baton va frapper la bande de gauche.
    scene.aimAngle = scene.forwardAngle() - (70 * Math.PI) / 180;
    scene.aimPower = 0.75;
    scene.aimSpin = 0;
    // Un releve PAR IMAGE du jeu (pas un minuteur : sous charge, un setTimeout laisse passer le mur
    // entre deux mesures et le premier releve peut deja le montrer touche).
    const points = [];
    const noter = () => {
      const b = scene.baton;
      if (b) points.push({ mur: scene.bouncedWallThisThrow, fa: b.sprite.body.frictionAir, v: b.speed, rest: b.sprite.body.restitution, preset: scene.fieldPreset });
    };
    scene.events.on('update', noter);
    scene.launch();
    noter();
    const debut = Date.now();
    while (Date.now() - debut < 3500 && !(points.length > 12 && !scene.baton)) await new Promise((r) => setTimeout(r, 50));
    scene.events.off('update', noter);
    return points;
  });
  await contexte.close();
  const i = releve.findIndex((p) => p.mur);
  return {
    preset: releve[0]?.preset,
    toucheLeMur: i > 0,
    // Le plus fort freinage releve AVANT le mur (le tout premier releve peut preceder l'application du terrain).
    frictionAvant: i > 0 ? Math.max(...releve.slice(0, i).map((p) => p.fa)) : null,
    frictionApres: i > 0 ? releve[Math.min(releve.length - 1, i + 2)].fa : null,
    restitution: releve[0]?.rest ?? null
  };
}

const boue = await mesurer('boue');
const classique = await mesurer('classique');
console.log({ boue, classique });

resultats.boue_leTerrainEstBienBoue = boue.preset === 'boue';
resultats.boue_leMurEstTouche = boue.toucheLeMur;
// La friction tombe a 0,35 / 1,25 = 28 % de sa valeur : on exige au moins une division par 3.
resultats.boue_apresLeMurLeProjectileGlisse = boue.frictionApres < boue.frictionAvant / 3;
// Avant le mur, la boue freine (friction plus forte qu'un terrain normal).
resultats.boue_avantLeMurElleFreine = boue.frictionAvant > classique.frictionAvant;
// Le rebond n'est plus mort : la restitution du corps Matter (deterministe, contrairement a une
// vitesse echantillonnee a 30 ms) reste d'au moins la moitie de celle d'un terrain normal.
resultats.boue_leReboundGardeDeLaVie = boue.restitution >= classique.restitution * 0.5 && boue.restitution < classique.restitution;
resultats.classique_aucuneGlisseApresLeMur = classique.toucheLeMur && Math.abs(classique.frictionApres - classique.frictionAvant) < 1e-9;

conclure(resultats, erreurs);
await navigateur.close();
