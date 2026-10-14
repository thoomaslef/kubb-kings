/**
 * Le script `supabase/comptes.sql`, EXECUTE pour de vrai dans un Postgres embarque (PGlite).
 *
 * Jusqu'ici ce fichier n'etait jamais lance par personne avant le joueur : une faute de syntaxe se
 * decouvrait dans l'editeur SQL de Supabase. On verifie ici qu'il s'execute en entier, qu'il se
 * relance sans erreur, et que les regles du pseudo (`set_pseudo`) tiennent — avec de vrais
 * utilisateurs, de vraies lignes et la vraie contrainte d'unicite.
 *
 * `auth.uid()` et `auth.users` n'existent que chez Supabase : on en pose de petits equivalents.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { conclure } from '../browser/harness.mjs';

const resultats = {};
const erreurs = [];
const db = new PGlite();

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create or replace function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
  create role anon; create role authenticated;
`);

const sql = readFileSync(new URL('../../supabase/comptes.sql', import.meta.url), 'utf8');
let ok = true;
try {
  await db.exec(sql);
  await db.exec(sql); // « sans danger a relancer »
} catch (e) {
  ok = false;
  erreurs.push(String(e));
}
resultats.leScriptSExecuteEtSeRelance = ok;

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
await db.exec(`insert into auth.users values ('${A}'), ('${B}')`);
const moi = (id) => db.exec(`select set_config('request.uid', '${id ?? ''}', false)`);
const pseudo = async (texte) => {
  const r = await db.query('select public.set_pseudo($1) as r', [texte]);
  return r.rows[0].r;
};
const creerProfil = async (id) => {
  await moi(id);
  await db.query('select public.save_profile($1::jsonb, 0)', ['{}']);
};
await creerProfil(A);
await creerProfil(B);

await moi(A);
const premier = await db.query('select pseudo from public.profiles where user_id = $1', [A]);
resultats.unPseudoEstGenereALaCreation = typeof premier.rows[0].pseudo === 'string' && premier.rows[0].pseudo.length > 0;

// -------- ce qui est refuse
const refus = async (texte, code) => {
  const r = await pseudo(texte);
  return r.ok === false && r.error === code;
};
resultats.refus_tropCourt = await refus('ab', 'too-short');
resultats.refus_tropLong = await refus('a'.repeat(17), 'too-long');
resultats.refus_caracteres = (await refus('Roi du Kubb', 'chars')) && (await refus('a@b.com', 'chars')) && (await refus('<b>x</b>', 'chars'));
resultats.refus_termeInterdit = (await refus('Connard42', 'forbidden')) && (await refus('m3rde', 'forbidden')) && (await refus('xX_putain_Xx', 'forbidden'));
resultats.refus_motCourtEntier = (await refus('pute', 'forbidden')) && (await refus('sale_pd', 'forbidden'));
resultats.refus_nomReserve = (await refus('Admin', 'forbidden')) && (await refus('KubbKings', 'forbidden'));
resultats.accepte_motsCourantsQuiContiennentUnTermeCourt = [];
for (const p of ['Classic', 'Technique', 'Violet', 'Nazir']) {
  // Le delai de 5 minutes s'applique apres un vrai changement : on repasse l'horloge en arriere entre deux essais.
  await db.exec(`update public.profiles set pseudo_changed_at = now() - interval '1 hour'`);
  const r = await pseudo(p);
  resultats.accepte_motsCourantsQuiContiennentUnTermeCourt.push(r.ok === true);
}
resultats.accepte_motsCourantsQuiContiennentUnTermeCourt = resultats.accepte_motsCourantsQuiContiennentUnTermeCourt.every(Boolean);

// -------- ce qui est accepte, et ses limites
await db.exec(`update public.profiles set pseudo_changed_at = null`);
const bon = await pseudo('Viking_Ra');
resultats.unBonPseudoEstAccepte = bon.ok === true && bon.pseudo === 'Viking_Ra';
const lu = await db.query('select pseudo from public.profiles where user_id = $1', [A]);
resultats.leProfilPorteLeNouveauPseudo = lu.rows[0].pseudo === 'Viking_Ra';
resultats.unSecondChangementImmediatEstRefuse = await refus('AutreNom', 'too-soon');

await moi(B);
resultats.unPseudoPrisEstRefuse_memeEnMajuscules = await refus('VIKING_RA', 'taken');
await moi(A);
const memeCasse = await pseudo('viking_ra');
resultats.sonPropreNomChangeDeCasseSansDelaiNiConflit = memeCasse.ok === true && memeCasse.pseudo === 'viking_ra';

await db.exec(`update public.profiles set pseudo_changed_at = now() - interval '6 minutes'`);
const apresDelai = await pseudo('Nouveau_Nom');
resultats.apresLeDelaiOnPeutChanger = apresDelai.ok === true;

// -------- droits
await moi('');
let anonRefuse = false;
try {
  await pseudo('Quelquun');
} catch {
  anonRefuse = true;
}
resultats.sansConnexionOnNePeutPas = anonRefuse;

// Un utilisateur sans profil en ligne : « pas pret » (le client reessaiera apres sa synchronisation).
const C = '00000000-0000-0000-0000-00000000000c';
await db.exec(`insert into auth.users values ('${C}')`);
await moi(C);
resultats.sansProfilEnLigneOnLeDit = await refus('Quelquun', 'not-ready');

// -------- le classement ne montre que des pseudos
await moi(A);
const classement = await db.query('select * from public.get_leaderboard(10)');
resultats.leClassementSeLit = Array.isArray(classement.rows);

console.log(resultats);
conclure(resultats, erreurs);
