# Verifications au navigateur

Ce que `npm test` ne peut pas couvrir : la physique Matter reelle,
l'enchainement des scenes Phaser, et surtout **deux joueurs** qui s'echangent
une partie. Ces verifications pilotent un vrai Chromium, prennent plusieurs
minutes, et ne tournent donc **pas** dans la CI — on les lance a la main avant
de toucher aux regles ou au mode en ligne.

## Lancer

```bash
# Contre le serveur de developpement
npm run dev &
npm run test:browser

# Contre le BUILD, c'est-a-dire ce qui est reellement livre (preferable)
VITE_EXPOSE_TEST_HANDLE=1 npm run build
npm run preview &
KUBB_URL=http://localhost:4173/kubb-kings/ npm run test:browser
```

Une seule verification a la fois :

```bash
KUBB_URL=... node tests/browser/partie-en-ligne.mjs
```

## Reglages

| Variable | Role | Defaut |
| --- | --- | --- |
| `KUBB_URL` | adresse du jeu | `http://localhost:5173/` |

> **Pour les verifications EN LIGNE**, le build ne doit pas embarquer les
> coordonnees Supabase, sinon le jeu tente une vraie connexion. Elles
> viennent de DEUX endroits a neutraliser ensemble — le fichier `.env` et
> l'environnement du conteneur :
>
> ```bash
> mv .env .env.horsjeu
> env -u VITE_SUPABASE_URL -u VITE_SUPABASE_ANON_KEY VITE_EXPOSE_TEST_HANDLE=1 npm run build
> ```
>
> **Symptome si on l'oublie** : les quatre verifications en ligne echouent sur
> « Le salon ne s'est pas ouvert (service en ligne injoignable ?) », et la
> console de la page montre
> `WebSocket ... failed: net::ERR_CERT_AUTHORITY_INVALID` — le Chromium de
> l'atelier ne fait pas confiance au certificat du mandataire sortant. Le
> service Supabase, lui, repond parfaitement (`curl` dessus renvoie 401). Ce
> n'est donc jamais un defaut du jeu : c'est un build qui embarque les
> coordonnees alors qu'il ne devrait pas.
| `KUBB_LEGAL_URL` | racine des pages legales (`pages-legales.mjs`) | `legal` deduit de `KUBB_URL` |
| `CHROMIUM_PATH` | binaire Chromium a piloter | celui de l'atelier |

Le paquet installe est `playwright-core` : il ne telecharge aucun navigateur,
c'est `CHROMIUM_PATH` qui en designe un.

## Ce que couvre chaque fichier

