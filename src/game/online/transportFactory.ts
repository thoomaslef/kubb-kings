import type { Transport } from './transport';
import { createLocalTransport, isLocalTransportAvailable } from './localTransport';
import { createSupabaseTransport, isSupabaseConfigured } from './supabaseTransport';

/**
 * Choisit le tuyau, et lui seul : tout le reste du mode en ligne ignore
 * lequel des deux tourne.
 *
 * L'ordre n'est pas un hasard. Supabase des qu'il est configure, sinon le
 * transport local — qui reste utile et n'est pas un lot de consolation : il
 * fait tourner le mode en ligne sans reseau ni compte, ce qui permet de
 * developper et de verifier le jeu hors connexion.
 */
export type TransportKind =
  /** Vrai reseau : l'adversaire peut etre n'importe ou. */
  | 'supabase'
  /** Deux onglets du meme navigateur. */
  | 'local'
  /** Ni l'un ni l'autre : le mode en ligne n'est pas disponible ici. */
  | 'aucun';

export function transportKind(): TransportKind {
  if (isSupabaseConfigured()) return 'supabase';
  if (isLocalTransportAvailable()) return 'local';
  return 'aucun';
}

/**
 * @param onError signale une liaison qui n'a pas pu s'etablir. Le transport
 * local, lui, ne peut pas echouer : il n'a personne a joindre.
 */
export function createMatchTransport(roomCode: string, onError?: () => void): Transport {
  return transportKind() === 'supabase'
    ? createSupabaseTransport(roomCode, onError)
    : createLocalTransport(roomCode);
}
