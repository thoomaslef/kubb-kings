/**
 * Sons du jeu, synthetises par code (WebAudio) : aucun fichier a charger.
 *
 * Le contexte audio est cree paresseusement, au premier son declenche par un
 * geste du joueur : les navigateurs mobiles refusent de demarrer l'audio avant
 * une interaction, et un contexte cree trop tot reste bloque en `suspended`.
 */

type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

const MUTE_KEY = 'kubb-kings.muted';

/** Restaure la preference de son du joueur (best effort : storage peut jeter). */
try {
  muted = window.localStorage?.getItem(MUTE_KEY) === '1';
} catch {
  muted = false;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 0.5, ctx.currentTime, 0.02);
  try {
    window.localStorage?.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    /* le son marche quand meme, seule la persistance est perdue */
  }
}

/** Renvoie le contexte pret a l'emploi, ou null si le navigateur n'en a pas. */
function audio(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const Ctor: Ctor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  // Safari/Chrome mobile suspendent le contexte hors interaction.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Bruit blanc court, mis en cache : sert de base a tous les impacts. */
let noiseBuffer: AudioBuffer | null = null;
function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const length = Math.floor(c.sampleRate * 0.5);
    noiseBuffer = c.createBuffer(1, length, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

interface ToneOptions {
  freq: number;
  /** Frequence d'arrivee pour un glissando ; par defaut, pas de glissando. */
  toFreq?: number;
  type?: OscillatorType;
  duration?: number;
  gain?: number;
  /** Retard avant le declenchement, en secondes. */
  delay?: number;
}

/** Une note a enveloppe percussive (attaque immediate, decroissance exponentielle). */
function tone({ freq, toFreq, type = 'sine', duration = 0.2, gain = 0.3, delay = 0 }: ToneOptions) {
  const c = audio();
  if (!c || !master) return;

  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const env = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (toFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, toFreq), t + duration);

  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

interface BurstOptions {
  duration?: number;
  gain?: number;
  /** Frequence de coupure du passe-bas au debut du bruit. */
  freq?: number;
  toFreq?: number;
  q?: number;
  filter?: BiquadFilterType;
  delay?: number;
}

/** Salve de bruit filtre : souffle du lancer, claquement du bois, buzzer. */
function burst({
  duration = 0.15,
  gain = 0.25,
  freq = 1200,
  toFreq,
  q = 1,
  filter = 'lowpass',
  delay = 0
}: BurstOptions) {
  const c = audio();
  if (!c || !master) return;

  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  const band = c.createBiquadFilter();
  const env = c.createGain();

  src.buffer = noise(c);
  band.type = filter;
  band.Q.value = q;
  band.frequency.setValueAtTime(freq, t);
  if (toFreq !== undefined) band.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), t + duration);

  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  src.connect(band).connect(env).connect(master);
  src.start(t);
  src.stop(t + duration + 0.02);
}

// --------------------------------------------------------------- sons du jeu

/** Souffle du baton qui part ; plus le lancer est puissant, plus il siffle. */
export function playThrow(power: number) {
  burst({ duration: 0.16 + power * 0.1, gain: 0.06 + power * 0.1, freq: 700 + power * 1600, toFreq: 300, q: 2, filter: 'bandpass' });
}

/**
 * Choc de deux morceaux de bois. `force` (0..1) elargit le claquement et
 * descend la fondamentale : un impact appuye sonne plus creux.
 */
export function playKnock(force: number) {
  const f = Math.min(1, Math.max(0, force));
  burst({ duration: 0.05 + f * 0.04, gain: 0.16 + f * 0.2, freq: 2600 - f * 700, q: 0.8, filter: 'highpass' });
  tone({ freq: 210 - f * 45, toFreq: 90, type: 'triangle', duration: 0.14 + f * 0.1, gain: 0.16 + f * 0.16 });
  tone({ freq: 420 - f * 90, toFreq: 200, type: 'square', duration: 0.05, gain: 0.05 + f * 0.05 });
}

/** Le baton ricoche sur une bande : meme matiere, beaucoup plus sourd. */
export function playBounce() {
  burst({ duration: 0.05, gain: 0.06, freq: 900, q: 0.7 });
  tone({ freq: 130, toFreq: 70, type: 'triangle', duration: 0.09, gain: 0.07 });
}

/** Le baton s'arrete : petit frottement pour marquer la fin du tour. */
export function playRest() {
  burst({ duration: 0.12, gain: 0.04, freq: 500, toFreq: 160, q: 0.6 });
}

/** Passage de temoin a l'autre equipe. */
export function playTurn() {
  tone({ freq: 480, type: 'sine', duration: 0.1, gain: 0.1 });
  tone({ freq: 720, type: 'sine', duration: 0.13, gain: 0.09, delay: 0.07 });
}

/** Le dernier kubb adverse tombe : le roi devient une cible legale. */
export function playKingUnlocked() {
  tone({ freq: 660, type: 'triangle', duration: 0.18, gain: 0.12 });
  tone({ freq: 880, type: 'triangle', duration: 0.2, gain: 0.11, delay: 0.1 });
  tone({ freq: 1320, type: 'sine', duration: 0.5, gain: 0.09, delay: 0.2 });
}

/** Chute du roi : gros bois, puis la resonance dore. */
export function playKingFall() {
  playKnock(1);
  tone({ freq: 150, toFreq: 55, type: 'sawtooth', duration: 0.6, gain: 0.2, delay: 0.03 });
  tone({ freq: 990, toFreq: 660, type: 'sine', duration: 0.9, gain: 0.1, delay: 0.12 });
}

/** Fanfare de victoire : arpege majeur ascendant. */
export function playVictory() {
  [523, 659, 784, 1047].forEach((freq, i) => {
    tone({ freq, type: 'triangle', duration: 0.42, gain: 0.14, delay: i * 0.11 });
  });
}

/** Defaite : le meme arpege, mineur et descendant. */
export function playDefeat() {
  [440, 370, 294, 233].forEach((freq, i) => {
    tone({ freq, type: 'triangle', duration: 0.5, gain: 0.13, delay: i * 0.13 });
  });
}

/** Bip du compte a rebours, dans les dix dernieres secondes. */
export function playTick(urgent: boolean) {
  tone({ freq: urgent ? 1100 : 820, type: 'square', duration: 0.06, gain: urgent ? 0.1 : 0.06 });
}

/** Fin du temps reglementaire. */
export function playBuzzer() {
  tone({ freq: 220, type: 'sawtooth', duration: 0.85, gain: 0.16 });
  tone({ freq: 224, type: 'sawtooth', duration: 0.85, gain: 0.14 });
}
