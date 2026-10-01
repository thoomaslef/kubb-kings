# Le jeu en ligne

Du protocole au transport reel : comment deux joueurs partagent une partie
alors que la physique n'est pas reproductible d'un appareil a l'autre.

> Fait partie de la documentation de **KUBB: Kings** — [retour au sommaire](../README.md).

---

## Preparation du jeu en ligne

Rien de reseau n&apos;existe encore : cette section documente la **premiere brique**,
posee en amont parce qu&apos;elle est necessaire quelle que soit la suite et
qu&apos;elle ne coute rien.

**`profileTeam` : « mon camp » au lieu de « Bleue ».** Le jeu supposait partout que le
joueur de l&apos;appareil tenait Bleue — 34 occurrences de `'blue'` en dur dans
`MatchScene`, plus l&apos;ecran de resultat. C&apos;est vrai en solo, en Defi et en
local (un seul profil sur l&apos;appareil), mais faux en ligne des que l&apos;invite
tient Rouge. Un seul reglage porte desormais cette information
(`profileTeam` dans le store, relu par `MatchScene.create()` et par
`ResultScreen`), et tout le reste passe par `isProfileTeam(team)` :

| Ce qui suit le profil | Ce qui reste en dur (et doit le rester) |
| --- | --- |
| Succes, XP, pieces, bonus de run | Construction des deux equipes et de leurs sprites |
| « Ai-je gagne ? », titre et libelles de l&apos;ecran de fin | Bleue ouvre le tir d&apos;ouverture |
| Cible la plus eloignee, compteurs de manche | Comparaisons symetriques (departage, points) |
| Kubb adverse abattu par « Renfort » | Noms des slots Bleu/Rouge de l&apos;arbre de tournoi |

Un defaut latent a ete trouve au passage, exactement grace a ce basculement :
`ResultScreen::headline` deduisait la defaite de `result.winner === AI_TEAM`,
c&apos;est-a-dire « l&apos;adversaire est forcement Rouge ». Correct contre l&apos;IA,
faux des qu&apos;on tient Rouge — le titre s&apos;affichait alors **inverse**. Les
libelles « Vous »/« IA » du tableau de fin avaient le meme biais.

**Comportement inchange aujourd&apos;hui** : `profileTeam` vaut `'blue'` partout, donc
tous les modes existants se comportent a l&apos;identique — verifie en rejouant
l&apos;integralite de la verification des 15 succes (zero regression). La preuve que
l&apos;abstraction tient vient du test inverse : en basculant le store sur Rouge, les
memes succes tombent, le meme XP et les memes pieces sont credites, le meme titre
s&apos;affiche — et rien n&apos;est credite quand c&apos;est l&apos;adversaire qui gagne.

### Protocole d&apos;un coup et enregistrement rejouable

[`src/game/online/protocol.ts`](../src/game/online/protocol.ts), module **pur** (ni
Phaser ni store, comme `ai.ts` ou `rules.ts`) : il doit pouvoir etre lu par un futur
serveur Node aussi bien que par le navigateur.

**Un coup = des entrees + un resultat.** La physique n&apos;est pas reproductible d&apos;un
appareil a l&apos;autre — le pas Matter suit le delta de frame (`matterConfig.ts`, aucun
pas fixe), donc deux telephones a 60 et 120 Hz ne calculent pas la meme trajectoire.
Rejouer seulement les entrees ferait diverger les deux parties. **Le lanceur fait donc
autorite** : il transmet ses entrees ET l&apos;etat du terrain apres son lancer
(`MatchSnapshot`). L&apos;adversaire rejoue les entrees pour l&apos;animation, puis se
cale sur l&apos;instantane — une divergence ne coute qu&apos;une fraction de seconde
d&apos;animation, jamais l&apos;etat de la partie.

