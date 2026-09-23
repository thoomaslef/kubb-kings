import type { MatchSetup, RecordedThrow } from './protocol';
import type { TeamId } from '../entities/teamData';

/**
 * Le tuyau, et rien d'autre.
 *
 * Tout le mode en ligne est ecrit contre cette interface — jamais contre un
 * prestataire. Aujourd'hui la seule implementation est un faux transport
 * local (deux onglets du meme navigateur, `localTransport.ts`), ce qui
 * permet de construire et de verifier la totalite du jeu en ligne sans
 * ouvrir le moindre compte ni payer quoi que ce soit. Le jour ou un vrai
 * service est branche, c'est un adaptateur de plus, pas une reecriture.
 *
 * Contraintes volontaires, pour qu'un service reel puisse s'y conformer :
 * - messages serialisables en JSON, rien d'autre ;
 * - aucune garantie d'ordre supposee (le numero d'ordre du protocole s'en
 *   charge, cf. protocol.ts::checkSeq) ;
 * - aucune notion de duree ni de reconnexion ici : c'est a la couche du
 *   dessus (session.ts) de decider quoi faire d'une coupure.
 */

/** Ce qui circule entre deux joueurs. Volontairement peu de cas. */
export type OnlineMessage =
  /** L'invite se presente. */
  | { kind: 'join'; playerId: string }
  /** L'hote accepte et impose les conditions de la partie. */
  | { kind: 'welcome'; playerId: string; setup: MatchSetup; guestTeam: TeamId }
  /** Un lancer joue, avec son resultat (l'auteur fait autorite). */
  | { kind: 'throw'; entry: RecordedThrow }
  /** Depart volontaire — a distinguer d'une coupure subie. */
  | { kind: 'leave'; playerId: string };

export interface Transport {
  send(message: OnlineMessage): void;
  /** Renvoie de quoi se desabonner. */
  onMessage(handler: (message: OnlineMessage) => void): () => void;
  close(): void;
}
