import { create } from 'zustand';
import type { TeamId } from '../game/entities/Team';
import type { Difficulty } from '../game/ai';
import type { PerkId } from '../game/roguelite';
import { KUBBS_PER_TEAM, MATCH_DURATION_MS, MAX_THROWS_PER_TEAM, type FieldPresetId } from '../game/rules';
import type { KubbSkin } from '../game/theme';

/** Ecrans hors-jeu geres par React. */
export type Screen = 'boot' | 'menu' | 'rules' | 'match' | 'result' | 'perk' | 'quit';

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
}

const initialHud = (): HudState => ({
  activeTeam: 'blue',
  phase: 'aiming',
  kubbsStanding: { blue: KUBBS_PER_TEAM, red: KUBBS_PER_TEAM },
  throwsLeft: { blue: MAX_THROWS_PER_TEAM, red: MAX_THROWS_PER_TEAM },
  timeLeftMs: MATCH_DURATION_MS,
  canTargetKing: false,
  activePlayer: 1
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
  /** null hors mode 'defi' — pas de run en cours. */
  run: RunState | null;

  setScreen: (screen: Screen) => void;
  setPaused: (paused: boolean) => void;
  patchHud: (patch: Partial<HudState>) => void;
  resetHud: () => void;
  setResult: (result: MatchResult) => void;
  setMode: (mode: GameMode) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setFieldPreset: (preset: FieldPresetId) => void;
  setKubbSkin: (skin: KubbSkin) => void;
  /** (Re)demarre une run a la manche 1, sans bonus. */
  startRun: () => void;
  /** Passe a la manche suivante ; no-op hors run active. */
  advanceRun: () => void;
  /** Ajoute un bonus a la run en cours ; no-op hors run active. */
  addPerk: (id: PerkId) => void;
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
  run: null,

  setScreen: (screen) => set({ screen }),
  setPaused: (paused) => set({ paused }),
  patchHud: (patch) => set((state) => ({ hud: { ...state.hud, ...patch } })),
  resetHud: () => set({ hud: initialHud(), result: null, paused: false }),
  setResult: (result) => set({ result }),
  setMode: (mode) => set({ mode }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setFieldPreset: (preset) => set({ fieldPreset: preset }),
  setKubbSkin: (skin) => set({ kubbSkin: skin }),
  startRun: () => set({ run: { stageIndex: 0, perks: [] } }),
  advanceRun: () =>
    set((state) => (state.run ? { run: { ...state.run, stageIndex: state.run.stageIndex + 1 } } : state)),
  addPerk: (id) =>
    set((state) => (state.run ? { run: { ...state.run, perks: [...state.run.perks, id] } } : state))
}));

/** Acces hors composant React (depuis les scenes Phaser). */
export const gameStore = useGameStore;
