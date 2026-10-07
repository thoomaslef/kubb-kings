import type { Transport } from './transport';
import { createRoomCode } from './localTransport';

/**
 * Recherche rapide : une file d'attente commune, sans serveur.
 *
 * Tous les joueurs en recherche se parlent sur UN canal (le meme tuyau que
 * les parties, cf. transport.ts) : chacun y annonce sa presence a intervalle
 * regulier. Aucune base, aucun code serveur — le deploiement reste un site
 * statique.
 *
 * Qui joue avec qui : la file est triee par heure d'arrivee (et, a egalite,
 * par identifiant) ; les joueurs se couplent deux a deux, dans cet ordre. Le
 * plus ANCIEN du couple devient l'hote : il tire un code de salon et
 * l'annonce a l'autre (`match`), puis les deux quittent la file et
 * retombent sur le flux d'une partie privee. Tout le monde calcule le meme
 * ordre a partir des memes annonces, donc deux joueurs ne se choisissent
 * jamais en double... sauf course rare, que la couche du dessus rattrape
 * (delai d'attente d'un salon sans invite, cf. OnlineLobby).
 *
 * Seul au bout d'une minute, le joueur est envoye contre un bot en difficile
 * (`onBot`) : une file vide ne doit pas laisser un joueur seul devant un
 * ecran d'attente.
 *
 * Module sans horloge ni minuteur propres : `now` est injecte et `tick()`
 * appele de l'exterieur, pour tester la file a la seconde pres sans attendre.
 */

/** Attente seule au bout de laquelle on bascule sur un bot. */
export const QUEUE_BOT_AFTER_MS = 60_000;
/** Un joueur en file se signale toutes les... */
export const QUEUE_HEARTBEAT_MS = 2_000;
/** ... et est oublie s'il se tait plus longtemps que cela (onglet ferme sans adieu). */
export const QUEUE_PEER_TTL_MS = 7_000;
/** Canal de la file. Plus long que tout code de salon saisissable : on ne peut pas s'y tromper. */
export const QUEUE_CHANNEL = 'MATCHMAKING-QUEUE';

export type QueueMessage =
  | { kind: 'waiting'; playerId: string; since: number }
  | { kind: 'match'; hostId: string; guestId: string; code: string }
  | { kind: 'left'; playerId: string };

export type QueueMatch = { role: 'host' | 'guest'; code: string };

export interface MatchmakerOptions {
  playerId: string;
  transport: Transport<QueueMessage>;
  now?: () => number;
  /** Heure d'arrivee d'origine, pour qu'une file relancee garde son rang. */
  since?: number;
  botAfterMs?: number;
  makeCode?: () => string;
  onMatch: (match: QueueMatch) => void;
  onBot: () => void;
}

interface Peer {
  since: number;
  lastSeen: number;
}

export class Matchmaker {
  readonly playerId: string;
  readonly since: number;
  private readonly transport: Transport<QueueMessage>;
  private readonly now: () => number;
  private readonly botAfterMs: number;
  private readonly makeCode: () => string;
  private readonly onMatch: (match: QueueMatch) => void;
  private readonly onBot: () => void;
  private readonly peers = new Map<string, Peer>();
  private readonly unsubscribe: () => void;
  private lastBeat = Number.NEGATIVE_INFINITY;
  private finished = false;

  constructor(options: MatchmakerOptions) {
    this.playerId = options.playerId;
    this.transport = options.transport;
    this.now = options.now ?? Date.now;
    this.since = options.since ?? this.now();
    this.botAfterMs = options.botAfterMs ?? QUEUE_BOT_AFTER_MS;
    this.makeCode = options.makeCode ?? (() => createRoomCode());
    this.onMatch = options.onMatch;
    this.onBot = options.onBot;
    this.unsubscribe = this.transport.onMessage((message) => this.receive(message));
    this.announce();
  }

  /** Joueurs actuellement en file, soi-meme compris. */
  get queueSize(): number {
    return this.peers.size + 1;
  }

  get done(): boolean {
    return this.finished;
  }

  /** A appeler regulierement (une fois par seconde suffit). */
  tick() {
    if (this.finished) return;
    const now = this.now();
    for (const [id, peer] of this.peers) {
      if (now - peer.lastSeen > QUEUE_PEER_TTL_MS) this.peers.delete(id);
    }
    if (now - this.lastBeat >= QUEUE_HEARTBEAT_MS) this.announce();

    this.evaluate();
    if (this.finished) return;

    // Personne n'est venu : un bot, plutot qu'une attente sans fin. Les arrivees
    // tardives sont deja couplees ci-dessus, ce test ne tombe donc que sur
    // celui que personne n'a pris.
    if (now - this.since >= this.botAfterMs) {
      this.finish();
      this.onBot();
    }
  }

  /** Quitte la file : previent les autres et ferme le canal. */
  stop() {
    this.finish();
  }

  private receive(message: QueueMessage) {
    if (this.finished) return;
    if (message.kind === 'waiting') {
      if (message.playerId === this.playerId) return;
      const known = this.peers.has(message.playerId);
      this.peers.set(message.playerId, { since: message.since, lastSeen: this.now() });
      // Un nouvel arrivant ne connait personne : on se presente tout de suite
      // plutot que de le laisser attendre notre prochain battement.
      if (!known) this.announce();
      this.evaluate();
    } else if (message.kind === 'left') {
      this.peers.delete(message.playerId);
    } else if (message.kind === 'match') {
      if (message.guestId === this.playerId) {
        this.finish();
        this.onMatch({ role: 'guest', code: message.code });
        return;
      }
      // Un couple vient de se former ailleurs : ni l'un ni l'autre n'est
      // disponible. Sans cela, le suivant pourrait compter sur l'un des deux.
      this.peers.delete(message.hostId);
      this.peers.delete(message.guestId);
    }
  }

  private announce() {
    this.lastBeat = this.now();
    this.transport.send({ kind: 'waiting', playerId: this.playerId, since: this.since });
  }

  /** Suis-je l'ancien d'un couple ? Alors c'est a moi de creer le salon. */
  private evaluate() {
    if (this.finished) return;
    const line = [
      { id: this.playerId, since: this.since },
      ...[...this.peers].map(([id, p]) => ({ id, since: p.since }))
    ].sort((a, b) => a.since - b.since || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    const index = line.findIndex((p) => p.id === this.playerId);
    if (index % 2 !== 0 || index + 1 >= line.length) return;

    const guest = line[index + 1];
    const code = this.makeCode();
    this.transport.send({ kind: 'match', hostId: this.playerId, guestId: guest.id, code });
    this.finish();
    this.onMatch({ role: 'host', code });
  }

  private finish() {
    if (this.finished) return;
    this.finished = true;
    this.transport.send({ kind: 'left', playerId: this.playerId });
    this.unsubscribe();
    this.transport.close();
  }
}
