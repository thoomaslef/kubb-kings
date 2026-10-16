import Phaser from 'phaser';
import { bridge } from '../GameBridge';
import { gameStore } from '../../store/useGameStore';
import { fitCameraToDesign } from '../renderScale';
import { markStage } from '../safeMode';

/**
 * Scene "vide" : le menu visible est rendu par React.
 * Cette scene ne fait qu'attendre l'ordre de lancer un match.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    markStage('menu');
    fitCameraToDesign(this);
    gameStore.getState().resetHud();
    gameStore.getState().setScreen('menu');

    bridge.on('start-match', this.handleStart, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bridge.off('start-match', this.handleStart, this);
    });
  }

  private handleStart() {
    this.scene.start('MatchScene');
  }
}
