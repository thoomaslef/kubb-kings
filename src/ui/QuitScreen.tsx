import { useGameStore } from '../store/useGameStore';

export function QuitScreen() {
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className="overlay overlay--solid">
      <div className="panel">
        <h2 className="panel__title">A bientot</h2>
        <p className="panel__text">
          Vous pouvez fermer l&apos;onglet. Sur mobile, l&apos;application se ferme depuis le
          gestionnaire de taches.
        </p>
        <button className="btn btn--primary" onClick={() => setScreen('menu')}>
          Revenir au menu
        </button>
      </div>
    </div>
  );
}
