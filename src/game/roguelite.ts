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

export type PerkId =
  | 'lancer-bonus'
  | 'bras-vif'
  | 'second-souffle'
  | 'oeil-de-lynx'
  | 'sang-froid'
  | 'jauge-basse'
  | 'poigne-ferme'
  | 'bourse-pleine'
  | 'etude-rapide'
  | 'sursis'
  | 'longue-haleine'
  | 'renfort'
  | 'calme-plat';

/** Libelles et descriptions : src/i18n/dictionaries.ts (perk.<id>.label / .description). */
export const PERK_IDS: readonly PerkId[] = [
  'lancer-bonus',
  'bras-vif',
  'second-souffle',
  'oeil-de-lynx',
  'sang-froid',
  'jauge-basse',
  'poigne-ferme',
  'bourse-pleine',
  'etude-rapide',
  'sursis',
  'longue-haleine',
  'renfort',
  'calme-plat'
];

/** Lancers supplementaires offerts par "Bras infatigable". */
export const LANCER_BONUS_THROWS = 2;
/** Multiplicateur de puissance offert par "Bras vif". */
export const BRAS_VIF_MULTIPLIER = 1.15;
/** Multiplicateur de la deviation aleatoire des lancers, offert par "Oeil de lynx". */
export const OEIL_DE_LYNX_DEVIATION_MULTIPLIER = 0.5;
/** Multiplicateur de l'effet du vent sur les lancers, offert par "Sang-froid". */
export const SANG_FROID_WIND_MULTIPLIER = 0.5;
/** Puissance minimale garantie d'un lancer, offerte par "Jauge basse". */
export const JAUGE_BASSE_MIN_POWER = 0.5;
/** Multiplicateur du seuil de vitesse necessaire pour renverser un kubb ou le roi, offert par "Poigne ferme". */
export const POIGNE_FERME_THRESHOLD_MULTIPLIER = 0.85;
/** Multiplicateur des pieces gagnees sur la manche, offert par "Bourse pleine". */
export const BOURSE_PLEINE_COINS_MULTIPLIER = 1.5;
/** Multiplicateur de l'XP gagnee sur la manche, offert par "Etude rapide". */
export const ETUDE_RAPIDE_XP_MULTIPLIER = 1.5;
/** Temps supplementaire (ms) offert par "Longue haleine". */
export const LONGUE_HALEINE_BONUS_MS = 30000;

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

/**
 * 30 manches, en 3 paliers de 10 : dix manches par niveau d'IA (ai.ts n'en a
 * que trois), chacune sur un terrain different — la difficulte ne monte
 * donc plus qu'une seule fois tous les 10 manches, et c'est la variete de
 * terrain qui porte la progression a l'interieur de chaque palier.
 *
 * Seuls 11 terrains existent (rules.ts::FIELD_PRESETS) pour 10 manches par
 * palier : chaque palier en omet donc un — un terrain different a chaque
 * fois, pour que les trois paliers ne se ressemblent jamais tout a fait.
 * Ordre croissant en complexite (terrain nu, puis obstacles, puis frictions
 * modifiees), Sable (qui cumule les deux) en derniere manche de chaque
 * palier :
 * - Facile (1-10) : omet Riviere.
 * - Moyen (11-20) : omet Boue.
 * - Difficile (21-30) : omet Classique — a ce niveau, plus de manche "a nu".
 *
 * Aucune de ces combinaisons (niveau IA x terrain) n'est nouvelle pour
 * l'IA : chaque ajout de terrain (cf. verify-boue.mjs, verify-terrains.mjs,
 * verify-riviere.mjs dans l'historique de simulation) a toujours ete
 * verifie contre LES TROIS niveaux de difficulte a la fois, jamais
 * seulement celui que l'ancienne echelle lui assignait — reorganiser quel
 * terrain va avec quel niveau ne fait donc, ici aussi, que recombiner des
 * paires deja sures.
 */
export const LADDER: readonly Stage[] = [
  { difficulty: 'facile', fieldPreset: 'classique' },
  { difficulty: 'facile', fieldPreset: 'chicane' },
  { difficulty: 'facile', fieldPreset: 'sentinelle' },
  { difficulty: 'facile', fieldPreset: 'colline' },
  { difficulty: 'facile', fieldPreset: 'nuit' },
  { difficulty: 'facile', fieldPreset: 'glace' },
  { difficulty: 'facile', fieldPreset: 'ruines' },
  { difficulty: 'facile', fieldPreset: 'verger' },
  { difficulty: 'facile', fieldPreset: 'boue' },
  { difficulty: 'facile', fieldPreset: 'sable' },
  { difficulty: 'moyen', fieldPreset: 'classique' },
  { difficulty: 'moyen', fieldPreset: 'chicane' },
  { difficulty: 'moyen', fieldPreset: 'sentinelle' },
  { difficulty: 'moyen', fieldPreset: 'colline' },
  { difficulty: 'moyen', fieldPreset: 'nuit' },
  { difficulty: 'moyen', fieldPreset: 'glace' },
  { difficulty: 'moyen', fieldPreset: 'ruines' },
  { difficulty: 'moyen', fieldPreset: 'verger' },
  { difficulty: 'moyen', fieldPreset: 'riviere' },
  { difficulty: 'moyen', fieldPreset: 'sable' },
  { difficulty: 'difficile', fieldPreset: 'chicane' },
  { difficulty: 'difficile', fieldPreset: 'sentinelle' },
  { difficulty: 'difficile', fieldPreset: 'colline' },
  { difficulty: 'difficile', fieldPreset: 'nuit' },
  { difficulty: 'difficile', fieldPreset: 'glace' },
  { difficulty: 'difficile', fieldPreset: 'ruines' },
  { difficulty: 'difficile', fieldPreset: 'verger' },
  { difficulty: 'difficile', fieldPreset: 'boue' },
  { difficulty: 'difficile', fieldPreset: 'riviere' },
  { difficulty: 'difficile', fieldPreset: 'sable' }
];

/**
 * Deux bonus a proposer, tires parmi ceux que le joueur n'a pas encore.
 * Vide si tous sont deja debloques — l'appelant doit alors avancer
 * directement, sans ecran de choix.
 */
export function pickPerkChoices(owned: readonly PerkId[], rng: () => number = Math.random): PerkId[] {
  const remaining = PERK_IDS.filter((id) => !owned.includes(id));

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
