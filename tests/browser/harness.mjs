import { chromium } from 'playwright-core';

/**
 * Socle commun des verifications au navigateur.
 *
 * Ces verifications-la ne remplacent pas les tests unitaires (`npm test`) :
 * elles couvrent ce qu'aucun module pur ne peut couvrir — la physique Matter
 * reelle, l'enchainement des scenes Phaser, et surtout DEUX joueurs qui
 * s'echangent une partie. Elles sont lentes (plusieurs minutes) et demandent
 * un vrai Chromium, elles ne tournent donc pas dans la CI ; on les lance a la
 * main avant de toucher au jeu en ligne ou aux regles.
 *
 * Pilotage : le jeu expose `window.__kubb` (la partie Phaser) et
 * `window.__kubbStoreApi` (le store) en developpement, ou dans un build
 * marque `VITE_EXPOSE_TEST_HANDLE=1`. Tester le BUILD plutot que le serveur
 * de dev est preferable : c'est le seul moyen de verifier ce qui est
 * reellement livre (cf. README).
 */

/** Chromium a utiliser. A defaut, celui de l'atelier. */
const EXEC = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Adresse du jeu : serveur de dev par defaut, `vite preview` sinon. */
export const URL = process.env.KUBB_URL ?? 'http://localhost:5173/';

/**
 * Chromium ralentit tres fortement une page qui n'est pas au premier plan, et
 * ces drapeaux n'y suffisent pas : c'est `focus()` ci-dessous qui rend une
 * page pleinement vive. Sans cela, un `delayedCall` de 750 ms de temps de JEU
 * peut sembler ne jamais arriver.
 */
