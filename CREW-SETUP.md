# Crew (DYNOMARK 1.3): setup checklist

Branch `crew-1.3`. Crew is built and works in the local preview with a labelled demo crew (`npm run dev`, Crew tab).
Store and web builds show **no Crew tab** until a Crew server is configured, so this branch is safe to build.

## What's in the app

- Tab bar: Home · Progress · + · Crew · Train (Crew replaces Projects; Projects stays on Home).
- `#/crew`: join (Sign in with Apple) → username → posting choice → feed with "Crew this week" and reactions.
- `#/crew/add`: invite link + QR code, username search, requests (accept/decline), sent requests. No contact upload.
- `#/crew/u/<id>`: friend profile, You vs friend (30D/3M free, 1Y/All Pro), their posts; hide, remove, block + report.
- `#/crew/settings`: posting mode, what friends can see, blocked climbers, sign out, **delete Crew account** (Apple rule).
- Session summary: "Post to Crew" with preview and per-field switches; asks automatically after a session (mode "ask")
  or posts by itself (mode "auto"). Sample data is never posted to the real server.
- Code: `src/crew/` (types, local settings, demo + Supabase backends, provider, UI), `src/screens/Crew*.tsx`.
- Server: `supabase/migrations/20261127000000_crew.sql` (tables, row-level security, accept/delete functions).
- Invite page: `public/c/index.html` → `studio-vektor.com/dynomark/c/?u=<username>`.

## 1. Supabase project (you, ~10 min)

1. supabase.com → New project, name `dynomark-crew`, region US West, free plan. Save the database password in your password manager.
2. SQL Editor → paste the whole `supabase/migrations/20261127000000_crew.sql` → Run.
3. Project Settings → API: copy the **Project URL** and the **anon public** key. Both are public by design.
   Paste them into `codemagic.yaml` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) or give them to Claude.
   Never paste the `service_role` key anywhere.

## 2. Sign in with Apple (you, ~10 min)

1. developer.apple.com → Identifiers → `com.studiovektor.dynomark` → tick **Sign in with Apple** → Save.
2. Codemagic → Code signing → regenerate the App Store profile "DYNOMARK App Store" so it includes the new capability
   (the app now has `ios/App/App/App.entitlements`). A build with the old profile fails at signing.
3. Supabase → Authentication → Providers → Apple → Enable. **Client IDs:** `com.studiovektor.dynomark`.
   Secret key: not needed for the native iPhone flow (only for web sign-in, which 1.3 doesn't use).

## 3. Test (TestFlight)

1. Start the Codemagic build from branch `crew-1.3` → TestFlight 1.3.
2. Two test phones (or you + a founder): sign in, pick usernames, add each other, post a session, react, compare,
   block/unblock, delete account. Check that a blocked climber can't find you and posts disappear after removal.
3. Supabase → Table editor → `reports`: this is where reports arrive. Check it weekly (Apple expects you to act on them).

## 4. Before submitting 1.3 (needs your OK)

- Upload the updated `privacy.html` + `support.html` and the new `c/` page to `/dynomark/` (they describe Crew).
- App Store Connect → App Privacy: change "Data Not Collected" to declare, **linked to the user, not used for tracking**:
  User ID (Crew account), Name (optional first name), Other User Content (session summaries, reactions),
  plus the existing Purchase History (RevenueCat). Purpose: App Functionality.
- Age rating questionnaire: answer the user-generated content question (usernames and session summaries are shared with
  accepted friends; there's block, report and account deletion).
- Review notes: add two demo Crew accounts that are already friends, with posts, so App Review can see the feed.
  Describe: no comments, block + report in a friend's profile, delete account in Crew › Sharing & privacy.
- Merge `crew-1.3` into `main` only after 1.2 is live and the founder deadline (Tue 2 Dec) has passed.

## Later (1.4+)

- Universal links so the invite link opens the app directly (needs Associated Domains).
- Push notifications (project sends), "At the wall now", Android Crew with Google sign-in.
