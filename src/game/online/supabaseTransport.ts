import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { OnlineMessage, Transport } from './transport';

/**
 * Vrai transport : deux joueurs sur deux APPAREILS differents, via les
 * canaux « broadcast » de Supabase Realtime.
 *
 * Pourquoi Supabase plutot qu'un autre service : le debit du jeu est
 * minuscule (un message par lancer, plus un battement de coeur), si bien que
 * ni la latence ni les quotas ne departageaient les candidats. Ce qui
 * tranchait, c'est la SUITE — classement, chat, page de profil — qui demande
 * une base de donnees et de l'authentification. Supabase apporte les deux
 * dans le meme compte, et son mode broadcast ne demande AUCUN code serveur :
 * le deploiement reste un simple site statique.
 *
 * Le module reste un simple `Transport` : la session, le protocole et la
 * scene ignorent jusqu'a son existence. En changer ne coute que ce fichier.
 */

/** Meme convention de nom que le transport local : un canal par salon. */
const CHANNEL_PREFIX = 'kubb-kings.room.';
/** Un seul type d'evenement : le tri se fait deja dans `OnlineMessage.kind`. */
const EVENT = 'coup';

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Coordonnees du projet, injectees a la compilation (cf. `.env.example`).
 *
 * Ces deux valeurs sont PUBLIQUES par conception : Vite les inscrit dans le
 * bundle, et n'importe qui peut les lire dans le site livre. Ce n'est pas une
 * negligence — la cle `anon` est faite pour ca, et ce sont les regles d'acces
 * cote Supabase (RLS) qui protegent les donnees, jamais le secret de la cle.
 */
export function supabaseConfig(): SupabaseConfig | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  return url && anonKey ? { url, anonKey } : null;
}

export function isSupabaseConfigured(): boolean {
  return supabaseConfig() !== null;
}

/**
 * Client partage, charge A LA DEMANDE. Le `import()` dynamique garde le SDK
 * hors du bundle principal : un joueur qui ne touche jamais au mode en ligne
 * ne telecharge pas une ligne de Supabase.
 */
let clientPromise: Promise<SupabaseClient> | null = null;

function getClient(config: SupabaseConfig): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(config.url, config.anonKey, {
        // Aucun compte pour l'instant : rien a retenir entre deux visites.
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 20 } }
      })
    );
  }
  return clientPromise;
}

/**
 * @param onError appele si la liaison ne peut pas s'etablir (projet
 * injoignable, cle invalide). Sans lui, le salon tournerait indefiniment sur
 * « en attente de l'adversaire » alors que personne n'ecoute.
 */
export function createSupabaseTransport(roomCode: string, onError?: () => void): Transport {
  const handlers = new Set<(message: OnlineMessage) => void>();
  /**
   * Messages emis avant que le canal soit pret. Indispensable ici, alors que
   * le transport local n'en avait pas besoin : l'abonnement Supabase est
   * ASYNCHRONE, et `OnlineSession.join()` envoie son `join` des sa
   * construction. Sans cette file, le tout premier message — celui qui
   * declenche la partie — serait perdu.
   */
  const pending: OnlineMessage[] = [];
  let channel: RealtimeChannel | null = null;
  let closed = false;

  const fail = () => {
    if (closed) return;
    closed = true;
    onError?.();
  };

  const flush = () => {
    if (!channel) return;
    const queued = pending.splice(0, pending.length);
    for (const message of queued) void channel.send({ type: 'broadcast', event: EVENT, payload: message });
  };

  const connect = async () => {
    const config = supabaseConfig();
    if (!config) {
      fail();
      return;
    }
    try {
      const client = await getClient(config);
      if (closed) return;
      const opened = client.channel(CHANNEL_PREFIX + roomCode.toUpperCase(), {
        // `self: false` reproduit BroadcastChannel : on ne recoit jamais ses
        // propres messages, ce sur quoi la session compte.
        config: { broadcast: { self: false, ack: false } }
      });
      opened.on('broadcast', { event: EVENT }, ({ payload }) => {
        // Copie : un handler peut se desabonner pendant l'iteration.
        for (const handler of [...handlers]) handler(payload as OnlineMessage);
      });
      opened.subscribe((status) => {
        if (closed) return;
        if (status === 'SUBSCRIBED') {
          channel = opened;
          flush();
          return;
        }
        // 'CLOSED' arrive aussi quand c'est NOUS qui fermons : le garde
        // `closed` ci-dessus evite d'annoncer une panne a ce moment-la.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') fail();
      });
    } catch {
      // Chargement du SDK impossible (hors ligne, blocage reseau).
      fail();
    }
  };

  void connect();

  return {
    send(message) {
      if (closed) return;
      if (!channel) {
        pending.push(message);
        return;
      }
      // Un envoi refuse n'est pas traite ici : une liaison morte est deja
      // detectee par le battement de coeur de la session (cf. session.ts),
      // et c'est le seul endroit ou la decision a du sens.
      void channel.send({ type: 'broadcast', event: EVENT, payload: message });
    },
    onMessage(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    close() {
      closed = true;
      handlers.clear();
      pending.length = 0;
      void channel?.unsubscribe();
      channel = null;
    }
  };
}
