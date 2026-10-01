# KUBB: Kings — MVP

Jeu mobile HTML5 inspire du [Kubb](https://fr.wikipedia.org/wiki/Kubb), le jeu de plein air
suedois : deux equipes se lancent des batons pour abattre les blocs adverses, puis le roi.

Six modes : **solo contre l'IA** (trois niveaux), **1v1 local**, **2v2 local**
(pass-and-play sur le meme telephone), **Defi** (un roguelite en 30 manches contre l'IA),
**Tournoi local** (elimination directe a 4 ou 8, toujours en pass-and-play) et
**en ligne** (partie privee a deux, par code). Onze terrains, un vent optionnel, quatre
skins de blocs, une partie de 4 minutes maximum.

---

## Documentation

Ce fichier ne garde que l&apos;essentiel pour demarrer. Le reste est range par
sujet — chaque page se lit seule.

| Page | Ce qu&apos;on y trouve |
| --- | --- |
| [Regles du jeu](docs/regles-du-jeu.md) | Ce que le jeu fait respecter : regles de base, tir d&apos;ouverture, kubbs de champ, vent, tutoriel, tournoi local |
| [Contenu et boutique](docs/contenu-et-boutique.md) | Les 11 terrains, les projectiles, les apparences, les pieces et le deverrouillage par niveau |
| [Progression, succes et mode Defi](docs/progression-et-succes.md) | Combo, XP et niveaux, les 18 succes, le roguelite en 30 manches |
| [L&apos;adversaire solo](docs/adversaire-solo.md) | Comment l&apos;IA vise, et ce que son calibrage a appris |
| [Le jeu en ligne](docs/jeu-en-ligne.md) | Protocole, transport, reprise apres coupure, revanche — et pourquoi le lanceur fait autorite |
| [Qualite et verification](docs/qualite-et-verification.md) | Le filet de securite (tests et verifications navigateur), le rendu, les langues, le partage |
| [Verifications au navigateur](tests/browser/README.md) | Comment les lancer, et les pieges appris a la dure |

---

## Lancer le jeu en local

```bash
cd kubb-kings
npm install
npm run dev
```

Puis ouvrir **http://localhost:5174/**.

Le jeu est concu pour un **viewport mobile portrait** (teste en 375x667). Dans Chrome :
`F12` &rarr; icone "Toggle device toolbar" (`Ctrl+Shift+M`) &rarr; iPhone SE.

Le serveur ecoute aussi sur le reseau local (`host: true`) : l&apos;adresse `Network:`
affichee par Vite permet de tester directement depuis un vrai telephone.

Autres commandes :

| Commande            | Effet                                        |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Serveur de dev avec hot reload                |
| `npm run build`     | Verification TypeScript + build de production |
| `npm run preview`   | Sert le build de production                   |
| `npm run typecheck` | Verification TypeScript seule                 |
| `npm test`          | Tests unitaires (modules purs, &lt; 1 s)         |
| `npm run test:watch`| Les memes, en continu                         |
| `npm run test:browser` | Verifications au navigateur (lentes, cf. [mode d&apos;emploi](tests/browser/README.md)) |
| `npm run icons`     | Regenere les icones PWA (`public/*.png`)      |

> `npm run preview` sert le build sous `/kubb-kings/`, comme GitHub Pages :
> l&apos;URL locale est donc **http://localhost:4173/kubb-kings/**.

---

## Jouer depuis un telephone

Le jeu est deploye sur **GitHub Pages** a chaque push sur `main`, par
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) :

**https://thoomaslef.github.io/kubb-kings/**

> **A faire une seule fois** dans le depot : *Settings &rarr; Pages &rarr;
> Build and deployment &rarr; Source* : **GitHub Actions**. Sans ce reglage le
> workflow s&apos;execute mais la publication echoue.

### Installable et hors ligne

- **Manifest** ([`public/manifest.webmanifest`](public/manifest.webmanifest)) :
  « Ajouter a l&apos;ecran d&apos;accueil » installe le jeu en **plein ecran**,
  portrait, sans barre d&apos;adresse.
- **Service worker** ([`public/sw.js`](public/sw.js)) : une fois la page ouverte
  une premiere fois, le jeu se relance **sans reseau**.
  - `index.html` : reseau d&apos;abord, cache en secours &rarr; un nouveau
    deploiement est pris en compte des la premiere ouverture en ligne.
  - Assets : cache d&apos;abord &rarr; leurs noms sont hashes par Vite, donc
    immuables. Le worker les decouvre en lisant le HTML, ce qui evite une etape
    de build supplementaire.
- **Icones** : generees par [`scripts/make-icons.mjs`](scripts/make-icons.mjs),
  un rasteriseur PNG sans aucune dependance. Les PNG sont commites (un manifest
  ne peut pas pointer vers du code) mais restent reproductibles.

Le `base` de Vite est `/kubb-kings/` au build et en preview, `/` en dev.

---

## Stack

| Brique         | Role                                                          |
| -------------- | ------------------------------------------------------------- |
| **Phaser 3**   | Rendu, boucle de jeu, entrees tactiles                        |
| **Matter.js**  | Physique (via Phaser), sans gravite : vue de dessus           |
| **TypeScript** | `strict: true`                                                 |
| **Vite**       | Bundler / dev server                                           |
| **React 18**   | Ecrans hors-jeu uniquement (menu, regles, HUD, resultat)      |
| **Zustand**    | Etat global partage entre Phaser et React                     |

Aucun asset externe : toutes les textures, **tous les sons** et **jusqu&apos;aux icones
de l&apos;application** sont generes par code (`BootScene` pour les textures, WebAudio
pour l&apos;audio, `scripts/make-icons.mjs` pour les icones).

---

## Structure

```
kubb-kings/
├── src/
│   ├── game/
│   │   ├── scenes/     BootScene, MenuScene, MatchScene, ResultScene
│   │   ├── entities/   Baton, Kubb, King, Obstacle, Team
│   │   ├── physics/    matterConfig.ts (gravite, restitution, frottements)
│   │   ├── config.ts   config Phaser
│   │   ├── rules.ts    regles, equilibrage, geometrie du terrain et hitboxes
│   │   ├── theme.ts    palette et constantes de rendu (pendant visuel de rules.ts)
│   │   ├── ai.ts       adversaire solo (module pur, simulable hors navigateur)
│   │   ├── juice.ts    feedback : particules, secousses, vibration, ralenti
│   │   ├── audio.ts    sons synthetises par code (WebAudio)
│   │   ├── tutorial.ts persistance du tutoriel (localStorage, cf. Tutorial.tsx)
│   │   ├── roguelite.ts mode Defi : echelle de manches, bonus, meilleure serie
│   │   ├── tournament.ts tournoi local : arbre a elimination directe (module pur)
│   │   ├── achievements.ts + matchEndAchievements.ts  succes (le second est pur)
│   │   ├── online/     protocole, transport (local et Supabase), session de partie
│   │   ├── diagnostics.ts journal d'erreurs local (localStorage, cf. About.tsx)
│   │   ├── bootGame.ts import dynamique de Phaser (cf. GameCanvas.tsx)
│   │   └── GameBridge.ts
│   ├── i18n/           dictionnaires fr/en, translate(), hook useT()
│   ├── ui/             composants React (App, Menu, Rules, HUD, Tutorial, ResultScreen…)
│   ├── store/          Zustand
│   ├── main.tsx
│   └── index.css
├── public/             manifest, service worker, icones generees
├── scripts/
│   └── make-icons.mjs  generateur d'icones PWA (rasteriseur PNG sans dependance)
├── docs/               documentation par sujet (cf. sommaire ci-dessus)
├── tests/browser/      verifications a deux joueurs, pilotees au navigateur
├── .github/workflows/
│   ├── deploy.yml      tests + build + deploiement GitHub Pages
│   └── reveil-supabase.yml  garde le projet Supabase eveille
├── index.html
├── vite.config.ts
└── package.json
```

### Circulation de l'etat

```
React  --(bridge: start-match, restart-match, leave-match)-->  Scenes Phaser
React  <--(store Zustand : ecran, HUD, resultat)------------   Scenes Phaser
```

- `GameBridge` est un simple `EventEmitter` : React demande, Phaser decide.
- Les scenes ecrivent dans le store via `gameStore.getState()`, jamais l&apos;inverse.
- `MenuScene` et `ResultScene` sont volontairement **vides** : elles ne font que publier
  l&apos;ecran courant et attendre un evenement. Tout le visuel hors-jeu est en React.

---

## Informations legales

Politique de confidentialite, CGU et mentions legales, en double forme :

- **Pages statiques publiques** ([`public/legal/`](public/legal)), sans JS ni dependance au
  bundle de l&apos;application — c&apos;est l&apos;URL a renseigner dans App Store Connect
  (obligatoire) et la Play Console (section &laquo; Securite des donnees &raquo;), meme si le
  jeu ne collecte rien.
- **Ecran in-app** ([`src/ui/Legal.tsx`](src/ui/Legal.tsx)), accessible depuis un lien discret
  en bas du menu, pour la meme lisibilite depuis l&apos;application elle-meme.

> **&#9888; A METTRE A JOUR — ces pages ne decrivent plus le jeu.** Elles affirment
> que le jeu &laquo; ne fait appel a aucun serveur, aucun SDK tiers &raquo; et que les donnees
> &laquo; ne quittent jamais votre appareil &raquo;. C&apos;etait vrai avant le mode en ligne.
> Depuis, une partie en ligne ouvre une connexion vers un projet **Supabase** : les
> coups y transitent, et l&apos;adresse IP du joueur est necessairement vue par
> l&apos;hebergeur — ce qui est une donnee personnelle au sens du RGPD. Le texte publie
> est donc devenu inexact, et c&apos;est une page publique engageant l&apos;editeur.
> A reecrire avant toute diffusion plus large (cf. le fil de la conversation pour une
> proposition de redaction).

Hors mode en ligne, le constat reste vrai : aucun compte, aucun outil d&apos;analyse,
aucune publicite — et tout ce qui est conserve (preferences, progression, succes,
meilleure serie) reste en stockage local sur l&apos;appareil.

Identite editeur renseignee : Tommy Studio (Thomas Lefevre), entrepreneur individuel, Caen. A
tenir a jour si elle change (statut, adresse, contact) — repetee dans les deux formes, a
modifier aux deux endroits pour rester coherente.

URL a coller dans App Store Connect / Play Console :
`https://thoomaslef.github.io/kubb-kings/legal/politique-de-confidentialite.html`

---

## Hors perimetre de ce MVP

Volontairement non developpes, mais le decoupage `scenes / entities / physics / store`
est prevu pour les accueillir :

- classement mondial, chat, pages de profil (le mode en ligne, lui, est fait :
  cf. [Le jeu en ligne](docs/jeu-en-ligne.md))
- portage natif iOS / Android (Capacitor)
