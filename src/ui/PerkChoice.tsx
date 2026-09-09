import { useEffect, useMemo, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { LADDER, LANCER_BONUS_THROWS, BRAS_VIF_MULTIPLIER, pickPerkChoices, type PerkId } from '../game/roguelite';
import { useT } from '../i18n/useT';

/** Parametres d'interpolation du texte de description (perk.<id>.description). */
function descParams(id: PerkId): Record<string, number> | undefined {
  if (id === 'lancer-bonus') return { n: LANCER_BONUS_THROWS };
  if (id === 'bras-vif') return { pct: Math.round((BRAS_VIF_MULTIPLIER - 1) * 100) };
  return undefined;
}

/**
 * Entre deux manches du mode Defi : un bonus au choix, applique au joueur
 * uniquement (cf. les perks dans MatchScene). Si les trois sont deja
 * debloques, il n'y a plus rien a proposer — on avance directement sans
 * afficher cet ecran, pour ne pas presenter un choix qui n'en est pas un.
 */
export function PerkChoice() {
  const t = useT();
  const run = useGameStore((s) => s.run);
  const setScreen = useGameStore((s) => s.setScreen);
  const advanceRun = useGameStore((s) => s.advanceRun);
  const addPerk = useGameStore((s) => s.addPerk);

  // Tire une seule fois par passage sur cet ecran, pas a chaque rendu.
  const choices = useMemo(() => pickPerkChoices(run?.perks ?? []), [run]);

  const startedNext = useRef(false);
  useEffect(() => {
    if (choices.length > 0 || startedNext.current) return;
    startedNext.current = true;
    advanceRun();
    bridge.send('restart-match');
  }, [choices, advanceRun]);

  const choose = (id: (typeof choices)[number]) => {
    addPerk(id);
    advanceRun();
    bridge.send('restart-match');
  };

  // Seul ecran qui n'avait aucun moyen de revenir au menu — entre deux
  // manches, un joueur qui veut arreter la run etait coince ici.
  const quitRun = () => {
    bridge.send('leave-match');
    setScreen('menu');
  };

  if (!run) return null;

  // Rien a proposer (les trois bonus sont deja debloques) : l'effet ci-dessus
  // avance tout seul, on affiche juste un mot de passage plutot que du vide.
  if (choices.length === 0) {
    return (
      <div className="overlay overlay--solid">
        <div className="panel">
          <p className="panel__text">{t('perk.screen.next')}</p>
          <div className="button-column">
            <button className="btn btn--ghost" onClick={quitRun}>
              {t('result.defi.abandonRun')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nextStage = run.stageIndex + 2; // +1 pour la manche a venir, +1 pour l'affichage 1-indexe

  return (
    <div className="overlay overlay--solid">
      <div className="panel">
        <h2 className="panel__title">{t('perk.screen.title')}</h2>
        <p className="panel__text">{t('perk.screen.subtitle', { n: nextStage, total: LADDER.length })}</p>

        <div className="button-column">
          {choices.map((id) => (
            <button key={id} className="btn btn--perk" onClick={() => choose(id)}>
              <span className="btn--perk__label">{t(`perk.${id}.label`)}</span>
              <span className="btn--perk__desc">{t(`perk.${id}.description`, descParams(id))}</span>
            </button>
          ))}
          <button className="btn btn--ghost" onClick={quitRun}>
            {t('result.defi.abandonRun')}
          </button>
        </div>
      </div>
    </div>
  );
}
