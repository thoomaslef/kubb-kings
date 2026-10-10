# Comptes joueurs

Un compte **facultatif**, par e-mail et mot de passe, pour retrouver sa progression sur
un autre appareil. Le jeu reste entierement jouable sans compte, hors ligne, exactement
comme avant.

## Ce qui est synchronise

Niveau et experience (avec la serie et les parties jouees), pieces, succes, articles de la
boutique, terrains gagnes, meilleure serie en ligne, rang des parties classees, meilleure
manche du Defi. **Pas** synchronises : la langue, le son, le tutoriel deja vu — ce sont des
reglages de l'appareil, pas du joueur.

Cote serveur : une ligne par joueur dans `public.profiles`, un JSON d'environ 1 a 3 Ko
(plafonne a 20 Ko par la base). A ce volume, l'offre gratuite de Supabase (500 Mo de base)
loge plusieurs dizaines de milliers de comptes ; la contrainte reelle est plutot le nombre
de connexions actives et l'envoi d'e-mails (voir plus bas), pas l'espace.

## Mise en place (une fois, par vous, dans Supabase)

1. **Executer le script** `supabase/comptes.sql` : *SQL Editor -> New query -> coller -> Run*.
   Il cree la table, les regles d'acces et les trois fonctions. Sans danger a relancer.
2. **Authentication -> Providers -> Email** : activer « Email », et **desactiver « Confirm
   email »** (connexion immediate, sans e-mail). Si vous la laissez activee, le jeu le gere :
   il explique au joueur qu'il doit cliquer le lien recu — mais l'envoi d'e-mails de
   l'offre gratuite est tres limite en volume (quelques e-mails par heure) tant qu'aucun
   fournisseur d'envoi n'est branche.
3. **Authentication -> URL Configuration** : rien d'obligatoire pour e-mail + mot de passe sans
   confirmation ; si vous activez la confirmation, mettez l'adresse du site (GitHub Pages) en
   « Site URL ».
4. Les deux variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont celles du mode en
   ligne : rien de plus a configurer cote GitHub.

Sans le script SQL, la connexion fonctionne mais la synchronisation echoue : l'ecran Compte
affiche alors « Synchronisation impossible pour l'instant » et la progression reste sur
l'appareil.

## Connexion avec Google

Bouton « Continuer avec Google » sur l'ecran Compte. Meme compte, meme progression : seule la
facon de s'authentifier change (`backend.ts::signInWithGoogle`, `sync.ts::oauthComeback`).

**Flux (PKCE).** Le jeu envoie le navigateur chez Google ; Google renvoie sur le jeu avec un
`?code=` a usage unique, que le SDK echange contre la session (`flowType: 'pkce'`,
`detectSessionInUrl`). Rien de secret ne transite dans l'adresse, et le code est retire de la barre
d'adresse. Si le joueur annule chez Google, le retour porte `?error_description=` : le jeu l'explique
sur l'ecran Compte et nettoie l'adresse.

**Le bouton est CACHE tant que Google n'est pas configure** (`src/game/account/config.ts`) : un bouton
visible mais sans effet renverrait le joueur sur une page d'erreur brute de Supabase. Une fois les
etapes ci-dessous faites, il suffit de passer `GOOGLE_READY` a `true` (une ligne) — ou de me le demander.
Un build peut aussi l'allumer sans toucher au code avec `VITE_GOOGLE_AUTH=1` (c'est ce que fait
`npm run test:comptes` ; `GOOGLE_AUTH_TEST=0 npm run test:comptes` verifie que le bouton reste cache).

### Mise en place (une fois, par vous) — a faire sur ordinateur de preference

**A. Chez Google** (console.cloud.google.com)
1. Creer un projet (nom libre, ex. « Kubb Kings »).
2. *APIs & Services -> OAuth consent screen* (ou « Google Auth Platform ») : type **External**, nom de
   l'application, e-mail d'assistance, e-mail du developpeur. Scopes par defaut (email, profile, openid) :
   rien a ajouter.
3. **Publier l'application** (« Publish app » / statut « In production »). Piege courant : en statut
   *Testing*, seuls les comptes listes comme « utilisateurs test » peuvent se connecter. Pour ces scopes
   de base, Google n'exige aucune verification.
4. *Credentials -> Create credentials -> OAuth client ID* -> type **Web application** ->
   *Authorized redirect URIs* : l'adresse de rappel **que Supabase affiche** sur sa page Google
   (de la forme `https://<identifiant-du-projet>.supabase.co/auth/v1/callback`).
5. Copier l'**ID client** et le **secret client**.

**B. Chez Supabase**
1. *Authentication -> Sign In / Providers -> Google* : activer, coller l'ID client et le secret, **Save**.
2. *Authentication -> URL Configuration* :
   - **Site URL** : `https://thoomaslef.github.io/kubb-kings/`
   - **Redirect URLs** : ajouter la meme adresse (avec le `/` final). Sans cela, Supabase refuse de
     renvoyer le joueur sur le jeu apres Google.

**Meme adresse e-mail que votre compte existant.** Supabase relie normalement l'identite Google au compte
e-mail existant de meme adresse (meme joueur, meme progression). Non verifie ici — a controler lors de votre
premier essai ; sinon un deuxieme compte, vide, serait cree.

**Ce que Google transmet.** L'adresse e-mail ; Supabase peut aussi conserver le nom et la photo de profil
que Google lui envoie (le jeu ne les utilise pas). C'est dit dans la politique de confidentialite, et
`legal.test.ts` verrouille cette mention sur le code. Un compte Google n'a pas de mot de passe chez nous.

