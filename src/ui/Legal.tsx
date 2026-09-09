import { useGameStore } from '../store/useGameStore';

/**
 * Politique de confidentialite, CGU et mentions legales, en un seul ecran
 * defilant (comme Rules.tsx). Reprend le contenu des pages statiques
 * publiques (public/legal/*.html), demandees par Apple/Google au moment
 * de la soumission — les deux versions doivent rester en phase si le
 * contenu change.
 *
 * [A COMPLETER] avant toute soumission sur les stores : les mentions
 * legales exigent une identite reelle (nom/raison sociale, contact).
 */
export function Legal() {
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--scroll">
        <h2 className="panel__title">Informations legales</h2>

        <h3 className="legal-heading">Politique de confidentialite</h3>
        <p className="panel__text">
          KUBB: Kings ne collecte, ne transmet et ne partage aucune donnee personnelle. Le jeu ne
          fait appel a aucun serveur, aucun compte, aucun outil d&apos;analyse (analytics) et
          aucune publicite.
        </p>
        <p className="panel__text">
          Les seules informations conservees — preferences de jeu (niveau, terrain, skin, vent) et
          meilleure serie du mode Defi — restent stockees localement sur votre appareil et ne
          quittent jamais celui-ci. Desinstaller l&apos;application ou vider les donnees du
          navigateur les supprime immediatement.
        </p>
        <p className="panel__text">
          Le jeu ne demande aucune permission (localisation, contacts, photos, microphone&hellip;)
          et ne s&apos;adresse pas differemment aux enfants : aucune donnee personnelle n&apos;est
          traitee, quel que soit l&apos;age du joueur.
        </p>
        <p className="panel__text">
          Contact pour toute question relative a cette politique :{' '}
          <strong>[A COMPLETER : adresse e-mail de contact]</strong>.
        </p>

        <h3 className="legal-heading">Conditions generales d&apos;utilisation</h3>
        <p className="panel__text">
          L&apos;utilisation de KUBB: Kings implique l&apos;acceptation des presentes conditions.
          Le jeu est propose gratuitement, sans achat integre a ce jour.
        </p>
        <p className="panel__text">
          Le code, les visuels et les sons de l&apos;application sont la propriete de{' '}
          <strong>[A COMPLETER : nom ou raison sociale de l&apos;editeur]</strong>, sauf mention
          contraire. Le Kubb, jeu traditionnel suedois dont cette application s&apos;inspire, est
          un jeu populaire du domaine public.
        </p>
        <p className="panel__text">
          L&apos;application est fournie en l&apos;etat, sans garantie de disponibilite
          ininterrompue. L&apos;editeur peut la modifier ou l&apos;ameliorer a tout moment.
        </p>

        <h3 className="legal-heading">Mentions legales</h3>
        <p className="panel__text">
          Editeur : <strong>[A COMPLETER : nom/prenom ou raison sociale]</strong>
          <br />
          Contact : <strong>[A COMPLETER : adresse e-mail]</strong>
        </p>
        <p className="panel__text">
          Hebergement (version web) : GitHub, Inc. — 88 Colin P Kelly Jr St, San Francisco, CA
          94107, Etats-Unis.
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
