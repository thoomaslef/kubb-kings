import type { MatchRecord, MatchSetup, RecordedThrow } from './protocol';
import type { BatonId } from '../batons';
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
  /**
   * L'invite se presente, en annoncant son projectile : le baton a un effet
   * de jeu (vitesse, deviation, forme du corps), pas seulement cosmetique, et
   * chacun doit jouer avec le sien. L'hote l'integre aux conditions de la
   * partie plutot que de l'imposer, faute de quoi un joueur perdrait l'objet
   * qu'il a achete des qu'il joue en ligne.
   */
  | { kind: 'join'; playerId: string; batonId: BatonId }
  /** L'hote accepte et impose les conditions de la partie. */
  | { kind: 'welcome'; playerId: string; setup: MatchSetup; guestTeam: TeamId }
  /** Un lancer joue, avec son resultat (l'auteur fait autorite). */
  | { kind: 'throw'; entry: RecordedThrow }
  /** Depart volontaire — a distinguer d'une coupure subie. */
  | { kind: 'leave'; playerId: string }
  /**
   * Signe de vie periodique. Indispensable des qu'un VRAI reseau est en
   * jeu : une coupure y est silencieuse (pas de message d'adieu), et sans
   * battement l'autre joueur attendrait indefiniment son tour.
   */
  | { kind: 'ping'; playerId: string }
  /**
   * Remise a niveau d'un joueur qui revient : la partie entiere lui est
   * renvoyee, il la rejoue pour se retrouver dans l'etat exact ou elle en
   * est (cf. MatchScene::replayRecord).
   */
  | { kind: 'resync'; playerId: string; record: MatchRecord }
  /**
   * « Je veux la revanche. » Une simple DEMANDE : relancer sur sa seule
   * decision laisserait l'autre devant son ecran de resultat pendant que la
   * partie a deja repris sans lui.
   */
  | { kind: 'rematch'; playerId: string }
  /**
   * Les deux ont demande : la revanche commence, avec de NOUVELLES conditions
   * (le vent et le premier joueur sont retires au sort). C'est l'hote qui
   * tranche, comme pour la partie initiale — un tirage de chaque cote
   * donnerait deux parties differentes.
   */
  | { kind: 'rematch-start'; playerId: string; setup: MatchSetup };

export interface Transport {
  send(message: OnlineMessage): void;
  /** Renvoie de quoi se desabonner. */
  onMessage(handler: (message: OnlineMessage) => void): () => void;
  close(): void;
}
