import { create } from 'zustand';
import type { TeamId } from '../game/entities/teamData';
import type { Difficulty } from '../game/ai';
import type { PerkId } from '../game/roguelite';
import { KUBBS_PER_TEAM, MATCH_DURATION_MS, MAX_THROWS_PER_TEAM, type FieldPresetId, type Wind } from '../game/rules';
import type { BatonId } from '../game/batons';
import type { KubbSkin } from '../game/theme';
import type { ThrowEffectId } from '../game/throwEffects';
import { SHOP_ITEMS } from '../game/shop';
import { buildBracket, recordWinner, type TournamentState } from '../game/tournament';
import { computeXpAward, type MatchXpStats, type ProgressionState, type XpAward } from '../game/progression';
import { loadProgression, saveProgression } from '../game/progressionPersistence';
import { computeCoinsAward } from '../game/currency';
import { loadCurrency, saveCurrency } from '../game/currencyPersistence';
import { loadOwnedItems, saveOwnedItems } from '../game/shopPersistence';
import { getInitialLang, persistLang } from '../i18n/langPersistence';
import type { Lang } from '../i18n/translate';

/** Ecrans hors-jeu geres par React. */
export type Screen =
  | 'boot'
  | 'menu'
  | 'rules'
  | 'match'
  | 'result'
  | 'perk'
  | 'quit'
  | 'tournament-setup'
  | 'tournament'
  | 'shop'
  | 'legal'
  | 'about';

/** Phase du tour courant, pilotee par MatchScene. */
export type MatchPhase = 'aiming' | 'ai-aiming' | 'flying' | 'over';

/**
 * Mode de jeu choisi au menu, conserve d'une partie a l'autre.
 * 'local' = 1v1 (deux joueurs). '2v2' garde exactement la meme alternance de
 * lancer que 'local' — un baton, puis l'autre camp — deux joueurs se
 * partagent juste chaque camp, cf. `playerIndex` dans MatchScene.
 * 'defi' = roguelite solo (cf. `run` ci-dessous et `src/game/roguelite.ts`).
 */
export type GameMode = 'local' | '2v2' | 'solo' | 'defi';

/** Progression de la run en cours, en mode 'defi' uniquement. */
export interface RunState {
  /** Index dans roguelite.ts::LADDER — 0 = premiere manche. */
  stageIndex: number;
  /** Bonus deja debloques cette run ; repart a vide a chaque nouvelle run. */
  perks: PerkId[];
}

/** Quel match de l'arbre du tournoi le match en cours represente. */
export interface TournamentPending {
  round: number;
  slot: number;
  blueName: string;
  redName: string;
}

export type WinReason =
  | 'king-down'
  | 'king-early'
  | 'timeout'
  | 'throws-exhausted';

export interface MatchResult {
  winner: TeamId | 'draw';
  reason: WinReason;
  /** Kubbs adverses abattus par chaque equipe, pour l'ecran de fin. */
  knockedDown: Record<TeamId, number>;
}

export interface HudState {
  activeTeam: TeamId;
  phase: MatchPhase;
  /**
   * 'opening' pendant le tir d'ouverture qui determine qui commence (chaque
   * equipe tire une fois vers le roi), 'match' une fois la partie lancee.
   */
  stage: 'opening' | 'match';
  /** Kubbs encore debout de chaque equipe (= cibles restantes pour l'adversaire). */
  kubbsStanding: Record<TeamId, number>;
  throwsLeft: Record<TeamId, number>;
  timeLeftMs: number;
  /** true quand l'equipe active a le droit de viser le roi. */
  canTargetKing: boolean;
  /**
   * Lequel des deux joueurs d'une equipe est au lancer, en mode '2v2'
   * uniquement (1 ou 2). Sans objet en 'local' ou 'solo' — HUD l'ignore alors.
   */
  activePlayer: 1 | 2;
  /** Vent (direction + force) pour la partie en cours ; null si la meteo est desactivee. */
  wind: Wind | null;
}

const initialHud = (): HudState => ({
  activeTeam: 'blue',
  phase: 'aiming',
  stage: 'opening',
  kubbsStanding: { blue: KUBBS_PER_TEAM, red: KUBBS_PER_TEAM },
  throwsLeft: { blue: MAX_THROWS_PER_TEAM, red: MAX_THROWS_PER_TEAM },
  timeLeftMs: MATCH_DURATION_MS,
  canTargetKing: false,
  activePlayer: 1,
  wind: null
});

