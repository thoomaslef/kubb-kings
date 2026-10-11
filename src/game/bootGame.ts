import Phaser from 'phaser';
import { createGameConfig } from './config';
import { beginBoot } from './safeMode';

/**
 * Point d'entree unique pour l'import DYNAMIQUE de Phaser (voir GameCanvas.tsx).
 * Phaser et tout le code du jeu (scenes, entites, IA...) qu'il importe
 * transitivement via createGameConfig forment le plus gros du bundle —
 * les isoler ici les place dans un chunk separe du shell React, telecharge
 * en parallele plutot que de bloquer le tout premier rendu.
 */
export function bootGame(host: HTMLElement): Phaser.Game {
  // Note de demarrage : retiree quand le jeu est stable, sinon le chargement suivant passe en
  // mode compatibilite (cf. safeMode.ts).
  beginBoot();
  return new Phaser.Game(createGameConfig(host));
}
