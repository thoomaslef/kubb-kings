import Phaser from 'phaser';
import { bridge } from '../GameBridge';
import { gameStore } from '../../store/useGameStore';
import { TEAMS, throwerPosition, type TeamId } from '../entities/Team';
import { FIELD, FIELD_CENTER_X, FIELD_CENTER_Y } from '../rules';

/**
 * ETAPE 1 (squelette) : dessine le terrain et enchaine les scenes.
 * La physique de lancer, les kubbs et le roi arrivent aux etapes suivantes.
 */
export class MatchScene extends Phaser.Scene {
  private activeTeam: TeamId = 'blue';

  constructor() {
    super('MatchScene');
  }

  create() {
    gameStore.getState().setScreen('match');

    this.drawField();
    this.drawThrowers();

    // TODO(etape 2) : remplace par la vraie boucle de lancer.
    this.input.once('pointerdown', () => {
      this.scene.start('ResultScene', {
        winner: this.activeTeam,
        reason: 'king-down',
        knockedDown: { blue: 0, red: 0 }
      });
    });

    bridge.on('leave-match', this.handleLeave, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bridge.off('leave-match', this.handleLeave, this);
    });
  }

  private handleLeave() {
    this.scene.start('MenuScene');
  }

  private drawField() {
    const g = this.add.graphics();

    g.fillStyle(0x1d4030, 1);
    g.fillRoundedRect(FIELD.x - 8, FIELD.y - 8, FIELD.width + 16, FIELD.height + 16, 18);
    g.fillStyle(0x2f6b46, 1);
    g.fillRoundedRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height, 14);

    // Bandes de tonte alternees, pour lire la profondeur du terrain.
    g.fillStyle(0x000000, 0.05);
    for (let y = FIELD.y; y < FIELD.y + FIELD.height; y += 128) {
      g.fillRect(FIELD.x, y, FIELD.width, 64);
    }

    // Ligne mediane (le roi se tient dessus).
    g.lineStyle(3, 0xffffff, 0.28);
    for (let x = FIELD.x + 10; x < FIELD.x + FIELD.width - 10; x += 28) {
      g.lineBetween(x, FIELD_CENTER_Y, x + 14, FIELD_CENTER_Y);
    }

    // Lignes de fond des deux equipes.
    (Object.keys(TEAMS) as TeamId[]).forEach((id) => {
      g.lineStyle(3, TEAMS[id].color, 0.55);
      g.lineBetween(FIELD.x + 10, TEAMS[id].baselineY, FIELD.x + FIELD.width - 10, TEAMS[id].baselineY);
    });

    g.lineStyle(3, 0xffffff, 0.18);
    g.strokeRoundedRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height, 14);

    // Repere du roi au centre du terrain.
    g.lineStyle(2, 0xf2c14e, 0.35);
    g.strokeCircle(FIELD_CENTER_X, FIELD_CENTER_Y, 46);
  }

  private drawThrowers() {
    (Object.keys(TEAMS) as TeamId[]).forEach((id) => {
      const pos = throwerPosition(id);
      this.add.image(pos.x, pos.y, `thrower-${id}`).setDepth(2);
    });
  }
}
