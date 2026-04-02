import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { applyDynamicColors } from './lib/dynamicColors';

// Register service worker for PWA
registerSW({ immediate: true });

// Apply Material You dynamic colors
applyDynamicColors('#6750A4');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