| Fichier | Couvre |
| --- | --- |
| `pages-legales.mjs` | Les trois pages legales et l'ecran in-app : rendu reel, liens croises, **aucun debordement a 390 px**, et la divulgation du mode en ligne presente **dans les deux formes**. Ne lance aucune partie : quelques secondes |
| `resolution-ecran.mjs` | **La seule a tourner a DPR 3**, comme un telephone : toutes les autres sont a DPR 1, ou le facteur de rendu vaut 1 et ou tout le code haute resolution est inerte. Mesure la nettete (pixels physiques par pixel de texture), les tailles AFFICHEES de chaque piece, et surtout que les corps Matter ne bougent pas — y compris ceux qui sont recrees en cours de partie (kubb de champ, kubb redresse). Ne lance aucune partie complete |
| `menu-reglages.mjs` | La mise en page des groupes de choix du menu, **tout contenu debloque** : rien ne deborde, aucun libelle tronque, cibles tactiles >= 44 px — a 5 largeurs d'ecran et dans les deux langues. Ne lance aucune partie |
| `mise-en-veille.mjs` | Le canevas revient a la bonne echelle apres une mise en veille, un changement d'orientation ou un conteneur qui bouge **pendant que la boucle Phaser est gelee**. Signale sur un vrai iPhone : apres verrouillage/deverrouillage, le jeu se retrouvait dans un petit rectangle centre |
| `choix-du-terrain.mjs` | L'ecran de choix du terrain : le terrain retenu est bien celui que la partie utilise, les quatre modes y passent et aboutissent au bon endroit, le Defi non, un terrain verrouille reste visible mais non selectionnable, et la barre d'action reste a l'ecran malgre les onze terrains |
| `bonus-defi.mjs` | Les quatre bonus du Defi ajoutes apres les treize premiers (Poignet souple, Effet appuye, Elan, Grand renfort) : demarre une vraie manche de Defi, y pose les bonus et lit ce que la scene en fait — kubbs abattus au depart, effet lu et effet de vol sur un geste piloté a la souris, remboursement d'Elan (une seule fois, pas sur un simple coup) |
| `effet.mjs` | L'effet, de bout en bout : la verification **pilote la souris** et glisse en arc sur le canevas, comme un pouce. Un geste droit ne courbe rien, un demi-geste courbe a moitie, un geste franc courbe du cote ou le doigt est passe. Couvre aussi la zone morte (un pouce pivote, un glissement « droit » l'est rarement) et le fait que l'IA tire toujours droit |
| `kubb-redresse.mjs` | Un kubb redresse par la recompense du ricochet revient a la moitie de sa taille — **corps Matter compris**, pas seulement l'image — sans cumul, et pas sous la regle "Kubbs de champ" |
| `ia-roi.mjs` | L'IA ne renverse jamais le roi tant qu'il est protege, **sous la vraie physique Matter** : son controle anti-suicide simule son propre modele de vol, une verification headless le comparerait donc a lui-meme |
| `tchat.mjs` | Un message part d'un appareil et arrive sur l'autre, les garde-fous tiennent sur le chemin REEL (longueur plafonnee a la reception, sauts de ligne neutralises, cadence), et rien ne survit a la partie. Comprend un message **depose directement sur le canal**, sans passer par l'interface — seul moyen d'eprouver l'assainissement a la reception |
| `depart-de-partie.mjs` | La partie **demarre directement**, sans tir d'ouverture : kubbs affiches ET presents dans le monde physique, le premier lancer compte et peut abattre un kubb, et le tirage au sort est branche au depart — **le hasard est force** pour exercer les deux issues (Bleue commence, Rouge commence, et en Solo l'IA lance d'elle-meme). Couvre aussi « Froleur », qui se gagne maintenant en partie. **Seule verification a couvrir le depart en mode LOCAL** |
| `comptes.mjs` (`npm run test:comptes`) | Les comptes joueurs contre un FAUX Supabase (le vrai SDK, de vraies requetes interceptees) : creation, appareil vierge qui retrouve tout, erreurs, deux appareils qui ecrivent en meme temps sans rien perdre, les trois choix du dialogue, deconnexion, confirmation d'e-mail, suppression. Build a part (`dist-comptes`), hors de `npm run test:browser` |
| `classe.mjs` | Les parties classees : l'ecran des rangs, la file classee, les conditions imposees (terrain, vent, projectile — malgre des reglages hostiles), le rang qui bouge vraiment (Or 2 -> Or 3 / Or 1), le forfait, l'onglet ferme, le bot sans effet sur le rang. Dure environ 3 minutes |
| `vue-miroir.mjs` | La vue en miroir de l'invite en ligne : camera tournee, bas de chaque ecran mesure avec `getWorldPoint` de Phaser, vrai geste de souris, textes redresses, vent lu a l'envers, 1v1 local jamais retourne |
| `recherche-rapide.mjs` | La file « Partie rapide » : deux joueurs se retrouvent (camps opposes, meme salon), annuler libere la file, et un joueur seul tombe sur un bot en difficile au bout de la VRAIE minute (le choix du menu reste intact). Dure environ 2 minutes |
| `partie-en-ligne.mjs` | Poignee de main, decor impose par l'hote, tour verrouille, propagation d'un lancer, **coup decisif** (celui qui, longtemps, ne partait pas) |
| `coupure-et-reprise.mjs` | Rechargement puis reprise a l'identique, partie qui continue apres, **coupure silencieuse** detectee et annoncee |
| `revanche-et-succes.mjs` | Revanche a deux accords, nouvelles conditions, compteur remis a zero, et les trois succes en ligne dont « Invaincu » qui traverse trois parties et la persistance |

## Pieges appris a la dure

**Chromium ralentit tres fortement une page qui n'est pas au premier plan.**
Un `delayedCall` de 750 ms de temps de JEU peut sembler ne jamais arriver. Les
drapeaux `--disable-background-timer-throttling` et consorts n'y suffisent
pas : seul `bringToFront()` rend la page pleinement vive. Le socle
(`harness.mjs`) le fait avant chaque attente — n'observez jamais une page sans
passer par ses helpers.

**Ne jamais faire jouer un camp sans avoir attendu que l'autre ait recu le coup
precedent** (`attendreCoups`). Sinon le lancer part avec un mauvais numero
d'ordre et desynchronise la partie — ce qui fait echouer la verification pour
une raison qui n'a rien a voir avec le jeu.

