import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, type AchievementId } from './achievements';
import { BATONS, BATON_IDS, FREE_BATON_IDS } from './batons';
import { LADDER, PERK_IDS } from './roguelite';
import { AI_PROFILES, type Difficulty } from './ai';
import { FIELD_PRESETS, type FieldPresetId } from './rules';
import { SHOP_ITEMS } from './shop';
import { KING_SKINS, KUBB_SKINS, FREE_KING_SKINS, FREE_KUBB_SKINS } from './theme';
import { THROW_EFFECT_IDS, THROW_EFFECT_TINT } from './throwEffects';
import { DICTS } from '../i18n/dictionaries';

/**
 * Coherence du CONTENU : ce que TypeScript ne peut pas voir.
 *
 * Le compilateur verifie les types, pas les tables. Ajouter un succes a
 * l'union `AchievementId` sans sa ligne de recompense, ou un terrain sans sa
 * traduction anglaise, compile parfaitement et casse le jeu a l'execution.
 * C'est la classe d'erreur la plus facile a commettre ici, parce qu'ajouter
 * du contenu demande de toucher a quatre ou cinq endroits a la fois.
 */

describe('succes', () => {
  it('chaque succes a une recompense, et une seule', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chaque succes a un libelle et un indice, en francais comme en anglais', () => {
    for (const { id } of ACHIEVEMENTS) {
      for (const lang of ['fr', 'en'] as const) {
        expect(DICTS[lang][`achievement.${id}.label`], `${lang} label de ${id}`).toBeTruthy();
        expect(DICTS[lang][`achievement.${id}.hint`], `${lang} indice de ${id}`).toBeTruthy();
      }
    }
  });

  it('les recompenses sont strictement positives', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.xp, `xp de ${a.id}`).toBeGreaterThan(0);
      expect(a.coins, `pieces de ${a.id}`).toBeGreaterThan(0);
    }
  });
});

describe('projectiles', () => {
  it('chaque baton annonce a des statistiques', () => {
    for (const id of BATON_IDS) expect(BATONS[id], id).toBeDefined();
  });

  it('les etoiles restent dans 1-5', () => {
    for (const id of BATON_IDS) {
      const { power, precision, control } = BATONS[id];
      for (const [nom, v] of [['puissance', power], ['precision', precision], ['controle', control]] as const) {
        expect(v, `${nom} de ${id}`).toBeGreaterThanOrEqual(1);
        expect(v, `${nom} de ${id}`).toBeLessThanOrEqual(5);
      }
    }
  });

  it('le baton de base est gratuit', () => {
    // Un joueur neuf doit pouvoir jouer : sans projectile gratuit, aucun
    // lancer n'est possible tant que la boutique n'a pas ete visitee.
    expect(FREE_BATON_IDS).toContain('base');
  });

  it('chaque baton a un nom traduit des deux cotes', () => {
    for (const id of BATON_IDS) {
      for (const lang of ['fr', 'en'] as const) {
        expect(DICTS[lang][`baton.${id}.label`], `${lang} nom de ${id}`).toBeTruthy();
      }
    }
  });
});

describe('terrains', () => {
  it('chaque terrain a un reglage et un nom traduit', () => {
    for (const id of Object.keys(FIELD_PRESETS) as FieldPresetId[]) {
      expect(FIELD_PRESETS[id], id).toBeDefined();
      for (const lang of ['fr', 'en'] as const) {
        expect(DICTS[lang][`terrain.${id}.label`], `${lang} nom de ${id}`).toBeTruthy();
      }
    }
  });
});

describe('cosmetiques', () => {
  it('chaque skin de kubb et de roi a un nom traduit', () => {
    for (const skin of KUBB_SKINS) {
      for (const lang of ['fr', 'en'] as const) expect(DICTS[lang][`skin.${skin}.label`], `${lang} ${skin}`).toBeTruthy();
    }
    for (const skin of KING_SKINS) {
      for (const lang of ['fr', 'en'] as const) expect(DICTS[lang][`king.${skin}.label`], `${lang} ${skin}`).toBeTruthy();
    }
  });

  it('il existe toujours au moins un choix gratuit par categorie', () => {
    expect(FREE_KUBB_SKINS.length).toBeGreaterThan(0);
    expect(FREE_KING_SKINS.length).toBeGreaterThan(0);
  });

  it('chaque effet de trainee a une teinte declaree', () => {
    for (const id of THROW_EFFECT_IDS) expect(id in THROW_EFFECT_TINT, id).toBe(true);
  });
});

