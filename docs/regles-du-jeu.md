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

## Qui commence ?

**Un tirage au sort, une chance sur deux**, dans tous les modes
([`drawStartingTeam`](../src/game/rules.ts)). La partie demarre aussitot en partie
normale : les 12 lancers de chaque equipe comptent tous, et le chronometre ne tourne
plus pour rien. La pastille d&apos;equipe du HUD indique qui joue, et un bandeau de tour la nomme au
debut de la partie. Si le sort designe Rouge en Solo, c&apos;est l&apos;IA qui lance en
premier, de son propre chef (`MatchScene.beginMatch`).

Le tirage est inscrit dans l&apos;enregistrement de la partie
(`MatchSetup.startingTeam`). En ligne, c&apos;est l&apos;hote qui le tire et l&apos;envoie
a l&apos;invite — la meme regle, la meme fonction.

> **Pourquoi le tir d&apos;ouverture a ete retire.** Avant la partie, chaque equipe tirait
> une fois vers le roi, et le camp qui s&apos;en approchait le plus **sans le toucher**
> commencait (comme au vrai Kubb). Il avait un cout reel : deux lancers sans enjeu avant
> chaque partie, une etape de plus a expliquer, et tout un mecanisme annexe — kubbs
> retires du monde physique le temps du tirage, IA dediee (`decideApproachThrow`, qui
> balayait position x angle x puissance), arbitrage des egalites avec rejeu, et un
> instantane reseau qui portait l&apos;etape. Il n&apos;existait de toute facon qu&apos;hors
> ligne : en ligne, l&apos;hote tirait deja au sort.
>
> Retire a la demande du joueur, qui ne l&apos;aimait pas. Ce qui disparait avec lui : le
> mini-jeu, l&apos;IA d&apos;approche, `Kubb::setHiddenForOpening`, la garde « etape » de
> `onCollisionStart`, et `stage` dans l&apos;instantane en ligne — d&apos;ou
> `PROTOCOL_VERSION` passe a **3** : une version 2 qui recevrait un instantane sans `stage`
> lirait `undefined`, ne le prendrait pas pour la partie normale, et rendrait tous les
> kubbs intouchables.
>
> Le succes **Froleur**, qui ne se gagnait qu&apos;a l&apos;ouverture, a ete conserve et
> rattache a la partie : s&apos;arreter a moins de 60 px du roi **sans l&apos;avoir touche**.
> Un effleurement trop doux pour le renverser ne perd pas, donc la scene retient a part si
> le roi a ete touche pendant le lancer (`kingTouchedThisThrow`).

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

## L&apos;effet

Un lancer tenait en deux nombres — un angle et une puissance — tires du meme
glissement, et l&apos;angle etait en plus brouille par une deviation aleatoire. Le geste
se terminait au relachement : aucune decision a prendre pendant le vol, et aucune facon
de faire mieux que « viser juste ». C&apos;est la raison pour laquelle le jeu paraissait
simple.

L&apos;effet ajoute une troisieme entree **sans ajouter d&apos;interface** : on le lit
dans la COURBURE du trajet du doigt ([`src/game/spin.ts`](../src/game/spin.ts)). Glisser
tout droit donne exactement le tir d&apos;avant, au pixel pres ; glisser en arc fait
decrire au baton une courbe du meme cote. On dessine la trajectoire qu&apos;on veut.

Concretement : on mesure l&apos;ecart perpendiculaire MOYEN des points du trajet a la
corde qui joint son debut a sa fin, rapporte a la longueur de cette corde. La moyenne
plutot que le point du milieu, parce qu&apos;un doigt ne trace pas un arc parfait et
qu&apos;un seul point mal place deciderait de tout. Un geste de moins de 60 px ne
produit aucun effet — a cette echelle, la main qui tremble suffirait a en fabriquer un.

En vol, une acceleration **perpendiculaire a la vitesse courante** s&apos;ajoute a chaque
pas, comme le vent juste en dessous mais dans une direction qui tourne avec le
projectile : c&apos;est ce qui fait une courbe plutot qu&apos;une droite inclinee. Elle
est proportionnelle a la vitesse, comme la vraie force de Magnus — la courbe se produit
tant que le baton file et s&apos;efface quand il ralentit.