**Et ne jamais lancer sans avoir attendu d'etre en etat de le faire.**
`lancer()` passe par `attendreSonTour()` : scene vivante, phase de visee,
aucun baton en vol, et la main a ce camp. Sans cela, `launch()` pouvait etre
appele pendant que la scene rejouait encore le coup adverse — le lancer
s'evaporait sans bruit, et la verification echouait une fois sur quelques-unes.
Si la page n'est jamais prete, l'erreur est franche et dit pourquoi, au lieu de
laisser un echec inexplicable plus loin.

**Un garde-fou ne se teste pas en passant par l'interface qui l'applique
deja.** Le tchat est assaini a l'envoi ET a la reception. Tant que la
verification n'envoyait que depuis le champ de saisie, retirer le nettoyage
cote reception ne faisait echouer AUCUNE assertion : le texte arrivait deja
propre. `tchat.mjs` depose donc aussi un message brut directement sur le
`BroadcastChannel` du salon, comme le ferait un pair qui ne se conforme pas
— c'est la situation que ce nettoyage existe pour couvrir.

**Une rafale pilotee depuis Playwright n'est pas une rafale.** Cinq
`fill` + `click` prenaient **7,7 s**, soit 1,5 s entre messages — bien
au-dela de la limite de cadence. Les cinq passaient legitimement et la
verification concluait a tort que le garde-fou ne servait a rien. La rafale
se joue desormais DANS la page, en un seul tour de boucle : 5 ms, un seul
message passe.

**En ligne, attendre UN SEUL des deux joueurs ne suffit pas.** Pendant que
l'invite rejoint, la page de l'hote passe en arriere-plan et Chromium la
ralentit : elle pouvait n'avoir pas encore traite le `join` quand la
verification lisait deja sa scene. L'echec arrivait alors sous la forme
« Cannot read properties of undefined (reading 'blue') », qui ne designe
rien — et une fois sur trois seulement. `ouvrirPartieEnLigne` attend
desormais les deux cotes. Defaut trouve en relancant la suite, confirme
present AVANT le changement en cours, et verifie corrige sur quatre essais
consecutifs.

**Une verification a DPR 1 ne voit rien du rendu haute resolution.** Tant que
la suite entiere tournait au `deviceScaleFactor` par defaut de Playwright, le
facteur de rendu valait 1 et le code ecrit pour les ecrans denses n'etait
jamais execute. Trois defauts bien reels ont ainsi ete livres : le bandeau de
passage de tour ecrivait son texte hors du cadre, la chute du roi divisait le
terrain par deux **definitivement**, et les textes flottants n'etaient plus
bornes. `resolution-ecran.mjs` tourne donc a DPR 3.

**Mesurer une intention n'est pas mesurer un resultat.** La premiere version du
controle de nettete calculait les pixels par texel a partir du facteur
*attendu*, et non de la taille reelle des textures : la mutation « generer les
textures a la taille de design » ne la faisait pas broncher. De meme, le
controle du bandeau lui passait sa propre largeur, et ne testait donc que le
centrage interne — le parametre a disparu de `turnBanner`, la seule largeur
correcte etant celle du terrain.

**Un corps Matter qu'on redimensionne au tween ne se mesure pas pendant le
tween.** Le kubb replante en champ part a 0,6 et grandit : lu tout de suite,
son corps fait 21,6 au lieu de 36, a tous les DPR, et la mesure ne dit rien.
On attend la fin de l'animation — pas question de lui imposer la valeur
attendue.

**Un banc d'essai qui ecrit `scene.aimSpin` ne teste pas le geste.** L'effet se lit
dans la courbure du trajet du doigt : poser directement la valeur sauterait
exactement la moitie qu'on vient d'ecrire. `effet.mjs` pilote donc la souris.

**Un baton orphelin se laisse suivre sans rien dire.** Mettre `scene.baton = null`
sans le detruire laissait l'ancien projectile, immobile, dans le monde : l'enregistreur
le suivait en croyant suivre le nouveau, et la courbure mesuree valait 0 px sur 0 px.
La verification en concluait que l'effet ne courbait rien. Elle echoue desormais
franchement si le projectile n'a pas parcouru 50 px.

**Mesurer la courbure par rapport a la corde depart -> arrivee est faux.** Le baton
rebondit sur la bande du fond et revient : cette corde ne designe plus la direction du
vol, elle peut meme pointer a l'oppose. Une premiere version concluait que la courbe
partait du mauvais cote alors que la physique etait juste. On mesure l'ecart a la
direction de DEPART, et sur le seul aller.

