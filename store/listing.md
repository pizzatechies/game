# Pizza Stack - store listing kit (Galaxy Store / Google Play)

Everything here is generated from the real game: `node tools/make-store-assets.js` rebuilds the images; the text below is edited by hand.
**Items marked [CONFIRM] are placeholders or claims only you can verify before you submit.**

## 1. Files and where they go

| File | Spec | Use for |
|---|---|---|
| `icon-512.png` | 512 x 512 PNG | App icon (Galaxy Store and Google Play) |
| `screenshots/01..08-*.jpg` | 1080 x 1920 JPG, portrait, real game frames (each under 250 KB) | Phone screenshots. Upload 4 to 8; start with `01-title`, `02-perfect-combo`, `03-pizza-fever`, `05-orbit-galaxy` |
| `screenshots-captioned/01..08-*.jpg` | 1080 x 1920 JPG, marketing captions around the same frames | Promo / "store-style" screenshots. Some stores ask that screenshots show the real app, so keep the raw set as your primary |
| `feature-graphic-1024x500.jpg` | 1024 x 500 JPG | Google Play feature graphic; use as the cover / banner image where Galaxy Store asks for one (check the size in the portal) |

Check the portal's current size rules when you upload: store requirements change, and I wrote these from memory. No tablet or 7-inch images are included. The game is a portrait phone layout.
The ONLINE/OFFLINE status pill and temporary toasts are hidden in the captures, and they use a lightly progressed demo save (some coins and unlocked pizzas), so the shop and missions screens look lived-in. All the gameplay is real.

## 2. Text

**Title** (11 chars): `Pizza Stack`
Check that the name is free in the store and not trademarked before you commit to it. The package id `com.pizzatechnologies.pizzastack` cannot change after publishing. [CONFIRM]

**Short description** (67 chars, 80 max):
`Tap to stack pizza sky-high! One-tap arcade fun, online or offline.`

Alternatives:
- `One-tap pizza stacking. Chain perfects, ignite Pizza Fever, reach the galaxy!` (77)
- `Stack pizza layers, chain perfect drops and climb to the Pizza Galaxy.` (70)

**Full description** (1276 chars, 4000 max):

```
PIZZA STACK - THE ONE-TAP ARCADE GAME YOU CAN'T PUT DOWN

A pizza slides across the screen. Tap at just the right moment to drop it on your tower! Anything hanging over the edge gets sliced off, so every sloppy drop makes your stack narrower. Nail a PERFECT drop to keep your stack strong, and see how high you can build.

HOW HIGH CAN YOU GO?
• One-tap controls: easy to learn, hard to put down
• Chain PERFECT drops to build combos. Every perfect plays a rising musical note
• 8 perfects in a row ignites PIZZA FEVER: rainbow pizzas, double coins and extra-forgiving drops
• Climb through five worlds: the Kitchen, the Rooftop, City Lights, Orbit and the Pizza Galaxy

COLLECT, UNLOCK, UPGRADE
• Earn coins on every run and unlock 8 pizza styles: Margherita, Pepperoni, Veggie Supreme, Hawaiian, Four Cheese, Inferno, Galaxy Pie and the Golden Pizza
• Upgrade your Thicker Dough, Coin Magnet and Chef's Eye
• Claim daily rewards with a 7-day streak and take on three fresh missions every day

PLAY ANYWHERE
• Works fully offline: no connection needed
• Chill lofi-pop soundtrack (you can switch it off)
• Quick runs and instant restart for "just one more try" sessions
• Free to play. Contains ads; rewarded videos are always optional

Made with love by Pizza Technologies.
```

Optional line to add under "PLAY ANYWHERE" ONLY once the leaderboard server is deployed (`apiBase` set in `www/js/config.js`); until then the leaderboard is local only, so do not advertise it:
`• [ADD ONLY ONCE THE SCORE SERVER IS LIVE] Compete for a spot on the Top Chefs leaderboard when you're online`

**What's new (v1.0.0):** `First release of Pizza Stack! Tap, stack and chase the Pizza Galaxy.`

**Keywords / tags:** arcade, stacking, tap, casual, one-tap, pizza, offline, lofi, high score, endless

**Category:** Games > Arcade (casual)

## 3. Store questionnaires (draft answers, [CONFIRM] each with your own judgement)

**Content rating:** no violence, no sexual content, no gambling, no user-generated content, no chat. Players choose a display name that appears on the leaderboard (only when the score server is on). Expect an "Everyone / 3+" style rating. Ads are shown.

**Ads:** yes, this app contains ads (Unity LevelPlay / Unity Ads; interstitials between runs and optional rewarded videos).

**In-app purchases:** none in the Android build today (the web/PC purchase links are not part of the app store build). Update this when you add Play Billing or Samsung IAP.

**Data collected (draft for the Data Safety style form):**
- Device or other IDs: advertising ID, collected by the ad network (Unity LevelPlay / Unity Ads) for ads and measurement. Also approximate location from IP and device/diagnostic info; confirm the exact list against Unity's current disclosure guidance [CONFIRM].
- App activity: gameplay scores and a random player ID, sent only when online and only if you deploy the score server.
- User-chosen display name (optional, shown on the leaderboard).
- No location, contacts, photos, microphone or camera. No account or login.
- Data can be deleted on request (support email) [CONFIRM].
Have a lawyer review `www/privacy.html` and host it at a public URL before submitting. The store form needs that URL.

## 4. Placeholders to replace [CONFIRM]
- Support email `support@pizzatechnologies.com` and website `https://pizzatechnologies.com` are placeholders in `www/js/config.js` and `www/privacy.html`; make sure you control them.
- LevelPlay App Key and ad unit IDs must be added in `www/js/config.js` before the release build (see README).
- Developer / company name exactly as registered with the store.
