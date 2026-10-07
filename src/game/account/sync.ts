import { useGameStore } from '../../store/useGameStore';
import { getBestStage } from '../roguelite';
import { createSupabaseBackend, type AccountBackend, type AccountErrorCode, type AccountUser } from './backend';
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

  const meta = loadMeta();
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

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void enqueue(async () => {
      const user = currentUser();
      if (!user || !backend || store().accountConflict) return;
      const meta = loadMeta();
      if (!meta || meta.userId !== user.id) return; // pas encore rapproche : reconcile s'en charge
      const local = readProfileSnapshot();
      if (fingerprint(local) === meta.hash) return;
      store().setAccount({ sync: 'syncing' });
      await push(user, local, meta.revision);
    });
  }, PUSH_DELAY_MS);
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
  store().setAccount({ status: 'signedOut', email: null, sync: 'idle', lastSyncAt: null });
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

  if (!hasStoredSession()) return;
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
  } catch {
    // Hors ligne au demarrage : on reste « connecte » d'apres la session conservee, sans synchroniser.
    store().setAccount({ status: 'signedOut' });
  }
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
    void reconcile(result.user);
  }
  return { ok: true, needsEmailConfirmation: result.needsEmailConfirmation };
}

export const signInAccount = (email: string, password: string) => authenticate('signIn', email, password);
export const signUpAccount = (email: string, password: string) => authenticate('signUp', email, password);

/**
 * Deconnexion. La progression reste sur l'appareil : se deconnecter n'est pas
 * perdre ses donnees. (Sur un appareil partage, le compte suivant verra donc
 * un premier rapprochement et devra choisir — cf. `reconcileNow`, cas 5.)
 */
export async function signOutAccount(): Promise<void> {
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
