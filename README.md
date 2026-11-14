# 🍕 Pizza Stack — a Pizza Technologies game

One-tap, "just one more try" pizza stacking arcade game. **100 % ad-free** on every platform: no banners, no pop-ups, no videos, no tracking. Tap to drop the sliding pizza; anything hanging over the edge is sliced off, so the tower gets narrower until you nail a **perfect** drop. Chain perfects for combos, trigger **PIZZA FEVER** (8 perfects in a row), and climb through five worlds — Kitchen → Rooftop → City Lights → Orbit → Pizza Galaxy.

One HTML5 code base ships to **Android (APK/AAB)**, **iPhone (IPA)**, **Windows / macOS / Linux**, and the **web (PWA)**.

| | |
|---|---|
| **Branding** | Two-stage launch splash (animated Pizza Technologies logo → animated Pizza Stack game splash, tap to skip), the official logo on title screen / settings / desktop side panel, "A Pizza Technologies game" footer, app icon badge and native Android / iOS splash screens |
| **Animations** | All drawn in code (canvas + CSS): squash & stretch, perfect rings, confetti, screen shake, fever rainbow, parallax worlds, falling slices, auto-playing attract mode on the title screen. Nothing to download → everything is inside the APK |
| **Online + offline** | Fully playable with no connection. Service worker (web), bundled assets (Android/desktop). Scores queue locally and sync when online; leaderboard is cached for offline viewing; daily rewards/missions use the device clock |
| **Addictive loop** | Instant restart, rising musical notes on perfect streaks, combos & fever, daily rewards (7-day streak), 3 daily missions, 8 unlockable pizza skins, 3 permanent upgrades, "next unlock" progress bar on every game-over, global leaderboard, share button |
| **No ads** | No ad SDK, no ad network, no advertising ID, no tracking prompt. CI fails the build if ad code ever comes back. Optional Stripe purchases (coins, Pizza Pass) on web/desktop only |

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
   Until the secrets exist, CI still builds a release APK + AAB with a throwaway key, uploaded as `PizzaStack-android-release-THROWAWAY-KEY-NOT-FOR-STORES`, only to prove the release pipeline works. Those files must not be published.
4. Pushing a tag like `v1.0.0` also publishes everything as a GitHub Release.

Prefer building locally? Install Android Studio (JDK 21) and run `npm run android:debug` (APK lands in `android/app/build/outputs/apk/debug/`) or `npm run android:release`. Desktop installers: `npm run dist:win|linux|mac` (build each on its own OS).

## Getting the iPhone app (iOS)

The iOS app is the same game in a Capacitor/Xcode project (`ios/`), built on a **macOS runner in GitHub Actions** (the job named `ios`), so you do not need a Mac. It is **iPhone only, portrait**, minimum iOS 15, built with Xcode 26 as Apple now requires.

**1. Without any Apple account: an unsigned IPA for testing.** Every run uploads **`PizzaStack-ios-unsigned-ipa`** (`PizzaStack-ios-unsigned.ipa`). iOS will not install it as is: sign it onto your own iPhone with **Sideloadly** (Windows/Mac) or **AltStore** using a free Apple ID (the install lasts 7 days). It is meant for trying the game, not for sharing.

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

Store listing text, screenshots (1320 x 2868) and the App Privacy answers are in [`store/listing-ios.md`](store/listing-ios.md).
Locally on a Mac: `npm run ios:sync && npm run ios:open`, then run it from Xcode (CocoaPods is required).

## No ads

The official app has **no advertising at all**: the Unity LevelPlay / ironSource SDK, AdSense, the sponsor card, interstitials, "watch ad" rewards, the consent dialog and Apple's tracking prompt have all been removed. Coins come from playing, daily rewards and missions. The `test` CI job greps the app for ad SDKs and fails if any return, and `node tools/e2e.js` checks that no ad network is contacted.

**Optional purchases (web / desktop only):** *1,500 coins* and *Pizza Pass* (2x coins + Golden skin) via Stripe Payment Links, unlocked by a signature-verified webhook on the server. Create the links, paste them in `config.js → store`, deploy `server/` and set the env vars below. The Store tab stays hidden in the Android and iOS apps (Google and Apple require their own billing for digital goods).

### Online server (leaderboard + purchase unlocks)

`server/server.js` has **zero dependencies** (Node 18+); a `Dockerfile` is included.

```bash
# any host that runs Node or Docker (Fly.io, Render, Railway, a VPS...)
PORT=8787 DATA_DIR=/data \
STRIPE_WEBHOOK_SECRET=whsec_... \
PAYMENT_LINKS='{"plink_BBB":"coinPack","plink_CCC":"pizzaPass"}' \
node server/server.js
```
Then set `apiBase: 'https://your-server'` in `config.js`, and point a Stripe webhook (`checkout.session.completed`) at `https://your-server/api/stripe/webhook`. Scores are sanity-checked (max points per layer, max tap rate) and rate-limited. Until `apiBase` is set the game is simply 100 % offline with a local leaderboard.

## Before you publish (checklist)
- [ ] Replace `support@pizzatechnologies.com` / `studioUrl` in `config.js` with addresses you control.
- [ ] Host `www/privacy.html` (a template — have it reviewed) and enter its URL in Play Console; complete **Data safety** (no ads; only optional online scores) and the **content rating** questionnaire.
- [ ] iPhone: complete the iOS list in [`store/listing-ios.md`](store/listing-ios.md) (Apple Developer membership, App Store Connect record, screenshots, App Privacy answers).
- [ ] Play Console needs a 512×512 icon (`www/icons/icon-512.png`), a feature graphic and screenshots — grab them from the running game.
- [ ] Desktop installers are unsigned (Windows SmartScreen / macOS Gatekeeper will warn). Add a code-signing certificate via electron-builder env vars when you have one.
- [ ] Bump `version` in `package.json`/`config.js` and `VERSION` in `www/sw.js` for each release.

## Project layout
```
www/                  the game (HTML/CSS/JS, no build step)
  js/game.js            engine + renderer          js/ui.js     screens & flows
  js/store.js           saves, missions, daily     js/net.js    online/offline sync
  js/audio.js           synthesized sound+music
android/              Capacitor Android project (portrait, no ad SDK)
ios/                  Capacitor iOS project (CocoaPods, iPhone portrait, no ad SDK)
electron/             desktop wrapper             server/       leaderboard + purchase backend
tools/                icon generator, dev server, tests   .github/workflows/  CI builds
```
The official logo lives in `brand/pizza-technologies-logo-original.png`. After changing it (or `tools/make-icons.js`) run `python3 tools/process-logo.py && npm run icons` to rebuild the transparent in-game logo, app icons and the Android / iOS splash screens.
