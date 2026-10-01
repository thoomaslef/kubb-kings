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
| `CHROMIUM_PATH` | binaire Chromium a piloter | celui de l'atelier |

Le paquet installe est `playwright-core` : il ne telecharge aucun navigateur,
c'est `CHROMIUM_PATH` qui en designe un.

## Ce que couvre chaque fichier

| Fichier | Couvre |
| --- | --- |
| `tir-d-ouverture.mjs` | Le tirage au sort ne designe que le premier joueur : kubbs ni affiches ni presents dans le monde physique, un lancer a pleine puissance n'abat rien, puis retour a la normale. **Seule verification en mode LOCAL** |
| `partie-en-ligne.mjs` | Poignee de main, decor impose par l'hote, tour verrouille, propagation d'un lancer, **coup decisif** (celui qui, longtemps, ne partait pas) |
| `coupure-et-reprise.mjs` | Rechargement puis reprise a l'identique, partie qui continue apres, **coupure silencieuse** detectee et annoncee |
| `revanche-et-succes.mjs` | Revanche a deux accords, nouvelles conditions, compteur remis a zero, et les trois succes en ligne dont « Invaincu » qui traverse trois parties et la persistance |

## Deux pieges appris a la dure

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

## Transport local ou Supabase ?

Sans `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, le jeu retombe sur le
transport local (deux onglets du meme navigateur), qui suffit a tout ce qui est
verifie ici. Avec ces variables, les memes verifications passent par Supabase —
utile pour eprouver la vraie liaison, a condition que le reseau soit joignable.
