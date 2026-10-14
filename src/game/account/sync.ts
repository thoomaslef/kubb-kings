import { useGameStore } from '../../store/useGameStore';
import { getBestStage } from '../roguelite';
import type { LeaderboardEntry, Standing } from './leaderboard';
import {
  createSupabaseBackend,
  type AccountBackend,
  type AccountErrorCode,
  type AccountUser,
  type PseudoErrorCode
} from './backend';
import { validatePseudo, type PseudoProblem } from './pseudo';
import {
  emptySnapshot,
  isPristine,
  mergeBest,
  sanitizeSnapshot,
  snapshotsEqual,
  type ProfileSnapshot
} from './profileSnapshot';

/**
 * Compte joueur : connexion et synchronisation de la progression.
 *
 * Principe : LOCAL D'ABORD. Le jeu lit et ecrit toujours le stockage de
 * l'appareil, exactement comme avant ; le compte ne fait que recopier cette
 * progression vers le serveur et la rapporter sur un autre appareil. Sans
 * compte, hors ligne, ou serveur en panne, rien ne change pour le joueur.
 *
 * Deux appareils ne s'ecrasent jamais sans le savoir : chaque ecriture
 * indique la REVISION qu'elle croit remplacer, et le serveur la refuse si un
 * autre appareil a ecrit entre-temps (supabase/comptes.sql::save_profile) — on
 * relit alors, on fusionne, et on recommence.
 */

const META_KEY = 'kubb-kings.account-sync';
/** Delai avant d'envoyer une progression modifiee : un match fait bouger plusieurs champs a la suite. */
const PUSH_DELAY_MS = 2000;
const MAX_ATTEMPTS = 3;

interface SyncMeta {
  userId: string;
  /** Revision serveur qu'on a lue ou ecrite en dernier. */
  revision: number;
  /** Contenu (canonique) qu'on a envoye ou recu en dernier : sert a savoir si l'appareil a bouge depuis. */
  hash: string;
}

let backend: AccountBackend | null = null;
let started = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let busy: Promise<void> = Promise.resolve();
let offAuth: (() => void) | null = null;
let offStore: (() => void) | null = null;

const store = () => useGameStore.getState();

// ------------------------------------------------------------------ meta (stockage local)

