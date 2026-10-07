/**
 * La recherche rapide : deux joueurs qui cherchent se retrouvent, un joueur
 * seul tombe sur un bot en difficile au bout d'une minute.
 *
 * Les tests unitaires (`matchmaking.test.ts`) couvrent la file a la seconde
 * pres avec une horloge simulee. Ils ne disent rien de la chaine reelle : le
 * bouton, le vrai canal entre deux pages, le salon qui s'ouvre des deux
 * cotes, et surtout le repli sur le bot avec la VRAIE minute. Cette
 * verification-ci attend donc reellement une minute pour le bot.
 *
 * Elle tourne sur le transport local (deux pages du MEME contexte, canal
 * BroadcastChannel) : c'est le meme code que sur Supabase, seul le tuyau
 * change.
 */
import { attendreEcran, conclure, etat, focus, lancerNavigateur, ouvrirJeu, passerLeChoixDuTerrain, surveiller } from './harness.mjs';

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 420, height: 900 } });
const erreurs = [];
const resultats = {};

/** Menu -> En ligne -> choix du terrain -> salon, puis « Partie rapide ». */
async function chercher(page) {
  await focus(page);
  await page.locator('button', { hasText: /En ligne/i }).first().click();
  await passerLeChoixDuTerrain(page);
  await page.locator('button', { hasText: /Partie rapide/i }).first().click();
}

async function nouvellePage(nom) {
  const page = await contexte.newPage();
  surveiller(nom, page, erreurs);
  await ouvrirJeu(page);
  return page;
}

// ---------------------------------------------------------------- 1. deux joueurs se trouvent
{
  const a = await nouvellePage('a');
  const b = await nouvellePage('b');
  await chercher(a);
  const ecranRecherche = await etat(a);
  resultats.ecranDeRecherche = /Recherche/i.test(ecranRecherche.titre ?? '');
  await chercher(b);

  const enMatchA = await attendreEcran(a, 'match', 160);
  const enMatchB = await attendreEcran(b, 'match', 160);
  const ea = await a.evaluate(() => {
    const s = window.__kubbStoreApi.getState();
    return { mode: s.mode, team: s.profileTeam, code: s.online?.roomCode, override: s.difficultyOverride };
  });
  const eb = await b.evaluate(() => {
    const s = window.__kubbStoreApi.getState();
    return { mode: s.mode, team: s.profileTeam, code: s.online?.roomCode, override: s.difficultyOverride };
  });
  console.log({ ea, eb });
  resultats.lesDeuxEntrentEnMatch = enMatchA && enMatchB;
  resultats.partieEnLigne = ea.mode === 'online' && eb.mode === 'online';
  resultats.campsOpposes = new Set([ea.team, eb.team]).size === 2;
  resultats.memeSalon = !!ea.code && ea.code === eb.code;
  resultats.pasDeBotEntreHumains = ea.override === null && eb.override === null;
  // Adversaire tire au sort : pas de tchat (du texte libre non modere avec un inconnu).
  const bulles = (await a.locator('.chat-bulle').count()) + (await b.locator('.chat-bulle').count());
  resultats.pasDeTchatContreUnInconnu = bulles === 0;
  await a.close();
  await b.close();
}

// ---------------------------------------------------------------- 2. annuler quitte vraiment la file
{
  const a = await nouvellePage('c');
  await chercher(a);
  await a.locator('button', { hasText: /Annuler/i }).first().click();
  await a.waitForTimeout(500);

  const b = await nouvellePage('d');
  await chercher(b);
  // Si A etait reste en file, B serait couple en quelques secondes.
  await b.waitForTimeout(9000);
  const eb = await etat(b);
  resultats.annulerLibereLaFile = eb.screen === 'online' && /Recherche/i.test(eb.titre ?? '');
  await a.close();
  await b.close();
}

// ---------------------------------------------------------------- 3. seul : un bot en difficile apres 1 minute
{
  const a = await nouvellePage('e');
  const t0 = Date.now();
  await chercher(a);
  await a.waitForTimeout(30_000);
  const aMiParcours = await etat(a);
  resultats.pasDeBotAvantLaMinute = aMiParcours.screen === 'online';

  const enMatch = await attendreEcran(a, 'match', 220);
  const duree = (Date.now() - t0) / 1000;
  await a.waitForTimeout(1500);
  const bot = await a.evaluate(() => {
    const s = window.__kubbStoreApi.getState();
    const scene = window.__kubb.scene.getScene('MatchScene');
    return {
      mode: s.mode,
      team: s.profileTeam,
      override: s.override ?? s.difficultyOverride,
      menu: s.difficulty,
      ia: scene.ai ? { aimErrorDeg: scene.ai.aimErrorDeg, thinkMs: scene.ai.thinkMs } : null,
      enLigne: s.online
    };
  });
  console.log({ duree, bot });
  resultats.leBotArriveApresUneMinute = enMatch && duree >= 58 && duree < 85;
  resultats.partieSoloContreLIA = bot.mode === 'solo' && bot.enLigne === null && bot.team === 'blue';
  resultats.leBotJoueEnDifficile = bot.override === 'difficile' && bot.ia?.aimErrorDeg === 2.8;
  resultats.leChoixDuMenuEstIntact = bot.menu === 'moyen';
  await a.close();
}

conclure(resultats, erreurs);
await navigateur.close();
