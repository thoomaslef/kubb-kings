import Phaser from 'phaser';
import { gameSize } from './renderScale';
import { matterWorldConfig } from './physics/matterConfig';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { MatchScene } from './scenes/MatchScene';
import { ResultScene } from './scenes/ResultScene';

export const GAME_BACKGROUND = '#0d1a14';

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: GAME_BACKGROUND,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      // Pixels de RENDU, pas de design : voir renderScale.ts. Chaque scene
      // ramene ensuite sa camera aux coordonnees de design, pour que la
      // physique et l'IA continuent de raisonner dans les memes unites.
      ...gameSize()
    },
    physics: {
      default: 'matter',
      matter: matterWorldConfig
    },
    input: {
      activePointers: 1
    },
    render: {
      antialias: true,
      roundPixels: false
    },
    scene: [BootScene, MenuScene, MatchScene, ResultScene]
  };
}