function loadMeta(): SyncMeta | null {
  try {
    const raw = window.localStorage?.getItem(META_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<SyncMeta>;
    if (typeof p.userId !== 'string' || typeof p.hash !== 'string') return null;
    return { userId: p.userId, revision: Math.max(0, Math.floor(Number(p.revision) || 0)), hash: p.hash };
  } catch {
    return null;
  }
}

function saveMeta(meta: SyncMeta | null) {
  try {
    if (meta) window.localStorage?.setItem(META_KEY, JSON.stringify(meta));
    else window.localStorage?.removeItem(META_KEY);
  } catch {
    // Sans stockage, chaque demarrage repartira d'un rapprochement complet : sans danger, juste plus lent.
  }
}

// ------------------------------------------------------------------ lecture de l'appareil

/** Ce que l'appareil sait du joueur, tel que le store et le stockage le portent. */
export function readProfileSnapshot(): ProfileSnapshot {
  const s = store();
  return {
    v: 1,
    progression: { ...s.progression },
    coins: s.coins,
    ownedItems: [...s.ownedItems],
    unlockedAchievements: [...s.unlockedAchievements],
    terrainWins: [...s.terrainWins],
    onlineWinStreak: s.onlineWinStreak,
    rank: { ...s.rank },
    bestStage: getBestStage()
  };
}

/** Forme canonique (listes triees) : deux profils de meme contenu donnent la meme chaine. */
function fingerprint(s: ProfileSnapshot): string {
  return JSON.stringify({
    ...s,
    ownedItems: [...s.ownedItems].sort(),
    unlockedAchievements: [...s.unlockedAchievements].sort(),
    terrainWins: [...s.terrainWins].sort()
  });
}

// ------------------------------------------------------------------ rapprochement

/** Serialise les operations de synchronisation : jamais deux a la fois. */
function enqueue(task: () => Promise<void>): Promise<void> {
  busy = busy.then(task, task);
  return busy;
}

function markOk() {
  store().setAccount({ sync: 'ok', lastSyncAt: Date.now() });
}

function adopt(user: AccountUser, snapshot: ProfileSnapshot, revision: number) {
  store().applyProfileSnapshot(snapshot);
  saveMeta({ userId: user.id, revision, hash: fingerprint(readProfileSnapshot()) });
}

/** Envoie `snapshot` ; en cas de conflit de revision, relit et recommence. */
async function push(user: AccountUser, snapshot: ProfileSnapshot, expectedRevision: number, attempt = 1): Promise<void> {
  if (!backend) return;
  const result = await backend.saveProfile(snapshot, expectedRevision);
  if (result.ok) {
    saveMeta({ userId: user.id, revision: result.revision, hash: fingerprint(snapshot) });
    markOk();
    return;
  }
  if (result.conflict && attempt < MAX_ATTEMPTS) {
    await reconcileNow(user, attempt + 1);
    return;
  }
  store().setAccount({ sync: 'error' });
}

/**
 * Met l'appareil et le serveur d'accord. Les cinq cas, dans l'ordre :
 *  1. le serveur n'a rien : on y met la progression de l'appareil ;
 *  2. l'appareil est vierge : on prend celle du serveur ;
 *  3. cet appareil a deja ete rapproche de CE compte : le serveur a-t-il avance
 *     (autre appareil) ? l'appareil a-t-il avance ? les deux ? (fusion) ;
 *  4. premier rapprochement, compte vide : l'appareil devient le compte ;
 *  5. premier rapprochement, les deux ont une histoire : au joueur de choisir.
 */
async function reconcileNow(user: AccountUser, attempt = 1): Promise<void> {
  if (!backend) return;
  store().setAccount({ sync: 'syncing' });
  let remote;
  try {
    remote = await backend.loadProfile();
  } catch {
    store().setAccount({ sync: 'error' });
    return;
  }

  const local = readProfileSnapshot();

  // Cet appareil porte deja la progression d'UN AUTRE compte : elle n'est pas a celui-ci. Un nouveau
  // compte repart de zero (ou retrouve la sienne), il ne recopie jamais — ni la progression, ni son
  // score au classement — celle du compte precedent. Seule une progression « libre » (jamais rattachee
  // a un compte) suit le joueur dans son premier compte.
  const meta = loadMeta();
  if (meta && meta.userId !== user.id) {
    const own = remote ? (sanitizeSnapshot(remote.data) ?? emptySnapshot()) : emptySnapshot();
    adopt(user, own, remote?.revision ?? 0);
    if (!remote) await push(user, own, 0, attempt);
    else markOk();
    return;
  }

  if (!remote) {
    await push(user, local, 0, attempt);
    return;
  }

  const remoteSnap = sanitizeSnapshot(remote.data) ?? emptySnapshot();

  if (isPristine(local)) {
    adopt(user, remoteSnap, remote.revision);
    markOk();
    return;
  }

  if (meta && meta.userId === user.id) {
    const localMoved = fingerprint(local) !== meta.hash;
    if (remote.revision === meta.revision) {
      if (localMoved) await push(user, local, remote.revision, attempt);
      else markOk();
      return;
    }
    // Le serveur a avance : un autre appareil a joue.
    const merged = localMoved ? mergeBest(local, remoteSnap) : remoteSnap;
    adopt(user, merged, remote.revision);
    if (!snapshotsEqual(merged, remoteSnap)) await push(user, merged, remote.revision, attempt);
    else markOk();
    return;
  }

  if (isPristine(remoteSnap)) {
    await push(user, local, remote.revision, attempt);
    return;
  }
  if (snapshotsEqual(local, remoteSnap)) {
    saveMeta({ userId: user.id, revision: remote.revision, hash: fingerprint(local) });
    markOk();
    return;
  }

  // Deux histoires differentes : on ne tranche PAS a la place du joueur.
  store().setAccountConflict({ local, remote: remoteSnap, remoteRevision: remote.revision });
  store().setAccount({ sync: 'idle' });
}

function reconcile(user: AccountUser): Promise<void> {
  return enqueue(() => reconcileNow(user));
}

/** Reponse du joueur au premier rapprochement. */
export function resolveAccountConflict(choice: 'local' | 'remote' | 'merge'): Promise<void> {
  return enqueue(async () => {
    const conflict = store().accountConflict;
    const user = currentUser();
    if (!conflict || !user) return;
    const chosen =
      choice === 'local' ? conflict.local : choice === 'remote' ? conflict.remote : mergeBest(conflict.local, conflict.remote);
    store().setAccountConflict(null);
    adopt(user, chosen, conflict.remoteRevision);
    if (!snapshotsEqual(chosen, conflict.remote)) await push(user, chosen, conflict.remoteRevision);
    else markOk();
  });
}

// ------------------------------------------------------------------ envoi automatique

/** Envoie ce qui a change depuis le dernier envoi, s'il y a quelque chose. */
function pushIfChanged(): Promise<void> {
  return enqueue(async () => {
    const user = currentUser();
    if (!user || !backend || store().accountConflict) return;
    const meta = loadMeta();
    if (!meta || meta.userId !== user.id) return; // pas encore rapproche : reconcile s'en charge
    const local = readProfileSnapshot();
    if (fingerprint(local) === meta.hash) return;
    store().setAccount({ sync: 'syncing' });
    await push(user, local, meta.revision);
  });
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushIfChanged();
  }, PUSH_DELAY_MS);
}

