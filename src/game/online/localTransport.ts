import type { OnlineMessage, Transport } from './transport';

/**
 * Faux transport : deux onglets du MEME navigateur se parlent par
 * `BroadcastChannel`, sans aucun serveur.
 *
 * Ce n'est pas un bouche-trou en attendant "le vrai" : c'est l'outil qui
 * permet de developper et de verifier tout le mode en ligne — poignee de
 * main, alternance des tours, abandon, desynchronisation — a cout nul, et
 * de garder ensuite un moyen de tester le jeu en ligne sans dependre d'un
 * service tiers ni d'une connexion.
 *
 * Limite assumee : `BroadcastChannel` ne franchit pas la machine. Deux
 * joueurs reellement distants demanderont une autre implementation de
 * `Transport`, et elle seule.
 */

const CHANNEL_PREFIX = 'kubb-kings.room.';

/** Un code de salon court et lisible a voix haute (sans I/O/0/1, trop ambigus). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createRoomCode(length = 4, rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  }
  return code;
}

/** true si le navigateur sait faire tourner ce transport. */
export function isLocalTransportAvailable(): boolean {
  return typeof BroadcastChannel !== 'undefined';
}

export function createLocalTransport(roomCode: string): Transport {
  const channel = new BroadcastChannel(CHANNEL_PREFIX + roomCode.toUpperCase());
  const handlers = new Set<(message: OnlineMessage) => void>();

  channel.onmessage = (event: MessageEvent<OnlineMessage>) => {
    // Copie : un handler peut se desabonner pendant l'iteration.
    for (const handler of [...handlers]) handler(event.data);
  };

  return {
    send(message) {
      // BroadcastChannel ne renvoie jamais a l'emetteur : un message n'est
      // donc vu que par l'autre onglet, ce qu'on veut exactement ici.
      channel.postMessage(message);
    },
    onMessage(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    close() {
      handlers.clear();
      channel.close();
    }
  };
}