**A 20 images par seconde, le baton parcourt 90 px entre deux releves.** Relever le
point d'APRES la ligne qu'on veut franchir introduisait jusqu'a 90 px d'erreur, assez
pour faire croire a une physique capricieuse et pour fausser tout un balayage de
reglage. On interpole entre les deux releves qui encadrent la ligne.

**Les deux premiers vols d'une page ne ressemblent pas aux suivants.** Mise en route,
compilation des shaders, premieres allocations : leurs images sont bien plus longues.
Mesure : 119 px de derive contre 9 px ensuite, de facon parfaitement reproductible. Les
bancs d'essai tirent deux fois a vide avant de mesurer. (C'est ainsi qu'a ete trouve un
vrai defaut du jeu : la poussee du vent et de l'effet n'etait pas bornee par image.)

**En Solo, l'IA joue entre deux mesures** et remplace le baton qu'on echantillonne. Les
mesures de trajectoire se font en 1v1 local.

**Une simulation qui juge son propre modele se donne raison toute seule.**
Le controle anti-suicide de l'IA (`curvedKingDanger`) simule la trajectoire
avec `simulateWindFlight` — le modele de l'IA, pas Matter, qui fait tourner
le jeu. Toute verification headless de ce controle compare donc le modele a
lui-meme. C'est pour cela qu'abaisser la marge de securite de 60 a 28 px a
exige `ia-roi.mjs` : de vraies parties, avec les vrais rebonds. Le test a
ete eprouve en supprimant la marge — l'IA se suicide alors aux trois
niveaux des la premiere partie.

**Une reduction visuelle n'est pas une reduction.** `setScale` sur une
image Matter redimensionne l'image ET son corps physique. Reduire en plus la
`shape` appliquait donc la reduction deux fois : 9 px de cote au lieu de 18.
C'est pour cela que `kubb-redresse.mjs` lit les `bounds` du corps Matter et
pas l'echelle du sprite — les deux peuvent diverger, et c'est la hitbox qui
decide si le joueur touche.

**Depuis l'ecran de choix du terrain, le menu ne mene plus directement a une
partie.** Les helpers `lancerDepuisLeMenu` / `passerLeChoixDuTerrain` du
socle traversent cette etape. Le second echoue FRANCHEMENT si l'ecran
n'apparait pas : une premiere version renvoyait `false` en silence, et
l'appelant echouait bien plus loin sur « Le salon ne s'est pas ouvert », un
message sans rapport avec la cause.

**Chromium se rattrape la ou iOS ne se rattrape pas.** Le bug d'echelle
apres veille a ete signale sur un vrai iPhone et n'est pas reproductible
ici : au reveil, Chromium re-mesure tout seul. `mise-en-veille.mjs` ne
cherche donc pas a rejouer le scenario d'iOS — il verifie l'INVARIANT
(le canevas doit finir ajuste a son conteneur) dans le cas le plus severe,
**boucle Phaser arretee**, pour qu'aucun mecanisme interne ne puisse
masquer un filet absent. Sans le correctif, c'est la seule assertion qui
tombe : les autres passent parce que Chromium s'en sort seul.

**Un defaut de mise en page peut n'exister qu'une fois le jeu avance.**
Les 11 terrains debordaient de leur cadre et se faisaient couper — mais sur
un profil neuf, un seul terrain est possede, et tout tient. Les
verifications qui partent d'un profil vierge ne voyaient rien.
`menu-reglages.mjs` ecrit donc d'abord `kubb-kings.shop.owned` avec tous les
articles, puis recharge : c'est la seule facon de regarder le menu tel que
le voit un joueur qui a joue.

**Un code HTTP 200 ne prouve pas qu'une page existe.** `vite preview`, comme
tout serveur a repli SPA, renvoie `index.html` avec un 200 pour une URL
inconnue. La verification des liens legaux controlait le statut : elle
declarait valides des liens casses. Elle controle desormais le `<h1>`
reellement servi. Trouve en cassant un lien expres — un controle qu'on n'a
jamais vu echouer ne vaut rien.

## Transport local ou Supabase ?

Sans `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, le jeu retombe sur le
transport local (deux onglets du meme navigateur), qui suffit a tout ce qui est
verifie ici. Avec ces variables, les memes verifications passent par Supabase —
utile pour eprouver la vraie liaison, a condition que le reseau soit joignable.
