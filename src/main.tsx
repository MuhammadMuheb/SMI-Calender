import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/lib/firebase';
import App from '@/app/App';
import '@/index.css';
import '@/utils/devSeeding';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
