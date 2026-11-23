# DYNOMARK on TestFlight: checklist

Where things stand: the iPhone app project is ready in `ios/` (Capacitor 8, Swift Package Manager, bundle ID `com.studiovektor.dynomark`, app name DYNOMARK, icon and launch screen done). `codemagic.yaml` builds it on a cloud Mac and sends it to TestFlight. What's left needs your accounts.

## Progress (23 Nov 2026)
- [x] Apple Developer Program: Team ID `AV8QYWM9J7`
- [x] App ID registered: `AV8QYWM9J7.com.studiovektor.dynomark`
- [x] App created in App Store Connect: Apple ID `6838461384` (already in `codemagic.yaml`)
- [ ] App Store Connect API key added to Codemagic (Issuer ID, Key ID, `.p8` file), named "DYNOMARK"
- [ ] Private GitHub repo with `send-app/` pushed, connected to Codemagic
- [ ] First build → TestFlight

## 1. Apple Developer Program (you, once)
- Enrol at developer.apple.com/programs with your Apple ID: $99 a year. As a company you'll need a D-U-N-S number; as an individual you don't.
- Approval can take from a few hours to a couple of days.

## 2. Create the app in App Store Connect (you, about 10 minutes)
- appstoreconnect.apple.com → Apps → + → New App.
  - Platform iOS. Name: **DYNOMARK** (if it's taken on the App Store, try "DYNOMARK Climbing"; the Home Screen name stays DYNOMARK).
  - Bundle ID: register **com.studiovektor.dynomark** (Certificates, Identifiers & Profiles → Identifiers → +), then pick it here. It can't be changed after the first upload, so say now if you want a different one.
  - SKU: anything, e.g. `dynomark-ios`.
- Note the app's **Apple ID** (App Information → Apple ID, a number) for step 4.

## 3. App Store Connect API key (you)
- Users and Access → Integrations → App Store Connect API → generate a key with the **App Manager** role.
- Download the `.p8` file (only possible once) and note the **Issuer ID** and **Key ID**.
- Keep the file private: it's a key to your Apple account. Never put it in the project.

## 4. Code on GitHub + Codemagic (you sign up, I can do the rest)
- Codemagic builds from a Git repository. Create a **private** GitHub repo (e.g. `dynomark`) and push `send-app/` to it. Ask me and I'll make the first commit and push.
- Sign up at codemagic.io with GitHub (the free plan includes Mac build minutes each month) and add the repo.
- Codemagic → Team settings → Integrations → App Store Connect: add the API key (Issuer ID, Key ID, `.p8`). Name it **DYNOMARK** (the name `codemagic.yaml` expects).
- In `codemagic.yaml`, set `APP_STORE_APPLE_ID` to the number from step 2.

## 5. Build
- Codemagic → the repo → Start new build → workflow **DYNOMARK iOS → TestFlight**.
- About 15–25 minutes later the build is in App Store Connect → TestFlight. Apple's processing adds roughly 10–30 more minutes.

## 6. Testers
- **Internal (up to 100, no review):** people on your App Store Connect team. Add them in TestFlight → Internal Testing, and they get an email.
- **External (up to 10,000):** create a group, add emails or turn on a public link. The first build needs a short Beta App Review (often within a day). It asks for a contact, a description and a **privacy policy URL**.
- Testers install **TestFlight** from the App Store, then DYNOMARK from the invite.

## Before outside testers
- A privacy policy page: the app stores climbing logs, body details and photos **only on the phone**; nothing is sent anywhere.
- App Store Connect will also ask about data collection ("App Privacy"). Today the honest answer is "no data collected", because nothing leaves the device.

## How the native app differs from the web app
- Files ship inside the app: no service worker, works offline from the first launch.
- Share cards and CSV export open the iOS share sheet (Save Image, Files, Messages, AirDrop).
- Its storage is separate from Safari and from the Home Screen web app: logs don't move between them (use Profile → Export).
- New version: rebuild on Codemagic. The build number goes up automatically.

## Updating the app's look
- `npm run icons` and `npm run splash` regenerate the iOS icon and launch screen too (the icon needs Python + Pillow to drop the alpha channel).
- After any web change: `npm run build`, then `npx cap sync ios` (Codemagic does both on every build).
