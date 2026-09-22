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
- **Kubbs de champ** (bouton au menu, off par defaut) : un kubb de ligne abattu peut etre
  replante dans le camp de son lanceur plutot que retire du jeu — voir section dediee
  plus bas.

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

Onze presets, choisis au menu, dans [`src/game/rules.ts`](src/game/rules.ts)
(`FIELD_PRESETS`) : le terrain (`FIELD`, l&apos;espacement des kubbs, les hitboxes) ne
change jamais — seuls des rochers statiques s&apos;ajoutent, definis en decalage
(dx, dy) depuis le centre (sauf "Colline", "Glace", "Sable", "Boue" et "Riviere",
differentes — voir plus bas ; "Nuit" n&apos;en ajoute aucun).

| Preset         | Effet                                                          | Niveau requis |
| -------------- | ------------------------------------------------------------------ | :-----------: |
| **Classique**  | Aucun (terrain d&apos;origine)                                      | 1 (des le debut) |
| **Chicane**    | Deux rochers en S, hors de l&apos;axe : recompense le repositionnement le long de la ligne de lancer | 2 |
| **Sentinelle** | Deux rochers sur l&apos;axe, de part et d&apos;autre du roi : un tir droit depuis le centre de la ligne les percute avant sa cible | 6 |
| **Colline**    | Un monticule au centre (zone de friction accrue, pas un rocher) : le traverser use plus de vitesse, il faut y mettre plus de puissance pour ressortir avec assez de force — cf. plus bas | 9 |
| **Glace**      | Terrain entier a friction reduite et rebonds plus francs : le baton glisse plus loin et rebondit plus fort sur les bandes — cf. plus bas | 13 |
| **Sable**      | Terrain entier a friction accrue et rebonds plus mous, la boule y patine bien plus que le baton, plus 4 cactus symetriques — cf. plus bas | 15 |
| **Nuit**       | Aucun (identique a Classique) : juste l&apos;ambiance, palette sombre et lune — cf. plus bas | 26 |
| **Ruines**     | Trois rochers en triangle ASYMETRIQUE (ni sur l&apos;axe, ni symetrique) : les deux lignes de lancer ne se valent pas — cf. plus bas | 28 |
| **Verger**     | Quatre rochers en carre resserre pres du centre (~92px, contre ~155px pour Sable) : le passage central se joue de bien plus pres — cf. plus bas | 30 |
| **Boue**       | Terrain entier a friction encore plus accrue que Sable et rebonds encore plus mous, sans obstacle ni penalite specifique a un projectile — cf. plus bas | 31 |
| **Riviere**    | Une bande horizontale qui REDUIT la friction (pas un rocher, pas une zone qui ralentit) : le baton en ressort plus vite qu&apos;un trajet normal — cf. plus bas | 33 |

Seul "Classique" reste disponible d&apos;office : les 10 autres sont desormais des
articles de boutique (`src/game/shop.ts`, categorie `'terrain'`) — niveau ET pieces
necessaires pour les acheter, cf. section "Boutique" plus bas.

Un rocher ne tombe jamais et ne fait tomber personne : il fait rebondir le baton comme
une bande (`src/game/entities/Obstacle.ts`, corps Matter statique).

**L&apos;IA les voit.** `AiBoard.obstacles` (dans [`src/game/ai.ts`](src/game/ai.ts)) lui
passe leur position ; son cone d&apos;incertitude les traite comme un troisieme type
d&apos;obstacle (`kind: 'block'`, distinct de `'kubb'` et `'king'`) : un tir qui les
percute est simplement gache pour cet echantillon, jamais compte comme une faute contre
le roi. Verifie par simulation sur les 3 premiers presets x 3 niveaux (9 combinaisons,
2000 matchs chacune) : zero suicide sur le roi partout, et une IA qui contourne les
rochers la plupart du temps plutot que de leur foncer dedans.

**Colline** est un mecanisme different : pas un rocher qui rebondit, une zone circulaire
(`HILL_RADIUS` = 130px autour du centre, comme le roi) de friction Matter accrue
(`HILL_EXTRA_FRICTION`, en plus de `BATON_BODY.frictionAir`) — le baton ne devie ni ne
rebondit, il ressort simplement plus lent qu&apos;il n&apos;y est entre. Traverser tout
son diametre coute environ 10% de jauge de puissance en plus pour arriver avec la meme
force. Cote IA (`ai.ts`), la compensation est exacte des que possible : `simulateWindFlight`
(donc `curvedKingDanger` et `decideApproachThrow`, deja bases sur une simulation complete
pas a pas) integre directement la friction accrue selon la position reelle du baton a
chaque pas ; `decideThrow`, qui evite cette simulation complete pour des raisons de
performance, calcule la longueur du trajet qui traverse le disque (geometrie exacte d&apos;une
corde de cercle) et l&apos;ajoute au terme de friction normal de `powerForDistance`/`speedAfter`
— la meme identite algebrique (v(d) = v0 - k*d) s&apos;applique par morceau, un coefficient
different sur la portion a l&apos;interieur. Verifie par simulation (17 etats de vent x 3
niveaux, 51 combinaisons, 2160 matchs, verite terrain = trajectoire courbee reelle avec
la meme friction que le jeu) : zero suicide, une IA toujours capable d&apos;abattre des
kubbs a travers la colline (5,50 kubbs/match en moyenne contre 6,44 sans, une baisse
sensible mais pas paralysante) et une puissance calculee qui augmente bien avec la
traversee (verifie directement : 0,510 sans colline contre 0,614 en traversant tout le
diametre, a distance egale). Puis en navigateur reel (vraie physique Matter) : un tir a
puissance egale ressort mesurablement plus lent en traversant la colline qu&apos;a cote
(11,27 contre 12,20 apres la meme distance parcourue), et 8 parties completes en
Solo/Difficile — zero suicide, IA toujours gagnante.

**Glace** et **Sable** sont plus simples que Colline : pas une zone localisee, un effet
uniforme sur TOUT le terrain — un simple multiplicateur scalaire sur
`BATON_BODY.frictionAir` (`frictionMultiplier` : x0,5 sur Glace, x1,6 sur Sable pour le
baton) et sur `BATON_BODY.restitution` (`restitutionMultiplier` : x1,7 sur Glace pour des
rebonds plus francs sur les bandes, x0,35 sur Sable pour des rebonds mous), applique des
le lancer (`Baton.ts`) et a chaque frame de vol (`MatchScene::applyTerrainFriction`).
Sable penalise en plus la boule specifiquement (`frictionMultiplierBall` : x2,8, contre
x1,6 pour le baton) — le meme mecanisme qui differencie deja les deux formes de baton
(voir plus bas) sert ici a rendre la boule nettement moins efficace dans le sable, sans
toucher a l&apos;IA (qui ne joue jamais la boule). Cote IA, `simulateWindFlight`,
`powerForDistance` et `speedAfter` prennent toutes un `frictionMultiplier` qui remplace
uniformement le coefficient de friction sur toute la trajectoire — plus simple que la
geometrie de corde de Colline puisqu&apos;aucun segment/zone n&apos;entre en jeu.

