import Phaser from 'phaser';
import { bridge } from '../GameBridge';
import { gameStore, type MatchResult } from '../../store/useGameStore';

/**
 * Scene "vide" : l'ecran de fin visible est rendu par React.
 * Elle publie le resultat dans le store et attend Rejouer / Menu.
 */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create(result: MatchResult) {
    gameStore.getState().setResult(result);
    gameStore.getState().setScreen('result');

    bridge.on('restart-match', this.handleRestart, this);
    bridge.on('leave-match', this.handleLeave, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bridge.off('restart-match', this.handleRestart, this);
      bridge.off('leave-match', this.handleLeave, this);
    });
  }

  private handleRestart() {
    gameStore.getState().resetHud();
    this.scene.start('MatchScene');
  }

  private handleLeave() {
    this.scene.start('MenuScene');
  }
}