export async function lancerNavigateur() {
  return chromium.launch({
    executablePath: EXEC,
    args: [
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });
}

/** Rend une page vive avant de l'observer ou de la piloter. */
export const focus = (page) => page.bringToFront();

/** Ouvre le jeu, tutoriel passe et langue fixee, pour partir d'un etat connu. */
export async function ouvrirJeu(page, { xp = 0 } = {}) {
  await page.goto(URL);
  await page.evaluate((xp) => {
    localStorage.setItem('kubb-kings.tutorial-done', '1');
    localStorage.setItem('kubb-kings.lang', 'fr');
    localStorage.removeItem('kubb-kings.achievements.unlocked');
    localStorage.removeItem('kubb-kings.online-streak');
    if (xp > 0) {
      localStorage.setItem(
        'kubb-kings.progression',
        JSON.stringify({ totalXp: xp, winStreak: 0, gamesPlayed: 20, totalWins: 15 })
      );
    } else {
      localStorage.removeItem('kubb-kings.progression');
    }
  }, xp);
  await page.reload();
  await page.waitForTimeout(1000);
  const pret = await page.evaluate(() => !!window.__kubbStoreApi);
  if (!pret) {
    throw new Error(
      `Poignee de pilotage absente sur ${URL}. Lancer le serveur de dev, ou construire avec VITE_EXPOSE_TEST_HANDLE=1 puis "npm run preview".`
    );
  }
}

/** Etat courant, cote store ET cote scene de match. */
export const etat = (page) =>
  page.evaluate(() => {
    const s = window.__kubbStoreApi.getState();
    const scene = window.__kubb?.scene?.getScene?.('MatchScene');
    const vivante = scene && scene.scene.isActive();
    return {
      screen: s.screen,
      mode: s.mode,
      profileTeam: s.profileTeam,
      online: s.online,
      succes: s.unlockedAchievements,
      serie: s.onlineWinStreak,
      resultat: s.result,
      activeTeam: vivante ? scene.activeTeam : null,
      phase: vivante ? scene.phase : null,
      coups: vivante ? scene.record.throws.length : null,
      setup: vivante ? scene.record.setup : null,
      batonEnMain: vivante ? scene.batonId : null,
      kubbs: vivante
        ? { blue: scene.teams.blue.kubbs.map((k) => k.status), red: scene.teams.red.kubbs.map((k) => k.status) }
        : null,
      throwsLeft: vivante ? { ...scene.throwsLeft } : null,
      titre: document.querySelector('.panel__title')?.textContent ?? null,
      texte: document.querySelector('.panel__text')?.textContent ?? null,
      notes: [...document.querySelectorAll('.footnote')].map((n) => n.textContent),
      boutons: [...document.querySelectorAll('.button-column button')].map((b) => b.textContent)
    };
  });

/**
 * Joue un lancer et attend la fin du vol.
 *
 * `surLeRoi` vise le centre : toucher le roi avant d'avoir degage les kubbs
 * adverses fait PERDRE son auteur — c'est le moyen le plus court de terminer
 * une partie, et de choisir qui gagne.
 */
export async function lancer(page, power, { surLeRoi = false } = {}) {
  await focus(page);
  await page.evaluate(
    ({ power, surLeRoi }) => {
      const scene = window.__kubb.scene.getScene('MatchScene');
      scene.throwX[scene.activeTeam] = surLeRoi ? 360 : 120;
      scene.aimAngle = scene.forwardAngle();
      scene.aimPower = power;
      scene.launch();
    },
    { power, surLeRoi }
  );
  for (let i = 0; i < 400; i += 1) {
    const fini = await page.evaluate(() => {
      const scene = window.__kubb?.scene?.getScene?.('MatchScene');
      return !scene || !scene.scene.isActive() || (scene.phase !== 'flying' && !scene.baton);
    });
    if (fini) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

/** Coups deja inscrits dans l'enregistrement de cette page ; -1 hors match. */
export const coups = (page) =>
  page.evaluate(() => {
    const scene = window.__kubb?.scene?.getScene?.('MatchScene');
    return scene && scene.scene.isActive() ? scene.record.throws.length : -1;
  });

/**
 * Attend qu'une page ait RECU et applique `n` coups. Indispensable entre deux
 * lancers de camps differents : faire jouer le second pendant que son camp
 * rejoue encore le coup du premier envoie un mauvais numero d'ordre, et
 * desynchronise la partie.
 */
export async function attendreCoups(page, n) {
  await focus(page);
  for (let i = 0; i < 400; i += 1) {
    if ((await coups(page)) >= n) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

/** Attend un ecran donne, page au premier plan. */
export async function attendreEcran(page, ecran, tours = 300) {
  await focus(page);
  for (let i = 0; i < tours; i += 1) {
    if ((await page.evaluate(() => window.__kubbStoreApi.getState().screen)) === ecran) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

/** Cree un salon en ligne et renvoie son code. */
export async function creerSalon(page) {
  await focus(page);
  await page.locator('button', { hasText: /En ligne/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator('button', { hasText: /Creer une partie/i }).first().click();
  await page.waitForTimeout(600);
  const code = (await etat(page)).online?.roomCode;
  if (!code) throw new Error("Le salon ne s'est pas ouvert (service en ligne injoignable ?)");
  return code;
}

/** Rejoint un salon par son code et attend d'etre en match. */
export async function rejoindreSalon(page, code) {
  await focus(page);
  await page.locator('button', { hasText: /En ligne/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator('input').first().fill(code);
  await page.locator('button', { hasText: /^Rejoindre$/i }).first().click();
  return attendreEcran(page, 'match', 120);
}

/** Collecte les erreurs JS d'une page : une verification verte avec une exception ne vaut rien. */
export function surveiller(nom, page, erreurs) {
  page.on('pageerror', (e) => {
    erreurs.push(`${nom}: ${e.message}`);
    console.log(`[erreur ${nom}]`, e.message);
  });
}

/** Affiche le bilan et fixe le code de sortie. */
export function conclure(resultats, erreurs) {
  console.log('\n', JSON.stringify(resultats, null, 1));
  console.log('Erreurs JS :', erreurs);
  const ok = Object.values(resultats).every(Boolean) && erreurs.length === 0;
  console.log('=== OK:', ok, '===');
  process.exitCode = ok ? 0 : 1;
  return ok;
}
