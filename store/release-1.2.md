# DYNOMARK 1.2: App Store text

1.1 went live on 26 Nov 2026 (earlier than planned), so submit 1.2 now. It must be out before people stop downloading for the founder deal.
Build 1.2 (10) or later: it adds the founder date cutoff (first download before 3 Dec 2026 08:00 UTC = end of Tue 2 Dec Pacific). Build 9 lacks it.
Build: Codemagic build from commit with MARKETING_VERSION 1.2. Release: manual or automatic, the user's choice.

## What's New in This Version

A cleaner start and quicker gym picks.

• New installs start with an empty log, ready for your own climbs. Want to look around first? Profile → Load the demo account.
• Add your name in Profile; the app greets you with it.
• Star your favorite gyms right in the gym list: they jump to the top every time you log.
• Founding members: everyone who downloads DYNOMARK by Tuesday 2 December gets Pro free, for life. Already downloaded? This update unlocks it.

## App Review Information → Notes (replace the 1.1 notes)

No login needed. The app now opens with an empty log. To see every screen filled with sample data, go to Profile → "Load the demo account" (sample data is labelled "Demo"); Profile → "Start fresh with my own log" clears it again. All climbing data stays on the device.

DYNOMARK Pro (in-app purchases approved with 1.1): Pro Yearly (com.studiovektor.dynomark.pro.yearly, auto-renewable, 1-month free trial), Pro Monthly (com.studiovektor.dynomark.pro.monthly, auto-renewable) and Pro Lifetime (com.studiovektor.dynomark.pro.lifetime, non-consumable). To reach the paywall: Profile → DYNOMARK Pro → "See Pro plans", or tap a locked item such as Progress → 1Y. "Restore purchases" is at the top of the paywall; Terms of Use (Apple standard EULA) and Privacy Policy links are at the bottom.

Founding members: people whose Apple ID first downloaded DYNOMARK version 1.0, or any version before 3 December 2026 (end of 2 December, Pacific time), get Pro without paying. This is read from the App Store receipt (original application version and original purchase date). The app only uses production receipts: in the sandbox the original application version is "1.0", which the app ignores, so reviewers see the normal paywall.

External services: purchases go through StoreKit, with RevenueCat (revenuecat.com) used to validate them and keep Pro status. No accounts, analytics, ads or AI. The app works the same in all regions.

New in 1.2: empty first launch (demo moved to Profile), "Enter name" field, a star button on each gym in the gym picker to mark favorites, and the founding-member date above.
