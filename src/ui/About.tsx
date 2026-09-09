import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { getCrashLog, clearCrashLog, formatCrashLogForCopy } from '../game/diagnostics';
import { version } from '../../package.json';
import { useT } from '../i18n/useT';

/**
 * Version, credits, contact — et un journal d'erreurs local que le joueur
 * peut copier pour le transmettre par e-mail. Le jeu n'a aucun serveur pour
 * recevoir des rapports de crash a distance (site statique) : c'est le
 * meilleur substitut honnete, plutot qu'un SDK tiers pour le faire a notre
 * place.
 *
 * Identite et contact restent en francais (voir Legal.tsx) : seuls les
 * libelles autour changent de langue.
 */
export function About() {
  const t = useT();
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
        <h2 className="panel__title">{t('about.title')}</h2>

        <p className="panel__text">
          <strong>KUBB: Kings</strong> &mdash; {version}
          <br />
          {t('about.createdBy', { name: 'Tommy Studio (Thomas Lefevre)' })}
          <br />
          {t('about.contact', { email: 'thomas@tommy-studio.pro' })}
        </p>

        <h3 className="legal-heading">{t('about.crashLogTitle')}</h3>
        <p className="panel__text">
          {t(crashCount === 0 ? 'about.crashLog.none' : crashCount === 1 ? 'about.crashLog.one' : 'about.crashLog.many', {
            n: crashCount
          })}
        </p>

        <div className="button-column">
          {crashCount > 0 && (
            <>
              <button className="btn" onClick={copyLog}>
                {copied ? t('about.copied') : t('about.copyLog')}
              </button>
              <button className="btn btn--ghost" onClick={clearLog}>
                {t('about.clearLog')}
              </button>
            </>
          )}
          <button className="btn btn--primary" onClick={() => setScreen('menu')}>
            {t('about.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
