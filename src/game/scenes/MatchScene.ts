import Phaser from 'phaser';
import { bridge } from '../GameBridge';
import {
  gameStore,
  type GameMode,
  type MatchPhase,
  type MatchResult,
  type WinReason
} from '../../store/useGameStore';
import { TEAMS, OPPONENT, Team, throwerPosition, type TeamId } from '../entities/Team';
import type { Kubb } from '../entities/Kubb';
import { King } from '../entities/King';
import { Baton } from '../entities/Baton';
import { Obstacle } from '../entities/Obstacle';
import { WALL_BODY } from '../physics/matterConfig';
import { Juice } from '../juice';
import { PALETTE, BORDER_WIDTH } from '../theme';
import { AI_PROFILES, AI_TEAM, decideApproachThrow, decideThrow, type AiProfile } from '../ai';
import { BRAS_VIF_MULTIPLIER, LADDER, LANCER_BONUS_THROWS, type PerkId } from '../roguelite';
import * as sfx from '../audio';
import { translate } from '../../i18n/translate';
import {
  AIM,
  FIELD,
  FIELD_CENTER_X,
  FIELD_CENTER_Y,
  FIELD_PRESETS,
  KNOCKDOWN_IMPACT_SPEED,
  MATCH_DURATION_MS,
  MAX_AIM_DEVIATION_DEG,
  MAX_THROWS_PER_TEAM,
  THROW,
  THROW_POSITIONS,
  WIND_DIRECTIONS,
  availableThrowPositions,
  windAcceleration,
  type FieldPresetId,
  type Wind
} from '../rules';
import { BATONS, batonDeviationDeg, batonPowerMultiplier, batonWindMultiplier, type BatonStats } from '../batons';

/** La plus proche d'un ensemble de positions de lancer (voir THROW_POSITIONS). */
function nearestThrowPosition(x: number, positions: readonly number[]): number {
  return positions.reduce((best, p) => (Math.abs(p - x) < Math.abs(best - x) ? p : best));
}

/**
 * Scene de match : un tour = choisir sa position de lancer, viser, doser, lancer.
 *
 * Le roi est unique et se tient sur la ligne mediane (regle classique du Kubb) :
 * il faut donc contourner le centre du terrain tant qu'on n'a pas le droit de le viser.
 */
export class MatchScene extends Phaser.Scene {
  private phase: MatchPhase = 'aiming';
  /**
   * 'opening' : tir d'ouverture qui determine qui commence (chaque equipe
   * tire une fois vers le roi, s'en approcher sans le toucher fait gagner
   * la priorite). 'match' : partie normale, une fois ce tirage tranche.
   */
  private matchStage: 'opening' | 'match' = 'opening';
  /** Resultat du tir d'ouverture de chaque equipe, rempli au fur et a mesure. */
  private openingResults: Partial<Record<TeamId, { touched: boolean; distance: number }>> = {};
  /**
   * Le tir d'ouverture en cours a-t-il touche le roi (meme un frolement) ?
   * Remis a zero a chaque tir d'ouverture.
   */
  private openingTouchedKingThisThrow = false;
  private mode: GameMode = 'local';
  private activeTeam: TeamId = 'blue';
  private throwsLeft: Record<TeamId, number> = { blue: 0, red: 0 };
  private timeLeftMs = MATCH_DURATION_MS;
  /**
   * En 2v2, lequel des deux joueurs d'une equipe est au lancer. Purement
   * cosmetique : l'alternance des tours reste celle du 1v1 (un baton, puis
   * l'autre camp) — deux joueurs se partagent juste chaque camp.
   */
  private playerIndex: Record<TeamId, 1 | 2> = { blue: 1, red: 1 };

  private teams!: Record<TeamId, Team>;
  private king!: King;
  private baton: Baton | null = null;
  private obstacles: Obstacle[] = [];
  private fieldPreset: FieldPresetId = 'classique';
  /**
   * Baton choisi au menu — n'affecte QUE les equipes tenues par un joueur
   * humain (isAiTeam false) : l'IA reste toujours sur BATONS.base, cf.
   * batons.ts. Stats brutes ; les multiplicateurs se calculent a la volee
   * (batonPowerMultiplier/batonDeviationDeg/batonWindMultiplier).
   */
  private batonStats: BatonStats = BATONS.base;
  /** Bonus de la run en cours (mode 'defi' uniquement, sinon toujours vide). */
  private runPerks: PerkId[] = [];
  /** "Second souffle" ne rembourse qu'un seul lancer par manche. */
  private secondSouffleUsed = false;
  /** Le lancer en cours a-t-il deja fait tomber un kubb ? Remis a zero a chaque tir. */
  private knockedThisThrow = false;
  /**
   * Le lancer en cours a-t-il deja ricoche sur une bande ? Remis a zero a
   * chaque tir. Un kubb adverse abattu apres un tel ricochet redresse un
   * kubb tombe de son propre camp (le plus a gauche) — recompense un tir
   * indirect plus difficile a placer.
   */
  private bouncedWallThisThrow = false;
  /**
   * Vent (direction + force) pour la partie en cours, tire une seule fois a
   * create() — jamais par lancer, sans quoi il n'y aurait rien a lire ni a
   * compenser. null si la meteo est desactivee.
   */
  private wind: Wind | null = null;

  /** Position de lancer courante de chaque equipe, le long de sa ligne de lancer. */
  private throwX: Record<TeamId, number> = { blue: FIELD_CENTER_X, red: FIELD_CENTER_X };
  private throwerSprites!: Record<TeamId, Phaser.GameObjects.Image>;

