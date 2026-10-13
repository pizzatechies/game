# 🍕 Pizza Stack — a Pizza Technologies game

One-tap, "just one more try" pizza stacking arcade game. Tap to drop the sliding pizza; anything hanging over the edge is sliced off, so the tower gets narrower until you nail a **perfect** drop. Chain perfects for combos, trigger **PIZZA FEVER** (8 perfects in a row), and climb through five worlds — Kitchen → Rooftop → City Lights → Orbit → Pizza Galaxy.

One HTML5 code base ships to **Android (APK/AAB)**, **iPhone (IPA)**, **Windows / macOS / Linux**, and the **web (PWA)**.

| | |
|---|---|
| **Branding** | Two-stage launch splash (animated Pizza Technologies logo → animated Pizza Stack game splash, tap to skip), the official logo on title / sponsor screen / settings / desktop side panel, "A Pizza Technologies game" footer, app icon badge and native Android / iOS splash screens |
| **Animations** | All drawn in code (canvas + CSS): squash & stretch, perfect rings, confetti, screen shake, fever rainbow, parallax worlds, falling slices, auto-playing attract mode on the title screen. Nothing to download → everything is inside the APK |
| **Online + offline** | Fully playable with no connection. Service worker (web), bundled assets (Android/desktop). Scores queue locally and sync when online; leaderboard is cached for offline viewing; daily rewards/missions use the device clock |
| **Addictive loop** | Instant restart, rising musical notes on perfect streaks, combos & fever, daily rewards (7-day streak), 3 daily missions, 8 unlockable pizza skins, 3 permanent upgrades, "next unlock" progress bar on every game-over, global leaderboard, share button |
| **Revenue** | Unity LevelPlay rewarded + interstitial ads (Android + iOS), AdSense side-panels + sponsor ads (web), Stripe purchases with server-verified unlocks (web/desktop). Details below |

## Play it now

```bash
npm install
npm run serve          # http://localhost:8080  (web build)
npm start              # desktop window (Electron)
npm run server         # optional online leaderboard server on :8787
npm test               # server tests
node tools/e2e.js      # full browser end-to-end test (needs Playwright + Chromium)
```
Controls: tap / click / **Space**, **Esc** pauses, **F11** fullscreen (desktop app).

## Getting the APK (and PC installers)

The sandbox this was written in blocks Google's Android SDK/Maven servers, so the APK is built by **GitHub Actions** — nothing to install on your side:

1. Push this repo to GitHub. Open **Actions → "Build Pizza Stack"** (it runs on every push, or press *Run workflow*).
2. Download the artifacts from the finished run:
   * `PizzaStack-android-debug-apk` → `app-debug.apk` — install directly on any Android phone (allow "unknown sources").
   * `PizzaStack-windows` (`.exe` installer + portable), `PizzaStack-linux` (`.AppImage`, `.deb`), `PizzaStack-macos` (`.dmg`).
3. **Official release-signed APK + Play Store / Galaxy Store AAB** (needs YOUR signing key, which I can never create for you):
   ```bash
   bash tools/make-keystore.sh        # on your computer, needs a JDK; prompts for a password
   ```
   It prints the 4 values to add under **Settings → Secrets and variables → Actions**: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Then push (or run the workflow again) and download **`PizzaStack-android-release`** (signed `.apk` + `.aab`). **Back the keystore up — you cannot update the app in any store without it.** Never commit it to git.
   Before building the official release also put your LevelPlay App Key and ad unit IDs in `www/js/config.js` (see "Making money"); without them the release has no real ads.
   Until the secrets exist, CI still builds a release APK + AAB with a throwaway key, uploaded as `PizzaStack-android-release-THROWAWAY-KEY-NOT-FOR-STORES`, only to prove the release pipeline works. Those files must not be published.
4. Pushing a tag like `v1.0.0` also publishes everything as a GitHub Release.

Prefer building locally? Install Android Studio (JDK 21) and run `npm run android:debug` (APK lands in `android/app/build/outputs/apk/debug/`) or `npm run android:release`. Desktop installers: `npm run dist:win|linux|mac` (build each on its own OS).

## Getting the iPhone app (iOS)

The iOS app is the same game in a Capacitor/Xcode project (`ios/`), built on a **macOS runner in GitHub Actions** (the job named `ios`), so you do not need a Mac. It is **iPhone only, portrait**, minimum iOS 15, built with Xcode 26 as Apple now requires.

