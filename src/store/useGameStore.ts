import { create } from 'zustand';
import type { TeamId } from '../game/entities/teamData';
import type { MatchResult } from '../game/matchResult';
import type { Difficulty } from '../game/ai';
import type { PerkId } from '../game/roguelite';
import { KUBBS_PER_TEAM, MATCH_DURATION_MS, MAX_THROWS_PER_TEAM, type FieldPresetId, type Wind } from '../game/rules';
import type { BatonId } from '../game/batons';
import type { KubbSkin, KingSkin } from '../game/theme';
import type { ThrowEffectId } from '../game/throwEffects';
import { SHOP_ITEMS, isShopItemLevelUnlocked } from '../game/shop';
import type { AchievementId } from '../game/achievements';
import { buildBracket, recordWinner, type TournamentState } from '../game/tournament';
import { computeXpAward, levelFromXp, type MatchXpStats, type ProgressionState, type XpAward } from '../game/progression';
import { loadProgression, saveProgression } from '../game/progressionPersistence';
import { computeCoinsAward } from '../game/currency';
import { loadCurrency, saveCurrency } from '../game/currencyPersistence';
import { loadOwnedItems, saveOwnedItems } from '../game/shopPersistence';
import { loadUnlockedAchievements, saveUnlockedAchievements } from '../game/achievementsPersistence';
import { loadTerrainWins, saveTerrainWins } from '../game/terrainWinsPersistence';
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
  | 'achievements'
  | 'progression'
  | 'legal'
  | 'about'
  | 'online';

/** Phase du tour courant, pilotee par MatchScene. */
export type MatchPhase = 'aiming' | 'ai-aiming' | 'flying' | 'over';

/**
 * Mode de jeu choisi au menu, conserve d'une partie a l'autre.
 * 'local' = 1v1 (deux joueurs). '2v2' garde exactement la meme alternance de
 * lancer que 'local' — un baton, puis l'autre camp — deux joueurs se
 * partagent juste chaque camp, cf. `playerIndex` dans MatchScene.
 * 'defi' = roguelite solo (cf. `run` ci-dessous et `src/game/roguelite.ts`).
 */
export type GameMode = 'local' | '2v2' | 'solo' | 'defi' | 'online';

/** Ou en est la partie en ligne (cf. src/game/online/session.ts). */
export type OnlineStatus =
  /** Salon cree, en attente de l'adversaire. */
  | 'attente'
  /** Les deux joueurs sont la, la partie tourne. */
  | 'en-jeu'
  /** Terminee : l'adversaire est parti, s'est desynchronise, ou on a quitte. */
  | 'terminee';

/** Partie en ligne en cours, cote interface. null hors mode 'online'. */
export interface OnlineState {
  roomCode: string;
  role: 'host' | 'guest';
  status: OnlineStatus;
  /** Camp tenu par ce joueur ; null tant que la poignee de main n'a pas abouti. */
  team: TeamId | null;
  /** Renseigne quand la partie s'arrete autrement que par une fin normale. */
  endedBecause: string | null;
}

/** Progression de la run en cours, en mode 'defi' uniquement. */
export interface RunState {
  /** Index dans roguelite.ts::LADDER — 0 = premiere manche. */
  stageIndex: number;
  /** Bonus deja debloques cette run ; repart a vide a chaque nouvelle run. */
  perks: PerkId[];
  /** "Sursis" deja consomme cette run (une seule fois) ; repart a false a chaque nouvelle run. */
  sursisUsed: boolean;
}

/** Quel match de l'arbre du tournoi le match en cours represente. */
export interface TournamentPending {
  round: number;
  slot: number;
  blueName: string;
  redName: string;
}

// Definis dans game/matchResult.ts (donnee de jeu, transportable sur le
// reseau) et re-exportes ici : les ecrans continuent de les importer du store.
export type { WinReason, MatchResult } from '../game/matchResult';

