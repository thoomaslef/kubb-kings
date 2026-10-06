import { describe, expect, it } from 'vitest';
import { simulateWindFlight } from './ai';
import {
  BASELINE_INSET,
  drawStartingTeam,
  FIELD,
  FIELD_CENTER_X,
  FIELD_KUBB_INSET,
  FIELD_PRESETS,
  THROW,
  THROWER_INSET,
  type FieldPreset,
  type FieldPresetId
} from './rules';
import { BATONS, BATON_IDS, batonPowerMultiplier, type BatonId } from './batons';

/**
 * Un terrain doit rester TRAVERSABLE.
 *
 * Ce test existe a cause d'un vrai defaut : "Boue" avait ete regle a une
 * friction telle que la portee utile d'un baton a pleine puissance (762 px)
 * tombait sous la distance separant le lanceur de la ligne adverse (830 px).
 * Aucun projectile, aucun dosage ne permettait d'atteindre les kubbs
 * adverses. Le terrain n'etait pas difficile : il etait injouable, et rien ne
 * l'avait signale — ni le compilateur, ni les parties contre l'IA (qui vise
 * les kubbs de champ, bien plus proches), ni l'oeil.
 *
 * La regle est donc verrouillee ici : regler la friction d'un terrain est un
 * choix d'equilibrage, le rendre infranchissable n'en est pas un.
 */

/** Distance reelle a parcourir pour atteindre la ligne de fond adverse. */
const Y_LANCEUR = FIELD.y + FIELD.height - THROWER_INSET;
const DISTANCE_LIGNE = Y_LANCEUR - (FIELD.y + BASELINE_INSET);
/** Un kubb de champ se plante bien plus pres : l'autre distance qui compte. */
const DISTANCE_KUBB_CHAMP = Y_LANCEUR - (FIELD.y + FIELD.height / 2 - FIELD_KUBB_INSET);

/**
 * Penalites tactiques ASSUMEES, pas des oublis : sur Sable, la boule
 * s'enfonce la ou le baton glisse. Ne pas pouvoir traverser le terrain avec
 * elle est precisement le choix qu'on veut imposer au joueur. Toute autre
 * combinaison doit passer.
 */
const PENALITES_ASSUMEES: ReadonlyArray<`${FieldPresetId}/${BatonId}`> = ['sable/boule', 'sable/boulefer'];

/**
 * Portee UTILE : distance parcourue tant que le baton garde de quoi renverser
 * un kubb. Au-dela de THROW.restSpeed il ne fait plus que ramper, et le jeu
 * clot le tour (cf. rules.ts) — compter cette glissade serait se mentir.
 */
function porteeUtile(preset: FieldPreset, batonId: BatonId, power: number): number {
  const stats = BATONS[batonId];
  const frictionDeForme =
    stats.shape === 'boule'
      ? preset.frictionMultiplierBall
      : stats.shape === 'disque'
        ? preset.frictionMultiplierDisque
        : undefined;

  const chemin = simulateWindFlight(
    { x: FIELD_CENTER_X, y: Y_LANCEUR },
    -Math.PI / 2, // droit devant, sans vent : le cas le plus favorable
    Math.min(1, power * batonPowerMultiplier(stats)),
    { x: 0, y: 0 },
    preset.hasHill,
    frictionDeForme ?? preset.frictionMultiplier,
    preset.hasRiver
  );

  let dernier = chemin[0];
  for (const point of chemin) {
    if (point.speed < THROW.restSpeed) break;
    dernier = point;
  }
  return Y_LANCEUR - dernier.y;
}

const terrains = Object.keys(FIELD_PRESETS) as FieldPresetId[];

