# KUBB: Kings — MVP

Jeu mobile HTML5 inspire du [Kubb](https://fr.wikipedia.org/wiki/Kubb), le jeu de plein air
suedois : deux equipes se lancent des batons pour abattre les blocs adverses, puis le roi.

Ce depot contient le **MVP** : un **1v1 local** (pass-and-play sur le meme telephone),
une seule map, une partie de 4 minutes maximum.

---

## Lancer le jeu en local

```bash
cd kubb-kings
npm install
npm run dev
```

Puis ouvrir **http://localhost:5174/**.

Le jeu est concu pour un **viewport mobile portrait** (teste en 375x667). Dans Chrome :
`F12` &rarr; icone "Toggle device toolbar" (`Ctrl+Shift+M`) &rarr; iPhone SE.

Le serveur ecoute aussi sur le reseau local (`host: true`) : l&apos;adresse `Network:`
affichee par Vite permet de tester directement depuis un vrai telephone.

Autres commandes :

| Commande            | Effet                                        |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Serveur de dev avec hot reload                |
| `npm run build`     | Verification TypeScript + build de production |
| `npm run preview`   | Sert le build de production                   |
| `npm run typecheck` | Verification TypeScript seule                 |

---

## Stack

| Brique         | Role                                                          |
| -------------- | ------------------------------------------------------------- |
| **Phaser 3**   | Rendu, boucle de jeu, entrees tactiles                        |
| **Matter.js**  | Physique (via Phaser), sans gravite : vue de dessus           |
| **TypeScript** | `strict: true`                                                 |
| **Vite**       | Bundler / dev server                                           |
| **React 18**   | Ecrans hors-jeu uniquement (menu, regles, HUD, resultat)      |
| **Zustand**    | Etat global partage entre Phaser et React                     |

Aucun asset externe : toutes les textures sont generees par code dans `BootScene`.

---

## Structure

```
kubb-kings/
├── src/
│   ├── game/
│   │   ├── scenes/     BootScene, MenuScene, MatchScene, ResultScene
│   │   ├── entities/   Baton, Kubb, King, Team
│   │   ├── physics/    matterConfig.ts (gravite, restitution, frottements)
│   │   ├── config.ts   config Phaser
│   │   ├── rules.ts    constantes de regles et geometrie du terrain
│   │   └── GameBridge.ts
│   ├── ui/             composants React (App, Menu, Rules, HUD, ResultScreen…)
│   ├── store/          Zustand
│   ├── main.tsx
│   └── index.css
├── public/
├── index.html
├── vite.config.ts
└── package.json
```

### Circulation de l'etat

```
React  --(bridge: start-match, restart-match, leave-match)-->  Scenes Phaser
React  <--(store Zustand : ecran, HUD, resultat)------------   Scenes Phaser
```

- `GameBridge` est un simple `EventEmitter` : React demande, Phaser decide.
- Les scenes ecrivent dans le store via `gameStore.getState()`, jamais l&apos;inverse.
- `MenuScene` et `ResultScene` sont volontairement **vides** : elles ne font que publier
  l&apos;ecran courant et attendre un evenement. Tout le visuel hors-jeu est en React.

---

## Regles implementees

- Chaque equipe aligne **5 kubbs** sur sa ligne de fond.
- **Un seul roi**, au centre du terrain, partage par les deux equipes (regle classique du Kubb).
- Les equipes lancent a tour de role, un baton par tour.
- **Placement** : le point de contact choisit la position de lancer le long de la ligne de lancer.
- **Visee** : le glissement donne l&apos;angle (bride a &plusmn;75&deg; vers l&apos;avant).
- **Puissance** : la longueur du glissement, affichee par une jauge verte &rarr; rouge.
- **Effet leger** : chaque lancer part avec une deviation aleatoire de **&plusmn;5&deg;**.
- Un kubb ne tombe que si la **vitesse d&apos;impact** depasse le seuil : un baton en fin de
  course rebondit sans rien renverser.
- Un kubb tombe est **hors jeu** et reste couche au sol.
- Le roi ne peut etre vise legalement que lorsque **tous les kubbs adverses sont tombes** :
  le HUD affiche alors un bandeau.
- Toucher le roi **trop tot** = **defaite immediate** de l&apos;equipe qui a lance.
- Faire tomber le roi dans les regles = **victoire**.
- Duree limitee a **4 minutes** et **12 lancers par equipe**. Au buzzer, l&apos;equipe qui a
  abattu le plus de kubbs adverses gagne ; a egalite, match nul.

### Choix d'interpretation

- **Un seul roi, au centre.** L&apos;enonce parle de « 1 roi au centre du terrain » : c&apos;est
  la regle reelle du Kubb, et deux rois ne peuvent pas tenir le meme centre. Le roi est donc
  unique et partage. Consequence de design : il est sur la trajectoire des tirs vers le kubb
  central, d&apos;ou la possibilite de **choisir sa position de lancer** pour le contourner.
- **Feu ami neutralise.** Un baton ne peut pas abattre les kubbs de sa propre equipe (cas
  possible sur un rebond de bande). Cela evite une elimination absurde due au hasard.
- **Fin de tour automatique** quand le baton est a l&apos;arret (ou apres 4 s de vol).

Tout l&apos;equilibrage est regroupe dans [`src/game/rules.ts`](src/game/rules.ts) :
seuil d&apos;impact, deviation, vitesse maximale, duree, nombre de lancers, geometrie du terrain.

---

## Hors perimetre de ce MVP

Volontairement non developpes, mais le decoupage `scenes / entities / physics / store`
est prevu pour les accueillir :

- mode 2v2
- multijoueur en ligne, classement mondial
- meteo, obstacles, terrains multiples
- mecanique roguelite (deblocages apres victoire)
- skins de blocs, boutique
- tournois
- portage natif iOS / Android (Capacitor)
