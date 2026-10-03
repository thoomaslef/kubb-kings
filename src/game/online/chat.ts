/**
 * Le tchat, reduit a ce qui doit etre vrai de son contenu.
 *
 * Module PUR : aucune dependance au reseau ni a React, pour que les regles
 * ci-dessous soient verifiables sans navigateur. Elles ne sont pas
 * decoratives — c'est du texte libre, ecrit par quelqu'un d'autre, qui
 * arrive par un canal public dont le code de salon est le seul secret.
 *
 * Trois choses, et pas une de plus :
 *   - un message est d'abord ASSAINI (longueur, caracteres, espaces) ;
 *   - l'envoi est CADENCE, pour qu'un doigt trop rapide ou un script ne
 *     puisse pas noyer l'autre joueur ;
 *   - le journal est BORNE, pour qu'une partie longue ne fasse pas enfler
 *     la memoire indefiniment.
 *
 * Rien n'est conserve au-dela de la partie : le tchat vit en memoire, il
 * n'est ni enregistre sur l'appareil, ni stocke sur le relais (qui ne fait
 * que retransmettre, cf. supabaseTransport.ts).
 */

/**
 * Longueur maximale d'un message, en caracteres.
 *
 * Assez pour une phrase et une vanne, trop court pour coller un pave. La
 * coupe est appliquee a l'ENVOI comme a la RECEPTION : un message venu du
 * reseau n'a pas forcement ete produit par notre propre interface.
 */
export const CHAT_MAX_LENGTH = 160;

/** Delai minimal entre deux messages d'un meme joueur, en millisecondes. */
export const CHAT_MIN_INTERVAL_MS = 800;

/**
 * Nombre de messages gardes a l'ecran. Au-dela, les plus anciens tombent :
 * une partie peut durer, la memoire non.
 */
export const CHAT_HISTORY_MAX = 50;

/** Un message, tel qu'il est affiche. */
export interface ChatMessage {
  /** Identifiant local, pour que React puisse distinguer deux messages identiques. */
  id: number;
  /** true si c'est nous qui l'avons ecrit. */
  mine: boolean;
  text: string;
}

/**
 * Nettoie un message avant envoi ou affichage.
 *
 * Renvoie la chaine vide si rien d'affichable ne subsiste — l'appelant doit
 * alors ne RIEN envoyer ni afficher, plutot que montrer une bulle vide.
 *
 * Ce que ca retire, et pourquoi :
 *   - les caracteres de controle, y compris les retours a la ligne : un
 *     message tient sur une ligne, et un `\n` suffirait a faire passer une
 *     bulle pour plusieurs ;
 *   - les marques de direction d'ecriture (U+200E/U+200F/U+202A-U+202E), qui
 *     permettent d'inverser visuellement l'ordre du texte affiche ;
 *   - les suites d'espaces, qui servent a pousser le texte hors du cadre.
 */
export function sanitizeChatText(raw: string): string {
  if (typeof raw !== 'string') return '';
  return (
    raw
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/[‎‏‪-‮⁦-⁩]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, CHAT_MAX_LENGTH)
  );
}

/**
 * Cadenceur d'envoi.
 *
 * Volontairement une classe a etat plutot qu'un calcul pur : la cadence se
 * juge par rapport au DERNIER envoi accepte, pas au dernier essai — sans
 * quoi marteler le bouton repousserait indefiniment sa propre autorisation.
 */
export class ChatRateLimiter {
  private dernierEnvoi = Number.NEGATIVE_INFINITY;

  constructor(private readonly intervalMs = CHAT_MIN_INTERVAL_MS) {}

  /** Peut-on envoyer maintenant ? Ne modifie rien. */
  allows(now: number): boolean {
    return now - this.dernierEnvoi >= this.intervalMs;
  }

  /**
   * Enregistre un envoi s'il est autorise, et dit s'il l'etait. Un refus ne
   * decale pas la prochaine autorisation.
   */
  accept(now: number): boolean {
    if (!this.allows(now)) return false;
    this.dernierEnvoi = now;
    return true;
  }
}

/** Ajoute un message au journal en respectant sa borne. */
export function appendChat(history: readonly ChatMessage[], message: ChatMessage): ChatMessage[] {
  const suite = [...history, message];
  return suite.length <= CHAT_HISTORY_MAX ? suite : suite.slice(suite.length - CHAT_HISTORY_MAX);
}
