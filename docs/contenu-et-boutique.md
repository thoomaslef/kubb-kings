# Contenu et boutique

Terrains, projectiles, apparences, et l'economie qui les distribue.

> Fait partie de la documentation de **KUBB: Kings** — [retour au sommaire](../README.md).

---

## Terrains a obstacles

Onze presets, choisis sur leur propre ecran avant chaque partie
([`src/ui/MapSelect.tsx`](../src/ui/MapSelect.tsx)), dans [`src/game/rules.ts`](../src/game/rules.ts)
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
| **Boue**       | Terrain entier a friction un peu plus forte que Sable et rebonds bien plus mous (aucun ricochet jouable), sans obstacle ni penalite specifique a un projectile — cf. plus bas | 31 |
| **Riviere**    | Une bande horizontale qui REDUIT la friction (pas un rocher, pas une zone qui ralentit) : le baton en ressort plus vite qu&apos;un trajet normal — cf. plus bas | 33 |

Seul "Classique" reste disponible d&apos;office : les 10 autres sont desormais des
> **Le terrain a son propre ecran depuis peu.** Il se reglait avant dans une liste du
> menu, noyee parmi huit autres reglages et sans rien montrer de ce qu&apos;on
> choisissait — alors que c&apos;est la decision qui change le plus une partie. Les
> miniatures de [`FieldPreview.tsx`](../src/ui/FieldPreview.tsx) sont **derivees du
> preset lui-meme** (obstacles, colline, riviere, couleur de sol) : un terrain ajoute,
> ou un rocher deplace, voit sa miniature suivre toute seule. Une image figee aurait
> menti des la premiere retouche d&apos;equilibrage — et le jeu n&apos;embarque de toute
> facon aucun fichier d&apos;image.

articles de boutique (`src/game/shop.ts`, categorie `'terrain'`) — niveau ET pieces
necessaires pour les acheter, cf. section "Boutique" plus bas.

Un rocher ne tombe jamais et ne fait tomber personne : il fait rebondir le baton comme
une bande (`src/game/entities/Obstacle.ts`, corps Matter statique).

**L&apos;IA les voit.** `AiBoard.obstacles` (dans [`src/game/ai.ts`](../src/game/ai.ts)) lui
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
des valeurs plus severes (friction x1,65 contre x1,6 pour Sable, restitution x0,25
contre x0,35) et volontairement AUCUNE variante par forme de projectile
(`frictionMultiplierBall`/`frictionMultiplierDisque` absentes) : un pur terrain
"lourd", uniforme, sans le choix tactique boule-vs-baton de Sable ni obstacle. Meme
sweep standard (tous niveaux x tous etats de vent x 6 configurations de kubbs adverses
x kingTargetable vrai/faux, 612 tirs decides, 12&nbsp;240 trajectoires reelles) : zero
suicide, zero tir invalide. Puis en navigateur reel : achat boutique, terrain visible
au selecteur, lancer reel sans erreur console.

> **Corrige apres coup : le terrain etait INJOUABLE.** La friction avait ete reglee a
> x2,2, et personne ne s&apos;etait demande si la ligne adverse restait seulement
> ATTEIGNABLE. Elle ne l&apos;etait pas : la portee utile d&apos;un baton a pleine
> puissance tombait a **762 px pour 830 px a parcourir**, avec tous les projectiles
> sans exception. Pas un terrain difficile : un terrain ou l&apos;on ne pouvait pas
> marquer.
>
> Le sweep IA ne l&apos;avait pas vu parce qu&apos;il mesure ce que l&apos;IA DECIDE,
> pas si la cible est a portee — et l&apos;IA visait surtout des kubbs de champ, bien
> plus proches. Les parties de verification non plus : personne n&apos;avait joue une
> manche entiere sur Boue en visant la ligne de fond.
>
> **Le plafond n&apos;est pas un gout, c&apos;est la geometrie.** Avec 830 px a
> franchir, Sable (x1,6) demande deja 82 % de jauge au baton de base. Au-dela de
> ~x1,65, les projectiles les plus faibles ne traversent plus le terrain. Un terrain
> nettement plus lourd que Sable n&apos;est pas possible sans changer les dimensions du
> jeu — la vraie identite de Boue est donc ailleurs : son rebond mort (x0,25) rend tout
> ricochet sur bande injouable, ce que Sable permet encore.
>
> **L&apos;invariant est desormais verrouille par un test**
> ([`rules.test.ts`](../src/game/rules.test.ts)) : tout terrain doit rester
> traversable par tout projectile, avec une marge reelle — a l&apos;exception des
> penalites tactiques assumees (la boule sur Sable), nommees une par une. Remettre
> x2,2 fait tomber 4 tests, avec le message &laquo; boue avec base : 762 px de portee
> utile pour 830 px a parcourir &raquo;.
>
> Apres correction, l&apos;IA sur Boue est redevenue indiscernable de Sable
> (8 / 28 / 65 % de tirs au but selon le niveau, contre 8 / 29 / 65 %), zero suicide
> sur 24&nbsp;000 trajectoires simulees sur quatre terrains.

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

## Batons

Contrairement aux skins, un vrai effet de jeu — la progression du joueur passe par le
style plutot que par la puissance brute : chaque baton est un compromis, pas un strict
progres. Choisi librement au menu ([`src/game/batons.ts`](../src/game/batons.ts)), 3 stats
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
(`HITBOX.ballRadius`/`discRadius`, [`src/game/rules.ts`](../src/game/rules.ts)) et avec des
rendus distincts (`textureKey`, separe de `shape` : Boule et Boule de fer partagent
exactement le meme corps physique, juste une texture bois/fer differente — cf.
[`src/game/scenes/BootScene.ts`](../src/game/scenes/BootScene.ts)). La forme influence aussi
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

## Skins de blocs

Trois habillages, choisis au menu, generes dans
[`src/game/scenes/BootScene.ts`](../src/game/scenes/BootScene.ts) (`drawKubbStanding` /
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
