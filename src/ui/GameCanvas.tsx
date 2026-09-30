import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { useGameStore } from '../store/useGameStore';

/**
 * Phaser (import type uniquement ci-dessus, efface a la compilation) est
 * charge dynamiquement dans l'effet ci-dessous : voir game/bootGame.ts pour
 * la raison (isoler le plus gros du bundle dans un chunk separe).
 */
export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    import('../game/bootGame').then(({ bootGame }) => {
      if (cancelled || !hostRef.current || gameRef.current) return;
      const game = bootGame(hostRef.current);
      gameRef.current = game;

      // Poignee de pilotage : window.__kubb.scene.getScene('MatchScene').
      //
      // Presente en developpement, et dans un build explicitement marque
      // VITE_EXPOSE_TEST_HANDLE=1. Ce second cas n'est pas un confort : sans
      // lui, les verifications au navigateur ne peuvent tourner que contre le
      // serveur de dev, donc jamais contre ce qui est REELLEMENT livre — or
      // Vite ne produit pas le meme code des deux cotes (minification,
      // decoupage, substitution des variables d'environnement). Un defaut
      // propre a la production passerait alors sous tous les radars.
      //
      // Le build de deploiement, lui, ne met pas ce drapeau : la poignee
      // n'existe pas dans le jeu publie.
      if (import.meta.env.DEV || import.meta.env.VITE_EXPOSE_TEST_HANDLE === '1') {
        const w = window as unknown as { __kubb?: Phaser.Game; __kubbStoreApi?: typeof useGameStore };
        w.__kubb = game;
        w.__kubbStoreApi = useGameStore;
      }

      // Une scene en pause ne tourne plus : l'ordre doit venir de l'exterieur.
      unsubscribe = useGameStore.subscribe((state, prev) => {
        if (state.paused === prev.paused) return;
        if (!game.scene.getScene('MatchScene')) return;
        if (state.paused) game.scene.pause('MatchScene');
        else game.scene.resume('MatchScene');
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div className="game-canvas" ref={hostRef} />;
}
