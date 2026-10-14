import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { isForbiddenPseudo } from './pseudo';
import comptesSql from '../../../supabase/comptes.sql?raw';

/**
 * Le filtre du client (pseudo.ts) et celui du serveur (comptes.sql::pseudo_is_allowed) sont deux
 * ecritures de la MEME regle : on les execute ici sur les memes pseudos, le vrai SQL tournant
 * dans un Postgres embarque (PGlite), et on exige le meme verdict.
 */
const ECHANTILLON = [
  // refuses
  'Connard42', 'xX_putain_Xx', 'FUCKER', 'f_u_c_k', 'Enculé', 'm3rde', 'nigger', 'HITLER88', 'p0rn', 'pute', 'Pute42',
  'sale_pd', 'NTM', 'cul-de-sac', 'Admin', 'admin_42', 'Moderateur', 'KubbKings', 'support', 'tagueule', 'niquer',
  // acceptes
  'Classic', 'Technique', 'Violet', 'Violon', 'Passion', 'Compute', 'Assassin', 'Nazir', 'Conan', 'Sexton', 'Biter',
  'Pedro', 'Cumulus', 'Scunthorpe', 'Mishine', 'Thomas', 'Roi_du_Kubb', 'Le-Viking', 'Zoe42', 'Éloïse', 'Viking_Ra',
  'Administrateurs', 'Supporter', 'Nikola', 'Kubby'
];

describe('filtre du pseudo : client et serveur disent la meme chose', () => {
  it('memes verdicts sur un echantillon', async () => {
    const db = new PGlite();
    await db.exec(`
      create schema auth;
      create table auth.users (id uuid primary key);
      create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      create role anon; create role authenticated;
    `);
    await db.exec(comptesSql);
    for (const p of ECHANTILLON) {
      const r = await db.query<{ ok: boolean }>('select public.pseudo_is_allowed($1) as ok', [p]);
      expect(!r.rows[0].ok, `${p} : le serveur ${r.rows[0].ok ? 'accepte' : 'refuse'}`).toBe(isForbiddenPseudo(p));
    }
  }, 60000);
});
