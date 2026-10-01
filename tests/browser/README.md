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
| `KUBB_LEGAL_URL` | racine des pages legales (`pages-legales.mjs`) | `legal` deduit de `KUBB_URL` |
| `CHROMIUM_PATH` | binaire Chromium a piloter | celui de l'atelier |

Le paquet installe est `playwright-core` : il ne telecharge aucun navigateur,
c'est `CHROMIUM_PATH` qui en designe un.

## Ce que couvre chaque fichier

| Fichier | Couvre |
| --- | --- |
| `pages-legales.mjs` | Les trois pages legales et l'ecran in-app : rendu reel, liens croises, **aucun debordement a 390 px**, et la divulgation du mode en ligne presente **dans les deux formes**. Ne lance aucune partie : quelques secondes |
| `menu-reglages.mjs` | La mise en page des groupes de choix du menu, **tout contenu debloque** : rien ne deborde, aucun libelle tronque, cibles tactiles >= 44 px — a 5 largeurs d'ecran et dans les deux langues. Ne lance aucune partie |
| `mise-en-veille.mjs` | Le canevas revient a la bonne echelle apres une mise en veille, un changement d'orientation ou un conteneur qui bouge **pendant que la boucle Phaser est gelee**. Signale sur un vrai iPhone : apres verrouillage/deverrouillage, le jeu se retrouvait dans un petit rectangle centre |
| `tir-d-ouverture.mjs` | Le tirage au sort ne designe que le premier joueur : kubbs ni affiches ni presents dans le monde physique, un lancer a pleine puissance n'abat rien, puis retour a la normale. **Seule verification en mode LOCAL** |
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
