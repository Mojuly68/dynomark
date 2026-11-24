# DYNOMARK store listing (v1.0)

Paste-ready text for App Store Connect and Google Play Console. Character counts are checked against each store's limit (`python store/check_lengths.py`). Nothing here promises features the app doesn't have.

URLs (live once the pages are uploaded):
- Privacy policy: https://studio-vektor.com/send/privacy.html
- Support: https://studio-vektor.com/send/support.html
- Marketing (optional): https://studio-vektor.com/send/

Contact email (already public on studio-vektor.com): mo.elkhalloufi@studio-vektor.com

---

## Apple App Store

**App name** (max 30): `DYNOMARK: Climbing Log`
Fallback if taken: `DYNOMARK Climbing Tracker`

**Subtitle** (max 30): `Log sends. Track every grade.`

**Promotional text** (max 170, can change without review):
`Warm-up plans, hangboard load as % of body weight, and monthly climbing reports. Log every send in seconds, privately on your phone.`

**Keywords** (max 100, comma-separated, no spaces):
`climbing,bouldering,boulder,logbook,tracker,grades,hangboard,training,routes,sends,progress,gym`

**Primary category:** Health & Fitness · **Secondary:** Sports
**Price:** Free · **Copyright:** `2026 Studio Vektor`
**Age rating:** answer "None" to every content question → 4+.

**App Privacy:** Data Not Collected. (Everything is stored on the device; there are no accounts, analytics or ads.)
**App Privacy from 1.1 (Pro via RevenueCat):** change to "Data collected":
- Purchases → **Purchase History**: used for App Functionality (and Analytics: plan counts in RevenueCat). Not linked to the user's identity (random app user ID). Not used for tracking.
- Identifiers: none declared (RevenueCat's ID is a random per-install ID; no IDFA, no account).
- Everything else (health/fitness, body data, photos, location, contact info): not collected; it stays on the device.
Also add at the end of the description for 1.1:
`Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`
`Privacy Policy: https://studio-vektor.com/send/privacy.html`

**App Review notes:**
`No login needed. The app opens with a demo account full of sample data (labelled "Demo"); Profile → "Start fresh with my own log" clears it. All data stays on the device; there is no server. Camera/photo access is only requested when the user picks a profile photo.`

**Description** (max 4000): use the shared description below.

---

## Google Play

**App name** (max 30): `DYNOMARK: Climbing Log`

**Short description** (max 80):
`Fast climbing logbook: log sends, warm up smart, track grades and projects.`

**Full description** (max 4000): use the shared description below.

**Category:** Health & Fitness · **Tags:** Climbing, Fitness tracking, Workout
**Contact:** email above · **Website:** https://studio-vektor.com/send/
**Ads:** No · **Target audience:** 13 and over (not designed for children)
**Content rating (IARC):** answer "No" to violence, sexual content, language, controlled substances, gambling, user interaction and location sharing → expected rating Everyone / PEGI 3.
**Data safety:** No data collected · No data shared · (Encryption in transit: not applicable, nothing is sent) · Users can delete data by clearing the app or Profile → Start fresh.
**Health apps declaration (if asked):** Activity and fitness tracking; no medical claims; no health data leaves the device.

---

## Shared description

```
DYNOMARK is a fast, focused logbook for indoor climbers. Log routes and boulders in a few taps, warm up with a plan built from your own sends, and watch your grades move across months and gyms.

LOG IN SECONDS
• Routes (YDS 5.5 to 5.15) and boulders (V0 to V12+)
• Flash, onsight, redpoint, project or repeat, with attempts, wall angle, hold colour and style
• Repeat-last and duplicate for laps
• Mark warm-ups so easy laps don't skew your stats

WARM UP SMARTER
• A warm-up ladder built from your recent working grade
• Tick the steps off as you go

SEE YOUR PROGRESS
• Grade progression with trend lines, volume and send rates
• Flash, onsight and redpoint rates, and attempts per send
• Consistency calendar and weekly streaks
• Personal records and first-time milestones
• Monthly reports and your year in climbing

CHASE PROJECTS
• Track your high point session by session
• An outlook based on your own progress, clearly labelled as an estimate
• A proper celebration when you send

TRAIN WITH PURPOSE
• Fingerboard, pull and core routines with a rest timer and your previous numbers
• Hangboard load calculator: added weight to % of body weight, and back

YOUR GYMS
• Pick your gym, keep favourites and see your history at each one
• Compare gyms using only your own logs, with optional soft or hard grade adjustments

PRIVATE BY DESIGN
• No account, no ads, no tracking
• Everything stays on your phone; export your history as CSV any time
• Share cards for sessions, records and monthly recaps

DYNOMARK opens with a labelled demo account so you can explore. Start your own log from Profile whenever you're ready.
```

---

## Screenshots (in `store/screenshots/`)

| Store | Folder | Size | Required |
|---|---|---|---|
| App Store, iPhone 6.9" | `ios-6.9/` | 1320 × 2868 | Yes |
| App Store, iPad 13" | `ios-ipad-13/` | 2064 × 2752 | Yes, while the app supports iPad |
| Google Play, phone | `play-phone/` | 1080 × 1920 | Yes (2 to 8) |
| Google Play, 10" tablet | `play-tablet-10/` | 1600 × 2560 | Optional |

Also in `store/`: `play-icon-512.png` (Play listing icon) and `play-feature-1024x500.png` (Play feature graphic). The App Store icon comes from the build itself.

Screenshots show the demo account (sample data), as the app does on first launch.