Cette fonctionnalite a fait remonter un vrai bug de securite via la simulation
obligatoire avant mise en ligne : sous vent fort et en difficulte Facile, `decideThrow`
pouvait choisir un lancer que `curvedKingDanger` jugeait sur — mais le controle ne
testait QUE le cas ou l&apos;imprecision du niveau (`applyImprecision`, appliquee APRES
ce controle) rendait le lancer plus fort que prevu. Sur un terrain a friction reduite,
un lancer plus FAIBLE que prevu reste plus longtemps expose au vent avant de croiser le
roi, ce qui peut au contraire le rapprocher davantage — un cas jamais teste jusque-la
(la friction normale masquait l&apos;effet). Corrige en testant les deux bornes de
puissance (`power*(1-powerErrorRatio)` et `power*(1+powerErrorRatio)`), dans
`curvedKingDanger` et dans le controle equivalent de `decideApproachThrow`. Reverifie
ensuite par simulation (17 etats de vent x 3 niveaux x 2 terrains, 102 combinaisons,
300 matchs chacune, 30&nbsp;600 matchs) : zero suicide. Puis en navigateur reel (vraie
physique Matter) : glace et sable listes au menu, un tir a puissance egale ressort plus
rapide sur glace qu&apos;en classique (12,15 contre 9,82 apres la meme distance), la
boule patine plus que le baton dans le sable (11,17 contre 15,22), et le ratio de vitesse
mesure juste avant/apres un rebond sur une bande confirme des rebonds plus francs sur
glace (0,985) et plus mous sur sable (0,953) qu&apos;en classique (0,970) — et 6 parties
completes en Solo (Facile/Moyen/Difficile x Glace/Sable) sans erreur console.

**Sable** a ensuite recu 4 cactus (`Obstacle.ts`, meme corps Matter que les rochers des
autres presets — juste une autre texture, `BootScene::buildCactusTexture`), symetriques
sur les DEUX axes a la fois (memes decalages que "Chicane", dupliques dans les 4
cadrans — contrairement a Chicane ou Sentinelle, aucune ligne de lancer n&apos;y est
structurellement privilegiee). Premier preset a cumuler deux mecanismes deja verifies
independamment (obstacles + friction/rebond sur tout le terrain), d&apos;ou une
verification IA dediee plutot que de supposer que la composition des deux reste sure —
verification qui a trouve un second vrai bug de securite, distinct de celui de Glace :
`decideThrow`, sans vent, ne testait le risque roi qu&apos;au moyen du meme controle en
ligne droite (`firstObstacle`) que celui utilise pour les kubbs et les rochers/cactus —
qui ne renvoie que le PREMIER obstacle croise sur le rayon. Un cactus se trouvant juste
avant le roi sur un rayon legerement devie masquait donc totalement le roi a ce
controle, alors qu&apos;un baton qui heurte un cactus rebondit — il ne s&apos;arrete pas
net, et peut tres bien continuer vers le roi ensuite. Corrige en unifiant les deux cas
(avec ou sans vent) sur `curvedKingDanger`, qui simule la VRAIE trajectoire
independamment de tout rocher/cactus/kubb sur le chemin (rien ne peut donc plus la
masquer) — un changement qui touche tous les terrains, pas seulement Sable, d&apos;ou une
reverification complete : 9180 matchs sur les 6 terrains (17 vents x 3 niveaux, N=30)
puis 15&nbsp;300 matchs supplementaires cibles sur les 3 terrains a obstacles
(Chicane/Sentinelle/Sable, N=100) — zero suicide partout, 24&nbsp;480 matchs au total.
Puis en navigateur reel (vraie physique Matter) : exactement 4 cactus generes, un dans
chaque cadran a egale distance du centre (symetrie confirmee par calcul), un baton vise
droit sur un cactus rebondit reellement dessus (inversion de vitesse mesuree), 6 parties
completes sur Sable (Facile/Moyen/Difficile x vent on/off) et 5 parties sur les autres
terrains (Difficile, vent) — toutes sans erreur console.

**Nuit** est purement decorative : `FIELD_PRESETS.nuit` reprend EXACTEMENT les memes
valeurs que "Classique" (`obstacles: []`, `frictionMultiplier`/`restitutionMultiplier`
a 1) — seuls `groundTexture: 'night'` (tuile d&apos;herbe sombre,
`BootScene::buildNightGrassTexture`) et `nightSky: true` (lune et son halo,
`MatchScene::drawMoon`, meme principe decoratif que `drawHill` pour "Colline")
different. `AiBoard` ne recevant jamais l&apos;un ou l&apos;autre, aucune verification IA
n&apos;etait necessaire — uniquement une verification en navigateur (lune visible dans
le coin superieur droit, terrain fonctionnellement identique a Classique, zero erreur).

**Ruines** et **Verger** ajoutent des rochers a des positions nouvelles : Ruines en
triangle asymetrique (aucun des trois cotes du terrain n&apos;etant equivalent aux
autres, contrairement a Chicane ou Sentinelle), Verger en carre resserre autour du roi
(~92px du centre, entre les 70px de Sentinelle et les ~155px de Sable — donc dans une
plage de distances deja eprouvee, pas un nouvel extreme). `AiBoard.obstacles` change
donc pour ces deux presets : reverification complete plutot que de supposer sur, meme
si `curvedKingDanger` (la garde-fou principale contre un suicide) ignore deja
volontairement tout rocher par construction — cf. plus haut. 1224 tirs decides
(2 presets x 3 niveaux x 17 etats de vent x 6 configurations de kubbs adverses encore
debout x kingTargetable vrai/faux), chacun rejoue 20 fois avec le vrai tirage aleatoire
du lancer — 24&nbsp;480 trajectoires reelles verifiees. Zero suicide, zero tir invalide.
Puis en navigateur reel (vraie physique Matter) : positions de rochers exactement
celles attendues pour les deux presets (3 en triangle pour Ruines, 4 en carre pour
Verger, verifie par calcul et par capture d&apos;ecran), lancer reel sur chacun des 3
nouveaux terrains — zero erreur console.

**Boue** reprend exactement le mecanisme de Glace/Sable (`frictionMultiplier`/
`restitutionMultiplier` scalaires sur tout le terrain, aucune nouvelle geometrie) avec
des valeurs plus extremes (friction x2,2 contre x1,6 pour Sable, restitution x0,25
contre x0,35) et volontairement AUCUNE variante par forme de projectile
(`frictionMultiplierBall`/`frictionMultiplierDisque` absentes) : un pur terrain
"lourd", uniforme, sans le choix tactique boule-vs-baton de Sable ni obstacle. Meme
sweep standard (tous niveaux x tous etats de vent x 6 configurations de kubbs adverses
x kingTargetable vrai/faux, 612 tirs decides, 12&nbsp;240 trajectoires reelles) : zero
suicide, zero tir invalide. Puis en navigateur reel : achat boutique, terrain visible
au selecteur, lancer reel sans erreur console.

**Riviere** generalise le mecanisme de "Colline" a une geometrie differente — une
bande horizontale (`RIVER_HALF_WIDTH` = 70px de chaque cote de `FIELD_CENTER_Y`, sur
toute la largeur du terrain) plutot qu&apos;un disque centre — et surtout a un effet
inverse : au lieu d&apos;AJOUTER de la friction (Colline ralentit), elle la MULTIPLIE
par `RIVER_FRICTION_MULTIPLIER` (0,15) tant que le baton s&apos;y trouve — il en
ressort avec beaucoup moins de vitesse perdue qu&apos;un trajet normal. Volontairement
MULTIPLICATIF et jamais negatif (jamais un vrai gain d&apos;energie, juste beaucoup
moins de perte) : traverser la bande plusieurs fois (rebond sur une bande) ne peut
jamais faire "accelerer indefiniment" le baton, contrairement a ce qu&apos;un ajout de
friction negative aurait permis — ce choix ecarte structurellement tout risque
d&apos;emballement de vitesse.

