# Parties classees, rangs et vue en miroir

## Les rangs

Six rangs, trois divisions chacun, soit **dix-huit marches** :
Bronze < Argent < Or < Platine < Diamant < Master, en divisions 1, 2 et 3.
**La division 3 est la plus haute** d'un rang : Or 2 + une victoire = Or 3, puis
Platine 1. On commence a Bronze 1.

| Resultat | Effet |
| --- | --- |
| Victoire | +1 division |
| Defaite | -1 division |
| Match nul | aucun changement |
| Bronze 1, defaite | reste Bronze 1 (plancher) |
| Master 3, victoire | reste Master 3 (plafond) |

La regle est celle demandee : **une marche par resultat, sans points de ligue**.
`src/game/ranks.ts` (module pur, 15 tests dans `ranks.test.ts`). Son prix est connu : un
joueur de niveau moyen oscille autour de son niveau reel, et la marche ne dit pas « a
quel point » on a gagne ; gravir toute l'echelle demande dix-sept victoires nettes de
plus que de defaites.

**Local d'abord.** Le rang est dans le `localStorage` (`rankPersistence.ts`). Avec un compte
joueur (cf. `comptes-joueurs.md`) il suit le joueur d'un appareil a l'autre et alimente le
classement ci-dessous ; sans compte, il reste sur l'appareil. Dans les deux cas il est
**declare par le joueur, pas arbitre par un serveur** : n'importe qui peut le modifier a la main.

## Le classement

Sur l'ecran des rangs, sous l'echelle : les **20 meilleurs rangs**, du plus haut au plus bas (a
rang egal : meilleur rang atteint, puis nombre de victoires). **Lisible sans compte.** Chaque ligne :
place, insigne, pseudo, rang, bilan (« 12V 3D »). La ligne du joueur connecte est mise en evidence ;
s'il est hors des 20 premiers, sa place est affichee en dessous (« 37e sur 412 »).

