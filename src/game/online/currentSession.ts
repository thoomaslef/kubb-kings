import type { OnlineSession } from './session';

/**
 * Session en ligne active, partagee entre l'interface React (qui la cree
 * depuis le salon) et la scene Phaser (qui s'y abonne au lancement du
 * match) — sur le meme principe que `GameBridge` : un point d'accroche
 * module, parce que les deux mondes ne peuvent pas se passer d'objets
 * directement.
 *
 * Volontairement minuscule : aucune logique ici, seulement la reference.
 */
let current: OnlineSession | null = null;

export function setCurrentSession(session: OnlineSession | null) {
  current = session;
}

export function getCurrentSession(): OnlineSession | null {
  return current;
}
