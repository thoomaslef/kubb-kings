# KUBB: Kings — MVP

Jeu mobile HTML5 inspire du [Kubb](https://fr.wikipedia.org/wiki/Kubb), le jeu de plein air
suedois : deux equipes se lancent des batons pour abattre les blocs adverses, puis le roi.

Deux modes : **solo contre l'IA** (trois niveaux) et **1v1 local** (pass-and-play sur le
meme telephone). Une seule map, une partie de 4 minutes maximum.

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
│   │   ├── entities/   Baton, Kubb, King, Team
│   │   ├── physics/    matterConfig.ts (gravite, restitution, frottements)
│   │   ├── config.ts   config Phaser
│   │   ├── rules.ts    regles, equilibrage, geometrie du terrain et hitboxes
│   │   ├── theme.ts    palette et constantes de rendu (pendant visuel de rules.ts)
│   │   ├── ai.ts       adversaire solo (module pur, simulable hors navigateur)
│   │   ├── juice.ts    feedback : particules, secousses, vibration, ralenti
│   │   ├── audio.ts    sons synthetises par code (WebAudio)
│   │   ├── tutorial.ts persistance du tutoriel (localStorage, cf. Tutorial.tsx)
│   │   └── GameBridge.ts
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
- Les equipes lancent a tour de role, un baton par tour.
- **Placement** : le point de contact choisit la position de lancer le long de la ligne de lancer.
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
  central, d&apos;ou la possibilite de **choisir sa position de lancer** pour le contourner.
- **Feu ami neutralise.** Un baton ne peut pas abattre les kubbs de sa propre equipe (cas
  possible sur un rebond de bande). Cela evite une elimination absurde due au hasard.
- **Fin de tour automatique** quand le baton est a l&apos;arret (ou apres 4 s de vol).

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

## Ressenti et rendu

Le jeu et son habillage sont separes, et chacun a son fichier de reglage :

| Fichier                                    | Ce qu&apos;on y regle                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| [`src/game/rules.ts`](src/game/rules.ts)   | Seuil d&apos;impact, deviation, vitesse max, duree, lancers, terrain, hitboxes |
| [`src/game/theme.ts`](src/game/theme.ts)   | Palette, ombres portees, cadre du terrain                                    |
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
