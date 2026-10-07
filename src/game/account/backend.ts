import type { AuthError, Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, supabaseConfig } from '../online/supabaseClient';

/**
 * Le compte joueur contre un service : une interface, et rien d'autre.
 *
 * Meme principe que online/transport.ts : tout le reste (synchronisation,
 * interface, tests) s'ecrit contre cette interface, jamais contre Supabase.
 * Aujourd'hui une seule implementation, `createSupabaseBackend` ; changer de
 * prestataire ne couterait que ce fichier.
 */

export interface AccountUser {
  id: string;
  email: string;
}

export type AccountErrorCode =
  | 'invalid-credentials'
  | 'email-taken'
  | 'weak-password'
  | 'invalid-email'
  | 'rate-limited'
  | 'network'
  | 'unknown';

export type AuthResult =
  | { ok: true; user: AccountUser | null; needsEmailConfirmation: boolean }
  | { ok: false; error: AccountErrorCode };

export interface RemoteProfile {
  data: unknown;
  revision: number;
}

export type SaveResult =
  | { ok: true; revision: number }
  /** Quelqu'un (un autre appareil) a ecrit entre-temps : il faut relire avant de reecrire. */
  | { ok: false; conflict: true }
  | { ok: false; conflict: false; error: AccountErrorCode };

export interface AccountBackend {
  /** Session conservee d'une visite precedente, ou null. */
  restore(): Promise<AccountUser | null>;
  signUp(email: string, password: string): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  /**
   * Connexion par Google : redirige le navigateur vers Google, qui nous renvoie
   * sur `redirectTo` (le retour est repris par `restore()` au chargement suivant).
   */
  signInWithGoogle(redirectTo: string): Promise<{ ok: true } | { ok: false; error: AccountErrorCode }>;
  signOut(): Promise<void>;
  /** null : le compte n'a pas encore de profil enregistre. Leve en cas de panne reseau. */
  loadProfile(): Promise<RemoteProfile | null>;
  /** Ecriture optimiste : n'aboutit que si la revision attendue est encore la bonne. */
  saveProfile(data: unknown, expectedRevision: number): Promise<SaveResult>;
  /** Supprime le compte ET son profil (cf. supabase/comptes.sql). */
  deleteAccount(): Promise<boolean>;
  /** Appelee quand la session change hors de nos actions (jeton revoque, compte supprime ailleurs). */
  onAuthChange(callback: (user: AccountUser | null) => void): () => void;
}

/** Traduit une erreur du service en un code que l'interface sait expliquer. */
export function mapAuthError(error: Pick<AuthError, 'code' | 'message' | 'status' | 'name'> | null | undefined): AccountErrorCode {
  if (!error) return 'unknown';
  const code = (error.code ?? '').toString();
  const message = (error.message ?? '').toLowerCase();
  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) return 'invalid-credentials';
  if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered')) return 'email-taken';
  if (code === 'weak_password' || message.includes('password should be')) return 'weak-password';
  if (code === 'email_address_invalid' || code === 'validation_failed' || message.includes('invalid email')) return 'invalid-email';
  if (error.status === 429 || code.includes('rate_limit') || message.includes('rate limit')) return 'rate-limited';
  if (error.name === 'AuthRetryableFetchError' || error.status === 0 || message.includes('fetch')) return 'network';
  return 'unknown';
}

function toUser(session: Session | null | undefined): AccountUser | null {
  const u = session?.user;
  return u ? { id: u.id, email: u.email ?? '' } : null;
}

export function createSupabaseBackend(): AccountBackend | null {
  const config = supabaseConfig();
  if (!config) return null;
  const client = (): Promise<SupabaseClient> => getSupabaseClient(config);

  return {
    async restore() {
      const { data } = await (await client()).auth.getSession();
      return toUser(data.session);
    },

    async signUp(email, password) {
      try {
        const { data, error } = await (await client()).auth.signUp({ email, password });
        if (error) return { ok: false, error: mapAuthError(error) };
        // Service configure avec confirmation d'e-mail : aucune session tant que le lien n'est pas clique.
        // (Et une adresse deja inscrite revient sans identite : meme reponse que « deja prise ».)
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          return { ok: false, error: 'email-taken' };
        }
        return { ok: true, user: toUser(data.session), needsEmailConfirmation: !data.session };
      } catch {
        return { ok: false, error: 'network' };
      }
    },

    async signIn(email, password) {
      try {
        const { data, error } = await (await client()).auth.signInWithPassword({ email, password });
        if (error) return { ok: false, error: mapAuthError(error) };
        return { ok: true, user: toUser(data.session), needsEmailConfirmation: false };
      } catch {
        return { ok: false, error: 'network' };
      }
    },

    async signInWithGoogle(redirectTo) {
      try {
        const { error } = await (await client()).auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
        return error ? { ok: false, error: mapAuthError(error) } : { ok: true };
      } catch {
        return { ok: false, error: 'network' };
      }
    },

    async signOut() {
      try {
        await (await client()).auth.signOut();
      } catch {
        // Hors ligne : la session locale est quand meme effacee par le SDK.
      }
    },

    async loadProfile() {
      const { data, error } = await (await client()).rpc('load_profile');
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return { data: row.data, revision: Number(row.revision) || 0 };
    },

    async saveProfile(data, expectedRevision) {
      try {
        const { data: result, error } = await (await client()).rpc('save_profile', {
          p_data: data,
          p_expected_revision: expectedRevision
        });
        if (error) return { ok: false, conflict: false, error: 'unknown' };
        const revision = Number(result);
        if (revision < 0) return { ok: false, conflict: true };
        return { ok: true, revision };
      } catch {
        return { ok: false, conflict: false, error: 'network' };
      }
    },

    async deleteAccount() {
      try {
        const c = await client();
        const { error } = await c.rpc('delete_my_account');
        if (error) return false;
        await c.auth.signOut();
        return true;
      } catch {
        return false;
      }
    },

    onAuthChange(callback) {
      let unsubscribe = () => {};
      let cancelled = false;
      void client().then((c) => {
        if (cancelled) return;
        const { data } = c.auth.onAuthStateChange((_event, session) => callback(toUser(session)));
        unsubscribe = () => data.subscription.unsubscribe();
      });
      return () => {
        cancelled = true;
        unsubscribe();
      };
    }
  };
}