describe('tout terrain reste traversable', () => {
  it.each(terrains)('%s : la ligne adverse est atteignable a pleine puissance', (id) => {
    const preset = FIELD_PRESETS[id];
    for (const batonId of BATON_IDS) {
      if (PENALITES_ASSUMEES.includes(`${id}/${batonId}`)) continue;
      const portee = porteeUtile(preset, batonId, 1);
      expect(
        portee,
        `${id} avec "${batonId}" : ${Math.round(portee)} px de portee utile pour ${DISTANCE_LIGNE} px a parcourir`
      ).toBeGreaterThanOrEqual(DISTANCE_LIGNE);
    }
  });

  it.each(terrains)('%s : il reste une marge, la portee n est pas juste atteinte', (id) => {
    // Une portee egale a la distance requise voudrait dire « toucher pile a
    // l'arret » : injouable des que la deviation de visee s'en mele.
    const portee = porteeUtile(FIELD_PRESETS[id], 'base', 1);
    expect(portee - DISTANCE_LIGNE, `${id}, baton de base`).toBeGreaterThan(50);
  });

  it.each(terrains)('%s : un kubb de champ est atteignable sans forcer', (id) => {
    // Les kubbs de champ sont la cible la plus frequente une fois la regle
    // activee : ils doivent rester accessibles a puissance moyenne.
    const portee = porteeUtile(FIELD_PRESETS[id], 'base', 0.8);
    expect(portee, `${id} a 80 % de jauge`).toBeGreaterThanOrEqual(DISTANCE_KUBB_CHAMP);
  });
});

describe('hierarchie des terrains', () => {
  const porteeDeBase = (id: FieldPresetId) => porteeUtile(FIELD_PRESETS[id], 'base', 1);

  it('Boue est le terrain le plus lourd', () => {
    const autres = terrains.filter((id) => id !== 'boue');
    for (const id of autres) {
      expect(porteeDeBase('boue'), `Boue devrait porter moins loin que ${id}`).toBeLessThanOrEqual(porteeDeBase(id));
    }
  });

  it('Glace et Riviere portent plus loin que Classique', () => {
    expect(porteeDeBase('glace')).toBeGreaterThan(porteeDeBase('classique'));
    expect(porteeDeBase('riviere')).toBeGreaterThan(porteeDeBase('classique'));
  });

  it('Colline freine, sans empecher de traverser', () => {
    expect(porteeDeBase('colline')).toBeLessThan(porteeDeBase('classique'));
    expect(porteeDeBase('colline')).toBeGreaterThan(DISTANCE_LIGNE);
  });

  it('les terrains a simples obstacles ne changent pas la portee', () => {
    // Chicane, Sentinelle, Nuit, Ruines, Verger ne posent que des rochers (ou
    // rien) : leur difficulte vient du trajet, pas du freinage.
    for (const id of ['chicane', 'sentinelle', 'nuit', 'ruines', 'verger'] as FieldPresetId[]) {
      expect(porteeDeBase(id), id).toBeCloseTo(porteeDeBase('classique'), 0);
    }
  });
});

describe('penalites tactiques', () => {
  it('sur Sable, la boule ne traverse effectivement pas', () => {
    // Si ce test tombe, c'est que la penalite a disparu : le choix
    // boule-vs-baton qui fait l'interet de Sable n'existerait plus.
    expect(porteeUtile(FIELD_PRESETS.sable, 'boule', 1)).toBeLessThan(DISTANCE_LIGNE);
  });

  it('mais elle traverse partout ailleurs', () => {
    for (const id of terrains.filter((t) => t !== 'sable')) {
      expect(porteeUtile(FIELD_PRESETS[id], 'boule', 1), `boule sur ${id}`).toBeGreaterThanOrEqual(DISTANCE_LIGNE);
    }
  });
});

describe('drawStartingTeam', () => {
  it('donne Bleue sous 0,5 et Rouge a partir de 0,5', () => {
    expect(drawStartingTeam(() => 0)).toBe('blue');
    expect(drawStartingTeam(() => 0.4999)).toBe('blue');
    expect(drawStartingTeam(() => 0.5)).toBe('red');
    expect(drawStartingTeam(() => 0.9999)).toBe('red');
  });

  it('est equitable : une chance sur deux, pas un camp avantage', () => {
    // Echantillon deterministe et uniforme : un biais de la regle se verrait
    // ici, pas un aleas du tirage.
    const n = 1000;
    let bleues = 0;
    for (let i = 0; i < n; i += 1) if (drawStartingTeam(() => i / n) === 'blue') bleues += 1;
    expect(bleues).toBe(n / 2);
  });
});
