import type { TeamId } from './entities/teamData';

/**
 * Issue d'une partie. Volontairement isolee du store : c'est une donnee de
 * JEU, et elle doit pouvoir voyager sur le reseau (online/protocol.ts) ou
 * etre relue par un futur serveur, sans embarquer Zustand au passage. Le
 * store la re-exporte pour que rien n'ait a changer cote UI.
 */

export type WinReason =
  | 'king-down'
  | 'king-early'
  | 'timeout'
  | 'throws-exhausted';

export interface MatchResult {
  winner: TeamId | 'draw';
  reason: WinReason;
  /** Kubbs adverses abattus par chaque equipe, pour l'ecran de fin. */
  knockedDown: Record<TeamId, number>;
}