Cote implementation, `ai.ts::hillCrossingOnRay`/`hillCrossingToTarget` (intersection
d&apos;un rayon avec un CERCLE, geometrie quadratique) ont recu un pendant
`riverCrossingOnRay`/`riverCrossingToTarget` plutot que d&apos;etre generalisees en
place : geometrie de BANDE (intersection lineaire, plus simple), fonctions separees
pour ne jamais risquer de regression sur "Colline", deja verifiee independamment.
`simulateWindFlight` (donc `curvedKingDanger`, `windCompensatedAngle` et
`decideApproachThrow`, tous bases dessus) applique le multiplicateur pas a pas des que
le baton est dans la bande ; `decideThrow`, qui evite cette simulation complete pour
des raisons de performance, calcule la longueur du trajet qui la traverse (geometrie
exacte, comme pour Colline) et l&apos;utilise pour definir une "distance effective"
(`distance - riverCrossing*(1-RIVER_FRICTION_MULTIPLIER)`) dans `powerForDistance`/
`speedAfter` — mathematiquement equivalente a integrer un coefficient de friction
different par morceau du trajet.

Ce changement touche des fonctions partagees par TOUS les terrains (`simulateWindFlight`,
`powerForDistance`, `speedAfter`, `curvedKingDanger`, `windCompensatedAngle` ont chacune
recu un nouveau parametre `hasRiver`/`riverCrossing`, toujours par defaut sans effet) :
verification en deux temps plutot que de supposer que les valeurs par defaut suffisent —
(1) reverification COMPLETE des 10 presets existants (3978 tirs decides, 79&nbsp;560
trajectoires reelles au total avec le sweep dedie Riviere ci-dessous inclus) : zero
suicide, zero tir invalide, confirmant l&apos;absence de regression ; (2) sweep dedie
sur Riviere seule (tous niveaux x tous etats de vent x 6 configurations de kubbs
adverses x kingTargetable vrai/faux). Puis en navigateur reel (vraie physique Matter) :
achat boutique, terrain visible au selecteur, bande d&apos;eau rendue exactement a la
largeur de la zone reelle, et surtout la mesure qui compte — un tir a puissance egale
ressort mesurablement plus vite apres avoir traverse la riviere qu&apos;en terrain
classique, a distance parcourue egale (10,84 contre 9,29) — zero erreur console.

---

## Skins de blocs

Trois habillages, choisis au menu, generes dans
[`src/game/scenes/BootScene.ts`](src/game/scenes/BootScene.ts) (`drawKubbStanding` /
`drawKubbFallen`) : une texture par (equipe x skin), toujours par code, sans asset externe.

| Skin        | Look                                                              | Niveau requis |
| ----------- | ------------------------------------------------------------------ | :-----------: |
| **Bois**    | Look d&apos;origine : fil du bois, biseau au sol                    | 1 (des le debut) |
| **Marbre**  | Base claire veinee, cadre et veines teintes par la couleur d&apos;equipe | 18 |
| **Metal**   | Corps acier avec reflet, cadre et bande de couleur d&apos;equipe    | 19 |

Seul "Bois" reste disponible d&apos;office : Marbre, Metal et Ardoise (boutique, cf.
plus bas) exigent tous niveau ET pieces. Purement cosmetique dans tous les cas : la
hitbox (`HITBOX.kubb` dans `rules.ts`) et les corps Matter ne changent jamais, et
`ai.ts` n&apos;a aucune notion de skin — aucune verification par simulation
n&apos;est necessaire pour cette fonctionnalite. Stocke dans le store
(`kubbSkin` / `setKubbSkin`), thread depuis `MatchScene` jusqu&apos;a chaque
`Kubb` via `Team`.

---

## Skins de roi

Meme principe que les skins de kubbs, applique a la piece centrale : trois
habillages, choisis au menu, generes dans `BootScene.ts`
(`buildKingTextures`, parametree par `KingSkin` au lieu d&apos;une methode par
piece — un seul roi, pas d&apos;equipe a teinter).

| Skin            | Look                                                          | Niveau requis |
| ---------------- | ---------------------------------------------------------------- | :-----------: |
| **Or**           | Look d&apos;origine : couronne doree, joyaux blancs               | 1 (des le debut) |
| **Argent**       | Couronne polie et froide, joyaux blanc-bleute                     | 21 |
| **Obsidienne**   | Verre volcanique sombre, joyaux rouges — le plus tardif du jeu     | 22 |

Seul "Or" reste disponible d&apos;office : les deux autres sont des articles de
boutique (`src/game/shop.ts`, categorie `'king'`), niveau ET pieces necessaires comme
tout le reste du catalogue (cf. section "Boutique" plus bas). Purement cosmetique : la
hitbox (`HITBOX.kingRadius` dans `rules.ts`) et le corps Matter (`KING_BODY`) ne
changent jamais, et `ai.ts` n&apos;a aucune notion de skin — aucune verification par
simulation n&apos;est necessaire pour cette fonctionnalite (le roi est un point de
regle partage par les deux equipes, jamais une decision de l&apos;IA). Stocke dans le
store (`kingSkin` / `setKingSkin`), passe directement au constructeur de `King`
(`MatchScene`), qui l&apos;utilise pour ses deux textures (`king-<skin>` debout,
`king-down-<skin>` couche — la couronne reste lisible meme eteinte, comme pour l&apos;or
d&apos;origine). Verifie en navigateur reel : au niveau 1 seul "Or" est proposable ; a
haut niveau avec assez de pieces, "Argent" apparait dans la boutique, achetable, puis
immediatement selectionnable au menu et reellement selectionne dans le store ; un match
reel demarre avec le roi rendu sur la texture achetee (`king-argent`), confirme
directement via le sprite de la scene ; "Obsidienne" verifiee de la meme facon — zero
erreur console.

---

## Batons

Contrairement aux skins, un vrai effet de jeu — la progression du joueur passe par le
style plutot que par la puissance brute : chaque baton est un compromis, pas un strict
progres. Choisi librement au menu ([`src/game/batons.ts`](src/game/batons.ts)), 3 stats
affichees en etoiles (1 a 5, 3 = le baton de base) :

| Baton            | Puissance | Precision | Controle | Forme  | Niveau requis     |
| ---------------- | :-------: | :-------: | :------: | :----: | :---------------: |
| **De base**      | ★★★☆☆     | ★★★☆☆     | ★★★☆☆    | Baton  | 1 (des le debut)  |
| **Nordique**      | ★★★★☆     | ★★☆☆☆     | ★★★☆☆    | Baton  | 3                 |
| **Sniper**        | ★★☆☆☆     | ★★★★★     | ★★★☆☆    | Baton  | 7                 |
| **Lourd**         | ★★★★★     | ★★☆☆☆     | ★★★☆☆    | Baton  | 11                |
| **Stabilise**     | ★★★☆☆     | ★★★☆☆     | ★★★★★    | Baton  | 17                |
| **Boule**         | ★★★☆☆     | ★★★★☆     | ★★☆☆☆    | Boule  | 14                |
| **Boule de fer**  | ★★★★☆     | ★★★★☆     | ★☆☆☆☆    | Boule  | 20                |
| **Disque**        | ★★★☆☆     | ★★★★☆     | ★★★★☆    | Disque | 23                |
| **Plume**         | ★☆☆☆☆     | ★★★★★     | ★☆☆☆☆    | Baton  | 25                |
| **Enclume**       | ★★★★★     | ★☆☆☆☆     | ★★★☆☆    | Baton  | 27                |
| **Fouet**         | ★★★☆☆     | ★★☆☆☆     | ★★★★★    | Baton  | 29                |

