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
