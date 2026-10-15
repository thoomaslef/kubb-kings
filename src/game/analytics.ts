import { supabaseConfig } from './online/supabaseClient';
import { version } from '../../package.json';

/**
 * Mesure d'usage ANONYME : combien de parties, dans quels modes, combien d'abandons, et si quelqu'un revient le lendemain.
 *
 * Ce qui part (cf. supabase/mesure.sql, qui est la liste de reference et qui rejette le reste) : un identifiant ALEATOIRE
 * propre a l'appareil — sans lien avec un compte, un e-mail ou un pseudo —, un nom d'evenement, un mode de jeu, une issue,
 * une duree en secondes, la version du jeu. Aucune adresse IP n'est enregistree par nous, aucun texte libre n'existe.
 * Declare dans les pages legales ; coupable dans Options ; coupee d'office si le navigateur envoie « Do Not Track ».
 *
 * Pas de SDK : une simple requete `fetch` vers la fonction SQL `track_usage`. Un joueur qui n'a jamais ouvert un compte ni
 * le mode en ligne ne telecharge donc toujours pas une ligne de Supabase — et sans projet configure, tout ceci est inerte.
 */

export type UsageName = 'session_start' | 'match_start' | 'match_end' | 'match_abandon' | 'search';
export type UsageMode = 'solo' | 'local' | '2v2' | 'defi' | 'friend' | 'ranked' | 'bot';
export type UsageResult = 'win' | 'loss' | 'draw' | 'matched' | 'bot' | 'cancelled';

export interface UsageEvent {
  name: UsageName;
  mode?: UsageMode;
  result?: UsageResult;
  seconds?: number;
  version: string;
}

const KEY = 'kubb-kings.analytics';
/** Delai avant l'envoi d'un lot, et taille maximale d'un lot (le serveur en accepte 20 par appel). */
const FLUSH_MS = 15_000;
const BATCH = 20;
/** File bornee : sans reseau, on jette le plus ancien plutot que d'enfler. */
const QUEUE_MAX = 60;

interface Stored {
  id: string;
  enabled: boolean;
}

let queue: UsageEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let hooked = false;

function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Repli (contextes non securises) : 16 octets aleatoires mis en forme d'UUID v4.
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function read(): Stored | null {
  try {
    const raw = window.localStorage?.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Stored>;
    return typeof p.id === 'string' && /^[0-9a-f-]{36}$/.test(p.id) ? { id: p.id, enabled: p.enabled !== false } : null;
  } catch {
    return null;
  }
}

function write(s: Stored) {
  try {
    window.localStorage?.setItem(KEY, JSON.stringify(s));
  } catch {
    // Sans stockage, l'identifiant change a chaque visite : on mesure alors des visites, pas des appareils. Sans danger.
  }
}

/** Le navigateur demande de ne pas etre suivi : on s'en tient la, quoi qu'il y ait dans le stockage. */
function doNotTrack(): boolean {
  try {
    const nav = navigator as Navigator & { msDoNotTrack?: string };
    return nav.doNotTrack === '1' || nav.msDoNotTrack === '1' || (window as unknown as { doNotTrack?: string }).doNotTrack === '1';
  } catch {
    return false;
  }
}

/** La mesure est-elle active (projet configure, pas de « Do Not Track », pas coupee par le joueur) ? */
export function analyticsEnabled(): boolean {
  return supabaseConfig() !== null && !doNotTrack() && (read()?.enabled ?? true);
}

/** Le projet de mesure est-il configure ? Sans lui, Options ne propose rien. */
export function analyticsAvailable(): boolean {
  return supabaseConfig() !== null;
}

/** Choix du joueur (Options). Couper efface aussi ce qui attendait d'etre envoye. */
export function setAnalyticsEnabled(enabled: boolean) {
  const current = read();
  write({ id: current?.id ?? newId(), enabled });
  if (!enabled) queue = [];
}

/** La case a cocher dans Options : le choix du joueur, independamment de « Do Not Track ». */
export function analyticsChoice(): boolean {
  return read()?.enabled ?? true;
}

function identifier(): string {
  const current = read();
  if (current) return current.id;
  const id = newId();
  write({ id, enabled: true });
  return id;
}

function clampSeconds(s: number | undefined): number | undefined {
  if (s === undefined || !Number.isFinite(s)) return undefined;
  return Math.min(86_400, Math.max(0, Math.round(s)));
}

/** Construit l'evenement tel qu'il partira (exporte pour les verifications : c'est tout ce qui quitte l'appareil). */
export function buildUsageEvent(name: UsageName, fields: { mode?: UsageMode; result?: UsageResult; seconds?: number } = {}): UsageEvent {
  const event: UsageEvent = { name, version };
  if (fields.mode) event.mode = fields.mode;
  if (fields.result) event.result = fields.result;
  const seconds = clampSeconds(fields.seconds);
  if (seconds !== undefined) event.seconds = seconds;
  return event;
}

export function track(name: UsageName, fields: { mode?: UsageMode; result?: UsageResult; seconds?: number } = {}) {
  if (!analyticsEnabled()) return;
  hook();
  // L'identifiant est ecrit TOUT DE SUITE : ecrit au moment de l'envoi (a la fermeture de la page), le navigateur peut
  // perdre l'ecriture, et un meme appareil se ferait alors compter deux fois.
  identifier();
  queue.push(buildUsageEvent(name, fields));
  if (queue.length > QUEUE_MAX) queue = queue.slice(-QUEUE_MAX);
  if (queue.length >= BATCH) void flush();
  else if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS);
}

/** Envoie ce qui attend. Un echec n'est jamais reessaye en boucle : on perd ce lot, sans bruit. */
export async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const config = supabaseConfig();
  if (!config || queue.length === 0 || !analyticsEnabled()) {
    queue = analyticsEnabled() ? queue : [];
    return;
  }
  const lot = queue.slice(0, BATCH);
  queue = queue.slice(lot.length);
  try {
    await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/rpc/track_usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
      body: JSON.stringify({ p_anon: identifier(), p_events: lot }),
      // Part meme si la page se ferme dans la foulee.
      keepalive: true
    });
  } catch {
    // Perdu : une mesure ne doit jamais gener le jeu.
  }
  if (queue.length > 0) timer = setTimeout(() => void flush(), 1000);
}

function hook() {
  if (hooked) return;
  hooked = true;
  try {
    // Fermer l'onglet ou passer en arriere-plan : dernier moment sur d'envoyer.
    window.addEventListener('pagehide', () => void flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush();
    });
  } catch {
    // Pas de fenetre (tests unitaires) : rien a brancher.
  }
}

/** Pour les verifications seulement. */
export function resetAnalyticsForTests() {
  queue = [];
  if (timer) clearTimeout(timer);
  timer = null;
}