export interface HudState {
  activeTeam: TeamId;
  phase: MatchPhase;
  /**
   * 'opening' pendant le tir d'ouverture qui determine qui commence (chaque
   * equipe tire une fois vers le roi), 'match' une fois la partie lancee.
   */
  stage: 'opening' | 'match';
  /** Kubbs encore en jeu de chaque equipe (baseline + field = cibles restantes pour l'adversaire). */
  kubbsStanding: Record<TeamId, number>;
  /**
   * Regle "Kubbs de champ" (menu) : nombre de kubbs de champ plantes DANS le
   * camp de chaque equipe — ce sont donc des kubbs ADVERSES, et c'est a
   * l'equipe de ce camp de les degager en priorite avant de viser la ligne
   * d'en face. Indexe par le camp ou ils se dressent, pas par leur
   * proprietaire. Toujours a 0 partout si la regle est desactivee.
   */
  fieldKubbs: Record<TeamId, number>;
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
  fieldKubbs: { blue: 0, red: 0 },
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
  /** Habillage visuel du roi — meme principe que kubbSkin, purement cosmetique. */
  kingSkin: KingSkin;
  /**
   * Baton du joueur (jamais de l'IA, toujours sur le baton de base) — un vrai
   * effet de jeu, pas cosmetique comme kubbSkin. Cf. src/game/batons.ts.
   */
  batonId: BatonId;
  /** Meteo : vent lateral en jeu, off par defaut. */
  windEnabled: boolean;
  /**
   * Regle "Kubbs de champ" (cf. rules.ts::FIELD_KUBB_INSET), off par
   * defaut : un kubb de ligne abattu est replante dans le camp de son
   * lanceur plutot que retire du jeu, et devient une cible prioritaire pour
   * son equipe au tour suivant (MatchScene::legalTargets).
   */
  fieldKubbsEnabled: boolean;
  /**
   * Equipe tenue par le joueur de CET appareil — celle dont les succes,
   * l'XP, les pieces et les bonus de run sont suivis. Toujours 'blue' hors
   * ligne (en 1v1/2v2 local les deux camps sont humains, mais un seul profil
   * existe sur l'appareil). Prevu pour le jeu en ligne, ou l'invite tiendra
   * Rouge : c'est le seul reglage a basculer, cote scene comme cote UI.
   * Non persiste — c'est un role de partie, pas une preference.
   */
  profileTeam: TeamId;
  /** null hors mode 'defi' — pas de run en cours. */
  run: RunState | null;
  /** null hors mode 'online' — pas de partie en ligne en cours. */
  online: OnlineState | null;
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
  /** Identifiants des succes debloques, persistes (achievementsPersistence.ts). */
  unlockedAchievements: string[];
  /**
   * Succes nouvellement debloques par le dernier match termine, pour
   * l'ecran de resultat. Tableau vide tant qu'aucun match n'a ete joue
   * cette session, ou si le dernier match n'en a debloque aucun.
   */
  lastAchievementsUnlocked: AchievementId[];
  /**
   * Terrains sur lesquels le joueur a deja gagne au moins une fois, persistes
   * (terrainWinsPersistence.ts) — seul etat de succes qui se construit d'une
   * partie a l'autre, pour "Collectionneur".
   */
  terrainWins: FieldPresetId[];

  setScreen: (screen: Screen) => void;
  setPaused: (paused: boolean) => void;
  patchHud: (patch: Partial<HudState>) => void;
  resetHud: () => void;
  setResult: (result: MatchResult) => void;
  setMode: (mode: GameMode) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setFieldPreset: (preset: FieldPresetId) => void;
  setKubbSkin: (skin: KubbSkin) => void;
  setKingSkin: (skin: KingSkin) => void;
  setBatonId: (id: BatonId) => void;
  setWindEnabled: (enabled: boolean) => void;
  setFieldKubbsEnabled: (enabled: boolean) => void;
  /** Bascule le camp tenu par le joueur de cet appareil (cf. `profileTeam`). */
  setProfileTeam: (team: TeamId) => void;
  /** (Re)demarre une run a la manche 1, sans bonus. */
  startRun: () => void;
  /** Passe a la manche suivante ; no-op hors run active. */
  advanceRun: () => void;
  /** Ajoute un bonus a la run en cours ; no-op hors run active. */
  addPerk: (id: PerkId) => void;
  /** Consomme le bonus "Sursis" de la run en cours ; no-op hors run active. */
  useSursis: () => void;
  /** Ouvre un salon en ligne (avant meme que l'adversaire arrive). */
  startOnline: (roomCode: string, role: 'host' | 'guest') => void;
  /** Met a jour la partie en ligne en cours ; no-op s'il n'y en a pas. */
  patchOnline: (patch: Partial<OnlineState>) => void;
  /** Referme la partie en ligne (retour au menu). */
  endOnline: () => void;
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
  /** `multiplier` : "Etude rapide" (Defi), 1 sinon. */
  awardMatchXp: (stats: MatchXpStats, multiplier?: number) => void;
  /**
   * Calcule et applique le gain de pieces d'un match qui vient de se
   * terminer (cote equipe Bleue), persiste le nouveau solde.
   * `achievementCoins` : bonus deja calcule des succes nouvellement
   * debloques ce match (cf. unlockAchievements ci-dessous).
   * `multiplier` : "Bourse pleine" (Defi), 1 sinon.
   */
  awardMatchCoins: (knockedDownByBlue: number, won: boolean, achievementCoins?: number, multiplier?: number) => void;
  /** Effet de lancer choisi au menu — voir `trailEffect` ci-dessus. */
  setTrailEffect: (id: ThrowEffectId) => void;
  /**
   * Achete un article de la boutique si possede assez de pieces, pas deja
   * possede, ET niveau suffisant (ShopItem.minLevel) ; no-op sinon (bouton
   * achat desactive cote UI dans ces cas).
   */
  purchaseItem: (itemId: string) => void;
  /**
   * Marque comme possedes les succes donnes, en filtrant ceux deja
   * debloques (idempotent, meme discipline que purchaseItem) : persiste la
   * liste et l'expose via `lastAchievementsUnlocked` pour l'ecran de
   * resultat. Le XP/les pieces de ces succes sont deja comptes ailleurs
   * (matchXpStats.achievementXp consomme par awardMatchXp, achievementCoins
   * passe a awardMatchCoins) — cette action ne fait que persister l'etat
   * "possede" et exposer la liste pour l'affichage.
   */
  unlockAchievements: (ids: AchievementId[]) => void;
  /**
   * Note une victoire sur ce terrain pour le succes "Collectionneur".
   * Idempotent (un terrain deja note n'est pas duplique), comme
   * unlockAchievements/purchaseItem.
   */
  recordTerrainWin: (preset: FieldPresetId) => void;
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
  kingSkin: 'or',
  batonId: 'base',
  windEnabled: false,
  fieldKubbsEnabled: false,
  profileTeam: 'blue',
  run: null,
  online: null,
  tournament: null,
  tournamentPending: null,
  lang: getInitialLang(),
  progression: loadProgression(),
  lastXpAward: null,
  coins: loadCurrency().coins,
  lastCoinsAward: null,
  ownedItems: loadOwnedItems(),
  trailEffect: 'none',
  unlockedAchievements: loadUnlockedAchievements(),
  lastAchievementsUnlocked: [],
  terrainWins: loadTerrainWins() as FieldPresetId[],

