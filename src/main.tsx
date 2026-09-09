import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { registerServiceWorker } from './registerServiceWorker';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root introuvable');

// Pas de StrictMode : le double montage de dev creerait deux instances Phaser.
createRoot(container).render(<App />);

registerServiceWorker();
