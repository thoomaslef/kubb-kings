# Progression, succes et mode Defi

Ce qui donne envie de relancer une partie.

> Fait partie de la documentation de **KUBB: Kings** — [retour au sommaire](../README.md).

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
`computeXpAward`), independant de `decideThrow` — verifie
directement (4 scenarios geres a la main via le store : victoire simple, victoire
parfaite + bonus cumules, defaite qui brise la serie, gros score TRIPLE+PERFECT —
total d&apos;XP et passage de niveau corrects a chaque fois), persistance confirmee
apres rechargement de page, et un match complet reel jusqu&apos;a l&apos;ecran de
resultat — zero erreur.

---

## Succes

Phase 4 de la progression : des defis ponctuels, cote **equipe du profil** (cf. la
section « Preparation du jeu en ligne » plus bas), chacun debloque une seule fois par appareil (persiste, `achievementsPersistence.ts`) et
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
| Froleur           | En partie, s&apos;arreter a moins de 60px du roi sans le toucher | +250 XP · +75 🪙  |
| Nettoyeur         | Degager 3 kubbs de champ de son camp dans la meme partie         | +250 XP · +75 🪙  |
| Dans le vent      | Abattre un kubb avec un vent de travers de force 2               | +150 XP · +50 🪙  |
| Chirurgien        | Gagner sans qu&apos;un seul de ses batons touche une bande       | +400 XP · +150 🪙 |
| Remontada         | Gagner apres n&apos;avoir plus eu qu&apos;un seul kubb debout    | +350 XP · +125 🪙 |
| Collectionneur    | Gagner au moins une fois sur chacun des 11 terrains              | +500 XP · +200 🪙 |
| Increvable        | Terminer les 30 manches du mode Defi                             | +600 XP · +250 🪙 |
| Bapteme du feu    | Gagner sa premiere partie en ligne                               | +200 XP · +75 🪙  |
| Tombeur de geant  | Battre en ligne un joueur d&apos;au moins 3 niveaux de plus      | +500 XP · +200 🪙 |
| Invaincu          | Enchainer 3 victoires en ligne sans une seule defaite            | +700 XP · +300 🪙 |

Les seuils (`GRAZE_MAX_DISTANCE = 60`, `FIELD_KUBBS_CLEARED_TARGET = 3`,
`COMEBACK_MAX_STANDING = 1`, `GIANT_LEVEL_GAP = 3`, `ONLINE_STREAK_TARGET = 3`)
sont nommes dans
[`src/game/achievements.ts`](../src/game/achievements.ts) plutot qu&apos;en dur dans la
scene : ce sont des reglages de succes, sans aucun effet sur les regles.

**Collectionneur est le premier succes CUMULATIF** : tous les autres se jouent
entierement dans une seule partie (un simple booleen suffit), celui-la se construit
d&apos;une partie a l&apos;autre et a donc sa propre trace persistee
(`terrainWinsPersistence.ts`, `terrainWins` dans le store, action idempotente
`recordTerrainWin`). C&apos;est la brique dont un futur mode en ligne aura de toute
facon besoin pour des succes a progression.

**Les trois succes en ligne** sont arrives avec le mode en ligne, et posaient
chacun une question differente :

- **Bapteme du feu** ne demande rien de plus qu&apos;une victoire : un succes ne se
  decernant qu&apos;une fois, la « premiere » se deduit d&apos;elle-meme, sans compteur.
- **Invaincu** est le **deuxieme succes cumulatif** (`onlineStreakPersistence.ts`,
  `onlineWinStreak`, `recordOnlineWin`). Une defaite remet la serie a zero ; un match
  nul la laisse telle quelle — ce n&apos;est pas une defaite, et l&apos;effacer serait
  une punition inventee.
