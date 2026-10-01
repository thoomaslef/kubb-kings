# Qualite et verification

Ce qui tient le projet debout : les tests, le rendu, les langues, le partage.

> Fait partie de la documentation de **KUBB: Kings** — [retour au sommaire](../README.md).

---

## Filet de securite

Pendant longtemps, la verification de ce projet etait entierement manuelle :
des scripts jetables, lances a la main, perdus ensuite. Le typecheck passait,
et rien ne voyait une regle inversee. Ce n'est plus le cas.

### `npm test` — les modules purs, en une seconde

Les regles, le bareme d'XP, le protocole reseau et la coherence du contenu
sont ecrits dans des modules **purs** (ni Phaser, ni store, ni DOM). C'etait
deja le cas avant — pour qu'un futur serveur puisse les relire — mais rien ne
s'en servait. Vitest les couvre maintenant : **131 tests, moins d'une seconde**,
lances par la CI avant chaque deploiement.

Une suite y echappe volontairement : `ui/legal.test.ts` ne verifie pas une
fonction mais un **texte**, lu par import `?raw`. Elle est ici parce qu'elle
mord aussi vite que les autres, et parce qu'une phrase fausse dans une page
publique coute plus cher qu'un bug.

Ce qu'ils attrapent, que le compilateur ne voit pas :

| Fichier | Ce qui est verifie |
| --- | --- |
| [`online/protocol.test.ts`](../src/game/online/protocol.test.ts) | `checkSeq` (doublon vs coup manquant), numerotation d'UNE seule suite pour les deux camps, compatibilite de version |
| [`progression.test.ts`](../src/game/progression.test.ts) | Le niveau ne recule jamais, chaque palier coute plus que le precedent, la serie est plafonnee, le total d'XP n'a aucun terme cache, le bonus « Etude rapide » ne double pas les succes |
| [`matchEndAchievements.test.ts`](../src/game/matchEndAchievements.test.ts) | Les huit succes de fin de partie, **chacun avec sa contre-epreuve** : un `if` trop permissif passerait un test qui ne verifie que le declenchement |
| [`contenu.test.ts`](../src/game/contenu.test.ts) | Les tables et les unions restent alignees : chaque succes a sa recompense ET ses traductions, chaque terrain son nom, l'echelle du Defi ses 30 manches sans terrain repete dans un palier, et **le francais et l'anglais couvrent exactement les memes cles, avec les memes parametres `{n}`** |
| [`rules.test.ts`](../src/game/rules.test.ts) | Tout terrain reste **traversable** par tout projectile, avec une marge reelle, et la hierarchie des terrains tient (Boue la plus lourde, Glace et Riviere plus longues que Classique) — ecrit apres que Boue s'etait reglee a une friction qui rendait la ligne adverse inatteignable |
| [`ui/legal.test.ts`](../src/ui/legal.test.ts) | Les textes legaux ne nient plus toute transmission, et divulguent le relais, l'adresse IP, le caractere facultatif du mode en ligne et ce qui transite — **dans les deux formes a la fois** (page publique et ecran in-app) |

Le dernier point mérite d'etre souligne : ajouter du contenu demande de toucher
a quatre ou cinq endroits a la fois (une union de types, une table, deux
dictionnaires, parfois un ecran). Oublier l'un des cinq **compile
parfaitement**. C'est l'erreur la plus facile a commettre ici, et c'est
desormais la mieux couverte.

> **Ces tests ont ete eprouves par mutation**, parce qu'un test incapable
> d'echouer ne vaut rien : inverser `doublon`/`manquant` dans `checkSeq` fait
> tomber 2 tests, supprimer une traduction anglaise en fait tomber 2, dupliquer
> un terrain dans un palier du Defi en fait tomber 1. Le filet mord.
>
> Les deux dernieres suites ont ete eprouvees de la meme facon : remettre la
> friction de Boue a 2.2 fait tomber `rules.test.ts`, et restaurer les anciens
> textes legaux fait tomber **7 tests** de `legal.test.ts` — dans les deux sens
> a la fois (phrases interdites presentes, divulgations absentes).

### `npm run test:browser` — deux joueurs, une vraie partie

Deux verifications de cette suite ne lancent aucune partie. `menu-reglages.mjs`
ouvre le menu **tout contenu debloque** — c'est la seule facon de voir ce que
voit un joueur avance — et verifie qu'aucun groupe de choix ne deborde, qu'aucun
libelle n'est tronque et que chaque pastille garde 44 px de cible tactile, a
cinq largeurs d'ecran et dans les deux langues. Elle a ete ecrite apres coup :
les 11 terrains etaient forces sur une seule ligne, il leur fallait 593 px dans
un cadre de 310, et les cinq derniers etaient coupes au milieu d'un mot. Sur un
profil neuf, un seul terrain est possede : rien ne se voyait.

