import type { CapacitorConfig } from '@capacitor/cli';

// Native wrapper for the iOS (TestFlight) build. The web app in dist/ is copied into the app on `npx cap sync`.
// The bundle ID is permanent once used in App Store Connect; change it here first if you want a different one.
const config: CapacitorConfig = {
  appId: 'com.studiovektor.dynomark',
  appName: 'DYNOMARK',
  webDir: 'dist',
  backgroundColor: '#111214',
  ios: {
    // The page handles the notch and home indicator itself (viewport-fit=cover + safe-area padding).
    contentInset: 'never',
    backgroundColor: '#111214',
  },
};

export default config;
