import Phaser from 'phaser';
import { bridge } from '../GameBridge';
import { gameStore, type MatchResult } from '../../store/useGameStore';
import { getCurrentSession, setCurrentSession } from '../online/currentSession';
import { fitCameraToDesign } from '../renderScale';

/**
 * Scene "vide" : l'ecran de fin visible est rendu par React.
 * Elle publie le resultat dans le store et attend Rejouer / Menu.
 *
 * En ligne, c'est AUSSI le seul endroit vivant entre deux parties : la scene
 * de match s'est arretee et a rendu ses abonnements. Sans les reprendre ici,
 * une revanche serait impossible et un adversaire qui part pendant l'ecran de
 * resultat ne serait jamais signale.
 */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create(result: MatchResult) {
    fitCameraToDesign(this);
    gameStore.getState().setResult(result);
    gameStore.getState().setScreen('result');

    bridge.on('restart-match', this.handleRestart, this);
    bridge.on('leave-match', this.handleLeave, this);

    const session = getCurrentSession();
    // Etat lu a l'ouverture plutot que remis a zero : l'adversaire a pu
    // demander la revanche pendant que notre scene de match tournait encore,
    // et son annonce serait alors partie dans le vide.
    if (session) {
      gameStore.getState().patchOnline({ rematch: session.opponentWantsRematch ? 'proposee' : 'aucune' });
    }

    const offAsked = session?.onRematchAsked(() => {
      gameStore.getState().patchOnline({ rematch: 'proposee' });
    });
    const offRematch = session?.onRematch(() => {
      gameStore.getState().patchOnline({ rematch: 'aucune' });
      gameStore.getState().resetHud();
      this.scene.start('MatchScene');
    });
    const offClosed = session?.onClosed((reason) => {
      // Notre propre depart n'a rien a annoncer : le joueur sait qu'il part.
      if (reason === 'quitte') return;
      gameStore.getState().patchOnline({ status: 'terminee', endedBecause: reason, rematch: 'aucune' });
      this.scene.start('MenuScene');
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bridge.off('restart-match', this.handleRestart, this);
      bridge.off('leave-match', this.handleLeave, this);
      offAsked?.();
      offRematch?.();
      offClosed?.();
    });
  }

  private handleRestart() {
    gameStore.getState().resetHud();
    this.scene.start('MatchScene');
  }

  private handleLeave() {
    // En ligne, partir doit se DIRE : sans ce mot d'adieu, l'adversaire
    // resterait devant son ecran de fin a esperer une revanche, jusqu'a
    // l'expiration du battement de coeur.
    const session = getCurrentSession();
    if (session) {
      session.leave();
      setCurrentSession(null);
      gameStore.getState().endOnline();
    }
    this.scene.start('MenuScene');
  }
}
