import { describe, expect, it } from "vitest";
import politiqueSource from "../../public/legal/politique-de-confidentialite.html?raw";
import cguSource from "../../public/legal/cgu.html?raw";
import mentionsSource from "../../public/legal/mentions-legales.html?raw";
import ecranSource from "./Legal.tsx?raw";
import transportSource from "../game/online/supabaseTransport.ts?raw";
import chatSource from "../game/online/chat.ts?raw";

/**
 * Les textes legaux doivent dire la verite sur le reseau.
 *
 * Ce test existe a cause d'un vrai defaut. Le mode en ligne a ete livre
 * alors que la politique de confidentialite — publiee ET affichee dans le
 * jeu — affirmait encore qu'il n'y avait « aucun serveur » et que les
 * donnees « ne quittaient jamais votre appareil ». Les deux etaient
 * devenues fausses : le jeu ouvre desormais une connexion a un relais
 * tiers, et l'adresse IP du joueur y est necessairement vue. Rien ne
 * l'avait signale — ni le compilateur, ni les tests — parce qu'un texte
 * faux compile aussi bien qu'un texte vrai.
 *
 * Deux verrous :
 *   1. les denegations UNIVERSELLES de toute transmission ne doivent pas
 *      revenir (une phrase cadree aux donnees locales, elle, reste vraie
 *      et reste permise) ;
 *   2. tant que le code embarque un transport reseau, les faits qui
 *      comptent doivent etre divulgues — dans les DEUX versions, qui ont
 *      deja diverge une fois.
 */

/** Chaque document avec son nom, pour que l'echec nomme le fichier fautif. */
const POLITIQUE = "public/legal/politique-de-confidentialite.html";
const CGU = "public/legal/cgu.html";
const MENTIONS = "public/legal/mentions-legales.html";
const ECRAN = "src/ui/Legal.tsx";

const SOURCES: Record<string, string> = {
  [POLITIQUE]: politiqueSource,
  [CGU]: cguSource,
  [MENTIONS]: mentionsSource,
  [ECRAN]: ecranSource,
};

const DOCUMENTS_JOUEUR = [POLITIQUE, ECRAN, CGU, MENTIONS] as const;

/**
 * Ce que le joueur LIT, et rien d'autre.
 *
 * Trois pieges que la version naive de ce test n'avait pas vus :
 *   - les commentaires de code parlent des anciennes phrases fausses pour
 *     expliquer le defaut : les inspecter declencherait une fausse alerte ;
 *   - le texte est retourne a la ligne, donc une recherche de sous-chaine
 *     n'attrape que les phrases qui n'ont pas ete coupees ;
 *   - les deux versions n'encodent pas l'apostrophe pareil (&rsquo; contre
 *     &apos;), ce qui rend toute comparaison croisee illusoire.
 */
