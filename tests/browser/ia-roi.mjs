/**
 * L'IA ne renverse jamais le roi tant qu'il est protege — sous la VRAIE
 * physique.
 *
 * Toucher le roi avant d'avoir degage les kubbs adverses fait perdre
 * sur-le-champ, et rien dans la scene ne protege l'IA de cette faute : sa
 * seule sauvegarde est le controle `curvedKingDanger` de `ai.ts`.
 *
 * Pourquoi cette verification doit exister EN NAVIGATEUR : ce controle
 * simule la trajectoire avec `simulateWindFlight`, qui est le modele de
 * l'IA — pas Matter, qui fait tourner le jeu. Une simulation headless
 * compare donc le modele a lui-meme et se donne raison toute seule. Seule
 * une vraie partie, avec les vrais rebonds, dit si la marge de securite
 * tient (cf. ai.ts::KING_STILL_SAFETY_MARGIN).
 *
 * Elle est devenue necessaire quand cette marge a ete abaissee de 60 a
 * 28 px par temps calme : la marge "vent" appliquee sans vent faisait
 * renoncer l'IA a 44 % de ses tirs, et rendait le kubb CENTRAL
 * inatteignable — il survivait dans 200 manches sur 200.
 */
import { attendreEcran, attendreSonTour, lancerDepuisLeMenu, lancerNavigateur, ouvrirJeu, surveiller } from './harness.mjs';

/** Parties jouees par niveau. Chacune donne jusqu'a 12 tours d'IA. */
const PARTIES = Number(process.env.PARTIES ?? 2);
const NIVEAUX = ['facile', 'moyen', 'difficile'];

const navigateur = await lancerNavigateur();
const erreurs = [];
const page = await navigateur.newPage({ viewport: { width: 420, height: 900 } });
surveiller('jeu', page, erreurs);

/** Etat du roi et des kubbs, vu de la scene. */
const plateau = () =>
  page.evaluate(() => {
    const s = window.__kubb?.scene?.getScene?.('MatchScene');
    if (!s || !s.scene.isActive()) return null;
    return {
      roiDebout: s.king.isStanding,
      bleusDebout: s.teams.blue.standingCount,
      rougesDebout: s.teams.red.standingCount,
      equipeActive: s.activeTeam,
      phase: s.phase
    };
  });

let toursIA = 0;
let suicides = 0;
let roisLegitimes = 0;

for (const niveau of NIVEAUX) {
  for (let partie = 0; partie < PARTIES; partie += 1) {
    await ouvrirJeu(page);
    await page.evaluate((n) => {
      window.__kubbStoreApi.getState().setDifficulty(n);
      // Sans vent : c'est precisement le regime dont la marge a ete abaissee.
      window.__kubbStoreApi.getState().setWindEnabled(false);
    }, niveau);
    await lancerDepuisLeMenu(page, /Solo/i);
    await attendreEcran(page, 'match');
    await page.waitForTimeout(1200);

    // Echantillonnage continu plutot que pilotage par phases. Deux pieges
    // evites : en solo `attendreSonTour` du socle renvoie vrai des que la
    // phase est 'aiming' SANS regarder qui a la main, et le tour de l'IA
    // porte la phase 'ai-aiming', jamais 'aiming' — une attente sur
    // 'aiming' ne le voyait donc jamais passer.
    let precedent = await plateau();
    let lancersBleus = 0;
    // L'IA peut desormais COMMENCER (tirage au sort) : son premier tour n'est
    // pas precede d'un passage de main, on le compte donc des le depart.
    if (precedent?.equipeActive === 'red') toursIA += 1;

    for (let tick = 0; tick < 420; tick += 1) {
      const ecran = await page.evaluate(() => window.__kubbStoreApi.getState().screen);
      if (ecran !== 'match') break;
      const vu = await plateau();
      if (!vu) break;

      // Le roi vient-il de tomber ? C'est la seule chose qu'on surveille.
      if (precedent && precedent.roiDebout && !vu.roiDebout) {
        const auteur = precedent.equipeActive;
        // Chaque equipe vise les kubbs de l'AUTRE : le roi ne lui est legal
        // que lorsque l'autre n'a plus rien debout.
        const restantsChezLaCible = auteur === 'red' ? precedent.bleusDebout : precedent.rougesDebout;
        if (auteur === 'red') {
          if (restantsChezLaCible > 0) {
            suicides += 1;
            console.log(`  SUICIDE — ${niveau}, partie ${partie + 1} : roi renverse par l'IA avec ${restantsChezLaCible} kubbs adverses debout`);
          } else {
            roisLegitimes += 1;
          }
        }
        break;
      }

      // Un tour d'IA commence des que la main lui passe. Compte ici, hors de
      // toute branche : place dans un `else if`, il ne s'evaluait jamais au
      // bon echantillon et restait a zero alors que l'IA jouait bel et bien.
      if (precedent && precedent.equipeActive !== 'red' && vu.equipeActive === 'red') toursIA += 1;

      // Tour de Bleue : on le gache volontairement pour laisser jouer l'IA.
      if (vu.equipeActive === 'blue' && vu.phase === 'aiming') {
        await page.evaluate(() => {
          const s = window.__kubb.scene.getScene('MatchScene');
          s.throwX.blue = 120;
          s.aimAngle = s.forwardAngle();
          s.aimPower = 0.32; // trop court pour atteindre la ligne
          s.launch();
        });
        lancersBleus += 1;
        await page.waitForTimeout(900);
      }

      precedent = vu;
      await page.waitForTimeout(260);
    }
    console.log(`     (lancers bleus gaches : ${lancersBleus})`);

    const fin = await page.evaluate(() => window.__kubbStoreApi.getState().screen);
    console.log(`  ${niveau} / partie ${partie + 1} : ${toursIA} tours d'IA cumules, ecran final "${fin}"`);
  }
}

const resultats = {
  // Sans tours d'IA observes, la verification ne prouve rien.
  // Sans un echantillon suffisant, "zero suicide" ne prouve rien : une
  // partie qui se termine tot donnerait un vert trompeur.
  assezDeToursObserves: toursIA >= 30,
  aucunSuicide: suicides === 0
};
console.log(`\ntours d'IA observes : ${toursIA} | rois renverses legitimement : ${roisLegitimes} | SUICIDES : ${suicides}`);
console.log('\n', JSON.stringify(resultats, null, 1));
console.log('Erreurs JS :', erreurs);
const ok = Object.values(resultats).every(Boolean) && erreurs.length === 0;
console.log('=== OK:', ok, '===');
await navigateur.close();
process.exitCode = ok ? 0 : 1;
