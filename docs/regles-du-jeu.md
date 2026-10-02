# Regles du jeu

Ce que le jeu fait respecter, et pourquoi. Les choix de regle sont ici ; les
reglages chiffres sont dans [`src/game/rules.ts`](../src/game/rules.ts).

> Fait partie de la documentation de **KUBB: Kings** — [retour au sommaire](../README.md).

---

## Regles implementees

- Chaque equipe aligne **5 kubbs** sur sa ligne de fond.
- **Un seul roi**, au centre du terrain, partage par les deux equipes (regle classique du Kubb).
- Les equipes lancent a tour de role, un baton par tour. En 2v2, les deux joueurs
  d'une equipe alternent lequel des deux est au lancer a chaque fois que revient le
  tour de leur camp — l'alternance des tours elle-meme ne change pas.
- **Placement** : le point de contact choisit la position de lancer, uniquement parmi
  celles de ses propres kubbs **encore debout** (`THROW_POSITIONS` /
  `availableThrowPositions` dans [`src/game/rules.ts`](../src/game/rules.ts)), pas une ligne
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
- **Kubbs de champ** (bouton au menu, off par defaut) : un kubb de ligne abattu est
  replante dans le camp de l&apos;equipe qui vient de l&apos;abattre, plutot que retire du
  jeu — c&apos;est a elle de l&apos;y degager avant de viser de nouveau la ligne d&apos;en
  face, voir section dediee plus bas.

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
  [`src/game/rules.ts`](../src/game/rules.ts), utilisee a la fois par le joueur — visee et
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
- **Le kubb ainsi redresse revient en DEMI-TAILLE** (`rules.ts::REVIVED_KUBB_SCALE`),
  donc plus difficile a reabattre. La reduction porte sur le corps Matter, pas seulement
  sur l&apos;image : une reduction decorative mentirait au joueur, qui viserait un petit
  bloc avec la hitbox d&apos;un grand. Elle n&apos;est pas cumulative — un kubb deja reduit
  reste a cette taille, sans quoi il deviendrait intouchable et la manche pourrait ne plus
  se terminer. Elle ne s&apos;applique pas sous la regle &laquo; Kubbs de champ &raquo;, qui
  fait deja revenir des kubbs en jeu.
  &nbsp;
  **L&apos;IA n&apos;en est pas informee**, deliberement : elle vise avec un rayon derive
  de `HITBOX.kubb` (25 px contre 16 px reels). Mesure en simulation : elle perd de 8 a
  23 points de reussite sur une cible reduite. Lui apprendre la vraie taille la ferait
  viser plus juste, ce qui annulerait en partie la recompense.
- **Fin de tour automatique** quand le baton est a l&apos;arret (ou apres 4 s de vol).

---

## Tir d&apos;ouverture : qui commence ?

Avant que la partie ne debute vraiment, chaque equipe tire une fois vers le roi pour
determiner qui commence — comme au vrai Kubb : le camp qui s&apos;en approche le plus **sans
le toucher** a la priorite. Toucher le roi (meme un frolement) fait perdre ce tirage, sauf
si l&apos;adversaire le touche aussi, auquel cas on recommence entierement. Ces deux lancers
comptent dans le total de 12 par equipe (`MatchScene.beginOpeningThrow` / `resolveOpeningThrow`
/ `beginMatch`), le roi ne tombe jamais et la partie ne se termine pas pendant ce tirage.

**Les kubbs n&apos;y participent pas du tout** : ils ne sont ni affiches, ni presents dans le
monde physique tant que dure le tirage, et reviennent quand la partie commence
(`Kubb::setHiddenForOpening`). Les deux, pas l&apos;un sans l&apos;autre — un bloc invisible
mais toujours solide ferait rebondir le baton sur un obstacle que le joueur ne voit pas,
ce qui serait pire que la regle qu&apos;on corrige.