- **Tombeur de geant** demandait une information qu&apos;on n&apos;avait pas : le
  niveau de l&apos;adversaire. D&apos;ou la **carte de joueur** (`PlayerCard`), echangee
  dans la poignee de main a cote du projectile. Un objet, pas un simple nombre : le
  pseudo et le classement viendront s&apos;y loger sans changer la forme des messages.
  Elle est **declarative**, donc crue sur parole — et c&apos;est acceptable tant
  qu&apos;elle ne touche pas aux REGLES : mentir sur son niveau ne fait que priver
  l&apos;autre d&apos;un succes, ou se l&apos;offrir soi-meme entre amis. Le jour ou un
  classement sera en jeu, cette information viendra du serveur, pas de l&apos;adversaire.

> **Ecart de niveau lu AVANT les recompenses.** Le niveau du joueur est relu au
> moment du verdict, avant que l&apos;XP de la partie ne soit accordee : c&apos;est
> bien le niveau qu&apos;on avait en entrant sur le terrain qui compte, pas celui
> qu&apos;on a en sortant.

> **A trancher avant l&apos;en-ligne.** La notion de « mon camp » est desormais reglee
> (`profileTeam`, section suivante), mais tout reste stocke en `localStorage` — donc ni
> portable d&apos;un appareil a l&apos;autre, ni verifiable. Des succes en ligne
> (premiere victoire contre un humain, battre un adversaire d&apos;un niveau bien
> superieur, serie de victoires en ligne) demanderont une validation serveur — sans
> quoi ils sont falsifiables ou farmables a deux comptes.

**Aucun effet sur l&apos;IA ni sur les regles.** Un systeme de detection cote joueur
pur, ajoute par-dessus les evenements deja suivis pour le combo (Phase 1) et l&apos;XP
(Phase 2) — aucun nouveau reglage de `decideThrow`. Verifie
directement : logique de detection (le kubb le plus eloigne reellement identifie
parmi les kubbs adverses encore debout, un lancer a 5 kubbs qui debloque Double +
Perfect sans redebloquer Triple, une redresse via ricochet qui ne debloque jamais
rien pour l&apos;equipe qui n&apos;a pas lance, une victoire avec un lancer manque qui
NE debloque PAS Sans-faute, un roi abattu qui NE debloque PAS Coup de grace s&apos;il
restait des lancers), idempotence (un succes deja possede ou deja gagne plus tot
dans le meme match ne redonne jamais sa recompense), calcul d&apos;XP/pieces qui
inclut bien le bonus de succes, persistance apres rechargement, et l&apos;ecran Succes
+ le bandeau de resultat en navigateur reel — zero simulation IA necessaire.

Les sept derniers ont ete verifies de la meme facon, en navigateur, **par le vrai
chemin de jeu** (`resolveOpeningThrow`, `onCollisionStart`, `finish` — jamais en
ecrivant dans le store), avec a chaque fois une contre-epreuve : un frolement au bon
ecart mais roi effleure ne debloque PAS Froleur ; un vent de force 2 dans l&apos;AXE
du terrain (N/S, qui ne fait qu&apos;allonger ou raccourcir) ne debloque PAS Dans le
vent, contrairement a un vent lateral ; une bande touchee annule Chirurgien ; une
manche intermediaire du Defi ne debloque PAS Increvable. Collectionneur a ete joue
sur les 11 terrains d&apos;affilee (11 victoires, une par terrain) jusqu&apos;au
declenchement — zero erreur console sur l&apos;ensemble.

---

## Mode Defi (roguelite)

[`src/game/roguelite.ts`](../src/game/roguelite.ts), module pur comme `ai.ts` et
`tutorial.ts` : une echelle de 30 manches contre l'IA, en 3 paliers de 10 — un palier
par niveau d'IA (3 niveaux seulement, `ai.ts`), la variete de terrain portant a elle
seule la progression a l'interieur de chaque palier :

| Manches | Niveau IA | Terrains |
| ------- | --------- | -------- |
| 1-10    | Facile    | Les 11 terrains sauf Riviere, ordre croissant en complexite, **Sable** en dernier |
| 11-20   | Moyen     | Les 11 terrains sauf Boue, meme ordre, **Sable** en dernier |
| 21-30   | Difficile | Les 11 terrains sauf Classique (plus de manche "a nu" a ce niveau), **Sable** en dernier |