**Pseudos generes, jamais saisis.** Le serveur attribue un pseudo du type « RapideViking42 » (adjectif +
nom + nombre, unique) ; le joueur peut en demander un autre, mais **n'ecrit rien**. C'est voulu : un
classement PUBLIC avec des noms libres demanderait de moderer des insultes, et le jeu est joue par des
enfants (meme raisonnement que l'absence de tchat contre un inconnu). L'e-mail et le nom n'y figurent
jamais. Le joueur peut aussi **ne plus apparaitre** au classement, et supprimer son compte l'en retire.

**Ce que le classement ne prouve PAS.** Les rangs sont declares par les clients. Une seule defense, minimale :
le serveur n'accepte dans le classement qu'un rang **coherent** (impossible d'etre a la marche N avec moins de N
victoires, ni d'avoir un meilleur rang sous son rang actuel — `save_profile`, `supabase/comptes.sql`).
Un joueur qui falsifie aussi ses victoires passe ce controle : c'est un classement **amical**, et l'ecran le
dit. Le rendre fiable demande que le serveur valide chaque resultat, les deux joueurs le declarant — chantier
suivant, pas celui-ci.

**Mise en place.** Le script `supabase/comptes.sql` s'execute de nouveau tel quel (il met a jour une base
deja installee) ; rien d'autre a configurer.

## L'ecran des rangs

Depuis le menu : le bouton « Classe — Or 2 » (avec l'insigne du rang). L'ecran presente
le rang actuel, la prochaine marche, le bilan (victoires, defaites, meilleur rang), l'echelle
des six rangs avec la position du joueur, les regles, puis le bouton qui lance la
recherche classee.

## Le matchmaking classe

`OnlineLobby.tsx`, en mode classe. Meme file que la partie rapide (`matchmaking.ts`, cf.
`jeu-en-ligne.md`) mais sur **un canal separe** (`MATCHMAKING-RANKED`) : un joueur classe ne
tombe jamais sur une partie amicale. Les joueurs sont couples par ordre d'arrivee — **pas
encore par proximite de rang** : avec peu de joueurs, une file triee par niveau ne
couplerait personne. A faire quand il y aura du monde.

**Conditions imposees**, les memes pour tous (l'hote les inscrit, c'est lui qui decide) :
terrain classique, sans vent, sans kubb de champ, **projectile de base pour les deux**.
Rien de ce qu'on a achete a la boutique ni regle au menu n'entre en jeu — verifie en navigateur
avec des reglages volontairement hostiles (vent actif, glace, kubbs de champ).

**Pas de revanche** en classe (le rang est deja joue) ; l'ecran de resultat propose
« Autre partie classee ».

### Abandon et forfait

- **Quitter en cours de partie** : defaite (le menu pause l'annonce).
- **Fermer l'onglet en pleine partie** : defaite au chargement suivant. Un marqueur
  (`kubb-kings.ranked-pending`) est pose au depart de la partie et retire a sa fin, quelle
  qu'elle soit ; s'il est encore la au rechargement, la partie a ete abandonnee. Sans lui,
  fermer l'onglet serait le moyen gratuit d'echapper a une defaite.
- **L'adversaire part volontairement** : victoire par forfait.
- **Liaison perdue / desynchronisation** : aucun changement — rien ne designe le fautif.
  Limite connue : un adversaire qui ferme son onglet (sans message d'adieu) se voit comme une
  liaison perdue chez nous : pas de victoire par forfait dans ce cas.
- **Sans adversaire au bout d'une minute** : un bot en difficile, **en entrainement** — le
  rang ne bouge pas, aucun marqueur d'abandon n'est pose (aucune partie en ligne n'a lieu).

## La vue en miroir

En ligne, l'invite tient Rouge, dont le lanceur est en haut du terrain. Plutot que de le
laisser jouer a l'envers, **sa camera est tournee de 180 degres** (`rules.ts::isMirroredView`,
`MatchScene.create`) : chacun se voit en bas, face a son adversaire, kubbs en bas de
l'ecran. Jamais hors ligne : en 1v1 local les deux joueurs partagent l'ecran, et contre
l'IA le joueur tient toujours Bleue.

Seul l'**affichage** tourne : le monde physique est identique des deux cotes (c'est ce qui
permet de rejouer un coup), les coordonnees de jeu ne bougent pas, et les gestes se lisent
dans le monde grace a la conversion de Phaser — tirer vers le haut de SON ecran lance bien
vers l'adversaire. Ajustements necessaires :

- les textes flottants et le bandeau de tour sont tournes de 180 degres a leur tour (sinon
  ils s'afficheraient a l'envers), leurs marges de securite et leur course sont inversees ;
- le vent du HUD se lit depuis l'ecran du joueur (nord <-> sud, est <-> ouest) ;
- les ombres portees pointent de l'autre cote chez l'invite — purement esthetique, non corrige.

Verifie en navigateur par `tests/browser/vue-miroir.mjs`, avec la fonction de conversion de
Phaser (`getWorldPoint`) et non ma propre formule : verifier une rotation avec la formule qui
l'applique ne prouverait rien.

## Verification

- `ranks.test.ts` : l'echelle, les bornes, Or 2 -> Or 3, un nul qui ne change rien.
- `rules.test.ts` : quand la vue est en miroir, et la lecture du vent.
- `tests/browser/classe.mjs` : l'ecran, la file classee, les conditions imposees, le rang qui
  bouge vraiment (Or 2 -> Or 3 pour le vainqueur, Or 2 -> Or 1 pour le perdant), le forfait,
  l'onglet ferme, le bot sans effet sur le rang. Dure environ 3 minutes (une vraie minute
  d'attente pour le bot).
- `tests/browser/vue-miroir.mjs` : la camera, le bas de chaque ecran, un vrai geste de
  l'invite, les textes, le vent, et le 1v1 local jamais retourne.
- **Non verifie** : la file classee avec de vrais joueurs sur Supabase ; l'affichage de
  l'insigne sur un vrai telephone.
