# L'adversaire solo

Comment l'IA vise, et ce que son calibrage a appris.

> Fait partie de la documentation de **KUBB: Kings** — [retour au sommaire](../README.md).

---

## L'adversaire solo

[`src/game/ai.ts`](../src/game/ai.ts) est un **module pur** : aucun import Phaser, aucun
acces a la scene, aleatoire injecte. Il recoit une photo du plateau et rend un lancer.
On peut donc le simuler par milliers hors du navigateur, ce qui a servi a calibrer les
niveaux.

**L'IA ne triche pas.** Meme ligne de lancer, meme ouverture maximale, meme deviation
aleatoire que le joueur (&plusmn;2,5&deg;, voir plus bas). Elle enumere les couples
(position de lancer, cible), balaie son cone d'incertitude, et garde le tir qui renverse
quelque chose le plus souvent.

**Elle ne se suicide pas sur le roi.** Un tir dont ne serait-ce qu'une direction du cone
atteint le roi est rejete tant que le roi n'est pas une cible legale : perdre le roi coute
la partie, gacher un tour ne coute qu'un tour. Verifie sur des centaines de tours d'IA en
conditions reelles (rebonds de bande compris), a chaque etape du calibrage : zero roi
renverse trop tot.

### Ce que le calibrage a appris

Les valeurs des trois niveaux sortent d'un balayage parametre par parametre sur des
milliers de matchs simules, pas d'une intuition — et le balayage a change deux fois
l'equilibrage du jeu, pas seulement celui de l'IA.

**Premier balayage** (deviation du jeu a &plusmn;5&deg;, la valeur du MVP initial) : deux
leviers de difficulte sur quatre ne servaient a rien.

| Levier                          | Effet mesure                                            |
| ------------------------------- | ------------------------------------------------------- |
| Erreur de visee, de 0 a 5&deg;  | **aucun** &mdash; la deviation du jeu domine tout        |
| Erreur de visee, au-dela de 6&deg; | net                                                  |
| Erreur de dosage, jusqu'a 0.15  | **aucun**                                               |
| Erreur de dosage, au-dela de 0.3 | net (le baton arrive trop mou et rebondit)             |
| Jouer au hasard plutot qu'au mieux | **aucun**, meme a 80% de coups au hasard             |
| Ignorer son cone d'incertitude  | **negligeable**                                         |

Les deux derniers reglages ont ete **retires** plutot que gardes pour la forme. Mais le
vrai constat allait plus loin que l'IA : a la distance du terrain, une deviation de
&plusmn;5&deg; represente &plusmn;72 px de derive laterale, pour des kubbs de 36 px
espaces de 120 px. **La precision n'etait pas la variable qui decidait d'un lancer** — ni
pour l'IA, ni pour le joueur.

**Deuxieme etape : `MAX_AIM_DEVIATION_DEG` baisse de 5 a 2,5&deg;.** Consequence
immediate sur l'IA — son propre niveau "Difficile" (calibre a 0,8&deg; d'erreur de visee
propre pour battre "Moyen" sous l'ancienne deviation) devenait quasi imbattable : 97,8%
de reussite en solo, 4,98 kubbs sur 5. Reduire la deviation du jeu rend logiquement une
IA tres precise bien plus dangereuse. Reponse : un second balayage a recale le seul
niveau concerne (`aimErrorDeg` de "Difficile" remonte a 3,5&deg;) pour revenir a un
adversaire fort mais pas un mur, en gardant "Facile" et "Moyen" inchanges &mdash; leur
propre imprecision (7&deg; et 12&deg;) domine largement la deviation du jeu quelle que
soit sa valeur, donc rien a recalibrer pour eux.

| Niveau      | Kubbs abattus en 12 lancers | Reussite en solo&sup1; |
| ----------- | ---------------------------- | ----------------------- |
| Facile      | 2,6                          | 1%                       |
| Moyen       | 3,2                          | 9%                       |
| Difficile   | 4,6                          | 66%                      |

&sup1; Proportion des matchs simules ou l'IA seule (sans defense adverse) abat les 5
kubbs puis le roi dans les regles, en 12 lancers. C'est une mesure de son adresse brute,
pas une prediction du taux de victoire reel contre un joueur — utile pour comparer les
niveaux entre eux, pas pour deviner qui va gagner une vraie partie.

---