## Comment la synchronisation fonctionne

`src/game/account/` — **local d'abord** : le jeu lit et ecrit toujours le stockage de l'appareil
comme avant ; le compte recopie cette progression vers le serveur (2 secondes apres un
changement) et la rapporte sur un autre appareil.

- `profileSnapshot.ts` (pur, 14 tests) : le format, la validation du JSON recu (jamais cru sur
  parole : valeurs negatives, listes gonflees, rang hors echelle...), et la fusion « le meilleur
  des deux ».
- `backend.ts` : le service derriere une interface (comme `online/transport.ts`) ;
  `supabase/comptes.sql` en est la moitie serveur.
- `sync.ts` : le rapprochement.

**Deux appareils ne s'ecrasent jamais sans le savoir.** Chaque ecriture porte la *revision*
qu'elle croit remplacer ; le serveur la refuse si un autre appareil a ecrit entre-temps
(`save_profile` renvoie -1), et le client relit, fusionne, recommence.

Au moment de se connecter, cinq cas :

1. Le compte n'a encore rien : la progression de l'appareil y est envoyee.
2. L'appareil est vierge : il prend celle du compte.
3. L'appareil a deja ete rapproche de CE compte : si le serveur a avance, on le reprend (ou on
   fusionne si l'appareil a avance aussi) ; sinon on envoie ce qui a change.
4. Premier rapprochement, compte vide : l'appareil devient le compte.
5. Premier rapprochement, **les deux ont leur histoire** : on montre les deux au joueur, qui
   choisit — *fusionner*, *garder le compte*, *garder l'appareil*. Rien n'est ecrase avant son choix.

**La fusion et les pieces.** « Le meilleur des deux » garde l'XP du profil le plus avance, l'union des
succes, articles et terrains, les maxima des series, et le **maximum des pieces**. Compromis connu :
des pieces depensees d'un cote peuvent reapparaitre. La fusion n'est proposee qu'au premier
rapprochement, jamais en synchronisation courante (qui, elle, suit les revisions).

**Deconnexion.** La progression reste sur l'appareil : se deconnecter n'est pas perdre ses
donnees. Le repere de synchronisation est rattache a l'identifiant du compte : le meme joueur qui
se reconnecte reprend sans question ; **un autre compte** sur le meme appareil declenche le
dialogue (cas 5) — sur un appareil partage, c'est le joueur qui choisit de garder ou non ce qui s'y
trouve.

**Suppression.** Compte > Supprimer mon compte : efface l'utilisateur et sa ligne (`on delete
cascade`). La progression gardee sur l'appareil, elle, reste.

## Limites assumees

- **Le rang n'est pas arbitre.** Il est dans le profil, donc portable, mais un joueur qui sait
  ouvrir les outils de son navigateur peut y ecrire ce qu'il veut (comme pour l'XP et les pieces).
  La regle de securite (`RLS`) l'empeche de toucher au profil d'un AUTRE ; elle ne l'empeche pas de
  tricher sur le sien. Un rang qui compte vraiment demande que le serveur valide chaque resultat
  (les deux joueurs le declarent) : chantier suivant, pas celui-ci.
- **Mot de passe oublie : pas de reinitialisation** pour l'instant (elle repose sur l'envoi
  d'e-mails, dont l'offre gratuite est tres limitee). Un mot de passe perdu = un compte perdu ; la
  progression, elle, reste sur l'appareil.
- **Pseudo genere, pas de nom libre** : le compte porte l'e-mail, la progression et un pseudo attribue par
  le serveur, utilise uniquement pour le classement des parties classees (cf. `parties-classees.md`). Le
  classement est amical : les rangs sont declares par les clients, avec pour seule defense un controle de
  coherence cote serveur.
- **Pause du projet** apres 7 jours d'inactivite (offre gratuite) : les comptes deviennent alors
  indisponibles jusqu'a la reprise du projet, mais la progression locale continue de fonctionner.

## Tchat et parties tirees au sort

Les parties **rapide** et **classee** opposent a un inconnu. Elles n'ont **pas de tchat** :
du texte libre non modere avec un inconnu — possiblement un enfant — n'est pas un risque a prendre.
Le tchat reste dans les parties privees (par code de salon), entre gens qui se connaissent
(`online.matchmade` coupe `Chat.tsx`). Les textes legaux sont mis a jour en consequence, et
`legal.test.ts` verrouille ces affirmations sur le code.

## Verification

- `profileSnapshot.test.ts` : validation, fusion, symetrie, « ne perd rien ».
- `legal.test.ts` : les textes legaux disent la verite sur le compte et sur le tchat.
- `tests/browser/comptes.mjs` (`npm run test:comptes`) : la chaine complete contre un **faux
  Supabase** (y compris la connexion Google en PKCE : retour avec code, annulation, adresse nettoyee) — le vrai SDK, de vraies requetes interceptees, deux « appareils » a stockage separe
  et un serveur commun. Couvre la creation, un appareil vierge qui retrouve tout, les erreurs
  (mauvais mot de passe, adresse prise, trop de tentatives, service injoignable), une progression
  qui voyage d'un appareil a l'autre, deux appareils qui ecrivent **en meme temps** sans rien perdre,
  les trois choix du dialogue, la deconnexion, la confirmation d'e-mail et la suppression.
- **Non verifie** : le vrai service Supabase ET le vrai Google (ecran de consentement, liaison avec un compte e-mail de meme adresse) (non joignable depuis l'atelier) — notamment que votre
  projet a bien le script SQL et le reglage « Confirm email » voulus.
