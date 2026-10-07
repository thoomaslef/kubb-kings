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
- **Pas de pseudo, pas de classement mondial** : le compte ne porte que l'e-mail et la progression.
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
  Supabase** — le vrai SDK, de vraies requetes interceptees, deux « appareils » a stockage separe
  et un serveur commun. Couvre la creation, un appareil vierge qui retrouve tout, les erreurs
  (mauvais mot de passe, adresse prise, trop de tentatives, service injoignable), une progression
  qui voyage d'un appareil a l'autre, deux appareils qui ecrivent **en meme temps** sans rien perdre,
  les trois choix du dialogue, la deconnexion, la confirmation d'e-mail et la suppression.
- **Non verifie** : le vrai service Supabase (non joignable depuis l'atelier) — notamment que votre
  projet a bien le script SQL et le reglage « Confirm email » voulus.