> **Ce qui a ete corrige.** Jusqu&apos;ici, la branche &laquo; kubb &raquo; de
> `onCollisionStart` n&apos;avait aucune garde sur l&apos;etape de la partie : seul le roi y
> etait traite a part. Un baton d&apos;ouverture qui depassait largement le roi et atteignait
> la ligne adverse avec assez de vitesse pouvait donc **abattre un kubb**, et meme declencher
> des succes. Rare — il fallait une tres longue trajectoire — mais contraire a la regle, et
> l&apos;avantage etait gratuit. L&apos;ecran y gagne aussi : la consigne affichee dit
> &laquo; approchez le roi SANS le toucher &raquo;, et le terrain ne montre plus que le roi.
>
> La garde sur l&apos;etape a tout de meme ete ajoutee dans `onCollisionStart`, alors que les
> corps retires du monde la rendent deja inutile : une regle doit etre **ecrite la ou elle
> s&apos;applique**, pas dependre d&apos;un detail de mise en scene qui pourrait changer.

> **Observation non corrigee.** Le chronometre de la partie tourne pendant le tirage.
> Quelques secondes en pratique, mais ce sont des secondes prises sur les 4 minutes de jeu
> alors que la partie n&apos;a pas commence. A trancher un jour, comme une regle.

- **IA dediee.** `decideApproachThrow` (dans [`src/game/ai.ts`](../src/game/ai.ts)) balaie
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

## Kubbs de champ

Bouton au menu, off par defaut (`fieldKubbsEnabled` dans le store) — la regle officielle
du vrai Kubb la plus souvent absente des adaptations numeriques. Desactivee, le jeu reste
identique a avant cette regle.

Activee : un kubb de **ligne** abattu n&apos;est pas retire du jeu, il est aussitot
**replante dans le camp de l&apos;equipe qui vient de l&apos;abattre** (`Kubb.plantInField`,
placement automatique et instantane — pas de sous-lancer physique) et devient un **kubb de
champ**. C&apos;est alors a cette equipe — celle dans le camp de qui il se dresse — de le
degager, **en priorite** sur tout kubb de ligne adverse : au vrai Kubb, abattre un kubb ne
l&apos;elimine pas, ca le renvoie dans votre moitie de terrain ou il vous barre la route.
Un deuxieme abattage, par cette meme equipe, le retire cette fois definitivement
(`Kubb.knockDown`) : il faut donc **deux touches** pour eliminer un kubb pour de bon.
Chaque kubb a 3 statuts (`Kubb.status` : `'baseline' | 'field' | 'out'`) au lieu de 2
avant cette regle.

> **Correction (2026-09).** La premiere implementation inversait la priorite : elle
> demandait a chaque equipe de degager **ses propres** kubbs de champ, plantes dans le
> camp d&apos;en face. Outre que ce n&apos;etait pas la regle reelle, ca produisait un
> **blocage complet** des qu&apos;une equipe avait abattu les 5 kubbs de ligne adverses :
> `legalTargets` ne renvoyait plus rien (aucun kubb de ligne adverse debout, aucun kubb de
> champ a soi) et `isKingTargetable` refusait le roi (l&apos;adversaire comptait encore 5
> kubbs de champ « en jeu »). L&apos;equipe n&apos;avait alors plus **aucune cible
> legale** : ses batons rebondissaient sur le mur de kubbs plante devant sa propre ligne
> de lancer, et la manche ne pouvait plus se terminer qu&apos;au temps ecoule. La priorite
> est desormais indexee sur le camp ou le kubb se dresse, ce qui remet la regle a
> l&apos;endroit et supprime l&apos;etat mort.

- **Placement** : a la meme abscisse que sa position de ligne d&apos;origine (une par
  index, jamais de chevauchement entre les kubbs de champ d&apos;une meme equipe), a une
  ordonnee fixe du cote ou son equipe lance (`FIELD_KUBB_INSET = 260px` depuis le centre,
  cf. [`src/game/rules.ts`](../src/game/rules.ts)) — soit, par construction, le camp
  d&apos;en face : assez loin du centre pour ne jamais chevaucher la zone de friction
  « Colline » (rayon 130) ni les obstacles des autres terrains, et a seulement ~120px de
  la ligne de lancer de l&apos;equipe qui devra le degager, contre ~830px pour un kubb de
  ligne. Un kubb de champ est donc une cible **courte**, la ou un kubb de ligne est une
  cible longue.
