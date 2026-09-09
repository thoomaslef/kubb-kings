import Phaser from 'phaser';
import { bridge } from '../GameBridge';
import { gameStore, type MatchPhase, type MatchResult, type WinReason } from '../../store/useGameStore';
import { TEAMS, OPPONENT, Team, throwerPosition, type TeamId } from '../entities/Team';
import type { Kubb } from '../entities/Kubb';
import { King } from '../entities/King';
import { Baton } from '../entities/Baton';
import { WALL_BODY } from '../physics/matterConfig';
import {
  AIM,
  FIELD,
  FIELD_CENTER_X,
  FIELD_CENTER_Y,
  KNOCKDOWN_IMPACT_SPEED,
  MATCH_DURATION_MS,
  MAX_THROWS_PER_TEAM,
  THROW
} from '../rules';

/** Marge entre le bord du terrain et la position de lancer extreme. */
const THROW_LINE_MARGIN = 40;

/**
 * Scene de match : un tour = choisir sa position de lancer, viser, doser, lancer.
 *
 * Le roi est unique et se tient sur la ligne mediane (regle classique du Kubb) :
 * il faut donc contourner le centre du terrain tant qu'on n'a pas le droit de le viser.
 */
export class MatchScene extends Phaser.Scene {
  private phase: MatchPhase = 'aiming';
  private activeTeam: TeamId = 'blue';
  private throwsLeft: Record<TeamId, number> = { blue: 0, red: 0 };
  private timeLeftMs = MATCH_DURATION_MS;

  private teams!: Record<TeamId, Team>;
  private king!: King;
  private baton: Baton | null = null;

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

  constructor() {
    super('MatchScene');
  }

  create() {
    this.phase = 'aiming';
    this.activeTeam = 'blue';
    this.throwsLeft = { blue: MAX_THROWS_PER_TEAM, red: MAX_THROWS_PER_TEAM };
    this.timeLeftMs = MATCH_DURATION_MS;
    this.throwX = { blue: FIELD_CENTER_X, red: FIELD_CENTER_X };
    this.baton = null;
    this.isDragging = false;
    this.aimPower = 0;
    this.lastShownSecond = -1;

    gameStore.getState().setScreen('match');

    this.drawField();
    this.createWalls();
    this.createThrowers();

    this.teams = { blue: new Team(this, 'blue'), red: new Team(this, 'red') };
    this.king = new King(this, FIELD_CENTER_X, FIELD_CENTER_Y);

    this.aimGfx = this.add.graphics().setDepth(5);

    this.matter.world.on(Phaser.Physics.Matter.Events.COLLISION_START, this.onCollisionStart, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);

    bridge.on('leave-match', this.handleLeave, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bridge.off('leave-match', this.handleLeave, this);
      // Le monde Matter est deja detruit quand SHUTDOWN est emis : on garde le garde-fou.
      this.matter.world?.off(Phaser.Physics.Matter.Events.COLLISION_START, this.onCollisionStart, this);
    });

