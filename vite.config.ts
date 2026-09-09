import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
});
