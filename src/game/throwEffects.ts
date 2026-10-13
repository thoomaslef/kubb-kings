/**
 * Effets de lancer : teinte de la trainee du baton en vol (Juice.trail),
 * purement cosmetique — aucun effet sur les regles ni sur l'IA (qui ne joue
 * jamais qu'avec 'none'). Les deux effets colores sont des articles de
 * boutique (src/game/shop.ts), verrouilles tant qu'ils n'ont pas ete achetes.
 */
export type ThrowEffectId = 'none' | 'feu' | 'glace';

export const THROW_EFFECT_IDS: readonly ThrowEffectId[] = ['none', 'feu', 'glace'];

/** Disponible d'office, sans passer par la boutique. */
export const FREE_THROW_EFFECT_IDS: readonly ThrowEffectId[] = ['none'];

/** Teinte appliquee a la trainee ; null = couleur d'origine du baton (pas de teinte). */
export const THROW_EFFECT_TINT: Record<ThrowEffectId, number | null> = {
  none: null,
  feu: 0xff6a2a,
  glace: 0x6ad9ff
};

/**
 * Couleurs de la trainee, du coeur (le plus chaud / le plus clair) au bord :
 * chaque image remanente et chaque particule en tire une, ce qui donne un
 * degrade vivant plutot qu'une teinte unique.
 */
export const THROW_EFFECT_PALETTE: Record<Exclude<ThrowEffectId, 'none'>, readonly number[]> = {
  feu: [0xfff3b0, 0xffc14d, 0xff6a2a, 0xc9301a],
  glace: [0xffffff, 0xd6f6ff, 0x8fe3ff, 0x4fb8ff]
};