Seul "De base" reste disponible d&apos;office : les 10 autres sont tous des articles de
boutique (`src/game/shop.ts`, categorie `'baton'`) — niveau ET pieces necessaires, cf.
section "Boutique" plus bas. Plume/Enclume/Fouet reprennent la forme "Baton" par defaut
(memes corps physique et texture que De base/Nordique/Sniper/Lourd/Stabilise) : de purs
compromis de stats, sans nouveau rendu — Plume est l&apos;inverse d&apos;Enclume (l&apos;un
maximise la Precision en sacrifiant tout le reste, l&apos;autre maximise la Puissance en
gardant un peu de Controle), et Fouet ouvre une 2e voie vers l&apos;immunite au vent a
cote de Stabilise, en sacrifiant la Precision plutot que de tout garder au baseline.

- **Puissance** module la vitesse max du baton (+/-6% par etoile au-dessus/en-dessous de
  la baseline).
- **Precision** module la deviation aleatoire du jeu (+/-18% par etoile, MOINS de
  deviation pour PLUS d&apos;etoiles).
- **Controle** module l&apos;effet du vent ressenti par ce baton (+/-15% par etoile, MOINS
  d&apos;effet pour PLUS d&apos;etoiles) — donne un vrai enjeu strategique au vent : un
  baton bien controle est un atout par jour de tempete.

**Forme du projectile.** Au-dela des 3 stats, un baton a une forme (`BatonStats.shape`) :
le rectangle allonge par defaut, ou un corps Matter circulaire — Boule, Boule de fer et
Disque sont tous les trois des cercles, mais de deux rayons differents
(`HITBOX.ballRadius`/`discRadius`, [`src/game/rules.ts`](src/game/rules.ts)) et avec des
rendus distincts (`textureKey`, separe de `shape` : Boule et Boule de fer partagent
exactement le meme corps physique, juste une texture bois/fer differente — cf.
[`src/game/scenes/BootScene.ts`](src/game/scenes/BootScene.ts)). La forme influence aussi
la friction terrain (`FieldPreset.frictionMultiplierBall`/`frictionMultiplierDisque`,
absentes = comportement d&apos;un baton normal) : la Boule (et sa variante de fer)
s&apos;enfoncent bien plus qu&apos;un baton dans le Sable, le Disque glisse particulierement
bien sur la Glace.

**Jamais l&apos;IA.** Seules les equipes tenues par un joueur humain beneficient de ces
multiplicateurs (`MatchScene::activeBatonStats`) — l&apos;IA reste toujours sur le baton
de base, quel que soit le choix au menu. Ce choix ne touche donc a aucun des reglages de
securite de l&apos;IA (`decideThrow`/`decideApproachThrow`) : aucune simulation de
suicide n&apos;etait necessaire pour cette fonctionnalite (ni pour l&apos;ajout ulterieur
de Boule de fer et Disque), seulement une verification en navigateur (stats correctement
appliquees au joueur, jamais a l&apos;IA, meme quand un baton different est choisi ;
achat en boutique puis lancer reel de Boule de fer et Disque, texture/corps physique
corrects pour chacun ; zero erreur).

---

## Combo (retour de score en jeu)

Phase 1 de la progression (Phase 2 : XP/niveaux, ci-dessous ; a venir : monnaie,
defis) — un retour immediat, sans consequence sur les regles. Chaque lancer qui abat
au moins un kubb adverse affiche un texte flottant note selon ce qu&apos;il a accompli
(`MatchScene::resolveComboFeedback`) :

| Resultat du lancer                                             | Libelle      | Points de base |
| ---------------------------------------------------------------- | ------------ | -------------- |
| 1 kubb abattu, impact sous le seuil de precision                 | BON LANCER   | +10            |
| 1 kubb abattu, impact au-dessus du seuil de precision (force &ge; 0.55, meme normalisation 0-1 que `Juice.kubbImpact`) | PRECISION    | +25            |
| 2 kubbs abattus par le meme lancer                                | DOUBLE       | +50            |
| 3 kubbs abattus par le meme lancer                                | TRIPLE       | +100           |
| 4 kubbs abattus ou plus par le meme lancer                        | PERFECT !    | +250           |

**Serie (combo).** Chaque lancer qui abat au moins un kubb allonge d&apos;un cran la
serie EN COURS de son equipe (`comboCount`, independante entre bleu et rouge) et
multiplie d&apos;autant les points affiches — un DOUBLE au 3<sup>e</sup> lancer d&apos;une
serie affiche donc "+150" (50 &times; 3), avec un second texte "&times;3 COMBO" juste en
dessous. Un lancer qui ne renverse rien (tir gache, rocher, bande sans suite) casse
la serie de cette equipe, qui repart de zero au prochain abattage. La serie de l&apos;IA
suit exactement les memes regles que celle du joueur — le spectacle vaut aussi pour
elle.

**Aucun effet sur les regles ni sur l&apos;IA.** Purement un habillage
(`Juice.floatingText`), au meme titre que les eclats de bois ou le halo du roi (voir
plus bas) : retirer ce systeme ne changerait l&apos;issue d&apos;aucune partie, et il ne
touche a aucun des reglages de securite de l&apos;IA (`decideThrow`) — verifie
directement en navigateur (les 5 paliers et la multiplication par la serie, cas par
cas, plus un lancer reel en jeu qui declenche bien le retour), aucune simulation de
suicide necessaire.

---

## Progression (niveau &amp; XP)

Phase 2 : un profil persistant (`localStorage`, `progressionPersistence.ts`), commun a
tous les modes — un seul joueur sur cet appareil, meme quand un second humain joue
Rouge en 1v1/2v2 local. Affiche au menu (badge compact) et sur l&apos;ecran de resultat
(gain d&apos;XP du match qui vient de se terminer + barre de niveau).

**Niveau.** XP necessaire pour passer du niveau *n* au niveau *n+1* : `100 + 25*(n-1)`
(croissance lineaire douce). Chaque niveau porte un titre (purement cosmetique) :

| Niveau | Titre                |
| :----: | --------------------- |
| 1      | 🪵 Lanceur debutant    |
| 5      | 🪵 Lanceur amateur     |
| 10     | 🎯 Lanceur confirme    |
| 16     | 🏹 Tireur d&apos;elite |
| 24     | 👑 Maitre du Kubb      |
| 32     | 🔥 Legende du terrain  |

**Gain d&apos;XP**, cote equipe Bleue uniquement, calcule a la fin de chaque partie
(`MatchScene::finish` → `awardMatchXp`) a partir des memes evenements que le combo
(Phase 1) — la progression recompense donc exactement ce que le joueur voit deja
recompense a l&apos;ecran pendant le match :

| Critere                                            | XP                              |
| ---------------------------------------------------- | -------------------------------- |
| Victoire                                             | +100                             |
| Victoire parfaite (aucun kubb Bleu abattu de la partie) | +50                            |
| Precision (par occurrence)                           | +5                                |
| Coup difficile (kubb abattu apres un ricochet sur une bande, par occurrence) | +15 |
| Elimination multiple : DOUBLE / TRIPLE / PERFECT (par occurrence) | +20 / +40 / +80          |
| Serie de victoires (par victoire consecutive, plafonnee a 10) | +5                      |

**Aucun effet sur les regles ni sur l&apos;IA.** Un calcul pur (`progression.ts`,
`computeXpAward`), independant de `decideThrow`/`decideApproachThrow` — verifie
directement (4 scenarios geres a la main via le store : victoire simple, victoire
parfaite + bonus cumules, defaite qui brise la serie, gros score TRIPLE+PERFECT —
total d&apos;XP et passage de niveau corrects a chaque fois), persistance confirmee
apres rechargement de page, et un match complet reel jusqu&apos;a l&apos;ecran de
resultat — zero erreur.

