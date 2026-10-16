import { LADDER, PERK_IDS, type PerkId } from './roguelite';

/**
 * Sauvegarde de la run du mode Defi : fermer le jeu au milieu des 30 manches ne la perd plus.
 *
 * On retient l'ETAT DE LA RUN (manche, bonus, sursis), jamais une partie en cours : la manche interrompue repart de son
 * debut. `perkPending` : la manche venait d'etre gagnee et le bonus n'etait pas encore choisi — la reprise rouvre alors le
 * choix du bonus, sans quoi fermer le jeu a cet instant ferait perdre un bonus.
 * Stockage local de l'appareil (comme la meilleure serie) ; une donnee abimee est ignoree, jamais crue.
 */
export interface SavedRun {
  run: { stageIndex: number; perks: PerkId[]; sursisUsed: boolean };
  perkPending: boolean;
}

const KEY = 'kubb-kings.defi-run';

export function loadSavedRun(): SavedRun | null {
  try {
    const raw = window.localStorage?.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { run?: Partial<SavedRun['run']>; perkPending?: unknown };
    const run = p.run;
    if (!run || typeof run !== 'object') return null;
    const stageIndex = run.stageIndex;
    if (typeof stageIndex !== 'number' || !Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex >= LADDER.length) return null;
    if (!Array.isArray(run.perks) || run.perks.some((id) => !PERK_IDS.includes(id as PerkId))) return null;
    if (new Set(run.perks).size !== run.perks.length) return null;
    return {
      run: { stageIndex, perks: [...(run.perks as PerkId[])], sursisUsed: run.sursisUsed === true },
      perkPending: p.perkPending === true
    };
  } catch {
    return null;
  }
}

export function saveRun(saved: SavedRun) {
  try {
    window.localStorage?.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Sans stockage, la run ne survivra pas a la fermeture : sans consequence sur le jeu.
  }
}

export function clearSavedRun() {
  try {
    window.localStorage?.removeItem(KEY);
  } catch {
    // Rien a effacer.
  }
}

/** Manche (1-indexee) que la reprise fera jouer ou choisir. */
export function savedRunStageNumber(saved: SavedRun): number {
  return saved.perkPending ? saved.run.stageIndex + 2 : saved.run.stageIndex + 1;
}
