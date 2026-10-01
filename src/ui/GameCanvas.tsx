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
    let nettoyerEchelle: (() => void) | null = null;

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

      // --- Remise a l'echelle apres une mise en veille ---
      //
      // Signale sur iPhone : on verrouille le telephone, on deverrouille, et
      // le jeu se retrouve dans un petit rectangle centre. Le HUD React, lui,
      // reste correct — c'est donc l'echelle de Phaser qui est restee figee.
      //
      // Phaser ne re-mesure son conteneur que lorsqu'il detecte un
      // changement, et ce controle tourne dans sa boucle de jeu, laquelle
      // est GELEE tant que la page est en arriere-plan. Si la taille du
      // conteneur change pendant ce gel — ce que fait iOS avec son viewport
      // visuel et ses barres — la mesure d'avant reste en place.
      //
      // Deux filets, parce que le declencheur exact d'iOS n'est pas
      // reproductible ici :
      //   1. re-mesurer sur les evenements de reprise, plusieurs fois, parce
      //      qu'iOS ne stabilise sa mise en page qu'apres coup ;
      //   2. un chien de garde qui compare le canevas a son conteneur et
      //      corrige l'ecart, quelle qu'en soit la cause.
      const hote = hostRef.current;
      const remesurer = () => {
        if (game.scale) game.scale.refresh();
      };
      /** iOS stabilise sa mise en page APRES l'evenement : on repasse. */
      const remesurerPlusieursFois = () => {
        remesurer();
        window.setTimeout(remesurer, 150);
        window.setTimeout(remesurer, 500);
      };
      const auRetour = () => {
        if (document.visibilityState === 'visible') remesurerPlusieursFois();
      };

      document.addEventListener('visibilitychange', auRetour);
      // `pageshow` couvre le retour depuis le cache de navigation (bfcache),
      // ou aucun `visibilitychange` n'est garanti.
      window.addEventListener('pageshow', remesurerPlusieursFois);
      window.addEventListener('orientationchange', remesurerPlusieursFois);
      window.addEventListener('focus', auRetour);
      // Sur mobile, c'est le viewport VISUEL qui bouge, pas la fenetre.
      window.visualViewport?.addEventListener('resize', remesurer);

      /** Le canevas tient-il dans son conteneur, en touchant un bord ? */
      const horsCadre = () => {
        const toile = hote.querySelector('canvas');
        if (!toile) return false;
        const h = hote.getBoundingClientRect();
        const c = toile.getBoundingClientRect();
        if (h.width < 1 || h.height < 1) return false; // page masquee : rien a conclure
        const depasse = c.width > h.width + 1 || c.height > h.height + 1;
        const toucheUnBord = Math.abs(c.width - h.width) < 2 || Math.abs(c.height - h.height) < 2;
        return depasse || !toucheUnBord;
      };

      const chienDeGarde = window.setInterval(() => {
        if (horsCadre()) remesurer();
      }, 1000);

      nettoyerEchelle = () => {
        window.clearInterval(chienDeGarde);
        document.removeEventListener('visibilitychange', auRetour);
        window.removeEventListener('pageshow', remesurerPlusieursFois);
        window.removeEventListener('orientationchange', remesurerPlusieursFois);
        window.removeEventListener('focus', auRetour);
        window.visualViewport?.removeEventListener('resize', remesurer);
      };

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
      nettoyerEchelle?.();
      unsubscribe?.();
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div className="game-canvas" ref={hostRef} />;
}
