import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/lib/firebase';
import App from '@/app/App';
import '@/index.css';
import { reloadForNewVersion } from '@/lib/lazyWithReload';

// A page opened before a deploy can't load the new version's code files.
// Vite reports that here; reload once to pick up the current version.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