| Element | Contenu | Pourquoi |
| --- | --- | --- |
| `MatchSetup` | terrain, vent, regle Kubbs de champ, projectile de chaque camp | Tire par l&apos;hote : le vent notamment est aleatoire a chaque partie, sans lui chacun jouerait sur un terrain different |
| `ThrowInput` | `throwX`, angle, puissance, projectile, **tirage aleatoire** | Sans le tirage transmis, l&apos;adversaire verrait un baton partir droit sur une cible que l&apos;instantane declare manquee |
| `MatchSnapshot` | statut des 10 kubbs, roi, lancers restants, a qui de jouer, phase | Minimal : les positions se deduisent (un kubb de champ va toujours au meme emplacement), un kubb `'out'` n&apos;est plus que du decor |
| `MatchRecord` | le setup + la suite des lancers numerotes | Une partie entiere, rejouable sans rien connaitre de l&apos;appareil qui l&apos;a produite |

`Baton.launch` **renvoie** desormais le tirage applique (deviation + sens de rotation) et
accepte qu&apos;on le lui impose : c&apos;est ce qui permet a l&apos;adversaire de rejouer
exactement le meme lancer. `MatchScene` archive chaque lancer dans **tous les modes**, pas
seulement en ligne — c&apos;est la meme trace qui servira a faire valider un classement
par un serveur, sans changer le protocole.

Le choix est volontairement naif face a la triche : un joueur peut mentir sur son
resultat. Sans consequence entre amis, et c&apos;est precisement pourquoi la partie
entiere est enregistree.

**Verifie en navigateur** : trois vrais lancers (physique Matter reelle, terrain Chicane,
vent actif, Kubbs de champ actives, projectile Nordique) produisent un enregistrement a
numerotation continue, entrees et resultats complets, les deux camps representes ; le
`MatchSetup` archive correspond bien au vent reellement tire ; le tirage aleatoire est
rejouable a l&apos;identique quand on l&apos;impose ; et **rejouer l&apos;enregistrement
sur un terrain neuf reconstitue exactement le meme etat** (statuts des dix kubbs, roi,
lancers restants, tour courant, phase). Zero erreur console.

### Transport et session

Deux modules, toujours sans la moindre infrastructure :

- [`transport.ts`](../src/game/online/transport.ts) — **le tuyau, et rien d&apos;autre**.
  Tout le mode en ligne est ecrit contre cette interface (`send` / `onMessage` /
  `close`), jamais contre un prestataire. Contraintes volontaires pour qu&apos;un vrai
  service puisse s&apos;y conformer : messages serialisables en JSON, aucun ordre
  suppose (le numero de coup s&apos;en charge), aucune notion de reconnexion a ce
  niveau.
- [`localTransport.ts`](../src/game/online/localTransport.ts) — **faux transport** :
  deux onglets du meme navigateur se parlent par `BroadcastChannel`. Ce n&apos;est pas
  un bouche-trou : c&apos;est ce qui permet de construire ET de verifier tout le jeu
  en ligne a cout nul, et de continuer a le tester plus tard sans dependre d&apos;un
  service tiers. Limite assumee : ca ne franchit pas la machine.
- [`session.ts`](../src/game/online/session.ts) — la partie a deux : poignee de main,
  qui tient quel camp, verification du numero de coup. Ne connait ni Phaser, ni le
  store, ni l&apos;interface.

L&apos;hote tient Bleue, l&apos;invite Rouge — regle transmise explicitement dans le
message d&apos;accueil (`guestTeam`) plutot que deduite de chaque cote, pour
qu&apos;elle n&apos;existe qu&apos;a un seul endroit et puisse changer (tirage au sort,
alternance) sans toucher l&apos;invite.

Les lancers des deux joueurs forment **une seule suite numerotee** : un coup envoye
comme un coup recu font avancer le meme compteur. D&apos;ou trois cas distincts, et
trois reactions differentes :

| Cas | Reaction | Pourquoi |
| --- | --- | --- |
| Numero attendu | applique | — |
| Numero deja vu | **ignore** | Un message rejoue est benin |
| Numero trop grand | **arret franc** (`desynchronise`) | Un coup manque : continuer donnerait deux parties differentes |

