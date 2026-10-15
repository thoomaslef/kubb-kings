# Comptes joueurs

Un compte **facultatif**, par e-mail et mot de passe, pour retrouver sa progression sur
un autre appareil. Le jeu reste entierement jouable sans compte, hors ligne, exactement
comme avant.

## Un compte = une progression

La progression d'un appareil n'appartient qu'a UN compte. Un appareil qui porte deja celle du compte A
et se connecte (ou cree) le compte B **ne la copie pas** : B retrouve la sienne, ou repart de zero
(`sync.ts::reconcileNow`, repere `META_KEY`). Seule la progression « libre » — jamais rattachee a un
compte — suit le joueur dans son premier compte. Sans cela, un second compte heritait du niveau, des pieces
et du score au classement du premier.

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
- **Pseudo** : le compte porte l'e-mail, la progression et un pseudo, utilise uniquement pour le classement des
  parties classees (cf. `parties-classees.md`). Voir la section « Pseudo » ci-dessous. Le classement est amical :
  les rangs sont declares par les clients, avec pour seule defense un controle de coherence cote serveur.
- **Pause du projet** apres 7 jours d'inactivite (offre gratuite) : les comptes deviennent alors
  indisponibles jusqu'a la reprise du projet, mais la progression locale continue de fonctionner.

## Pseudo

A la creation du compte, un pseudo est **genere** par le serveur (« RapideViking42 »). Le joueur peut le
**choisir** : un champ facultatif a l'inscription, et ensuite un bloc « Mon pseudo » dans la **Boutique** (l'ecran des
classes l'affiche mais ne l'edite pas) — [`PseudoEditor.tsx`](../src/ui/PseudoEditor.tsx). Sans compte, il n'y a pas de pseudo : le bloc
invite a se connecter.

C'est du **texte libre affiche publiquement** : le jeu est ouvert a tous les ages, donc des barrieres a trois niveaux.

| Regle | Ou |
| --- | --- |
| 3 a 16 caracteres ; lettres, chiffres, tiret, tiret bas ; **ni espace, ni lien, ni adresse, ni symbole** | client (`pseudo.ts`) ET serveur (`set_pseudo`) |
| Filtre de termes interdits : accents et substitutions (0->o, 1->i, 3->e, 4->a, 5->s, @->a, $->s, 7->t) defaites ; termes **courts** refuses comme mot entier seulement (« Classic » passe, « pute » non) ; noms reserves (admin, support, kubbkings...) | client ET serveur, **meme liste** |
| Unicite, sans tenir compte de la casse | serveur (index unique) |
| Un changement toutes les 5 minutes au plus (le premier est libre) | serveur (`pseudo_changed_at`) |
| **Un changement apres l'inscription coute 100 pieces** (`PSEUDO_CHANGE_COST`, `currency.ts`) ; le choix fait a l'inscription est gratuit | client (`PseudoEditor`) |

Le **serveur fait foi** ; le client ne fait que repondre plus vite. Les deux filtres sont deux ecritures de la meme
regle : [`pseudoSql.test.ts`](../src/game/account/pseudoSql.test.ts) execute le VRAI SQL (PGlite, un Postgres embarque)
et le client sur les memes pseudos et exige le meme verdict — changer une liste sans l'autre fait echouer `npm test`.

**Le prix.** Depuis la Boutique, changer de pseudo — au choix ou au hasard — coute 100 pieces.
Elles ne sont debitees qu'une fois le serveur d'accord : un refus (deja pris, interdit, trop tot, service
injoignable) ne coute rien. Solde insuffisant : le bouton est bloque et le manque est dit, sans requete. Le prix est
controle cote client (les pieces sont une donnee de l'appareil, comme le reste de la progression, cf. limites ci-dessus) ;
le delai de 5 minutes, lui, est impose par le serveur. L'attribution automatique d'un pseudo a un ancien compte qui n'en
avait pas reste gratuite : ce n'est pas un changement voulu.

**Choix a l'inscription.** Le profil en ligne n'existe qu'apres la premiere synchronisation : le pseudo voulu est
donc garde (`kubb-kings.pending-pseudo`) puis applique juste apres. Un echec passager (reseau, delai) le laisse en
attente ; un refus definitif (pris, interdit) l'abandonne, le joueur garde le pseudo attribue et en est prevenu sur
l'ecran Compte. Se deconnecter efface le choix en attente.

**Limites assumees.** Un filtre de mots n'est pas une moderation : il en laisse passer (orthographes inventees,
autres langues). Le complement est le **signalement** (ci-dessous) ; les mentions legales donnent aussi l'adresse de contact. Le pseudo n'est jamais affiche en partie (ni tchat, ni adversaire) : seulement
au classement.

