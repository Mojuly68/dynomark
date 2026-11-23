import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Roboto for Android, Windows and Linux; Apple devices use their system font (SF Pro).
import '@fontsource-variable/roboto';
import '@fontsource-variable/roboto-mono';
import './index.css';
import { App } from './App';
import { hideLaunch, registerOffline } from './lib/pwa';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerOffline();
// Never leave the launch screen up if a screen fails to load.
setTimeout(hideLaunch, 4000);
