import type { Difficulty } from './ai';
import type { FieldPresetId } from './rules';

/**
 * Mode Defi : une echelle de manches contre l'IA, de plus en plus dures,
 * avec un bonus au choix a chaque victoire. Une defaite (ou le timeout, ou
 * un match nul) termine la run sur-le-champ — c'est le ressort roguelite :
 * pas de sauvegarde en cours de route, seule la meilleure serie est retenue.
 *
 * Module volontairement pur, comme ai.ts et tutorial.ts : aucun acces au
 * store ni a la scene, pour rester lisible et testable seul.
 */

export type PerkId = 'lancer-bonus' | 'bras-vif' | 'second-souffle';

export interface Perk {
  id: PerkId;
  label: string;
  description: string;
}

/** Lancers supplementaires offerts par "Bras infatigable". */
export const LANCER_BONUS_THROWS = 2;
/** Multiplicateur de puissance offert par "Bras vif". */
export const BRAS_VIF_MULTIPLIER = 1.15;

export const PERKS: Record<PerkId, Perk> = {
  'lancer-bonus': {
    id: 'lancer-bonus',
    label: 'Bras infatigable',
    description: `+${LANCER_BONUS_THROWS} lancers sur toute la manche`
  },
  'bras-vif': {
    id: 'bras-vif',
    label: 'Bras vif',
    description: `+${Math.round((BRAS_VIF_MULTIPLIER - 1) * 100)}% de puissance au bout du glissement`
  },
  'second-souffle': {
    id: 'second-souffle',
    label: 'Second souffle',
    description: "Le premier lancer qui ne renverse rien n'est pas compte"
  }
};

/**
 * Echelle des manches. Seuls le niveau de l'IA et le terrain changent d'une
 * manche a l'autre — jamais les regles ni l'equilibrage du lancer, deja
 * calibres ailleurs (rules.ts, ai.ts). C'est le meme adversaire qu'en solo,
 * juste de plus en plus severe.
 */
export interface Stage {
  difficulty: Difficulty;
  fieldPreset: FieldPresetId;
}

export const LADDER: readonly Stage[] = [
  { difficulty: 'facile', fieldPreset: 'classique' },
  { difficulty: 'moyen', fieldPreset: 'classique' },
  { difficulty: 'moyen', fieldPreset: 'chicane' },
  { difficulty: 'difficile', fieldPreset: 'chicane' },
  { difficulty: 'difficile', fieldPreset: 'sentinelle' }
];

/**
 * Deux bonus a proposer, tires parmi ceux que le joueur n'a pas encore.
 * Vide si les trois sont deja debloques — l'appelant doit alors avancer
 * directement, sans ecran de choix.
 */
export function pickPerkChoices(owned: readonly PerkId[], rng: () => number = Math.random): PerkId[] {
  const remaining = (Object.keys(PERKS) as PerkId[]).filter((id) => !owned.includes(id));

  // Melange de Fisher-Yates, pour ne pas toujours proposer les memes dans le meme ordre.
  for (let i = remaining.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  return remaining.slice(0, 2);
}

// ------------------------------------------------------------------ meilleure serie

const BEST_STAGE_KEY = 'kubb-kings.defi-best-stage';

/** Nombre de manches franchies lors de la meilleure run — 0 si aucune. */
export function getBestStage(): number {
  try {
    const raw = Number(window.localStorage?.getItem(BEST_STAGE_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
}

export function setBestStageIfHigher(stagesCleared: number) {
  try {
    if (stagesCleared > getBestStage()) {
      window.localStorage?.setItem(BEST_STAGE_KEY, String(stagesCleared));
    }
  } catch {
    /* la serie ne sera pas retenue d'une session a l'autre, sans consequence sur le jeu */
  }
}