---

## Boutique (pieces &amp; articles)

Phase 3 de la progression : une monnaie et un petit catalogue d&apos;articles cosmetiques,
sur le meme modele de persistance que le niveau/XP (`localStorage`,
`currencyPersistence.ts` / `shopPersistence.ts`) — un profil commun a tous les modes,
jamais perdu, contrairement aux simples preferences de session (skin, baton, effet de
lancer choisis au menu, qui repartent a leurs valeurs par defaut a chaque rechargement).

**Pieces**, gagnees a la fin de chaque partie cote equipe Bleue (`currency.ts`,
`computeCoinsAward`, affiche sur l&apos;ecran de resultat) :

| Source                       | Pieces |
| ------------------------------ | :----: |
| Participation                | +20    |
| Par kubb adverse abattu       | +10    |
| Victoire                     | +50    |

**Catalogue.** Passe d&apos;un petit catalogue cosmetique (skins/effets/2 batons) a la
regle generale du jeu : seuls le terrain "Classique", le baton "De base", le skin de
kubb "Bois" et le skin de roi "Or" restent disponibles d&apos;office (le strict minimum
pour jouer une premiere partie) — TOUT le reste, y compris les terrains et les batons
qui etaient auparavant "gratuits une fois le niveau atteint", passe desormais par ce
catalogue. 17 articles, un seul par niveau (memes niveaux qu&apos;avant pour ceux qui
existaient deja) :

| Article                       | Categorie        | Prix | Niveau requis |
| -------------------------------- | ------------------ | :--: | :-----------: |
| Chicane (terrain)              | Terrain            | 150  | 2             |
| Nordique (baton)               | Baton              | 100  | 3             |
| Glace (trainee de lancer)      | Effet de lancer    | 150  | 4             |
| Sentinelle (terrain)            | Terrain            | 200  | 6             |
| Sniper (baton)                  | Baton              | 150  | 7             |
| Feu (trainee de lancer)         | Effet de lancer    | 150  | 8             |
| Colline (terrain)               | Terrain            | 300  | 9             |
| Lourd (baton)                   | Baton              | 200  | 11            |
| Ardoise (skin de kubb)          | Skin               | 300  | 12            |
| Glace (terrain)                 | Terrain            | 400  | 13            |
| Boule (baton)                   | Baton              | 400  | 14            |
| Sable (terrain)                 | Terrain            | 450  | 15            |
| Stabilise (baton)               | Baton              | 500  | 17            |
| Marbre (skin de kubb)           | Skin               | 150  | 18            |
| Metal (skin de kubb)            | Skin               | 200  | 19            |
| Argent (skin de roi)            | Skin de roi        | 250  | 21            |
| Obsidienne (skin de roi)        | Skin de roi        | 350  | 22            |

Les deux conditions sont necessaires pour acheter (`ShopItem.minLevel`,
`useGameStore::purchaseItem`) : avoir assez de pieces ET avoir atteint ce niveau. Le
bouton d&apos;achat reste desactive tant que l&apos;une des deux manque, avec un message
distinct pour chaque cas (&laquo;&nbsp;Pieces insuffisantes&nbsp;&raquo; vs &laquo;&nbsp;Niveau
X requis&nbsp;&raquo;). L&apos;ecran Progression (cf. section suivante) distingue lui
aussi trois etats par article : verrouille par niveau, debloque mais pas encore achete
(&laquo;&nbsp;🛒 En vente a la boutique&nbsp;&raquo;), et possede.

**Un terrain de boutique n&apos;a besoin d&apos;aucune verification IA supplementaire.**
Le terrain est un reglage de partie choisi au menu avant le match (comme la difficulte
ou la meteo), jamais une decision de l&apos;IA elle-meme — seul son contenu (obstacles,
friction, cf. `rules.ts::FIELD_PRESETS`, deja verifie independamment pour chaque preset,
cf. section "Terrains a obstacles") compte pour `decideThrow`, jamais la facon dont le
joueur y a accede. Verifie en navigateur reel : au niveau 1 sur une sauvegarde neuve, les
selecteurs terrain/baton/skin ne proposent que Classique/De base/Bois ; a haut niveau
avec largement assez de pieces, les 17 articles sont tous achetables (aucun bouton
desactive) et aucun n&apos;apparait dans les selecteurs avant d&apos;etre reellement
achete ; un achat (Chicane, puis Nordique) le fait immediatement apparaitre dans le bon
selecteur et le rend reellement selectionnable pour un match — zero erreur console.

Le baton **Stabilise** (Controle ★★★★★, Puissance/Precision au baseline ★★★) ne casse
pas la regle deja posee pour les autres batons (`batons.ts`) : un choix de style, pas
un strict progres — il ameliore uniquement la resistance au vent, un axe qu&apos;aucun
autre baton ne touche.

Le baton **Boule** (Precision ★★★★☆, Controle ★★☆☆☆, Puissance au baseline ★★★) est le
premier a changer de FORME plutot que de simples multiplicateurs : un corps Matter
circulaire (`HITBOX.ballRadius`, `Baton.ts`) plutot que le rectangle allonge habituel,
avec sa propre texture (`BootScene::buildBoulTexture`) et sa propre trainee
(`Juice.trail` accepte desormais une cle de texture). Roule droit (Precision haute) mais
plus dur a doser sous le vent, sans l&apos;allonge du baton pour compenser (Controle bas).

**Aucun effet sur l&apos;IA ni sur les regles.** Comme les batons et les skins, la
boutique reste un systeme cote joueur uniquement : l&apos;IA ne possede jamais rien et
joue toujours avec le baton de base (donc toujours la forme rectangulaire — `ai.ts` n&apos;a
aucune notion de forme). Verifie en navigateur reel (achat via le bouton de la boutique,
solde et articles possedes persistants apres rechargement, refus d&apos;achat si solde
insuffisant ou article deja possede, selecteurs du menu qui ne proposent que les articles
gratuits ou achetes, teinte de trainee appliquee au bon lancer et jamais a celui de
l&apos;IA, gain de pieces reel en fin de match ; pour la Boule specifiquement : corps
Matter reellement circulaire au lancer, rendu visuel distinct du baton, et un abattage de
kubb reel via cette collision) — aucune simulation IA necessaire, ce systeme
n&apos;influence jamais `decideThrow` ni `decideApproachThrow`.

---

## Deverrouillage par niveau

Jusqu&apos;ici, l&apos;XP/niveau (Phase 2 ci-dessus) ne servait qu&apos;a un titre
cosmetique au menu : tout le reste du contenu etait soit disponible d&apos;office, soit
achetable en boutique des la premiere partie — le niveau n&apos;ouvrait jamais rien.
Cette premiere passe avait introduit DEUX filieres separees (des batons/terrains
"gratuits une fois le niveau atteint", et des articles de boutique niveau+pieces) —
depuis unifiees en une seule regle, plus simple et plus stricte : **seuls le terrain
Classique, le baton De base, le skin de kubb Bois et le skin de roi Or restent
disponibles d&apos;office** (le strict minimum pour jouer une premiere partie). Tout le
reste — 17 articles au total, terrains et skins de roi inclus — passe desormais par la
boutique (`shop.ts`, `SHOP_ITEMS`), niveau ET pieces necessaires pour chacun. **Un seul
deblocage par niveau au maximum**, en evitant expres les paliers de titre (5/10/16&hellip;,
cf. plus bas) pour ne jamais cumuler deux choses en meme temps sur un ecran :