  private aimGfx!: Phaser.GameObjects.Graphics;
  private isDragging = false;
  private aimAngle = 0;
  private aimPower = 0;

  private restMs = 0;
  private flightMs = 0;
  private lastShownSecond = -1;

  private juice!: Juice;
  /** Profil de l'IA, ou null en 1v1 local : c'est ce qui distingue les modes. */
  private ai: AiProfile | null = null;
  private aiTimer: Phaser.Time.TimerEvent | null = null;
  private aiTween: Phaser.Tweens.Tween | null = null;
  /** Le jingle d'ouverture du roi ne se joue qu'une fois par equipe. */
  private kingAnnounced: Record<TeamId, boolean> = { blue: false, red: false };
  /** Horodatage du dernier rebond sonorise, pour ne pas mitrailler les bandes. */
  private lastBounceMs = 0;

  constructor() {
    super('MatchScene');
  }

  create() {
    this.phase = 'aiming';
    this.matchStage = 'opening';
    this.openingResults = {};
    this.openingTouchedKingThisThrow = false;
    this.activeTeam = 'blue';
    this.throwsLeft = { blue: MAX_THROWS_PER_TEAM, red: MAX_THROWS_PER_TEAM };
    this.timeLeftMs = MATCH_DURATION_MS;
    this.throwX = { blue: FIELD_CENTER_X, red: FIELD_CENTER_X };
    this.baton = null;
    this.isDragging = false;
    this.aimPower = 0;
    this.lastShownSecond = -1;
    this.kingAnnounced = { blue: false, red: false };
    this.lastBounceMs = 0;
    this.aiTimer = null;
    this.aiTween = null;

    const { mode, difficulty, fieldPreset, kubbSkin, batonId, windEnabled, run } = gameStore.getState();
    this.batonStats = BATONS[batonId];
    this.wind = windEnabled
      ? {
          direction: WIND_DIRECTIONS[Math.floor(Math.random() * WIND_DIRECTIONS.length)],
          force: Math.random() < 0.5 ? 1 : 2
        }
      : null;
    this.mode = mode;
    // En Defi, le niveau et le terrain viennent de l'echelle (roguelite.ts),
    // pas des selecteurs du menu casual — mais l'IA reste exactement la
    // meme machine qu'en solo, juste sur un profil plus dur.
    const stage = mode === 'defi' ? LADDER[run?.stageIndex ?? 0] : null;
    this.ai = stage ? AI_PROFILES[stage.difficulty] : mode === 'solo' ? AI_PROFILES[difficulty] : null;
    this.playerIndex = { blue: 1, red: 1 };
    this.fieldPreset = stage ? stage.fieldPreset : fieldPreset;
    this.runPerks = stage ? run?.perks ?? [] : [];
    this.secondSouffleUsed = false;
    this.knockedThisThrow = false;
    this.bouncedWallThisThrow = false;
    // "Bras infatigable" (Defi) : lancers en plus pour le joueur uniquement.
    if (this.runPerks.includes('lancer-bonus')) this.throwsLeft.blue += LANCER_BONUS_THROWS;

    gameStore.getState().setScreen('match');

    this.drawField();
    this.createWalls();
    this.createThrowers();
    this.createObstacles();

    this.teams = { blue: new Team(this, 'blue', kubbSkin), red: new Team(this, 'red', kubbSkin) };
    this.king = new King(this, FIELD_CENTER_X, FIELD_CENTER_Y);

    this.aimGfx = this.add.graphics().setDepth(5);
    this.juice = new Juice(this);

    this.matter.world.on(Phaser.Physics.Matter.Events.COLLISION_START, this.onCollisionStart, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);

    bridge.on('leave-match', this.handleLeave, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bridge.off('leave-match', this.handleLeave, this);
      // Le ralenti du hit-stop survivrait au changement de scene sans ce reset.
      this.juice.destroy();
      this.cancelAiTurn();
      // Le monde Matter est deja detruit quand SHUTDOWN est emis : on garde le garde-fou.
      this.matter.world?.off(Phaser.Physics.Matter.Events.COLLISION_START, this.onCollisionStart, this);
    });

