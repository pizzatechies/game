# Pizza Stack - Apple App Store listing kit (iPhone)

Companion to `listing.md` (Google Play / Galaxy Store). The images are real frames of the game: `node tools/make-store-assets.js ios` rebuilds them.
**Items marked [CONFIRM] are placeholders or claims only you can verify before you submit.** I wrote the field limits and sizes from memory of Apple's rules, so check them in App Store Connect while you fill the form.

## 1. Files and where they go

| File | Spec | Use for |
|---|---|---|
| `ios-screenshots/raw/01..08-*.jpg` | **1320 x 2868** JPG, portrait, real game frames at an iPhone-shaped screen | The **6.9" iPhone** screenshot slot. App Store Connect scales this set down for the smaller iPhones, so this one set is all you need. Upload 4 to 8; start with `01-title`, `02-perfect-combo`, `03-pizza-fever`, `05-orbit-galaxy` |
| `ios-screenshots/01..08-*.jpg` | 1320 x 2868 JPG, same frames with marketing captions | Optional "store-style" set (Apple wants screenshots to show the real app, so keep the raw set as your primary) |
| App icon | 1024 x 1024 PNG, no transparency | Already inside the build (`ios/App/App/Assets.xcassets/AppIcon.appiconset`). Nothing to upload |

The app is **iPhone only** (portrait), so no iPad screenshots are needed. To add iPad later, set `TARGETED_DEVICE_FAMILY = "1,2"` in `ios/App/App.xcodeproj` and supply 13" iPad screenshots.

## 2. Text

**Name** (11 chars, 30 max): `Pizza Stack`   [CONFIRM it is free in the App Store; the bundle id `com.pizzatechnologies.pizzastack` can never change]

**Subtitle** (29 chars, 30 max): `One-tap pizza stacking arcade`

**Promotional text** (140 chars, 170 max, can be edited any time without a new build):
`Tap to drop pizzas, chain PERFECT drops, ignite Pizza Fever and climb from the kitchen to the Pizza Galaxy. Free, quick runs, plays offline!`

**Description** (4000 max): use the "Full description" from `listing.md` as is (1,275 chars). Do not mention Android, Google Play or other stores in an App Store listing.

**Keywords** (96 chars, 100 max, comma separated, no spaces after commas):
`stack,tower,tap,arcade,casual,pizza,endless,combo,offline,one tap,high score,skill,stacker,chill`

**What's New (1.0.0):** `First release of Pizza Stack! Tap, stack and chase the Pizza Galaxy.`

**Category:** Primary **Games**, subcategories **Arcade** and **Casual**.
**Copyright:** `2026 Pizza Technologies` [CONFIRM the legal entity name]
**Support URL:** your support page, e.g. `https://pizzatechnologies.com/support` [CONFIRM; required]
**Marketing URL:** `https://pizzatechnologies.com` [optional]
**Privacy Policy URL:** the public URL of `www/privacy.html` (e.g. via GitHub Pages) [CONFIRM; **required**, and it must name the ad partners]

## 3. App Store Connect answers (drafts, [CONFIRM] each one)

**Age rating questionnaire:** no violence, no sexual content, no profanity, no gambling or contests, no medical content, no horror, no user-generated content, no chat, no unrestricted web access. Expect **4+**. (Apple's questionnaire changes; answer each question for what the app does today.)

**Advertising:** the app shows ads (Unity LevelPlay / ironSource and Unity Ads): an interstitial between some runs once an interstitial ad unit is set, and optional rewarded videos.

**In-app purchases:** none. The Store tab (Stripe web purchases) is hidden in the native apps, as Apple requires in-app purchase for digital goods. Update this if you add StoreKit.

**Encryption:** the app only uses Apple's standard HTTPS/TLS, so it is exempt. `ITSAppUsesNonExemptEncryption = NO` is already set in `Info.plist`, so the build is not held for export-compliance questions each time.

**Tracking / App Tracking Transparency:** yes, the app asks for tracking permission (the plain-language reason is in `Info.plist`, key `NSUserTrackingUsageDescription`). Apple rejects apps that block play when the player says no; Pizza Stack plays the same either way, with less personalised ads.

**App Privacy ("nutrition label") draft.** The ad SDK collects this, so declare it as data collected **and used to track**:
| Data type | Purpose | Linked to the player? | Used for tracking? |
|---|---|---|---|
| Identifiers > Device ID (the advertising ID, IDFA) | Third-party advertising | No | Yes |
| Usage Data > Advertising Data | Third-party advertising | No | Yes |
| Usage Data > Product Interaction | Third-party advertising, analytics | No | Yes |
| Location > Coarse Location (derived from the IP address) | Third-party advertising | No | Yes |

If you deploy the score server and set `apiBase`, also declare the display name and random player ID that the leaderboard stores (Identifiers > User ID, Contact Info > Name, Gameplay Content) as collected for **App Functionality**, and add that to the privacy policy.
The same data is declared inside the app in `ios/App/App/PrivacyInfo.xcprivacy` (Apple compares the two). Check both against Unity's current data-disclosure guidance for LevelPlay, Unity Ads and the ironSource network [CONFIRM].

**App Review notes** (paste into the review notes box):
```
No sign-in is needed. Pizza Stack is a one-tap arcade game. On first launch the app shows a short privacy dialog (Accept / Decline) and then Apple's App Tracking Transparency prompt before any ad is requested. Declining either one does not limit the game. Rewarded videos are optional (the "watch ad" buttons). The app has no in-app purchases and no account system.
```

## 4. Before the first upload [CONFIRM]
- An **Apple Developer Program** membership (paid, yearly) for Pizza Technologies. The Team ID is on developer.apple.com > Membership details.
- The **bundle id** `com.pizzatechnologies.pizzastack` registered at developer.apple.com > Identifiers, and an **app record** in App Store Connect (SKU: anything unique, e.g. `pizzastack-ios`).
- A **LevelPlay iOS app**: in the LevelPlay dashboard add this game again for **iOS** (bundle id above). It gets its **own App Key and ad units**; paste them into `ads.levelplay.ios` in `www/js/config.js`. Until you do, the iOS app shows the sponsor card for "watch to earn" and nothing earns.
- Developer / company name exactly as registered.
