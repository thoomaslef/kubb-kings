/**
 * Les comptes joueurs, de bout en bout, contre un FAUX Supabase.
 *
 * Le vrai service n'est pas joignable depuis l'atelier, et le tester en vrai
 * demanderait des comptes jetables sur le projet de production. On fait donc
 * mieux que de mocker nos propres fonctions : on construit le jeu avec une
 * URL de service factice (cf. `npm run test:comptes`), et on intercepte les
 * requetes HTTP que le VRAI SDK Supabase emet. Ce qui est verifie, c'est donc
 * la chaine complete — formulaire, SDK, requetes reelles, fusion, stockage —
 * sauf le serveur lui-meme, ecrit ici avec les memes regles que
 * `supabase/comptes.sql` (revision optimiste, lecture de son seul profil).
 *
 * Deux « appareils » sont deux contextes de navigateur : chacun son stockage
 * local, un serveur commun. C'est ce qui permet de prouver ce que le compte
 * promet : retrouver sa progression ailleurs, sans que deux appareils
 * s'ecrasent.
 *
 * Verifie :
 *   - un mot de passe trop court, deux mots de passe differents : refuses avant l'envoi ;
 *   - la creation d'un compte, puis la progression de l'appareil envoyee au serveur ;
 *   - un deuxieme appareil vierge qui retrouve tout (aussi dans SON stockage) ;
 *   - un mauvais mot de passe, une adresse deja prise, trop de tentatives, un service injoignable ;
 *   - une progression jouee sur l'appareil B qui arrive sur l'appareil A ;
 *   - deux appareils qui jouent EN MEME TEMPS : rien n'est perdu (revision optimiste) ;
 *   - un appareil qui a deja une histoire face a un compte qui a la sienne : le joueur choisit
 *     (fusion, ou garder le compte, ou garder l'appareil) ;
 *   - deconnexion (la progression reste), reconnexion sans question ;
 *   - confirmation d'e-mail exigee par le service : le jeu l'explique ;
 *   - suppression du compte.
 */
import { conclure, lancerNavigateur, surveiller, focus } from './harness.mjs';

const JEU = process.env.KUBB_URL ?? 'http://localhost:4174/kubb-kings/';
const FAUX = 'fake.supabase.test';

// ------------------------------------------------------------------ le faux serveur

/** Colonnes de rang tirees du profil, avec la meme coherence minimale que supabase/comptes.sql::save_profile. */
function colonnesRang(data) {
  const r = (data && data.rank) || {};
  const index = Math.min(17, Math.max(0, Math.floor(Number(r.index)) || 0));
  const peak = Math.min(17, Math.max(0, Math.floor(Number(r.peak)) || 0));
  const wins = Math.max(0, Math.floor(Number(r.wins)) || 0);
  const losses = Math.max(0, Math.floor(Number(r.losses)) || 0);
  return index <= wins && peak <= wins && peak >= index ? { index, peak, wins, losses } : null;
}
const rangVide = { index: 0, peak: 0, wins: 0, losses: 0 };

