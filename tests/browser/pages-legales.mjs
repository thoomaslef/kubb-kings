/**
 * Les pages legales s'affichent-elles vraiment, et disent-elles ce qu'on croit ?
 *
 * `src/ui/legal.test.ts` verifie le TEXTE ; il ne peut rien dire du rendu.
 * Or ces pages sont ecrites a la main, sans bundle ni framework : un lien
 * casse, une liste sans style ou un debordement horizontal sur mobile rend
 * illisible un document qui engage l'editeur, et c'est l'URL qu'on fournit a
 * App Store Connect.
 *
 * Seule verification de cette suite qui ne lance aucune partie : elle ne
 * touche pas au jeu, et tourne donc en quelques secondes.
 */
import { lancerNavigateur, surveiller } from "./harness.mjs";

/**
 * Racine des pages legales. Elles sont servies a cote du jeu, donc deduites
 * de `KUBB_URL` : une seule variable a fournir, comme les autres
 * verifications.
 */
const BASE =
  process.env.KUBB_LEGAL_URL ??
  new URL("legal", process.env.KUBB_URL ?? "http://localhost:4173/kubb-kings/")
    .href;
const PAGES = ["politique-de-confidentialite", "cgu", "mentions-legales"];

const navigateur = await lancerNavigateur();
// Petit ecran : c'est la ou un debordement se voit.
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 },
});
const erreurs = [];
const page = await contexte.newPage();
surveiller("legal", page, erreurs);

const vues = {};
for (const nom of PAGES) {
  const reponse = await page.goto(`${BASE}/${nom}.html`);
  if (!reponse?.ok()) {
    erreurs.push(`${nom}.html : HTTP ${reponse?.status()}`);
    continue;
  }
  vues[nom] = await page.evaluate(() => ({
    titre: document.querySelector("h1")?.textContent?.trim() ?? "",
    sections: document.querySelectorAll("h2").length,
    puces: document.querySelectorAll("li").length,
    liens: [...document.querySelectorAll("a")].map((a) =>
      a.getAttribute("href"),
    ),
    // Une puce non stylee herite du retrait par defaut du navigateur et
    // depasse du cadre : on verifie que la regle ajoutee s'applique.
    retraitListe: document.querySelector("ul")
      ? getComputedStyle(document.querySelector("ul")).paddingLeft
      : null,
    deborde: document.documentElement.scrollWidth > window.innerWidth + 1,
    texte: document.body.innerText,
  }));
  const v = vues[nom];
  console.log(`\n--- ${nom} ---`);
  console.log(`  h1       : ${v.titre}`);
  console.log(
    `  sections : ${v.sections}   puces : ${v.puces}   retrait liste : ${v.retraitListe ?? "n/a"}`,
  );
  console.log(`  liens    : ${v.liens.join(", ")}`);
  console.log(`  deborde  : ${v.deborde}   texte : ${v.texte.length} car.`);
}

// ---- Les liens croises doivent mener a une VRAIE page legale.
//
// Le code HTTP ne suffit pas : `vite preview` (comme tout serveur a repli
// SPA) renvoie `index.html` avec un 200 pour une URL inconnue. Un lien
// casse passait donc inapercu — ce defaut-ci a ete trouve en cassant un
// lien expres. On verifie le CONTENU servi, pas son statut.
const TITRES_LEGAUX = new Set([
  "Politique de confidentialite",
  "Conditions generales d’utilisation",
  "Mentions legales",
]);
let liensOk = true;
for (const [nom, v] of Object.entries(vues)) {
  for (const href of new Set(v.liens)) {
    await page.goto(`${BASE}/${href}`, { waitUntil: "domcontentloaded" });
    const titre = await page.evaluate(
      () => document.querySelector("h1")?.textContent?.trim() ?? "",
    );
    if (!TITRES_LEGAUX.has(titre)) {
      console.log(`  LIEN CASSE : ${nom} -> ${href} (h1 servi : "${titre}")`);
      liensOk = false;
    }
  }
}

// ---- L'ecran legal DANS le jeu : meme contenu, autre rendu. Il a ete
//      allonge par la divulgation du mode en ligne, il doit donc defiler.
const jeu = await contexte.newPage();
surveiller("jeu", jeu, erreurs);
await jeu.goto(process.env.KUBB_URL ?? "http://localhost:4173/kubb-kings/");
await jeu.waitForFunction(() => Boolean(window.__kubbStoreApi), null, {
  timeout: 30000,
});
// Le jeu demarre sur `boot` et bascule vers `menu` tout seul : fixer l'ecran
// avant la fin de cet amorcage se fait ecraser sans bruit.
await jeu.waitForFunction(
  () => window.__kubbStoreApi.getState().screen === "menu",
  null,
  { timeout: 30000 },
);
await jeu.evaluate(() => window.__kubbStoreApi.getState().setScreen("legal"));
await jeu.waitForSelector(".panel--scroll", { timeout: 10000 });
const ecran = await jeu.evaluate(() => {
  const panneau = document.querySelector(".panel--scroll");
  return {
    texte: panneau.innerText,
    // Plus haut que son cadre : sans defilement, la fin serait inatteignable.
    defilable: panneau.scrollHeight > panneau.clientHeight,
    debordeLateral: panneau.scrollWidth > panneau.clientWidth + 1,
    boutonRetour: Boolean(
      [...panneau.querySelectorAll("button")].find((b) =>
        /Retour/i.test(b.textContent),
      ),
    ),
  };
});
console.log(`\n--- ecran in-app ---`);
console.log(
  `  texte : ${ecran.texte.length} car.   defilable : ${ecran.defilable}   deborde : ${ecran.debordeLateral}`,
);

const politique = vues["politique-de-confidentialite"];
const resultats = {
  troisPagesServies: Object.keys(vues).length === PAGES.length,
  politiqueNommeLeRelais: politique?.texte.includes("Supabase") ?? false,
  politiqueNommeLIP: politique?.texte.includes("adresse IP") ?? false,
  politiqueDitFacultatif: politique?.texte.includes("facultatif") ?? false,
  // Les cinq elements qui transitent, enumeres et donc reellement rendus.
  politiqueEnumereCeQuiTransite: politique?.puces === 5,
  listeStylee: politique?.retraitListe === "20px",
  cguDecritLeSalon: vues["cgu"]?.texte.includes("code de salon") ?? false,
  mentionsCitentLeRelais:
    vues["mentions-legales"]?.texte.includes("Supabase") ?? false,
  aucunDebordementMobile: Object.values(vues).every((v) => !v.deborde),
  liensCroisesValides: liensOk,
  // L'ecran du jeu doit divulguer la meme chose que la page publique.
  ecranNommeLeRelais: ecran.texte.includes("Supabase"),
  ecranNommeLIP: ecran.texte.includes("adresse IP"),
  ecranCiteLeRGPD: ecran.texte.includes("RGPD"),
  ecranDefile: ecran.defilable,
  ecranSansDebordementLateral: !ecran.debordeLateral,
  ecranGardeSonRetour: ecran.boutonRetour,
};

console.log("\n", JSON.stringify(resultats, null, 1));
console.log("Erreurs JS :", erreurs);
const ok = Object.values(resultats).every(Boolean) && erreurs.length === 0;
console.log("=== OK:", ok, "===");
await navigateur.close();
process.exitCode = ok ? 0 : 1;
