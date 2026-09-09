# KUBB: Kings — MVP

Jeu mobile HTML5 inspire du [Kubb](https://fr.wikipedia.org/wiki/Kubb), le jeu de plein air
suedois : deux equipes se lancent des batons pour abattre les blocs adverses, puis le roi.

Cinq modes : **solo contre l'IA** (trois niveaux), **1v1 local**, **2v2 local**
(pass-and-play sur le meme telephone), **Defi** (un roguelite en 5 manches contre l'IA)
et **Tournoi local** (elimination directe a 4 ou 8, toujours en pass-and-play). Plusieurs
terrains, un vent optionnel, trois skins de blocs, une partie de 4 minutes maximum.

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
| `npm run icons`     | Regenere les icones PWA (`public/*.png`)      |

> `npm run preview` sert le build sous `/kubb-kings/`, comme GitHub Pages :
> l&apos;URL locale est donc **http://localhost:4173/kubb-kings/**.

---

## Jouer depuis un telephone

Le jeu est deploye sur **GitHub Pages** a chaque push sur `main`, par
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) :

**https://thoomaslef.github.io/kubb-kings/**

> **A faire une seule fois** dans le depot : *Settings &rarr; Pages &rarr;
> Build and deployment &rarr; Source* : **GitHub Actions**. Sans ce reglage le
> workflow s&apos;execute mais la publication echoue.

### Installable et hors ligne

- **Manifest** ([`public/manifest.webmanifest`](public/manifest.webmanifest)) :
  « Ajouter a l&apos;ecran d&apos;accueil » installe le jeu en **plein ecran**,
  portrait, sans barre d&apos;adresse.
- **Service worker** ([`public/sw.js`](public/sw.js)) : une fois la page ouverte
  une premiere fois, le jeu se relance **sans reseau**.
  - `index.html` : reseau d&apos;abord, cache en secours &rarr; un nouveau
    deploiement est pris en compte des la premiere ouverture en ligne.
  - Assets : cache d&apos;abord &rarr; leurs noms sont hashes par Vite, donc
    immuables. Le worker les decouvre en lisant le HTML, ce qui evite une etape
    de build supplementaire.
- **Icones** : generees par [`scripts/make-icons.mjs`](scripts/make-icons.mjs),
  un rasteriseur PNG sans aucune dependance. Les PNG sont commites (un manifest
  ne peut pas pointer vers du code) mais restent reproductibles.

Le `base` de Vite est `/kubb-kings/` au build et en preview, `/` en dev.

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

Aucun asset externe : toutes les textures, **tous les sons** et **jusqu&apos;aux icones
de l&apos;application** sont generes par code (`BootScene` pour les textures, WebAudio
pour l&apos;audio, `scripts/make-icons.mjs` pour les icones).

---

## Structure

```
kubb-kings/
├── src/
│   ├── game/
│   │   ├── scenes/     BootScene, MenuScene, MatchScene, ResultScene
│   │   ├── entities/   Baton, Kubb, King, Obstacle, Team
│   │   ├── physics/    matterConfig.ts (gravite, restitution, frottements)
│   │   ├── config.ts   config Phaser
│   │   ├── rules.ts    regles, equilibrage, geometrie du terrain et hitboxes
│   │   ├── theme.ts    palette et constantes de rendu (pendant visuel de rules.ts)
│   │   ├── ai.ts       adversaire solo (module pur, simulable hors navigateur)
│   │   ├── juice.ts    feedback : particules, secousses, vibration, ralenti
│   │   ├── audio.ts    sons synthetises par code (WebAudio)
│   │   ├── tutorial.ts persistance du tutoriel (localStorage, cf. Tutorial.tsx)
│   │   ├── roguelite.ts mode Defi : echelle de manches, bonus, meilleure serie
│   │   ├── tournament.ts tournoi local : arbre a elimination directe (module pur)
│   │   ├── diagnostics.ts journal d'erreurs local (localStorage, cf. About.tsx)
│   │   ├── bootGame.ts import dynamique de Phaser (cf. GameCanvas.tsx)
│   │   └── GameBridge.ts
│   ├── i18n/           dictionnaires fr/en, translate(), hook useT()
│   ├── ui/             composants React (App, Menu, Rules, HUD, Tutorial, ResultScreen…)
│   ├── store/          Zustand
│   ├── main.tsx
│   └── index.css
├── public/             manifest, service worker, icones generees
├── scripts/
│   └── make-icons.mjs  generateur d'icones PWA (rasteriseur PNG sans dependance)
├── .github/workflows/
│   └── deploy.yml      build + deploiement GitHub Pages
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
- Les equipes lancent a tour de role, un baton par tour. En 2v2, les deux joueurs
  d'une equipe alternent lequel des deux est au lancer a chaque fois que revient le
  tour de leur camp — l'alternance des tours elle-meme ne change pas.
- **Placement** : le point de contact choisit la position de lancer, uniquement parmi
  celles de ses propres kubbs **encore debout** (`THROW_POSITIONS` /
  `availableThrowPositions` dans [`src/game/rules.ts`](src/game/rules.ts)), pas une ligne
  continue. Un kubb tombe n&apos;est plus un poste de lancer valide ; si tous les kubbs
  d&apos;une equipe sont a terre, elle retombe sur les 5 positions completes plutot que de
  se retrouver sans aucun coup legal.
- **Visee** : le glissement donne l&apos;angle (bride a &plusmn;75&deg; vers l&apos;avant).
- **Puissance** : la longueur du glissement, affichee par une jauge verte &rarr; rouge.
- **Effet leger** : chaque lancer part avec une deviation aleatoire de **&plusmn;2,5&deg;**.
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
  central, d&apos;ou l&apos;interet de choisir, parmi ses 5 positions de lancer, celle qui le
  contourne le mieux.
- **Position de lancer restreinte aux 5 kubbs.** Une ligne continue rendait le jeu trop facile :
  on trouvait toujours un angle degage vers n&apos;importe quelle cible. Restreint aux 5 points
  a l&apos;aplomb de ses propres kubbs (comme au vrai Kubb), le choix de la cible et celui de
  la position s&apos;influencent vraiment l&apos;un l&apos;autre.
- **Un kubb tombe perd sa position de lancer.** Consequence directe de la regle
  precedente : puisqu&apos;on tire depuis l&apos;aplomb de ses propres kubbs, un kubb couche
  au sol n&apos;est plus un poste valide (`availableThrowPositions` dans
  [`src/game/rules.ts`](src/game/rules.ts), utilisee a la fois par le joueur — visee et
  points disponibles dans `MatchScene.drawAim` — et par l&apos;IA via `AiBoard.ownStanding`).
  Repli sur les 5 positions completes si tous les kubbs d&apos;une equipe sont a terre, pour
  qu&apos;elle garde toujours un coup legal a jouer. Verifie sans suicide ni position
  illegale sur 40 500 matchs simules (27 combinaisons terrain x vent x niveau, degradation
  forcee des kubbs propres) et 21 matchs en navigateur avec la physique Matter reelle.
- **Feu ami neutralise.** Un baton ne peut pas abattre les kubbs de sa propre equipe (cas
  possible sur un rebond de bande). Cela evite une elimination absurde due au hasard.
- **Ricochet + kubb adverse abattu = redresse un kubb tombe.** Si le baton touche une bande
  avant d&apos;abattre un kubb adverse, ca redresse le premier kubb tombe de son propre camp
  (toujours le plus a gauche). Recompense un tir indirect plus difficile a placer ; applique
  au joueur comme a l&apos;IA (meme code de collision). Verifie en navigateur (test direct de
  `Kubb.reviveUp`/`reviveLeftmostKubb`, puis 9 matchs avec tirs volontairement risques) :
  zero erreur, redresses effectivement observes en jeu reel.
- **Fin de tour automatique** quand le baton est a l&apos;arret (ou apres 4 s de vol).

---

## Tir d&apos;ouverture : qui commence ?

Avant que la partie ne debute vraiment, chaque equipe tire une fois vers le roi pour
determiner qui commence — comme au vrai Kubb : le camp qui s&apos;en approche le plus **sans
le toucher** a la priorite. Toucher le roi (meme un frolement) fait perdre ce tirage, sauf
si l&apos;adversaire le touche aussi, auquel cas on recommence entierement. Ces deux lancers
comptent dans le total de 12 par equipe (`MatchScene.beginOpeningThrow` / `resolveOpeningThrow`
/ `beginMatch`), le roi ne tombe jamais et la partie ne se termine pas pendant ce tirage.

- **IA dediee.** `decideApproachThrow` (dans [`src/game/ai.ts`](src/game/ai.ts)) balaie
  position x angle x puissance, simule la trajectoire COURBEE reelle (`simulateWindFlight`,
  pas une approximation en ligne droite) et retient le candidat le plus proche du roi dont
  le cone d&apos;incertitude entier (erreur du niveau + deviation du jeu + pire cas de
  puissance) reste hors de portee — `APPROACH_SAFETY_MARGIN` absorbe le residu de
  discretisation d&apos;un tel balayage.
- **Bug trouve et corrige avant tout affichage** : la premiere version du controle de
  securite ignorait que l&apos;imprecision de puissance (appliquee apres coup) permet a un
  tir plus fort d&apos;aller plus loin sur la meme trajectoire — un candidat juge sur pouvait
  donc, une fois execute, toucher reellement le roi. Corrige en verifiant le pire cas de
  puissance des la selection du candidat, pas seulement l&apos;angle.
- **Verifie** : 1620 tirs d&apos;ouverture simules hors-navigateur (27 combinaisons terrain x
  vent x niveau, 60 chacune) — zero contact avec le roi, et une nette progression par
  niveau (le plus proche en moyenne : ~110 px en Difficile, ~190 px en Moyen, ~215 px en
  Facile). Puis en navigateur : les 3 cas de decision (plus proche gagne, un seul touche,
  les deux touchent -> on recommence) verifies directement, un flux complet de bout en bout
  (lancers reels, decompte des lancers, transition vers la partie), et 6 matchs solo
  Difficile avec l&apos;IA reelle sur les 3 terrains — zero erreur partout.

---

## Terrains a obstacles

Trois presets, choisis au menu, dans [`src/game/rules.ts`](src/game/rules.ts)
(`FIELD_PRESETS`) : le terrain (`FIELD`, l&apos;espacement des kubbs, les hitboxes) ne
change jamais — seuls des rochers statiques s&apos;ajoutent, definis en decalage
(dx, dy) depuis le centre.

| Preset         | Rochers                                                          |
| -------------- | ------------------------------------------------------------------ |
| **Classique**  | Aucun (terrain d&apos;origine)                                      |
| **Chicane**    | Deux rochers en S, hors de l&apos;axe : recompense le repositionnement le long de la ligne de lancer |
| **Sentinelle** | Deux rochers sur l&apos;axe, de part et d&apos;autre du roi : un tir droit depuis le centre de la ligne les percute avant sa cible |

Un rocher ne tombe jamais et ne fait tomber personne : il fait rebondir le baton comme
une bande (`src/game/entities/Obstacle.ts`, corps Matter statique).

**L&apos;IA les voit.** `AiBoard.obstacles` (dans [`src/game/ai.ts`](src/game/ai.ts)) lui
passe leur position ; son cone d&apos;incertitude les traite comme un troisieme type
d&apos;obstacle (`kind: 'block'`, distinct de `'kubb'` et `'king'`) : un tir qui les
percute est simplement gache pour cet echantillon, jamais compte comme une faute contre
le roi. Verifie par simulation sur les 3 presets x 3 niveaux (9 combinaisons, 2000 matchs
chacune) : zero suicide sur le roi partout, et une IA qui contourne les rochers la plupart
du temps plutot que de leur foncer dedans.

---

## Skins de blocs

Trois habillages, choisis au menu, generes dans
[`src/game/scenes/BootScene.ts`](src/game/scenes/BootScene.ts) (`drawKubbStanding` /
`drawKubbFallen`) : une texture par (equipe x skin), toujours par code, sans asset externe.

| Skin        | Look                                                              |
| ----------- | ------------------------------------------------------------------ |
| **Bois**    | Look d&apos;origine : fil du bois, biseau au sol                    |
| **Marbre**  | Base claire veinee, cadre et veines teintes par la couleur d&apos;equipe |
| **Metal**   | Corps acier avec reflet, cadre et bande de couleur d&apos;equipe    |

Purement cosmetique : la hitbox (`HITBOX.kubb` dans `rules.ts`) et les corps Matter ne
changent jamais, et `ai.ts` n&apos;a aucune notion de skin — aucune verification par
simulation n&apos;est necessaire pour cette fonctionnalite. Stocke dans le store
(`kubbSkin` / `setKubbSkin`), thread depuis `MatchScene` jusqu&apos;a chaque
`Kubb` via `Team`.

---

## Meteo (vent)

Bouton au menu, off par defaut (`windEnabled` dans le store). Quand il est actif, une
brise traversiere constante (`WIND.accelPerStep` dans [`src/game/rules.ts`](src/game/rules.ts))
s&apos;ajoute a la vitesse du baton a chaque pas de vol, dans l&apos;axe X du terrain quel
que soit l&apos;angle vise — le sens (gauche/droite) est tire au hasard une seule fois par
partie (`MatchScene.create`), jamais par lancer, et affiche dans le HUD (&larr;/&rarr;).
Le joueur y est expose comme au vrai Kubb : un lancer mal juge peut deriver jusqu&apos;au
roi.

**L&apos;IA compense, mais reste prudente.** `ai.ts::windCompensatedAngle` simule le vol
complet (meme decroissance frictionAir, meme increment de vent, pas a pas, que le jeu
reel) a l&apos;angle naif, mesure la derive laterale a la distance visee et corrige
l&apos;angle en consequence — deux passes, le vent restant une perturbation modeste face
a la distance. Cette compensation est une approximation en ligne droite d&apos;une
trajectoire en realite courbee ; `WIND.kingDangerMargin` elargit le rayon de danger du
roi (uniquement quand le vent souffle et que l&apos;IA ne le vise pas legalement) pour
absorber l&apos;ecart residuel.

Verifie en deux temps, avant tout affichage a l&apos;ecran :

1. **Simulation hors-navigateur, verite terrain = trajectoire courbee reelle** (pas le
   modele en rayons droits de l&apos;IA) : 3000 matchs par niveau et par sens de vent
   (facile/moyen/difficile x sans-vent/+1/-1), en suivant pas a pas la vraie physique du
   baton. Zero suicide du roi dans les neuf combinaisons, et une IA aussi efficace avec
   le vent que sans (taux de victoire et kubbs abattus par lancer quasi identiques).
2. **Navigateur, vraie physique Matter** : parties completes en solo Difficile avec vent,
   zero roi touche trop tot par l&apos;IA, trajectoires visiblement deviees a
   l&apos;ecran.

---

## Tutoriel de premiere partie

L&apos;ecran des regles ([`src/ui/Rules.tsx`](src/ui/Rules.tsx)) est un mur de texte : personne
ne le lit avant de jouer. L&apos;onboarding reel se joue **pendant** la toute premiere partie
(solo ou 1v1 local, peu importe), en trois temps :

1. **Avant le premier lancer** ([`src/ui/Tutorial.tsx`](src/ui/Tutorial.tsx)) : une carte au bas
   de l&apos;ecran resume le geste (se placer, viser, lancer) et rappelle que le roi est interdit
   tant que l&apos;adversaire tient debout. Elle disparait au premier toucher, ou que ce soit sur
   l&apos;ecran &mdash; jamais en travers de la visee.
2. **Apres ce premier lancer** : un toast bref rappelle qu&apos;on ne lance qu&apos;une fois par
   tour et qu&apos;un kubb tombe reste hors jeu, puis s&apos;efface seul.
3. **La premiere fois que le roi devient visable** : le bandeau qui existe deja normalement
   (`HUD.tsx`) se fait plus explicite pour cette occurrence-la seulement, puis redevient son
   texte court habituel.

Chaque etape est gardee par un signal de jeu reel (`hud.phase`, `hud.canTargetKing`) plutot que
par un minuteur arbitraire : elle attend que la situation se produise vraiment. Un seul drapeau
`localStorage` ([`src/game/tutorial.ts`](src/game/tutorial.ts)) retient que la premiere partie a
eu lieu &mdash; termine ou quittee en cours de route, peu importe, elle ne rejoue jamais deux
fois. **"Revoir le tutoriel"**, dans l&apos;ecran des regles, remet ce drapeau a zero pour la
partie suivante.

---

## L'adversaire solo

[`src/game/ai.ts`](src/game/ai.ts) est un **module pur** : aucun import Phaser, aucun
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

## Mode Defi (roguelite)

[`src/game/roguelite.ts`](src/game/roguelite.ts), module pur comme `ai.ts` et
`tutorial.ts` : une echelle de 5 manches contre l'IA, chacune plus dure que la
precedente, avec un bonus au choix apres chaque victoire.

| Manche | Niveau IA | Terrain    |
| ------ | --------- | ---------- |
| 1      | Facile    | Classique  |
| 2      | Moyen     | Classique  |
| 3      | Moyen     | Chicane    |
| 4      | Difficile | Chicane    |
| 5      | Difficile | Sentinelle |

Seuls le niveau et le terrain changent d'une manche a l'autre : les regles et
l'equilibrage restent ceux, deja calibres, du mode solo. **Une defaite, un match nul ou
le timeout terminent la run immediatement** — c'est le ressort roguelite : pas de
sauvegarde en cours de route.

**Trois bonus**, chacun applicable au joueur uniquement (jamais a l'IA) :

| Bonus                | Effet                                                    |
| --------------------- | -------------------------------------------------------- |
| Bras infatigable      | +2 lancers sur toute la manche                            |
| Bras vif              | +15% de puissance au bout du glissement                   |
| Second souffle         | Le premier lancer qui ne renverse rien n'est pas compte  |

Un seul bonus est propose deux fois : `pickPerkChoices` tire deux options parmi ceux non
encore debloques. Une fois les trois acquis, l'ecran de choix n'a plus rien a offrir et
la manche suivante s'enchaine directement, sans faux choix a l'ecran.

La meilleure serie (nombre de manches franchies) est retenue en `localStorage`, affichee
au menu, et proposee de nouveau a la prochaine run — sur le meme modele que la
persistance du tutoriel.

---

## Tournoi local

Elimination directe a 4 ou 8 joueurs, pass-and-play sur le meme telephone —
[`src/game/tournament.ts`](src/game/tournament.ts), module pur (comme `roguelite.ts`)
qui construit et fait progresser l&apos;arbre, sans rien connaitre de la partie
elle-meme. Chaque match du tournoi est un 1v1 local ordinaire : aucune regle, aucun
equilibrage ne change, seul un ecran de tableau s&apos;intercale entre deux matchs.

- **Mise en place** ([`src/ui/TournamentSetup.tsx`](src/ui/TournamentSetup.tsx)) : taille
  (4 ou 8) et noms des participants (par defaut &laquo; Joueur N &raquo;).
- **Tableau** ([`src/ui/TournamentBracket.tsx`](src/ui/TournamentBracket.tsx)) : chaque
  tour affiche ses matchs, le vainqueur en surbrillance ; un bouton lance le prochain
  match dont les deux participants sont connus, jusqu&apos;au sacre du champion.
- **Pendant un match**, le HUD affiche les noms des participants a la place des couleurs
  d&apos;equipe (`tournamentPending` dans le store).
- **Match nul** : plutot que de departager au hasard, le meme match se rejoue — le seul
  cas ou `ResultScreen` ne fait pas progresser l&apos;arbre.

Purement une couche de navigation autour du 1v1 existant : aucun impact sur `ai.ts` ni
sur la physique, aucune verification par simulation necessaire.

---

## Ressenti et rendu

Le jeu et son habillage sont separes, et chacun a son fichier de reglage :

| Fichier                                    | Ce qu&apos;on y regle                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| [`src/game/rules.ts`](src/game/rules.ts)   | Seuil d&apos;impact, deviation, vitesse max, duree, lancers, terrain, hitboxes, vent |
| [`src/game/theme.ts`](src/game/theme.ts)   | Palette, ombres portees, cadre du terrain, skins de blocs                    |
| [`src/game/juice.ts`](src/game/juice.ts)   | Intensite des secousses, du ralenti, de la trainee, des vibrations           |

**Les hitboxes sont independantes des textures** (`HITBOX` dans `rules.ts`) : on peut
redessiner une piece sans deplacer une seule collision.

**Le feedback n&apos;a aucun effet sur les regles.** Toutes les methodes de `Juice`
peuvent etre retirees sans changer l&apos;issue d&apos;une partie :

- son de bois a l&apos;impact, souffle du lancer, ricochet sur les bandes, buzzer,
  fanfare de fin, bip de compte a rebours sous 10 s ;
- eclats de bois, poussiere et halo a chaque kubb abattu, echelonnes sur la force
  du choc ;
- trainee remanente derriere le baton en vol ;
- vibration haptique (silencieuse la ou `navigator.vibrate` n&apos;existe pas) ;
- chute du roi : ralenti du monde Matter, zoom camera, flash et gerbe doree ;
- halo pulsant autour du roi tant que l&apos;equipe active a le droit de le viser.

Le son se coupe depuis le HUD ; la preference est conservee d&apos;une partie a l&apos;autre.

---

## Solidite technique

- **Error boundary** ([`src/ui/ErrorBoundary.tsx`](src/ui/ErrorBoundary.tsx)) : une erreur de
  rendu React affichait auparavant un ecran blanc/noir figé, sans explication. Elle affiche
  desormais un message et un bouton pour recharger.
- **Journal d&apos;erreurs local** ([`src/game/diagnostics.ts`](src/game/diagnostics.ts)) :
  capture aussi les erreurs hors React (boucle Phaser, promesses rejetees), en localStorage.
  Le jeu est un site statique sans serveur pour recevoir des rapports a distance — ce journal
  est donc consultable et copiable depuis l&apos;ecran **A propos**, pour un signalement
  manuel plutot qu&apos;un SDK tiers.
- **Chargement en deux temps** ([`src/ui/GameCanvas.tsx`](src/ui/GameCanvas.tsx)) : Phaser et
  le code du jeu (le plus gros du bundle) sont importes dynamiquement, dans un chunk separe
  du shell React — celui-ci peut donc s&apos;afficher (ecran de chargement) avant que le
  moteur de jeu ne soit telecharge.

---

## Localisation (i18n)

Francais et anglais, choix persiste (`localStorage`), detecte a la premiere visite depuis la
langue du navigateur ([`src/i18n/`](src/i18n)) :

- `dictionaries.ts` : toutes les chaines affichees au joueur, cles a plat namespacees par
  ecran (`menu.*`, `hud.*`&hellip;) ou par donnee (`difficulty.*`, `terrain.*`, `skin.*`,
  `team.*`, `perk.*` — anciens libelles deplaces ici depuis `ai.ts` / `rules.ts` /
  `theme.ts` / `teamData.ts` / `roguelite.ts`, qui ne gardent que les donnees
  fonctionnelles).
- `translate(lang, key, params?)` : fonction pure, utilisable aussi bien dans un composant
  React que dans `MatchScene.ts` (bandeaux de tour et textes flottants, dessines directement
  sur le canevas Phaser, hors de tout rendu React).
- `useT()` : le hook React equivalent, reactif a un changement de langue.

Les pages legales ([`public/legal/`](public/legal), [`src/ui/Legal.tsx`](src/ui/Legal.tsx))
restent volontairement en francais uniquement : droit francais applicable, identite reelle
de l&apos;editeur — pas un choix a faire dependre de la langue d&apos;affichage du jeu.

---

## SEO et partage

[`index.html`](index.html) n&apos;avait qu&apos;un `<title>` : un lien partage sur les
reseaux n&apos;affichait ni image ni description. Ajoutes : description, balises Open
Graph et Twitter Card (URL absolues vers le domaine de production, comme l&apos;exige Open
Graph — Vite ne les reecrit pas comme il le fait pour le manifest/favicon), URL
canonique. [`public/robots.txt`](public/robots.txt) et
[`public/sitemap.xml`](public/sitemap.xml) excluent `/legal/` (deja `noindex`
individuellement) du referencement.

---

## Informations legales

Politique de confidentialite, CGU et mentions legales, en double forme :

- **Pages statiques publiques** ([`public/legal/`](public/legal)), sans JS ni dependance au
  bundle de l&apos;application — c&apos;est l&apos;URL a renseigner dans App Store Connect
  (obligatoire) et la Play Console (section &laquo; Securite des donnees &raquo;), meme si le
  jeu ne collecte rien.
- **Ecran in-app** ([`src/ui/Legal.tsx`](src/ui/Legal.tsx)), accessible depuis un lien discret
  en bas du menu, pour la meme lisibilite depuis l&apos;application elle-meme.

Le contenu reflete l&apos;etat reel du jeu : aucun serveur, aucun compte, aucun outil
d&apos;analyse, aucune donnee personnelle collectee — tout ce qui est conserve
(preferences, meilleure serie) reste en stockage local sur l&apos;appareil.

Identite editeur renseignee : Tommy Studio (Thomas Lefevre), entrepreneur individuel, Caen. A
tenir a jour si elle change (statut, adresse, contact) — repetee dans les deux formes, a
modifier aux deux endroits pour rester coherente.

URL a coller dans App Store Connect / Play Console :
`https://thoomaslef.github.io/kubb-kings/legal/politique-de-confidentialite.html`

---

## Hors perimetre de ce MVP

Volontairement non developpes, mais le decoupage `scenes / entities / physics / store`
est prevu pour les accueillir :

- multijoueur en ligne, classement mondial
- portage natif iOS / Android (Capacitor)