**1. Without any Apple account: an unsigned IPA for testing.** Every run uploads **`PizzaStack-ios-unsigned-ipa`** (`PizzaStack-ios-unsigned.ipa`, ads in test mode). iOS will not install it as is: sign it onto your own iPhone with **Sideloadly** (Windows/Mac) or **AltStore** using a free Apple ID (the install lasts 7 days). It is meant for trying the game, not for sharing.

**2. The official App Store build.** Apple requires a paid **Apple Developer Program** membership. Then:
1. developer.apple.com > *Identifiers*: register the App ID `com.pizzatechnologies.pizzastack`. App Store Connect > *Apps*: create the app record.
2. Make the signing certificate on your own computer (OpenSSL only, no Mac needed; **keep the files private and backed up**, never paste them into chat):
   ```bash
   bash tools/make-ios-signing.sh csr                    # makes pizza-ios.key (PRIVATE) + pizza-ios.csr
   ```
   Upload `pizza-ios.csr` at developer.apple.com > *Certificates* > (+) > **Apple Distribution**, download the `.cer`, then:
   ```bash
   bash tools/make-ios-signing.sh p12 distribution.cer   # prints IOS_CERT_P12_BASE64 + the password to use as IOS_CERT_PASSWORD
   ```
3. developer.apple.com > *Profiles* > (+) > **App Store Connect** distribution profile for the App ID above and the certificate from step 2; download it, then `bash tools/make-ios-signing.sh profile Pizza_Stack.mobileprovision` prints `IOS_PROFILE_BASE64`.
4. Add these as repository secrets (**Settings > Secrets and variables > Actions**): `IOS_CERT_P12_BASE64`, `IOS_CERT_PASSWORD`, `IOS_PROFILE_BASE64`, `APPLE_TEAM_ID` (10 characters, from Membership details).
5. Optional, to send the build to TestFlight automatically (only runs on pushes to `main`, release tags `v*` and manual *Run workflow* runs, so ordinary branch pushes do not each create a TestFlight build): App Store Connect > *Users and Access* > *Integrations* > create an **App Store Connect API key** (role *App Manager*), download the `.p8` once, and add `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64` (`base64 < AuthKey_XXXX.p8 | tr -d '\n'`). Without them, download **`PizzaStack-ios-appstore-ipa`** and upload it with Apple's *Transporter* app (needs a Mac) or add the three secrets.

Push (or run the workflow again) and the signed **`PizzaStack-ios-appstore-ipa`** appears. Until the four signing secrets exist, CI only builds the unsigned IPA and prints a notice saying so. The build number is the workflow run number (it must rise with every upload); set the repository variable `IOS_VERSION` (e.g. `1.0.1`) to raise the visible version for each App Store release.
**Not yet verified:** the signing/export/upload steps need your Apple account to run, so they are written from Apple's documented flow but untested; if the first signed run fails, the log tail is printed in the job and the fix is usually a profile/certificate mismatch.

Store listing text, screenshots (1320 x 2868) and the App Privacy answers are in [`store/listing-ios.md`](store/listing-ios.md). **iOS ads need their own LevelPlay app** (see the table below); until you add its keys the iOS app shows the sponsor card. The first launch shows our privacy dialog and then Apple's tracking prompt, as the ad networks require.
Locally on a Mac: `npm run ios:sync && npm run ios:open`, then run it from Xcode (CocoaPods is required for the ad SDK).

## Making money (what is built, and what you must plug in)

Everything ships in **safe test mode** — Google's public test ad ids, no store links — so nothing earns until you add Pizza Technologies' own accounts. All switches live in [`www/js/config.js`](www/js/config.js).