describe('boutique', () => {
  it('aucun article en double', () => {
    const refs = SHOP_ITEMS.map((i) => `${i.category}:${i.refId}`);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('chaque article coute quelque chose', () => {
    for (const item of SHOP_ITEMS) expect(item.price, `${item.category}:${item.refId}`).toBeGreaterThan(0);
  });

  it('un article ne vend jamais ce qui est deja gratuit', () => {
    const gratuits = [
      ...FREE_BATON_IDS.map((id) => `baton:${id}`),
      ...FREE_KUBB_SKINS.map((id) => `skin:${id}`),
      ...FREE_KING_SKINS.map((id) => `king:${id}`)
    ];
    for (const item of SHOP_ITEMS) {
      expect(gratuits, `${item.category}:${item.refId}`).not.toContain(`${item.category}:${item.refId}`);
    }
  });
});

describe('bonus du mode Defi', () => {
  it('chaque bonus a un libelle et une description dans les deux langues', () => {
    for (const id of PERK_IDS) {
      for (const lang of ['fr', 'en'] as const) {
        expect(DICTS[lang][`perk.${id}.label`], `${lang} libelle de ${id}`).toBeTruthy();
        expect(DICTS[lang][`perk.${id}.description`], `${lang} description de ${id}`).toBeTruthy();
      }
    }
  });

  it('aucun bonus en double', () => {
    expect(new Set(PERK_IDS).size).toBe(PERK_IDS.length);
  });
});

describe('echelle du mode Defi', () => {
  it('compte 30 manches', () => {
    expect(LADDER).toHaveLength(30);
  });

  it('avance par paliers de 10, un par niveau d IA', () => {
    const paliers: Difficulty[] = ['facile', 'moyen', 'difficile'];
    paliers.forEach((difficulty, index) => {
      const palier = LADDER.slice(index * 10, index * 10 + 10);
      expect(palier, difficulty).toHaveLength(10);
      for (const stage of palier) expect(stage.difficulty, `manche du palier ${difficulty}`).toBe(difficulty);
    });
  });

  it('ne repete jamais un terrain a l interieur d un palier', () => {
    for (let index = 0; index < 3; index += 1) {
      const terrains = LADDER.slice(index * 10, index * 10 + 10).map((s) => s.fieldPreset);
      expect(new Set(terrains).size, `palier ${index + 1}`).toBe(10);
    }
  });

  it('ne designe que des terrains et des niveaux qui existent', () => {
    for (const stage of LADDER) {
      expect(FIELD_PRESETS[stage.fieldPreset], stage.fieldPreset).toBeDefined();
      expect(AI_PROFILES[stage.difficulty], stage.difficulty).toBeDefined();
    }
  });

  it('termine chaque palier sur Sable', () => {
    // Choix de rythme : la manche la plus exigeante ferme le palier.
    for (const index of [9, 19, 29]) expect(LADDER[index].fieldPreset, `manche ${index + 1}`).toBe('sable');
  });
});

describe('traductions', () => {
  it('le francais et l anglais couvrent exactement les memes cles', () => {
    const fr = Object.keys(DICTS.fr);
    const en = Object.keys(DICTS.en);
    expect(en.filter((k) => !fr.includes(k)), 'presentes en anglais seulement').toEqual([]);
    expect(fr.filter((k) => !en.includes(k)), 'presentes en francais seulement').toEqual([]);
  });

  it('aucune traduction vide', () => {
    for (const lang of ['fr', 'en'] as const) {
      for (const [key, value] of Object.entries(DICTS[lang])) {
        expect(value.trim(), `${lang}: ${key}`).not.toBe('');
      }
    }
  });

  it('les parametres {x} d une cle sont les memes dans les deux langues', () => {
    // Un {n} oublie cote anglais affiche « {n} » a l'ecran.
    const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(DICTS.fr)) {
      expect(params(DICTS.en[key] ?? ''), key).toEqual(params(DICTS.fr[key]));
    }
  });
});

describe('succes declares et succes recompenses', () => {
  it('les deux listes coincident', () => {
    // `AchievementId` est une union de types ; ACHIEVEMENTS est une table.
    // Rien dans le compilateur ne garantit qu'elles restent alignees.
    const recompenses = new Set<string>(ACHIEVEMENTS.map((a) => a.id));
    const declares: AchievementId[] = [
      'double',
      'triple',
      'perfect',
      'kubb-eloigne',
      'sans-faute',
      'victoire-parfaite',
      'ricochet',
      'roi-dernier-lancer',
      'frolement',
      'nettoyeur',
      'dans-le-vent',
      'chirurgien',
      'remontada',
      'collectionneur',
      'increvable',
      'bapteme-du-feu',
      'tombeur-de-geant',
      'invaincu'
    ];
    expect([...recompenses].sort()).toEqual([...declares].sort());
  });
});
