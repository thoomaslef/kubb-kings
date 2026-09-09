import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { installGlobalCrashHandlers } from './game/diagnostics';
import { registerServiceWorker } from './registerServiceWorker';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root introuvable');

installGlobalCrashHandlers();

// Pas de StrictMode : le double montage de dev creerait deux instances Phaser.
createRoot(container).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

registerServiceWorker();