    this.beginOpeningThrow('blue');
  }

  update(_time: number, delta: number) {
    if (this.phase === 'over') return;

    this.syncShadows();
    if (this.tickClock(delta)) return;

    if (this.phase === 'flying' && this.baton) {
      if (this.wind) this.applyWind(delta);

      this.flightMs += delta;
      this.restMs = this.baton.speed < THROW.restSpeed ? this.restMs + delta : 0;
      this.juice.trail(
        delta,
        this.baton.sprite.x,
        this.baton.sprite.y,
        this.baton.sprite.rotation,
        this.baton.speed / THROW.maxSpeed
      );
      this.baton.rememberSpeed();

      if (this.restMs >= THROW.restDelayMs || this.flightMs >= THROW.maxFlightMs) {
        this.endThrow();
      }
    }
  }

  // ------------------------------------------------------------------ visee

  /** Angle "tout droit" vers le camp adverse. */
  private forwardAngle(): number {
    return TEAMS[this.activeTeam].direction === -1 ? -Math.PI / 2 : Math.PI / 2;
  }

  private origin(): { x: number; y: number } {
    return { x: this.throwX[this.activeTeam], y: TEAMS[this.activeTeam].throwerY };
  }

  /**
   * Positions de lancer reellement disponibles pour une equipe : celles de
   * ses kubbs encore debout — un kubb tombe n'est plus un poste valide.
   */
  private availablePositions(team: TeamId): readonly number[] {
    return availableThrowPositions(this.teams[team].kubbs.map((k) => k.isStanding));
  }

  /**
   * Le point de contact choisit d'abord la position de lancer, mais
   * seulement parmi celles disponibles (l'aplomb d'un de ses propres kubbs
   * encore debout, comme au vrai Kubb) — pas n'importe ou sur une ligne
   * continue.
   */
  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (this.phase !== 'aiming') return;

    this.throwX[this.activeTeam] = nearestThrowPosition(pointer.worldX, this.availablePositions(this.activeTeam));
    this.throwerSprites[this.activeTeam].x = this.throwX[this.activeTeam];

    this.isDragging = true;
    this.aimAngle = this.forwardAngle();
    this.aimPower = AIM.minPower;
    this.drawAim();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.isDragging || this.phase !== 'aiming') return;
    this.updateAim(pointer);
  }

  private onPointerUp() {
    if (!this.isDragging || this.phase !== 'aiming') return;
    this.isDragging = false;
    this.launch();
  }

  /** Angle = position de lancer -> doigt (bride vers l'avant). Puissance = longueur du glissement. */
  private updateAim(pointer: Phaser.Input.Pointer) {
    const origin = this.origin();
    const raw = Phaser.Math.Angle.Between(origin.x, origin.y, pointer.worldX, pointer.worldY);
    const forward = this.forwardAngle();
    const maxDelta = Phaser.Math.DegToRad(AIM.maxAngleDeg);

    const delta = Phaser.Math.Angle.Wrap(raw - forward);
    this.aimAngle = forward + Phaser.Math.Clamp(delta, -maxDelta, maxDelta);

    const distance = Phaser.Math.Distance.Between(origin.x, origin.y, pointer.worldX, pointer.worldY);
    let power = Phaser.Math.Clamp(distance / AIM.maxDragDistance, AIM.minPower, 1);
    // "Bras vif" (Defi) : ne joue que pour le joueur, jamais pour l'IA.
    if (this.activeTeam === 'blue' && this.runPerks.includes('bras-vif')) {
      power = Math.min(1, power * BRAS_VIF_MULTIPLIER);
    }
    this.aimPower = power;

    this.drawAim();
  }

  /**
   * Stats du baton reellement en jeu pour l'equipe active : celui choisi au
   * menu pour une equipe humaine, toujours BATONS.base pour l'IA — son
   * equilibrage n'a jamais ete verifie qu'avec ce baton-la.
   */
  private activeBatonStats(): BatonStats {
    return this.isAiTeam(this.activeTeam) ? BATONS.base : this.batonStats;
  }

  /**
   * Brise : une acceleration constante s'ajoute au baton en vol, dans l'une
   * des 8 directions de la boussole (windAcceleration dans rules.ts) quel
   * que soit l'angle vise, moderee par le Controle du baton en jeu (moins
   * d'effet pour un baton plus etoile en Controle). Le nombre de pas Matter
   * ecoules cette frame se deduit du delta reel, pour rester independant du
   * framerate — meme increment par pas que le modele suivi par l'IA pour
   * compenser sa visee (ai.ts::simulateWindFlight).
   */
  private applyWind(delta: number) {
    if (!this.baton || !this.wind) return;
    const body = this.baton.sprite.body as MatterJS.BodyType;
    const steps = delta / (1000 / 60);
    const accel = windAcceleration(this.wind);
    const mult = batonWindMultiplier(this.activeBatonStats());
    this.baton.sprite.setVelocity(body.velocity.x + accel.x * mult * steps, body.velocity.y + accel.y * mult * steps);
  }

  private launch() {
    const origin = this.origin();
    this.baton = new Baton(this, origin.x, origin.y);
    const stats = this.activeBatonStats();
    this.baton.launch(
      this.aimAngle,
      this.aimPower,
      batonDeviationDeg(stats, MAX_AIM_DEVIATION_DEG),
      batonPowerMultiplier(stats)
    );

    this.juice.throwStart(origin.x, origin.y, this.aimPower);

    this.phase = 'flying';
    this.flightMs = 0;
    this.restMs = 0;
    this.aimPower = 0;
    this.knockedThisThrow = false;
    this.bouncedWallThisThrow = false;
    this.drawAim();
    this.syncHud();
  }

  private endThrow() {
    this.juice.throwEnd();
    const lastBatonPos = this.baton ? { x: this.baton.sprite.x, y: this.baton.sprite.y } : null;
    this.baton?.destroy();
    this.baton = null;

    // "Second souffle" (Defi) : le tout premier lancer du joueur qui ne
    // renverse rien de la manche n'est pas compte. Une seule fois par manche.
    const refunded =
      this.activeTeam === 'blue' &&
      !this.knockedThisThrow &&
      !this.secondSouffleUsed &&
      this.runPerks.includes('second-souffle');

    if (refunded) {
      this.secondSouffleUsed = true;
      if (lastBatonPos) {
        this.juice.floatingText(
          lastBatonPos.x,
          lastBatonPos.y,
          translate(gameStore.getState().lang, 'match.secondSouffle'),
          '#f2c14e'
        );
      }
    } else {
      this.throwsLeft[this.activeTeam] -= 1;
    }

    // L'autre joueur de cette equipe prendra le prochain lancer de ce camp.
    if (this.mode === '2v2') {
      this.playerIndex[this.activeTeam] = this.playerIndex[this.activeTeam] === 1 ? 2 : 1;
    }

    if (this.matchStage === 'opening') {
      this.resolveOpeningThrow(lastBatonPos);
      return;
    }

    if (this.throwsLeft.blue <= 0 && this.throwsLeft.red <= 0) {
      this.finishOnPoints('throws-exhausted');
      return;
    }

    // On saute l'equipe qui n'a plus de lancers.
    const previous = this.activeTeam;
    const next = OPPONENT[this.activeTeam];
    this.activeTeam = this.throwsLeft[next] > 0 ? next : this.activeTeam;

    if (this.activeTeam !== previous) {
      this.juice.turnBanner(
        this.turnLabel(this.activeTeam),
        TEAMS[this.activeTeam].color,
        FIELD_CENTER_Y,
        this.scale.width
      );
    }

    this.phase = 'aiming';
    this.aimAngle = this.forwardAngle();
    this.drawAim();
    this.syncHud();

    if (this.isAiTeam(this.activeTeam)) this.beginAiTurn();
  }

  // --------------------------------------------------------- tir d'ouverture

  /**
   * Lance le tir d'ouverture d'une equipe : reutilise exactement les memes
   * mecanismes de visee/lancer que le jeu normal (onPointerDown/Move/Up,
   * launch(), la collision, endThrow()) — seule la resolution en fin de tir
   * differe (resolveOpeningThrow au lieu de l'alternance normale des tours).
   */
  private beginOpeningThrow(team: TeamId) {
    this.activeTeam = team;
    this.phase = 'aiming';
    this.openingTouchedKingThisThrow = false;
    this.aimAngle = this.forwardAngle();
    this.aimPower = 0;
    this.drawAim();
    this.syncHud();

    // Rouge tire apres bleu : un bandeau de passage, comme un vrai changement
    // de tour, pour que ce soit clair sur un meme appareil (1v1/2v2 local).
    if (team === 'red') {
      this.juice.turnBanner(this.turnLabel('red'), TEAMS.red.color, FIELD_CENTER_Y, this.scale.width);
    }

    if (this.isAiTeam(team)) this.beginAiOpeningTurn();
  }

  /**
   * Resout le tir d'ouverture qui vient de se terminer : enregistre son
   * resultat (roi touche ou non, distance d'arret), puis soit passe au tir
   * de l'autre equipe, soit tranche qui commence la partie — a egalite
   * (les deux ont touche le roi), on recommence entierement depuis bleu.
   */
  private resolveOpeningThrow(lastBatonPos: { x: number; y: number } | null) {
    const distance = lastBatonPos
      ? Phaser.Math.Distance.Between(lastBatonPos.x, lastBatonPos.y, FIELD_CENTER_X, FIELD_CENTER_Y)
      : Infinity;
    this.openingResults[this.activeTeam] = { touched: this.openingTouchedKingThisThrow, distance };

    if (this.activeTeam === 'blue') {
      this.beginOpeningThrow('red');
      return;
    }

    const blueResult = this.openingResults.blue;
    const redResult = this.openingResults.red;
    if (!blueResult || !redResult) return;

    if (blueResult.touched && redResult.touched) {
      this.openingResults = {};
      this.juice.floatingText(
        FIELD_CENTER_X,
        FIELD_CENTER_Y - 70,
        translate(gameStore.getState().lang, 'match.openingBothTouched'),
        '#f2c14e'
      );
      this.time.delayedCall(1200, () => this.beginOpeningThrow('blue'));
      return;
    }

    const winner: TeamId = blueResult.touched
      ? 'red'
      : redResult.touched
        ? 'blue'
        : blueResult.distance <= redResult.distance
          ? 'blue'
          : 'red';

    this.beginMatch(winner);
  }

  /** Le tirage au sort est tranche : demarre la partie normale avec l'equipe gagnante. */
  private beginMatch(winner: TeamId) {
    this.matchStage = 'match';
    this.activeTeam = winner;
    this.phase = 'aiming';
    this.aimAngle = this.forwardAngle();
    this.juice.turnBanner(this.turnLabel(winner), TEAMS[winner].color, FIELD_CENTER_Y, this.scale.width);
    this.drawAim();
    this.syncHud();

    if (this.isAiTeam(winner)) this.beginAiTurn();
  }

  /**
   * Texte du bandeau de tour. En solo on ne parle plus d'equipes de couleur :
   * il y a le joueur et il y a l'IA. Traduit directement (pas de hook React
   * ici : ce texte est dessine sur le canevas Phaser, hors de tout rendu).
   */
  private turnLabel(team: TeamId): string {
    const lang = gameStore.getState().lang;
    if (this.ai) return translate(lang, this.isAiTeam(team) ? 'match.aiTurn' : 'match.yourTurn');
    const base = translate(lang, 'match.teamTurn', { team: translate(lang, `team.${team}.label`).toUpperCase() });
    return this.mode === '2v2' ? translate(lang, 'match.teamTurnPlayer', { base, n: this.playerIndex[team] }) : base;
  }

  // --------------------------------------------------------------------- IA

  /** L'equipe donnee est-elle tenue par l'IA ? Toujours false en 1v1 local. */
  private isAiTeam(team: TeamId): boolean {
    return this.ai !== null && team === AI_TEAM;
  }

  /**
   * Tour de l'IA : elle reflechit, se deplace le long de sa ligne de lancer,
   * arme, puis tire. Chaque etape est jouee a l'ecran — sans cela le baton
   * partirait de nulle part et le joueur ne comprendrait pas ce qui arrive.
   *
   * Toutes les etapes se gardent sur `phase`, qui repasse a 'over' si la partie
   * se termine entre-temps : un tour d'IA ne doit jamais lancer apres coup.
   */
  private beginAiTurn() {
    const profile = this.ai;
    if (!profile) return;

    this.phase = 'ai-aiming';
    this.aimPower = 0;
    this.aimAngle = this.forwardAngle();
    this.drawAim();
    this.syncHud();

    this.aiTimer = this.time.delayedCall(profile.thinkMs, () => {
      if (this.phase !== 'ai-aiming') return;

      const opponent = this.teams[OPPONENT[AI_TEAM]];
      const shot = decideThrow(
        {
          throwerY: TEAMS[AI_TEAM].throwerY,
          direction: TEAMS[AI_TEAM].direction,
          targets: opponent.kubbs
            .filter((kubb) => kubb.isStanding)
            .map((kubb) => ({ x: kubb.sprite.x, y: kubb.sprite.y })),
          kingTargetable: opponent.standingCount === 0,
          kingStanding: this.king.isStanding,
          obstacles: this.obstacles.map((o) => ({ x: o.sprite.x, y: o.sprite.y })),
          ownStanding: this.teams[AI_TEAM].kubbs.map((k) => k.isStanding),
          ...(this.wind ? { wind: this.wind } : {})
        },
        profile
      );

      this.throwX[AI_TEAM] = shot.throwX;
      this.aimAngle = shot.angle;

      this.aiTween = this.tweens.add({
        targets: this.throwerSprites[AI_TEAM],
        x: shot.throwX,
        duration: 280,
        ease: 'Sine.easeInOut',
        onComplete: () => this.animateAiAim(shot.power)
      });
    });
  }

  /**
   * Tour d'IA pendant le tir d'ouverture : meme mise en scene que beginAiTurn
   * (reflexion, deplacement, jauge, lancer via animateAiAim), mais une
   * decision differente — decideApproachThrow, pas decideThrow — puisqu'il
   * n'y a ici ni kubb ni victoire en jeu, juste le roi a approcher.
   */
  private beginAiOpeningTurn() {
    const profile = this.ai;
    if (!profile) return;

    this.phase = 'ai-aiming';
    this.aimPower = 0;
    this.aimAngle = this.forwardAngle();
    this.drawAim();
    this.syncHud();

    this.aiTimer = this.time.delayedCall(profile.thinkMs, () => {
      if (this.phase !== 'ai-aiming') return;

      const shot = decideApproachThrow(
        {
          throwerY: TEAMS[AI_TEAM].throwerY,
          direction: TEAMS[AI_TEAM].direction,
          obstacles: this.obstacles.map((o) => ({ x: o.sprite.x, y: o.sprite.y })),
          ...(this.wind ? { wind: this.wind } : {})
        },
        profile
      );

      this.throwX[AI_TEAM] = shot.throwX;
      this.aimAngle = shot.angle;

      this.aiTween = this.tweens.add({
        targets: this.throwerSprites[AI_TEAM],
        x: shot.throwX,
        duration: 280,
        ease: 'Sine.easeInOut',
        onComplete: () => this.animateAiAim(shot.power)
      });
    });
  }

  /** Fait monter la jauge de l'IA sous les yeux du joueur, puis lance. */
  private animateAiAim(power: number) {
    if (this.phase !== 'ai-aiming') return;

    const gauge = { value: 0 };
    this.aiTween = this.tweens.add({
      targets: gauge,
      value: power,
      duration: 420,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        this.aimPower = gauge.value;
        this.drawAim();
      },
      onComplete: () => {
        if (this.phase !== 'ai-aiming') return;
        this.aimPower = power;
        this.launch();
      }
    });
  }

  /** Coupe un tour d'IA en cours : fin de partie ou sortie de scene. */
  private cancelAiTurn() {
    this.aiTimer?.remove();
    this.aiTimer = null;
    this.aiTween?.remove();
    this.aiTween = null;
  }

  // ------------------------------------------------------------- collisions

  private onCollisionStart(event: Phaser.Physics.Matter.Events.CollisionStartEvent) {
    if (this.phase !== 'flying' || !this.baton) return;

    for (const pair of event.pairs) {
      const involvesBaton = pair.bodyA.label === 'baton' || pair.bodyB.label === 'baton';
      if (!involvesBaton) continue;

      const speed = this.baton.impactSpeed;
      const hardEnough = speed >= KNOCKDOWN_IMPACT_SPEED;
      // Force normalisee (0 au seuil de chute, 1 a pleine puissance) : tout le
      // feedback — secousse, particules, hauteur du choc — s'echelonne dessus.
      const force = Phaser.Math.Clamp(
        (speed - KNOCKDOWN_IMPACT_SPEED) / (THROW.maxSpeed - KNOCKDOWN_IMPACT_SPEED),
        0,
        1
      );

      // Bandes et rochers se comportent pareil a l'impact : un rebond, rien
      // d'autre. Seule une bande (pas un rocher) marque le lancer comme
      // "indirect" pour la redresse eventuelle d'un kubb tombe (plus bas).
      if (
        pair.bodyA.label === 'wall' ||
        pair.bodyB.label === 'wall' ||
        pair.bodyA.label === 'obstacle' ||
        pair.bodyB.label === 'obstacle'
      ) {
        if (pair.bodyA.label === 'wall' || pair.bodyB.label === 'wall') this.bouncedWallThisThrow = true;
        this.playBounce(speed);
        continue;
      }

      if (this.isKing(pair.bodyA) || this.isKing(pair.bodyB)) {
        // Tir d'ouverture : meme un frolement disqualifie (regle du tirage
        // au sort), mais le roi ne tombe jamais et la partie ne se termine
        // pas ici — resolveOpeningThrow tranche a la fin du lancer.
        if (this.matchStage === 'opening') {
          if (!this.openingTouchedKingThisThrow) {
            this.openingTouchedKingThisThrow = true;
            this.juice.floatingText(
              this.king.sprite.x,
              this.king.sprite.y,
              translate(gameStore.getState().lang, 'match.openingTouched'),
              '#ff5a4a'
            );
          }
          this.playBounce(speed);
          continue;
        }
        if (hardEnough && this.king.isStanding) {
          this.resolveKingHit();
          return;
        }
        this.playBounce(speed);
        continue;
      }

      const kubb = this.asKubb(pair.bodyA) ?? this.asKubb(pair.bodyB);
      if (!kubb || !kubb.isStanding) continue;
      // Une equipe ne peut pas abattre ses propres kubbs.
      if (kubb.team === this.activeTeam) continue;
      if (!hardEnough) {
        // Baton en fin de course : le kubb tient bon, mais le choc s'entend.
        this.playBounce(speed);
        continue;
      }

      const { x, y } = kubb.sprite;
      kubb.knockDown(this);
      this.knockedThisThrow = true;
      this.juice.kubbImpact(x, y, force, TEAMS[kubb.team].color);
      this.juice.floatingText(
        x,
        y,
        translate(
          gameStore.getState().lang,
          this.teams[kubb.team].standingCount === 0 ? 'match.knockedLast' : 'match.knockedDown'
        ),
        TEAMS[this.activeTeam].cssColor
      );
      if (this.bouncedWallThisThrow) this.reviveLeftmostKubb(this.activeTeam);
      this.syncHud();
    }
  }

  /**
   * Recompense un kubb adverse abattu apres un ricochet sur une bande : redresse
   * le premier kubb tombe de son propre camp, toujours le plus a gauche
   * (`kubbs` est range dans cet ordre, comme THROW_POSITIONS). Ne fait rien si
   * l'equipe n'a aucun kubb a terre.
   */
  private reviveLeftmostKubb(team: TeamId) {
    const fallen = this.teams[team].kubbs.find((k) => !k.isStanding);
    if (!fallen) return;

    fallen.reviveUp(this);
    this.juice.floatingText(
      fallen.sprite.x,
      fallen.sprite.y,
      translate(gameStore.getState().lang, 'match.kubbRevived'),
      TEAMS[team].cssColor
    );
  }

  /** Ricochet ou choc trop mou : un son bref, espace pour rester lisible. */
  private playBounce(speed: number) {
    const sprite = this.baton?.sprite;
    if (!sprite || this.time.now - this.lastBounceMs < 110) return;
    this.lastBounceMs = this.time.now;
    this.juice.wallBounce(sprite.x, sprite.y, Phaser.Math.Clamp(speed / THROW.maxSpeed, 0, 1));
  }

  /**
   * Roi touche : victoire si tous les kubbs adverses sont deja tombes,
   * defaite immediate sinon (regle classique du Kubb).
   */
  private resolveKingHit() {
    const legal = this.teams[OPPONENT[this.activeTeam]].standingCount === 0;
    const { x, y } = this.king.sprite;

    this.king.knockDown(this);
    this.juice.kingFall(x, y, legal);
    this.juice.floatingText(
      x,
      y - 46,
      translate(gameStore.getState().lang, legal ? 'match.kingFalls' : 'match.kingTooEarly'),
      legal ? '#f2c14e' : '#ff5a4a'
    );

    this.finish(
      {
        winner: legal ? this.activeTeam : OPPONENT[this.activeTeam],
        reason: legal ? 'king-down' : 'king-early',
        knockedDown: this.knockedDown()
      },
      // Laisse le ralenti, le zoom et la gerbe doree se derouler.
      1500
    );
  }

  private asKubb(body: MatterJS.BodyType): Kubb | undefined {
    const owner = body.gameObject as Phaser.GameObjects.GameObject | null;
    return owner?.getData?.('kubb') as Kubb | undefined;
  }

  private isKing(body: MatterJS.BodyType): boolean {
    return body.label === 'king';
  }

  // ------------------------------------------------------------ fin de match

  /** Kubbs adverses abattus par chaque equipe. */
  private knockedDown(): Record<TeamId, number> {
    return { blue: this.teams.red.downCount, red: this.teams.blue.downCount };
  }

  /** Fin sans roi abattu : le plus grand nombre de kubbs adverses l'emporte. */
  private finishOnPoints(reason: Extract<WinReason, 'timeout' | 'throws-exhausted'>) {
    const knockedDown = this.knockedDown();
    const winner =
      knockedDown.blue === knockedDown.red ? 'draw' : knockedDown.blue > knockedDown.red ? 'blue' : 'red';
    this.finish({ winner, reason, knockedDown });
  }

  private finish(result: MatchResult, delayMs = 750) {
    this.phase = 'over';
    this.isDragging = false;
    this.cancelAiTurn();
    this.baton?.destroy();
    this.baton = null;
    this.aimGfx.clear();
    this.syncHud();

    // Le verdict sonore arrive apres le choc, pas par-dessus.
    this.time.delayedCall(380, () => {
      if (result.winner === 'draw') return;
      if (result.reason === 'king-early') sfx.playDefeat();
      else sfx.playVictory();
    });

    this.time.delayedCall(delayMs, () => this.scene.start('ResultScene', result));
  }

  // ---------------------------------------------------------------- horloge

  /** Renvoie true si le temps ecoule vient de terminer le match. */
  private tickClock(delta: number): boolean {
    this.timeLeftMs = Math.max(0, this.timeLeftMs - delta);

    const second = Math.ceil(this.timeLeftMs / 1000);
    if (second !== this.lastShownSecond) {
      this.lastShownSecond = second;
      gameStore.getState().patchHud({ timeLeftMs: this.timeLeftMs });
      // Compte a rebours sonore sur la derniere ligne droite.
      if (second > 0 && second <= 10) sfx.playTick(second <= 3);
    }

    // On laisse toujours le lancer en cours se terminer avant de siffler la fin.
    if (this.timeLeftMs <= 0 && this.phase === 'aiming') {
      sfx.playBuzzer();
      this.finishOnPoints('timeout');
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ rendu

  private drawAim() {
    const g = this.aimGfx;
    g.clear();
    // Le tour de l'IA se dessine comme celui du joueur : le joueur doit voir
    // d'ou elle tire et avec quelle force.
    if (this.phase !== 'aiming' && this.phase !== 'ai-aiming') return;

    const origin = this.origin();
    const color = TEAMS[this.activeTeam].color;
    const throwerY = TEAMS[this.activeTeam].throwerY;

    // Positions de lancer disponibles : un point par position ENCORE DEBOUT,
    // plus marque sur celle choisie — un kubb tombe n'en a plus.
    for (const x of this.availablePositions(this.activeTeam)) {
      const isActive = Math.abs(x - origin.x) < 1;
      g.fillStyle(color, isActive ? 0.6 : 0.22);
      g.fillCircle(x, throwerY, isActive ? 7 : 5);
    }

    // Fleche et jauge des que la visee est engagee — au doigt ou par l'IA.
    if (!this.isDragging && this.aimPower <= 0) {
      g.lineStyle(2, color, 0.5);
      g.strokeCircle(origin.x, origin.y, 26);
      return;
    }

    const dirX = Math.cos(this.aimAngle);
    const dirY = Math.sin(this.aimAngle);
    const length = 90 + this.aimPower * 430;

    g.lineStyle(4, color, 0.85);
    for (let d = 34; d < length; d += 26) {
      const end = Math.min(d + 13, length);
      g.lineBetween(origin.x + dirX * d, origin.y + dirY * d, origin.x + dirX * end, origin.y + dirY * end);
    }

    const tipX = origin.x + dirX * length;
    const tipY = origin.y + dirY * length;
    const wing = 14;
    g.fillStyle(color, 0.9);
    g.fillTriangle(
      tipX + dirX * wing,
      tipY + dirY * wing,
      tipX - dirY * wing * 0.6 - dirX * wing * 0.4,
      tipY + dirX * wing * 0.6 - dirY * wing * 0.4,
      tipX + dirY * wing * 0.6 - dirX * wing * 0.4,
      tipY - dirX * wing * 0.6 - dirY * wing * 0.4
    );

    this.drawPowerGauge(origin.x, origin.y);
  }

  private drawPowerGauge(x: number, y: number) {
    const g = this.aimGfx;
    const width = 170;
    const height = 12;
    // Cote de l'origine oppose a la propre rangee de kubbs du lanceur
    // (direction pointe vers l'adversaire) : la jauge se dessinait auparavant
    // vers l'arriere et chevauchait les kubbs de sa propre equipe. L'offset
    // reste sous 34 (la ou commencent les tirets de la fleche, cf. drawAim)
    // pour ne pas non plus se retrouver sous la trajectoire visee.
    const gaugeY = y + TEAMS[this.activeTeam].direction * 22 - height / 2;
    const gaugeX = x - width / 2;

    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(gaugeX - 2, gaugeY - 2, width + 4, height + 4, 8);

    const low = Phaser.Display.Color.ValueToColor(0x5ecf7a);
    const high = Phaser.Display.Color.ValueToColor(0xe2564a);
    const mix = Phaser.Display.Color.Interpolate.ColorWithColor(low, high, 100, this.aimPower * 100);
    g.fillStyle(Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b), 1);
    g.fillRoundedRect(gaugeX, gaugeY, Math.max(height, width * this.aimPower), height, 6);
  }

  /**
   * Terrain : pelouse texturee, traces de tonte, lignes de craie, cadre en
   * bois et vignette. Purement decoratif — les bandes physiques sont posees
   * separement par createWalls().
   */
  private drawField() {
    // Pelouse : la tuile generee au boot est repetee, plutot qu'un aplat vert.
    this.add.tileSprite(FIELD.x, FIELD.y, FIELD.width, FIELD.height, 'grass').setOrigin(0, 0).setDepth(0);

    const g = this.add.graphics().setDepth(0);

    // Traces de tonte : bandes alternees, juste assez marquees pour se voir.
    for (let y = FIELD.y; y < FIELD.y + FIELD.height; y += 128) {
      g.fillStyle(PALETTE.mow, 0.045);
      g.fillRect(FIELD.x, y, FIELD.width, Math.min(64, FIELD.y + FIELD.height - y));
    }

    // Ligne mediane, tracee a la craie.
    g.fillStyle(PALETTE.chalk, 0.32);
    for (let x = FIELD.x + 12; x < FIELD.x + FIELD.width - 24; x += 30) {
      g.fillRect(x, FIELD_CENTER_Y - 2, 16, 4);
    }

    (Object.keys(TEAMS) as TeamId[]).forEach((id) => {
      // Ligne de fond : la ou sont alignes les kubbs.
      g.fillStyle(TEAMS[id].color, 0.5);
      g.fillRect(FIELD.x + 12, TEAMS[id].baselineY - 2, FIELD.width - 24, 4);
      // Positions de lancer : un point discret par position disponible (a
      // l'aplomb des kubbs), pas une ligne continue — drawAim() les remet en
      // evidence, plus marquees, pendant la visee.
      g.fillStyle(TEAMS[id].color, 0.18);
      for (const x of THROW_POSITIONS) g.fillCircle(x, TEAMS[id].throwerY, 4);
    });

    // Rond central autour du roi.
    g.lineStyle(2, PALETTE.gold, 0.28);
    g.strokeCircle(FIELD_CENTER_X, FIELD_CENTER_Y, 54);

    this.drawVignette(g);
    this.drawBorder();
  }

  /** Assombrit les bords : donne du volume a une vue de dessus tres plate. */
  private drawVignette(g: Phaser.GameObjects.Graphics) {
    const steps = 24;
    for (let i = 0; i < steps; i += 1) {
      g.lineStyle(2, 0x061109, 0.04 * (1 - i / steps));
      g.strokeRect(FIELD.x + i, FIELD.y + i, FIELD.width - i * 2, FIELD.height - i * 2);
    }
  }

  /**
   * Cadre en bois autour du terrain. Dessine par-dessus les pieces (depth 6.5)
   * pour que le baton passe dessous quand il vient mourir contre une bande.
   */
  private drawBorder() {
    const g = this.add.graphics().setDepth(6.5);
    const b = BORDER_WIDTH;
    const x = FIELD.x - b;
    const y = FIELD.y - b;
    const w = FIELD.width + b * 2;
    const h = FIELD.height + b * 2;
    const right = FIELD.x + FIELD.width;
    const bottom = FIELD.y + FIELD.height;

    g.fillStyle(PALETTE.wood, 1);
    g.fillRect(x, y, w, b);
    g.fillRect(x, bottom, w, b);
    g.fillRect(x, FIELD.y, b, FIELD.height);
    g.fillRect(right, FIELD.y, b, FIELD.height);

    // Joints entre planches.
    g.lineStyle(1, PALETTE.woodDark, 0.45);
    for (let px = x; px <= x + w; px += 46) {
      g.lineBetween(px, y, px, y + b);
      g.lineBetween(px, bottom, px, bottom + b);
    }
    for (let py = FIELD.y; py <= bottom; py += 46) {
      g.lineBetween(x, py, x + b, py);
      g.lineBetween(right, py, right + b, py);
    }

    // Aretes : lumiere sur le chant exterieur, ombre sur le chant interieur.
    g.lineStyle(2, PALETTE.woodLight, 0.5);
    g.strokeRect(x + 1, y + 1, w - 2, h - 2);
    g.lineStyle(2, PALETTE.woodDark, 0.75);
    g.strokeRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height);
  }

  /** Bandes statiques : le baton reste sur le terrain au lieu de partir dans le vide. */
  private createWalls() {
    const t = 60;
    const { width: w, height: h } = FIELD;
    this.matter.add.rectangle(FIELD_CENTER_X, FIELD.y - t / 2, w + t * 2, t, WALL_BODY);
    this.matter.add.rectangle(FIELD_CENTER_X, FIELD.y + h + t / 2, w + t * 2, t, WALL_BODY);
    this.matter.add.rectangle(FIELD.x - t / 2, FIELD_CENTER_Y, t, h + t * 2, WALL_BODY);
    this.matter.add.rectangle(FIELD.x + w + t / 2, FIELD_CENTER_Y, t, h + t * 2, WALL_BODY);
  }

  private createThrowers() {
    const make = (id: TeamId) => {
      const pos = throwerPosition(id);
      return this.add.image(pos.x, pos.y, `thrower-${id}`).setDepth(2);
    };
    this.throwerSprites = { blue: make('blue'), red: make('red') };
  }

  /** Rochers du terrain choisi. Vide sur le preset "classique". */
  private createObstacles() {
    const preset = FIELD_PRESETS[this.fieldPreset];
    this.obstacles = preset.obstacles.map(
      ({ dx, dy }) => new Obstacle(this, FIELD_CENTER_X + dx, FIELD_CENTER_Y + dy)
    );
  }

  // ------------------------------------------------------------------ divers

  /** Les ombres sont des sprites independants : elles suivent leur piece. */
  private syncShadows() {
    this.teams.blue.syncShadows();
    this.teams.red.syncShadows();
    this.king.syncShadow();
    this.baton?.syncShadow();
  }

  private syncHud() {
    const canTargetKing = this.teams[OPPONENT[this.activeTeam]].standingCount === 0;
    this.updateKingHalo(canTargetKing);

    gameStore.getState().patchHud({
      activeTeam: this.activeTeam,
      phase: this.phase,
      stage: this.matchStage,
      kubbsStanding: {
        blue: this.teams.blue.standingCount,
        red: this.teams.red.standingCount
      },
      throwsLeft: { ...this.throwsLeft },
      timeLeftMs: this.timeLeftMs,
      canTargetKing,
      activePlayer: this.playerIndex[this.activeTeam],
      wind: this.wind
    });
  }

  /**
   * Halo dore autour du roi tant que l'equipe active a le droit de le viser.
   * Le jingle d'ouverture ne se joue qu'une fois par equipe : le halo, lui,
   * apparait et disparait a chaque changement de tour.
   */
  private updateKingHalo(canTarget: boolean) {
    if (!this.king.isStanding) {
      this.juice.setKingTargetable(false, FIELD_CENTER_X, FIELD_CENTER_Y, false);
      return;
    }

    const announce = canTarget && !this.kingAnnounced[this.activeTeam];
    if (announce) this.kingAnnounced[this.activeTeam] = true;
    this.juice.setKingTargetable(canTarget, FIELD_CENTER_X, FIELD_CENTER_Y, announce);
  }

  private handleLeave() {
    this.scene.start('MenuScene');
  }
}