**Verifie avec deux vrais onglets** (Playwright, meme contexte navigateur) : poignee
de main et repartition des camps, transmission integrale du `MatchSetup`, echange de
deux coups dans les deux sens, doublon ignore sans casser la session, coup manquant
detecte et session fermee, depart volontaire vu comme « parti » d&apos;un cote et
« quitte » de l&apos;autre, et message d&apos;accueil d&apos;une version de protocole
future refuse. Zero erreur console.

Ces modules n&apos;ont d&apos;abord ete que des fondations ; ils sont desormais branches
au jeu (section suivante).

### Une partie en ligne, de bout en bout

Le mode `'online'` est jouable : **Menu -> En ligne**, on cree une partie (code a 4
lettres) ou l&apos;on rejoint avec le code. L&apos;hote tient Bleue, l&apos;invite
Rouge.

- **L&apos;hote impose les conditions** (terrain, vent, Kubbs de champ) : les tirer de
  chaque cote donnerait deux parties differentes.
- **Chacun garde son projectile.** Le baton n&apos;est pas cosmetique — il change la
  vitesse, la deviation et la forme du corps — et le forcer priverait un joueur de
  l&apos;objet qu&apos;il a achete avec ses pieces. L&apos;hote inscrit le sien dans les
  conditions ; l&apos;invite annonce le sien **en se presentant** (`join`), et l&apos;hote
  l&apos;y ajoute avant de renvoyer l&apos;accueil. Aucun aller-retour de plus : le
  choix voyage avec le message qui existait deja. Le projectile entre alors dans les
  conditions et y RESTE, pour qu&apos;un joueur qui revient apres une coupure retrouve
  la partie telle qu&apos;elle etait plutot que d&apos;en renegocier une.
- **On ne joue que son tour.** La phase ne suffit pas a le savoir : apres notre lancer
  la scene repasse en `'aiming'` alors que c&apos;est a l&apos;adversaire. D&apos;ou
  `canAimNow()` cote scene, et un bandeau « L&apos;adversaire joue... » cote HUD.
- **Un coup distant est rejoue puis corrige** : `playRemoteThrow` relance le meme
  baton (memes angle, puissance, projectile, meme tirage aleatoire) pour l&apos;animation,
  et `endRemoteThrow` se cale ensuite sur l&apos;instantane transmis. Aucune resolution
  locale du tour : les lancers restants, le tour et les chutes sont ceux de
  l&apos;adversaire.

Deux pieges corriges, tous deux trouves par la verification et invisibles a la lecture :

1. **Le coup decisif ne partait pas.** Quand un lancer termine la partie, `finish()`
   met la phase a `'over'` et `update()` sort aussitot — `endThrow()` n&apos;est donc
   jamais atteint, et le coup n&apos;etait pas transmis : l&apos;adversaire attendait
   indefiniment. `finish()` archive et envoie desormais lui-meme ce dernier coup.
2. **La physique locale concluait a la place du resultat transmis.** Pendant le rejeu
   d&apos;un coup adverse, un roi touche a l&apos;animation appelait `finish()` avec le
   verdict LOCAL. `finish()` ignore maintenant ces appels tant qu&apos;un coup distant
   est en cours : seul le resultat joint au coup fait foi.

> **Simplification assumee : pas de tir d&apos;ouverture en ligne.** Son arbitrage a
> besoin des DEUX mesures avant de trancher — c&apos;est un etat reparti, avec rejeu
> quand les deux joueurs touchent le roi, donc toute une classe de desynchronisations
> pour un mecanisme qui ne fait que designer le premier joueur. L&apos;hote tire au
> sort (`MatchSetup.startingTeam`). A reprendre si l&apos;on veut l&apos;ouverture
> fidele en ligne.

**Verifie avec deux vrais onglets jouant l&apos;un contre l&apos;autre**, par
l&apos;interface (creer, partager le code, rejoindre) et avec la physique Matter
reelle : les deux arrivent en match avec le meme decor et le meme premier joueur ;
celui qui n&apos;a pas la main ne peut pas viser et voit le bandeau ; deux lancers
successifs se propagent dans les deux sens avec **etat identique de part et
d&apos;autre** (statuts des dix kubbs, lancers restants, tour) ; et un roi touche trop
tot termine la partie **des deux cotes avec le meme resultat**. Zero erreur console.

