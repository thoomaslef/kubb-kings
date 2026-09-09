import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';

export function Menu() {
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--menu">
        <h1 className="title">
          KUBB<span className="title__accent">: Kings</span>
        </h1>
        <p className="subtitle">Le duel de lancer, sur un seul telephone.</p>

        <div className="button-column">
          <button className="btn btn--primary" onClick={() => bridge.send('start-match')}>
            Jouer &mdash; 1v1 local
          </button>
          <button className="btn" onClick={() => setScreen('rules')}>
            Regles
          </button>
          <button className="btn btn--ghost" onClick={() => setScreen('quit')}>
            Quitter
          </button>
        </div>

        <p className="footnote">MVP &middot; pass-and-play &middot; 4 minutes max</p>
      </div>
    </div>
  );
}