interface GameState {
  screen: Screen;
  paused: boolean;
  hud: HudState;
  result: MatchResult | null;
  /** Choix du menu : ils survivent a `resetHud`, contrairement au HUD. */
  mode: GameMode;
  difficulty: Difficulty;
  fieldPreset: FieldPresetId;
  /** Habillage visuel des kubbs — purement cosmetique, sans effet sur l'IA. */
  kubbSkin: KubbSkin;
  /**
   * Baton du joueur (jamais de l'IA, toujours sur le baton de base) — un vrai
   * effet de jeu, pas cosmetique comme kubbSkin. Cf. src/game/batons.ts.
   */
  batonId: BatonId;
  /** Meteo : vent lateral en jeu, off par defaut. */
  windEnabled: boolean;
  /** null hors mode 'defi' — pas de run en cours. */
  run: RunState | null;
  /** null hors tournoi local — pas de tournoi en cours. */
  tournament: TournamentState | null;
  /**
   * Match de tournoi en cours (ou dont on vient d'afficher le resultat) :
   * quel match de l'arbre il represente et quel nom joue quelle equipe.
   * null en dehors d'un tournoi.
   */
  tournamentPending: TournamentPending | null;
  /** Langue d'affichage, persistee (voir i18n/langPersistence.ts). */
  lang: Lang;
  /**
   * Progression du joueur (niveau/XP), persistee (progressionPersistence.ts).
   * Cf. src/game/progression.ts pour le bareme et la formule de niveau.
   */
  progression: ProgressionState;
  /**
   * Gain d'XP du dernier match termine, pour l'ecran de resultat (avant/apres
   * niveau inclus, pour detecter un passage de niveau). null tant qu'aucun
   * match n'a ete joue cette session.
   */
  lastXpAward: XpAward | null;
  /** Pieces du joueur, persistees (currencyPersistence.ts). */
  coins: number;
  /**
   * Gain de pieces du dernier match termine, pour l'ecran de resultat. null
   * tant qu'aucun match n'a ete joue cette session.
   */
  lastCoinsAward: number | null;
  /** Identifiants (ShopItem.id) des articles achetes, persistes (shopPersistence.ts). */
  ownedItems: string[];
  /**
   * Effet de lancer du joueur (jamais de l'IA) — cosmetique, choix de session
   * non persiste comme kubbSkin/batonId. Cf. src/game/throwEffects.ts.
   */
  trailEffect: ThrowEffectId;

  setScreen: (screen: Screen) => void;
  setPaused: (paused: boolean) => void;
  patchHud: (patch: Partial<HudState>) => void;
  resetHud: () => void;
  setResult: (result: MatchResult) => void;
  setMode: (mode: GameMode) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setFieldPreset: (preset: FieldPresetId) => void;
  setKubbSkin: (skin: KubbSkin) => void;
  setBatonId: (id: BatonId) => void;
  setWindEnabled: (enabled: boolean) => void;
  /** (Re)demarre une run a la manche 1, sans bonus. */
  startRun: () => void;
  /** Passe a la manche suivante ; no-op hors run active. */
  advanceRun: () => void;
  /** Ajoute un bonus a la run en cours ; no-op hors run active. */
  addPerk: (id: PerkId) => void;
  /** Construit l'arbre a partir des noms (4 ou 8) et demarre le tournoi. */
  startTournament: (names: string[]) => void;
  /** Note quel match de l'arbre le prochain match 1v1 represente. */
  beginTournamentMatch: (round: number, slot: number, blueName: string, redName: string) => void;
  /**
   * Enregistre le vainqueur du match en cours dans l'arbre (no-op sur match
   * nul : on rejoue le meme match plutot que de departager au hasard).
   */
  reportTournamentResult: () => void;
  /** Quitte le tournoi en cours (abandon, ou apres le sacre du champion). */
  resetTournament: () => void;
  setLang: (lang: Lang) => void;
  /**
   * Calcule et applique le gain d'XP d'un match qui vient de se terminer
   * (cote equipe Bleue — "le joueur" du profil, cf. progression.ts),
   * persiste le nouvel etat et le rend disponible via `lastXpAward` pour
   * l'ecran de resultat.
   */
  awardMatchXp: (stats: MatchXpStats) => void;
  /**
   * Calcule et applique le gain de pieces d'un match qui vient de se
   * terminer (cote equipe Bleue), persiste le nouveau solde.
   */
  awardMatchCoins: (knockedDownByBlue: number, won: boolean) => void;
  /** Effet de lancer choisi au menu — voir `trailEffect` ci-dessus. */
  setTrailEffect: (id: ThrowEffectId) => void;
  /**
   * Achete un article de la boutique si possede assez de pieces et pas deja
   * possede ; no-op sinon (bouton achat desactive cote UI dans ces cas).
   */
  purchaseItem: (itemId: string) => void;
}

