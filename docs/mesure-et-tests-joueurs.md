# Mesure d'usage anonyme et test avec de vrais joueurs

## Pourquoi

Sans mesure, impossible de dire si quelqu'un rejoue le lendemain, quel mode plait, ni combien de parties sont abandonnees.
La mesure est **anonyme**, **declaree dans les pages legales** et **coupable** par le joueur (Options).

## Ce qui est mesure — et rien d'autre

Un identifiant ALEATOIRE par appareil (genere par le jeu, ecrit dans le stockage local, sans lien avec un compte, un e-mail ou un
pseudo) et des evenements (`src/game/analytics.ts`, liste de reference et filtre cote serveur : `supabase/mesure.sql`) :

| Evenement | Quand | Champs |
| --- | --- | --- |
| `session_start` | ouverture du jeu | — |
| `match_start` | debut d'une partie (ou d'une manche de Defi) | mode |
| `match_end` | fin d'une partie | mode, issue (win/loss/draw), duree en s |
| `match_abandon` | on quitte en cours de partie | mode, duree en s |
| `search` | recherche d'adversaire classee | issue (matched/bot/cancelled), attente en s |

Modes : `solo`, `local`, `2v2`, `defi`, `friend` (partie privee), `ranked`, `bot` (repli apres une minute sans adversaire).
Jamais de nom, d'e-mail, de pseudo, de message, de position. Pas d'adresse IP enregistree par nous (le fournisseur la voit pour
acheminer la requete). Conservation : 13 mois (`select public.purge_usage_events();` de temps en temps).

**Garde-fous** : aucun SDK (une simple requete `fetch`, donc un joueur hors ligne ne telecharge rien de plus) ; inerte sans projet
configure ; **coupee d'office si le navigateur envoie Do Not Track** ; coupable dans Options ; au plus 20 evenements par appel et
400 par appareil et par jour cote serveur ; la table est fermee a l'API (RLS sans regle), seule `track_usage` y ecrit.
Verifie : `tests/sql/comptes-sql.mjs` (SQL execute pour de vrai), `tests/browser/comptes.mjs` section « mesure d'usage anonyme »
(evenements recus, un seul identifiant par appareil, aucun champ hors liste, couper arrete tout, Do Not Track respecte),
`src/ui/legal.test.ts` (les pages legales decrivent ce qui part).

## Lire les chiffres

Dans Supabase -> *SQL Editor* (le schema `stats` n'est pas expose a l'API) :

```sql
select * from stats.par_jour;     -- appareils actifs, nouveaux, parties lancees / terminees / abandonnees, par jour
select * from stats.par_mode;     -- parties par mode et part d'abandon
select * from stats.retention;    -- par cohorte (jour de premiere visite) : revus J+1 et J+7, en %
select * from stats.recherche;    -- classee : combien trouvent un adversaire, finissent contre un bot, annulent
```

**Comment lire** : `pct_j1` = part des appareils vus un jour J qui reviennent le lendemain. Un jeu mobile casual sain tourne
souvent autour de 20-30 % ; en dessous de 10 %, c'est le tout premier lancement qu'il faut retravailler (tutoriel, premiere partie).
`stats.recherche` : si la plupart des recherches finissent en `bot` ou `cancelled`, la file classee est vide — c'est le signal
qu'il faut du monde, pas un bug.

## Le test avec 5 a 10 personnes (a faire par vous)

1. Publier la version, verifier que le Supabase de production a bien execute `supabase/comptes.sql` et `supabase/mesure.sql`.
2. Donner le lien a 5-10 personnes **sur leur telephone**, dont 2-3 qui ne connaissent pas le Kubb. Ne rien expliquer.
3. Pour la file classee, fixer un moment ou **deux personnes au moins** lancent « Jouer en ligne > Trouver une partie » en meme temps
   (sinon elles tomberont sur le bot au bout d'une minute, ce qui est correct mais ne teste pas le matchmaking).
4. Leur demander ensuite : *Qu'as-tu compris ? Qu'est-ce qui t'a bloque ? Tu rejouerais ?* Noter les mots exacts.
5. Le lendemain, regarder `stats.retention` et `stats.recherche`.
6. A surveiller en particulier : le premier match (tutoriel lisible ?), la lisibilite du rebond sur le roi, le temps de 30 s par coup,
   un message d'erreur de connexion (`online.connectionFailed`), l'ecran « Mot de passe oublie ? » (necessite le SMTP : voir `comptes-joueurs.md`).

Les crashs, eux, restent dans le journal local (A propos), copiable par le joueur : demandez-le a ceux qui rencontrent un probleme.
