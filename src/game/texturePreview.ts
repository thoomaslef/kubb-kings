/**
 * Apercu des textures du jeu pour l'interface (ecran Apparence) : le moteur enregistre ici, une fois les textures dessinees,
 * une fonction qui rend une texture sous forme d'image. Hors du moteur (tests unitaires, avant le chargement) : null.
 */
type Previewer = (key: string) => string | null;

let previewer: Previewer | null = null;

export function registerTexturePreviewer(fn: Previewer | null) {
  previewer = fn;
}

export function texturePreview(key: string): string | null {
  try {
    return previewer ? previewer(key) : null;
  } catch {
    return null;
  }
}
