import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Roboto for Android, Windows and Linux; Apple devices use their system font (SF Pro).
import '@fontsource-variable/roboto';
import '@fontsource-variable/roboto-mono';
import './index.css';
import { App } from './App';
import { hideLaunch, registerOffline } from './lib/pwa';
import { isNative } from './lib/native';

// In the iOS/Android app, lock the zoom: iOS zooms in when a text field is focused and then stays zoomed,
// leaving screens magnified and cut off at the right. (Fields are 16px+ anyway; this is the safety net.)
// The web version keeps pinch-zoom for accessibility.
if (isNative()) {
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerOffline();
// Never leave the launch screen up if a screen fails to load.
setTimeout(hideLaunch, 4000);
