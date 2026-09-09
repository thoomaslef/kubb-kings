import { useGameStore } from '../store/useGameStore';
import { GameCanvas } from './GameCanvas';
import { Menu } from './Menu';
import { Rules } from './Rules';
import { HUD } from './HUD';
import { ResultScreen } from './ResultScreen';
import { QuitScreen } from './QuitScreen';

/**
 * Coquille React : le canvas Phaser est toujours monte,
 * les ecrans hors-jeu se superposent par-dessus.
 */
export function App() {
  const screen = useGameStore((s) => s.screen);

  return (
    <div className="app">
      <GameCanvas />
      {screen === 'menu' && <Menu />}
      {screen === 'rules' && <Rules />}
      {screen === 'match' && <HUD />}
      {screen === 'result' && <ResultScreen />}
      {screen === 'quit' && <QuitScreen />}
    </div>
  );
}
