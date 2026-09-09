import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, isPreview }) => ({
  /**
   * GitHub Pages sert le jeu depuis https://<user>.github.io/kubb-kings/.
   * `npm run preview` doit utiliser la meme base que le build, sinon il sert
   * un index.html dont tous les assets pointent ailleurs ; seul le serveur de
   * dev reste a la racine, pour garder des URL courtes.
   */
  base: command === 'build' || isPreview ? '/kubb-kings/' : '/',
  plugins: [react()],
  server: {
    port: 5174,
    // host: true -> permet de tester depuis un vrai telephone sur le meme reseau
    host: true,
    open: false
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500
  }
}));
