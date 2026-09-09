import { useGameStore } from '../store/useGameStore';
import { KUBBS_PER_TEAM, MAX_THROWS_PER_TEAM } from '../game/rules';

export function Rules() {
  const setScreen = useGameStore((s) => s.setScreen);

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
            Les equipes lancent a tour de role. <strong>Glissez</strong> vers la cible pour donner
            l&apos;angle, la <strong>longueur du glissement</strong> donne la puissance.
          </li>
          <li>Un baton ne fait tomber un kubb que s&apos;il le percute assez fort.</li>
          <li>
            Un kubb tombe est <strong>hors jeu</strong>. Quand tous les kubbs adverses sont a terre,
            vous pouvez viser le roi.
          </li>
          <li>
            Toucher le roi <strong>trop tot</strong> = defaite immediate de l&apos;equipe qui a
            lance.
          </li>
          <li>
            Faire tomber le roi dans les regles = <strong>victoire</strong>.
          </li>
          <li>
            Partie limitee a <strong>4 minutes</strong> et <strong>{MAX_THROWS_PER_TEAM} lancers</strong>{' '}
            par equipe. Au buzzer, l&apos;equipe qui a abattu le plus de kubbs l&apos;emporte.
          </li>
        </ol>

        <button className="btn btn--primary" onClick={() => setScreen('menu')}>
          Retour
        </button>
      </div>
    </div>
  );
}