| Niveau | Article de boutique                              |
| :----: | ------------------------------------------------- |
| 2      | Chicane (terrain, 150)                             |
| 3      | Nordique (baton, 100)                              |
| 4      | Glace (trainee, 150)                               |
| 6      | Sentinelle (terrain, 200)                          |
| 7      | Sniper (baton, 150)                                |
| 8      | Feu (trainee, 150)                                 |
| 9      | Colline (terrain, 300)                             |
| 11     | Lourd (baton, 200)                                 |
| 12     | Ardoise (skin, 300)                                |
| 13     | Glace (terrain, 400)                               |
| 14     | Boule (baton, 400)                                 |
| 15     | Sable (terrain, 450)                               |
| 17     | Stabilise (baton, 500)                             |
| 18     | Marbre (skin, 150)                                 |
| 19     | Metal (skin, 200)                                  |
| 21     | Argent (skin de roi, 250)                          |
| 22     | Obsidienne (skin de roi, 350)                      |

**Un seul mecanisme pour tout.** `Menu.tsx` filtre chaque selecteur (terrain, baton,
skin de kubb, skin de roi, effet de lancer) aux seuls choix possedes (`isShopRefOwned`,
`shop.ts`) — les terrains n&apos;etaient eux, avant cette passe, jamais filtres du tout — et affiche sous
les selecteurs terrain/baton un indice discret sur le prochain article a venir dans
cette categorie (&laquo;&nbsp;🔒 Prochain baton : Sniper — niveau 7&nbsp;&raquo;), pour
rendre la progression visible sans devoiler tout le contenu d&apos;un coup. Le niveau
n&apos;ouvre que le DROIT d&apos;acheter (`ShopItem.minLevel`) : atteindre le niveau
d&apos;un article ne le donne pas, il faut encore le payer (`useGameStore::purchaseItem`),
et un article deja achete le reste ensuite quel que soit le niveau (pas de
"deniveau" possible).

**Purement un systeme cote menu/joueur.** Le niveau ne conditionne jamais ce que l&apos;IA
peut jouer (elle reste toujours sur le baton de base et n&apos;a aucune notion de
progression) ni les reglages de securite de `decideThrow`/`decideApproachThrow` — un
terrain de boutique n&apos;a d&apos;ailleurs besoin d&apos;aucune verification IA
supplementaire (c&apos;est un reglage de partie choisi avant le match, comme la
difficulte ; seul son contenu, deja verifie independamment pour chaque preset, compte
pour l&apos;IA). Verifie en navigateur reel : sur une sauvegarde neuve (niveau 1), les
trois selecteurs ne proposent que Classique/De base/Bois ; a haut niveau (25) avec
largement assez de pieces (99&nbsp;999), les 17 articles apparaissent tous dans la
boutique avec leur bouton d&apos;achat actif, mais AUCUN n&apos;apparait dans les
selecteurs de menu avant d&apos;etre reellement achete ; un achat (Chicane, puis
Nordique) le fait immediatement apparaitre dans le bon selecteur et le rend reellement
selectionnable pour un match reel, sans erreur console ; un balayage complet des
niveaux confirme que le nombre d&apos;options affichees grandit exactement palier par
palier ; la boutique affiche &laquo;&nbsp;Niveau X requis&nbsp;&raquo; (bouton
desactive) tant que le niveau manque malgre le solde, et
&laquo;&nbsp;Pieces insuffisantes&nbsp;&raquo; (jamais un message de niveau) une fois le
niveau atteint mais sans le solde — en francais comme en anglais.

**Ecran "Progression"** (`Progression.tsx`) : le badge de niveau compact du menu devient
un bouton qui ouvre le detail complet — barre XP avec l&apos;XP exacte restant avant le
niveau suivant, une feuille de route chronologique de TOUS les paliers (batie
directement depuis `SHOP_ITEMS`, fusionnee avec les titres cosmetiques de
`progression.ts`), et un bloc statistiques (parties jouees, victoires cumulees, serie de
victoires en cours, meilleure manche Defi, succes/articles de boutique possedes,
pieces). **Trois etats par article**, pas juste deux : niveau non atteint
(&laquo;&nbsp;🔒 Niveau X requis&nbsp;&raquo;), niveau atteint mais pas encore achete
(&laquo;&nbsp;🛒 En vente a la boutique&nbsp;&raquo; — nouveau, consequence directe du
"tout doit s&apos;acheter" : avant, atteindre le niveau suffisait), et possede
(&laquo;&nbsp;Debloque&nbsp;&raquo;). **Un seul deblocage par ligne** : le baton De base,
le terrain Classique, le skin de kubb Bois et le skin de roi Or (le point de depart, pas
un deblocage a proprement parler) n&apos;apparaissent pas dans la feuille de route, et
les 17 niveaux requis ont ete choisis pour ne jamais tomber sur un palier de titre
(5/10/16/24/32) ni entre eux — chaque ligne affiche donc toujours exactement un seul
article, jamais deux cumules.
**Victoires cumulees** (`ProgressionState.totalWins`) est un champ persiste ajoute pour
cet ecran — retro-compatible explicitement verifie : une sauvegarde anterieure sans ce
champ ne reinitialise PAS le niveau/XP existant (seul `totalWins` retombe a 0),
contrairement au comportement strict deja en place pour les 3 autres champs. Verifie en
navigateur reel : chargement d&apos;une sauvegarde pre-existante au format anterieur
(niveau restaure, pas remis a zero), ouverture/fermeture de l&apos;ecran, les 3 etats
verifies individuellement (un article achete affiche "Debloque", un article dont le
niveau est atteint mais pas achete affiche "En vente a la boutique", jamais confondus),
persistance apres rechargement — en francais comme en anglais, zero erreur console.
Purement un ecran de lecture cote joueur, aucun effet sur l&apos;IA.

---

## Succes

Phase 4 de la progression : des defis ponctuels, cote equipe Bleue uniquement, chacun
debloque une seule fois par appareil (persiste, `achievementsPersistence.ts`) et
recompense en XP + pieces au moment ou il est franchi — la recompense est simplement
pliee dans le meme calcul de fin de match que la victoire, la precision ou les
combos (`MatchXpStats.achievementXp`, `computeCoinsAward(..., achievementCoins)`),
si bien que le passage de niveau et le solde affiches restent toujours coherents en
un seul endroit (`MatchScene::finish`). Consultable a tout moment au menu (ecran
Succes, `Achievements.tsx`), et annonce a l&apos;ecran (bandeau + son) au moment ou il
tombe pendant la partie.

| Succes            | Condition                                                     | Recompense |
| ------------------ | ---------------------------------------------------------------- | :--------: |
| Double            | Faire tomber 2 kubbs (ou plus) avec un seul lancer               | +150 XP · +50 🪙  |
| Triple            | Faire tomber exactement 3 kubbs avec un seul lancer              | +250 XP · +75 🪙  |
| Perfect           | Faire tomber 4 kubbs ou plus avec un seul lancer                 | +350 XP · +100 🪙 |
| Longue distance   | Faire tomber le kubb adverse le plus eloigne du point de lancer  | +150 XP · +50 🪙  |
| Ricochet          | Redresser un kubb grace a un tir indirect (rebond sur une bande) | +150 XP · +50 🪙  |
| Sans-faute        | Gagner une partie sans rater un seul lancer                      | +400 XP · +150 🪙 |
| Victoire parfaite | Gagner une partie sans perdre un seul de ses propres kubbs       | +350 XP · +125 🪙 |
| Coup de grace     | Faire tomber le roi sur son tout dernier lancer disponible       | +400 XP · +150 🪙 |