function classement(idMoi) {
  const lignes = [...serveur.profils.entries()]
    .filter(([, p]) => p.visible !== false && p.pseudo && p.r.wins + p.r.losses > 0)
    .sort(([ia, a], [ib, b]) => b.r.index - a.r.index || b.r.peak - a.r.peak || b.r.wins - a.r.wins || (ia < ib ? -1 : 1));
  return lignes.map(([id, p], i) => ({
    place: i + 1,
    pseudo: p.pseudo,
    rank_index: p.r.index,
    rank_peak: p.r.peak,
    wins: p.r.wins,
    losses: p.r.losses,
    is_me: id === idMoi
  }));
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub, exp) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp })}.sig`;

const serveur = {
  users: new Map(), // email -> { id, password }
  tokens: new Map(), // access/refresh -> id
  profils: new Map(), // id -> { data, revision }
  confirmerEmail: false,
  limiter: false,
  signalements: [], // { par, pseudo, motif }
  signalementRefus: null, // code d'erreur a renvoyer
  recoveries: new Map(), // code -> email (le lien « mot de passe oublie » recu par e-mail)
  oauthEchec: false,
  setPseudoAbsent: false,
  delaiPseudo: 1500,
  journal: [],
  suivant: 1
};

function session(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = jwt(user.id, exp);
  const refresh = `r-${user.id}-${serveur.suivant++}`;
  serveur.tokens.set(access, user.id);
  serveur.tokens.set(refresh, user.id);
  return {
    access_token: access,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: refresh,
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      identities: [{ id: user.id, provider: 'email' }],
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: new Date().toISOString()
    }
  };
}

const idDuJeton = (req) => serveur.tokens.get((req.headers()['authorization'] ?? '').replace(/^Bearer /i, ''));

async function repondre(route, status, corps) {
  const req = route.request();
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': req.headers()['access-control-request-headers'] ?? '*',
      'access-control-allow-methods': '*'
    },
    body: corps === undefined ? '' : JSON.stringify(corps)
  });
}

async function gerer(route) {
  const req = route.request();
  const url = new URL(req.url());
  const chemin = url.pathname;
  if (req.method() === 'OPTIONS') return repondre(route, 204);
  let corps = {};
  try {
    corps = req.postDataJSON() ?? {};
  } catch {
    /* pas de corps */
  }
  serveur.journal.push(`${req.method()} ${chemin}${url.search}`);

  // Connexion Google (PKCE) : le navigateur est envoye a /authorize, qui le renvoie sur le jeu avec un code
  // a usage unique — ou une erreur, si le joueur annule chez Google.
  if (chemin === '/auth/v1/authorize') {
    const retour = url.searchParams.get('redirect_to');
    const cible = serveur.oauthEchec
      ? `${retour}?error=access_denied&error_code=access_denied&error_description=Annule`
      : `${retour}?code=gcode-${serveur.suivant++}`;
    return route.fulfill({ status: 302, headers: { location: cible }, body: '' });
  }
  if (chemin === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
    if (!corps.auth_code || !corps.code_verifier) {
      return repondre(route, 400, { code: 400, error_code: 'validation_failed', msg: 'pkce' });
    }
    if (String(corps.auth_code).startsWith('rcode-')) {
      const cible = serveur.users.get(serveur.recoveries.get(corps.auth_code));
      return cible ? repondre(route, 200, session(cible)) : repondre(route, 400, { code: 400, error_code: 'validation_failed', msg: 'code' });
    }
    let user = serveur.users.get('google@example.com');
    if (!user) {
      user = { id: `u-${serveur.suivant++}`, email: 'google@example.com', password: null };
      serveur.users.set(user.email, user);
    }
    return repondre(route, 200, session(user));
  }

  if (chemin === '/auth/v1/signup') {
    if (serveur.limiter) return repondre(route, 429, { code: 429, error_code: 'over_request_rate_limit', msg: 'rate limit' });
    if (serveur.users.has(corps.email)) {
      return repondre(route, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
    }
    const user = { id: `u-${serveur.suivant++}`, email: corps.email, password: corps.password };
    serveur.users.set(corps.email, user);
    if (serveur.confirmerEmail) {
      const s = session(user);
      return repondre(route, 200, { ...s.user }); // utilisateur sans session
    }
    return repondre(route, 200, session(user));
  }
  if (chemin === '/auth/v1/token') {
    const type = url.searchParams.get('grant_type');
    if (type === 'password') {
      const user = serveur.users.get(corps.email);
      if (!user || user.password !== corps.password) {
        return repondre(route, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      return repondre(route, 200, session(user));
    }
    if (type === 'refresh_token') {
      const id = serveur.tokens.get(corps.refresh_token);
      const user = [...serveur.users.values()].find((u) => u.id === id);
      return user ? repondre(route, 200, session(user)) : repondre(route, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'x' });
    }
  }
  if (chemin === '/auth/v1/logout') return repondre(route, 204);
  if (chemin === '/auth/v1/recover') {
    // Jamais de difference entre une adresse connue et une inconnue.
    return repondre(route, 200, {});
  }
  if (chemin === '/auth/v1/user' && req.method() === 'PUT') {
    const id = idDuJeton(req);
    const user = [...serveur.users.values()].find((u) => u.id === id);
    if (!user) return repondre(route, 401, { code: 401, msg: 'jwt' });
    if (corps.password === user.password) return repondre(route, 422, { code: 422, error_code: 'same_password', msg: 'New password should be different from the old password.' });
    user.password = corps.password;
    return repondre(route, 200, session(user).user);
  }
  if (chemin === '/auth/v1/user') {
    const id = idDuJeton(req);
    const user = [...serveur.users.values()].find((u) => u.id === id);
    return user ? repondre(route, 200, session(user).user) : repondre(route, 401, { code: 401, msg: 'jwt' });
  }

  if (chemin === '/rest/v1/rpc/get_leaderboard') {
    // Lisible sans compte (cle anonyme) ; `is_me` n'est vrai que pour un joueur connecte.
    return repondre(route, 200, classement(idDuJeton(req)).slice(0, Math.min(100, corps.p_limit ?? 20)));
  }

  if (chemin.startsWith('/rest/v1/rpc/')) {
    const id = idDuJeton(req);
    if (!id) return repondre(route, 401, { code: 'PGRST301', message: 'JWT invalide' });
    const nom = chemin.split('/').pop();
    if (nom === 'load_profile') {
      const p = serveur.profils.get(id);
      return repondre(route, 200, p ? [{ data: p.data, revision: p.revision }] : []);
    }
    if (nom === 'save_profile') {
      const courant = serveur.profils.get(id);
      const attendu = corps.p_expected_revision;
      const rang = colonnesRang(corps.p_data);
      if (!courant) {
        if (attendu !== 0) return repondre(route, 200, -1);
        serveur.profils.set(id, {
          data: corps.p_data,
          revision: 1,
          pseudo: `Pseudo${serveur.suivant++}`,
          visible: true,
          r: rang ?? { ...rangVide }
        });
        return repondre(route, 200, 1);
      }
      if (courant.revision !== attendu) return repondre(route, 200, -1);
      serveur.profils.set(id, {
        ...courant,
        data: corps.p_data,
        revision: courant.revision + 1,
        pseudo: courant.pseudo ?? `Pseudo${serveur.suivant++}`,
        r: rang ?? courant.r
      });
      return repondre(route, 200, courant.revision + 1);
    }
    if (nom === 'my_standing') {
      const p = serveur.profils.get(id);
      if (!p) return repondre(route, 200, []);
      const c = classement(id);
      const moi = c.find((l) => l.is_me);
      return repondre(route, 200, [{ pseudo: p.pseudo, visible: p.visible !== false, place: moi?.place ?? null, total: c.length }]);
    }
    if (nom === 'reroll_pseudo') {
      const p = serveur.profils.get(id);
      if (!p) return repondre(route, 200, null);
      p.pseudo = `Nouveau${serveur.suivant++}`;
      return repondre(route, 200, p.pseudo);
    }
    if (nom === 'set_pseudo') {
      // Le faux serveur applique les memes REGLES que comptes.sql (verifiees par tests/sql/comptes-sql.mjs) :
      // ici on ne teste que ce que le client en fait.
      if (serveur.setPseudoAbsent) {
        return repondre(route, 404, { code: 'PGRST202', message: 'Could not find the function public.set_pseudo(p_pseudo) in the schema cache' });
      }
      const p = serveur.profils.get(id);
      if (!p) return repondre(route, 200, { ok: false, error: 'not-ready' });
      const v = String(corps.p_pseudo ?? '').trim();
      if (/merde/i.test(v)) return repondre(route, 200, { ok: false, error: 'forbidden' });
      const pris = [...serveur.profils.entries()].some(([k, q]) => k !== id && (q.pseudo ?? '').toLowerCase() === v.toLowerCase());
      if (pris) return repondre(route, 200, { ok: false, error: 'taken' });
      if (p.pseudoChange && Date.now() - p.pseudoChange < serveur.delaiPseudo) return repondre(route, 200, { ok: false, error: 'too-soon' });
      p.pseudo = v;
      p.pseudoChange = Date.now();
      return repondre(route, 200, { ok: true, pseudo: v });
    }
    if (nom === 'report_player') {
      if (serveur.signalementRefus) return repondre(route, 200, { ok: false, error: serveur.signalementRefus });
      serveur.signalements.push({ par: id, pseudo: corps.p_pseudo, motif: corps.p_reason });
      return repondre(route, 200, { ok: true, moderated: false });
    }
    if (nom === 'delete_my_account') {
      for (const [email, u] of serveur.users) if (u.id === id) serveur.users.delete(email);
      serveur.profils.delete(id);
      return repondre(route, 204);
    }
  }
  return repondre(route, 404, { message: `non gere : ${chemin}` });
}

// ------------------------------------------------------------------ les appareils

const navigateur = await lancerNavigateur();
const erreurs = [];
const resultats = {};

/** Un appareil : son propre contexte (donc son propre stockage), reli au faux serveur. */
async function appareil(nom, stockage = {}) {
  const contexte = await navigateur.newContext({ viewport: { width: 420, height: 900 } });
  await contexte.route(new RegExp(FAUX.replace(/\./g, '\\.')), gerer);
  const page = await contexte.newPage();
  surveiller(nom, page, erreurs);
  await page.goto(JEU);
  await page.evaluate((stockage) => {
    localStorage.setItem('kubb-kings.tutorial-done', '1');
    localStorage.setItem('kubb-kings.lang', 'fr');
    for (const [k, v] of Object.entries(stockage)) localStorage.setItem(k, JSON.stringify(v));
  }, stockage);
  await page.reload();
  await page.waitForSelector('.panel--menu', { timeout: 30000 });
  return { page, contexte };
}

const etat = (page) =>
  page.evaluate(() => {
    const s = window.__kubbStoreApi.getState();
    return {
      compte: s.account,
      conflit: !!s.accountConflict,
      xp: s.progression.totalXp,
      coins: s.coins,
      owned: s.ownedItems,
      succes: s.unlockedAchievements,
      rang: s.rank,
      stockage: {
        prog: JSON.parse(localStorage.getItem('kubb-kings.progression') ?? 'null'),
        coins: JSON.parse(localStorage.getItem('kubb-kings.currency') ?? 'null'),
        owned: JSON.parse(localStorage.getItem('kubb-kings.shop.owned') ?? 'null')
      }
    };
  });

async function ouvrirCompte(page) {
  await focus(page);
  // Deja sur l'ecran Compte (apres une connexion, on y reste) : rien a ouvrir.
  if ((await page.locator('.btn--account').count()) > 0) await page.locator('.btn--account').click();
  await page.waitForSelector('.panel__title');
}

async function remplir(page, { email, mdp, confirmation }) {
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').first().fill(mdp);
  if (confirmation !== undefined) await page.locator('input[type="password"]').nth(1).fill(confirmation);
}

const message = (page) => page.locator('[data-testid="account-message"]').textContent({ timeout: 4000 }).catch(() => null);

async function attendre(page, condition, arg, delai = 20000) {
  try {
    await page.waitForFunction(condition, arg, { timeout: delai });
    return true;
  } catch {
    return false;
  }
}

const PROGRESSION_A = {
  'kubb-kings.progression': { totalXp: 1500, winStreak: 1, gamesPlayed: 30, totalWins: 18 },
  'kubb-kings.currency': { coins: 340 },
  'kubb-kings.shop.owned': ['skin-or'],
  'kubb-kings.achievements.unlocked': ['froleur'],
  'kubb-kings.rank': { index: 7, wins: 9, losses: 5, peak: 8 }
};

// ------------------------------------------------------------------ 1. creation d'un compte, appareil A
const A = await appareil('A', PROGRESSION_A);
{
  const menu = await A.page.locator('.btn--account').textContent();
  resultats.menuProposeDeSeConnecter = /Se connecter/.test(menu ?? '');

  await ouvrirCompte(A.page);
  await A.page.locator('button', { hasText: /^Creer un compte$/ }).click();
  await remplir(A.page, { email: 'joueur@example.com', mdp: 'court', confirmation: 'court' });
  await A.page.locator('button[type="submit"]').click();
  resultats.motDePasseTropCourtRefuse = /8 caracteres/.test((await message(A.page)) ?? '');

  await remplir(A.page, { email: 'joueur@example.com', mdp: 'motdepasse1', confirmation: 'motdepasse2' });
  await A.page.locator('button[type="submit"]').click();
  resultats.motsDePasseDifferentsRefuses = /ne correspondent pas/.test((await message(A.page)) ?? '');
  resultats.aucuneRequeteAvantValidation = !serveur.journal.some((l) => l.includes('/auth/v1/signup'));

  await remplir(A.page, { email: 'pas-un-email', mdp: 'motdepasse1', confirmation: 'motdepasse1' });
  await A.page.locator('button[type="submit"]').click();
  resultats.emailInvalideRefuse = /pas valide/.test((await message(A.page)) ?? '');

  await remplir(A.page, { email: 'joueur@example.com', mdp: 'motdepasse1', confirmation: 'motdepasse1' });
  await A.page.locator('button[type="submit"]').click();
  const connecte = await attendre(A.page, () => window.__kubbStoreApi.getState().account.status === 'signedIn');
  resultats.compteCree = connecte;
  const synchro = await attendre(A.page, () => window.__kubbStoreApi.getState().account.sync === 'ok');
  resultats.progressionEnvoyeeAuServeur = synchro;

  const profil = [...serveur.profils.values()][0];
  console.log({ profil });
  resultats.leServeurAReçuLaProgression =
    profil?.revision === 1 &&
    profil.data.progression.totalXp === 1500 &&
    profil.data.coins === 340 &&
    profil.data.ownedItems.includes('skin-or') &&
    profil.data.unlockedAchievements.includes('froleur') &&
    profil.data.rank.index === 7;
  resultats.leMotDePasseNEstJamaisDansLeProfil = !JSON.stringify(profil?.data ?? {}).includes('motdepasse1');
  resultats.lEcranAfficheLEmail = (await A.page.locator('[data-testid="account-email"]').textContent()) === 'joueur@example.com';
}

// ------------------------------------------------------------------ 2. erreurs de connexion, appareil B vierge
const B = await appareil('B');
{
  await ouvrirCompte(B.page);
  await remplir(B.page, { email: 'joueur@example.com', mdp: 'mauvais-mot-de-passe' });
  await B.page.locator('button[type="submit"]').click();
  resultats.mauvaisMotDePasseExplique = /incorrect/.test((await message(B.page)) ?? '');

  // Adresse deja prise
  await B.page.locator('button', { hasText: /^Creer un compte$/ }).click();
  await remplir(B.page, { email: 'joueur@example.com', mdp: 'motdepasse1', confirmation: 'motdepasse1' });
  await B.page.locator('button[type="submit"]').click();
  resultats.adresseDejaPriseExpliquee = /deja un compte/.test((await message(B.page)) ?? '');

  // Trop de tentatives
  serveur.limiter = true;
  await remplir(B.page, { email: 'autre@example.com', mdp: 'motdepasse1', confirmation: 'motdepasse1' });
  await B.page.locator('button[type="submit"]').click();
  resultats.tropDeTentativesExplique = /Trop de tentatives/.test((await message(B.page)) ?? '');
  serveur.limiter = false;

  // Service injoignable
  await B.contexte.route(new RegExp(FAUX.replace(/\./g, '\\.')), (r) => r.abort(), { times: 1 });
  await remplir(B.page, { email: 'autre@example.com', mdp: 'motdepasse1', confirmation: 'motdepasse1' });
  await B.page.locator('button[type="submit"]').click();
  resultats.serviceInjoignableExplique = /injoignable/.test((await message(B.page)) ?? '');

  // Bonne connexion : l'appareil vierge retrouve tout.
  await B.page.locator('button', { hasText: /^Connexion$/ }).click();
  await remplir(B.page, { email: 'joueur@example.com', mdp: 'motdepasse1' });
  await B.page.locator('button[type="submit"]').click();
  const ok = await attendre(B.page, () => {
    const s = window.__kubbStoreApi.getState();
    return s.account.status === 'signedIn' && s.progression.totalXp === 1500;
  });
  const e = await etat(B.page);
  console.log({ e });
  resultats.lAppareilVierge_RetrouveSaProgression = ok && e.coins === 340 && e.owned.includes('skin-or') && e.succes.includes('froleur') && e.rang.index === 7;
  resultats.pasDeQuestionSurUnAppareilVierge = e.conflit === false;
  resultats.laProgressionEstAussiDansLeStockageDeB =
    e.stockage.prog?.totalXp === 1500 && e.stockage.coins?.coins === 340 && e.stockage.owned?.includes('skin-or');
}

// ------------------------------------------------------------------ 3. B joue, A le retrouve
{
  await B.page.evaluate(() => window.__kubbStoreApi.getState().recordRankedMatch('win', 'match'));
  await attendre(B.page, () => window.__kubbStoreApi.getState().account.sync === 'ok');
  // Le debounce d'envoi est de 2 s ; attendre que le serveur ait la revision 2.
  for (let i = 0; i < 40 && [...serveur.profils.values()][0]?.revision < 2; i += 1) await B.page.waitForTimeout(250);
  const profil = [...serveur.profils.values()][0];
  resultats.laProgressionDeBArriveAuServeur = profil?.revision === 2 && profil.data.rank.index === 8;

  await A.page.reload();
  await A.page.waitForSelector('.panel--menu', { timeout: 30000 });
  const retrouve = await attendre(A.page, () => window.__kubbStoreApi.getState().rank.index === 8, undefined, 30000);
  resultats.A_RetrouveLeCoupJoueSurB = retrouve;
  resultats.A_resteConnecteApresRechargement = (await etat(A.page)).compte.status === 'signedIn';
}

// ------------------------------------------------------------------ 4. deux appareils en meme temps
{
  // A et B partent de la meme revision et changent chacun une chose DIFFERENTE, dans la meme seconde.
  await Promise.all([
    A.page.evaluate(() => window.__kubbStoreApi.getState().unlockAchievements(['remontada'])),
    B.page.evaluate(() => {
      const s = window.__kubbStoreApi.getState();
      localStorage.setItem('kubb-kings.shop.owned', JSON.stringify([...s.ownedItems, 'trail-feu']));
      window.__kubbStoreApi.setState({ ownedItems: [...s.ownedItems, 'trail-feu'] });
    })
  ]);
  for (let i = 0; i < 80; i += 1) {
    const p = [...serveur.profils.values()][0];
    if (p && p.data.unlockedAchievements.includes('remontada') && p.data.ownedItems.includes('trail-feu')) break;
    await A.page.waitForTimeout(250);
  }
  const profil = [...serveur.profils.values()][0];
  console.log({ revisionFinale: profil?.revision, succes: profil?.data.unlockedAchievements, owned: profil?.data.ownedItems });
  resultats.ecritureSimultanee_RienNEstPerdu =
    !!profil && profil.data.unlockedAchievements.includes('remontada') && profil.data.ownedItems.includes('trail-feu');
}

// ------------------------------------------------------------------ 5. deconnexion et reconnexion
{
  await ouvrirCompte(A.page);
  await A.page.locator('button', { hasText: /^Se deconnecter$/ }).click();
  await attendre(A.page, () => window.__kubbStoreApi.getState().account.status === 'signedOut');
  await A.page.locator('button', { hasText: /^Retour$/ }).click().catch(() => {});
  const e = await etat(A.page);
  resultats.deconnecte = e.compte.status === 'signedOut';
  resultats.laProgressionResteSurLAppareilApresDeconnexion = e.xp === 1500 && e.coins === 340;

  await ouvrirCompte(A.page);
  await remplir(A.page, { email: 'joueur@example.com', mdp: 'motdepasse1' });
  await A.page.locator('button[type="submit"]').click();
  await attendre(A.page, () => window.__kubbStoreApi.getState().account.status === 'signedIn');
  await A.page.waitForTimeout(1500);
  resultats.reconnexionSansQuestion = (await etat(A.page)).conflit === false;
}

// ------------------------------------------------------------------ 5b. un AUTRE compte sur le meme appareil repart de zero
{
  const N = await appareil('N', PROGRESSION_A);
  const sinscrire = async (email) => {
    await ouvrirCompte(N.page);
    await N.page.locator('button', { hasText: /^Creer un compte$/ }).click();
    await remplir(N.page, { email, mdp: 'motdepasse1', confirmation: 'motdepasse1' });
    await N.page.locator('button[type="submit"]').click();
    await attendre(N.page, (e) => window.__kubbStoreApi.getState().account.email === e && window.__kubbStoreApi.getState().account.sync === 'ok', email);
    await N.page.waitForTimeout(800);
  };
  const deconnecter = async () => {
    await ouvrirCompte(N.page);
    await N.page.locator('button', { hasText: /^Se deconnecter$/ }).click();
    await attendre(N.page, () => window.__kubbStoreApi.getState().account.status === 'signedOut');
    await N.page.locator('button', { hasText: /^Retour$/ }).click().catch(() => {});
  };
  await sinscrire('premier@example.com');
  resultats.autreCompte_LePremierCompteGardeLaProgressionLibre = (await etat(N.page)).xp === 1500;
  await deconnecter();
  await sinscrire('second@example.com');
  const second = await etat(N.page);
  resultats.autreCompte_LeSecondRepartDeZero = second.xp === 0 && second.coins === 0 && second.owned.length === 0 && second.rang.index === 0;
  const profils = [...serveur.profils.entries()].filter(([, v]) => v.data?.coins !== undefined);
  const copie = profils.filter(([, v]) => v.data.coins === 340 && v.data.rank?.index === 7).length;
  resultats.autreCompte_LaProgressionNEstPasCopieeAuClassement = copie === 1;
  await deconnecter();
  await ouvrirCompte(N.page);
  await N.page.locator('button', { hasText: /^Connexion$/ }).click().catch(() => {});
  await remplir(N.page, { email: 'premier@example.com', mdp: 'motdepasse1' });
  await N.page.locator('button[type="submit"]').click();
  await attendre(N.page, () => window.__kubbStoreApi.getState().account.status === 'signedIn');
  await attendre(N.page, () => window.__kubbStoreApi.getState().progression.totalXp === 1500);
  resultats.autreCompte_LePremierRetrouveLaSienne = (await etat(N.page)).xp === 1500;
  await N.contexte.close();
}

// ------------------------------------------------------------------ 5c. mot de passe oublie
{
  const R = await appareil('R');
  await ouvrirCompte(R.page);
  await R.page.locator('button', { hasText: /^Creer un compte$/ }).click();
  await remplir(R.page, { email: 'oubli@example.com', mdp: 'ancienmdp1', confirmation: 'ancienmdp1' });
  await R.page.locator('button[type="submit"]').click();
  await attendre(R.page, () => window.__kubbStoreApi.getState().account.sync === 'ok');
  await R.page.locator('button', { hasText: /^Se deconnecter$/ }).click();
  await attendre(R.page, () => window.__kubbStoreApi.getState().account.status === 'signedOut');
  await ouvrirCompte(R.page);
  await R.page.locator('button', { hasText: /^Connexion$/ }).click();

  // Une adresse inconnue recoit EXACTEMENT la meme reponse qu'une adresse connue.
  const demander = async (adresse) => {
    await R.page.locator('button', { hasText: /^Mot de passe oublie \?$/ }).click();
    await R.page.locator('input[type="email"]').fill(adresse);
    await R.page.locator('button[type="submit"]').click();
    await R.page.waitForSelector('[data-testid="reset-sent"]', { timeout: 10000 });
    const texte = await R.page.locator('[data-testid="reset-sent"]').textContent();
    await R.page.locator('button', { hasText: /^Retour$/ }).click();
    return texte;
  };
  const texteInconnue = await demander('personne@example.com');
  const texteConnue = await demander('oubli@example.com');
  resultats.oubli_laDemandePartAuServeur = serveur.journal.filter((l) => l.includes('/auth/v1/recover')).length === 2;
  resultats.oubli_leLienDemandeUnRetourSurLeJeu = serveur.journal.some((l) => l.includes('/auth/v1/recover') && /redirect_to/.test(l));
  resultats.oubli_aucuneFuiteSurLExistenceDuCompte = texteInconnue === texteConnue && !/n'existe pas|inconnu/i.test(texteConnue ?? '');
  resultats.oubli_adresseInvalideRefusee = await (async () => {
    await R.page.locator('button', { hasText: /^Mot de passe oublie \?$/ }).click();
    await R.page.locator('input[type="email"]').fill('pas-une-adresse');
    await R.page.locator('button[type="submit"]').click();
    const m = /pas valide/.test((await message(R.page)) ?? '');
    await R.page.locator('button', { hasText: /^Retour$/ }).click();
    return m;
  })();

  // Le joueur clique le lien recu par e-mail : retour sur le jeu avec un code.
  serveur.recoveries.set('rcode-1', 'oubli@example.com');
  await R.page.goto(`${JEU}?code=rcode-1`);
  await R.page.waitForFunction(() => Boolean(window.__kubbStoreApi), null, { timeout: 30000 });
  const formulaire = await attendre(R.page, () => !!document.querySelector('[data-testid="new-password"]'));
  resultats.oubli_leLienOuvreLeFormulaireDeNouveauMotDePasse = formulaire;
  resultats.oubli_leCodeEstRetireDeLAdresse = !/[?&]code=/.test(R.page.url());

  // Trop court, puis different, puis l'ancien mot de passe refuse, puis accepte.
  const saisir = async (a, b) => {
    await R.page.locator('[data-testid="new-password"]').fill(a);
    await R.page.locator('input[type="password"]').nth(1).fill(b);
    await R.page.locator('button[type="submit"]').click();
  };
  await saisir('court', 'court');
  resultats.oubli_motDePasseTropCourtRefuse = /8 caracteres/.test((await message(R.page)) ?? '');
  await saisir('nouveaumdp1', 'autrechose1');
  resultats.oubli_motsDePasseDifferentsRefuses = /ne correspondent pas/.test((await message(R.page)) ?? '');
  await saisir('ancienmdp1', 'ancienmdp1');
  resultats.oubli_memeMotDePasseRefuse = /different de l'ancien/.test((await message(R.page)) ?? '');
  await saisir('nouveaumdp1', 'nouveaumdp1');
  resultats.oubli_nouveauMotDePasseEnregistre = (await attendre(R.page, () => /modifie/.test(document.body.innerText))) && serveur.users.get('oubli@example.com').password === 'nouveaumdp1';
  resultats.oubli_lePrecedentLienNEstPasRejoue = (await etat(R.page)).compte.recovering === false;

  // Ensuite : l'ancien mot de passe ne marche plus, le nouveau si.
  await R.page.locator('button', { hasText: /^Se deconnecter$/ }).click();
  await attendre(R.page, () => window.__kubbStoreApi.getState().account.status === 'signedOut');
  await ouvrirCompte(R.page);
  await remplir(R.page, { email: 'oubli@example.com', mdp: 'ancienmdp1' });
  await R.page.locator('button[type="submit"]').click();
  resultats.oubli_lAncienMotDePasseNeMarchePlus = /incorrect/.test((await message(R.page)) ?? '');
  await remplir(R.page, { email: 'oubli@example.com', mdp: 'nouveaumdp1' });
  await R.page.locator('button[type="submit"]').click();
  resultats.oubli_leNouveauMarche = await attendre(R.page, () => window.__kubbStoreApi.getState().account.status === 'signedIn');
  await R.contexte.close();
}

// ------------------------------------------------------------------ 6. deux histoires : le joueur choisit
{
  const profilAvant = JSON.parse(JSON.stringify([...serveur.profils.values()][0].data));
  // C : un appareil avec SA propre progression, jamais rapproche de ce compte.
  const C = await appareil('C', {
    'kubb-kings.progression': { totalXp: 300, winStreak: 0, gamesPlayed: 5, totalWins: 2 },
    'kubb-kings.currency': { coins: 900 },
    'kubb-kings.shop.owned': ['piece-rare'],
    'kubb-kings.achievements.unlocked': ['precision']
  });
  await ouvrirCompte(C.page);
  await remplir(C.page, { email: 'joueur@example.com', mdp: 'motdepasse1' });
  await C.page.locator('button[type="submit"]').click();
  const dialogue = await attendre(C.page, () => !!window.__kubbStoreApi.getState().accountConflict);
  resultats.deuxHistoires_LeJoueurEstInterroge = dialogue;
  const textes = await C.page.evaluate(() => ({
    local: document.querySelector('[data-testid="conflict-local"]')?.textContent ?? '',
    compte: document.querySelector('[data-testid="conflict-remote"]')?.textContent ?? ''
  }));
  console.log({ textes });
  resultats.lesDeuxProgressionsSontMontrees = /900 pieces/.test(textes.local) && /340 pieces/.test(textes.compte);
  const intactAvant = await etat(C.page);
  resultats.rienNEstEcraseAvantLeChoix = intactAvant.xp === 300 && intactAvant.coins === 900;

  await C.page.locator('button', { hasText: /Fusionner/ }).click();
  await attendre(C.page, () => window.__kubbStoreApi.getState().account.sync === 'ok');
  const e = await etat(C.page);
  console.log({ fusion: { xp: e.xp, coins: e.coins, owned: e.owned, succes: e.succes } });
  resultats.fusion_LeMeilleurDesDeux =
    e.xp === profilAvant.progression.totalXp &&
    e.coins === Math.max(900, profilAvant.coins) &&
    e.owned.includes('piece-rare') && e.owned.includes('skin-or') &&
    e.succes.includes('precision') && e.succes.includes('froleur');
  for (let i = 0; i < 20 && !([...serveur.profils.values()][0].data.ownedItems.includes('piece-rare')); i += 1) await C.page.waitForTimeout(250);
  resultats.laFusionEstEnvoyeeAuServeur = [...serveur.profils.values()][0].data.ownedItems.includes('piece-rare');
  await C.contexte.close();

  // D : choisit de GARDER LE COMPTE : sa progression locale est remplacee.
  const D = await appareil('D', {
    'kubb-kings.progression': { totalXp: 50, winStreak: 0, gamesPlayed: 1, totalWins: 0 },
    'kubb-kings.currency': { coins: 7 },
    'kubb-kings.shop.owned': ['objet-local']
  });
  await ouvrirCompte(D.page);
  await remplir(D.page, { email: 'joueur@example.com', mdp: 'motdepasse1' });
  await D.page.locator('button[type="submit"]').click();
  await attendre(D.page, () => !!window.__kubbStoreApi.getState().accountConflict);
  const serveurAvantD = JSON.stringify([...serveur.profils.values()][0].data);
  await D.page.locator('button', { hasText: /Garder celle de mon compte/ }).click();
  await attendre(D.page, () => window.__kubbStoreApi.getState().account.sync === 'ok');
  const ed = await etat(D.page);
  resultats.garderLeCompte_RemplaceLAppareil = ed.xp === 1500 && !ed.owned.includes('objet-local');
  resultats.garderLeCompte_NeModifiePasLeServeur = JSON.stringify([...serveur.profils.values()][0].data) === serveurAvantD;
  await D.contexte.close();

  // E : GARDER L'APPAREIL : le compte est remplace par la progression de E.
  const E = await appareil('E', {
    'kubb-kings.progression': { totalXp: 80, winStreak: 0, gamesPlayed: 2, totalWins: 1 },
    'kubb-kings.currency': { coins: 11 },
    'kubb-kings.shop.owned': ['objet-e']
  });
  await ouvrirCompte(E.page);
  await remplir(E.page, { email: 'joueur@example.com', mdp: 'motdepasse1' });
  await E.page.locator('button[type="submit"]').click();
  await attendre(E.page, () => !!window.__kubbStoreApi.getState().accountConflict);
  await E.page.locator('button', { hasText: /Garder celle de cet appareil/ }).click();
  for (let i = 0; i < 20 && [...serveur.profils.values()][0].data.coins !== 11; i += 1) await E.page.waitForTimeout(250);
  const ps = [...serveur.profils.values()][0].data;
  resultats.garderLAppareil_RemplaceLeCompte = ps.coins === 11 && ps.ownedItems.includes('objet-e') && !ps.ownedItems.includes('skin-or');
  await E.contexte.close();
}

// ------------------------------------------------------------------ 7. confirmation d'e-mail exigee par le service
{
  serveur.confirmerEmail = true;
  const F = await appareil('F');
  await ouvrirCompte(F.page);
  await F.page.locator('button', { hasText: /^Creer un compte$/ }).click();
  await remplir(F.page, { email: 'confirme@example.com', mdp: 'motdepasse1', confirmation: 'motdepasse1' });
  await F.page.locator('button[type="submit"]').click();
  await F.page.waitForTimeout(1200);
  resultats.confirmationDEmailExpliquee = /e-mail de confirmation/.test((await message(F.page)) ?? '');
  resultats.pasConnecteTantQueLEmailNEstPasConfirme = (await etat(F.page)).compte.status === 'signedOut';
  serveur.confirmerEmail = false;
  await F.contexte.close();
}

// ------------------------------------------------------------------ 8. suppression du compte
{
  const avant = serveur.users.size;
  const profilsAvant = serveur.profils.size;
  await ouvrirCompte(A.page);
  await A.page.locator('button', { hasText: /^Supprimer mon compte$/ }).click();
  await A.page.locator('button', { hasText: /Oui, supprimer definitivement/ }).click();
  await attendre(A.page, () => window.__kubbStoreApi.getState().account.status === 'signedOut');
  resultats.compteSupprimeCoteServeur = serveur.users.size === avant - 1 && !serveur.users.has('joueur@example.com');
  resultats.profilSupprimeCoteServeur = serveur.profils.size === profilsAvant - 1;
  resultats.laProgressionLocaleResteApresSuppression = (await etat(A.page)).xp === 1500;

  await A.page.waitForTimeout(500);
  await A.page.locator('button', { hasText: /^Connexion$/ }).click().catch(() => {});
  await remplir(A.page, { email: 'joueur@example.com', mdp: 'motdepasse1' });
  await A.page.locator('button[type="submit"]').click();
  resultats.onNePeutPlusSeConnecter = /incorrect/.test((await message(A.page)) ?? '');
}

// ------------------------------------------------------------------ 9. connexion avec Google
{
  const G = await appareil('G', {
    'kubb-kings.progression': { totalXp: 700, winStreak: 0, gamesPlayed: 9, totalWins: 5 },
    'kubb-kings.currency': { coins: 55 }
  });
  await ouvrirCompte(G.page);
  const bouton = await G.page.locator('button', { hasText: /Continuer avec Google/ }).count();
  // Le bouton n'est propose que si Google est configure (account/config.ts) : present quand le build
  // l'active, ABSENT sinon — un bouton visible mais sans effet renverrait sur une page d'erreur brute.
  const googleActive = process.env.VITE_GOOGLE_AUTH === '1';
  resultats.leBoutonGoogleSuitLeDrapeau = bouton === (googleActive ? 1 : 0);
  if (!googleActive) {
    await G.contexte.close();
    console.log('Google desactive dans ce build : section de connexion Google ignoree.');
  } else {

  // Annulation chez Google : le jeu l'explique, ne plante pas, et nettoie l'adresse.
  serveur.oauthEchec = true;
  await G.page.locator('button', { hasText: /Continuer avec Google/ }).click();
  await G.page.waitForURL(/kubb-kings/, { timeout: 30000 });
  await G.page.waitForSelector('.panel--menu', { timeout: 30000 });
  await ouvrirCompte(G.page);
  resultats.googleAnnule_LeJeuLExplique = (await G.page.locator('[data-testid="account-notice"]').count()) === 1;
  resultats.googleAnnule_LAdresseEstNettoyee = !/error/.test(G.page.url());
  resultats.googleAnnule_PasConnecte = (await etat(G.page)).compte.status === 'signedOut';

  // Reussite : retour avec un code, echange (PKCE), connexion, synchronisation.
  serveur.oauthEchec = false;
  await G.page.locator('button', { hasText: /Continuer avec Google/ }).click();
  await G.page.waitForURL(/kubb-kings/, { timeout: 30000 });
  await G.page.waitForSelector('.panel--menu', { timeout: 30000 });
  const connecte = await attendre(G.page, () => {
    const s = window.__kubbStoreApi.getState();
    return s.account.status === 'signedIn' && s.account.sync === 'ok';
  }, undefined, 30000);
  const eg = await etat(G.page);
  console.log({ google: eg.compte, url: G.page.url() });
  resultats.googleConnecte = connecte && eg.compte.email === 'google@example.com';
  resultats.leFluxEstEnPKCE = serveur.journal.some((l) => l.includes('/auth/v1/authorize') && l.includes('code_challenge=')) &&
    serveur.journal.some((l) => l.includes('grant_type=pkce'));
  resultats.googleLAdresseNePorteAucunCode = !/[?&]code=/.test(G.page.url());
  const profilG = [...serveur.profils.values()].find((p) => p.data.progression.totalXp === 700);
  resultats.googleLaProgressionEstEnvoyee = !!profilG && profilG.data.coins === 55;
  await G.contexte.close();
  }
}

// ------------------------------------------------------------------ 10. classement des parties classees
{
  const semer = (id, pseudo, r) => serveur.profils.set(id, { data: { rank: r }, revision: 1, pseudo, visible: true, r });
  serveur.profils.clear();
  semer('seed-1', 'AigleViking11', { index: 14, peak: 14, wins: 20, losses: 6 });
  semer('seed-2', 'LoupRapide22', { index: 5, peak: 6, wins: 8, losses: 9 });
  semer('seed-3', 'CerfBrave33', { index: 10, peak: 10, wins: 15, losses: 5 });

  const lignes = (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="leaderboard"] li')].map((li) => ({
        texte: li.textContent,
        moi: li.classList.contains('leaderboard__row--me')
      }))
    );
  const ouvrirRangs = async (page) => {
    await focus(page);
    if ((await page.locator('.btn--ranked').count()) > 0) await page.locator('.btn--ranked').click();
    await page.waitForSelector('.panel--ranks');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="leaderboard"], [data-testid="board-empty"]'),
      null,
      { timeout: 15000 }
    );
  };

  // Un visiteur SANS compte lit le classement.
  const I = await appareil('I');
  await ouvrirRangs(I.page);
  const visiteur = await lignes(I.page);
  console.log({ visiteur: visiteur.map((l) => l.texte) });
  resultats.classement_LisibleSansCompte = visiteur.length === 3 && /AigleViking11/.test(visiteur[0].texte);
  resultats.classement_PasDeSectionPseudoSansCompte = (await I.page.locator('[data-testid="my-standing"]').count()) === 0;
  resultats.classement_InviteALaConnexion = /Connectez-vous pour apparaitre/.test(
    (await I.page.locator('.panel--ranks').textContent()) ?? ''
  );
  // Bloquer marche sans compte ; signaler demande de se connecter.
  const menuDe = async (page, i) => {
    await page.locator('[data-testid="leaderboard"] li').nth(i).locator('[data-testid="player-actions"]').click();
    await page.waitForSelector('[data-testid="player-menu"]');
  };
  resultats.signaler_visiteurVoitUnBoutonParLigne = (await I.page.locator('[data-testid="player-actions"]').count()) === 3; // visiteur : 3 lignes, 3 boutons
  await menuDe(I.page, 0);
  await I.page.locator('[data-testid="report-button"]').click();
  resultats.signaler_sansCompteOnDemandeDeSeConnecter = /Connectez-vous pour signaler/.test((await I.page.locator('[data-testid="report-message"]').textContent()) ?? '');
  resultats.signaler_aucuneRequeteSansCompte = !serveur.journal.some((l) => l.includes('report_player'));
  await menuDe(I.page, 0);
  await I.page.locator('[data-testid="block-button"]').click();
  const apresBlocage = await lignes(I.page);
  resultats.bloquer_LeJoueurDisparaitDuClassement = apresBlocage.length === 2 && !apresBlocage.some((l) => /AigleViking11/.test(l.texte));
  await I.page.reload();
  await I.page.waitForFunction(() => Boolean(window.__kubbStoreApi), null, { timeout: 30000 });
  await ouvrirRangs(I.page);
  resultats.bloquer_LeBlocageSeRetrouveApresRechargement = (await lignes(I.page)).length === 2;
  await I.page.locator('[data-testid="unblock-all"]').click();
  resultats.bloquer_ToutDebloquer = (await lignes(I.page)).length === 3;
  await I.contexte.close();

  // H : un joueur connecte, rang Or 1 (marche 10), 12 victoires.
  const H = await appareil('H', { 'kubb-kings.rank': { index: 10, wins: 12, losses: 3, peak: 10 }, 'kubb-kings.currency': { coins: 250 } });
  await ouvrirCompte(H.page);
  await H.page.locator('button', { hasText: /^Creer un compte$/ }).click();
  await remplir(H.page, { email: 'classe@example.com', mdp: 'motdepasse1', confirmation: 'motdepasse1' });
  await H.page.locator('button[type="submit"]').click();
  await attendre(H.page, () => window.__kubbStoreApi.getState().account.sync === 'ok');
  await H.page.locator('button', { hasText: /^Retour$/ }).click();
  await ouvrirRangs(H.page);
  const l1 = await lignes(H.page);
  console.log({ classement: l1.map((l) => l.texte) });
  resultats.classement_OrdreParRangPuisVictoires =
    l1.length === 4 &&
    /AigleViking11/.test(l1[0].texte) &&
    /CerfBrave33/.test(l1[1].texte) &&
    /Pseudo/.test(l1[2].texte) &&
    /LoupRapide22/.test(l1[3].texte);
  resultats.classement_MaLigneEstMiseEnEvidence = l1.filter((l) => l.moi).length === 1 && l1[2]?.moi === true;
  const standing = await H.page.locator('[data-testid="my-standing"]').textContent();
  resultats.classement_MaPlace = /3e sur 4/.test(standing ?? '');
  resultats.classement_LEmailNApparaitJamais = !((await H.page.locator('.panel--ranks').textContent()) ?? '').includes('classe@example.com');

  // L'ecran des classes n'edite plus rien : ni champ de saisie, ni tirage de pseudo, ni masquage du classement
  // (le pseudo se change depuis la Boutique ; figurer au classement va de soi quand on joue en classee).
  resultats.classement_AucunChampDeSaisie = (await H.page.locator('.panel--ranks input').count()) === 0;
  resultats.classement_AucuneEditionDePseudoIci =
    (await H.page.locator('.panel--ranks button', { hasText: /pseudo au hasard|Enregistrer/ }).count()) === 0;
  resultats.classement_OnNePeutPasSeRetirer =
    (await H.page.locator('.panel--ranks button', { hasText: /Ne plus apparaitre|Apparaitre au classement/ }).count()) === 0;
  resultats.classement_LePseudoResteAffiche = ((await H.page.locator('[data-testid="my-pseudo"]').textContent()) ?? '').length > 2;

  // Un rang joue : il monte au classement (envoi immediat avant la lecture).
  await H.page.evaluate(() => window.__kubbStoreApi.getState().recordRankedMatch('win', 'match'));
  await H.page.locator('button', { hasText: /^Retour$/ }).click();
  await ouvrirRangs(H.page);
  const l2 = await lignes(H.page);
  resultats.classement_LeRangJoueMonte = /Platine 3/.test(l2.find((l) => l.moi)?.texte ?? '');

  // Signaler un pseudo (compte connecte) : une requete, avec le pseudo et le motif, et un retour clair.
  const menuH = async (i) => {
    await H.page.locator('[data-testid="leaderboard"] li:not(.leaderboard__row--me)').nth(i).locator('[data-testid="player-actions"]').click();
    await H.page.waitForSelector('[data-testid="player-menu"]');
  };
  const nbBoutons = await H.page.locator('[data-testid="player-actions"]').count();
  resultats.signaler_pasDeBoutonSurSaPropreLigne = nbBoutons === (await lignes(H.page)).length - 1;
  await menuH(0);
  await H.page.locator('[data-testid="report-button"]').click();
  await H.page.waitForSelector('[data-testid="report-message"]');
  resultats.signaler_UneRequeteEstEnvoyee = serveur.signalements.length === 1 && serveur.signalements[0].pseudo === 'AigleViking11' && serveur.signalements[0].motif === 'pseudo';
  resultats.signaler_LeJoueurEstRemercie = /Merci/.test((await H.page.locator('[data-testid="report-message"]').textContent()) ?? '');
  serveur.signalementRefus = 'too-many';
  await menuH(1);
  await H.page.locator('[data-testid="report-button"]').click();
  await H.page.waitForFunction(() => /Trop de signalements/.test(document.querySelector('[data-testid="report-message"]')?.textContent ?? ''));
  resultats.signaler_LaLimiteJournaliereEstExpliquee = true;
  serveur.signalementRefus = null;
  await menuH(1);
  await H.page.locator('button', { hasText: /^Annuler$/ }).click();
  resultats.signaler_AnnulerNEnvoieRien = serveur.signalements.length === 1 && (await H.page.locator('[data-testid="player-menu"]').count()) === 0;

  await H.contexte.close();

  // Y : un compte cree AVANT l'arrivee du classement (profil sans pseudo) en recoit un a l'ouverture de
  // l'ecran, sans rien cliquer — il ne doit pas voir « — ».
  serveur.users.set('ancien@example.com', { id: 'u-ancien', email: 'ancien@example.com', password: 'motdepasse1' });
  serveur.profils.set('u-ancien', {
    data: { v: 1, progression: { totalXp: 0, winStreak: 0, gamesPlayed: 0, totalWins: 0 }, coins: 0, ownedItems: [],
      unlockedAchievements: [], terrainWins: [], onlineWinStreak: 0, rank: { index: 0, wins: 0, losses: 0, peak: 0 }, bestStage: 0 },
    revision: 1,
    pseudo: null,
    visible: true,
    r: { ...rangVide }
  });
  const Y = await appareil('Y');
  await ouvrirCompte(Y.page);
  await remplir(Y.page, { email: 'ancien@example.com', mdp: 'motdepasse1' });
  await Y.page.locator('button[type="submit"]').click();
  await attendre(Y.page, () => window.__kubbStoreApi.getState().account.sync === 'ok');
  await Y.page.locator('button', { hasText: /^Retour$/ }).click();
  await ouvrirRangs(Y.page);
  const pseudoY = await attendre(
    Y.page,
    () => {
      const t = document.querySelector('[data-testid="my-pseudo"]')?.textContent ?? '';
      return t.length > 1 && t !== '—';
    },
    undefined,
    15000
  );
  resultats.classement_UnAncienCompteRecoitUnPseudoSansRienCliquer = pseudoY;
  await Y.contexte.close();

  // X : un rang INCOHERENT (marche 17 avec 3 victoires) ne passe pas au classement.
  const X = await appareil('X', { 'kubb-kings.rank': { index: 17, wins: 3, losses: 1, peak: 17 } });
  await ouvrirCompte(X.page);
  await X.page.locator('button', { hasText: /^Creer un compte$/ }).click();
  await remplir(X.page, { email: 'tricheur@example.com', mdp: 'motdepasse1', confirmation: 'motdepasse1' });
  await X.page.locator('button[type="submit"]').click();
  await attendre(X.page, () => window.__kubbStoreApi.getState().account.sync === 'ok');
  await X.page.locator('button', { hasText: /^Retour$/ }).click();
  await ouvrirRangs(X.page);
  const lx = await lignes(X.page);
  console.log({ tricheur: lx.map((l) => l.texte) });
  resultats.classement_UnRangIncoherentEstRefuse = !lx.some((l) => /Master 3/.test(l.texte)) && !lx.some((l) => l.moi);
  await X.contexte.close();
}

// ------------------------------------------------------------------ 11. pseudo choisi par le joueur
{
  serveur.profils.clear();
  const pseudoServeur = (email) => {
    const id = serveur.users.get(email)?.id;
    return id ? serveur.profils.get(id)?.pseudo : undefined;
  };
  const creer = async (page, email, pseudo) => {
    await ouvrirCompte(page);
    await page.locator('button', { hasText: /^Creer un compte$/ }).click();
    await remplir(page, { email, mdp: 'motdepasse1', confirmation: 'motdepasse1' });
    if (pseudo !== undefined) await page.locator('[data-testid="signup-pseudo"]').fill(pseudo);
    await page.locator('button[type="submit"]').click();
  };
  const synchroOk = (page) =>
    attendre(page, () => {
      const s = window.__kubbStoreApi.getState();
      return s.account.status === 'signedIn' && s.account.sync === 'ok';
    });

  // P1 : un pseudo choisi des la creation du compte.
  const P1 = await appareil('P1', { 'kubb-kings.currency': { coins: 250 } });
  await creer(P1.page, 'ra@example.com', 'Thomas_Ra');
  await synchroOk(P1.page);
  // Le pseudo voulu est applique apres la premiere synchronisation : on laisse le temps a cette seconde requete.
  for (let i = 0; i < 40 && pseudoServeur('ra@example.com') !== 'Thomas_Ra'; i += 1) await P1.page.waitForTimeout(150);
  resultats.pseudo_choisiALaCreation = pseudoServeur('ra@example.com') === 'Thomas_Ra';
  resultats.pseudo_leChoixEnAttenteEstNettoye = (await P1.page.evaluate(() => localStorage.getItem('kubb-kings.pending-pseudo'))) === null;
  await P1.page.evaluate(() => window.__kubbStoreApi.getState().setScreen('menu'));
  resultats.menu_affiche_LePseudoApresLInscription = await attendre(P1.page, () => document.querySelector('[data-testid="menu-pseudo"]')?.textContent === 'Thomas_Ra');
  resultats.pseudo_aucunAvertissementSiToutVaBien = (await P1.page.locator('[data-testid="account-notice"]').count()) === 0;

  // P2 : le meme pseudo (autre casse) est deja pris : le compte est cree, un pseudo attribue, et on le dit.
  const P2 = await appareil('P2');
  await creer(P2.page, 'autre@example.com', 'thomas_ra');
  await synchroOk(P2.page);
  const prevenu = await attendre(P2.page, () => window.__kubbStoreApi.getState().account.notice === 'pseudo-taken');
  resultats.pseudo_prisALaCreation_UnPseudoEstAttribueEtOnLeDit =
    prevenu && /^Pseudo\d+$/.test(pseudoServeur('autre@example.com') ?? '') && (await P2.page.locator('[data-testid="account-notice"]').count()) === 1;

  // P3 : un pseudo interdit est refuse AVANT toute requete, sans creer de compte.
  const P3 = await appareil('P3');
  const avant = serveur.journal.filter((l) => l.includes('/auth/v1/signup')).length;
  await creer(P3.page, 'vilain@example.com', 'Connard42');
  const refus = ((await message(P3.page)) ?? '');
  resultats.pseudo_interditRefuseALaCreation = /pas autorise/.test(refus) && serveur.journal.filter((l) => l.includes('/auth/v1/signup')).length === avant;
  await P3.page.locator('[data-testid="signup-pseudo"]').fill('A!');
  await P3.page.locator('button[type="submit"]').click();
  resultats.pseudo_caracteresRefusesALaCreation = /Seuls les lettres|minimum/.test(((await message(P3.page)) ?? ''));
  await P3.contexte.close();

  // P4 : renommer depuis la Boutique.
  await P1.page.evaluate(() => window.__kubbStoreApi.getState().setScreen('shop'));
  await P1.page.waitForSelector('[data-testid="pseudo-editor"]');
  const courant = async () => P1.page.locator('[data-testid="pseudo-current"]').textContent();
  resultats.boutique_affiche_LePseudoActuel = await attendre(P1.page, () => document.querySelector('[data-testid="pseudo-current"]')?.textContent === 'Thomas_Ra');
  const msg = () => P1.page.locator('[data-testid="pseudo-message"]').textContent({ timeout: 4000 }).catch(() => null);
  const saisir = async (texte) => {
    await P1.page.locator('[data-testid="pseudo-input"]').fill(texte);
    await P1.page.locator('[data-testid="pseudo-editor"] button[type="submit"]').click();
  };

  const pieces = () => P1.page.evaluate(() => window.__kubbStoreApi.getState().coins);
  resultats.boutique_leCoutEstAffiche = /100 pieces/.test((await P1.page.locator('[data-testid="pseudo-cost"]').textContent()) ?? '');
  await saisir('Connard');
  resultats.boutique_interditRefuse = /pas autorise/.test((await msg()) ?? '');
  await saisir('x');
  resultats.boutique_tropCourtRefuse = /minimum/.test((await msg()) ?? '');
  await saisir('Roi du Kubb');
  resultats.boutique_caracteresRefuses = /Seuls les lettres/.test((await msg()) ?? '');

  // Le serveur applique un delai entre deux changements ; on attend qu'il soit ecoule.
  await P1.page.waitForTimeout(serveur.delaiPseudo + 300);
  await saisir(pseudoServeur('autre@example.com') ?? 'x');
  resultats.boutique_prisRefuseParLeServeur = /deja pris/.test((await msg()) ?? '');
  resultats.boutique_unRefusNeCoutePasDePieces = (await pieces()) === 250;
  await saisir('Nouveau_Nom');
  resultats.boutique_renommage = (await attendre(P1.page, () => document.querySelector('[data-testid="pseudo-current"]')?.textContent === 'Nouveau_Nom')) && pseudoServeur('ra@example.com') === 'Nouveau_Nom';
  await P1.page.evaluate(() => window.__kubbStoreApi.getState().setScreen('menu'));
  resultats.menu_affiche_LePseudoApresUnRenommage = await attendre(P1.page, () => document.querySelector('[data-testid="menu-pseudo"]')?.textContent === 'Nouveau_Nom');
  await P1.page.evaluate(() => window.__kubbStoreApi.getState().setScreen('shop'));
  await P1.page.waitForSelector('[data-testid="pseudo-editor"]');
  resultats.boutique_leRenommageCoute100Pieces = (await pieces()) === 150 && (await P1.page.evaluate(() => JSON.parse(localStorage.getItem('kubb-kings.currency')).coins)) === 150;
  await saisir('Encore_Un');
  resultats.boutique_trop_tot_RefuseParLeServeur = /quelques minutes/.test((await msg()) ?? '') && (await courant()) === 'Nouveau_Nom';

  // Un pseudo au hasard : un autre pseudo, pour le meme prix.
  await P1.page.waitForTimeout(serveur.delaiPseudo + 300);
  const avantHasard = await courant();
  const piecesAvant = await pieces();
  await P1.page.locator('[data-testid="pseudo-editor"] button', { hasText: /Un pseudo au hasard/ }).click();
  const change = await attendre(P1.page, (a) => document.querySelector('[data-testid="pseudo-current"]')?.textContent !== a, avantHasard);
  resultats.boutique_pseudoAuHasard = change && (await pieces()) === piecesAvant - 100;
  await P1.page.evaluate((p) => window.__kubbStoreApi.setState({ coins: p }), piecesAvant);

  // Solde insuffisant : le bouton est bloque, le prix manquant est dit, et AUCUNE requete ne part.
  await P1.page.evaluate(() => window.__kubbStoreApi.setState({ coins: 40 }));
  const avantRequetes = serveur.journal.filter((l) => l.includes('set_pseudo')).length;
  await P1.page.locator('[data-testid="pseudo-input"]').fill('Sans_Sou');
  resultats.boutique_sansPieces_BoutonBloque = await P1.page.locator('[data-testid="pseudo-editor"] button[type="submit"]').isDisabled();
  resultats.boutique_sansPieces_LeManqueEstDit = /manque 60 pieces/.test((await P1.page.locator('[data-testid="pseudo-cost"]').textContent()) ?? '');
  resultats.boutique_sansPieces_AucuneRequete = serveur.journal.filter((l) => l.includes('set_pseudo')).length === avantRequetes;
  await P1.page.evaluate(() => window.__kubbStoreApi.setState({ coins: 250 }));

  // Script SQL pas encore relance : on le dit, sans rien casser.
  const avantSql = await courant();
  serveur.setPseudoAbsent = true;
  await P1.page.waitForTimeout(serveur.delaiPseudo + 300);
  await saisir('Autre_Nom');
  resultats.boutique_sqlPasRelance_OnLeDit = /pas encore disponible/.test((await msg()) ?? '') && (await courant()) === avantSql && (await pieces()) === 250;
  serveur.setPseudoAbsent = false;

  // Sans compte : une invitation a se connecter, pas de champ.
  const P5 = await appareil('P5');
  await P5.page.evaluate(() => window.__kubbStoreApi.getState().setScreen('shop'));
  await P5.page.waitForSelector('[data-testid="pseudo-editor"]');
  resultats.boutique_sansCompte_Invitation =
    (await P5.page.locator('[data-testid="pseudo-input"]').count()) === 0 && /Connectez-vous/.test((await P5.page.locator('[data-testid="pseudo-editor"]').textContent()) ?? '');
  await P5.contexte.close();
  await P1.contexte.close();
  await P2.contexte.close();
}

conclure(resultats, erreurs);
await navigateur.close();