    this.aimAngle = this.forwardAngle();
    this.syncHud();
    this.drawAim();
  }

  update(_time: number, delta: number) {
    if (this.phase === 'over') return;

    if (this.tickClock(delta)) return;

    if (this.phase === 'flying' && this.baton) {
      this.flightMs += delta;
      this.restMs = this.baton.speed < THROW.restSpeed ? this.restMs + delta : 0;
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
   * Le point de contact choisit d'abord la position de lancer le long de la
   * ligne de lancer (comme au Kubb, on lance depuis n'importe ou sur sa ligne).
   */
  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (this.phase !== 'aiming') return;

    this.throwX[this.activeTeam] = Phaser.Math.Clamp(
      pointer.worldX,
      FIELD.x + THROW_LINE_MARGIN,
      FIELD.x + FIELD.width - THROW_LINE_MARGIN
    );
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
    this.aimPower = Phaser.Math.Clamp(distance / AIM.maxDragDistance, AIM.minPower, 1);

    this.drawAim();
  }

  private launch() {
    const origin = this.origin();
    this.baton = new Baton(this, origin.x, origin.y);
    this.baton.launch(this.aimAngle, this.aimPower);

    this.phase = 'flying';
    this.flightMs = 0;
    this.restMs = 0;
    this.aimPower = 0;
    this.drawAim();
    this.syncHud();
  }

  private endThrow() {
    this.baton?.destroy();
    this.baton = null;
    this.throwsLeft[this.activeTeam] -= 1;

    if (this.throwsLeft.blue <= 0 && this.throwsLeft.red <= 0) {
      this.finishOnPoints('throws-exhausted');
      return;
    }

    // On saute l'equipe qui n'a plus de lancers.
    const next = OPPONENT[this.activeTeam];
    this.activeTeam = this.throwsLeft[next] > 0 ? next : this.activeTeam;

    this.phase = 'aiming';
    this.aimAngle = this.forwardAngle();
    this.drawAim();
    this.syncHud();
  }

  // ------------------------------------------------------------- collisions

  private onCollisionStart(event: Phaser.Physics.Matter.Events.CollisionStartEvent) {
    if (this.phase !== 'flying' || !this.baton) return;

    for (const pair of event.pairs) {
      const involvesBaton = pair.bodyA.label === 'baton' || pair.bodyB.label === 'baton';
      if (!involvesBaton) continue;

      const hardEnough = this.baton.impactSpeed >= KNOCKDOWN_IMPACT_SPEED;

      if (this.isKing(pair.bodyA) || this.isKing(pair.bodyB)) {
        if (hardEnough && this.king.isStanding) {
          this.resolveKingHit();
          return;
        }
        continue;
      }

      const kubb = this.asKubb(pair.bodyA) ?? this.asKubb(pair.bodyB);
      if (!kubb || !kubb.isStanding) continue;
      // Une equipe ne peut pas abattre ses propres kubbs.
      if (kubb.team === this.activeTeam) continue;
      if (!hardEnough) continue;

      kubb.knockDown(this);
      this.cameras.main.shake(140, 0.006);
      this.syncHud();
    }
  }

  /**
   * Roi touche : victoire si tous les kubbs adverses sont deja tombes,
   * defaite immediate sinon (regle classique du Kubb).
   */
  private resolveKingHit() {
    const legal = this.teams[OPPONENT[this.activeTeam]].standingCount === 0;
    this.king.knockDown(this);
    this.cameras.main.shake(320, 0.012);

    this.finish({
      winner: legal ? this.activeTeam : OPPONENT[this.activeTeam],
      reason: legal ? 'king-down' : 'king-early',
      knockedDown: this.knockedDown()
    });
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

  private finish(result: MatchResult) {
    this.phase = 'over';
    this.isDragging = false;
    this.baton?.destroy();
    this.baton = null;
    this.aimGfx.clear();
    this.syncHud();
    this.time.delayedCall(750, () => this.scene.start('ResultScene', result));
  }

  // ---------------------------------------------------------------- horloge

  /** Renvoie true si le temps ecoule vient de terminer le match. */
  private tickClock(delta: number): boolean {
    this.timeLeftMs = Math.max(0, this.timeLeftMs - delta);

    const second = Math.ceil(this.timeLeftMs / 1000);
    if (second !== this.lastShownSecond) {
      this.lastShownSecond = second;
      gameStore.getState().patchHud({ timeLeftMs: this.timeLeftMs });
    }

    // On laisse toujours le lancer en cours se terminer avant de siffler la fin.
    if (this.timeLeftMs <= 0 && this.phase === 'aiming') {
      this.finishOnPoints('timeout');
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ rendu

  private drawAim() {
    const g = this.aimGfx;
    g.clear();
    if (this.phase !== 'aiming') return;

    const origin = this.origin();
    const color = TEAMS[this.activeTeam].color;
    const throwerY = TEAMS[this.activeTeam].throwerY;

    // Ligne de lancer : rappelle qu'on peut se placer n'importe ou dessus.
    g.lineStyle(2, color, 0.3);
    g.lineBetween(
      FIELD.x + THROW_LINE_MARGIN,
      throwerY,
      FIELD.x + FIELD.width - THROW_LINE_MARGIN,
      throwerY
    );

    if (!this.isDragging) {
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
    const gaugeY = y - TEAMS[this.activeTeam].direction * 34 - height / 2;
    const gaugeX = x - width / 2;

    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(gaugeX - 2, gaugeY - 2, width + 4, height + 4, 8);

    const low = Phaser.Display.Color.ValueToColor(0x5ecf7a);
    const high = Phaser.Display.Color.ValueToColor(0xe2564a);
    const mix = Phaser.Display.Color.Interpolate.ColorWithColor(low, high, 100, this.aimPower * 100);
    g.fillStyle(Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b), 1);
    g.fillRoundedRect(gaugeX, gaugeY, Math.max(height, width * this.aimPower), height, 6);
  }

  private drawField() {
    const g = this.add.graphics();

    g.fillStyle(0x1d4030, 1);
    g.fillRoundedRect(FIELD.x - 8, FIELD.y - 8, FIELD.width + 16, FIELD.height + 16, 18);
    g.fillStyle(0x2f6b46, 1);
    g.fillRoundedRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height, 14);

    g.fillStyle(0x000000, 0.05);
    for (let y = FIELD.y; y < FIELD.y + FIELD.height; y += 128) {
      g.fillRect(FIELD.x, y, FIELD.width, 64);
    }

    g.lineStyle(3, 0xffffff, 0.28);
    for (let x = FIELD.x + 10; x < FIELD.x + FIELD.width - 10; x += 28) {
      g.lineBetween(x, FIELD_CENTER_Y, x + 14, FIELD_CENTER_Y);
    }

    (Object.keys(TEAMS) as TeamId[]).forEach((id) => {
      g.lineStyle(3, TEAMS[id].color, 0.55);
      g.lineBetween(FIELD.x + 10, TEAMS[id].baselineY, FIELD.x + FIELD.width - 10, TEAMS[id].baselineY);
    });

    g.lineStyle(3, 0xffffff, 0.18);
    g.strokeRoundedRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height, 14);

    g.lineStyle(2, 0xf2c14e, 0.35);
    g.strokeCircle(FIELD_CENTER_X, FIELD_CENTER_Y, 46);
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

  // ------------------------------------------------------------------ divers

  private syncHud() {
    gameStore.getState().patchHud({
      activeTeam: this.activeTeam,
      phase: this.phase,
      kubbsStanding: {
        blue: this.teams.blue.standingCount,
        red: this.teams.red.standingCount
      },
      throwsLeft: { ...this.throwsLeft },
      timeLeftMs: this.timeLeftMs,
      canTargetKing: this.teams[OPPONENT[this.activeTeam]].standingCount === 0
    });
  }

  private handleLeave() {
    this.scene.start('MenuScene');
  }
}