**Aucun effet sur l&apos;IA ni sur les regles.** Un systeme de detection cote joueur
pur, ajoute par-dessus les evenements deja suivis pour le combo (Phase 1) et l&apos;XP
(Phase 2) — aucun nouveau reglage de `decideThrow`/`decideApproachThrow`. Verifie
directement : logique de detection (le kubb le plus eloigne reellement identifie
parmi les kubbs adverses encore debout, un lancer a 5 kubbs qui debloque Double +
Perfect sans redebloquer Triple, une redresse via ricochet qui ne debloque jamais
rien pour l&apos;equipe qui n&apos;a pas lance, une victoire avec un lancer manque qui
NE debloque PAS Sans-faute, un roi abattu qui NE debloque PAS Coup de grace s&apos;il
restait des lancers), idempotence (un succes deja possede ou deja gagne plus tot
dans le meme match ne redonne jamais sa recompense), calcul d&apos;XP/pieces qui
inclut bien le bonus de succes, persistance apres rechargement, et l&apos;ecran Succes
+ le bandeau de resultat en navigateur reel — zero simulation IA necessaire.

---

## Meteo (vent)

Bouton au menu, off par defaut (`windEnabled` dans le store) — toujours un simple
Sans vent/Avec vent, sans autre reglage. Quand il est actif, direction (les 8 sens de la
boussole : N, NE, E, SE, S, SW, W, NW) ET force (1 ou 2) sont tirees au hasard une seule
fois par partie (`MatchScene.create`), jamais par lancer, et affichees clairement dans le
HUD (fleche orientee + sens + pastille de force, force 2 mise en evidence en dore —
[`src/ui/HUD.tsx`](src/ui/HUD.tsx)). Une acceleration constante (`windAcceleration` dans
[`src/game/rules.ts`](src/game/rules.ts), proportionnelle a la force) s&apos;ajoute a la
vitesse du baton a chaque pas de vol, dans la direction tiree — y compris dans l&apos;axe
du lancer (nord/sud), pas seulement lateralement comme la toute premiere version. Le
joueur y est expose comme au vrai Kubb : un lancer mal juge peut deriver jusqu&apos;au roi.

**L&apos;IA compense, mais reste prudente — et verifie desormais la VRAIE courbe, pas
seulement l&apos;angle central.** `ai.ts::windCompensatedAngle` simule le vol complet a
l&apos;angle naif, mesure la derive a la distance visee et corrige l&apos;angle en
consequence. Ca ne suffit plus a garantir la securite a elle seule : sous un vent fort, le
roi peut se trouver a mi-chemin d&apos;une cible plus lointaine, la ou la correction
d&apos;angle (optimisee pour la distance complete) laisse une derive residuelle bien plus
grande qu&apos;un modele en ligne droite ne le laisserait croire. `ai.ts::curvedKingDanger`
simule donc la trajectoire COURBEE reelle sur tout le cone d&apos;incertitude (erreur du
niveau + deviation du jeu + pire cas de puissance) avant d&apos;autoriser un candidat,
plutot que de se fier a un simple rayon majore d&apos;une marge fixe.

Verifie en deux temps, avant tout affichage a l&apos;ecran :

1. **Simulation hors-navigateur, verite terrain = trajectoire courbee reelle** : 6120
   matchs (les 3 terrains x 17 etats de vent — sans vent plus les 8 sens x 2 forces — x
   les 3 niveaux). Zero suicide du roi. Au passage, un vrai bug trouve et corrige : le
   modele de vol plafonnait a 400 pas simules (pense pour un jeu sans vent, ou le
   frottement suffit a arreter le baton bien avant) ; sous un vent fort perpendiculaire, la
   vitesse ne repasse jamais sous ce seuil, faisant tourner la simulation jusqu&apos;a
   cette limite artificielle — corrige pour plafonner exactement comme le jeu reel
   (`THROW.maxFlightMs`, ~180 pas). Cout reel mesure : ~13-30ms par decision de l&apos;IA
   meme sous vent fort, largement invisible dans son temps de reflexion (500-850ms).
2. **Navigateur, vraie physique Matter** : 6 matchs solo Difficile avec vent, boussole HUD
   verifiee a chaque partie (5 combinaisons direction/force differentes observees), zero
   roi touche trop tot par l&apos;IA, zero erreur console.

Le tir d&apos;ouverture (`decideApproachThrow`) beneficie du meme vent 2D : verifie a part
sur 4590 tirs simules, 0,37% de contact residuel (concentre sur les niveaux faciles/moyens
par vent fort) — un taux juge acceptable puisque toucher le roi ici ne fait perdre le
tirage au sort que si l&apos;adversaire ne le touche pas aussi (voir plus haut).

---

## Kubbs de champ

Bouton au menu, off par defaut (`fieldKubbsEnabled` dans le store) — la regle officielle
du vrai Kubb la plus souvent absente des adaptations numeriques. Desactivee, le jeu reste
identique a avant cette regle.

Activee : un kubb de **ligne** abattu n&apos;est pas retire du jeu, il est aussitot
**replante** dans le camp de son PROPRE lanceur (`Kubb.plantInField`, placement
automatique et instantane — pas de sous-lancer physique) et devient un **kubb de champ**,
cible **prioritaire** de sa propre equipe au tour suivant, avant tout kubb de ligne
adverse. Un deuxieme abattage le retire cette fois definitivement (`Kubb.knockDown`).
Chaque kubb a donc 3 statuts (`Kubb.status` : `'baseline' | 'field' | 'out'`) au lieu de 2
avant cette regle.

- **Placement** : a la meme abscisse que sa position de ligne d&apos;origine (une par
  index, jamais de chevauchement entre les kubbs de champ d&apos;une meme equipe), a une
  ordonnee fixe du cote ou son equipe lance (`FIELD_KUBB_INSET = 260px` depuis le centre,
  cf. [`src/game/rules.ts`](src/game/rules.ts)) — assez loin du centre pour ne jamais
  chevaucher la zone de friction « Colline » (rayon 130) ni les obstacles des autres
  terrains, assez pres de la ligne de fond adverse pour rester une cible nettement plus
  courte qu&apos;un kubb de ligne (~640px de distance de lancer contre ~830px).
- **Priorite propre a chaque equipe.** `MatchScene.legalTargets(team)` renvoie les kubbs
  de champ de `team` s&apos;il en existe (et EUX SEULS), sinon les kubbs de ligne adverses
  encore debout — comportement inchange sans cette regle. Une equipe qui a des kubbs de
  champ a elle doit donc les abattre elle-meme (ses propres kubbs, mais replantes dans le
  camp adverse) avant tout autre tir ; l&apos;autre equipe, elle, n&apos;est jamais
  contrainte par les kubbs de champ de son adversaire — elle continue de viser la ligne
  normalement. Cette meme fonction sert a la fois de liste de cibles pour l&apos;IA
  (`beginAiTurn`) et de filtre de legalite reel pour `onCollisionStart` : un coup sur une
  cible non prioritaire rebondit sans effet, exactement comme une bande.
- **Roi.** `MatchScene.isKingTargetable(team)` exige a la fois que l&apos;adversaire
  n&apos;ait plus aucun kubb en jeu (ligne + champ) ET que `team` elle-meme n&apos;ait
  plus de kubb de champ a elle a abattre — le viser trop tot reste une defaite immediate,
  meme quand l&apos;adversaire est deja entierement elimine.
- **Ricochet.** La recompense existante (redresse un kubb tombe apres un ricochet sur
  bande, voir plus haut) revient toujours a la ligne d&apos;origine, quel que soit le
  chemin emprunte pour tomber (directement, ou apres etre passe par l&apos;etat champ).

