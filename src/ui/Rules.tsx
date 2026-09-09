import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { KUBBS_PER_TEAM, MAX_THROWS_PER_TEAM } from '../game/rules';
import { resetTutorial } from '../game/tutorial';

export function Rules() {
  const setScreen = useGameStore((s) => s.setScreen);
  const [tutorialReset, setTutorialReset] = useState(false);

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--scroll">
        <h2 className="panel__title">Regles</h2>

        <ol className="rules-list">
          <li>
            Chaque equipe aligne <strong>{KUBBS_PER_TEAM} kubbs</strong> sur sa ligne de fond. Un{' '}
            <strong>roi</strong> unique se tient au centre du terrain.
          </li>
          <li>
            Les equipes lancent a tour de role. <strong>Posez le doigt</strong> sur votre ligne de
            lancer : c&apos;est de la que part le baton.
          </li>
          <li>
            <strong>Glissez</strong> vers la cible pour donner l&apos;angle, la{' '}
            <strong>longueur du glissement</strong> donne la puissance. Relachez pour lancer.
          </li>
          <li>
            Un baton ne fait tomber un kubb que s&apos;il le percute assez fort. Chaque lancer part
            avec une legere deviation : personne ne vise parfaitement.
          </li>
          <li>
            Un kubb tombe est <strong>hors jeu</strong>. Quand tous les kubbs adverses sont a terre,
            vous pouvez viser le roi.
          </li>
          <li>
            Le roi se tient sur la ligne mediane : contournez-le tant que vous n&apos;avez pas le
            droit de le viser. Le toucher <strong>trop tot</strong> = defaite immediate de
            l&apos;equipe qui a lance.
          </li>
          <li>
            Faire tomber le roi dans les regles = <strong>victoire</strong>.
          </li>
          <li>
            Partie limitee a <strong>4 minutes</strong> et <strong>{MAX_THROWS_PER_TEAM} lancers</strong>{' '}
            par equipe. Au buzzer, l&apos;equipe qui a abattu le plus de kubbs l&apos;emporte.
          </li>
        </ol>

        <div className="button-column">
          <button className="btn btn--primary" onClick={() => setScreen('menu')}>
            Retour
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => {
              resetTutorial();
              setTutorialReset(true);
            }}
          >
            {tutorialReset ? 'Reapparaitra a la prochaine partie' : 'Revoir le tutoriel'}
          </button>
        </div>
      </div>
    </div>
  );
}
