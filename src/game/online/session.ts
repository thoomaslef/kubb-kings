import { checkSeq, isCompatible, type MatchRecord, type MatchSetup, type RecordedThrow } from './protocol';
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

/**
 * Battement de coeur. Avec le faux transport local, une coupure n'existe
 * pas ; sur un vrai reseau elle est SILENCIEUSE — pas de message d'adieu,
 * juste plus rien. Sans ces deux reglages, le joueur reste devant un
 * plateau fige a attendre un tour qui ne viendra jamais.
 */
const HEARTBEAT_MS = 3000;
/** Sans le moindre signe de vie pendant ce delai, on declare la liaison perdue. */
export const CONNECTION_TIMEOUT_MS = 10000;

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
  | 'incompatible'
  /** Plus aucun signe de vie : liaison coupee sans que l'autre ait pu prevenir. */
  | 'perdu';

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

  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private lastSeenAt = Date.now();
  /**
   * Partie a renvoyer a un joueur qui revient. Fournie par la scene, qui
   * seule connait l'etat courant — la session ne stocke rien d'elle-meme.
   */
  private recordProvider: (() => MatchRecord) | null = null;
  /**
   * Partie recue avant que la scene ne soit la pour l'entendre. Au retour
   * d'un joueur, l'hote renvoie la partie dans la foulee de l'accueil,
   * alors que la scene, elle, ne demarre qu'a la frame suivante : sans cette
   * retenue le message arriverait dans le vide et l'arrivant reprendrait sur
   * un plateau vierge.
   */
  private pendingResync: MatchRecord | null = null;

  private readyListeners = new Set<Listener<void>>();
  private resyncListeners = new Set<Listener<MatchRecord>>();
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

  /**
   * Branche de quoi remettre a niveau un joueur qui revient. Sans cela une
   * reprise est impossible : l'arrivant n'a aucun moyen de savoir ou en est
   * la partie.
   */
  provideRecord(provider: () => MatchRecord) {
    this.recordProvider = provider;
  }

  /** La partie complete vient d'etre renvoyee : il faut la rejouer pour se remettre a niveau. */
  onResync(fn: Listener<MatchRecord>): () => void {
    this.resyncListeners.add(fn);
    // Partie arrivee avant l'abonnement : on la sert tout de suite, une fois.
    if (this.pendingResync) {
      const record = this.pendingResync;
      this.pendingResync = null;
      fn(record);
    }
    return () => this.resyncListeners.delete(fn);
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
    // N'importe quel message prouve que l'autre est toujours la.
    this.lastSeenAt = Date.now();

    switch (message.kind) {
      case 'join': {
        // Seul l'hote accueille. Un 'join' repete (invite qui recharge sa
        // page) doit rester sans danger : on re-accueille, sans rien casser.
        if (this.role !== 'host' || !this._setup) return;
        const wasReady = this._state === 'ready';
        this.transport.send({
          kind: 'welcome',
          playerId: this.playerId,
          setup: this._setup,
          guestTeam: 'red'
        });
        this.becomeReady();
        // 'join' alors que la partie tournait deja : l'invite revient apres
        // une coupure ou un rechargement. On lui renvoie la partie entiere
        // plutot que de le laisser reprendre sur un plateau vierge.
        if (wasReady && this.recordProvider) {
          this.transport.send({ kind: 'resync', playerId: this.playerId, record: this.recordProvider() });
        }
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

      case 'resync': {
        // La suite des coups repart de zero avec la partie renvoyee.
        this.expectedSeq = message.record.throws.length;
        if (this.resyncListeners.size === 0) {
          this.pendingResync = message.record;
          return;
        }
        for (const fn of [...this.resyncListeners]) fn(message.record);
        return;
      }

      case 'ping':
        // Le signe de vie a deja ete pris en compte plus haut.
        return;

      case 'leave':
        this.close('parti');
    }
  }

  private becomeReady() {
    if (this._state === 'ready') return;
    this._state = 'ready';
    this.lastSeenAt = Date.now();
    this.heartbeat = setInterval(() => this.beat(), HEARTBEAT_MS);
    for (const fn of [...this.readyListeners]) fn();
  }

  /** Un signe de vie sortant, et un controle du silence entrant. */
  private beat() {
    if (this._state !== 'ready') return;
    if (Date.now() - this.lastSeenAt > CONNECTION_TIMEOUT_MS) {
      this.close('perdu');
      return;
    }
    this.transport.send({ kind: 'ping', playerId: this.playerId });
  }

  private close(reason: CloseReason) {
    if (this._state === 'closed') return;
    this._state = 'closed';
    if (this.heartbeat !== null) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    this.unsubscribe();
    this.transport.close();
    for (const fn of [...this.closeListeners]) fn(reason);
  }
}
