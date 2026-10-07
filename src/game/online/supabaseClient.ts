import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Coordonnees du projet, injectees a la compilation (cf. `.env.example`).
 *
 * La cle attendue est celle destinee au navigateur : l'ancienne cle `anon`
 * ou la nouvelle cle « publishable » (`sb_publishable_...`) — les deux se
 * passent au meme endroit, le SDK ne fait pas la difference.
 *
 * Ces deux valeurs sont PUBLIQUES par conception : Vite les inscrit dans le
 * bundle, et n'importe qui peut les lire dans le site livre. Ce sont les
 * regles d'acces cote Supabase (RLS) qui protegent les donnees, jamais le
 * secret de la cle.
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function supabaseConfig(): SupabaseConfig | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  return url && anonKey ? { url, anonKey } : null;
}

export function isSupabaseConfigured(): boolean {
  return supabaseConfig() !== null;
}

/**
 * Client UNIQUE, partage par le transport temps reel (parties en ligne) et le
 * compte joueur : deux clients se disputeraient la meme session. Charge A LA
 * DEMANDE — le `import()` dynamique garde le SDK hors du bundle principal : un
 * joueur qui ne touche ni au mode en ligne ni a son compte ne telecharge pas
 * une ligne de Supabase.
 *
 * La session est CONSERVEE (stockage du navigateur) et renouvelee seule : c'est
 * ce qui permet de rester connecte d'une visite a l'autre.
 */
let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabaseClient(config: SupabaseConfig): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        realtime: { params: { eventsPerSecond: 20 } }
      })
    );
  }
  return clientPromise;
}
