import { useGameStore } from '../store/useGameStore';

/**
 * Politique de confidentialite, CGU et mentions legales, en un seul ecran
 * defilant (comme Rules.tsx). Reprend le contenu des pages statiques
 * publiques (public/legal/*.html), demandees par Apple/Google au moment
 * de la soumission — les deux versions doivent rester en phase si le
 * contenu change.
 *
 * `legal.test.ts` verrouille cette mise en phase : il a ete ecrit apres
 * que le mode en ligne a rendu les deux versions fausses sans que rien ne
 * le signale. Elles affirmaient « aucun serveur » et « ne quittent jamais
 * votre appareil » alors que le jeu ouvrait desormais une connexion a un
 * relais tiers.
 */
export function Legal() {
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--scroll">
        <h2 className="panel__title">Informations legales</h2>

        <h3 className="legal-heading">Politique de confidentialite</h3>
        <p className="panel__text">
          KUBB: Kings n&apos;utilise aucun outil d&apos;analyse (analytics), aucun SDK tiers de
          suivi et aucune publicite. Un compte joueur est propose, mais il est facultatif : le
          jeu se joue en entier sans.
        </p>
        <p className="panel__text">
          Les modes solo, local, Defi et tournoi fonctionnent entierement hors ligne : aucune
          connexion n&apos;est etablie. Le mode en ligne, lui, a besoin d&apos;un service tiers
          pour relayer les coups entre les deux joueurs.
        </p>
        <p className="panel__text">
          Vos preferences (langue, difficulte, terrain, projectile, skin, vent) et votre
          progression (meilleure serie du mode Defi, succes, serie de victoires en ligne) restent
          stockees localement sur votre appareil. Sans compte joueur, elles ne quittent jamais
          celui-ci et ne sont jamais transmises a l&apos;editeur ni a un tiers ; avec un compte,
          votre progression est en plus enregistree en ligne (voir « Compte joueur » ci-dessous).
          Desinstaller l&apos;application ou
          vider les donnees du navigateur les supprime immediatement.
        </p>
        <p className="panel__text">
          En partie en ligne, le jeu ouvre une connexion temps reel vers Supabase, qui sert
          uniquement de relais. Y transitent le code de salon, les reglages de la partie, chaque
          lancer, les messages techniques (presence, abandon, reprise, revanche), votre niveau
          de progression transmis a l&apos;adversaire pour affichage, et les messages de tchat
          que vous ecrivez. Aucun nom, aucun
          pseudonyme, aucun identifiant d&apos;appareil n&apos;est transmis : les joueurs sont
          designes par &laquo; hote &raquo; et &laquo; invite &raquo; suivis du code de salon.
        </p>
        <p className="panel__text">
          Rien n&apos;est enregistre sur le serveur pendant une partie : les messages sont
          relayes en direct puis perdus, et aucun historique de partie n&apos;est conserve. Les
          seules donnees enregistrees en ligne sont celles du compte joueur facultatif, decrit
          plus bas.
        </p>
        <p className="panel__text">
          La partie rapide et la partie classee vous opposent a un joueur tire au sort : chaque
          joueur en recherche annonce sa presence (identifiant aleatoire temporaire, heure
          d&apos;arrivee) sur un canal commun, sans rien conserver. Il n&apos;y a pas de tchat
          dans ces parties. Sans adversaire au bout d&apos;une minute, vous jouez contre un bot,
          sans aucun echange en ligne.
        </p>
        <p className="panel__text">
          <strong>Compte joueur (facultatif).</strong> Si vous en creez un, Supabase (region
          Europe) enregistre votre adresse e-mail, qui ne sert qu&apos;a vous connecter, votre
          mot de passe sous forme chiffree, et votre progression : niveau, pieces, succes,
          articles, rang des parties classees, meilleures series, plus un pseudo genere
          automatiquement (jamais un texte saisi) pour le classement. Ni historique de parties,
          ni messages, ni nom. Ces donnees ne servent qu&apos;a restaurer votre
          progression et ne sont ni vendues ni partagees. Vous pouvez supprimer votre compte a
          tout moment depuis le jeu : adresse e-mail et progression en ligne sont alors effacees
          definitivement. Le classement des parties classees est public et lisible sans compte :
          il affiche le pseudo genere, le rang et le bilan, jamais l&apos;adresse e-mail ni le
          nom ; vous pouvez changer de pseudo ou ne plus y apparaitre, et supprimer votre compte
          vous en retire. Les rangs ne sont pas verifies par un serveur. La connexion avec Google est aussi proposee : Google transmet alors
          votre adresse e-mail, et Supabase peut conserver avec elle le nom et la photo de
          profil que Google lui communique ; le jeu ne les affiche ni ne les utilise, aucun mot
          de passe n&apos;est enregistre, et la connexion est traitee par Google selon sa propre
          politique.
        </p>
        <p className="panel__text">
          Comme pour toute connexion Internet, l&apos;adresse IP de votre appareil est
          necessairement vue par le fournisseur du relais pour acheminer les messages : il
          s&apos;agit d&apos;une donnee personnelle au sens du RGPD. L&apos;editeur n&apos;y a pas
          acces et ne la conserve pas. Le mode en ligne est facultatif : sans lui, aucune
          connexion n&apos;est etablie.
        </p>
        <p className="panel__text">
          Une partie en ligne comporte un <strong>tchat en texte libre</strong>. Les messages y
          sont retransmis en direct puis perdus : ils ne sont ni enregistres, ni moderes, ni
          consultables par l&apos;editeur. Le tchat n&apos;existe qu&apos;entre deux joueurs qui
          se sont volontairement partage un code de salon, dans une partie privee — il n&apos;y en
          a pas dans la partie rapide ni la partie classee, et il n&apos;y a pas de salon public.
          Chacun repond de ce qu&apos;il ecrit ; quitter la
          partie ferme immediatement la liaison.
        </p>
        <p className="panel__text">
          Les modes solo, local, Defi et tournoi ne comportent aucun echange et conviennent a
          tous les ages. Pour un enfant, nous recommandons que le code de salon ne soit partage
          qu&apos;avec des personnes connues de lui, et qu&apos;un adulte soit informe de
          l&apos;usage du mode en ligne et de la creation d&apos;un compte joueur facultatif
          (adresse e-mail).
        </p>
        <p className="panel__text">
          Le jeu ne demande aucune permission (localisation, contacts, photos,
          microphone&hellip;).
        </p>
        <p className="panel__text">
          Contact pour toute question relative a cette politique, ou pour exercer vos droits :{' '}
          <strong>thomas@tommy-studio.pro</strong>.
        </p>

        <h3 className="legal-heading">Conditions generales d&apos;utilisation</h3>
        <p className="panel__text">
          L&apos;utilisation de KUBB: Kings implique l&apos;acceptation des presentes conditions.
          Le jeu est propose gratuitement, sans achat integre a ce jour.
        </p>
        <p className="panel__text">
          Le code, les visuels et les sons de l&apos;application sont la propriete de{' '}
          <strong>Tommy Studio (Thomas Lefevre)</strong>, sauf mention contraire. Le Kubb, jeu
          traditionnel suedois dont cette application s&apos;inspire, est un jeu populaire du
          domaine public.
        </p>
        <p className="panel__text">
          Le mode en ligne met en relation deux joueurs qui partagent un code de salon. Ce code
          est le seul element qui protege une partie privee : il vous appartient de ne le
          communiquer qu&apos;a la personne avec qui vous souhaitez jouer. La partie rapide et la
          partie classee vous opposent a un joueur tire au sort, sans tchat. Un compte joueur
          facultatif permet de retrouver votre progression : vous etes responsable de votre mot
          de passe, et le rang des parties classees n&apos;est pas verifie par un serveur. Ce mode repose sur un service
          tiers propose sans garantie de disponibilite ; l&apos;editeur peut le suspendre ou
          l&apos;interrompre a tout moment, sans que cela affecte les modes hors ligne.
        </p>
        <p className="panel__text">
          L&apos;application est fournie en l&apos;etat, sans garantie de disponibilite
          ininterrompue. L&apos;editeur peut la modifier ou l&apos;ameliorer a tout moment.
        </p>

        <h3 className="legal-heading">Mentions legales</h3>
        <p className="panel__text">
          Editeur : <strong>Tommy Studio</strong> &mdash; Thomas Lefevre, entrepreneur individuel
          (SIRET 101 082 337 00011), Caen, Normandie
          <br />
          Contact : <strong>thomas@tommy-studio.pro</strong> &mdash; +33 6 12 94 11 25
        </p>
        <p className="panel__text">
          Hebergement (version web) : GitHub, Inc. — 88 Colin P Kelly Jr St, San Francisco, CA
          94107, Etats-Unis.
          <br />
          Relais du mode en ligne et hebergement des comptes joueurs : Supabase, Inc. — projet heberge dans la region Europe.
        </p>

        <div className="button-column">
          <button className="btn btn--primary" onClick={() => setScreen('menu')}>
            Retour
          </button>
        </div>
      </div>
    </div>
  );
}
