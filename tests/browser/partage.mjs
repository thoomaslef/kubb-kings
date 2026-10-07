/**
 * Le bouton « Inviter un ami » du menu : partager le lien du jeu.
 *
 * `shareLink.test.ts` verrouille les branches avec des capacites simulees. Ici
 * on verifie la chaine REELLE dans un navigateur : le bouton, ce que le
 * partage natif recoit vraiment, le contenu reel du presse-papiers, et ce
 * qu'affiche le menu dans chaque cas — partage natif (telephone), copie
 * (ordinateur), repli manuel (presse-papiers refuse), partage ferme par le
 * joueur.
 *
 * Le lien partage est TOUJOURS l'adresse nue du jeu : une page ouverte avec
 * `?code=...` ou `#...` (retour de connexion, lien de salon...) ne doit rien
 * fuiter dans ce qu'on envoie a un ami.
 */
import { conclure, lancerNavigateur, surveiller } from './harness.mjs';

const JEU = process.env.KUBB_URL ?? 'http://localhost:5173/';
const navigateur = await lancerNavigateur();
const erreurs = [];
const resultats = {};

/** Un menu neuf, avec les capacites du navigateur reglees par `initScript`. */
async function menu(nom, { initScript, lang = 'fr', suffixe = '', permissions = [] } = {}) {
  const contexte = await navigateur.newContext({ viewport: { width: 420, height: 900 }, permissions });
  if (initScript) await contexte.addInitScript(initScript);
  const page = await contexte.newPage();
  surveiller(nom, page, erreurs);
  await page.goto(JEU);
  await page.evaluate((lang) => {
    localStorage.setItem('kubb-kings.tutorial-done', '1');
    localStorage.setItem('kubb-kings.lang', lang);
  }, lang);
  await page.goto(JEU + suffixe);
  await page.waitForSelector('.panel--menu', { timeout: 30000 });
  return { page, contexte };
}

const bouton = (page, motif) => page.locator('button', { hasText: motif }).first();
const statut = async (page) => (await page.locator('[data-testid="share-status"]').textContent({ timeout: 3000 }).catch(() => null)) ?? null;

// ------------------------------------------------------------ 1. partage natif (telephone), page ouverte avec un parametre
{
  const { page, contexte } = await menu('natif', {
    suffixe: '?code=secret123#frag',
    initScript: () => {
      window.__partages = [];
      navigator.share = async (d) => {
        window.__partages.push(d);
      };
    }
  });
  await bouton(page, /Inviter un ami/).click();
  await page.waitForTimeout(500);
  const recu = await page.evaluate(() => window.__partages);
  console.log({ recu });
  resultats.partageNatif_UnSeulAppel = recu.length === 1;
  resultats.partageNatif_LeLienEstLAdresseNueDuJeu =
    recu[0]?.url === new URL(JEU).origin + new URL(JEU).pathname;
  resultats.partageNatif_AucunParametreNeFuite = !/[?#]|secret123/.test(recu[0]?.url ?? '');
  resultats.partageNatif_TitreEtTexte = /KUBB/.test(recu[0]?.title ?? '') && /Viens jouer/.test(recu[0]?.text ?? '');
  resultats.partageNatif_LeMenuConfirme = /Lien partage/.test((await statut(page)) ?? '');
  await contexte.close();
}

// ------------------------------------------------------------ 2. sans partage natif (ordinateur) : copie
{
  const { page, contexte } = await menu('copie', {
    permissions: ['clipboard-read', 'clipboard-write'],
    initScript: () => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    }
  });
  await bouton(page, /Inviter un ami/).click();
  await page.waitForTimeout(500);
  const presse = await page.evaluate(() => navigator.clipboard.readText());
  resultats.copie_LePresseP_ContientLeLien = presse === new URL(JEU).origin + new URL(JEU).pathname;
  resultats.copie_LeMenuLeDit = /Lien copie/.test((await statut(page)) ?? '');
  await contexte.close();
}

// ------------------------------------------------------------ 3. ni partage ni presse-papiers : le lien s'affiche
{
  const { page, contexte } = await menu('manuel', {
    initScript: () => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    }
  });
  await bouton(page, /Inviter un ami/).click();
  await page.waitForTimeout(500);
  const champ = await page.locator('[data-testid="share-status"] input').inputValue().catch(() => null);
  resultats.manuel_LeLienEstAffichePourEtreCopie = champ === new URL(JEU).origin + new URL(JEU).pathname;
  resultats.manuel_LeChampEstEnLectureSeule = (await page.locator('[data-testid="share-status"] input').getAttribute('readonly')) !== null;
  await contexte.close();
}

// ------------------------------------------------------------ 4. partage ferme par le joueur : aucun message
{
  const { page, contexte } = await menu('annule', {
    permissions: ['clipboard-read', 'clipboard-write'],
    initScript: () => {
      navigator.share = async () => {
        const e = new Error('annule');
        e.name = 'AbortError';
        throw e;
      };
    }
  });
  await page.evaluate(() => navigator.clipboard.writeText('avant'));
  await bouton(page, /Inviter un ami/).click();
  await page.waitForTimeout(600);
  resultats.annule_AucunMessage = (await statut(page)) === null;
  resultats.annule_RienNEstCopie = (await page.evaluate(() => navigator.clipboard.readText())) === 'avant';
  await contexte.close();
}

// ------------------------------------------------------------ 5. en anglais
{
  const { page, contexte } = await menu('anglais', {
    lang: 'en',
    initScript: () => {
      window.__partages = [];
      navigator.share = async (d) => {
        window.__partages.push(d);
      };
    }
  });
  await bouton(page, /Invite a friend/).click();
  await page.waitForTimeout(500);
  const recu = await page.evaluate(() => window.__partages);
  resultats.anglais_LeTexteEstEnAnglais = /Come play/.test(recu[0]?.text ?? '');
  resultats.anglais_LeMenuConfirme = /Link shared/.test((await statut(page)) ?? '');
  await contexte.close();
}

conclure(resultats, erreurs);
await navigateur.close();
