import {
  checkSeq,
  isCompatible,
  type MatchRecord,
  type MatchSetup,
  type PlayerCard,
  type RecordedThrow
} from './protocol';
import type { OnlineMessage, Transport } from './transport';
import type { TeamId } from '../entities/teamData';
import type { BatonId } from '../batons';

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
   * Conditions d'une revanche, tirees par l'hote. Fournies de l'exterieur : la
   * session ne connait ni le vent ni les terrains, et ne doit pas les
   * connaitre.
   */
  private rematchSetupProvider: (() => MatchSetup) | null = null;
  /**
   * Qui a deja demande la revanche. Tenu par l'HOTE seul, qui arbitre : il
   * faut les deux accords avant de relancer, sinon l'un rejoue pendant que
   * l'autre regarde encore son resultat.
   */
  private rematchWanted = { host: false, guest: false };
  /**
   * Partie recue avant que la scene ne soit la pour l'entendre. Au retour
   * d'un joueur, l'hote renvoie la partie dans la foulee de l'accueil,
   * alors que la scene, elle, ne demarre qu'a la frame suivante : sans cette
   * retenue le message arriverait dans le vide et l'arrivant reprendrait sur
   * un plateau vierge.
   */
  private pendingResync: MatchRecord | null = null;
  /** Ce qu'on annonce de soi a l'autre (cf. protocol.ts::PlayerCard). */
  private readonly card: PlayerCard;
  private _opponentCard: PlayerCard | null = null;

  private readyListeners = new Set<Listener<void>>();
  private rematchAskedListeners = new Set<Listener<void>>();
  private rematchListeners = new Set<Listener<MatchSetup>>();
  private resyncListeners = new Set<Listener<MatchRecord>>();
  private throwListeners = new Set<Listener<RecordedThrow>>();
  private closeListeners = new Set<Listener<CloseReason>>();

  private constructor(
    transport: Transport,
    role: SessionRole,
    playerId: string,
    setup: MatchSetup | null,
    card: PlayerCard
  ) {
    this.transport = transport;
    this.role = role;
    this.playerId = playerId;
    this._setup = setup;
    this.card = card;
    this._localTeam = role === 'host' ? 'blue' : null;
    this.unsubscribe = transport.onMessage((message) => this.handle(message));
  }

  /**
   * L'hote impose les conditions : c'est lui qui a tire le vent et le terrain.
   * Son propre projectile est deja dans `setup.batons` ; celui de l'invite y
   * sera inscrit a l'accueil.
   */
  static host(transport: Transport, setup: MatchSetup, playerId: string, card: PlayerCard): OnlineSession {
    return new OnlineSession(transport, 'host', playerId, setup, card);
  }

  /**
   * L'invite ne connait rien de la partie tant qu'il n'a pas ete accueilli —
   * mais il annonce son projectile et sa carte des sa presentation, pour que
   * l'hote puisse les integrer plutot que de les imposer.
   */
  static join(transport: Transport, playerId: string, batonId: BatonId, card: PlayerCard): OnlineSession {
    const session = new OnlineSession(transport, 'guest', playerId, null, card);
    transport.send({ kind: 'join', playerId, batonId, card });
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

  /**
   * Ce que l'adversaire a declare de lui ; null avant la poignee de main.
   * Declaratif, donc jamais utilise par les regles (cf. PlayerCard).
   */
  get opponentCard(): PlayerCard | null {
    return this._opponentCard;
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

  /**
   * L'adversaire a-t-il deja demande la revanche ?
   *
   * L'ETAT, pas l'evenement : la demande peut arriver alors que la scene de
   * match tourne encore chez nous (l'adversaire atteint l'ecran de resultat
   * une fraction de seconde avant), et l'annonce serait alors emise dans le
   * vide. L'ecran de fin lit donc cet etat a son ouverture au lieu de compter
   * sur un message qu'il n'etait peut-etre pas la pour entendre.
   */
  get opponentWantsRematch(): boolean {
    return this.rematchWanted[this.role === 'host' ? 'guest' : 'host'];
  }

  /** Conditions d'une revanche (hote uniquement ; sans cela, pas de revanche possible). */
  provideRematchSetup(provider: () => MatchSetup) {
    this.rematchSetupProvider = provider;
  }

  /** L'ADVERSAIRE demande la revanche : a nous de repondre. */
  onRematchAsked(fn: Listener<void>): () => void {
    this.rematchAskedListeners.add(fn);
    return () => this.rematchAskedListeners.delete(fn);
  }

  /** Les deux sont d'accord : la revanche commence, avec ces conditions. */
  onRematch(fn: Listener<MatchSetup>): () => void {
    this.rematchListeners.add(fn);
    return () => this.rematchListeners.delete(fn);
  }

  /**
   * Demande la revanche. Quand les deux l'ont fait, l'hote tire les nouvelles
   * conditions et les deux repartent ensemble.
   */
  requestRematch() {
    if (this._state !== 'ready') return;
    this.rematchWanted[this.role] = true;
    this.transport.send({ kind: 'rematch', playerId: this.playerId });
    if (this.role === 'host') this.startRematchIfAgreed();
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
        const guestTeam: TeamId = 'red';
        // Le projectile annonce par l'invite entre dans les conditions, et y
        // RESTE : un invite qui revient apres une coupure doit retrouver la
        // partie telle qu'elle etait, pas en negocier une nouvelle.
        this._setup = {
          ...this._setup,
          batons: { ...this._setup.batons, [guestTeam]: message.batonId ?? 'base' }
        };
        this._opponentCard = message.card ?? null;
        this.transport.send({
          kind: 'welcome',
          playerId: this.playerId,
          setup: this._setup,
          guestTeam,
          card: this.card
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
        this._opponentCard = message.card ?? null;
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

      case 'rematch': {
        if (this._state !== 'ready') return;
        this.rematchWanted[this.role === 'host' ? 'guest' : 'host'] = true;
        for (const fn of [...this.rematchAskedListeners]) fn();
        if (this.role === 'host') this.startRematchIfAgreed();
        return;
      }

      case 'rematch-start': {
        if (this.role !== 'guest') return;
        this.beginRematch(message.setup);
        return;
      }

      case 'ping':
        // Le signe de vie a deja ete pris en compte plus haut.
        return;

      case 'leave':
        this.close('parti');
    }
  }

  /** Hote : ne relance que lorsque les DEUX ont demande. */
  private startRematchIfAgreed() {
    if (!this.rematchWanted.host || !this.rematchWanted.guest) return;
    const setup = this.rematchSetupProvider?.();
    if (!setup) return;
    this.transport.send({ kind: 'rematch-start', playerId: this.playerId, setup });
    this.beginRematch(setup);
  }

  /**
   * Nouvelle partie sur la meme liaison : conditions remplacees et suite des
   * coups remise a zero des deux cotes — sans ce reset, le premier lancer de
   * la revanche serait pris pour un doublon.
   */
  private beginRematch(setup: MatchSetup) {
    this._setup = setup;
    this.expectedSeq = 0;
    this.rematchWanted = { host: false, guest: false };
    for (const fn of [...this.rematchListeners]) fn(setup);
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