/**
 * Envoie TOUT DE SUITE ce qui attend (le delai de 2 s est une economie, pas une
 * regle) : avant de lire le classement, pour que la partie qu'on vient de jouer y soit.
 */
export async function flushProfile(): Promise<void> {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  await pushIfChanged();
}

/** Les seuls champs dont le changement vaut un envoi : le store bouge tout le temps pendant un match. */
function watchProgress() {
  let prev = pick();
  function pick() {
    const s = store();
    return [s.progression, s.coins, s.ownedItems, s.unlockedAchievements, s.terrainWins, s.onlineWinStreak, s.rank];
  }
  return useGameStore.subscribe(() => {
    const next = pick();
    if (next.every((v, i) => v === prev[i])) return;
    prev = next;
    if (store().account.status === 'signedIn') schedulePush();
  });
}

// ------------------------------------------------------------------ session

function currentUser(): AccountUser | null {
  const a = store().account;
  return a.status === 'signedIn' && a.email !== null && sessionUserId ? { id: sessionUserId, email: a.email } : null;
}
let sessionUserId: string | null = null;

function setSignedIn(user: AccountUser) {
  sessionUserId = user.id;
  store().setAccount({ status: 'signedIn', email: user.email, sync: 'idle' });
}

/**
 * Le repere de synchronisation (`META_KEY`) est CONSERVE a la deconnexion : il est
 * rattache a l'identifiant du compte, donc le meme joueur qui se reconnecte sur cet
 * appareil reprend sans question, et un AUTRE compte, lui, declenche un premier
 * rapprochement. Seule la suppression du compte l'efface.
 */
function setSignedOut() {
  sessionUserId = null;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  store().setAccountConflict(null);
  store().setAccount({ status: 'signedOut', email: null, sync: 'idle', lastSyncAt: null, notice: null, pseudo: null });
}

/** Un compte est possible : le service est configure. */
export function accountAvailable(): boolean {
  ensureBackend();
  return backend !== null;
}

function ensureBackend() {
  if (!backend) backend = createSupabaseBackend();
}

/** Pour les verifications : un faux service a la place de Supabase. */
export function useAccountBackend(custom: AccountBackend | null) {
  backend = custom;
}

/**
 * A appeler une fois, au demarrage. Ne charge le SDK que si une session a ete
 * conservee : un joueur qui n'a jamais ouvert de compte ne telecharge rien.
 */
export async function initAccount(): Promise<void> {
  if (started) return;
  started = true;
  ensureBackend();
  if (!backend) return;
  offStore = watchProgress();

  const comeback = oauthComeback();
  if (comeback === 'error') store().setAccount({ notice: 'oauth-error' });
  if (!hasStoredSession() && comeback !== 'code') return;
  store().setAccount({ status: 'checking' });
  try {
    const user = await backend.restore();
    if (!user) {
      setSignedOut();
      return;
    }
    setSignedIn(user);
    watchAuth();
    await reconcile(user);
    await applyPendingPseudo();
    await refreshPseudo();
  } catch {
    // Hors ligne au demarrage : on reste « connecte » d'apres la session conservee, sans synchroniser.
    store().setAccount({ status: 'signedOut' });
  }
}