function texteJoueur(chemin: string): string {
  let texte = SOURCES[chemin];

  if (chemin.endsWith(".tsx")) {
    texte = texte
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ");
  } else {
    // <head> emporte le <style> et le <title> : rien de tout cela n'est du
    // texte legal.
    texte = texte
      .replace(/<head>[\s\S]*?<\/head>/i, " ")
      .replace(/<!--[\s\S]*?-->/g, " ");
  }

  return texte
    .replace(/&rsquo;|&apos;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&laquo;|&raquo;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Denegations UNIVERSELLES : elles pretendent qu'aucune communication
 * n'existe, ou que la liste des donnees locales est exhaustive. C'est
 * precisement ce qui etait devenu faux.
 */
const DENEGATIONS_UNIVERSELLES = [
  "aucun serveur",
  "ne collecte, ne transmet et ne partage aucune donnee personnelle",
  "Aucune donnee personnelle n'etant collectee",
  "aucune donnee personnelle n'est traitee",
  "Les seules informations conservees",
];

describe("aucune denegation universelle de transmission", () => {
  it.each(DOCUMENTS_JOUEUR)("%s", (chemin) => {
    const texte = texteJoueur(chemin);
    for (const denegation of DENEGATIONS_UNIVERSELLES) {
      expect(
        texte,
        `"${denegation}" est devenu faux avec le mode en ligne`,
      ).not.toContain(denegation);
    }
  });
});

describe("le reseau reellement present est divulgue", () => {
  /**
   * Ancrage sur le CODE, pas sur une liste figee : si le transport
   * disparait un jour, ces exigences perdent leur objet d'elles-memes.
   */
  it("le code embarque bien un transport reseau (sinon ce test n a plus d objet)", () => {
    expect(transportSource).toContain("createClient");
  });

  /** Les faits qu'un joueur doit pouvoir lire avant de jouer en ligne. */
  const FAITS_OBLIGATOIRES = [
    "Supabase",
    "adresse IP",
    "RGPD",
    "code de salon",
    "niveau de progression",
    "facultatif",
    // Le tchat est le SEUL contenu que le joueur redige lui-meme : taire son
    // existence, ou laisser croire qu'il est modere, serait le mensonge le
    // plus couteux de ces pages.
    "tchat",
  ];

  it.each([POLITIQUE, ECRAN])(
    "%s divulgue les faits qui comptent",
    (chemin) => {
      const texte = texteJoueur(chemin);
      for (const fait of FAITS_OBLIGATOIRES) {
        expect(texte, `"${fait}" manque dans ${chemin}`).toContain(fait);
      }
    },
  );

  it("les deux versions enumerent ce qui transite, sans resume vague", () => {
    for (const chemin of [POLITIQUE, ECRAN]) {
      const texte = texteJoueur(chemin);
      for (const element of [
        "reglages de la partie",
        "lancer",
        "abandon",
        "revanche",
      ]) {
        expect(texte, `${chemin} omet "${element}"`).toContain(element);
      }
    }
  });

  it("rien n'est stocke cote serveur — et le code le confirme", () => {
    // Verifiable, pas declaratif : le transport n'utilise ni table, ni
    // auth persistante, ni storage — uniquement du broadcast ephemere.
    expect(transportSource).not.toMatch(/\.from\(|\.insert\(|\.upsert\(/);
    expect(transportSource).toContain("persistSession: false");

    for (const chemin of [POLITIQUE, ECRAN]) {
      expect(texteJoueur(chemin), chemin).toContain(
        "Rien n'est enregistre sur le serveur",
      );
    }
  });

  it("les CGU decrivent le mode en ligne et le role du code de salon", () => {
    const cgu = texteJoueur(CGU);
    expect(cgu).toContain("en ligne");
    expect(cgu).toContain("code de salon");
  });

  it("le tchat est annonce pour ce qu'il est : libre, non modere, non conserve", () => {
    // Le code embarque un tchat (chat.ts) : tant qu'il existe, ces trois
    // caracteres doivent etre ecrits noir sur blanc. Promettre une
    // moderation qui n'existe pas serait pire que de se taire.
    expect(chatSource, "chat.ts n'existe plus : ce test n'a plus d'objet").toContain("sanitizeChatText");
    for (const chemin of [POLITIQUE, ECRAN, CGU]) {
      const texte = texteJoueur(chemin);
      expect(texte, `${chemin} ne parle pas du tchat`).toContain("tchat");
      expect(texte, `${chemin} ne dit pas qu'il est libre`).toContain("texte libre");
      expect(texte, `${chemin} ne dit pas qu'il n'est pas modere`).toContain("modere");
    }
  });

  it("aucune page ne promet plus l'absence de tchat", () => {
    for (const chemin of DOCUMENTS_JOUEUR) {
      expect(texteJoueur(chemin), chemin).not.toContain("ni chat");
      expect(texteJoueur(chemin), chemin).not.toContain("ni messagerie");
    }
  });

  it("les mentions legales citent le relais parmi les hebergeurs", () => {
    expect(texteJoueur(MENTIONS)).toContain("Supabase");
  });
});

describe("coherence editoriale", () => {
  it("les trois pages portent la meme date de mise a jour", () => {
    const dates = [POLITIQUE, CGU, MENTIONS].map((chemin) => {
      const trouve = /derniere mise a jour : (\d{2}\/\d{2}\/\d{4})/.exec(
        texteJoueur(chemin),
      );
      expect(
        trouve,
        `${chemin} n'affiche pas de date de mise a jour`,
      ).not.toBeNull();
      return trouve![1];
    });
    expect(new Set(dates).size, `dates divergentes : ${dates.join(", ")}`).toBe(
      1,
    );
  });

  it("le contact de l editeur reste joignable partout", () => {
    for (const chemin of DOCUMENTS_JOUEUR) {
      expect(texteJoueur(chemin), chemin).toContain("thomas@tommy-studio.pro");
    }
  });
});
