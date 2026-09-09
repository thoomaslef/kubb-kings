import Phaser from 'phaser';
import { bridge } from '../GameBridge';
import { gameStore, type MatchPhase, type MatchResult, type WinReason } from '../../store/useGameStore';
import { TEAMS, OPPONENT, Team, throwerPosition, type TeamId } from '../entities/Team';
import type { Kubb } from '../entities/Kubb';
import { King } from '../entities/King';
import { Baton } from '../entities/Baton';
import { WALL_BODY } from '../physics/matterConfig';
import { Juice } from '../juice';
import { PALETTE, BORDER_WIDTH } from '../theme';
import { AI_PROFILES, AI_TEAM, decideThrow, type AiProfile } from '../ai';
import * as sfx from '../audio';
import {
  AIM,
  FIELD,
  FIELD_CENTER_X,
  FIELD_CENTER_Y,
  KNOCKDOWN_IMPACT_SPEED,
  MATCH_DURATION_MS,
  MAX_THROWS_PER_TEAM,
  THROW,
  THROW_LINE_MARGIN
} from '../rules';

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

    const { mode, difficulty } = gameStore.getState();
    this.ai = mode === 'solo' ? AI_PROFILES[difficulty] : null;

    gameStore.getState().setScreen('match');

    this.drawField();
    this.createWalls();
    this.createThrowers();

    this.teams = { blue: new Team(this, 'blue'), red: new Team(this, 'red') };
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

    this.aimAngle = this.forwardAngle();
    this.syncHud();
    this.drawAim();

    if (this.isAiTeam(this.activeTeam)) this.beginAiTurn();
  }

  update(_time: number, delta: number) {
    if (this.phase === 'over') return;

    this.syncShadows();
    if (this.tickClock(delta)) return;

    if (this.phase === 'flying' && this.baton) {
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

    this.juice.throwStart(origin.x, origin.y, this.aimPower);

    this.phase = 'flying';
    this.flightMs = 0;
    this.restMs = 0;
    this.aimPower = 0;
    this.drawAim();
    this.syncHud();
  }

  private endThrow() {
    this.juice.throwEnd();
    this.baton?.destroy();
    this.baton = null;
    this.throwsLeft[this.activeTeam] -= 1;

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

  /**
   * Texte du bandeau de tour. En solo on ne parle plus d'equipes de couleur :
   * il y a le joueur et il y a l'IA.
   */
  private turnLabel(team: TeamId): string {
    if (this.ai) return this.isAiTeam(team) ? "AU TOUR DE L'IA" : 'A VOUS DE JOUER';
    return `AU TOUR DE L'EQUIPE ${TEAMS[team].label.toUpperCase()}`;
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
          kingStanding: this.king.isStanding
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

      if (pair.bodyA.label === 'wall' || pair.bodyB.label === 'wall') {
        this.playBounce(speed);
        continue;
      }

      if (this.isKing(pair.bodyA) || this.isKing(pair.bodyB)) {
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
      this.juice.kubbImpact(x, y, force, TEAMS[kubb.team].color);
      this.juice.floatingText(
        x,
        y,
        this.teams[kubb.team].standingCount === 0 ? 'DERNIER !' : 'ABATTU !',
        TEAMS[this.activeTeam].cssColor
      );
      this.syncHud();
    }
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
      legal ? 'LE ROI TOMBE !' : 'ROI TOUCHE TROP TOT',
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

    // Ligne de lancer : rappelle qu'on peut se placer n'importe ou dessus.
    g.lineStyle(2, color, 0.3);
    g.lineBetween(
      FIELD.x + THROW_LINE_MARGIN,
      throwerY,
      FIELD.x + FIELD.width - THROW_LINE_MARGIN,
      throwerY
    );

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
      // Ligne de lancer : plus discrete, elle rappelle qu'on peut s'y placer librement.
      g.fillStyle(TEAMS[id].color, 0.18);
      g.fillRect(FIELD.x + 12, TEAMS[id].throwerY - 1, FIELD.width - 24, 2);
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
      kubbsStanding: {
        blue: this.teams.blue.standingCount,
        red: this.teams.red.standingCount
      },
      throwsLeft: { ...this.throwsLeft },
      timeLeftMs: this.timeLeftMs,
      canTargetKing
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