/**
 * Retour d'une connexion Google : l'adresse porte `?code=` (a echanger contre la
 * session) ou, si le joueur a refuse / annule, `?error_description=...`. On
 * nettoie l'adresse dans le second cas : le SDK, lui, n'est pas charge.
 */
function oauthComeback(): 'code' | 'error' | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (params.has('error_description') || params.has('error') || hash.has('error_description')) {
      window.history.replaceState({}, document.title, window.location.pathname);
      return 'error';
    }
    if (params.has('code')) return 'code';
  } catch {
    // Pas d'adresse lisible : pas de retour a traiter.
  }
  return null;
}

/** Une session Supabase conservee laisse une cle `sb-...-auth-token` dans le stockage du navigateur. */
function hasStoredSession(): boolean {
  try {
    const ls = window.localStorage;
    if (!ls) return false;
    for (let i = 0; i < ls.length; i += 1) {
      const key = ls.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) return true;
    }
  } catch {
    // Stockage inaccessible : pas de session a retrouver.
  }
  return false;
}

function watchAuth() {
  if (offAuth || !backend) return;
  offAuth = backend.onAuthChange((user) => {
    // Jeton revoque ou compte supprime depuis un autre appareil.
    if (!user && store().account.status === 'signedIn') setSignedOut();
  });
}

export type AuthOutcome =
  | { ok: true; needsEmailConfirmation: boolean }
  | { ok: false; error: AccountErrorCode | 'unavailable' };

async function authenticate(kind: 'signIn' | 'signUp', email: string, password: string): Promise<AuthOutcome> {
  ensureBackend();
  if (!backend) return { ok: false, error: 'unavailable' };
  if (!offStore) offStore = watchProgress();
  const result = await backend[kind](email.trim(), password);
  if (!result.ok) return { ok: false, error: result.error };
  if (result.user) {
    setSignedIn(result.user);
    watchAuth();
    void reconcile(result.user).then(applyPendingPseudo).then(refreshPseudo);
  }
  return { ok: true, needsEmailConfirmation: result.needsEmailConfirmation };
}

/** Adresse du jeu, sans reste d'URL : la ou Google doit nous renvoyer. */
function returnUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

/** Lance la connexion par Google : le navigateur quitte la page, puis revient avec un code. */
export async function signInWithGoogle(): Promise<AuthOutcome> {
  ensureBackend();
  if (!backend) return { ok: false, error: 'unavailable' };
  if (!offStore) offStore = watchProgress();
  store().setAccount({ notice: null });
  const result = await backend.signInWithGoogle(returnUrl());
  return result.ok ? { ok: true, needsEmailConfirmation: false } : { ok: false, error: result.error };
}

export const signInAccount = (email: string, password: string) => authenticate('signIn', email, password);
export function signUpAccount(email: string, password: string, pseudo?: string): Promise<AuthOutcome> {
  // Le pseudo voulu est applique APRES la premiere synchronisation : c'est elle qui cree la ligne du
  // profil en ligne, et le serveur ne sait pas renommer un profil qui n'existe pas encore.
  const check = pseudo ? validatePseudo(pseudo) : null;
  if (check?.ok) savePendingPseudo(check.pseudo);
  return authenticate('signUp', email, password);
}

/**
 * Deconnexion. La progression reste sur l'appareil : se deconnecter n'est pas
 * perdre ses donnees. (Sur un appareil partage, le compte suivant verra donc
 * un premier rapprochement et devra choisir — cf. `reconcileNow`, cas 5.)
 */
export async function signOutAccount(): Promise<void> {
  clearPendingPseudo();
  if (backend) await backend.signOut();
  setSignedOut();
}

/** Supprime le compte et ses donnees en ligne ; la progression locale, elle, reste sur l'appareil. */
export async function deleteAccount(): Promise<boolean> {
  if (!backend) return false;
  const ok = await backend.deleteAccount();
  if (ok) {
    saveMeta(null);
    setSignedOut();
  }
  return ok;
}

