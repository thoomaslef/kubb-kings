/**
 * Ecran affiche entre le premier rendu React et la fin du chargement de
 * Phaser (chunk separe, cf. GameCanvas.tsx) : sans lui, cette attente reelle
 * ne montrait qu'un canevas vide de la couleur de fond.
 */
export function Boot() {
  return (
    <div className="overlay overlay--solid">
      <div className="boot">
        <h1 className="title">
          KUBB<span className="title__accent">: Kings</span>
        </h1>
        <p className="boot__label">Chargement&hellip;</p>
      </div>
    </div>
  );
}