  setScreen: (screen) => set({ screen }),
  setPaused: (paused) => set({ paused }),
  patchHud: (patch) => set((state) => ({ hud: { ...state.hud, ...patch } })),
  resetHud: () => set({ hud: initialHud(), result: null, paused: false }),
  setResult: (result) => set({ result }),
  setMode: (mode) => set({ mode }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setFieldPreset: (preset) => set({ fieldPreset: preset }),
  setKubbSkin: (skin) => set({ kubbSkin: skin }),
  setKingSkin: (skin) => set({ kingSkin: skin }),
  setBatonId: (id) => set({ batonId: id }),
  setWindEnabled: (enabled) => set({ windEnabled: enabled }),
  setFieldKubbsEnabled: (enabled) => set({ fieldKubbsEnabled: enabled }),
  setProfileTeam: (team) => set({ profileTeam: team }),
  startRun: () => set({ run: { stageIndex: 0, perks: [], sursisUsed: false } }),
  advanceRun: () =>
    set((state) => (state.run ? { run: { ...state.run, stageIndex: state.run.stageIndex + 1 } } : state)),
  addPerk: (id) =>
    set((state) => (state.run ? { run: { ...state.run, perks: [...state.run.perks, id] } } : state)),
  useSursis: () =>
    set((state) => (state.run ? { run: { ...state.run, sursisUsed: true } } : state)),
  startOnline: (roomCode, role) =>
    set({
      online: { roomCode, role, status: 'attente', team: null, endedBecause: null },
      // L'hote tient Bleue, l'invite Rouge — la session le confirmera, mais
      // l'interface doit deja savoir de quel cote se placer.
      profileTeam: role === 'host' ? 'blue' : 'red'
    }),
  patchOnline: (patch) =>
    set((state) => (state.online ? { online: { ...state.online, ...patch } } : state)),
  endOnline: () => set({ online: null, profileTeam: 'blue' }),
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
  awardMatchXp: (stats, multiplier = 1) =>
    set((state) => {
      const { award, after } = computeXpAward(stats, state.progression, multiplier);
      saveProgression(after);
      return { progression: after, lastXpAward: award };
    }),
  awardMatchCoins: (knockedDownByBlue, won, achievementCoins = 0, multiplier = 1) =>
    set((state) => {
      const gained = computeCoinsAward(knockedDownByBlue, won, achievementCoins, multiplier);
      const coins = state.coins + gained;
      saveCurrency({ coins });
      return { coins, lastCoinsAward: gained };
    }),
  setTrailEffect: (id) => set({ trailEffect: id }),
  purchaseItem: (itemId) =>
    set((state) => {
      const item = SHOP_ITEMS.find((it) => it.id === itemId);
      const level = levelFromXp(state.progression.totalXp).level;
      if (!item || state.ownedItems.includes(itemId) || state.coins < item.price || !isShopItemLevelUnlocked(item, level)) {
        return state;
      }
      const coins = state.coins - item.price;
      const ownedItems = [...state.ownedItems, itemId];
      saveCurrency({ coins });
      saveOwnedItems(ownedItems);
      return { coins, ownedItems };
    }),
  unlockAchievements: (ids) =>
    set((state) => {
      const newOnes = ids.filter((id) => !state.unlockedAchievements.includes(id));
      if (newOnes.length === 0) return { lastAchievementsUnlocked: [] };
      const unlockedAchievements = [...state.unlockedAchievements, ...newOnes];
      saveUnlockedAchievements(unlockedAchievements);
      return { unlockedAchievements, lastAchievementsUnlocked: newOnes };
    }),
  recordTerrainWin: (preset) =>
    set((state) => {
      if (state.terrainWins.includes(preset)) return state;
      const terrainWins = [...state.terrainWins, preset];
      saveTerrainWins(terrainWins);
      return { terrainWins };
    })
}));

/** Acces hors composant React (depuis les scenes Phaser). */
export const gameStore = useGameStore;
