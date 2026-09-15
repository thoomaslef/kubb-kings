/**
 * Palette et constantes de rendu.
 *
 * Pendant visuel de `rules.ts` : rien ici n'a d'effet sur les regles ni sur la
 * physique. Les corps Matter ont leurs propres dimensions (HITBOX dans
 * `rules.ts`), pour qu'on puisse retoucher les textures sans deplacer
 * l'equilibrage.
 */

export const PALETTE = {
  /** Pelouse : le fond, puis les deux nuances qui la mouchettent. */
  grass: 0x2f6b46,
  grassLight: 0x3f8055,
  grassDark: 0x265c3b,
  blade: 0x4b9463,
  /** Traces de tonte, en surimpression sur la pelouse. */
  mow: 0xffffff,
  /** Lignes de craie du terrain. */
  chalk: 0xf2f7f0,
  /** Cadre en bois autour du terrain. */
  wood: 0x6b4a2c,
  woodLight: 0x93693e,
  woodDark: 0x3f2a19,
  /** Bois clair des batons. */
  batonWood: 0xc9975b,
  batonWoodLight: 0xe8c896,
  batonWoodDark: 0x7a5230,
  /** Or du roi. */
  gold: 0xf2c14e,
  goldLight: 0xffeeb8,
  goldDark: 0x8a6b12,
  /** Teinte des pieces couchees, hors jeu. */
  fallen: 0x6f7a72,
  /** Rochers des terrains a obstacles. */
  rock: 0x6b6f72,
  rockLight: 0x8b9094,
  rockDark: 0x45484a,
  /** Base claire des blocs "marbre" — la teinte d'equipe reste dans le cadre et les veines. */
  marble: 0xe9e6de,
  /** Base neutre des blocs "metal". */
  metal: 0x9aa0a6,
  metalLight: 0xd8dce0,
  metalDark: 0x5a6066,
  /** Base sombre des blocs "ardoise" (boutique). */
  slate: 0x2f3438,
  slateLight: 0x4a5257,
  slateDark: 0x181b1d,
  /** Colline (terrain "Colline") : monticule d'herbe seche, plus clair que la pelouse. */
  hill: 0x8a9c5a,
  hillLight: 0xa8b877,
  hillDark: 0x5f6e3d,
  /** Glace (terrain "Glace") : remplace la pelouse sur tout le terrain. */
  ice: 0xbfe3ef,
  iceLight: 0xe6f6fa,
  iceDark: 0x8fc3d6,
  /** Sable (terrain "Sable") : remplace la pelouse sur tout le terrain. */
  sand: 0xd9c48a,
  sandLight: 0xecdcac,
  sandDark: 0xb89f5f,
  /** Cactus (obstacles du terrain "Sable"), a la place des rochers habituels. */
  cactus: 0x4b7a4a,
  cactusLight: 0x6ea068,
  cactusDark: 0x2f5330,
  cactusSpine: 0xe8dcaa
} as const;

/**
 * Habillage cosmetique des kubbs, choisi au menu. N'a aucune incidence sur
 * les collisions (HITBOX dans rules.ts) ni sur l'IA (ai.ts ne connait pas
 * cette notion) : uniquement une texture differente. Tous sauf "bois" sont
 * des articles de boutique (src/game/shop.ts) : toutes les textures sont
 * generees d'office (BootScene), seul leur affichage au menu est conditionne
 * a la possession.
 */
export type KubbSkin = 'bois' | 'marbre' | 'metal' | 'ardoise';

export const KUBB_SKINS: KubbSkin[] = ['bois', 'marbre', 'metal', 'ardoise'];

/** Seul habillage disponible d'office, sans passer par la boutique. */
export const FREE_KUBB_SKINS: readonly KubbSkin[] = ['bois'];

// Libelles et indices : src/i18n/dictionaries.ts (skin.<id>.label / .hint).

/**
 * Ombres portees. Une source de lumiere unique, en haut a gauche : toutes les
 * ombres partent donc vers le bas a droite, ce qui suffit a donner du relief a
 * une vue de dessus.
 */
export const SHADOW = {
  offsetX: 5,
  offsetY: 7,
  alpha: 0.42,
  /**
   * Echelle du sprite d'ombre. Volontairement plus large que la piece :
   * une ombre entierement cachee derriere son objet ne se voit pas.
   */
  scale: { kubb: 1.05, king: 1.2, baton: 0.85, obstacle: 1.1 }
} as const;

/** Cote du cadre en bois qui entoure le terrain, en pixels de design. */
export const BORDER_WIDTH = 14;
