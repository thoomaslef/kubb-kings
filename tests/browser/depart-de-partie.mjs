/**
 * La partie COMMENCE, sans tir d'ouverture — et on sait qui joue en premier.
 *
 * Le tir d'ouverture a ete retire : chaque camp approchait le roi sans le
 * toucher, le plus pres commencait. Il n'existait de toute facon qu'hors
 * ligne (en ligne, l'hote tirait deja au sort). Un tirage au sort
 * (rules.ts::drawStartingTeam) le remplace dans TOUS les modes.
 *
 * Ce que cette verification prouve, et qu'aucun test unitaire ne peut voir :
 *   - la partie demarre directement en partie, kubbs affiches ET presents dans
 *     le monde physique (ils etaient retires le temps de l'ouverture) ;
 *   - le tirage est branche au depart : si le sort donne Rouge, Rouge joue en
 *     premier — y compris l'IA, qui doit alors lancer d'elle-meme ;
 *   - le premier lancer compte : il peut abattre un kubb (c'etait interdit
 *     pendant l'ouverture, ou rien ne pouvait tomber) ;
 *   - le tirage est enregistre dans la partie (`setup.startingTeam`) ;
 *   - le succes « Froleur », qui ne se gagnait qu'a l'ouverture, se gagne
 *     maintenant en partie — et seulement si l'on n'a pas touche le roi.
 *
 * Le hasard est FORCE (`Math.random` pilote) : un tirage reel donnerait un
 * resultat different a chaque passage, et deux departs ne prouveraient rien
 * sur l'autre issue du tirage.
 *
 * Il est force dans une MOITIE de l'intervalle, pas a une valeur constante. La
 * premiere version renvoyait 0,1 pour tout : Phaser tire les cles uniques de
 * ses textures de `Math.random` (Utils.String.UUID), la seconde cle d'un texte
 * entrait alors en collision avec la premiere, `TextureManager.addCanvas`
 * renvoyait `null` et la scene levait « Cannot read properties of null
 * (reading 'context') » en plein `beginMatch` — avant `syncHud` et avant le
 * premier tour de l'IA. Ce n'etait pas un defaut du jeu, et c'est la coherence
 * entre la scene (« Rouge ») et le HUD (« Bleue ») qui l'a trahi.
 */
import {
  attendreEcran,
  conclure,
  lancerDepuisLeMenu,
  lancerNavigateur,
  ouvrirJeu,
  surveiller
} from './harness.mjs';

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 420, height: 900 } });
const erreurs = [];
const resultats = {};

/**
 * Ouvre une partie dont le tirage au sort est impose.
 * `camp` = 'blue' force le tirage dans [0 ; 0,5[, 'red' dans [0,5 ; 1[
 * (cf. drawStartingTeam : sous 0,5 Bleue, sinon Rouge).
 */
async function demarrer(motifMode, camp) {
  const page = await contexte.newPage();
  surveiller(`depart(${camp})`, page, erreurs);
  // Installe AVANT tout script de la page, et ne touche au hasard que tant
  // qu'on le demande : le reste du jeu garde son vrai `Math.random`.
  await page.addInitScript(() => {
    const vrai = Math.random.bind(Math);
    window.__moitie = null;
    Math.random = () => {
      const v = vrai();
      return window.__moitie === 'blue' ? v * 0.5 : window.__moitie === 'red' ? 0.5 + v * 0.5 : v;
    };
  });
  await ouvrirJeu(page);
  await page.evaluate((c) => (window.__moitie = c), camp);
  await lancerDepuisLeMenu(page, motifMode);
  if (!(await attendreEcran(page, 'match'))) throw new Error('La partie ne s est pas lancee.');
  // Le tirage a eu lieu a la creation de la scene : on rend le vrai hasard.
  await page.evaluate(() => (window.__moitie = null));
  await page.waitForTimeout(1200);
  return page;
}

/** Kubbs vus de la scene : visibilite ET presence dans le monde Matter. */
const kubbs = (page) =>
  page.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    const tous = [...scene.teams.blue.kubbs, ...scene.teams.red.kubbs];
    const dansLeMonde = scene.matter.world.localWorld.bodies;
    return {
      total: tous.length,
      visibles: tous.filter((k) => k.sprite.visible).length,
      // Un corps retire du monde ne peut etre percute par rien.
      presents: tous.filter((k) => k.sprite.body && dansLeMonde.includes(k.sprite.body)).length,
      statuts: tous.map((k) => k.status)
    };
  });

const depart = (page) =>
  page.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    const hud = window.__kubbStoreApi.getState().hud;
    return {
      equipe: scene.activeTeam,
      equipeAuHud: hud.activeTeam,
      enregistre: scene.record.setup.startingTeam,
      phase: scene.phase,
      bandeau: document.body.innerText.toLowerCase().includes('ouverture')
    };
  });

