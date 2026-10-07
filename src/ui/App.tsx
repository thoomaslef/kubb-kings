import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { startMusic } from '../game/audio';
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
import { Shop } from './Shop';
import { Achievements } from './Achievements';
import { Progression } from './Progression';
import { Legal } from './Legal';
import { OnlineLobby } from './OnlineLobby';
import { Ranks } from './Ranks';
import { Account } from './Account';
import { AccountConflict } from './AccountConflict';
import { initAccount } from '../game/account/sync';
import { MapSelect } from './MapSelect';
import { About } from './About';
import { Boot } from './Boot';
import { Chat } from './Chat';

/**
 * Coquille React : le canvas Phaser est toujours monte,
 * les ecrans hors-jeu se superposent par-dessus.
 */
export function App() {
  const screen = useGameStore((s) => s.screen);
  const lang = useGameStore((s) => s.lang);
  const accountConflict = useGameStore((s) => s.accountConflict);

  // index.html fixe lang="fr" au chargement (page statique) : ce n'est plus
  // exact des que le joueur choisit l'anglais, important pour les lecteurs
  // d'ecran et le SEO.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Compte joueur : retrouve la session conservee, s'il y en a une (ne charge
  // le service que dans ce cas, cf. account/sync.ts::initAccount).
  useEffect(() => {
    void initAccount();
  }, []);

  // Musique d'ambiance : demarree sur le tout premier geste du joueur, ou
  // qu'il ait lieu (menu, ecran de regles...) — meme contrainte de geste que
  // le reste de l'audio (cf. src/game/audio.ts). Independante de `screen` :
  // ne se relance jamais, elle tourne en fond tant que l'onglet est ouvert.
  useEffect(() => {
    const onFirstGesture = () => startMusic();
    window.addEventListener('pointerdown', onFirstGesture, { once: true });
    return () => window.removeEventListener('pointerdown', onFirstGesture);
  }, []);

  return (
    <div className="app">
      <GameCanvas />
      {screen === 'boot' && <Boot />}
      {screen === 'menu' && <Menu />}
      {screen === 'rules' && <Rules />}
      {screen === 'match' && (
        <>
          <HUD />
          <Tutorial />
          <Chat />
        </>
      )}
      {screen === 'result' && <ResultScreen />}
      {screen === 'perk' && <PerkChoice />}
      {screen === 'quit' && <QuitScreen />}
      {screen === 'tournament-setup' && <TournamentSetup />}
      {screen === 'tournament' && <TournamentBracket />}
      {screen === 'shop' && <Shop />}
      {screen === 'achievements' && <Achievements />}
      {screen === 'progression' && <Progression />}
      {screen === 'legal' && <Legal />}
      {screen === 'about' && <About />}
      {screen === 'online' && <OnlineLobby />}
      {screen === 'ranks' && <Ranks />}
      {screen === 'account' && <Account />}
      {accountConflict && screen !== 'match' && <AccountConflict />}
      {screen === 'map-select' && <MapSelect />}
    </div>
  );
}