// ------------------------------------------------------------------ classement

/** Les meilleurs rangs. Sans compte aussi ; null si le service n'est pas configure, leve si injoignable. */
export async function fetchLeaderboard(limit = 20): Promise<LeaderboardEntry[] | null> {
  ensureBackend();
  if (!backend) return null;
  if (store().account.status === 'signedIn') await flushProfile();
  return backend.getLeaderboard(limit);
}

export async function fetchStanding(): Promise<Standing | null> {
  ensureBackend();
  if (!backend || store().account.status !== 'signedIn') return null;
  return backend.myStanding();
}

// ------------------------------------------------------------------ pseudo choisi

const PENDING_PSEUDO_KEY = 'kubb-kings.pending-pseudo';

function savePendingPseudo(pseudo: string) {
  try {
    window.localStorage?.setItem(PENDING_PSEUDO_KEY, pseudo);
  } catch {
    // Sans stockage, le pseudo voulu est perdu : le joueur gardera celui qu'on lui attribue et pourra le changer.
  }
}

function loadPendingPseudo(): string | null {
  try {
    return window.localStorage?.getItem(PENDING_PSEUDO_KEY) ?? null;
  } catch {
    return null;
  }
}

function clearPendingPseudo() {
  try {
    window.localStorage?.removeItem(PENDING_PSEUDO_KEY);
  } catch {
    // rien a nettoyer
  }
}

/**
 * Applique le pseudo choisi a la creation du compte, une fois le profil en ligne cree. Les echecs
 * passagers (reseau, profil pas encore la, delai) laissent le pseudo en attente pour une prochaine
 * synchronisation ; un refus definitif (pris, interdit...) l'abandonne et previent le joueur : il
 * garde le pseudo attribue et peut en choisir un autre depuis la Boutique.
 */
/** Lit le pseudo sur le serveur pour l'afficher au menu ; en cas d'echec on garde ce qu'on avait. */
async function refreshPseudo(): Promise<void> {
  if (!backend || store().account.status !== 'signedIn') return;
  try {
    const standing = await backend.myStanding();
    if (standing?.pseudo && store().account.status === 'signedIn') store().setAccount({ pseudo: standing.pseudo });
  } catch {
    // Le menu montre simplement l'adresse e-mail seule.
  }
}

async function applyPendingPseudo(): Promise<void> {
  const pending = loadPendingPseudo();
  if (!pending || !backend || store().account.status !== 'signedIn') return;
  const result = await backend.setPseudo(pending);
  if (result.ok) {
    clearPendingPseudo();
    return;
  }
  if (result.error === 'network' || result.error === 'not-ready' || result.error === 'too-soon') return;
  clearPendingPseudo();
  store().setAccount({ notice: result.error === 'taken' ? 'pseudo-taken' : 'pseudo-refused' });
}

export type ChangePseudoResult = { ok: true; pseudo: string } | { ok: false; error: PseudoProblem | PseudoErrorCode };

/** Change son pseudo : les regles du client d'abord (reponse immediate), puis celles du serveur, qui font foi. */
export async function changeMyPseudo(raw: string): Promise<ChangePseudoResult> {
  const check = validatePseudo(raw);
  if (!check.ok) return { ok: false, error: check.reason };
  if (!backend || store().account.status !== 'signedIn') return { ok: false, error: 'network' };
  const result = await backend.setPseudo(check.pseudo);
  if (result.ok) store().setAccount({ pseudo: result.pseudo });
  return result;
}

export async function rerollMyPseudo(): Promise<string | null> {
  if (!backend || store().account.status !== 'signedIn') return null;
  const pseudo = await backend.rerollPseudo();
  if (pseudo) store().setAccount({ pseudo });
  return pseudo;
}

/** Pour les verifications : relance un rapprochement a la demande. */
export function syncNow(): Promise<void> {
  const user = currentUser();
  return user ? reconcile(user) : Promise.resolve();
}

/** Arrete tout (tests). */
export function resetAccountForTests() {
  offAuth?.();
  offStore?.();
  offAuth = null;
  offStore = null;
  backend = null;
  started = false;
  sessionUserId = null;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  busy = Promise.resolve();
}
