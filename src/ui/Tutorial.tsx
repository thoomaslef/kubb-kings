import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { isTutorialDone, markTutorialDone } from '../game/tutorial';
import { useT } from '../i18n/useT';

type Step = 'intro' | 'toast' | 'hidden';

/**
 * Onboarding de la toute premiere partie, joue PENDANT le match plutot
 * qu'avant : une carte de geste avant le premier lancer, puis un rappel
 * bref une fois ce lancer resolu. Le rappel sur le roi vit a part, dans le
 * HUD (`HUD.tsx`) : c'est le meme bandeau qui existe deja hors tutoriel,
 * juste plus bavard la premiere fois.
 *
 * Ne s'affiche qu'une fois (voir `tutorial.ts`) ; "Revoir le tutoriel"
 * depuis l'ecran des regles remet le drapeau a zero.
 */
export function Tutorial() {
  const t = useT();
  const phase = useGameStore((s) => s.hud.phase);

  // Calcule une seule fois au montage : si le tutoriel a deja ete vu, le
  // composant ne fait rien du tout (pas d'ecouteur, pas de minuteur).
  const [enabled] = useState(() => !isTutorialDone());
  const [step, setStep] = useState<Step>('intro');
  const hasFlownOnce = useRef(false);
  const toastShown = useRef(false);

  // Le premier toucher, ou que ce soit sur l'ecran, suffit a faire
  // disparaitre la carte d'intro : elle ne doit jamais gener la visee.
  useEffect(() => {
    if (!enabled || step !== 'intro') return;

    const dismiss = () => setStep('hidden');
    window.addEventListener('pointerdown', dismiss, { once: true });
    return () => window.removeEventListener('pointerdown', dismiss);
  }, [enabled, step]);

  // Rappel bref une fois le tout premier lancer resolu, puis fin du
  // tutoriel au coup de sifflet — qu'il ait ete vu en entier ou non : mieux
  // vaut ne plus jamais reapparaitre que se repeter a chaque partie.
  useEffect(() => {
    if (!enabled) return;

    if (phase === 'flying') {
      hasFlownOnce.current = true;
      setStep((current) => (current === 'intro' ? 'hidden' : current));
      return;
    }

    if (hasFlownOnce.current && !toastShown.current && (phase === 'aiming' || phase === 'ai-aiming')) {
      toastShown.current = true;
      setStep('toast');
      const timer = window.setTimeout(() => setStep('hidden'), 3800);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'over') markTutorialDone();
  }, [enabled, phase]);

  if (!enabled || step === 'hidden') return null;

  return (
    <div className="tutorial">
      {step === 'intro' && (
        <div className="tutorial__card">
          <ul className="tutorial__list">
            <li>{t('tutorial.step1')}</li>
            <li>{t('tutorial.step2')}</li>
            <li>{t('tutorial.step3')}</li>
          </ul>
        </div>
      )}

      {step === 'toast' && <div className="tutorial__toast">{t('tutorial.toast')}</div>}
    </div>
  );
}