> **Note d&apos;outillage.** Deux jeux Phaser dans un meme navigateur headless
> ralentissent le temps de JEU bien plus que le facteur ~4 d&apos;une seule page : un
> vol de 3 s de jeu peut demander une minute de temps reel. Toute la verification
> attend donc des ETATS (`record.throws.length`, `screen === 'result'`), jamais un
> delai.

> **Observation, non corrigee.** La trace a revele qu&apos;un kubb peut etre abattu
> pendant le **tir d&apos;ouverture** : la branche « kubb » de `onCollisionStart` n&apos;a
> aucune garde sur `matchStage`, seul le roi y est traite a part. C&apos;est anterieur au
> chantier en ligne et c&apos;est une question de regle (au vrai Kubb, le tirage au sort
> ne fait que designer qui commence) — a trancher, pas a corriger en passant.

> **Note d&apos;outillage.** Chromium headless fait tourner la boucle de rendu a
> environ un quart de la vitesse reelle : un `delayedCall` de 750 ms de temps de jeu
> demande ~3 s d&apos;attente reelle. Les verifications doivent donc **attendre un
> etat** (`screen === 'result'`), jamais un delai en temps reel — sinon elles
> concluent a tort qu&apos;une transition ne se produit pas.

### Quand la liaison lache

Avec le faux transport local, une coupure n&apos;existe pas : les deux onglets vivent
ou meurent ensemble. **Sur un vrai reseau, une coupure est silencieuse** — pas de
message d&apos;adieu, juste plus rien. Ces deux defauts-la ne se voient donc jamais
tant qu&apos;on ne les traite pas expres, et ils sont exactement « ce qui doit etre
pret avant d&apos;investir » : leur correction ne coute rien.

**1. Battement de coeur.** Chaque camp envoie un `ping` toutes les 3 s. Sans le
moindre signe de vie pendant `CONNECTION_TIMEOUT_MS` (10 s), la session se ferme
avec la raison `perdu`. Sans cela, le joueur reste devant un plateau fige a
attendre un tour qui ne viendra jamais.

**2. Reprise apres coupure.** Un joueur qui recharge sa page perd tout. En
rejoignant **le meme code**, il est re-accueilli et l&apos;hote lui renvoie la
partie entiere (`resync` + le `MatchRecord` complet) ; `MatchScene::replayRecord`
adopte cet enregistrement et rejoue chaque instantane — c&apos;est precisement le
but pour lequel l&apos;enregistrement rejouable existait deja. La numerotation des
coups reprend a la bonne valeur des deux cotes, donc la partie continue au lieu de
se desynchroniser au coup suivant.

> **Piege de synchronisation, corrige.** L&apos;hote renvoie la partie dans la
> foulee de l&apos;accueil, alors que la scene du revenant ne demarre qu&apos;a la
> frame suivante : le message arrivait dans le vide et le joueur reprenait sur un
> plateau vierge. La session **retient** donc un `resync` recu sans auditeur et le
> sert au premier abonne.

**3. Depart explicite.** Quitter un match en ligne envoie desormais `leave` :
sinon l&apos;adversaire patientait jusqu&apos;a l&apos;expiration du battement pour
apprendre un depart pourtant volontaire.

**4. On dit pourquoi.** Une partie qui s&apos;arrete seule ramenait au menu sans un
mot — le joueur ne pouvait que deviner. Le menu affiche maintenant « Partie
interrompue » et la raison (adversaire parti, liaison perdue, coup manquant,
versions incompatibles). Rien n&apos;est affiche apres une fin normale ni apres son
propre depart : on n&apos;annonce que ce que le joueur ne sait pas deja.

Au passage, l&apos;ecran de resultat en ligne se lit du point de vue du joueur
(« Victoire » et non « Bleue gagne »), et **« Rejouer » y disparait** : relancer la
scene de son seul cote laisserait l&apos;adversaire sur une autre partie. Une
revanche demande un aller-retour, elle viendra avec le reste.

