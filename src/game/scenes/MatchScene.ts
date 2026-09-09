import Phaser from 'phaser';
import { bridge } from '../GameBridge';
import { gameStore, type MatchPhase } from '../../store/useGameStore';
import { TEAMS, OPPONENT, throwerPosition, type TeamId } from '../entities/Team';
import { Baton } from '../entities/Baton';
import { WALL_BODY } from '../physics/matterConfig';
import {
  AIM,
  FIELD,
  FIELD_CENTER_X,
  FIELD_CENTER_Y,
  MATCH_DURATION_MS,
  MAX_THROWS_PER_TEAM,
  THROW
} from '../rules';

/**
 * ETAPE 2 : boucle de lancer complete (visee, jauge de puissance, vol, fin de tour)
 * sur un terrain encore vide. Kubbs et roi arrivent aux etapes 3 et 4.
 */
export class MatchScene extends Phaser.Scene {
  private phase: MatchPhase = 'aiming';
  private activeTeam: TeamId = 'blue';
  private throwsLeft: Record<TeamId, number> = { blue: 0, red: 0 };
  private timeLeftMs = MATCH_DURATION_MS;

  private baton: Baton | null = null;
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
    this.baton = null;
    this.isDragging = false;
    this.lastShownSecond = -1;

    gameStore.getState().setScreen('match');

    this.drawField();
    this.createWalls();
    this.drawThrowers();

    this.aimGfx = this.add.graphics().setDepth(5);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);

    bridge.on('leave-match', this.handleLeave, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bridge.off('leave-match', this.handleLeave, this);
    });

    this.syncHud();
    this.drawAim();
  }

  update(_time: number, delta: number) {
    if (this.phase === 'over') return;

    this.tickClock(delta);

    if (this.phase === 'flying' && this.baton) {
      this.flightMs += delta;
      this.restMs = this.baton.speed < THROW.restSpeed ? this.restMs + delta : 0;
      this.baton.rememberSpeed();

      if (this.restMs >= THROW.restDelayMs || this.flightMs >= THROW.maxFlightMs) {
        this.endThrow();
      }
    }
  }

  // ---------------------------------------------------------------- visee

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (this.phase !== 'aiming') return;
    this.isDragging = true;
    this.updateAim(pointer);
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

  /** Angle = direction lanceur -> doigt (bride vers le camp adverse). Puissance = longueur du glissement. */
  private updateAim(pointer: Phaser.Input.Pointer) {
    const origin = throwerPosition(this.activeTeam);
    const raw = Phaser.Math.Angle.Between(origin.x, origin.y, pointer.worldX, pointer.worldY);
    const forward = TEAMS[this.activeTeam].direction === -1 ? -Math.PI / 2 : Math.PI / 2;
    const maxDelta = Phaser.Math.DegToRad(AIM.maxAngleDeg);

    const delta = Phaser.Math.Angle.Wrap(raw - forward);
    this.aimAngle = forward + Phaser.Math.Clamp(delta, -maxDelta, maxDelta);

    const distance = Phaser.Math.Distance.Between(origin.x, origin.y, pointer.worldX, pointer.worldY);
    this.aimPower = Phaser.Math.Clamp(distance / AIM.maxDragDistance, AIM.minPower, 1);

    this.drawAim();
  }

  private launch() {
    const origin = throwerPosition(this.activeTeam);
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
    this.activeTeam = OPPONENT[this.activeTeam];
    this.phase = 'aiming';
    this.drawAim();
    this.syncHud();
  }

  // ---------------------------------------------------------------- horloge

  private tickClock(delta: number) {
    this.timeLeftMs = Math.max(0, this.timeLeftMs - delta);
    const second = Math.ceil(this.timeLeftMs / 1000);
    if (second !== this.lastShownSecond) {
      this.lastShownSecond = second;
      gameStore.getState().patchHud({ timeLeftMs: this.timeLeftMs });
    }
  }

  // ---------------------------------------------------------------- rendu

  private drawAim() {
    const g = this.aimGfx;
    g.clear();
    if (this.phase !== 'aiming') return;

    const origin = throwerPosition(this.activeTeam);
    const color = TEAMS[this.activeTeam].color;
    const dirX = Math.cos(this.aimAngle);
    const dirY = Math.sin(this.aimAngle);

    if (!this.isDragging) {
      // Invite au geste : petit halo pulsant autour du lanceur.
      g.lineStyle(2, color, 0.5);
      g.strokeCircle(origin.x, origin.y, 26);
      return;
    }

    // Trajectoire pointillee, longueur proportionnelle a la puissance.
    const length = 90 + this.aimPower * 430;
    g.lineStyle(4, color, 0.85);
    for (let d = 34; d < length; d += 26) {
      const end = Math.min(d + 13, length);
      g.lineBetween(origin.x + dirX * d, origin.y + dirY * d, origin.x + dirX * end, origin.y + dirY * end);
    }

    // Pointe de fleche.
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
    const gaugeY = y - TEAMS[this.activeTeam].direction * 32 - height / 2;
    const gaugeX = x - width / 2;

    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(gaugeX - 2, gaugeY - 2, width + 4, height + 4, 8);

    // Vert -> jaune -> rouge selon la puissance.
    const low = Phaser.Display.Color.ValueToColor(0x5ecf7a);
    const high = Phaser.Display.Color.ValueToColor(0xe2564a);
    const mix = Phaser.Display.Color.Interpolate.ColorWithColor(low, high, 100, this.aimPower * 100);
    const fill = Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b);

    g.fillStyle(fill, 1);
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
    const w = FIELD.width;
    const h = FIELD.height;
    this.matter.add.rectangle(FIELD_CENTER_X, FIELD.y - t / 2, w + t * 2, t, WALL_BODY);
    this.matter.add.rectangle(FIELD_CENTER_X, FIELD.y + h + t / 2, w + t * 2, t, WALL_BODY);
    this.matter.add.rectangle(FIELD.x - t / 2, FIELD_CENTER_Y, t, h + t * 2, WALL_BODY);
    this.matter.add.rectangle(FIELD.x + w + t / 2, FIELD_CENTER_Y, t, h + t * 2, WALL_BODY);
  }

  private drawThrowers() {
    (Object.keys(TEAMS) as TeamId[]).forEach((id) => {
      const pos = throwerPosition(id);
      this.add.image(pos.x, pos.y, `thrower-${id}`).setDepth(2);
    });
  }

  // ---------------------------------------------------------------- divers

  private syncHud() {
    gameStore.getState().patchHud({
      activeTeam: this.activeTeam,
      phase: this.phase,
      throwsLeft: { ...this.throwsLeft },
      timeLeftMs: this.timeLeftMs
    });
  }

  private handleLeave() {
    this.scene.start('MenuScene');
  }
}
