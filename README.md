# DYNOMARK · Climbing Performance Tracker

(Called SEND until 23 Nov 2026. The folder name `send-app`, the `/send/` web folder and the `send.data.v1` storage key keep the old name so existing installs and logs carry over.)

A mobile-first web app for indoor climbers: log routes and boulders in seconds, track projects and training, and see grade progress across gyms.

React 19 · TypeScript · Tailwind CSS 4 · Recharts · Lucide · Vite.

## Run it

Node is installed portably at `%LOCALAPPDATA%\Programs\node` (not on PATH). In PowerShell:

```powershell
$env:Path = "$env:LOCALAPPDATA\Programs\node;$env:Path"
npm run dev        # http://localhost:5180
npm run build      # type-check + production build into dist/
```

`dist/` is static and works from any host, in any folder (it uses hash routes and relative asset paths).

## Install on iPhone (web app)

- `public/manifest.webmanifest` and the icons in `public/` make it installable: Safari → Share → Add to Home Screen. It then opens full screen with its own icon.
- The build writes `dist/sw.js` (see `offlineWorker()` in `vite.config.ts`): it precaches the whole app, so it opens and logs climbs offline. Pages are network-first, so a new upload reaches the phone on the next launch.
- Offline support needs HTTPS (or localhost). Over plain `http://` the app still works, just not offline.
- On iPhone the Home Screen app keeps its own storage, separate from Safari: data logged in a Safari tab doesn't appear in the installed app.
- Logo: the DYNOMARK logotype (the "Dyno" style: slanted block letters, one cut, an orange hold); the app icon is its D. Geometry lives in `src/lib/logo.ts` (used by `<Logo>` and the share cards). `npm run icons` renders the `dynomark-*` icons in `public/` with local Chrome (`scripts/make-icons.mjs`; set `CHROME_PATH` if needed). Fonts: SF Pro on Apple devices (system font; Apple's licence doesn't allow bundling it), self-hosted Roboto and Roboto Mono (`@fontsource-variable/*`) everywhere else; stacks in `src/lib/fonts.ts` and `index.css`. Nothing loads from Google.
- Splash screens: `npm run splash` (`scripts/make-splash.mjs`) renders 30 launch images into `public/splash/` (12 iPhone sizes, 9 iPad sizes in both orientations) and rewrites two generated blocks in `index.html`: the `apple-touch-startup-image` links, and an in-page launch screen with the same design. Android can't use launch images for web apps; Chrome builds its splash from the manifest (`background_color` + icon), then the in-page launch screen shows until the first screen has loaded (`hideLaunch()` in `src/lib/pwa.ts`). A new iPhone or iPad size needs a line in the script. iOS only reads launch images when the app is added to the Home Screen.
- The Claude desktop browser pane blocks service workers; test offline mode in Chrome or Edge (`npm run build`, then serve `dist/`).

## iPhone app (TestFlight)

- `ios/` is a native iOS project made with Capacitor 8 (Swift Package Manager, no CocoaPods). Bundle ID `com.studiovektor.dynomark`, set in `capacitor.config.ts`.
- `npm run build` then `npx cap sync ios` copies `dist/` into the app. `codemagic.yaml` does that on a Codemagic cloud Mac, signs the app and uploads it to TestFlight.
- Steps that need your accounts (Apple Developer, App Store Connect, GitHub, Codemagic) are in [TESTFLIGHT.md](TESTFLIGHT.md).
- Native-only behaviour lives in `src/lib/native.ts`: share cards and CSV go through the iOS share sheet, the status bar follows the theme, and no service worker is registered.

## Android app (test APK)

- `android/` is the Capacitor Android project (package `com.studiovektor.dynomark`, Android 7 and newer, targets Android 16).
- Build tools are portable on this PC: Java 21 at `%LOCALAPPDATA%\Programs\jdk-21.0.13.1+2`, Android SDK at `%LOCALAPPDATA%\Android\Sdk` (`android/local.properties` points to it; not committed).
- Build a test APK (PowerShell):

```powershell
$env:JAVA_HOME = "$env:LOCALAPPDATA\Programs\jdk-21.0.13.1+2"; $env:Path = "$env:LOCALAPPDATA\Programs\node;$env:Path"; npm run build; npx cap sync android; cd android; .\gradlew.bat assembleDebug
```