- **Priorite indexee sur le camp, pas sur le proprietaire.**
  `MatchScene.legalTargets(team)` renvoie les kubbs de champ **adverses** plantes dans le
  camp de `team` s&apos;il en existe (et EUX SEULS), sinon les kubbs de ligne adverses
  encore debout — comportement inchange sans cette regle. Les deux branches ne listent que
  des kubbs adverses : on ne vise jamais les siens. Cette meme fonction sert a la fois de
  liste de cibles pour l&apos;IA (`beginAiTurn`) et de filtre de legalite reel pour
  `onCollisionStart` : un coup sur une cible non prioritaire rebondit sans effet,
  exactement comme une bande.
- **Roi.** `MatchScene.isKingTargetable(team)` exige que l&apos;adversaire n&apos;ait plus
  aucun kubb en jeu, ligne **ou** champ (`Team.standingCount`) — ce qui couvre a soi seul
  la regle, puisque les kubbs de champ que `team` doit degager appartiennent justement a
  l&apos;adversaire et comptent dans son total. Le viser trop tot reste une defaite
  immediate.
- **Tween orphelin (corrige avec la regle).** `Kubb.plantInField` lance un tween de
  « pop » de 220ms sur le sprite ; `knockDown`/`plantInField` detruisaient ensuite ce
  sprite **sans tuer le tween**, qui ecrivait alors sur un corps Matter detruit a la
  frame suivante (`Cannot read properties of undefined (reading 'position')`). Les deux
  appellent desormais `killTweensOf` avant de detruire, comme `reviveUp` le faisait deja
  pour l&apos;ombre.
- **Ricochet.** La recompense existante (redresse un kubb tombe apres un ricochet sur
  bande, voir plus haut) revient toujours a la ligne d&apos;origine, quel que soit le
  chemin emprunte pour tomber (directement, ou apres etre passe par l&apos;etat champ).

`ai.ts` n&apos;a **aucun changement structurel** : `AiBoard.targets`/`kingTargetable`
traitaient deja des points et un booleen generiques, fournis par l&apos;appelant — toute
la logique vit dans `MatchScene`/`Team`/`Kubb`. Mais remettre la regle a l&apos;endroit
**renverse la geometrie** que l&apos;IA rencontre, ce qui vaut une reverification
complete plutot qu&apos;une confiance dans celle d&apos;avant :

| | Regle inversee (avant) | Vraie regle (maintenant) |
| --- | --- | --- |
| Cibles « kubb de champ » de l&apos;IA | les SIENS, dans le camp bleu (y=900) | ceux de BLEUE, dans son propre camp (y=380) |
| Distance de lancer | ~640px | ~120px |
| Position du roi | **entre** le lanceur et la cible | **derriere** la cible |
| Risque a couvrir | tir trop court qui s&apos;arrete sur le roi | tir trop long qui **depasse** la cible et continue jusqu&apos;au roi |

Le cas du depassement n&apos;avait donc jamais ete exerce. `ai.ts::curvedKingDanger` (voir
Meteo ci-dessus) est un balayage GEOMETRIQUE de la trajectoire reelle sur tout le cone
d&apos;incertitude (erreur du niveau + deviation du jeu + pire cas de puissance),
independant de la distance visee — verifie de bout en bout :

1. **Simulation hors-navigateur** (sweep complet) : 4488 tirs decides (`decideThrow`,
   `kingTargetable: false`, cibles = kubbs de champ adverses dans le camp de l&apos;IA, en
   8 configurations de 1 a 5 kubbs — dont le cas critique d&apos;un kubb isole **pile dans
   l&apos;axe du roi** — x 3 niveaux x **les 11 terrains** x 17 etats de vent), chacun
   rejoue 60 fois avec le VRAI tirage aleatoire du match (deviation de lancer
   supplementaire de `Baton.launch`) — **269 280 trajectoires reelles** verifiees via
   `simulateWindFlight`. **Zero suicide, zero tir invalide** (angle/puissance non finis,
   position de lancer hors `THROW_POSITIONS`).
   - 18 tirs sur 4488 (0,4%) retombent sur le repli `safeThrow` — tous le meme cas :
     kubb de champ **isole dans l&apos;axe du roi**, vent du sud (qui pousse encore le
     baton vers le roi), IA **facile** (le plus large cone d&apos;erreur). L&apos;IA
     prefere alors tirer volontairement a cote plutot que risquer le roi : elle perd le
     lancer, mais ne se suicide jamais. Comportement conservateur voulu, sans effet sur
     le joueur, qui degage son propre camp normalement.