**Verifie avec deux vrais onglets** : deux lancers joues, l&apos;invite **recharge
sa page** (store vide, retour au menu), rejoint avec le meme code et se retrouve
dans l&apos;etat EXACT de l&apos;hote (memes coups enregistres, memes statuts des dix
kubbs, memes lancers restants, meme tour) ; un troisieme lancer passe ensuite
normalement, preuve que la numerotation a bien repris ; puis l&apos;onglet invite est
**ferme sans un mot** et l&apos;hote detecte la coupure en ~12 s, revient au menu et
affiche « Liaison perdue ». Zero erreur console.

> **Limite connue, assumee.** C&apos;est l&apos;hote qui garde la partie : si
> c&apos;est LUI qui recharge, l&apos;enregistrement disparait avec sa page et
> l&apos;invite recoit `perdu`. Une reprise des deux cotes suppose que la partie soit
> gardee ailleurs que dans un onglet — c&apos;est le travail d&apos;un vrai serveur,
> pas du faux transport local.

### La revanche

Une partie finie, les deux joueurs sont sur l&apos;ecran de resultat. « Rejouer » y
etait absent : relancer la scene de son seul cote laisserait l&apos;adversaire sur
une autre partie. Une revanche demande donc **l&apos;accord des deux**.

- Chacun **demande** (`rematch`) ; rien ne part tant que les deux ne l&apos;ont pas
  fait. Celui qui a demande voit « en attente de l&apos;adversaire », celui qui recoit
  voit son bouton devenir « Accepter la revanche ».
- L&apos;hote arbitre et tire les **nouvelles conditions** (`rematch-start`), comme
  pour la partie initiale — un tirage de chaque cote donnerait deux parties
  differentes. Meme terrain et memes projectiles, mais **vent et premier joueur
  redistribues** : sans cela, celui que le tirage avait favorise le resterait.
- La suite des coups **repart de zero** des deux cotes, sans quoi le premier lancer
  de la revanche passerait pour un doublon (cf. `checkSeq`).

Deux pieges, tous deux lies a l&apos;endroit ou la partie « vit » entre deux manches :

1. **La scene de match est morte pendant l&apos;ecran de fin**, et avait rendu ses
   abonnements. Sans les reprendre, aucune revanche n&apos;etait possible et un
   adversaire qui partait a ce moment-la n&apos;etait jamais signale. C&apos;est
   desormais `ResultScene` qui tient ces abonnements — elle est la seule chose
   vivante entre deux parties. Au passage, **quitter depuis l&apos;ecran de fin
   previent maintenant l&apos;adversaire** : sans ce mot d&apos;adieu il attendait une
   revanche qui ne viendrait jamais.
2. **Une demande pouvait arriver trop tot.** Le perdant atteint l&apos;ecran de fin
   une fraction de seconde apres le gagnant ; si celui-ci demande aussitot, le
   message arrive alors que la scene de match tourne encore en face, et
   l&apos;annonce part dans le vide. La session garde donc l&apos;ETAT de la demande, et
   l&apos;ecran de fin le LIT a son ouverture au lieu de compter sur un evenement
   qu&apos;il n&apos;etait peut-etre pas la pour entendre.

**Verifie avec deux onglets** : une partie menee jusqu&apos;au roi, puis une seule
demande qui ne relance rien (les deux restent sur l&apos;ecran de fin), le demandeur
en attente et l&apos;adversaire prevenu a l&apos;ecran ; l&apos;accord du second relance
**des deux cotes** avec un plateau neuf, un compteur de coups a zero, des conditions
identiques et un premier joueur redistribue ; et la revanche se joue vraiment — un
lancer traverse et laisse les deux terrains identiques.

> **Note d&apos;outillage, et correction.** J&apos;attribuais la lenteur des essais a
> deux jeux Phaser dans un meme navigateur. La cause principale est ailleurs :
> **Chromium ralentit tres fortement une page qui n&apos;est pas au premier plan**.
> Un `delayedCall` de 750 ms de temps de jeu pouvait ainsi ne jamais sembler
> arriver. Les drapeaux `--disable-background-timer-throttling` et consorts n&apos;y
> suffisent pas ; seul un `bringToFront()` sur la page qu&apos;on attend la rend
> pleinement vive. Les essais a deux onglets le font donc avant chaque attente.