export const useGameStore = create<GameState>((set) => ({
  screen: 'boot',
  paused: false,
  hud: initialHud(),
  result: null,
  mode: 'solo',
  difficulty: 'moyen',
  fieldPreset: 'classique',
  kubbSkin: 'bois',
  batonId: 'base',
  windEnabled: false,
  run: null,
  tournament: null,
  tournamentPending: null,
  lang: getInitialLang(),
  progression: loadProgression(),
  lastXpAward: null,
  coins: loadCurrency().coins,
  lastCoinsAward: null,
  ownedItems: loadOwnedItems(),
  trailEffect: 'none',

  setScreen: (screen) => set({ screen }),
  setPaused: (paused) => set({ paused }),
  patchHud: (patch) => set((state) => ({ hud: { ...state.hud, ...patch } })),
  resetHud: () => set({ hud: initialHud(), result: null, paused: false }),
  setResult: (result) => set({ result }),
  setMode: (mode) => set({ mode }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setFieldPreset: (preset) => set({ fieldPreset: preset }),
  setKubbSkin: (skin) => set({ kubbSkin: skin }),
  setBatonId: (id) => set({ batonId: id }),
  setWindEnabled: (enabled) => set({ windEnabled: enabled }),
  startRun: () => set({ run: { stageIndex: 0, perks: [] } }),
  advanceRun: () =>
    set((state) => (state.run ? { run: { ...state.run, stageIndex: state.run.stageIndex + 1 } } : state)),
  addPerk: (id) =>
    set((state) => (state.run ? { run: { ...state.run, perks: [...state.run.perks, id] } } : state)),
  startTournament: (names) => set({ tournament: buildBracket(names), tournamentPending: null }),
  beginTournamentMatch: (round, slot, blueName, redName) =>
    set({ tournamentPending: { round, slot, blueName, redName } }),
  reportTournamentResult: () =>
    set((state) => {
      if (!state.tournament || !state.tournamentPending || !state.result) return state;
      // Match nul : on rejoue le meme match plutot que de departager au hasard.
      if (state.result.winner === 'draw') return state;
      const { round, slot, blueName, redName } = state.tournamentPending;
      const winnerName = state.result.winner === 'blue' ? blueName : redName;
      return {
        tournament: recordWinner(state.tournament, round, slot, winnerName),
        tournamentPending: null
      };
    }),
  resetTournament: () => set({ tournament: null, tournamentPending: null }),
  setLang: (lang) => {
    persistLang(lang);
    set({ lang });
  },
  awardMatchXp: (stats) =>
    set((state) => {
      const { award, after } = computeXpAward(stats, state.progression);
      saveProgression(after);
      return { progression: after, lastXpAward: award };
    }),
  awardMatchCoins: (knockedDownByBlue, won) =>
    set((state) => {
      const gained = computeCoinsAward(knockedDownByBlue, won);
      const coins = state.coins + gained;
      saveCurrency({ coins });
      return { coins, lastCoinsAward: gained };
    }),
  setTrailEffect: (id) => set({ trailEffect: id }),
  purchaseItem: (itemId) =>
    set((state) => {
      const item = SHOP_ITEMS.find((it) => it.id === itemId);
      if (!item || state.ownedItems.includes(itemId) || state.coins < item.price) return state;
      const coins = state.coins - item.price;
      const ownedItems = [...state.ownedItems, itemId];
      saveCurrency({ coins });
      saveOwnedItems(ownedItems);
      return { coins, ownedItems };
    })
}));

/** Acces hors composant React (depuis les scenes Phaser). */
export const gameStore = useGameStore;
