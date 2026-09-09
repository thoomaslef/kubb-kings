import { useGameStore } from '../store/useGameStore';
import { GameCanvas } from './GameCanvas';
import { Menu } from './Menu';
import { Rules } from './Rules';
import { HUD } from './HUD';
import { Tutorial } from './Tutorial';
import { ResultScreen } from './ResultScreen';
import { PerkChoice } from './PerkChoice';
import { QuitScreen } from './QuitScreen';
import { TournamentSetup } from './TournamentSetup';
import { TournamentBracket } from './TournamentBracket';

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
      {screen === 'match' && (
        <>
          <HUD />
          <Tutorial />
        </>
      )}
      {screen === 'result' && <ResultScreen />}
      {screen === 'perk' && <PerkChoice />}
      {screen === 'quit' && <QuitScreen />}
      {screen === 'tournament-setup' && <TournamentSetup />}
      {screen === 'tournament' && <TournamentBracket />}
    </div>
  );
}
