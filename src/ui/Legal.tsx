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
          KUBB: Kings ne demande aucun compte, n&apos;utilise aucun outil d&apos;analyse
          (analytics), aucun SDK tiers de suivi et aucune publicite. Le jeu ne constitue aucun
          profil de joueur.
        </p>
        <p className="panel__text">
          Les modes solo, local, Defi et tournoi fonctionnent entierement hors ligne : aucune
          connexion n&apos;est etablie. Le mode en ligne, lui, a besoin d&apos;un service tiers
          pour relayer les coups entre les deux joueurs.
        </p>
        <p className="panel__text">
          Vos preferences (langue, difficulte, terrain, projectile, skin, vent) et votre
          progression (meilleure serie du mode Defi, succes, serie de victoires en ligne) restent
          stockees localement sur votre appareil. Elles ne quittent jamais celui-ci et ne sont
          jamais transmises a l&apos;editeur ni a un tiers. Desinstaller l&apos;application ou
          vider les donnees du navigateur les supprime immediatement.
        </p>
        <p className="panel__text">
          En partie en ligne, le jeu ouvre une connexion temps reel vers Supabase, qui sert
          uniquement de relais. Y transitent le code de salon, les reglages de la partie, chaque
          lancer, les messages techniques (presence, abandon, reprise, revanche) et votre niveau
          de progression, transmis a l&apos;adversaire pour affichage. Aucun nom, aucun
          pseudonyme, aucun identifiant d&apos;appareil n&apos;est transmis : les joueurs sont
          designes par &laquo; hote &raquo; et &laquo; invite &raquo; suivis du code de salon.
        </p>
        <p className="panel__text">
          Rien n&apos;est enregistre sur le serveur : les messages sont relayes en direct puis
          perdus. Le jeu n&apos;ecrit dans aucune base de donnees et ne conserve aucun historique
          de partie.
        </p>
        <p className="panel__text">
          Comme pour toute connexion Internet, l&apos;adresse IP de votre appareil est
          necessairement vue par le fournisseur du relais pour acheminer les messages : il
          s&apos;agit d&apos;une donnee personnelle au sens du RGPD. L&apos;editeur n&apos;y a pas
          acces et ne la conserve pas. Le mode en ligne est facultatif : sans lui, aucune
          connexion n&apos;est etablie.
        </p>
        <p className="panel__text">
          Il n&apos;y a ni chat, ni messagerie, ni contenu publie par les joueurs : le jeu
          convient a tous les ages. Le jeu ne demande aucune permission (localisation, contacts,
          photos, microphone&hellip;).
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
          est le seul element qui protege une partie : il vous appartient de ne le communiquer
          qu&apos;a la personne avec qui vous souhaitez jouer. Ce mode repose sur un service
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
          Relais du mode en ligne : Supabase, Inc. — projet heberge dans la region Europe.
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