### Deux appareils differents : Supabase Realtime

[`supabaseTransport.ts`](../src/game/online/supabaseTransport.ts) est le premier vrai
transport : deux joueurs sur deux appareils, par les canaux « broadcast » de
Supabase Realtime.

**Pourquoi Supabase**, alors que Cloudflare Durable Objects faisait aussi bien
l&apos;affaire ? Pas pour le reseau : le debit du jeu est minuscule (un message par
lancer, plus un battement toutes les 3 s), soit ~400 messages pour une partie de
10 min — les 2 M mensuels du palier gratuit autorisent environ **5 000 parties par
mois**, et la latence est invisible dans un jeu au tour par tour ou le lanceur fait
autorite. Ce qui a tranche, c&apos;est la SUITE : classement, chat et page de profil
demandent une base de donnees et de l&apos;authentification, que Supabase apporte
dans le meme compte. Accessoirement, son mode broadcast ne demande **aucun code
serveur** : le deploiement reste un simple site statique sur GitHub Pages.

| | Transport local | Supabase |
| --- | --- | --- |
| Portee | deux onglets du meme navigateur | deux appareils quelconques |
| Compte / serveur | aucun | un projet Supabase, zero code serveur |
| Abonnement | immediat | **asynchrone** (voir ci-dessous) |
| Role aujourd&apos;hui | developper et verifier hors ligne | jouer pour de vrai |

Le choix se fait dans [`transportFactory.ts`](../src/game/online/transportFactory.ts) :
Supabase des qu&apos;il est configure, sinon le transport local. Celui-ci n&apos;est
pas un lot de consolation — il fait tourner tout le mode en ligne sans reseau ni
compte, ce qui reste le moyen le plus rapide de verifier le jeu.

**La difficulte reelle n&apos;etait pas le reseau, c&apos;etait le temps.**
`BroadcastChannel` est utilisable des sa creation ; un canal Supabase ne l&apos;est
qu&apos;apres un aller-retour. Or `OnlineSession.join()` envoie son `join` **des sa
construction** — donc systematiquement trop tot. Sans precaution, le tout premier
message, celui qui declenche la partie, partait dans le vide et le salon attendait
pour toujours. Le transport garde donc une **file d&apos;attente** et la vide des
que le canal est abonne. C&apos;est la seule chose que ce fichier ajoute a la
logique du jeu, et elle est entierement due a la nature du tuyau — exactement ce
que l&apos;interface `Transport` est censee absorber.

**Le SDK est charge a la demande** (`import()` dynamique) : un joueur qui ne touche
jamais au mode en ligne ne telecharge pas une ligne de Supabase. Mesure : le bundle
principal passe de 81,4 a **81,9 ko gzip** (+0,5), et le SDK forme un morceau
separe de **58,9 ko gzip** charge seulement a l&apos;entree du salon.

**Configuration** — deux variables lues *a la compilation* (cf.
[`.env.example`](../.env.example)) :

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

La cle attendue est celle destinee au navigateur : l&apos;ancienne `anon` ou la
nouvelle cle « publishable » (`sb_publishable_...`) qui la remplace — les deux vont
au meme endroit, le SDK ne fait pas la difference.

En local, un fichier `.env` (ignore par git). En production, deux **variables** du
depot GitHub (`Settings -> Secrets and variables -> Actions`, onglet *Variables*),
injectees par le workflow de deploiement — des variables plutot que des secrets
parce que ces valeurs ne sont pas sensibles et qu&apos;une variable reste relisible :
une faute de frappe dans un secret, en ecriture seule, ne se voit jamais. Le
workflow accepte les secrets en repli, pour que l&apos;onglet choisi n&apos;ait pas
d&apos;importance. Ces valeurs sont **publiques par
conception** : Vite les inscrit dans le bundle livre, n&apos;importe qui peut les y
lire. Ce n&apos;est pas une negligence — cette cle est faite pour vivre cote
navigateur, et ce sont les regles d&apos;acces Supabase (RLS) qui protegeront les
donnees, jamais le secret de la cle. On les garde hors du depot pour pouvoir les
changer sans toucher au code.

