import { GIANT_LEVEL_GAP, ONLINE_STREAK_TARGET, type AchievementId } from './achievements';
import type { GameMode } from '../store/useGameStore';

/**
 * Quels succes une FIN de partie decerne — et rien d'autre.
 *
 * Ce module est PUR : il ne connait ni Phaser, ni le store, ni le terrain. Il
 * repond a une seule question, a partir d'un resume de la partie ecoulee.
 *
 * Pourquoi l'avoir sorti de MatchScene : ces huit conditions y etaient une
 * cascade de `if` au milieu de la physique, et c'est une cascade qu'on relit
 * mal — « victoire ET au moins un lancer ET aucun manque » se verifie a l'oeil
 * ou pas du tout. Ici, chaque condition a son test. Les succes qui se gagnent
 * PENDANT le jeu (double, ricochet, frolement, nettoyeur...) restent dans la
 * scene : ils dependent d'evenements de collision, pas d'un bilan.
 *
 * Le decalage vertical accompagne l'identifiant parce que plusieurs succes
 * peuvent tomber sur la meme victoire : sans ecart impose, les bandeaux se
 * superposeraient.
 */

/** Bilan d'une partie terminee, du point de vue du joueur de cet appareil. */
export interface MatchEndSummary {
  mode: GameMode;
  /** Le joueur de cet appareil a-t-il gagne ? */
  won: boolean;
  /** Match nul : ni victoire ni defaite (il ne rompt pas une serie). */
  draw: boolean;
  /** Lancers reellement effectues par le joueur (0 = il n'a pas joue). */
  throwsMade: number;
  /** Au moins un lancer du joueur n'a rien touche de legal. */
  missed: boolean;
  /** Kubbs du joueur tombes pendant la partie. */
  ownKubbsDown: number;
  /** Au moins un baton du joueur a touche une bande. */
  touchedWall: boolean;
  /** Le joueur est descendu au minimum de kubbs debout avant de remonter. */
  wasCornered: boolean;
  /** Terrains sur lesquels le joueur a deja gagne, CETTE partie comprise. */
  terrainsWon: number;
  /** Nombre total de terrains existants. */
  terrainsTotal: number;
  /** Serie de victoires en ligne, CETTE partie comprise. */
  onlineWinStreak: number;
  /** Niveau annonce par l'adversaire en ligne ; 0 hors ligne. */
  opponentLevel: number;
  /** Niveau du joueur AVANT les recompenses de cette partie. */
  ownLevel: number;
  /** Manches du Defi franchies, celle-ci comprise. */
  stagesCleared: number;
  /** Nombre de manches que compte l'echelle du Defi. */
  ladderLength: number;
}

export interface EarnedAchievement {
  id: AchievementId;
  /** Decalage vertical du bandeau, relatif au centre du terrain. */
  offsetY: number;
}

export function endOfMatchAchievements(match: MatchEndSummary): EarnedAchievement[] {
  const gagnes: EarnedAchievement[] = [];
  const decerner = (id: AchievementId, offsetY: number) => gagnes.push({ id, offsetY });

  if (match.won) {
    // Sans faute : aucun lancer manque. Le garde-fou `throwsMade > 0` evite de
    // recompenser une victoire ou le joueur n'a rien lance (adversaire a court
    // de lancers, temps ecoule) — ne pas jouer n'est pas etre precis.
    if (match.throwsMade > 0 && !match.missed) decerner('sans-faute', -40);

    // Victoire parfaite : pas un seul de ses kubbs perdu.
    if (match.ownKubbsDown === 0) decerner('victoire-parfaite', -90);

    // Chirurgien : aucune bande touchee. Meme garde-fou que Sans faute.
    if (match.throwsMade > 0 && !match.touchedWall) decerner('chirurgien', -140);

    // Remontada : etre revenu du bord du gouffre.
    if (match.wasCornered) decerner('remontada', -190);

    // Collectionneur : une victoire sur chacun des terrains. Cumulatif, donc
    // `terrainsWon` inclut deja celui du jour quand on arrive ici.
    if (match.terrainsWon >= match.terrainsTotal) decerner('collectionneur', -240);
  }

  if (match.mode === 'online' && match.won && !match.draw) {
    // Bapteme du feu : un succes ne se decerne qu'une fois, la « premiere »
    // victoire se deduit donc d'elle-meme, sans compteur.
    decerner('bapteme-du-feu', -290);

    // Tombeur de geant : l'adversaire nous depassait nettement. Son niveau est
    // DECLARE par lui (protocol.ts::PlayerCard), le notre est celui d'avant
    // les recompenses du jour — c'est le niveau qu'on avait en entrant sur le
    // terrain qui compte.
    if (match.opponentLevel - match.ownLevel >= GIANT_LEVEL_GAP) decerner('tombeur-de-geant', -340);

    // Invaincu : la serie inclut deja cette victoire.
    if (match.onlineWinStreak >= ONLINE_STREAK_TARGET) decerner('invaincu', -390);
  }

  // Increvable : l'echelle entiere du Defi franchie. Decale vers le BAS, les
  // places du haut etant prises par les succes de victoire.
  if (match.mode === 'defi' && match.won && match.stagesCleared >= match.ladderLength) {
    decerner('increvable', 60);
  }

  return gagnes;
}
