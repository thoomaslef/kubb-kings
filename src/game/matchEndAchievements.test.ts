import { describe, expect, it } from 'vitest';
import { GIANT_LEVEL_GAP, ONLINE_STREAK_TARGET } from './achievements';
import { endOfMatchAchievements, type MatchEndSummary } from './matchEndAchievements';

/**
 * Chaque succes de fin de partie, avec sa CONTRE-EPREUVE.
 *
 * Verifier qu'un succes se declenche ne suffit pas : un `if` trop permissif
 * passerait le test. Chaque cas verifie donc aussi qu'il NE se declenche PAS
 * quand une seule condition manque — c'est la moitie qui attrape les vraies
 * erreurs.
 */

/** Une defaite terne : aucun succes ne doit en sortir. */
const rien: MatchEndSummary = {
  mode: 'solo',
  won: false,
  draw: false,
  throwsMade: 6,
  missed: true,
  ownKubbsDown: 3,
  touchedWall: true,
  wasCornered: false,
  terrainsWon: 1,
  terrainsTotal: 11,
  onlineWinStreak: 0,
  opponentLevel: 0,
  ownLevel: 1,
  stagesCleared: 1,
  ladderLength: 30
};

/** Une victoire quelconque, sans exploit particulier. */
const victoire: MatchEndSummary = { ...rien, won: true };

const ids = (match: MatchEndSummary) => endOfMatchAchievements(match).map((a) => a.id);

describe('rien ne se decerne sans raison', () => {
  it('une defaite ne rapporte aucun succes', () => {
    expect(ids(rien)).toEqual([]);
  });

  it('une victoire sans exploit non plus', () => {
    expect(ids(victoire)).toEqual([]);
  });
});

describe('Sans faute', () => {
  it('se decerne sur une victoire sans lancer manque', () => {
    expect(ids({ ...victoire, missed: false })).toContain('sans-faute');
  });

  it('ne se decerne pas si un lancer a ete manque', () => {
    expect(ids({ ...victoire, missed: true })).not.toContain('sans-faute');
  });

  it("ne se decerne pas sans avoir lance : ne pas jouer n'est pas etre precis", () => {
    expect(ids({ ...victoire, missed: false, throwsMade: 0 })).not.toContain('sans-faute');
  });

  it('ne se decerne pas sur une defaite, aussi propre soit-elle', () => {
    expect(ids({ ...rien, missed: false })).not.toContain('sans-faute');
  });
});

describe('Victoire parfaite', () => {
  it('se decerne quand aucun kubb du joueur n est tombe', () => {
    expect(ids({ ...victoire, ownKubbsDown: 0 })).toContain('victoire-parfaite');
  });

  it('un seul kubb perdu suffit a l annuler', () => {
    expect(ids({ ...victoire, ownKubbsDown: 1 })).not.toContain('victoire-parfaite');
  });
});

describe('Chirurgien', () => {
  it('se decerne quand aucune bande n a ete touchee', () => {
    expect(ids({ ...victoire, touchedWall: false })).toContain('chirurgien');
  });

  it('une bande touchee l annule', () => {
    expect(ids({ ...victoire, touchedWall: true })).not.toContain('chirurgien');
  });

  it('demande aussi d avoir lance', () => {
    expect(ids({ ...victoire, touchedWall: false, throwsMade: 0 })).not.toContain('chirurgien');
  });
});

describe('Remontada', () => {
  it('se decerne apres etre revenu du bord du gouffre', () => {
    expect(ids({ ...victoire, wasCornered: true })).toContain('remontada');
  });

  it('ne se decerne pas sur une victoire tranquille', () => {
    expect(ids({ ...victoire, wasCornered: false })).not.toContain('remontada');
  });

  it('ne console pas une defaite', () => {
    expect(ids({ ...rien, wasCornered: true })).not.toContain('remontada');
  });
});

describe('Collectionneur', () => {
  it('se decerne quand tous les terrains ont ete gagnes', () => {
    expect(ids({ ...victoire, terrainsWon: 11, terrainsTotal: 11 })).toContain('collectionneur');
  });

  it('un terrain manquant suffit a attendre', () => {
    expect(ids({ ...victoire, terrainsWon: 10, terrainsTotal: 11 })).not.toContain('collectionneur');
  });

  it('suit le nombre reel de terrains, pas un chiffre fige', () => {
    // Ajouter un terrain doit repousser le succes, sans toucher a ce code.
    expect(ids({ ...victoire, terrainsWon: 11, terrainsTotal: 12 })).not.toContain('collectionneur');
  });
});

