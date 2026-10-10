/**
 * Lance la verification des comptes de bout en bout : construit le jeu avec une
 * URL de service FACTICE, le sert, puis execute `comptes.mjs` (qui joue le role
 * du serveur en interceptant les requetes). Un build a part (`dist-comptes`),
 * parce que les autres verifications ont besoin d'un build SANS service.
 *
 *   npm run test:comptes
 */
import { spawn, spawnSync } from 'node:child_process';

const PORT = 4174;
const env = {
  ...process.env,
  VITE_SUPABASE_URL: 'http://fake.supabase.test',
  VITE_SUPABASE_ANON_KEY: 'fake-key',
  VITE_EXPOSE_TEST_HANDLE: '1',
  // Le bouton Google est cache tant que Google n'est pas configure (account/config.ts) : on l'allume pour le test.
  // (GOOGLE_AUTH_TEST=0 : verifie au contraire que le bouton reste cache quand Google n'est pas configure.)
  VITE_GOOGLE_AUTH: process.env.GOOGLE_AUTH_TEST ?? '1'
};

const build = spawnSync('npx', ['vite', 'build', '--outDir', 'dist-comptes'], { env, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const serveur = spawn('npx', ['vite', 'preview', '--outDir', 'dist-comptes', '--port', String(PORT), '--strictPort'], {
  env,
  stdio: 'ignore'
});
await new Promise((r) => setTimeout(r, 3000));

const test = spawnSync('node', ['tests/browser/comptes.mjs'], {
  env: { ...env, KUBB_URL: `http://localhost:${PORT}/kubb-kings/` },
  stdio: 'inherit'
});
serveur.kill();
process.exit(test.status ?? 1);