> **A faire une fois : relancer `supabase/comptes.sql`** (SQL Editor, coller, Run — sans danger a relancer). Il ajoute
> `set_pseudo`. Tant que ce n'est pas fait, le jeu fonctionne : l'ecran dit « Le changement de pseudo n'est pas encore
> disponible » et chacun garde son pseudo genere.

**Verification.** `npm run test:sql` execute le script en entier dans PGlite (il s'execute, se relance, et les regles de
`set_pseudo` tiennent avec de vrais utilisateurs et la vraie contrainte d'unicite). `npm run test:comptes` couvre le client
contre un faux Supabase : choix a la creation, pseudo deja pris, interdit refuse avant toute requete, renommage depuis la
Boutique, delai, script SQL pas encore relance.

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

## Mot de passe oublie

Sur l'ecran Compte (onglet « Connexion ») : « Mot de passe oublie ? » -> l'adresse -> un e-mail avec un lien. Le lien
revient sur le jeu avec un code (meme principe que Google : PKCE), le SDK l'echange contre une session et emet
`PASSWORD_RECOVERY` ; le jeu affiche alors **un seul formulaire**, « Nouveau mot de passe »
(`sync.ts::initAccount` ecoute l'evenement AVANT `restore()`, `App.tsx` montre le formulaire meme si la scene du menu
repose l'ecran « menu » en demarrant). Le message est le meme que l'adresse ait un compte ou non : on ne laisse
jamais sonder les adresses.

**A faire une fois, par vous (le jeu ne peut pas le faire) — un vrai envoi d'e-mails** : l'offre gratuite de Supabase n'envoie
que quelques e-mails par heure, et seulement a l'equipe du projet tant qu'aucun fournisseur n'est branche. Sans cela,
la reinitialisation ne fonctionnera que pour vous.
1. Creer un compte chez un fournisseur d'envoi avec une offre gratuite (Resend, Brevo, Mailjet...) et **verifier votre domaine**
   (ou, a defaut, une adresse d'expediteur).
2. Supabase -> *Authentication -> Emails -> SMTP Settings* : activer « Custom SMTP », renseigner hote, port, identifiants,
   adresse et nom de l'expediteur.
3. Supabase -> *Authentication -> URL Configuration* : « Redirect URLs » doit contenir `https://thoomaslef.github.io/kubb-kings/`
   (avec le `/` final) — sinon le lien renvoie sur la mauvaise page.
4. *Authentication -> Emails -> Templates -> Reset Password* : traduire si voulu (le lien `{{ .ConfirmationURL }}` doit rester).
Verification : « Mot de passe oublie ? » avec votre adresse -> l'e-mail doit arriver en quelques secondes.

## Signaler et bloquer un pseudo

Au classement, chaque ligne (sauf la sienne) a un bouton « ⋯ » : **Signaler** ou **Bloquer**.

- **Signaler** (compte necessaire : un signalement anonyme ne pourrait pas etre limite) appelle `report_player`
  (`supabase/comptes.sql`). Un signalement par couple (signaleur, signale), 10 par signaleur et par 24 h. Le pseudo signale est
  conserve avec le signalement (preuve, meme s'il change ensuite). A **3 signaleurs differents**, le pseudo est remplace d'office
  par un pseudo genere, et le joueur ne peut pas le rechanger pendant 30 jours : on retire le texte sans trancher sur la
  culpabilite. La table `reports` est fermee a l'API (RLS sans regle) : **vous** la lisez dans Supabase ->
  *Table Editor -> reports* (ou `select * from public.reports order by created_at desc;`). Pour reinitialiser un pseudo a la
  main : `update public.profiles set pseudo = public.generate_pseudo() where lower(pseudo) = lower('Pseudo_Fautif');`.
- **Bloquer** masque le pseudo du classement, **sur cet appareil seulement** (`account/blocklist.ts`, stockage local, 100 max) ;
  marche sans compte. « Joueurs bloques : n — tout afficher de nouveau » les rend.
- **Tchat entre amis** : il n'y a aucune identite derriere un message (code de salon seulement) ; le bouton 🔔/🔇 du panneau
  **coupe le tchat** pour la partie (rien n'est plus affiche ni envoye).

Les pages legales decrivent ce qui est enregistre (identifiant de compte du signaleur, pseudo signale, date) ; `legal.test.ts` l'exige.
**A surveiller** : la table `reports` est a lire de temps en temps — il n'y a pas de notification. Si le jeu grandit, brancher un
envoi d'e-mail (fonction Edge ou webhook de base) sur chaque insertion.