- Result: `%LOCALAPPDATA%\dynomark-build\app\outputs\apk\debug\app-debug.apk`. On Windows the Gradle build folder sits outside OneDrive, which otherwise locks files mid-build (see `android/build.gradle`). It's a debug build signed with this PC's debug key: fine for testers (Settings → allow installing unknown apps), not for the Play Store.
- Play release: `.\gradlew.bat bundleRelease` signs with the upload key from `%USERPROFILE%\.dynomark-signing\keystore.properties` (outside the project; see `android/app/build.gradle`) and writes `%LOCALAPPDATA%\dynomark-build\app\outputs\bundle\release\app-release.aab`.
eleasepp-release.aab`.
- Store listing text, screenshots and Play graphics: `store/` (`listing.md`, `make-screenshots.mjs`). Privacy and support pages: `public/privacy.html`, `public/support.html`.
- On Android the safe-area sizes come from Capacitor as `--safe-area-inset-*` CSS variables; `index.css` folds them into `--sa-top` / `--sa-bottom` with `env()` as the fallback.
- `npm run icons` / `npm run splash` also write the Android launcher icons and splash drawables.

## Free and Pro

- `src/lib/pro.tsx` holds everything Pro: plans and example prices, `usePro()`, the upsell sheet (`useUpsell()`), `ProGate`, `LockLabel`, and `purchase()` / `restore()`, the only places that will call RevenueCat once the store products exist.
- Pro state lives in `settings.pro` (`plan`, `since`, `source`). `source: 'preview'` is a testing switch (Profile → Preview Pro, or the paywall button) that unlocks Pro with no payment.
- **Store builds must turn the switch off:** build with `VITE_PRO_PREVIEW=false` (codemagic.yaml does this for iOS; for the Play bundle run `$env:VITE_PRO_PREVIEW='false'; npm run build; npx cap sync android` before `bundleRelease`).
- Free: all logging, warm-ups, projects, training, hangboard calculator, CSV export, progress for 7 and 30 days, the session share card. Pro: progress 3M to all time (Progress and Home charts), monthly and yearly reports, gym comparison and grade adjustments, hangboard % body-weight history, the other share-card styles.
- Paywall at `#/pro` (`src/screens/Pro.tsx`), with the plan picker, auto-renew terms, Restore purchases, and links to Apple's standard EULA and the privacy policy.

## Data

- Everything lives in `localStorage` under `send.data.v1`. `src/store/storage.ts` is the only place that reads or writes it. To add a backend and login, implement `DataStore` against your API and pass it to `<StoreProvider store={...}>`.
- The data model is in `src/types.ts` (users, gyms, sessions, climbs, projects, exercises, routines, training, records, achievements).
- First launch loads a **demo account** (`src/data/demo.ts`): about 140 sessions across 6 gyms, dated relative to today. Every demo record has `isDemo: true` and the UI labels it as sample data. Profile → "Start fresh" clears it.
- Profile → Export writes all climbs as CSV.
- **Warm-ups:** a climb can be marked as a warm-up (`warmup` on `Climb`). Warm-ups count toward volume (climbs, sends, tries) but are left out of grade averages, flash/on-sight/redpoint rates, attempts per send, best flash session and style send rates (`totals()` in `src/lib/stats.ts`). The Log screen shows a warm-up ladder until the first non-warm-up climb of a session: it builds to your working grade, the median of your five hardest non-warm-up sends in the last 30 days (`src/lib/warmup.ts`).
- **Hangboard load:** Training has a calculator from added weight to % body weight and back (`src/components/LoadCalculator.tsx`, `src/lib/load.ts`). Hangs are exercises of kind `weight_time`; negative added weight means a pulley or band takes weight off. Workouts save the profile weight when finished (`bodyWeightKg`), so % body weight history stays right when your weight changes. Training weights are in the chosen units.
- **Reports:** `/report?m=YYYY-MM` and `/report?y=YYYY` (`src/screens/Report.tsx`, `src/lib/report.ts`): sends, sessions, days and hours, hardest sends (with "best yet" against everything before), milestones, projects, gyms (new ones flagged), busiest week or best month, wall-angle mix, training, and a share card. A period still in progress is compared with the same stretch of the previous one. Linked from Progress, and from Home in the first week of each month.
- Profile → photo and "About you": optional photo (cropped and shrunk to a 256 px JPEG in `src/lib/image.ts`, about 5–30 KB), weight, height, gender (with self-describe) and experience level, all on `user` in `src/types.ts`. Weight and height are stored in kg and cm and shown in the chosen units (Metric or Imperial); out-of-range values are rejected. The experience level is the climber's choice; the app only suggests one from their hardest logged sends (`src/lib/profile.ts`).

## Gym directory

`src/data/gyms.ts`, from the brands' own pages (Nov 2026). Touchstone's locations page gives city only, so those gyms have no address or disciplines until the climber adds them. Benchmark and Bridges list bouldering, addresses and amenities.

## Stats definitions (`src/lib/stats.ts`)

- **Send**: any outcome except Project. **New send**: excludes Repeats.
- **Flash rate**: flashes ÷ new sends. **On-sight / redpoint rate**: share of new route sends.
- **Attempts per send**: average attempts over new sends.
- **Streak**: consecutive Monday-based weeks with at least one session.
- **Gym comparisons** use only the climber's own logs; per-gym grade adjustments are applied only when switched on.
- **Project outlook** extrapolates the high point per session and is labelled an estimate. The training/climbing card shows Pearson r and says correlation isn't causation.

## Limits of this prototype

- Photos and videos: only file names are saved; uploads need the backend.
- One device, one browser; no sync or accounts yet.
