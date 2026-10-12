# 🍕 Pizza Stack — a Pizza Technologies game

One-tap, "just one more try" pizza stacking arcade game. Tap to drop the sliding pizza; anything hanging over the edge is sliced off, so the tower gets narrower until you nail a **perfect** drop. Chain perfects for combos, trigger **PIZZA FEVER** (8 perfects in a row), and climb through five worlds — Kitchen → Rooftop → City Lights → Orbit → Pizza Galaxy.

One HTML5 code base ships to **Android (APK/AAB)**, **Windows / macOS / Linux**, and the **web (PWA)**.

| | |
|---|---|
| **Branding** | Animated Pizza Technologies splash, logo on title / game-over / settings / desktop side panel, "A Pizza Technologies game" footer, app icon and Android splash screens |
| **Animations** | All drawn in code (canvas + CSS): squash & stretch, perfect rings, confetti, screen shake, fever rainbow, parallax worlds, falling slices, auto-playing attract mode on the title screen. Nothing to download → everything is inside the APK |
| **Online + offline** | Fully playable with no connection. Service worker (web), bundled assets (Android/desktop). Scores queue locally and sync when online; leaderboard is cached for offline viewing; daily rewards/missions use the device clock |
| **Addictive loop** | Instant restart, rising musical notes on perfect streaks, combos & fever, daily rewards (7-day streak), 3 daily missions, 8 unlockable pizza skins, 3 permanent upgrades, "next unlock" progress bar on every game-over, global leaderboard, share button |
| **Revenue** | AdMob rewarded + interstitial ads (Android), AdSense side-panels + sponsor ads (web), Stripe purchases with server-verified unlocks (web/desktop). Details below |

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
3. **Release-signed APK + Play Store AAB**: create a keystore once, add 4 repository secrets, push again.
   ```bash
   keytool -genkeypair -v -keystore pizza.keystore -alias pizza -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 pizza.keystore        # -> secret ANDROID_KEYSTORE_BASE64
   ```
   Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. **Back the keystore up — you cannot update the app on Google Play without it.**
4. Pushing a tag like `v1.0.0` also publishes everything as a GitHub Release.

Prefer building locally? Install Android Studio (JDK 21) and run `npm run android:debug` (APK lands in `android/app/build/outputs/apk/debug/`) or `npm run android:release`. Desktop installers: `npm run dist:win|linux|mac` (build each on its own OS).

## Making money (what is built, and what you must plug in)

Everything ships in **safe test mode** — Google's public test ad ids, no store links — so nothing earns until you add Pizza Technologies' own accounts. All switches live in [`www/js/config.js`](www/js/config.js).

| Channel | Where | What it does | You must |
|---|---|---|---|
| **AdMob rewarded** | Android | "Continue" after a game over, "Double coins", free coins in the shop, 2× daily reward — always optional (the best-paying, best-liked format) | Create an AdMob account + app; put the **app id** in `android/app/src/main/res/values/strings.xml` (`admob_app_id`) and the two **ad-unit ids** in `config.js`; set `ads.testMode:false` |
| **AdMob interstitial** | Android | Full-screen ad every 4th run (never in the first 3 runs, never to paying players) | same as above |
| **Consent** | Android | Google UMP consent form for EEA/UK is requested automatically | Configure the consent message in AdMob → Privacy & messaging |
| **AdSense** | Web | Ads in the empty side-panels on wide screens | Get AdSense approval, set `ads.adsenseClient` + `adsenseSlots` |
| **Sponsor ad** | Web / PC | Clearly-labelled house ad for the "watch to earn" buttons when no ad network is present (promote your own products or swap for an ad network) | Edit text in `index.html` (`#houseAd`) |
| **Purchases** | Web / PC | *Remove Ads*, *1,500 coins*, *Pizza Pass* via Stripe Payment Links, unlocked by a **signature-verified webhook** on your server (idempotent, tested) | Create 3 Stripe Payment Links, paste URLs in `config.js → store`, deploy `server/`, add webhook, set env vars (below) |

**Not built yet — Google Play in-app purchases.** Google requires Play Billing for digital goods inside Android apps, so the Store tab is intentionally hidden on Android; Android revenue at launch is ads. To add IAP later, integrate `cordova-plugin-purchase` (Play Billing) and set `adsRemoved` / `pass` in the save data on a verified purchase — the game already honours both flags.

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
- [ ] Replace AdMob **test** ids + `testMode:false`; replace `support@pizzatechnologies.com` / `studioUrl` in `config.js`.
- [ ] Host `www/privacy.html` (a template — have it reviewed) and enter its URL in Play Console; complete **Data safety** (ads + optional online scores) and the **content rating** questionnaire.
- [ ] Play Console needs a 512×512 icon (`www/icons/icon-512.png`), a feature graphic and screenshots — grab them from the running game.
- [ ] Desktop installers are unsigned (Windows SmartScreen / macOS Gatekeeper will warn). Add a code-signing certificate via electron-builder env vars when you have one.
- [ ] Bump `version` in `package.json`/`config.js` and `VERSION` in `www/sw.js` for each release.

## Project layout
```
www/                  the game (HTML/CSS/JS, no build step)
  js/game.js            engine + renderer          js/ui.js     screens & flows
  js/store.js           saves, missions, daily     js/ads.js    monetization
  js/net.js             online/offline sync        js/audio.js  synthesized sound+music
android/              Capacitor Android project (AdMob wired in, portrait, test ids)
electron/             desktop wrapper             server/       leaderboard + purchase backend
tools/                icon generator, dev server, tests   .github/workflows/  CI builds
```
Regenerate brand art/icons after editing `tools/make-icons.js`: `npm run icons`.