describe('succes du mode en ligne', () => {
  const enLigne: MatchEndSummary = { ...victoire, mode: 'online', onlineWinStreak: 1 };

  it('Bapteme du feu suit toute victoire en ligne', () => {
    expect(ids(enLigne)).toContain('bapteme-du-feu');
  });

  it('aucun succes en ligne sur une defaite', () => {
    const perdu = { ...enLigne, won: false, onlineWinStreak: 0 };
    for (const id of ['bapteme-du-feu', 'tombeur-de-geant', 'invaincu']) {
      expect(ids(perdu)).not.toContain(id);
    }
  });

  it('aucun succes en ligne hors du mode en ligne', () => {
    // Le mode Defi peut afficher les memes chiffres : le mode doit trancher.
    expect(ids({ ...enLigne, mode: 'defi' })).not.toContain('bapteme-du-feu');
  });

  it('Tombeur de geant demande l ecart annonce', () => {
    const juste = { ...enLigne, ownLevel: 4, opponentLevel: 4 + GIANT_LEVEL_GAP };
    expect(ids(juste)).toContain('tombeur-de-geant');
    expect(ids({ ...juste, opponentLevel: 4 + GIANT_LEVEL_GAP - 1 })).not.toContain('tombeur-de-geant');
  });

  it('Tombeur de geant ne recompense pas de battre plus faible que soi', () => {
    expect(ids({ ...enLigne, ownLevel: 20, opponentLevel: 2 })).not.toContain('tombeur-de-geant');
  });

  it('un adversaire sans carte ne vaut pas un geant', () => {
    // opponentLevel vaut 0 quand rien n'a ete annonce : sans ce garde-fou, un
    // joueur de niveau 1 « battrait un geant » a chaque partie.
    expect(ids({ ...enLigne, ownLevel: 1, opponentLevel: 0 })).not.toContain('tombeur-de-geant');
  });

  it('Invaincu attend le seuil de la serie', () => {
    expect(ids({ ...enLigne, onlineWinStreak: ONLINE_STREAK_TARGET })).toContain('invaincu');
    expect(ids({ ...enLigne, onlineWinStreak: ONLINE_STREAK_TARGET - 1 })).not.toContain('invaincu');
  });

  it('une serie plus longue que le seuil compte toujours', () => {
    expect(ids({ ...enLigne, onlineWinStreak: ONLINE_STREAK_TARGET + 5 })).toContain('invaincu');
  });
});

describe('Increvable', () => {
  const defi: MatchEndSummary = { ...victoire, mode: 'defi' };

  it('se decerne a la derniere manche remportee', () => {
    expect(ids({ ...defi, stagesCleared: 30, ladderLength: 30 })).toContain('increvable');
  });

  it('ne se decerne pas a une manche intermediaire', () => {
    expect(ids({ ...defi, stagesCleared: 29, ladderLength: 30 })).not.toContain('increvable');
  });

  it('ne se decerne pas hors du mode Defi', () => {
    expect(ids({ ...victoire, stagesCleared: 30, ladderLength: 30 })).not.toContain('increvable');
  });

  it('suit la longueur reelle de l echelle', () => {
    // Rallonger le Defi doit repousser le succes, sans toucher a ce code.
    expect(ids({ ...defi, stagesCleared: 30, ladderLength: 40 })).not.toContain('increvable');
  });
});

describe('plusieurs succes sur la meme victoire', () => {
  it('se cumulent', () => {
    const exploit: MatchEndSummary = {
      ...victoire,
      missed: false,
      ownKubbsDown: 0,
      touchedWall: false,
      wasCornered: true,
      terrainsWon: 11
    };
    expect(ids(exploit)).toEqual(
      expect.arrayContaining(['sans-faute', 'victoire-parfaite', 'chirurgien', 'remontada', 'collectionneur'])
    );
  });

  it('et leurs bandeaux ne se superposent jamais', () => {
    const exploit: MatchEndSummary = {
      ...victoire,
      mode: 'online',
      missed: false,
      ownKubbsDown: 0,
      touchedWall: false,
      wasCornered: true,
      terrainsWon: 11,
      ownLevel: 1,
      opponentLevel: 1 + GIANT_LEVEL_GAP,
      onlineWinStreak: ONLINE_STREAK_TARGET
    };
    const hauteurs = endOfMatchAchievements(exploit).map((a) => a.offsetY);
    expect(hauteurs).toHaveLength(8);
    expect(new Set(hauteurs).size).toBe(hauteurs.length);
  });
});