`ai.ts` n&apos;a **aucun changement structurel** : `AiBoard.targets`/`kingTargetable`
traitaient deja des points et un booleen generiques, fournis par l&apos;appelant — toute
la logique nouvelle vit dans `MatchScene`/`Team`/`Kubb`. Le seul risque reel pour
l&apos;IA est un nouveau regime geometrique : des cibles bien plus pres du roi (kubb de
champ a 260px du centre contre 450px pour un kubb de ligne) et de distance de lancer plus
courte (~640px), jamais exercees jusqu&apos;ici. `ai.ts::curvedKingDanger` (voir
Meteo ci-dessus) est deja un balayage GEOMETRIQUE de la trajectoire reelle sur tout le
cone d&apos;incertitude (erreur du niveau + deviation du jeu + pire cas de puissance),
independant de la distance de la cible visee — verifie neanmoins de bout en bout plutot
que suppose correct par analyse seule :

1. **Simulation hors-navigateur** : 3672 tirs decides (`decideThrow`, `kingTargetable:
   false`, cibles = kubbs de champ a 1/2/3/5 kubbs simultanes, sur les deux moities du
   terrain, x 6 niveaux x 6 terrains x 17 etats de vent), chacun rejoue 60 fois avec le
   VRAI tirage aleatoire du match (deviation de lancer supplementaire de
   `Baton.launch`) — 220 320 trajectoires reelles verifiees via `simulateWindFlight`.
   Zero suicide, zero tir invalide (angle/puissance non finis, position de lancer hors
   `THROW_POSITIONS`).
2. **Navigateur, vraie physique Matter** : lancer reel du joueur (drag simule via
   `MatchScene.launch`) abattant un kubb rouge de ligne, transition `'baseline' ->
   'field'` confirmee en jeu (position exacte, HUD `fieldKubbs` a jour), puis tour de
   l&apos;IA reellement joue derriere — trajectoire du baton observee convergeant vers
   son propre kubb de champ (pas la ligne bleue), roi jamais effleure, zero erreur
   console sur l&apos;ensemble du scenario. Verifie separement (manipulation directe des
   etats `Kubb`) : geometrie de replantation, redresse vers la ligne d&apos;origine,
   priorite strictement propre a chaque equipe (un kubb de champ rouge ne bloque jamais
   les tirs de bleu sur la ligne rouge), `isKingTargetable` refusant bien le roi tant
   qu&apos;un kubb de champ reste a abattre.

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
`tutorial.ts` : une echelle de 25 manches contre l'IA, en 4 paliers — la difficulte
(3 niveaux seulement, `ai.ts`) monte vite, puis la variete de terrain prend le relais
pour faire durer la montee en puissance jusqu'au bout :

| Manches | Niveau IA | Terrains |
| ------- | --------- | -------- |
| 1-3     | Facile    | Classique, Chicane, Sentinelle |
| 4-8     | Moyen     | Classique, Chicane, Sentinelle, Colline, Nuit |
| 9-19    | Difficile | Chaque terrain une fois (Classique, Nuit, Chicane, Sentinelle, Colline, Glace, Ruines, Verger, Boue, Riviere, **Sable** en dernier — le seul a cumuler obstacles ET friction modifiee, cf. section "Terrains a obstacles") |
| 20-25   | Difficile | Remix des terrains les plus techniques (Verger, Boue, Ruines, Riviere, Glace, **Sable** en toute derniere manche) |

Seuls le niveau et le terrain changent d'une manche a l'autre : les regles et
l'equilibrage restent ceux, deja calibres, du mode solo — chaque paire (niveau, terrain)
de l'echelle a deja ete verifiee independamment lors de l'ajout de ce terrain (cf. les
sections dediees plus haut) : allonger l'echelle a 25 manches ne fait que recombiner des
paires deja sures, sans exposer l'IA a une seule situation nouvelle — aucune simulation
supplementaire n'etait donc necessaire, seulement une verification en navigateur (menu
annoncant bien 25 manches, bandeau HUD "Manche 25/25" en derniere manche, detection
correcte de fin de run). **Une defaite, un match nul ou le timeout terminent la run
immediatement** — c'est le ressort roguelite : pas de sauvegarde en cours de route.

**Trois bonus**, chacun applicable au joueur uniquement (jamais a l'IA) :

| Bonus                | Effet                                                    |
| --------------------- | -------------------------------------------------------- |
| Bras infatigable      | +2 lancers sur toute la manche                            |
| Bras vif              | +15% de puissance au bout du glissement                   |
| Second souffle         | Le premier lancer qui ne renverse rien n'est pas compte  |

Un seul bonus est propose deux fois : `pickPerkChoices` tire deux options parmi ceux non
encore debloques. Une fois les trois acquis (des la 3e ou 4e manche gagnee, typiquement),
l'ecran de choix n'a plus rien a offrir et la manche suivante s'enchaine directement,
sans faux choix a l'ecran — ce qui concerne donc la majorite des 25 manches de l'echelle.

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

**Musique d&apos;ambiance generative** ([`src/game/audio.ts`](src/game/audio.ts),
`startMusic`/`stopMusic`) : meme contrainte que les SFX — entierement synthetisee, aucun
fichier charge, zero asset externe. Une nappe de fond en quintes ouvertes (pas de tierce :
reste modale, façon bourdon/vielle), qui change d&apos;accord toutes les ~8,5s, sous des
notes egrainees au hasard dans une gamme pentatonique (façon kalimba) — jamais deux fois
la meme boucle exacte. Demarree sur le tout premier geste du joueur (`src/ui/App.tsx`,
meme contrainte de geste que le reste de l&apos;audio, independante de l&apos;ecran
affiche), suit le meme bouton son unique du HUD (aucun reglage separe) et reste volontairement
discrete (bus de gain dedie, `musicGain`) pour ne jamais couvrir les SFX qui portent
l&apos;information de jeu.

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

### Partage du resultat

Bouton **Partager le resultat** sur l&apos;ecran de fin de match
([`src/ui/ResultScreen.tsx`](src/ui/ResultScreen.tsx)) : genere une image (carte
1080&times;1350, [`src/game/shareCard.ts`](src/game/shareCard.ts)) avec le titre du
resultat, le score des deux camps et, en solo/Defi, le niveau/XP/pieces gagnes — dessinee
sur un `<canvas>` hors-DOM, purement cosmetique (aucune regle ni IA impliquee).

- **Web Share API en priorite** (`navigator.share` avec un fichier joint) quand le
  navigateur le permet (mobile principalement) : ouvre directement le partage natif
  (SMS, WhatsApp, etc.) avec l&apos;image en piece jointe.
- **Repli en telechargement** (`<a download>`) sur les navigateurs sans partage de
  fichiers (desktop pour la plupart) — le joueur recupere l&apos;image et la partage a la
  main.
- Emoji explicitement bannis du texte dessine sur le canvas (`result.coinsGainedPlain`,
  variante sans le &#x1FA99; de `result.coinsGained`) : certains environnements sans police
  emoji couleur dessinaient un glyphe manquant a la place — mieux vaut du texte simple,
  garanti partout, qu&apos;un rendu casse sur une minorite d&apos;appareils.

Verifie en navigateur : bouton present sur un resultat solo (avec pastille niveau/XP/pieces)
et sur un resultat 1v1 local (sans pastille, detail plus long sur deux lignes) — repli
telechargement declenche dans les deux cas (headless sans Web Share API), zero erreur
console, image relue et inspectee visuellement.

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