Onze terrains existent pour dix manches par palier (`rules.ts::FIELD_PRESETS`) : chaque
palier en omet donc un, un terrain different a chaque fois — les trois paliers ne se
ressemblent jamais tout a fait, et **Sable** (le seul a cumuler obstacles ET friction
modifiee, cf. section "Terrains a obstacles") ferme systematiquement la marche.

Seuls le niveau et le terrain changent d'une manche a l'autre : les regles et
l'equilibrage restent ceux, deja calibres, du mode solo. Mieux : chaque ajout de terrain
a toujours ete verifie par simulation headless contre **les trois niveaux de difficulte a
la fois** (`Object.keys(AI_PROFILES)` dans chaque script de verification, cf. les
sections dediees plus haut) — jamais seulement celui auquel l'ancienne echelle
l'assignait a l'epoque. Reorganiser quel terrain va avec quel niveau, ou en changer les
proportions (5/8/17 a l'origine, puis 3/5/22 a 25 manches, puis 10/10/10 ici), ne fait
donc que recombiner des paires (niveau, terrain) deja sures individuellement, sans
exposer l'IA a une seule situation nouvelle — aucune simulation supplementaire n'etait
donc necessaire, seulement une verification en navigateur (menu annoncant bien 30
manches, bandeau HUD "Manche 21/30" a l'entree du palier Difficile, "Manche 30/30" en
derniere manche, detection correcte de fin de run). **Une defaite, un match nul ou le
timeout terminent la run immediatement** — c'est le ressort roguelite : pas de
sauvegarde en cours de route.

**Treize bonus**, chacun applicable au joueur uniquement (jamais a l'IA) :

| Bonus             | Effet                                                                     |
| ------------------ | -------------------------------------------------------------------------- |
| Bras infatigable   | +2 lancers sur toute la manche                                             |
| Bras vif           | +15% de puissance au bout du glissement                                    |
| Second souffle     | Le premier lancer qui ne renverse rien n'est pas compte                    |
| Oeil de lynx       | Deviation aleatoire des lancers reduite de moitie                          |
| Sang-froid         | Effet du vent sur les lancers reduit de moitie                             |
| Jauge basse        | Un lancer part toujours a au moins 50% de puissance                        |
| Poigne ferme       | Seuil de chute des kubbs et du roi reduit de 15% pour les coups du joueur  |
| Bourse pleine      | +50% de pieces gagnees sur la manche                                       |
| Etude rapide       | +50% d'XP gagnee sur la manche                                             |
| Sursis             | Une fois par run, un roi touche trop tot ne finit pas la run : la manche est rejouee |
| Longue haleine     | +30 secondes sur l'horloge de la manche                                    |
| Renfort            | Un kubb adverse au hasard est deja abattu avant le premier lancer          |
| Calme plat         | La meteo (vent) est desactivee pour la manche, si elle etait active        |

Chaque nouveau bonus modifie un reglage deja existant du meme sous-systeme qu'un des
trois premiers (deviation/vent/seuil de chute deja lus par `ai.ts` pour l'IA, mais
jamais pour le joueur ; horloge/recompenses deja calculees ailleurs) — aucun n'introduit
de nouvelle mecanique de jeu, donc aucun ne touche a un seul reglage de securite de
l'IA. Seul **Sursis** modifie le deroulement d'une manche (elle est rejouee au lieu de
finir la run) : purement cote scene (`MatchScene::resolveKingHit`, redemarrage de la
scene), l'IA ne sait meme pas que ce bonus existe.

Un seul bonus est propose deux fois : `pickPerkChoices` tire deux options parmi ceux non
encore debloques. Avec treize bonus a decouvrir, l'ecran de choix continue de proposer
de vraies options sur la quasi-totalite des 30 manches de l'echelle ; ce n'est qu'une
fois les treize acquis que la manche suivante s'enchaine directement, sans faux choix a
l'ecran.

La meilleure serie (nombre de manches franchies) est retenue en `localStorage`, affichee
au menu, et proposee de nouveau a la prochaine run — sur le meme modele que la
persistance du tutoriel.

---