`pages-legales.mjs`
ouvre les trois pages legales et l'ecran in-app dans un vrai navigateur, en
390 px de large. Elle verifie ce qu'aucune lecture de source ne peut voir —
liens croises qui resolvent, liste reellement stylee, aucun debordement
horizontal, ecran in-app qui defile jusqu'au bout. Elle passe en premier
parce qu'elle prend quelques secondes : echouer tout de suite sur un texte
legal faux vaut mieux qu'apres plusieurs minutes de parties simulees.


Ce qu'aucun module pur ne peut couvrir : la physique Matter reelle,
l'enchainement des scenes Phaser, et **deux joueurs qui s'echangent une
partie**. Ces verifications vivent desormais dans
[`tests/browser/`](../tests/browser/) (elles etaient jetables), avec leur propre
[mode d'emploi](../tests/browser/README.md). Elles prennent plusieurs minutes et
demandent un vrai Chromium : la CI ne les lance pas, on les lance avant de
toucher aux regles ou au mode en ligne.

**Et elles tournent contre le BUILD**, pas contre le serveur de developpement.
La poignee de pilotage (`window.__kubb`) n'existait qu'en `DEV` : tout ce qui
etait verifie l'etait donc sur un code que Vite ne produit pas a
l'identique en production (minification, decoupage, substitution des variables
d'environnement), et un defaut propre au jeu livre serait passe sous tous les
radars. Elle s'active maintenant aussi avec `VITE_EXPOSE_TEST_HANDLE=1` — un
drapeau que le deploiement ne met pas, donc absente du jeu publie (verifie :
le bundle deploye ne contient pas la chaine).

```bash
VITE_EXPOSE_TEST_HANDLE=1 npm run build
npm run preview &
KUBB_URL=http://localhost:4173/kubb-kings/ npm run test:browser
```

**Resultat sur le build de production : 44 controles, zero erreur console** —
partie de bout en bout (dont le coup decisif), rechargement puis reprise a
l'identique, coupure silencieuse detectee et annoncee, revanche a deux accords,
et les trois succes en ligne dont « Invaincu » qui traverse trois parties et la
persistance.

### Le premier remaniement sous filet

`MatchScene` faisait 2 073 lignes — 18 % du code dans un fichier qui melange
physique, regles, tour de l'IA, succes, synchronisation en ligne et HUD. Le
decouper en entier serait un chantier ; en sortir ce qui est une **decision
pure** ne l'est pas.

Les huit succes de FIN de partie y formaient une cascade de `if` au milieu de
la physique — et une cascade se relit mal : « victoire ET au moins un lancer ET
aucun manque » se verifie a l'oeil, ou pas du tout. Ils vivent maintenant dans
[`matchEndAchievements.ts`](../src/game/matchEndAchievements.ts), qui repond a une
seule question a partir d'un bilan, sans rien connaitre de Phaser ni du store.
La scene ne fait plus que tenir les deux etats cumulatifs a jour et afficher
les bandeaux.

Les succes qui se gagnent PENDANT le jeu (double, ricochet, frolement,
nettoyeur...) restent dans la scene : ils dependent d'evenements de collision,
pas d'un bilan.

Ce que ca change concretement : **31 tests la ou il n'y en avait aucun**,
chacun avec sa contre-epreuve. Un adversaire sans carte ne « vaut » plus un
geant ; rallonger le Defi ou ajouter un terrain repousse automatiquement le
succes correspondant, sans toucher a ce code.

> **Et le filet a servi immediatement.** En reecrivant Collectionneur j'avais
> remplace « tous les terrains actuels sont gagnes » par « la liste en compte
> assez » — equivalent aujourd'hui, faux le jour ou un terrain serait retire du
> jeu, la trace laissee par l'ancien faisant croire la collection complete.
> Corrige avant de commiter. Les 44 controles au navigateur, relances sur le
> build apres remaniement, sont restes identiques.

### La montee de Vite, faite sous filet

Le projet est passe de **Vite 5 a Vite 8** (donc de Rollup a Rolldown), avec
`@vitejs/plugin-react` 6 et Vitest 5. C'est exactement le chantier pour lequel
le filet avait ete pose : un outil de build qui change ne casse pas les types,
il change ce qui SORT du build.

Gains mesures : build **de ~10 s a moins de 2 s**, et le gros morceau du jeu de
**1 532 ko a 1 250 ko** (333 ko gzip au lieu de 355).

> **Node 22 devient necessaire** (Vitest 5 exige `^22.12`), d'ou la CI mise a
> jour. Vite 8 s'accommoderait d'une 20.19+, mais la version exacte fournie par
> l'image ne se decide pas depuis le depot.

**Un seul ecart constate, et il ne venait pas de Vite.** Une des trois
verifications au navigateur a echoue une fois : `lancer()` appelait `launch()`
sans verifier que la page etait en etat de lancer, et le coup s'evaporait quand
la scene rejouait encore celui de l'adversaire. Deux relances propres ont
montre que Vite 8 n'y etait pour rien — mais un banc d'essai qui crie au loup
finit par ne plus etre lu, alors `lancer()` attend desormais son tour
explicitement et echoue franchement s'il ne vient jamais. 44 controles verts
ensuite, sur le build Vite 8.

> **Le defaut etait anterieur**, simplement jamais tombe. C'est la rancon d'un
> filet qu'on n'avait pas : on ne sait pas depuis quand on a de la chance.

### Ce qui reste a la main

Deux vrais appareils, sur un vrai reseau mobile, avec de vrais doigts. Aucun
banc d'essai ne remplace ca : ces verifications prouvent que la logique est
juste, pas que le jeu est agreable.

---

## Solidite technique

- **Error boundary** ([`src/ui/ErrorBoundary.tsx`](../src/ui/ErrorBoundary.tsx)) : une erreur de
  rendu React affichait auparavant un ecran blanc/noir figé, sans explication. Elle affiche
  desormais un message et un bouton pour recharger.
- **Journal d&apos;erreurs local** ([`src/game/diagnostics.ts`](../src/game/diagnostics.ts)) :
  capture aussi les erreurs hors React (boucle Phaser, promesses rejetees), en localStorage.
  Le jeu est un site statique sans serveur pour recevoir des rapports a distance — ce journal
  est donc consultable et copiable depuis l&apos;ecran **A propos**, pour un signalement
  manuel plutot qu&apos;un SDK tiers.
- **Chargement en deux temps** ([`src/ui/GameCanvas.tsx`](../src/ui/GameCanvas.tsx)) : Phaser et
  le code du jeu (le plus gros du bundle) sont importes dynamiquement, dans un chunk separe
  du shell React — celui-ci peut donc s&apos;afficher (ecran de chargement) avant que le
  moteur de jeu ne soit telecharge.

---

## Ressenti et rendu

Le jeu et son habillage sont separes, et chacun a son fichier de reglage :

| Fichier                                    | Ce qu&apos;on y regle                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| [`src/game/rules.ts`](../src/game/rules.ts)   | Seuil d&apos;impact, deviation, vitesse max, duree, lancers, terrain, hitboxes, vent |
| [`src/game/theme.ts`](../src/game/theme.ts)   | Palette, ombres portees, cadre du terrain, skins de blocs                    |
| [`src/game/juice.ts`](../src/game/juice.ts)   | Intensite des secousses, du ralenti, de la trainee, des vibrations           |

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

**Musique d&apos;ambiance generative** ([`src/game/audio.ts`](../src/game/audio.ts),
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

## Localisation (i18n)

Francais et anglais, choix persiste (`localStorage`), detecte a la premiere visite depuis la
langue du navigateur ([`src/i18n/`](../src/i18n)) :

- `dictionaries.ts` : toutes les chaines affichees au joueur, cles a plat namespacees par
  ecran (`menu.*`, `hud.*`&hellip;) ou par donnee (`difficulty.*`, `terrain.*`, `skin.*`,
  `team.*`, `perk.*` — anciens libelles deplaces ici depuis `ai.ts` / `rules.ts` /
  `theme.ts` / `teamData.ts` / `roguelite.ts`, qui ne gardent que les donnees
  fonctionnelles).
- `translate(lang, key, params?)` : fonction pure, utilisable aussi bien dans un composant
  React que dans `MatchScene.ts` (bandeaux de tour et textes flottants, dessines directement
  sur le canevas Phaser, hors de tout rendu React).
- `useT()` : le hook React equivalent, reactif a un changement de langue.

Les pages legales ([`public/legal/`](../public/legal), [`src/ui/Legal.tsx`](../src/ui/Legal.tsx))
restent volontairement en francais uniquement : droit francais applicable, identite reelle
de l&apos;editeur — pas un choix a faire dependre de la langue d&apos;affichage du jeu.

---

## SEO et partage

[`index.html`](../index.html) n&apos;avait qu&apos;un `<title>` : un lien partage sur les
reseaux n&apos;affichait ni image ni description. Ajoutes : description, balises Open
Graph et Twitter Card (URL absolues vers le domaine de production, comme l&apos;exige Open
Graph — Vite ne les reecrit pas comme il le fait pour le manifest/favicon), URL
canonique. [`public/robots.txt`](../public/robots.txt) et
[`public/sitemap.xml`](../public/sitemap.xml) excluent `/legal/` (deja `noindex`
individuellement) du referencement.

### Partage du resultat

Bouton **Partager le resultat** sur l&apos;ecran de fin de match
([`src/ui/ResultScreen.tsx`](../src/ui/ResultScreen.tsx)) : genere une image (carte
1080&times;1350, [`src/game/shareCard.ts`](../src/game/shareCard.ts)) avec le titre du
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