// =================================================== 1. Le sort donne Bleue
{
  const page = await demarrer(/1v1/i, 'blue');
  const d = await depart(page);
  const k = await kubbs(page);
  console.log('sort = Bleue :', JSON.stringify(d), JSON.stringify({ visibles: k.visibles, presents: k.presents }));

  resultats.bleueCommence = d.equipe === 'blue';
  resultats.leHudAnnonceBleue = d.equipeAuHud === 'blue';
  resultats.lePremierJoueurEstEnregistre = d.enregistre === 'blue';
  resultats.enPhaseDeVisee = d.phase === 'aiming';
  resultats.plusAucunTexteDOuverture = d.bandeau === false;
  resultats.kubbsTousAffiches = k.visibles === k.total;
  // Avant, ils etaient retires du monde le temps de l'ouverture.
  resultats.kubbsTousPresentsDansLeMonde = k.presents === k.total;

  // Le premier lancer COMPTE : droit sur le premier kubb adverse, deviation
  // aleatoire neutralisee (lancer impose) pour que ce ne soit pas un coup de
  // de. Pendant l'ouverture, rien ne pouvait tomber.
  await page.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    const entree = {
      throwX: 120,
      angle: scene.forwardAngle(),
      power: 0.8,
      spin: 0,
      batonId: 'base',
      roll: { deviationRad: 0, spinSign: 1 }
    };
    // `launch(imposee)` ne lit PAS l'angle et la puissance dans l'objet
    // impose : elle prend ceux de la scene. C'est `playRemoteThrow` qui les y
    // pose avant de l'appeler, et il faut donc faire de meme. La premiere
    // version passait seulement l'objet : le baton partait a puissance zero
    // et n'abattait rien, ce qui ressemblait fort a un defaut du jeu.
    scene.throwX[scene.activeTeam] = entree.throwX;
    scene.throwerSprites[scene.activeTeam].x = entree.throwX;
    scene.aimAngle = entree.angle;
    scene.aimPower = entree.power;
    scene.launch(entree);
  });
  for (let i = 0; i < 160; i += 1) {
    const fini = await page.evaluate(() => {
      const scene = window.__kubb.scene.getScene('MatchScene');
      return scene.phase !== 'flying' && !scene.baton;
    });
    if (fini) break;
    await page.waitForTimeout(250);
  }
  const apres = await page.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    return {
      rouges: scene.teams.red.kubbs.map((x) => x.status),
      actif: scene.activeTeam,
      lancersBleus: scene.throwsLeft.blue,
      enregistres: scene.record.throws.length
    };
  });
  console.log('apres le 1er lancer :', JSON.stringify(apres));
  resultats.lePremierLancerPeutAbattreUnKubb = apres.rouges.some((s) => s !== 'baseline');
  resultats.lePremierLancerEstCompte = apres.lancersBleus === 11 && apres.enregistres === 1;
  resultats.lamainPasseAAdversaire = apres.actif === 'red';

  // ---- « Froleur » : desormais en partie.
  const froleur = await page.evaluate(() => {
    const scene = window.__kubb.scene.getScene('MatchScene');
    const essai = (equipe, touche, dx) => {
      scene.achievementsEarnedThisMatch.delete('frolement');
      scene.activeTeam = equipe;
      scene.kingTouchedThisThrow = touche;
      scene.resolveGrazeAchievement({ x: 360 + dx, y: 640 });
      const gagne = scene.achievementsEarnedThisMatch.has('frolement');
      scene.achievementsEarnedThisMatch.delete('frolement');
      return gagne;
    };
    return {
      pres: essai('blue', false, 45),
      tropLoin: essai('blue', false, 90),
      apresUnContact: essai('blue', true, 45),
      pourLAdversaire: essai('red', false, 45)
    };
  });
  console.log('Froleur :', JSON.stringify(froleur));
  resultats.froleurSeGagneEnPartie = froleur.pres === true;
  resultats.froleurExigeDEtrePres = froleur.tropLoin === false;
  resultats.froleurExigeDeNePasAvoirTouche = froleur.apresUnContact === false;
  resultats.froleurNeCompteQuePourLeJoueur = froleur.pourLAdversaire === false;
  await page.close();
}

// ==================================================== 2. Le sort donne Rouge
{
  const page = await demarrer(/1v1/i, 'red');
  const d = await depart(page);
  const k = await kubbs(page);
  console.log('sort = Rouge :', JSON.stringify(d), JSON.stringify({ visibles: k.visibles, presents: k.presents }));
  resultats.rougeCommenceSiLeSortLeDesigne = d.equipe === 'red';
  resultats.leHudAnnonceRouge = d.equipeAuHud === 'red';
  resultats.rougeEstEnregistre = d.enregistre === 'red';
  resultats.kubbsPresentsAussiQuandRougeCommence = k.presents === k.total && k.visibles === k.total;
  await page.close();
}

// ===================================== 3. Solo : l'IA commence et lance seule
{
  const page = await demarrer(/Solo/i, 'red');
  const d0 = await depart(page);
  console.log('solo, sort = Rouge :', JSON.stringify(d0));
  resultats.enSoloLIACommence = d0.equipe === 'red' && d0.enregistre === 'red';

  // L'IA doit jouer SANS qu'on la sollicite — c'est le chemin « l'IA commence »,
  // jamais exerce tant que le tir d'ouverture existait (elle ne commencait que
  // si elle avait gagne le tirage, et sur un chemin different).
  let lancerIA = null;
  for (let i = 0; i < 100; i += 1) {
    lancerIA = await page.evaluate(() => {
      const scene = window.__kubb.scene.getScene('MatchScene');
      const l = scene.record.throws.find((t) => t.team === 'red');
      return l ? { equipe: l.team, effet: l.input.spin, seq: l.seq } : null;
    });
    if (lancerIA) break;
    await page.waitForTimeout(500);
  }
  console.log('premier lancer de l IA :', JSON.stringify(lancerIA));
  resultats.lIALanceSeuleAuDepart = lancerIA?.seq === 0;
  resultats.lIATireDroit = lancerIA?.effet === 0;

  // ... puis la main revient au joueur.
  let aLaMain = false;
  for (let i = 0; i < 100; i += 1) {
    aLaMain = await page.evaluate(() => {
      const scene = window.__kubb.scene.getScene('MatchScene');
      return scene.activeTeam === 'blue' && scene.phase === 'aiming';
    });
    if (aLaMain) break;
    await page.waitForTimeout(500);
  }
  resultats.lAMainRevientAuJoueur = aLaMain;
  await page.close();
}

conclure(resultats, erreurs);
await navigateur.close();
