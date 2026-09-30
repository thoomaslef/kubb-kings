import { describe, expect, it } from 'vitest';
import {
  INITIAL_PROGRESSION,
  LEVEL_TITLES,
  XP_RULES,
  computeXpAward,
  levelFromXp,
  xpForLevel,
  type MatchXpStats
} from './progression';

/**
 * Le bareme d'XP est ce que le joueur ressent comme « juste » ou « injuste ».
 * Il est pur (aucun stockage, aucun store), donc entierement verifiable ici.
 */

const vide: MatchXpStats = {
  won: false,
  perfectWin: false,
  precisionHits: 0,
  difficultHits: 0,
  doubles: 0,
  triples: 0,
  perfects: 0,
  achievementXp: 0
};

describe('niveaux', () => {
  it('un joueur neuf est au niveau 1', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(INITIAL_PROGRESSION.totalXp).level).toBe(1);
  });

  it('ne descend jamais sous le niveau 1, meme avec une valeur aberrante', () => {
    expect(levelFromXp(-500).level).toBe(1);
  });

  it('le niveau ne recule jamais quand l XP augmente', () => {
    let precedent = 0;
    for (let xp = 0; xp <= 60000; xp += 250) {
      const niveau = levelFromXp(xp).level;
      expect(niveau, `a ${xp} XP`).toBeGreaterThanOrEqual(precedent);
      precedent = niveau;
    }
  });

  it('chaque palier coute strictement plus que le precedent', () => {
    for (let level = 1; level < 30; level += 1) {
      expect(xpForLevel(level + 1), `palier ${level + 1}`).toBeGreaterThan(xpForLevel(level));
    }
  });

  it('l XP restante tient toujours dans le palier courant', () => {
    for (let xp = 0; xp <= 40000; xp += 137) {
      const { xpIntoLevel, xpForThisLevel } = levelFromXp(xp);
      expect(xpIntoLevel, `a ${xp} XP`).toBeGreaterThanOrEqual(0);
      expect(xpIntoLevel, `a ${xp} XP`).toBeLessThan(xpForThisLevel);
    }
  });

  it('chaque niveau atteignable a un titre', () => {
    for (let xp = 0; xp <= 60000; xp += 500) {
      expect(levelFromXp(xp).titleKey, `a ${xp} XP`).toBeTruthy();
    }
    expect(LEVEL_TITLES[0].minLevel).toBe(1);
  });
});

describe('gain d XP', () => {
  it('une defaite sans exploit ne rapporte rien', () => {
    const { award } = computeXpAward(vide, INITIAL_PROGRESSION);
    expect(award.total).toBe(0);
  });

  it('une victoire rapporte au moins la prime de victoire', () => {
    const { award } = computeXpAward({ ...vide, won: true }, INITIAL_PROGRESSION);
    expect(award.win).toBe(XP_RULES.win);
    expect(award.total).toBeGreaterThanOrEqual(XP_RULES.win);
  });

  it('la serie de victoires est plafonnee', () => {
    // Sans plafond, un joueur qui enchaine contre l IA facile creuserait un
    // ecart que plus rien ne rattrape.
    const longue = { ...INITIAL_PROGRESSION, winStreak: 50 };
    const { award } = computeXpAward({ ...vide, won: true }, longue);
    expect(award.streak).toBe(XP_RULES.streakCap * XP_RULES.streakPerWin);
  });

  it('une defaite remet la serie a zero', () => {
    const enSerie = { ...INITIAL_PROGRESSION, winStreak: 4 };
    const { award, after } = computeXpAward(vide, enSerie);
    expect(award.winStreakAfter).toBe(0);
    expect(after.winStreak).toBe(0);
  });

  it('le multiplicateur « Etude rapide » ne s applique PAS aux succes', () => {
    // Un succes est deja une prime forfaitaire : la doubler par un bonus de
    // manche recompenserait deux fois la meme chose.
    const stats = { ...vide, won: true, achievementXp: 1000 };
    const simple = computeXpAward(stats, INITIAL_PROGRESSION).award;
    const boostee = computeXpAward(stats, INITIAL_PROGRESSION, 1.5).award;
    expect(boostee.achievements).toBe(simple.achievements);
    expect(boostee.total - boostee.achievements).toBeGreaterThan(simple.total - simple.achievements);
  });

  it('le total est la somme annoncee, sans terme cache', () => {
    const stats: MatchXpStats = {
      won: true,
      perfectWin: true,
      precisionHits: 3,
      difficultHits: 2,
      doubles: 1,
      triples: 1,
      perfects: 1,
      achievementXp: 250
    };
    const { award } = computeXpAward(stats, INITIAL_PROGRESSION);
    const somme =
      award.win + award.perfectWin + award.precision + award.difficult + award.multi + award.streak + award.achievements;
    expect(award.total).toBe(somme);
  });

  it('l XP accumulee ne recule jamais', () => {
    const { after } = computeXpAward(vide, { ...INITIAL_PROGRESSION, totalXp: 900 });
    expect(after.totalXp).toBeGreaterThanOrEqual(900);
  });

  it('compte la partie jouee, gagnee ou perdue', () => {
    const avant = { ...INITIAL_PROGRESSION, gamesPlayed: 7 };
    expect(computeXpAward(vide, avant).after.gamesPlayed).toBe(8);
    expect(computeXpAward({ ...vide, won: true }, avant).after.gamesPlayed).toBe(8);
  });
});
