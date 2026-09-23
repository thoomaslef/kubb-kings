import { checkSeq, isCompatible, type MatchSetup, type RecordedThrow } from './protocol';
import type { OnlineMessage, Transport } from './transport';
import type { TeamId } from '../entities/teamData';

/**
 * Une partie a deux, au-dessus d'un `Transport` quelconque.
 *
 * Responsabilites, et rien de plus : la poignee de main, qui tient quel
 * camp, et la verification du numero d'ordre des coups. Elle ne connait ni
 * Phaser, ni le store, ni l'interface — c'est la scene qui vient s'y
 * abonner.
 *
 * Repartition des camps : l'hote tient Bleue, l'invite Rouge. La regle est
 * transmise explicitement dans le message d'accueil (`guestTeam`) plutot
 * que deduite de chaque cote, pour qu'elle n'existe qu'a un seul endroit et
 * puisse changer (tirage au sort, alternance) sans toucher l'invite.
 */

export type SessionRole = 'host' | 'guest';
export type SessionState = 'connecting' | 'ready' | 'closed';

/** Pourquoi la partie s'est arretee — tout n'est pas un abandon. */
export type CloseReason =
  /** L'autre joueur est parti volontairement. */
  | 'parti'
  /** On a quitte soi-meme. */
  | 'quitte'
  /** Un coup manque : impossible de continuer sans se desynchroniser. */
  | 'desynchronise'
  /** Protocoles incompatibles (versions differentes). */
  | 'incompatible';

type Listener<T> = (value: T) => void;

export class OnlineSession {
  readonly role: SessionRole;
  readonly playerId: string;
  private readonly transport: Transport;
  private readonly unsubscribe: () => void;

  private _state: SessionState = 'connecting';
  private _setup: MatchSetup | null;
  private _localTeam: TeamId | null;
  /**
   * Prochain numero de coup attendu. Partage par les deux camps : les
   * lancers des deux joueurs forment UNE seule suite (cf. protocol.ts), si
   * bien qu'un coup local envoye et un coup distant recu font tous deux
   * avancer ce compteur.
   */
  private expectedSeq = 0;

  private readyListeners = new Set<Listener<void>>();
  private throwListeners = new Set<Listener<RecordedThrow>>();
  private closeListeners = new Set<Listener<CloseReason>>();

  private constructor(transport: Transport, role: SessionRole, playerId: string, setup: MatchSetup | null) {
    this.transport = transport;
    this.role = role;
    this.playerId = playerId;
    this._setup = setup;
    this._localTeam = role === 'host' ? 'blue' : null;
    this.unsubscribe = transport.onMessage((message) => this.handle(message));
  }

  /** L'hote impose les conditions : c'est lui qui a tire le vent et le terrain. */
  static host(transport: Transport, setup: MatchSetup, playerId: string): OnlineSession {
    return new OnlineSession(transport, 'host', playerId, setup);
  }

  /** L'invite ne connait rien de la partie tant qu'il n'a pas ete accueilli. */
  static join(transport: Transport, playerId: string): OnlineSession {
    const session = new OnlineSession(transport, 'guest', playerId, null);
    transport.send({ kind: 'join', playerId });
    return session;
  }

  get state(): SessionState {
    return this._state;
  }

  /** Conditions de la partie ; null tant que l'invite n'a pas ete accueilli. */
  get setup(): MatchSetup | null {
    return this._setup;
  }

  /** Camp tenu par CE joueur ; null tant que la partie n'est pas etablie. */
  get localTeam(): TeamId | null {
    return this._localTeam;
  }

  onReady(fn: Listener<void>): () => void {
    this.readyListeners.add(fn);
    return () => this.readyListeners.delete(fn);
  }

  onRemoteThrow(fn: Listener<RecordedThrow>): () => void {
    this.throwListeners.add(fn);
    return () => this.throwListeners.delete(fn);
  }

  onClosed(fn: Listener<CloseReason>): () => void {
    this.closeListeners.add(fn);
    return () => this.closeListeners.delete(fn);
  }

  /**
   * Envoie un lancer deja joue localement. Le numero d'ordre doit etre celui
   * attendu : s'il ne l'est pas, c'est que l'appelant et la session ne
   * comptent pas la meme chose, et mieux vaut le voir tout de suite.
   */
  sendThrow(entry: RecordedThrow) {
    if (this._state !== 'ready') return;
    if (entry.seq !== this.expectedSeq) {
      this.close('desynchronise');
      return;
    }
    this.expectedSeq += 1;
    this.transport.send({ kind: 'throw', entry });
  }

  /** Depart volontaire : on previent l'autre avant de fermer. */
  leave() {
    if (this._state === 'closed') return;
    this.transport.send({ kind: 'leave', playerId: this.playerId });
    this.close('quitte');
  }

  private handle(message: OnlineMessage) {
    if (this._state === 'closed') return;

    switch (message.kind) {
      case 'join': {
        // Seul l'hote accueille. Un 'join' repete (invite qui recharge sa
        // page) doit rester sans danger : on re-accueille, sans rien casser.
        if (this.role !== 'host' || !this._setup) return;
        this.transport.send({
          kind: 'welcome',
          playerId: this.playerId,
          setup: this._setup,
          guestTeam: 'red'
        });
        this.becomeReady();
        return;
      }

      case 'welcome': {
        if (this.role !== 'guest' || this._state === 'ready') return;
        if (!isCompatible(message.setup)) {
          this.close('incompatible');
          return;
        }
        this._setup = message.setup;
        this._localTeam = message.guestTeam;
        this.becomeReady();
        return;
      }

      case 'throw': {
        if (this._state !== 'ready') return;
        const verdict = checkSeq(this.expectedSeq, message.entry.seq);
        // Un doublon est benin (message rejoue) : on l'ignore. Un coup
        // manquant ne l'est pas — rejouer la suite donnerait deux parties
        // differentes, il faut donc s'arreter franchement.
        if (verdict === 'doublon') return;
        if (verdict === 'manquant') {
          this.close('desynchronise');
          return;
        }
        this.expectedSeq += 1;
        for (const fn of [...this.throwListeners]) fn(message.entry);
        return;
      }

      case 'leave':
        this.close('parti');
    }
  }

  private becomeReady() {
    if (this._state === 'ready') return;
    this._state = 'ready';
    for (const fn of [...this.readyListeners]) fn();
  }

  private close(reason: CloseReason) {
    if (this._state === 'closed') return;
    this._state = 'closed';
    this.unsubscribe();
    this.transport.close();
    for (const fn of [...this.closeListeners]) fn(reason);
  }
}