2. **Navigateur, vraie physique Matter** : kubb de ligne rouge abattu par Bleue →
   replante a (360, **900**), c&apos;est-a-dire dans le camp de Bleue a 120px de sa ligne
   de lancer ; `legalTargets('blue')` = ce seul kubb, `legalTargets('red')` = la ligne
   bleue intacte ; HUD `fieldKubbs.blue = 1` et bandeau « Degagez les kubbs de champ de
   votre camp » affiche ; **vrai lancer** de Bleue (`MatchScene.launch`, Matter reel) qui
   le fait passer a `'out'`. Puis le scenario qui bloquait avant : tous les kubbs de ligne
   rouges abattus → Bleue garde toujours une cible legale, alterne degagement / ligne sur
   7 passes, finit a `redStandingCount = 0` et **`isKingTargetable('blue') = true`** — le
   roi redevient accessible, l&apos;etat mort a disparu. Symetrie verifiee dans
   l&apos;autre sens (kubb bleu replante a y=380 dans le camp rouge, cible prioritaire de
   Rouge), puis **tour d&apos;IA reellement joue** derriere : roi jamais touche, zero
   erreur console sur l&apos;ensemble du scenario.

---

## Meteo (vent)

Bouton au menu, off par defaut (`windEnabled` dans le store) — toujours un simple
Sans vent/Avec vent, sans autre reglage. Quand il est actif, direction (les 8 sens de la
boussole : N, NE, E, SE, S, SW, W, NW) ET force (1 ou 2) sont tirees au hasard une seule
fois par partie (`MatchScene.create`), jamais par lancer, et affichees clairement dans le
HUD (fleche orientee + sens + pastille de force, force 2 mise en evidence en dore —
[`src/ui/HUD.tsx`](../src/ui/HUD.tsx)). Une acceleration constante (`windAcceleration` dans
[`src/game/rules.ts`](../src/game/rules.ts), proportionnelle a la force) s&apos;ajoute a la
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

## Tutoriel de premiere partie

L&apos;ecran des regles ([`src/ui/Rules.tsx`](../src/ui/Rules.tsx)) est un mur de texte : personne
ne le lit avant de jouer. L&apos;onboarding reel se joue **pendant** la toute premiere partie
(solo ou 1v1 local, peu importe), en trois temps :

1. **Avant le premier lancer** ([`src/ui/Tutorial.tsx`](../src/ui/Tutorial.tsx)) : une carte au bas
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
`localStorage` ([`src/game/tutorial.ts`](../src/game/tutorial.ts)) retient que la premiere partie a
eu lieu &mdash; termine ou quittee en cours de route, peu importe, elle ne rejoue jamais deux
fois. **"Revoir le tutoriel"**, dans l&apos;ecran des regles, remet ce drapeau a zero pour la
partie suivante.

---

## Tournoi local

Elimination directe a 4 ou 8 joueurs, pass-and-play sur le meme telephone —
[`src/game/tournament.ts`](../src/game/tournament.ts), module pur (comme `roguelite.ts`)
qui construit et fait progresser l&apos;arbre, sans rien connaitre de la partie
elle-meme. Chaque match du tournoi est un 1v1 local ordinaire : aucune regle, aucun
equilibrage ne change, seul un ecran de tableau s&apos;intercale entre deux matchs.

- **Mise en place** ([`src/ui/TournamentSetup.tsx`](../src/ui/TournamentSetup.tsx)) : taille
  (4 ou 8) et noms des participants (par defaut &laquo; Joueur N &raquo;).
- **Tableau** ([`src/ui/TournamentBracket.tsx`](../src/ui/TournamentBracket.tsx)) : chaque
  tour affiche ses matchs, le vainqueur en surbrillance ; un bouton lance le prochain
  match dont les deux participants sont connus, jusqu&apos;au sacre du champion.
- **Pendant un match**, le HUD affiche les noms des participants a la place des couleurs
  d&apos;equipe (`tournamentPending` dans le store).
- **Match nul** : plutot que de departager au hasard, le meme match se rejoue — le seul
  cas ou `ResultScreen` ne fait pas progresser l&apos;arbre.

Purement une couche de navigation autour du 1v1 existant : aucun impact sur `ai.ts` ni
sur la physique, aucune verification par simulation necessaire.

---
