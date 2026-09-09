import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { getCrashLog, clearCrashLog, formatCrashLogForCopy } from '../game/diagnostics';
import { version } from '../../package.json';

/**
 * Version, credits, contact — et un journal d'erreurs local que le joueur
 * peut copier pour le transmettre par e-mail. Le jeu n'a aucun serveur pour
 * recevoir des rapports de crash a distance (site statique) : c'est le
 * meilleur substitut honnete, plutot qu'un SDK tiers pour le faire a notre
 * place.
 */
export function About() {
  const setScreen = useGameStore((s) => s.setScreen);
  const [crashCount, setCrashCount] = useState(() => getCrashLog().length);
  const [copied, setCopied] = useState(false);

  const copyLog = async () => {
    const text = formatCrashLogForCopy();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier indisponible (permission refusee, contexte non securise) :
      // rien d'autre a proposer sans bibliotheque externe.
    }
  };

  const clearLog = () => {
    clearCrashLog();
    setCrashCount(0);
  };

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--scroll">
        <h2 className="panel__title">A propos</h2>

        <p className="panel__text">
          <strong>KUBB: Kings</strong> &mdash; version {version}
          <br />
          Cree par Tommy Studio (Thomas Lefevre)
          <br />
          Contact : thomas@tommy-studio.pro
        </p>

        <h3 className="legal-heading">Journal d&apos;erreurs</h3>
        <p className="panel__text">
          {crashCount === 0
            ? "Aucune erreur enregistree sur cet appareil."
            : `${crashCount} erreur${crashCount > 1 ? 's' : ''} enregistree${
                crashCount > 1 ? 's' : ''
              } sur cet appareil. Si le jeu se comporte mal, copiez ce journal et envoyez-le a
              l'adresse ci-dessus.`}
        </p>

        <div className="button-column">
          {crashCount > 0 && (
            <>
              <button className="btn" onClick={copyLog}>
                {copied ? 'Copie !' : 'Copier le journal'}
              </button>
              <button className="btn btn--ghost" onClick={clearLog}>
                Effacer le journal
              </button>
            </>
          )}
          <button className="btn btn--primary" onClick={() => setScreen('menu')}>
            Retour
          </button>
        </div>
      </div>
    </div>
  );
}
