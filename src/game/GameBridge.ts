import Phaser from 'phaser';

/**
 * Pont d'evenements React -> Phaser.
 * Le sens inverse (Phaser -> React) passe directement par le store Zustand.
 */
export type BridgeEvent =
  | 'start-match'
  | 'restart-match'
  | 'leave-match'
  | 'pause-match'
  | 'resume-match';

class GameBridge extends Phaser.Events.EventEmitter {
  send(event: BridgeEvent) {
    this.emit(event);
  }
}

export const bridge = new GameBridge();
