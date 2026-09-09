import { create } from 'zustand';
import type { TeamId } from '../game/entities/Team';
import { KUBBS_PER_TEAM, MATCH_DURATION_MS, MAX_THROWS_PER_TEAM } from '../game/rules';

/** Ecrans hors-jeu geres par React. */
export type Screen = 'boot' | 'menu' | 'rules' | 'match' | 'result' | 'quit';

/** Phase du tour courant, pilotee par MatchScene. */
export type MatchPhase = 'aiming' | 'flying' | 'resolving' | 'over';

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
}

const initialHud = (): HudState => ({
  activeTeam: 'blue',
  phase: 'aiming',
  kubbsStanding: { blue: KUBBS_PER_TEAM, red: KUBBS_PER_TEAM },
  throwsLeft: { blue: MAX_THROWS_PER_TEAM, red: MAX_THROWS_PER_TEAM },
  timeLeftMs: MATCH_DURATION_MS,
  canTargetKing: false
});

interface GameState {
  screen: Screen;
  paused: boolean;
  hud: HudState;
  result: MatchResult | null;

  setScreen: (screen: Screen) => void;
  setPaused: (paused: boolean) => void;
  patchHud: (patch: Partial<HudState>) => void;
  resetHud: () => void;
  setResult: (result: MatchResult) => void;
}

export const useGameStore = create<GameState>((set) => ({
  screen: 'boot',
  paused: false,
  hud: initialHud(),
  result: null,

  setScreen: (screen) => set({ screen }),
  setPaused: (paused) => set({ paused }),
  patchHud: (patch) => set((state) => ({ hud: { ...state.hud, ...patch } })),
  resetHud: () => set({ hud: initialHud(), result: null, paused: false }),
  setResult: (result) => set({ result })
}));

/** Acces hors composant React (depuis les scenes Phaser). */
export const gameStore = useGameStore;