### Ce que l&apos;effet vaut, mesure

Force de l&apos;effet, tir droit vers la ligne de fond adverse (un kubb fait 36 px de
cote, espace de 120 px) :

| Effet | Ecart a hauteur du roi | Ecart a la ligne de fond |
| --- | --- | --- |
| 0,25 | 11 px | 65 px |
| 0,50 | 22 px | 132 px |
| 0,75 | 34 px | 207 px |
| 1,00 | 45 px | 292 px |

L&apos;effet maximal deplace donc l&apos;arrivee de **2,4 espacements de kubb**. C&apos;est
un reglage FIN compare a la visee : 17 degres d&apos;angle en deplacent 285. L&apos;effet
ne remplace pas de viser juste, il permet de courber.

**Et le kubb central devient atteignable.** C&apos;etait l&apos;objectif de conception,
et il est tenu : le kubb du centre etait injouable parce que la ligne droite passe par
le roi, dont le moindre contact fait perdre sur-le-champ. En visant 13 a 18 degres de
cote avec un effet de 0,7 a 1, le baton passe **55 a 75 px** a cote du roi — le
contact est a 27 px — puis revient se poser a moins de 10 a 20 px du kubb central. La fenetre
est etroite (7 couples angle/effet retenus sur la grille essayee) et la deviation aleatoire de +/-2,5
degres vaut deja +/-20 px a hauteur du roi : le coup reste difficile et peut rater. Un
tir de specialiste, pas une solution gratuite.

> Le reglage de la force (0,4 d&apos;acceleration par pas, a comparer aux 0,05 du vent)
> n&apos;a PAS ete choisi a l&apos;intuition : a 0,2, le meme balayage ne trouvait aucun
> couple qui contourne le roi et touche le centre.

> **Le piege de ce module est le SIGNE**, et la premiere version l&apos;avait a
> l&apos;envers : chaque tir partait a l&apos;oppose de ce que le joueur avait dessine.
> Rien ne l&apos;aurait signale — le jeu fonctionnait, les trajectoires etaient courbes.
> `spin.test.ts` verrouille desormais la correspondance dans les quatre directions, en
> partant d&apos;un vrai geste et non d&apos;une valeur d&apos;effet ecrite a la main.

**L&apos;IA n&apos;en joue pas** : elle tire toujours avec un effet nul. Son modele de vol
(`ai.ts::simulateWindFlight`) ne connait que le vent, et son controle anti-suicide
(`curvedKingDanger`) n&apos;est exact que pour une trajectoire sans effet — lui donner
l&apos;effet sans lui apprendre a le simuler l&apos;aurait rendue dangereuse pour
elle-meme. C&apos;est un choix assume, verifie par
[`tests/browser/effet.mjs`](../tests/browser/effet.mjs), pas un oubli.

**En ligne**, l&apos;effet est un nombre de plus dans `ThrowInput`, rejoue a
l&apos;identique chez l&apos;adversaire comme le reste du lancer. `PROTOCOL_VERSION` passe
a 2 : une version 1 rejouerait les lancers tout droit — l&apos;issue serait la bonne,
elle vient de l&apos;instantane du lanceur, mais l&apos;animation montrerait un baton qui
rate ce qu&apos;il vient d&apos;abattre.

### Un defaut trouve en mesurant : la poussee par image n&apos;etait pas bornee

Le vent et l&apos;effet ajoutent une vitesse « par pas de simulation », et le nombre de
pas se deduisait du delta reel **sans aucune borne**. Une image qui accroche —
compilation de shader, ramasse-miettes, onglet qui revient au premier plan — injectait
d&apos;un coup la poussee de dix ou douze pas, et le projectile faisait une embardee que
rien dans le jeu n&apos;expliquait.

Mesure : le MEME tir, repete dix fois, donnait deux fois 119 px de derive puis huit fois
~9 px. Les deux premiers vols suivaient la mise en route de la page, donc ses images
longues. Le defaut existait deja pour le vent depuis toujours ; l&apos;effet, six fois
plus fort, l&apos;a rendu visible. Le nombre de pas est desormais plafonne a 3 (50 ms) :
au-dela, mieux vaut sous-corriger que teleporter. A 60 images par seconde, ce plafond ne
mord jamais.

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