| Channel | Where | What it does | You must |
|---|---|---|---|
| **Rewarded video** (Unity LevelPlay) | Android + iOS | "Continue" after a game over, "Double coins", free coins in the shop, 2× daily reward. Always optional (the best-paying, best-liked format) | Use your LevelPlay (formerly ironSource) account, add Pizza Stack as its own app, create a **Rewarded** ad unit (the ironSource network is built in; *Unity Ads* is optional extra demand); paste App Key + ad unit id in `config.js → ads.levelplay.android` (and `.ios` for the iPhone app: **each platform is its own app in LevelPlay**); set `ads.testMode:false` |
| **Interstitial** (Unity LevelPlay) | Android + iOS | Full-screen ad every 4th run (never in the first runs, never to paying players) | Create an **Interstitial** ad unit and paste its id |
| **Consent** | Android + iOS | A native **Accept / Decline** dialog is shown on first launch before any ad loads (iPhone: followed by Apple's tracking prompt); the answer goes to LevelPlay and the Unity Ads network. Players can reopen it from Settings → *Ad & privacy choices* | Put your hosted privacy-policy URL in `ads.levelplay.privacyPolicyUrl`. **It is a simple dialog, not an IAB-certified consent platform.** For audited EU/UK compliance switch the plugin to a certified provider (`levelplay.consentProvider` in `package.json`, e.g. Usercentrics) and have a lawyer review |
| **AdSense** | Web | Ads in the empty side-panels on wide screens | Get AdSense approval, set `ads.adsenseClient` + `adsenseSlots` |
| **Sponsor ad** | Web / PC | Clearly-labelled house ad for the "watch to earn" buttons when no ad network is present (promote your own products or swap for an ad network) | Edit text in `index.html` (`#houseAd`) |
| **Purchases** | Web / PC | *Remove Ads*, *1,500 coins*, *Pizza Pass* via Stripe Payment Links, unlocked by a **signature-verified webhook** on your server (idempotent, tested) | Create 3 Stripe Payment Links, paste URLs in `config.js → store`, deploy `server/`, add webhook, set env vars (below) |

**Ads without keys.** Until a platform's `appKey` (`ads.levelplay.android` / `.ios`) is set that app still works: "watch to earn" shows the sponsor card (nothing earned). Test the ad flow without a network via `node tools/ads-test.js` (a scripted fake LevelPlay plugin).

**Not built yet — in-app purchases.** Google (Play Billing) and Apple (StoreKit) require their own billing for digital goods inside apps, so the Store tab is intentionally hidden in the Android and iOS apps; their revenue at launch is ads. To add IAP later, integrate `cordova-plugin-purchase` (Play Billing) and set `adsRemoved` / `pass` in the save data on a verified purchase — the game already honours both flags.

### Online server (leaderboard + purchase unlocks)

`server/server.js` has **zero dependencies** (Node 18+); a `Dockerfile` is included.

```bash
# any host that runs Node or Docker (Fly.io, Render, Railway, a VPS...)
PORT=8787 DATA_DIR=/data \
STRIPE_WEBHOOK_SECRET=whsec_... \
PAYMENT_LINKS='{"plink_AAA":"removeAds","plink_BBB":"coinPack","plink_CCC":"pizzaPass"}' \
node server/server.js
```
Then set `apiBase: 'https://your-server'` in `config.js`, and point a Stripe webhook (`checkout.session.completed`) at `https://your-server/api/stripe/webhook`. Scores are sanity-checked (max points per layer, max tap rate) and rate-limited. Until `apiBase` is set the game is simply 100 % offline with a local leaderboard.

## Before you publish (checklist)
- [ ] Add your LevelPlay App Key + ad unit IDs and set `ads.testMode:false` in `config.js`; replace `support@pizzatechnologies.com` / `studioUrl` in `config.js`.
- [ ] Host `www/privacy.html` (a template — have it reviewed) and enter its URL in Play Console; complete **Data safety** (ads + optional online scores) and the **content rating** questionnaire.
- [ ] iPhone: complete the iOS list in [`store/listing-ios.md`](store/listing-ios.md) (Apple Developer membership, App Store Connect record, the LevelPlay **iOS** app keys, screenshots, App Privacy answers).
- [ ] Play Console needs a 512×512 icon (`www/icons/icon-512.png`), a feature graphic and screenshots — grab them from the running game.
- [ ] Desktop installers are unsigned (Windows SmartScreen / macOS Gatekeeper will warn). Add a code-signing certificate via electron-builder env vars when you have one.
- [ ] Bump `version` in `package.json`/`config.js` and `VERSION` in `www/sw.js` for each release.

## Project layout
```
www/                  the game (HTML/CSS/JS, no build step)
  js/game.js            engine + renderer          js/ui.js     screens & flows
  js/store.js           saves, missions, daily     js/ads.js    monetization
  js/net.js             online/offline sync        js/audio.js  synthesized sound+music
android/              Capacitor Android project (Unity LevelPlay wired in, portrait)
ios/                  Capacitor iOS project (CocoaPods, Unity LevelPlay wired in, iPhone portrait)
electron/             desktop wrapper             server/       leaderboard + purchase backend
tools/                icon generator, dev server, tests   .github/workflows/  CI builds
```
The official logo lives in `brand/pizza-technologies-logo-original.png`. After changing it (or `tools/make-icons.js`) run `python3 tools/process-logo.py && npm run icons` to rebuild the transparent in-game logo, app icons and the Android / iOS splash screens.