> **Ce que « partie privee » veut dire exactement.** Sur un canal PUBLIC —
> l&apos;option par defaut d&apos;un projet Supabase — quiconque possede cette cle
> peut s&apos;abonner a n&apos;importe quel salon dont il devine le code. Un code de
> 4 lettres, c&apos;est environ un million de combinaisons : le seul secret d&apos;une
> partie est donc ce code. C&apos;est suffisant entre amis, et insuffisant le jour ou
> un classement sera en jeu — un intrus pourrait injecter un lancer, le lanceur
> faisant autorite. Le remede existe chez Supabase (canaux prives + autorisation),
> mais il suppose des comptes joueurs : il viendra avec eux, a l&apos;etape
> classement.

> **Consequence a connaitre.** Un deploiement **sans** ces valeurs reussit quand
> meme : le jeu retombe silencieusement sur le transport local. L&apos;interface le
> dit (« deux onglets du MEME navigateur » au lieu de « votre adversaire peut etre
> sur un autre appareil »), mais on ne le decouvrait qu&apos;en jouant. Le workflow
> inspecte donc le bundle produit et **emet un avertissement** quand aucune
> coordonnee Supabase n&apos;y figure.

Une liaison qui n&apos;arrive pas a s&apos;etablir (projet injoignable, cle fausse)
est signalee a l&apos;ecran plutot que laissee en attente indefinie. Une liaison qui
lache APRES coup, elle, est deja couverte par le battement de coeur de la section
precedente : le transport n&apos;a pas eu a s&apos;en occuper.

**Verifie sans compte Supabase**, en remplacant le SDK par un faux qui reproduit ce
qui compte (abonnement asynchrone, pas d&apos;echo a soi-meme, abonnement pouvant
echouer) et en faisant tourner par-dessus la **vraie** `OnlineSession` — qui est
pure, donc testable hors navigateur : un message emis 120 ms avant l&apos;abonnement
arrive quand meme ; un canal ne se renvoie pas ses propres messages ; la poignee de
main donne Bleue a l&apos;hote et Rouge a l&apos;invite avec un `MatchSetup`
identique ; un lancer traverse avec son numero d&apos;ordre ; un depart est vu comme
« parti » ; un abonnement refuse remonte comme une panne ; et apres fermeture plus
rien ne circule.

**Verifie ensuite contre un vrai projet Supabase**, mais partiellement : le
handshake du WebSocket temps reel repond **101 Switching Protocols** avec la cle
publishable, sur l&apos;URL exacte que le client construit. Le projet, la cle et le
point d&apos;entree vises par le code sont donc les bons.

> **Ce qui n&apos;est PAS verifie**, et ne peut pas l&apos;etre depuis l&apos;atelier :
> la partie complete entre deux navigateurs, par Supabase. L&apos;environnement de
> developpement fait transiter le trafic par un proxy qui re-termine le TLS et
> repart en HTTP/2 ; l&apos;upgrade WebSocket y est refuse par Cloudflare (erreur
> 1101). Le MEME handshake force en HTTP/1.1 repond 101 — c&apos;est donc un
> artefact de l&apos;atelier, pas du jeu, et aucun navigateur ordinaire ne passe par
> la. Cette verification-la revient a deux vrais navigateurs.

> **Effet de bord instructif.** Cet echec, lui, etait bien reel : le salon s&apos;est
> ouvert, la connexion a echoue, l&apos;interface a affiche « Service en ligne
> injoignable » et a referme le salon sans rien laisser trainer. Le chemin
> d&apos;erreur a donc ete eprouve sur une vraie panne, pas sur une simulation. Un
> joueur derriere un proxy d&apos;entreprise qui intercepte le TLS verrait
> exactement ce message — ce qui est le bon comportement.

---
