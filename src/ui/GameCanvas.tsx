import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from '../game/config';
import { useGameStore } from '../store/useGameStore';

export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    const game = new Phaser.Game(createGameConfig(hostRef.current));
    gameRef.current = game;

    // Une scene en pause ne tourne plus : l'ordre doit venir de l'exterieur.
    const unsubscribe = useGameStore.subscribe((state, prev) => {
      if (state.paused === prev.paused) return;
      if (!game.scene.getScene('MatchScene')) return;
      if (state.paused) game.scene.pause('MatchScene');
      else game.scene.resume('MatchScene');
    });

    return () => {
      unsubscribe();
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div className="game-canvas" ref={hostRef} />;
}
